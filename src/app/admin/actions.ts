"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendResultsEmail, type ResultsEmailPayload } from "@/lib/email/resultsEmail";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";
import { CMK_COMPETITION_ID, getCurrentCompetitionId } from "@/lib/competition";

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
        competition_id: CMK_COMPETITION_ID,
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
    is_draw: false,
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
// A result of "draw" → is_draw = true on fixture, picks with picked_draw = true are correct.
// ---------------------------------------------------------------------------
export async function saveResults(
  results: { fixtureId: string; resultTeamId: string | null; homeScore?: number | null; awayScore?: number | null }[]
) {
  const supabase = await createClient();
  const errors: string[] = [];

  // Only process entries where a result has actually been selected
  const toProcess = results.filter((r) => r.resultTeamId);
  if (toProcess.length === 0) return { errors };

  // Service role client — needed to write picks rows owned by other users
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY not set — cannot score picks");
    return { errors };
  }
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── Step 1: auto-fill missing picks (scoped to competition participants) ─
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
      console.log(`[saveResults] auto-fill picks → gameweek_id=${gwId}`);
      const autoFillErr = await autoFillForGameweek(admin, gwId);
      if (autoFillErr) {
        console.error(`[saveResults] auto-fill FAILED (gameweek ${gwId}):`, autoFillErr);
        errors.push(`Auto-pick (gameweek ${gwId}): ${autoFillErr}`);
      } else {
        console.log(`[saveResults] auto-fill OK (gameweek ${gwId})`);
      }
    }
  }

  // ── Step 2: set result on each fixture ───────────────────────────────────
  for (const { fixtureId, resultTeamId, homeScore, awayScore } of toProcess) {
    const isDraw = resultTeamId === "draw";
    const dbResultTeamId = isDraw ? null : resultTeamId;

    const { error: fixErr } = await supabase
      .from("fixtures")
      .update({
        result_team_id: dbResultTeamId,
        is_draw: isDraw,
        home_score: homeScore ?? null,
        away_score: awayScore ?? null,
      })
      .eq("id", fixtureId);

    if (fixErr) {
      errors.push(`Fixture ${fixtureId}: ${fixErr.message}`);
    }
  }

  // Scoring (is_correct, points, margin_correct, margin_bonus) is handled
  // by the auto_score_on_result_change trigger on the fixtures table.
  // It fires on each fixture UPDATE above and uses per-competition scoring config.

  // ── Step 3: send results emails to all users ─────────────────────────────
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

  const COMPETITION_SITE_URLS: Record<string, string> = {
    "b3dbe30d-91ef-40c3-9680-3586c6d17ef8": "https://clubrugbytipping.com",
    "bf6bb916-86c7-4cb1-8268-ba887a973c1f": "https://clubrugbytipping.com",
    "7a27f36c-aab6-4ba8-86e3-2bd9b182361e": "https://bridlington.clubrugbytipping.com",
  };

  console.log(`[resultsEmail] Starting dispatch for gameweeks: ${gameweekIds.join(", ")}`);
  const supabase = await createClient();

  for (const gwId of gameweekIds) {
    // Fetch gameweek label and competition
    const { data: gw } = await supabase
      .from("gameweeks")
      .select("label, competition_id")
      .eq("id", gwId)
      .single();
    if (!gw) { console.warn(`[resultsEmail] Gameweek ${gwId} not found — skipping`); continue; }

    const compId = gw.competition_id;
    const [{ data: seasonConfig }, { data: compConfig }] = await Promise.all([
      supabase.from("season_config").select("season_name").eq("competition_id", compId).single(),
      supabase.from("competitions").select("name, accent_color, accent_text_color").eq("id", compId).single() as unknown as Promise<{ data: { name: string | null; accent_color: string | null; accent_text_color: string | null } | null }>,
    ]);
    const competitionName = compConfig?.name ?? seasonConfig?.season_name ?? "Club Rugby Tipping";
    const siteUrl = COMPETITION_SITE_URLS[compId] ?? "https://clubrugbytipping.com";
    const accentColor = compConfig?.accent_color ?? undefined;
    const accentTextColor = compConfig?.accent_text_color ?? undefined;

    // Fetch all fixtures for this gameweek
    const { data: fixtures } = await supabase
      .from("fixtures")
      .select("id, result_team_id, is_draw, home_team_id, away_team_id, match_date")
      .eq("gameweek_id", gwId)
      .order("match_date");
    if (!fixtures || fixtures.length === 0) { console.warn(`[resultsEmail] No fixtures for ${gw.label} — skipping`); continue; }

    // Only send if all fixtures in this round have results
    if (fixtures.some((f) => f.result_team_id === null && !f.is_draw)) {
      console.log(`[resultsEmail] ${gw.label} has incomplete results — skipping email`);
      continue;
    }
    console.log(`[resultsEmail] ${gw.label} is fully scored — proceeding`);

    // Fetch all picks for these fixtures
    const fixtureIds = fixtures.map((f) => f.id);
    const { data: picks } = await supabase
      .from("picks")
      .select("user_id, fixture_id, picked_team_id, is_correct, auto_picked, predicted_margin, margin_correct")
      .in("fixture_id", fixtureIds);
    if (!picks) continue;

    const { data: compFeaturesRow } = await supabase
      .from("competitions")
      .select("features")
      .eq("id", compId)
      .single() as unknown as { data: { features?: Record<string, boolean> } | null };
    const marginPicking = compFeaturesRow?.features?.margin_picking === true;

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

    // Fetch email sponsors once per round
    const emailSponsors = await fetchActiveSponsors("email");

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

      const picksWithMargin = userPicks.filter((p) => p.predicted_margin != null);
      const marginCorrect = picksWithMargin.filter((p) => p.margin_correct === true).length;
      const marginTotal = picksWithMargin.length;

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
        sponsors: emailSponsors,
        ...(marginPicking && marginTotal > 0 ? { marginCorrect, marginTotal } : {}),
        competitionName,
        siteUrl,
        accentColor,
        accentTextColor,
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
        { number: round, label: `Round ${round}`, deadline, is_open: false, competition_id: CMK_COMPETITION_ID },
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
      is_draw: false,
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
// Rounds management — fetch all rounds with their fixture/result status
// ---------------------------------------------------------------------------
export type RoundRow = {
  id: string;
  number: number;
  label: string;
  deadline: string;
  is_open: boolean;
  totalFixtures: number;
  resultedFixtures: number;
};

export async function fetchRounds(): Promise<{ data: RoundRow[]; error: string | null }> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: gameweeks, error: gwErr } = await supabase
    .from("gameweeks")
    .select("*")
    .eq("competition_id", compId)
    .order("number", { ascending: false });

  if (gwErr) return { data: [], error: gwErr.message };

  const { data: fixtures, error: fixErr } = await supabase
    .from("fixtures")
    .select("id, gameweek_id, result_team_id, is_draw");

  if (fixErr) return { data: [], error: fixErr.message };

  const totalByGw = new Map<string, number>();
  const resultedByGw = new Map<string, number>();
  for (const f of fixtures ?? []) {
    totalByGw.set(f.gameweek_id, (totalByGw.get(f.gameweek_id) ?? 0) + 1);
    if (f.result_team_id || f.is_draw) {
      resultedByGw.set(f.gameweek_id, (resultedByGw.get(f.gameweek_id) ?? 0) + 1);
    }
  }

  const data: RoundRow[] = (gameweeks ?? []).map((gw) => ({
    id: gw.id,
    number: gw.number,
    label: gw.label,
    deadline: gw.deadline,
    is_open: gw.is_open,
    totalFixtures: totalByGw.get(gw.id) ?? 0,
    resultedFixtures: resultedByGw.get(gw.id) ?? 0,
  }));

  return { data, error: null };
}

// Opens a round (closes any other open round first) or closes a round
export async function setRoundOpen(roundId: string, open: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gameweeks")
    .update({ is_open: open })
    .eq("id", roundId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/tips");
  revalidatePath("/leaderboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Close season — archives current data then marks season_complete = true
// ---------------------------------------------------------------------------
export async function closeSeason(): Promise<{ error: string | null }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { error: "SUPABASE_SERVICE_ROLE_KEY not set" };

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // TODO: scope archive to current competition once multi-competition support is needed.
  // For now, closeSeason archives ALL data across all competitions intentionally.
  const [
    { data: gameweeks },
    { data: fixtures },
    { data: picks },
    { data: profiles },
    { data: allCorrect },
    { data: cfg },
  ] = await Promise.all([
    admin.from("gameweeks").select("*"),
    admin.from("fixtures").select("*"),
    admin.from("picks").select("*"),
    admin.from("profiles").select("id, display_name"),
    admin.from("picks").select("user_id").eq("is_correct", true),
    admin.from("season_config").select("season_name").eq("competition_id", CMK_COMPETITION_ID).single(),
  ]);

  const seasonName = cfg?.season_name ?? `${new Date().getFullYear()} Season`;
  const hasData = (gameweeks ?? []).length > 0 || (fixtures ?? []).length > 0;

  if (hasData) {
    const tally = new Map<string, number>();
    for (const p of allCorrect ?? []) tally.set(p.user_id, (tally.get(p.user_id) ?? 0) + 1);
    let winnerName: string | null = null;
    if (tally.size > 0) {
      const [topId] = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];
      const profile = profiles?.find((p) => p.id === topId);
      winnerName = profile?.display_name?.trim() || `Player ${topId.slice(0, 5).toUpperCase()}`;
    }

    const { error: archiveErr } = await admin.from("seasons").insert({
      name: seasonName,
      year: new Date().getFullYear(),
      winner_name: winnerName,
      total_participants: new Set((picks ?? []).map((p) => p.user_id)).size,
      total_rounds: (gameweeks ?? []).length,
      gameweeks_json: gameweeks ?? [],
      fixtures_json: fixtures ?? [],
      picks_json: picks ?? [],
    });
    if (archiveErr) return { error: `Archive failed: ${archiveErr.message}` };
  }

  const { error } = await admin
    .from("season_config")
    .update({ season_complete: true })
    .eq("competition_id", CMK_COMPETITION_ID);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Season config — mark the season as complete or reopen it
// ---------------------------------------------------------------------------
export async function setSeasonComplete(complete: boolean) {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { error } = await supabase
    .from("season_config")
    .update({ season_complete: complete })
    .eq("competition_id", compId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Season config — update the season name
// ---------------------------------------------------------------------------
export async function setSeasonName(name: string) {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { error } = await supabase
    .from("season_config")
    .update({ season_name: name })
    .eq("competition_id", compId);

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
  const compId = await getCurrentCompetitionId();

  // Wave 1: users, profiles, competition participants, and gameweek IDs in parallel
  const [{ data: { users }, error: usersErr }, { data: profiles }, { data: compGwRows }, { data: compParticipants }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("gameweeks").select("id").eq("competition_id", compId),
      supabase.from("competition_participants").select("user_id").eq("competition_id", compId),
    ]);

  const enrolledUserIds = new Set((compParticipants ?? []).map((p) => p.user_id));

  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  // Wave 2: fixtures scoped to this competition
  const { data: fixtures } = compGwIds.length > 0
    ? await supabase.from("fixtures").select("id, gameweek_id").in("gameweek_id", compGwIds)
    : { data: [] as { id: string; gameweek_id: string }[] };

  // Wave 3: picks scoped to this competition's fixtures
  const compFixtureIds = (fixtures ?? []).map((f) => f.id);
  const { data: picks } = compFixtureIds.length > 0
    ? await supabase.from("picks").select("user_id, fixture_id, is_correct").in("fixture_id", compFixtureIds)
    : { data: [] as { user_id: string; fixture_id: string; is_correct: boolean | null }[] };

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

  const data: ParticipantRow[] = (users ?? []).filter((u) => enrolledUserIds.has(u.id)).map((u) => ({
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
  const compId = await getCurrentCompetitionId();

  const { data: compGwRows } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("competition_id", compId);
  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  if (compGwIds.length === 0) return { data: [], error: null };

  // Wave 1: gameweeks, fixtures with results, and teams in parallel
  const [{ data: gameweeks }, { data: fixtures }, { data: teams }] =
    await Promise.all([
      supabase.from("gameweeks").select("id, label, number").eq("competition_id", compId).order("number", { ascending: false }),
      supabase.from("fixtures").select("id, gameweek_id, home_team_id, away_team_id, result_team_id, is_draw").in("gameweek_id", compGwIds).or("result_team_id.not.is.null,is_draw.eq.true"),
      // TODO: scope teams to competition once teams have a competition_id FK
      supabase.from("teams").select("id, name"),
    ]);

  // Wave 2: picks scoped to this competition's fixtures
  const compFixtureIds = (fixtures ?? []).map((f) => f.id);
  const { data: picks } = compFixtureIds.length > 0
    ? await supabase.from("picks").select("fixture_id, is_correct").in("fixture_id", compFixtureIds)
    : { data: [] };

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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { error: "SUPABASE_SERVICE_ROLE_KEY not set — cannot perform bulk deletes" };

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // TODO: scope archive to current competition once multi-competition support is needed.
  // For now, startNewSeason archives and clears ALL data across all competitions intentionally.
  const [
    { data: gameweeks },
    { data: fixtures },
    { data: picks },
    { data: profiles },
    { data: allCorrect },
  ] = await Promise.all([
    admin.from("gameweeks").select("*"),
    admin.from("fixtures").select("*"),
    admin.from("picks").select("*"),
    admin.from("profiles").select("id, display_name"),
    admin.from("picks").select("user_id").eq("is_correct", true),
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
  const totalRounds = (gameweeks ?? []).length;
  const hasData = totalRounds > 0 || (fixtures ?? []).length > 0;
  const year = new Date().getFullYear();

  // Only archive if there is actual season data to preserve
  if (hasData) {
    const { error: archiveErr } = await admin.from("seasons").insert({
      name: seasonName,
      year,
      winner_name: winnerName,
      total_participants: uniqueParticipants,
      total_rounds: totalRounds,
      gameweeks_json: gameweeks ?? [],
      fixtures_json: fixtures ?? [],
      picks_json: picks ?? [],
    });
    if (archiveErr) return { error: `Archive failed: ${archiveErr.message}` };
  }

  // Clear active data and reset config via a SECURITY DEFINER function
  // (avoids PostgREST bulk-delete restrictions and FK ordering issues)
  const { error: clearErr } = await admin.rpc("clear_season_data", { new_season_name: seasonName });
  if (clearErr) return { error: `Clear failed: ${clearErr.message}` };

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
  totalRounds: number;
};

export async function fetchPastSeasons(): Promise<{ data: PastSeasonRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, year, archived_at, winner_name, total_participants, total_rounds")
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
      totalRounds: s.total_rounds ?? 0,
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

// ---------------------------------------------------------------------------
// Team CRUD
// ---------------------------------------------------------------------------

function revalidateTeamPaths() {
  revalidatePath("/admin");
  revalidatePath("/tips");
  revalidatePath("/leaderboard");
  revalidatePath("/");
}

export async function createTeam(
  name: string,
  shortName: string,
  colour: string,
  logoUrl: string | null
): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const { data, error } = await supabase
    .from("teams")
    .insert({ name: name.trim(), short_name: shortName.trim(), colour, logo_url: logoUrl, competition_id: compId })
    .select("id")
    .single();

  if (error) return { data: null, error: error.message };
  revalidateTeamPaths();
  return { data, error: null };
}

export async function updateTeam(
  teamId: string,
  name: string,
  shortName: string,
  colour: string,
  logoUrl: string | null
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name: name.trim(), short_name: shortName.trim(), colour, logo_url: logoUrl })
    .eq("id", teamId);

  if (error) return { error: error.message };
  revalidateTeamPaths();
  return { error: null };
}

export async function deleteTeam(teamId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Guard: refuse if the team appears in any fixture
  const { count } = await supabase
    .from("fixtures")
    .select("id", { count: "exact", head: true })
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  if (count && count > 0) {
    return { error: `Cannot delete — this team is used in ${count} fixture${count === 1 ? "" : "s"}.` };
  }

  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) return { error: error.message };
  revalidateTeamPaths();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Fixture management — fetch, update, delete
// ---------------------------------------------------------------------------

export type FixtureAdminRow = {
  id: string;
  gameweek_id: string;
  gameweek_number: number;
  gameweek_label: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  venue: string | null;
  result_team_id: string | null;
  is_draw: boolean;
  picks_count: number;
};

export async function fetchAllFixtures(): Promise<{ data: FixtureAdminRow[]; error: string | null }> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: compGwRows } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("competition_id", compId);
  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  if (compGwIds.length === 0) return { data: [], error: null };

  const { data: fixtures, error: fErr } = await supabase
    .from("fixtures")
    .select("*, gameweek:gameweeks(id, number, label)")
    .in("gameweek_id", compGwIds)
    .order("match_date");

  if (fErr || !fixtures) return { data: [], error: fErr?.message ?? "Failed to fetch fixtures" };

  // Count picks per fixture
  const { data: pickCounts } = await supabase
    .from("picks")
    .select("fixture_id");

  const countMap = new Map<string, number>();
  for (const p of pickCounts ?? []) {
    countMap.set(p.fixture_id, (countMap.get(p.fixture_id) ?? 0) + 1);
  }

  const rows: FixtureAdminRow[] = fixtures.map((f) => {
    const gw = (f.gameweek as unknown) as { id: string; number: number; label: string } | null;
    return {
      id: f.id,
      gameweek_id: f.gameweek_id,
      gameweek_number: gw?.number ?? 0,
      gameweek_label: gw?.label ?? `Round ?`,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
      match_date: f.match_date,
      venue: f.venue,
      result_team_id: f.result_team_id,
      is_draw: f.is_draw,
      picks_count: countMap.get(f.id) ?? 0,
    };
  });

  return { data: rows, error: null };
}

export async function updateFixture(
  fixtureId: string,
  fields: { home_team_id: string; away_team_id: string; match_date: string; venue: string | null }
): Promise<{ error: string | null }> {
  if (fields.home_team_id === fields.away_team_id) {
    return { error: "Home and away teams must be different." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("fixtures")
    .update({
      home_team_id: fields.home_team_id,
      away_team_id: fields.away_team_id,
      match_date: new Date(fields.match_date).toISOString(),
      venue: fields.venue || null,
    })
    .eq("id", fixtureId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/tips");
  revalidatePath("/");
  return { error: null };
}

export async function deleteFixture(fixtureId: string): Promise<{ error: string | null }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { error: "SUPABASE_SERVICE_ROLE_KEY not set" };
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Delete picks first (FK constraint)
  await admin.from("picks").delete().eq("fixture_id", fixtureId);
  const { error } = await admin.from("fixtures").delete().eq("id", fixtureId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/tips");
  revalidatePath("/");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Auto-fill random picks — scoped to competition_participants only
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoFillForGameweek(adminClient: any, gameweekId: string): Promise<string | null> {
  const { data: gw, error: gwErr } = await adminClient
    .from("gameweeks")
    .select("competition_id, deadline")
    .eq("id", gameweekId)
    .single();

  if (gwErr || !gw) return gwErr?.message ?? "Gameweek not found";

  const { data: participants } = await adminClient
    .from("competition_participants")
    .select("user_id")
    .eq("competition_id", gw.competition_id)
    .lte("joined_at", gw.deadline);

  const participantUserIds = (participants ?? []).map((p: { user_id: string }) => p.user_id);
  if (participantUserIds.length === 0) return null;

  const { data: fixtures } = await adminClient
    .from("fixtures")
    .select("id, home_team_id, away_team_id")
    .eq("gameweek_id", gameweekId);

  if (!fixtures || fixtures.length === 0) return null;

  const fixtureIds = fixtures.map((f: { id: string }) => f.id);
  const { data: existingPicks } = await adminClient
    .from("picks")
    .select("user_id, fixture_id")
    .in("fixture_id", fixtureIds)
    .in("user_id", participantUserIds);

  const existingSet = new Set(
    (existingPicks ?? []).map((p: { user_id: string; fixture_id: string }) => `${p.user_id}:${p.fixture_id}`)
  );

  const toInsert: { user_id: string; fixture_id: string; picked_team_id: string; auto_picked: boolean }[] = [];
  for (const userId of participantUserIds) {
    for (const fix of fixtures) {
      if (existingSet.has(`${userId}:${fix.id}`)) continue;
      toInsert.push({
        user_id: userId,
        fixture_id: fix.id,
        picked_team_id: Math.random() < 0.5 ? fix.home_team_id : fix.away_team_id,
        auto_picked: true,
      });
    }
  }

  if (toInsert.length === 0) return null;

  const { error: insertErr } = await adminClient
    .from("picks")
    .upsert(toInsert, { onConflict: "user_id,fixture_id", ignoreDuplicates: true });

  if (insertErr) return insertErr.message;

  console.log(`[autoFill] Inserted ${toInsert.length} auto-picks for gameweek ${gameweekId} (${participantUserIds.length} participants)`);
  return null;
}

export async function autoFillRandomPicks(gameweekId: string): Promise<{ count: number; error: string | null }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { count: 0, error: "SUPABASE_SERVICE_ROLE_KEY not set" };

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const err = await autoFillForGameweek(admin, gameweekId);
  if (err) return { count: 0, error: err };

  revalidatePath("/leaderboard");
  revalidatePath("/my-picks");
  return { count: 1, error: null };
}

// ---------------------------------------------------------------------------
// Backfill competition_participants for CMK — enrol all existing profiles
// ---------------------------------------------------------------------------

export async function backfillCmkParticipants() {
  const supabase = await createClient();

  const { data: profiles } = await supabase.from("profiles").select("id");
  if (!profiles || profiles.length === 0) return { enrolled: 0 };

  const rows = profiles.map((p) => ({
    user_id: p.id,
    competition_id: CMK_COMPETITION_ID,
  }));

  const { error } = await supabase
    .from("competition_participants")
    .upsert(rows, { onConflict: "user_id,competition_id", ignoreDuplicates: true });

  if (error) return { error: error.message };

  revalidatePath("/leaderboard");
  return { enrolled: rows.length };
}
