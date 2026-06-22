import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendReminderEmail } from "@/lib/email/reminderEmail";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";

export const dynamic = "force-dynamic";

// How many hours before the deadline to send the reminder
const HOURS_BEFORE_DEADLINE = 24;

export async function GET(request: Request) {
  // Verify Vercel cron secret when set (not enforced in local dev)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: "RESEND_API_KEY not set" });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find the open gameweek with the nearest future deadline
  const { data: gws } = await admin
    .from("gameweeks")
    .select("id, label, deadline")
    .eq("is_open", true)
    .gt("deadline", new Date().toISOString())
    .order("deadline", { ascending: true })
    .limit(1);

  const gw = gws?.[0] ?? null;

  if (!gw) {
    console.log("[reminder] No open gameweek — skipping");
    return NextResponse.json({ skipped: "No open gameweek" });
  }

  // Check if the deadline is within the next HOURS_BEFORE_DEADLINE hours
  const now = Date.now();
  const deadlineMs = new Date(gw.deadline).getTime();
  const hoursUntilDeadline = (deadlineMs - now) / (1000 * 60 * 60);

  if (hoursUntilDeadline < 0 || hoursUntilDeadline > HOURS_BEFORE_DEADLINE) {
    console.log(
      `[reminder] Deadline is ${hoursUntilDeadline.toFixed(1)}h away — outside ${HOURS_BEFORE_DEADLINE}h window`
    );
    return NextResponse.json({
      skipped: `Deadline ${hoursUntilDeadline.toFixed(1)}h away — not within ${HOURS_BEFORE_DEADLINE}h window`,
    });
  }

  // Fetch fixtures for this round
  const { data: fixtures } = await admin
    .from("fixtures")
    .select("id, home_team_id, away_team_id, match_date")
    .eq("gameweek_id", gw.id)
    .order("match_date");

  const { data: teams } = await admin.from("teams").select("id, name");
  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? "?";

  const fixtureList = (fixtures ?? []).map((f) => ({
    homeTeam: teamName(f.home_team_id),
    awayTeam: teamName(f.away_team_id),
    matchDate: f.match_date,
  }));

  const fixtureIds = (fixtures ?? []).map((f) => f.id);
  const totalFixtures = fixtureIds.length;

  // Count picks per user for this round
  const { data: picksRaw } = await admin
    .from("picks")
    .select("user_id")
    .in("fixture_id", fixtureIds);

  const pickCountByUser = new Map<string, number>();
  for (const p of picksRaw ?? []) {
    pickCountByUser.set(p.user_id, (pickCountByUser.get(p.user_id) ?? 0) + 1);
  }

  const { data: profiles } = await admin.from("profiles").select("id, display_name, first_name");
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });

  // Include users who have zero or incomplete picks
  const incompleteUsers = (users ?? []).filter(
    (u) => (pickCountByUser.get(u.id) ?? 0) < totalFixtures
  );

  if (incompleteUsers.length === 0) {
    return NextResponse.json({ sent: 0, message: "All users have completed their picks" });
  }

  const emailSponsors = await fetchActiveSponsors("email");
  let sent = 0;

  for (const user of incompleteUsers) {
    const email = user.email;
    if (!email) continue;

    const profile = profiles?.find((p) => p.id === user.id);
    const firstName = profile?.first_name?.trim() || "";
    const teamName_ = profile?.display_name?.trim() || email.split("@")[0];
    const picksCount = pickCountByUser.get(user.id) ?? 0;

    if (sent > 0) await new Promise((r) => setTimeout(r, 500));

    await sendReminderEmail({
      to: email,
      firstName,
      teamName: teamName_,
      roundLabel: gw.label,
      deadline: gw.deadline,
      fixtures: fixtureList,
      sponsors: emailSponsors,
      variant: "24h",
      picksCount,
      totalFixtures,
    });
    sent++;
    console.log(`[reminder] Sent 24h reminder to ${email} (${picksCount}/${totalFixtures} picks)`);
  }

  return NextResponse.json({ sent, round: gw.label, hoursUntilDeadline: hoursUntilDeadline.toFixed(1) });
}
