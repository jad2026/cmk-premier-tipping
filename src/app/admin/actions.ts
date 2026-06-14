"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendResultsEmail, type ResultsEmailPayload } from "@/lib/email/resultsEmail";

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

  // ── Step 3: auto-complete season if all fixtures now have results ────────
  const { data: incomplete } = await supabase
    .from("fixtures")
    .select("id")
    .is("result_team_id", null)
    .limit(1);

  if (incomplete && incomplete.length === 0) {
    console.log("[saveResults] All fixtures have results — marking season complete");
    await supabase
      .from("season_config")
      .upsert({ id: 1, season_complete: true }, { onConflict: "id" });
  }

  // ── Step 4: send results emails to all users ─────────────────────────────
  const emailGameweekIds = Array.from(new Set((fixtureMeta ?? []).map((f) => f.gameweek_id)));
  console.log("[saveResults] About to send emails");
  try {
    await sendResultsEmailsForGameweeks(emailGameweekIds);
    console.log("[saveResults] Emails sent successfully");
  } catch (err) {
    console.error("[saveResults] Email error:", err);
  }

  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  return { errors };
}

// ── Results email dispatcher ──────────────────────────────────────────────────
// Fetches all data for the given gameweeks and sends one email per user.

async function sendResultsEmailsForGameweeks(gameweekIds: string[]) {
  if (gameweekIds.length === 0) {
    console.log("[resultsEmail] No gameweek IDs — skipping");
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn("[resultsEmail] RESEND_API_KEY not set — skipping email dispatch");
    return;
  }

  console.log(`[resultsEmail] Starting dispatch for gameweeks: ${gameweekIds.join(", ")}`);
  const supabase = await createClient();

  for (const gwId of gameweekIds) {
    // Fetch gameweek label
    const { data: gw } = await supabase
      .from("gameweeks")
      .select("label")
      .eq("id", gwId)
      .single();
    if (!gw) { console.warn(`[resultsEmail] Gameweek ${gwId} not found — skipping`); continue; }

    // Fetch all fixtures for this gameweek
    const { data: fixtures } = await supabase
      .from("fixtures")
      .select("id, result_team_id, home_team_id, away_team_id, match_date")
      .eq("gameweek_id", gwId)
      .order("match_date");
    if (!fixtures || fixtures.length === 0) { console.warn(`[resultsEmail] No fixtures for ${gw.label} — skipping`); continue; }

    // Only send if all fixtures in this round have results
    if (fixtures.some((f) => f.result_team_id === null)) {
      console.log(`[resultsEmail] ${gw.label} has incomplete results — skipping email`);
      continue;
    }
    console.log(`[resultsEmail] ${gw.label} is fully scored — proceeding`);

    // Fetch all picks for these fixtures
    const fixtureIds = fixtures.map((f) => f.id);
    const { data: picks } = await supabase
      .from("picks")
      .select("user_id, fixture_id, picked_team_id, is_correct, auto_picked")
      .in("fixture_id", fixtureIds);
    if (!picks) continue;

    // Fetch all teams for name lookup
    const { data: teams } = await supabase.from("teams").select("id, name");
    const teamName = (id: string | null) => teams?.find((t) => t.id === id)?.name ?? "?";

    // Fetch leaderboard: total correct per user across all rounds
    const { data: allCorrect } = await supabase
      .from("picks")
      .select("user_id, is_correct")
      .eq("is_correct", true);

    const seasonTally = new Map<string, number>();
    for (const p of allCorrect ?? []) {
      seasonTally.set(p.user_id, (seasonTally.get(p.user_id) ?? 0) + 1);
    }

    // Build sorted leaderboard for position lookup
    const leaderboardEntries = Array.from(seasonTally.entries())
      .sort((a, b) => b[1] - a[1]);

    const positionOf = (userId: string): number => {
      const score = seasonTally.get(userId) ?? 0;
      const rank = leaderboardEntries.findIndex(([, s]) => s <= score);
      return rank === -1 ? leaderboardEntries.length + 1 : rank + 1;
    };

    // Fetch all user emails + profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name");

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.warn("[resultsEmail] SUPABASE_SERVICE_ROLE_KEY not set — cannot look up user emails, skipping");
      continue;
    }

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get all user IDs who have picks in this round
    const userIds = Array.from(new Set(picks.map((p) => p.user_id)));
    console.log(`[resultsEmail] ${gw.label} — sending to ${userIds.length} user(s)`);

    for (const userId of userIds) {
      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
      if (userErr) { console.error(`[resultsEmail] Failed to fetch user ${userId}:`, userErr.message); continue; }
      const email = userData?.user?.email;
      if (!email) { console.warn(`[resultsEmail] No email for user ${userId} — skipping`); continue; }

      const profile = profiles?.find((p) => p.id === userId);
      const displayName = profile?.display_name?.trim() || `Player ${userId.slice(0, 5).toUpperCase()}`;

      const userPicks = picks.filter((p) => p.user_id === userId);
      const roundCorrect = userPicks.filter((p) => p.is_correct).length;
      const roundTotal = userPicks.length;

      const fixtureResults = fixtures.map((f) => ({
        homeTeam: teamName(f.home_team_id),
        awayTeam: teamName(f.away_team_id),
        winner: f.result_team_id ? teamName(f.result_team_id) : null,
      }));

      const userPickRows = userPicks.map((pk) => {
        const fixture = fixtures.find((f) => f.id === pk.fixture_id)!;
        return {
          homeTeam: teamName(fixture?.home_team_id ?? null),
          awayTeam: teamName(fixture?.away_team_id ?? null),
          pickedTeam: teamName(pk.picked_team_id),
          isCorrect: pk.is_correct ?? false,
          autoPicked: pk.auto_picked ?? false,
        };
      });

      const payload: ResultsEmailPayload = {
        to: email,
        roundLabel: gw.label,
        fixtures: fixtureResults,
        picks: userPickRows,
        correct: roundCorrect,
        total: roundTotal,
        leaderboardPosition: positionOf(userId),
        totalPlayers: leaderboardEntries.length,
        seasonCorrect: seasonTally.get(userId) ?? 0,
      };

      await sendResultsEmail(payload);
      console.log(`[resultsEmail] Sent ${gw.label} results to ${email} (${displayName})`);
    }
  }
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
// Participants — list all registered users with email, joined date, rounds count
// Requires service role key to access auth.users
// ---------------------------------------------------------------------------
export type ParticipantRow = {
  id: string;
  email: string;
  displayName: string;
  joinedAt: string;
  roundsSubmitted: number;
  totalCorrect: number;
};

export async function fetchParticipants(): Promise<{ data: ParticipantRow[]; error: string | null }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { data: [], error: "SUPABASE_SERVICE_ROLE_KEY not set" };

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const supabase = await createClient();

  const [{ data: { users }, error: usersErr }, { data: profiles }, { data: picks }, { data: fixtures }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("picks").select("user_id, fixture_id, is_correct"),
      supabase.from("fixtures").select("id, gameweek_id"),
    ]);

  if (usersErr) return { data: [], error: usersErr.message };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const fixtureGwMap = new Map((fixtures ?? []).map((f) => [f.id, f.gameweek_id]));

  // Count distinct gameweeks per user
  const roundsByUser = new Map<string, Set<string>>();
  const correctByUser = new Map<string, number>();
  for (const p of picks ?? []) {
    const gwId = fixtureGwMap.get(p.fixture_id);
    if (gwId) {
      if (!roundsByUser.has(p.user_id)) roundsByUser.set(p.user_id, new Set());
      roundsByUser.get(p.user_id)!.add(gwId);
    }
    if (p.is_correct) correctByUser.set(p.user_id, (correctByUser.get(p.user_id) ?? 0) + 1);
  }

  const data: ParticipantRow[] = (users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    displayName: profileMap.get(u.id)?.trim() || `Player ${u.id.slice(0, 5).toUpperCase()}`,
    joinedAt: u.created_at,
    roundsSubmitted: roundsByUser.get(u.id)?.size ?? 0,
    totalCorrect: correctByUser.get(u.id) ?? 0,
  }));

  data.sort((a, b) => b.totalCorrect - a.totalCorrect);
  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Results history — all scored rounds with fixture results and pick summaries
// ---------------------------------------------------------------------------
export type FixtureHistoryRow = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  winner: string | null;
  totalPicks: number;
  correctPicks: number;
};

export type RoundHistoryRow = {
  gameweekId: string;
  label: string;
  fixtures: FixtureHistoryRow[];
};

export async function fetchResultsHistory(): Promise<{ data: RoundHistoryRow[]; error: string | null }> {
  const supabase = await createClient();

  const [{ data: gameweeks }, { data: fixtures }, { data: teams }, { data: picks }] =
    await Promise.all([
      supabase.from("gameweeks").select("id, label, number").order("number"),
      supabase.from("fixtures").select("id, gameweek_id, home_team_id, away_team_id, result_team_id").not("result_team_id", "is", null),
      supabase.from("teams").select("id, name"),
      supabase.from("picks").select("fixture_id, is_correct"),
    ]);

  const teamName = (id: string | null) => teams?.find((t) => t.id === id)?.name ?? "?";
  const gwMap = new Map((gameweeks ?? []).map((g) => [g.id, g]));

  // Group fixtures by gameweek, only those with results
  const byGw = new Map<string, FixtureHistoryRow[]>();
  for (const f of fixtures ?? []) {
    const fixturePicksData = (picks ?? []).filter((p) => p.fixture_id === f.id);
    const row: FixtureHistoryRow = {
      fixtureId: f.id,
      homeTeam: teamName(f.home_team_id),
      awayTeam: teamName(f.away_team_id),
      winner: f.result_team_id ? teamName(f.result_team_id) : null,
      totalPicks: fixturePicksData.length,
      correctPicks: fixturePicksData.filter((p) => p.is_correct).length,
    };
    if (!byGw.has(f.gameweek_id)) byGw.set(f.gameweek_id, []);
    byGw.get(f.gameweek_id)!.push(row);
  }

  const data: RoundHistoryRow[] = Array.from(byGw.entries())
    .map(([gwId, fixRows]) => ({
      gameweekId: gwId,
      label: gwMap.get(gwId)?.label ?? gwId,
      fixtures: fixRows,
    }))
    .sort((a, b) => {
      const na = gwMap.get(a.gameweekId)?.number ?? 0;
      const nb = gwMap.get(b.gameweekId)?.number ?? 0;
      return nb - na;
    });

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// Start new season — archives current data, clears tables, resets config
// ---------------------------------------------------------------------------
export async function startNewSeason(seasonName: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Fetch everything to archive
  const [
    { data: gameweeks },
    { data: fixtures },
    { data: picks },
    { data: profiles },
    { data: allCorrect },
  ] = await Promise.all([
    supabase.from("gameweeks").select("*"),
    supabase.from("fixtures").select("*"),
    supabase.from("picks").select("*"),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("picks").select("user_id").eq("is_correct", true),
  ]);

  // Determine winner from this season
  const tally = new Map<string, number>();
  for (const p of allCorrect ?? []) {
    tally.set(p.user_id, (tally.get(p.user_id) ?? 0) + 1);
  }
  let winnerName: string | null = null;
  if (tally.size > 0) {
    const [topId] = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];
    const profile = profiles?.find((p) => p.id === topId);
    winnerName = profile?.display_name?.trim() || `Player ${topId.slice(0, 5).toUpperCase()}`;
  }

  const uniqueParticipants = new Set((picks ?? []).map((p) => p.user_id)).size;
  const year = new Date().getFullYear();

  // Archive into seasons table
  const { error: archiveErr } = await supabase.from("seasons").insert({
    name: seasonName,
    year,
    winner_name: winnerName,
    total_participants: uniqueParticipants,
    gameweeks_json: gameweeks ?? [],
    fixtures_json: fixtures ?? [],
    picks_json: picks ?? [],
  });

  if (archiveErr) return { error: `Archive failed: ${archiveErr.message}` };

  // Clear active data in dependency order (picks → fixtures → gameweeks)
  const { error: picksErr } = await supabase.from("picks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (picksErr) return { error: `Clear picks failed: ${picksErr.message}` };

  const { error: fixErr } = await supabase.from("fixtures").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (fixErr) return { error: `Clear fixtures failed: ${fixErr.message}` };

  const { error: gwErr } = await supabase.from("gameweeks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (gwErr) return { error: `Clear gameweeks failed: ${gwErr.message}` };

  // Reset season_config
  await supabase.from("season_config").upsert({ id: 1, season_complete: false }, { onConflict: "id" });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/tips");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Fetch past seasons archive
// ---------------------------------------------------------------------------
export type PastSeasonRow = {
  id: string;
  name: string;
  year: number;
  archivedAt: string;
  winnerName: string | null;
  totalParticipants: number;
};

export async function fetchPastSeasons(): Promise<{ data: PastSeasonRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, year, archived_at, winner_name, total_participants")
    .order("archived_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      year: s.year,
      archivedAt: s.archived_at,
      winnerName: s.winner_name,
      totalParticipants: s.total_participants,
    })),
    error: null,
  };
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
