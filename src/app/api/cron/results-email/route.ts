import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendResultsEmail } from "@/lib/email/resultsEmail";

export const dynamic = "force-dynamic";

const COMPETITION_SITE_URLS: Record<string, string> = {
  "b3dbe30d-91ef-40c3-9680-3586c6d17ef8": "https://clubrugbytipping.com",
  "bf6bb916-86c7-4cb1-8268-ba887a973c1f": "https://clubrugbytipping.com",
  "7a27f36c-aab6-4ba8-86e3-2bd9b182361e": "https://bridlington.clubrugbytipping.com",
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: "RESEND_API_KEY not set" });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
    }
  );

  // Find gameweeks that haven't had results emailed yet
  const { data: candidateGws } = await admin
    .from("gameweeks")
    .select("id, label, number, competition_id")
    .eq("results_email_sent", false)
    .order("number");

  console.log("[results-email] candidateGws:", JSON.stringify(candidateGws));

  if (!candidateGws || candidateGws.length === 0) {
    return NextResponse.json({ skipped: "No pending gameweeks" });
  }

  // For each candidate, check if ALL fixtures have results
  const completedGws: typeof candidateGws = [];
  for (const gw of candidateGws) {
    const { count: totalCount } = await admin
      .from("fixtures")
      .select("id", { count: "exact", head: true })
      .eq("gameweek_id", gw.id);

    if (!totalCount || totalCount === 0) continue;

    const { count: pendingCount } = await admin
      .from("fixtures")
      .select("id", { count: "exact", head: true })
      .eq("gameweek_id", gw.id)
      .is("result_team_id", null)
      .eq("is_draw", false);

    console.log("[results-email]", gw.label, "totalCount:", totalCount, "pendingCount:", pendingCount);

    if (pendingCount === 0) {
      completedGws.push(gw);
    }
  }

  if (completedGws.length === 0) {
    return NextResponse.json({ skipped: "No fully completed gameweeks pending email" });
  }

  const { data: profiles } = await admin.from("profiles").select("id, display_name, first_name");
  const { data: teams } = await admin.from("teams").select("id, name");
  let users: any[] = [];
  let page = 1;
  while (true) {
    const { data: { users: batch } } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    users.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }
  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? "?";

  let totalSent = 0;
  const results: { round: string; competition: string; sent: number }[] = [];

  for (const gw of completedGws) {
    const compId = gw.competition_id;

    const [
      { data: seasonConfig },
      { data: compConfig },
      { data: participants },
      { data: fixtures },
      { data: sponsors },
    ] = await Promise.all([
      admin.from("season_config").select("season_name").eq("competition_id", compId).single(),
      admin.from("competitions").select("name, accent_color, accent_text_color, reminders_enabled").eq("id", compId).single(),
      admin.from("competition_participants").select("user_id").eq("competition_id", compId),
      admin
        .from("fixtures")
        .select("id, home_team_id, away_team_id, result_team_id, is_draw")
        .eq("gameweek_id", gw.id)
        .order("match_date"),
      admin
        .from("sponsors")
        .select("*")
        .eq("competition_id", compId)
        .eq("is_active", true)
        .or("display_location.eq.email,display_location.eq.all")
        .order("order_position")
        .limit(5),
    ]);

    // TEMP: reminders_enabled check disabled — Vercel caching issue
    // if (compConfig?.reminders_enabled === false) {
    //   console.log(`[results-email] Skipping ${gw.label} — reminders disabled for competition ${compId}`);
    //   continue;
    // }

    const competitionName = compConfig?.name ?? seasonConfig?.season_name ?? "Club Rugby Tipping";
    const siteUrl = COMPETITION_SITE_URLS[compId] ?? "https://clubrugbytipping.com";
    const accentColor = compConfig?.accent_color ?? "#D9A521";
    const accentTextColor = compConfig?.accent_text_color ?? "#11151C";
    const enrolledUserIds = new Set((participants ?? []).map((p: { user_id: string }) => p.user_id));
    const fixtureIds = (fixtures ?? []).map((f: { id: string }) => f.id);
    const totalFixtures = fixtureIds.length;
    if (totalFixtures === 0) continue;

    // Build fixture results list
    const fixtureResults = (fixtures ?? []).map((f: { home_team_id: string; away_team_id: string; result_team_id: string | null; is_draw: boolean }) => ({
      homeTeam: teamName(f.home_team_id),
      awayTeam: teamName(f.away_team_id),
      winner: f.is_draw ? null : (f.result_team_id ? teamName(f.result_team_id) : null),
    }));

    const { data: compFeaturesRow } = await admin
      .from("competitions")
      .select("features")
      .eq("id", compId)
      .single();
    const marginPicking = (compFeaturesRow as { features?: Record<string, boolean> } | null)?.features?.margin_picking === true;

    // Get all picks for this round
    const { data: roundPicks } = await admin
      .from("picks")
      .select("user_id, fixture_id, picked_team_id, picked_draw, is_correct, auto_picked, predicted_margin, margin_correct")
      .in("fixture_id", fixtureIds);

    // Get ALL competition fixture IDs for overall leaderboard calculation
    const { data: compGwRows } = await admin
      .from("gameweeks")
      .select("id")
      .eq("competition_id", compId);
    const compGwIds = (compGwRows ?? []).map((g: { id: string }) => g.id);

    const { data: allCompFixtureRows } = compGwIds.length > 0
      ? await admin.from("fixtures").select("id").in("gameweek_id", compGwIds)
      : { data: [] as { id: string }[] };
    const allCompFixtureIds = (allCompFixtureRows ?? []).map((f: { id: string }) => f.id);

    const { data: allCompPicks } = allCompFixtureIds.length > 0
      ? await admin.from("picks").select("user_id, is_correct").in("fixture_id", allCompFixtureIds)
      : { data: [] as { user_id: string; is_correct: boolean | null }[] };

    // Build overall leaderboard for enrolled users
    const overallMap = new Map<string, number>();
    for (const uid of Array.from(enrolledUserIds)) {
      overallMap.set(uid, 0);
    }
    for (const p of allCompPicks ?? []) {
      if (!enrolledUserIds.has(p.user_id)) continue;
      if (p.is_correct) overallMap.set(p.user_id, (overallMap.get(p.user_id) ?? 0) + 1);
    }

    // Sort for ranking
    const sortedUsers = Array.from(overallMap.entries())
      .sort((a, b) => b[1] - a[1]);
    const rankMap = new Map<string, number>();
    let rank = 0;
    let prevScore = -1;
    for (const [uid, score] of sortedUsers) {
      if (score !== prevScore) { rank++; prevScore = score; }
      rankMap.set(uid, rank);
    }
    const totalPlayers = sortedUsers.length;

    // Group round picks by user
    const picksByUser = new Map<string, typeof roundPicks>();
    for (const p of roundPicks ?? []) {
      const list = picksByUser.get(p.user_id) ?? [];
      list.push(p);
      picksByUser.set(p.user_id, list);
    }

    // Build fixture lookup for pick display
    const fixtureMap = new Map(
      (fixtures ?? []).map((f: { id: string; home_team_id: string; away_team_id: string }) => [f.id, f])
    );

    let sent = 0;
    for (const userId of Array.from(enrolledUserIds)) {
      const user = (users ?? []).find((u) => u.id === userId);
      const email = user?.email;
      if (!email) continue;

      const profile = profiles?.find((p: { id: string }) => p.id === userId);
      const userRoundPicks = picksByUser.get(userId) ?? [];
      const correctThisRound = userRoundPicks.filter((p) => p.is_correct).length;

      const picksWithMargin = userRoundPicks.filter((p) => p.predicted_margin != null);
      const marginCorrect = picksWithMargin.filter((p) => p.margin_correct === true).length;
      const marginTotal = picksWithMargin.length;

      const picks = userRoundPicks.map((p) => {
        const fix = fixtureMap.get(p.fixture_id);
        return {
          homeTeam: fix ? teamName(fix.home_team_id) : "?",
          awayTeam: fix ? teamName(fix.away_team_id) : "?",
          pickedTeam: p.picked_draw ? "Draw" : (p.picked_team_id ? teamName(p.picked_team_id) : "—"),
          isCorrect: p.is_correct === true,
          autoPicked: p.auto_picked === true,
        };
      });

      await sendResultsEmail({
        to: email,
        roundLabel: gw.label,
        fixtures: fixtureResults,
        picks,
        correct: correctThisRound,
        total: totalFixtures,
        leaderboardPosition: rankMap.get(userId) ?? totalPlayers,
        totalPlayers,
        seasonCorrect: overallMap.get(userId) ?? 0,
        sponsors: sponsors ?? [],
        ...(marginPicking && marginTotal > 0 ? { marginCorrect, marginTotal } : {}),
        competitionName,
        siteUrl,
        accentColor,
        accentTextColor,
      });

      sent++;
      totalSent++;
      console.log(
        `[results-email] Sent to ${email} for ${competitionName} ${gw.label} (${correctThisRound}/${totalFixtures})`
      );
    }

    // Mark gameweek as emailed
    await admin
      .from("gameweeks")
      .update({ results_email_sent: true })
      .eq("id", gw.id);

    results.push({ round: gw.label, competition: competitionName, sent });
  }

  return NextResponse.json({ totalSent, results });
}
