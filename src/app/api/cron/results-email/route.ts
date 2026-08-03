import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { sendResultsEmail } from "@/lib/email/resultsEmail";
import { rankByScore } from "@/lib/ranking";

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

  const offset = parseInt(new URL(request.url).searchParams.get("offset") ?? "0", 10);
  console.log("[results-email] offset:", offset);
  const startTime = Date.now();

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

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  const baseUrl =
    (host ? `${proto}://${host}` : undefined) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

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

  let profiles: any[] = [];
  {
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data } = await admin.from("profiles").select("id, display_name, first_name").range(from, from + batchSize - 1);
      profiles.push(...(data ?? []));
      if (!data || data.length < batchSize) break;
      from += batchSize;
    }
  }
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
  let totalFailed = 0;
  const results: { round: string; competition: string; sent: number; failed: number }[] = [];

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
      (async () => {
        let all: { user_id: string }[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data } = await admin.from("competition_participants").select("user_id").eq("competition_id", compId).range(from, from + batchSize - 1);
          all.push(...(data ?? []));
          if (!data || data.length < batchSize) break;
          from += batchSize;
        }
        return { data: all };
      })(),
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

    // Get all picks for this round (paginated — Round 1 has ~11,000)
    let roundPicks: any[] = [];
    {
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await admin
          .from("picks")
          .select("user_id, fixture_id, picked_team_id, picked_draw, is_correct, auto_picked, predicted_margin, margin_correct")
          .in("fixture_id", fixtureIds)
          .order("user_id")
          .order("fixture_id")
          .range(from, from + batchSize - 1);
        roundPicks.push(...(data ?? []));
        if (!data || data.length < batchSize) break;
        from += batchSize;
      }
    }

    // Pre-send guard: refuse if any enrolled user's pick is unscored
    const unscoredCount = roundPicks.filter(
      (p) => enrolledUserIds.has(p.user_id) && p.is_correct === null
    ).length;
    if (unscoredCount > 0) {
      console.log(`[results-email] ${gw.label} has ${unscoredCount} unscored picks (is_correct IS NULL) — skipping`);
      continue;
    }

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

    // Get all competition picks for leaderboard (paginated)
    let allCompPicks: { user_id: string; points: number | null }[] = [];
    if (allCompFixtureIds.length > 0) {
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await admin
          .from("picks")
          .select("user_id, points")
          .in("fixture_id", allCompFixtureIds)
          .order("user_id")
          .range(from, from + batchSize - 1);
        allCompPicks.push(...(data ?? []));
        if (!data || data.length < batchSize) break;
        from += batchSize;
      }
    }

    // Build overall leaderboard for enrolled users (sum points to match site)
    const overallMap = new Map<string, number>();
    for (const uid of Array.from(enrolledUserIds)) {
      overallMap.set(uid, 0);
    }
    for (const p of allCompPicks ?? []) {
      if (!enrolledUserIds.has(p.user_id)) continue;
      overallMap.set(p.user_id, (overallMap.get(p.user_id) ?? 0) + (p.points ?? 0));
    }

    const sortedUsers = Array.from(overallMap.entries())
      .sort((a, b) => b[1] - a[1]);
    const ranks = rankByScore(sortedUsers.map(([, s]) => s));
    const rankMap = new Map<string, number>();
    sortedUsers.forEach(([uid], i) => rankMap.set(uid, ranks[i]));
    const totalPlayers = enrolledUserIds.size;

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
    let failed = 0;
    const userList = Array.from(enrolledUserIds).slice(offset);
    let timedOut = false;
    let iterated = 0;
    for (const userId of userList) {
      if (Date.now() - startTime > 45_000) {
        const nextOffset = offset + iterated;
        const continueUrl = `${baseUrl}/api/cron/results-email?offset=${nextOffset}`;
        waitUntil(fetch(continueUrl, { method: "GET", headers: { Authorization: `Bearer ${cronSecret}` } }));
        console.log(`[results-email] Timed out, continuing at offset ${nextOffset}`);
        timedOut = true;
        break;
      }
      iterated++;
      const user = (users ?? []).find((u) => u.id === userId);
      const email = user?.email;
      if (!email) continue;

      const profile = profiles?.find((p: { id: string }) => p.id === userId);
      const userRoundPicks = picksByUser.get(userId) ?? [];
      if (userRoundPicks.length === 0) continue;
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

      const ok = await sendResultsEmail({
        to: email,
        roundLabel: gw.label,
        fixtures: fixtureResults,
        picks,
        correct: correctThisRound,
        total: totalFixtures,
        leaderboardPosition: rankMap.get(userId) ?? totalPlayers,
        totalPlayers,
        seasonPoints: overallMap.get(userId) ?? 0,
        sponsors: sponsors ?? [],
        ...(marginPicking && marginTotal > 0 ? { marginCorrect, marginTotal } : {}),
        competitionName,
        siteUrl,
        accentColor,
        accentTextColor,
        ...(gw.number === 2 ? { noticeText: "Round 1’s results email had a bug and showed some scores and positions incorrectly. Apologies if yours looked wrong — it’s fixed, and everything below is accurate." } : {}),
      });

      if (ok) {
        sent++;
        totalSent++;
        console.log(
          `[results-email] Sent to ${email} for ${competitionName} ${gw.label} (${correctThisRound}/${totalFixtures})`
        );
      } else {
        failed++;
        totalFailed++;
      }
    }

    if (timedOut) {
      return NextResponse.json({ totalSent, totalFailed, results, continued: true, nextOffset: offset + iterated });
    }

    // Mark gameweek as emailed
    await admin
      .from("gameweeks")
      .update({ results_email_sent: true })
      .eq("id", gw.id);

    results.push({ round: gw.label, competition: competitionName, sent, failed });
  }

  return NextResponse.json({ totalSent, totalFailed, results });
}
