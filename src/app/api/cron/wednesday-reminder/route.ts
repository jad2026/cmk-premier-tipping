import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/email/reminderEmail";
import { sendPushNotification } from "@/lib/sendPushNotification";

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
  console.log("[wednesday-reminder] offset:", offset);
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

  // Base URL for the internal /api/push/send call — prefer the incoming request's
  // host, then explicit config, then Vercel's deployment URL.
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  const baseUrl =
    (host ? `${proto}://${host}` : undefined) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const { data: gws } = await admin
    .from("gameweeks")
    .select("id, label, deadline, competition_id")
    .eq("is_open", true)
    .gt("deadline", new Date().toISOString())
    .lt("deadline", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("deadline", { ascending: true });

  if (!gws || gws.length === 0) {
    console.log("[wednesday-reminder] No open gameweeks — skipping");
    return NextResponse.json({ skipped: "No open gameweeks" });
  }

  const { data: profiles } = await admin.from("profiles").select("id, display_name, first_name");
  let users: any[] = [];
  let page = 1;
  while (true) {
    const { data: { users: batch } } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    users.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }

  let totalSent = 0;
  const results: { round: string; competition: string; sent: number }[] = [];

  for (const gw of gws) {
    const compId = gw.competition_id;

    const [
      { data: seasonConfig },
      { data: compConfig },
      { data: participants },
      { data: fixtures },
      { data: teams },
      { data: sponsors },
    ] = await Promise.all([
      admin.from("season_config").select("season_name").eq("competition_id", compId).single(),
      admin.from("competitions").select("name, accent_color, accent_text_color, reminders_enabled").eq("id", compId).single(),
      admin.from("competition_participants").select("user_id").eq("competition_id", compId),
      admin.from("fixtures").select("id, home_team_id, away_team_id, match_date").eq("gameweek_id", gw.id).order("match_date"),
      admin.from("teams").select("id, name"),
      admin.from("sponsors").select("*").eq("competition_id", compId).eq("is_active", true).or("display_location.eq.email,display_location.eq.all").order("order_position").limit(5),
    ]);

    if (compConfig?.reminders_enabled === false) {
      console.log(`[wednesday-reminder] Skipping ${gw.label} — reminders disabled for competition ${compId}`);
      continue;
    }

    const competitionName = compConfig?.name ?? seasonConfig?.season_name ?? "Club Rugby Tipping";
    const siteUrl = COMPETITION_SITE_URLS[compId] ?? "https://clubrugbytipping.com";
    const accentColor = compConfig?.accent_color ?? "#D9A521";
    const accentTextColor = compConfig?.accent_text_color ?? "#11151C";
    const enrolledUserIds = new Set((participants ?? []).map((p: { user_id: string }) => p.user_id));
    const teamName = (id: string) => teams?.find((t: { id: string; name: string }) => t.id === id)?.name ?? "?";

    const fixtureList = (fixtures ?? []).map((f: { home_team_id: string; away_team_id: string; match_date: string }) => ({
      homeTeam: teamName(f.home_team_id),
      awayTeam: teamName(f.away_team_id),
      matchDate: f.match_date,
    }));

    const fixtureIds = (fixtures ?? []).map((f: { id: string }) => f.id);
    const totalFixtures = fixtureIds.length;
    if (totalFixtures === 0) continue;

    const { data: picksRaw } = await admin
      .from("picks")
      .select("user_id")
      .in("fixture_id", fixtureIds);

    const pickCountByUser = new Map<string, number>();
    for (const p of picksRaw ?? []) {
      pickCountByUser.set(p.user_id, (pickCountByUser.get(p.user_id) ?? 0) + 1);
    }

    const incompleteUsers = (users ?? []).filter(
      (u) => enrolledUserIds.has(u.id) && (pickCountByUser.get(u.id) ?? 0) < totalFixtures
    );

    let sent = 0;
    const userSlice = incompleteUsers.slice(offset);
    let timedOut = false;
    for (const user of userSlice) {
      if (Date.now() - startTime > 45_000) {
        const continueUrl = `${baseUrl}/api/cron/wednesday-reminder?offset=${offset + totalSent}`;
        fetch(continueUrl, { method: "GET", headers: { Authorization: `Bearer ${cronSecret}` } });
        console.log(`[wednesday-reminder] Timed out, continuing at offset ${offset + totalSent}`);
        timedOut = true;
        break;
      }
      const email = user.email;
      if (!email) continue;

      const profile = profiles?.find((p: { id: string }) => p.id === user.id);
      const firstName = profile?.first_name?.trim() || "";
      const teamName_ = profile?.display_name?.trim() || email.split("@")[0];
      const picksCount = pickCountByUser.get(user.id) ?? 0;

      await sendReminderEmail({
        to: email,
        firstName,
        teamName: teamName_,
        roundLabel: gw.label,
        deadline: gw.deadline,
        fixtures: fixtureList,
        sponsors: sponsors ?? [],
        variant: "wednesday",
        picksCount,
        totalFixtures,
        competitionName,
        siteUrl,
        accentColor,
        accentTextColor,
      });
      sent++;
      totalSent++;
      console.log(`[wednesday-reminder] Sent to ${email} for ${competitionName} ${gw.label} (${picksCount}/${totalFixtures} picks)`);
    }

    if (timedOut) {
      return NextResponse.json({ totalSent, results, continued: true, nextOffset: offset + totalSent });
    }

    // Also fire push notifications to this competition's subscribers.
    // Wrapped so a push failure never breaks the email reminders.
    try {
      const pushRes = await fetch(`${baseUrl}/api/push/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          competitionId: compId,
          title: "Tips closing soon",
          body: `${gw.label} tips close tomorrow — place your picks now`,
          url: "/tips",
        }),
      });
      const pushResult = (await pushRes.json().catch(() => ({}))) as {
        sent?: number;
        failed?: number;
      };
      console.log(
        `[wednesday-reminder] Push for ${competitionName} ${gw.label}: sent=${pushResult.sent ?? 0} failed=${pushResult.failed ?? 0}`
      );
    } catch (err) {
      console.error(`[wednesday-reminder] Push failed for ${competitionName} ${gw.label}`, err);
    }

    // Native push (APNs) to users who haven't completed their picks
    try {
      const nativeUserIds = incompleteUsers.map((u) => u.id);
      if (nativeUserIds.length > 0) {
        const deadlineDate = new Date(gw.deadline);
        const deadlineStr = deadlineDate.toLocaleDateString("en-NZ", {
          weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
        });
        const nativeResult = await sendPushNotification({
          userIds: nativeUserIds,
          title: "Tips close soon",
          body: `${gw.label} tips close ${deadlineStr} — get your picks in!`,
          data: { url: "/tips" },
        });
        console.log(
          `[wednesday-reminder] Native push for ${competitionName} ${gw.label}: sent=${nativeResult.sent} tokens=${nativeResult.tokens_found}`
        );
      }
    } catch (err) {
      console.error(`[wednesday-reminder] Native push failed for ${competitionName} ${gw.label}`, err);
    }

    results.push({ round: gw.label, competition: competitionName, sent });
  }

  return NextResponse.json({ totalSent, results });
}
