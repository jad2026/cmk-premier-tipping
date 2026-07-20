import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildSponsoredLeagueEmail } from "@/lib/email/sponsoredLeagueEmail";

export const dynamic = "force-dynamic";

const SITE_URL = "https://clubrugbytipping.com";

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
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";

  const { data: sponsoredLeagues } = await admin
    .from("leagues")
    .select("id, name, competition_id")
    .eq("is_sponsored", true);

  if (!sponsoredLeagues || sponsoredLeagues.length === 0) {
    return NextResponse.json({ skipped: "No sponsored leagues" });
  }

  const now = new Date().toISOString();
  let totalSent = 0;
  const results: { league: string; sent: number }[] = [];

  for (const league of sponsoredLeagues) {
    const { data: gameweeks } = await admin
      .from("gameweeks")
      .select("id, label, number, deadline")
      .eq("competition_id", league.competition_id)
      .order("deadline", { ascending: true });

    if (!gameweeks || gameweeks.length === 0) continue;

    const gwIds = gameweeks.map((gw) => gw.id);
    const { count: resultsCount } = await admin
      .from("fixtures")
      .select("id", { count: "exact", head: true })
      .in("gameweek_id", gwIds)
      .not("home_score", "is", null);

    if (!resultsCount || resultsCount === 0) {
      console.log(`[sponsored-league-email] Skipping ${league.name} — no completed rounds yet`);
      continue;
    }

    const upcoming = gameweeks.filter((gw) => gw.deadline >= now);
    const past = gameweeks.filter((gw) => gw.deadline < now);
    const currentGw = upcoming[0] ?? past[past.length - 1];
    if (!currentGw) continue;

    const previousGw = past.length > 0 && upcoming.length > 0
      ? past[past.length - 1]
      : past.length >= 2
        ? past[past.length - 2]
        : null;

    const [
      { data: logos },
      { data: prizeRow },
      { data: members },
    ] = await Promise.all([
      admin
        .from("league_sponsor_logos")
        .select("name, logo_url")
        .eq("league_id", league.id)
        .order("display_order"),
      admin
        .from("league_prizes")
        .select("prize_description")
        .eq("league_id", league.id)
        .eq("gameweek_id", currentGw.id)
        .single(),
      admin
        .from("league_members")
        .select("user_id")
        .eq("league_id", league.id),
    ]);

    const sponsorLogos = (logos ?? []) as { name: string; logo_url: string }[];
    const prize = prizeRow?.prize_description
      ? { description: prizeRow.prize_description as string }
      : null;

    const memberUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (memberUserIds.length === 0) continue;

    // Get all competition fixture IDs for overall standings
    const { data: compGws } = await admin
      .from("gameweeks")
      .select("id")
      .eq("competition_id", league.competition_id);
    const compGwIds = (compGws ?? []).map((g: { id: string }) => g.id);

    const { data: allFixtures } = compGwIds.length > 0
      ? await admin.from("fixtures").select("id").in("gameweek_id", compGwIds)
      : { data: [] as { id: string }[] };
    const allFixtureIds = (allFixtures ?? []).map((f: { id: string }) => f.id);

    const { data: allPicks } = allFixtureIds.length > 0
      ? await admin
          .from("picks")
          .select("user_id, is_correct")
          .in("fixture_id", allFixtureIds)
          .in("user_id", memberUserIds)
      : { data: [] as { user_id: string; is_correct: boolean | null }[] };

    const scoreMap = new Map<string, number>();
    for (const uid of memberUserIds) scoreMap.set(uid, 0);
    for (const p of allPicks ?? []) {
      if (p.is_correct) scoreMap.set(p.user_id, (scoreMap.get(p.user_id) ?? 0) + 1);
    }

    const sortedStandings = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1]);

    const rankedStandings: { rank: number; userId: string; total: number }[] = [];
    let rank = 0;
    let prevScore = -1;
    for (const [userId, total] of sortedStandings) {
      if (total !== prevScore) { rank++; prevScore = total; }
      rankedStandings.push({ rank, userId, total });
    }

    // Previous round winner
    let lastWinner: { name: string; score: string; prize: string } | null = null;
    if (previousGw) {
      const { data: prevFixtures } = await admin
        .from("fixtures")
        .select("id")
        .eq("gameweek_id", previousGw.id);
      const prevFixtureIds = (prevFixtures ?? []).map((f: { id: string }) => f.id);

      if (prevFixtureIds.length > 0) {
        const { data: prevPicks } = await admin
          .from("picks")
          .select("user_id, is_correct, margin_bonus")
          .in("fixture_id", prevFixtureIds)
          .in("user_id", memberUserIds);

        const prevScores = new Map<string, { correct: number; bonus: number }>();
        for (const p of prevPicks ?? []) {
          const entry = prevScores.get(p.user_id) ?? { correct: 0, bonus: 0 };
          if (p.is_correct) entry.correct++;
          entry.bonus += (p.margin_bonus as number) ?? 0;
          prevScores.set(p.user_id, entry);
        }

        if (prevScores.size > 0) {
          const sorted = Array.from(prevScores.entries()).sort(
            (a, b) => b[1].correct - a[1].correct || b[1].bonus - a[1].bonus
          );
          const [topId, topScore] = sorted[0];
          const tied = sorted.filter(
            ([, s]) => s.correct === topScore.correct && s.bonus === topScore.bonus
          );

          const { data: prevPrize } = await admin
            .from("league_prizes")
            .select("prize_description")
            .eq("league_id", league.id)
            .eq("gameweek_id", previousGw.id)
            .single();

          if (tied.length > 1) {
            const { data: tiedProfiles } = await admin
              .from("profiles")
              .select("id, display_name, first_name")
              .in("id", tied.map(([id]) => id));

            const names = (tiedProfiles ?? []).map(
              (p: { id: string; display_name: string | null; first_name: string | null }) =>
                p.display_name || p.first_name || "Unknown"
            );

            lastWinner = {
              name: `${names.join(" and ")} (tied — draw pending)`,
              score: `${topScore.correct}/${prevFixtureIds.length} correct${topScore.bonus > 0 ? ` + ${topScore.bonus} bonus` : ""}`,
              prize: (prevPrize?.prize_description as string) || "Weekly prize",
            };
          } else {
            const { data: winnerProfile } = await admin
              .from("profiles")
              .select("display_name, first_name")
              .eq("id", topId)
              .single();

            lastWinner = {
              name: winnerProfile?.display_name || winnerProfile?.first_name || "Unknown",
              score: `${topScore.correct}/${prevFixtureIds.length} correct${topScore.bonus > 0 ? ` + ${topScore.bonus} bonus` : ""}`,
              prize: (prevPrize?.prize_description as string) || "Weekly prize",
            };
          }
        }
      }
    }

    // Get member profiles and emails
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, first_name")
      .in("id", memberUserIds);

    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; display_name: string | null; first_name: string | null }) => [p.id, p])
    );

    let sent = 0;
    for (const userId of memberUserIds) {
      const user = (users ?? []).find((u) => u.id === userId);
      const email = user?.email;
      if (!email) continue;

      const profile = profileMap.get(userId);
      const recipientName = profile?.display_name || profile?.first_name || email.split("@")[0];

      const standings = rankedStandings.map((s) => {
        const sp = profileMap.get(s.userId);
        return {
          rank: s.rank,
          name: sp?.display_name || sp?.first_name || "Unknown",
          total: s.total,
          isRecipient: s.userId === userId,
        };
      });

      const { subject, html } = buildSponsoredLeagueEmail({
        recipientName,
        leagueName: league.name,
        roundLabel: currentGw.label,
        sponsorLogos,
        prize,
        lastWinner,
        standings,
        siteUrl: SITE_URL,
      });

      if (totalSent > 0) await new Promise((r) => setTimeout(r, 500));

      const { error } = await resend.emails.send({ from, to: email, subject, html });
      if (error) {
        console.error(`[sponsored-league-email] Failed to send to ${email}:`, error);
      } else {
        sent++;
        totalSent++;
        console.log(`[sponsored-league-email] Sent to ${email} for ${league.name} ${currentGw.label}`);
      }
    }

    results.push({ league: league.name, sent });
  }

  return NextResponse.json({ totalSent, results });
}
