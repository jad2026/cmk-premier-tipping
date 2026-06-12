"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Add fixture (creates gameweek row if it doesn't exist yet)
// ---------------------------------------------------------------------------
export async function addFixture(formData: FormData) {
  const supabase = await createClient();

  const gameweekNumber = Number(formData.get("gameweek_number"));
  const homeTeamId = formData.get("home_team_id") as string;
  const awayTeamId = formData.get("away_team_id") as string;
  const matchDate = formData.get("match_date") as string;
  const venue = (formData.get("venue") as string).trim() || null;

  if (!gameweekNumber || !homeTeamId || !awayTeamId || !matchDate) {
    return { error: "All fields except venue are required." };
  }

  if (homeTeamId === awayTeamId) {
    return { error: "Home and away teams must be different." };
  }

  // Upsert the gameweek (create if not exists)
  const { data: gameweek, error: gwError } = await supabase
    .from("gameweeks")
    .upsert(
      {
        number: gameweekNumber,
        label: `Round ${gameweekNumber}`,
        // Default deadline: midday Saturday of the week the fixture falls in
        deadline: new Date(matchDate).toISOString(),
        is_open: false,
      },
      { onConflict: "number", ignoreDuplicates: true }
    )
    .select("id")
    .single();

  // If upsert ignored the duplicate we need to fetch the existing row
  let gameweekId: string;
  if (gwError || !gameweek) {
    const { data: existing, error: fetchErr } = await supabase
      .from("gameweeks")
      .select("id")
      .eq("number", gameweekNumber)
      .single();

    if (fetchErr || !existing) {
      return { error: `Could not resolve gameweek: ${fetchErr?.message}` };
    }
    gameweekId = existing.id;
  } else {
    gameweekId = gameweek.id;
  }

  const { error: fixtureError } = await supabase.from("fixtures").insert({
    gameweek_id: gameweekId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_date: new Date(matchDate).toISOString(),
    venue,
    result_team_id: null,
  });

  if (fixtureError) {
    return { error: fixtureError.message };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Save results — auto-fills missing picks, then scores all picks.
//
// Step 1 — auto-fill: before scoring, any registered user who has not picked
//   every fixture in the gameweek gets a random pick inserted (auto_picked=true).
//   This runs via a SECURITY DEFINER SQL function so it can write on behalf of
//   any user regardless of RLS.
//
// Step 2 — score: sets result_team_id on the fixture and calls another
//   SECURITY DEFINER function to update is_correct on all picks in one shot,
//   bypassing the per-user RLS that would block the admin session.
//
// A result of "draw" → result_team_id = NULL → all picks marked incorrect.
// ---------------------------------------------------------------------------
export async function saveResults(
  results: { fixtureId: string; resultTeamId: string | null }[]
) {
  const supabase = await createClient();
  const errors: string[] = [];

  // Only process entries where a result has actually been selected
  const toProcess = results.filter((r) => r.resultTeamId);
  if (toProcess.length === 0) return { errors };

  // ── Step 1: auto-fill missing picks ─────────────────────────────────────
  // Look up the gameweek(s) for the fixtures we're about to score
  const fixtureIds = toProcess.map((r) => r.fixtureId);

  const { data: fixtureMeta, error: metaErr } = await supabase
    .from("fixtures")
    .select("id, gameweek_id")
    .in("id", fixtureIds);

  if (metaErr) {
    errors.push(`Fixture metadata fetch: ${metaErr.message}`);
  } else {
    const uniqueGameweekIds = Array.from(
      new Set((fixtureMeta ?? []).map((f) => f.gameweek_id))
    );

    for (const gwId of uniqueGameweekIds) {
      console.log(`[saveResults] auto_fill_missing_picks → gameweek_id=${gwId}`);
      const { error: autoErr } = await supabase.rpc(
        "auto_fill_missing_picks",
        { p_gameweek_id: gwId }
      );
      if (autoErr) {
        console.error(`[saveResults] auto_fill_missing_picks FAILED (gameweek ${gwId}):`, autoErr.message);
        errors.push(`Auto-pick (gameweek ${gwId}): ${autoErr.message}`);
      } else {
        console.log(`[saveResults] auto_fill_missing_picks OK (gameweek ${gwId})`);
      }
    }
  }

  // ── Step 2: set result and score picks ───────────────────────────────────
  for (const { fixtureId, resultTeamId } of toProcess) {
    const dbResultTeamId = resultTeamId === "draw" ? null : resultTeamId;

    // Persist the result on the fixture row
    const { error: fixErr } = await supabase
      .from("fixtures")
      .update({ result_team_id: dbResultTeamId })
      .eq("id", fixtureId);

    if (fixErr) {
      errors.push(`Fixture ${fixtureId}: ${fixErr.message}`);
      continue;
    }

    // Score all picks for this fixture via SECURITY DEFINER function
    // (bypasses the per-user RLS policy on picks)
    const { error: scoreErr } = await supabase.rpc("score_fixture_picks", {
      p_fixture_id: fixtureId,
      p_result_team_id: dbResultTeamId,
    });

    if (scoreErr) errors.push(`Score ${fixtureId}: ${scoreErr.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  return { errors };
}

// ---------------------------------------------------------------------------
// Bulk import — accepts pre-resolved fixture rows from the client
// ---------------------------------------------------------------------------
export type BulkFixtureRow = {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  matchDate: string; // YYYY-MM-DD
  venue: string | null;
};

export async function bulkImportFixtures(rows: BulkFixtureRow[]) {
  const supabase = await createClient();
  const errors: string[] = [];
  let imported = 0;

  // Resolve all unique round numbers → gameweek ids in one pass
  const uniqueRounds = Array.from(new Set(rows.map((r) => r.round)));
  const gameweekIdByRound = new Map<number, string>();

  for (const round of uniqueRounds) {
    // Representative date: take the first fixture for this round
    const rep = rows.find((r) => r.round === round)!;
    const deadline = new Date(`${rep.matchDate}T12:00:00+12:00`).toISOString();

    await supabase
      .from("gameweeks")
      .upsert(
        { number: round, label: `Round ${round}`, deadline, is_open: false },
        { onConflict: "number", ignoreDuplicates: true }
      );

    const { data: gw, error: gwErr } = await supabase
      .from("gameweeks")
      .select("id")
      .eq("number", round)
      .single();

    if (gwErr || !gw) {
      errors.push(`Round ${round}: could not resolve gameweek — ${gwErr?.message}`);
      continue;
    }
    gameweekIdByRound.set(round, gw.id);
  }

  // Insert fixtures
  for (const row of rows) {
    const gameweekId = gameweekIdByRound.get(row.round);
    if (!gameweekId) {
      errors.push(`Round ${row.round}: skipped (gameweek resolution failed)`);
      continue;
    }

    const { error: insErr } = await supabase.from("fixtures").insert({
      gameweek_id: gameweekId,
      home_team_id: row.homeTeamId,
      away_team_id: row.awayTeamId,
      match_date: new Date(`${row.matchDate}T15:00:00+12:00`).toISOString(),
      venue: row.venue,
      result_team_id: null,
    });

    if (insErr) {
      errors.push(`Row (round ${row.round}): ${insErr.message}`);
    } else {
      imported++;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { imported, errors };
}

// ---------------------------------------------------------------------------
// Season config — mark the season as complete or reopen it
// ---------------------------------------------------------------------------
export async function setSeasonComplete(complete: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("season_config")
    .upsert({ id: 1, season_complete: complete }, { onConflict: "id" });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Team logo — persists the public Storage URL after the client uploads the file
// ---------------------------------------------------------------------------
export async function updateTeamLogoUrl(teamId: string, logoUrl: string | null) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("teams")
    .update({ logo_url: logoUrl })
    .eq("id", teamId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/tips");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  return { error: null };
}
