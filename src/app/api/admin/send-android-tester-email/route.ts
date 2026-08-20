import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";
const REPLY_TO = "me@clubrugbytipping.com";
const ACCENT = "#2C9FD4";
const ACCENT_TEXT = "#FFFFFF";

// Resend allows 2 requests/sec — stay just under it.
const SEND_INTERVAL_MS = 600;

function getTheme() {
  return {
    accent: ACCENT,
    accentText: ACCENT_TEXT,
    ink: "#0B0E13",
    canvas: "#F2F0EA",
    card: "#FFFFFF",
    border: "#E4E1D8",
    textPrimary: "#11151C",
    textSecondary: "#5A6371",
    textMuted: "#8B8676",
    textOnDark: "#FFFFFF",
    textMutedOnDark: "#9AA1AD",
  };
}

function buildHtml(firstName: string, teamName: string): string {
  const t = getTheme();
  const competitionName = "NPC Tipping";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${t.canvas};font-family:'Archivo',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${t.canvas};padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:${t.card};border-radius:18px;overflow:hidden;border:1px solid ${t.border};">

        <!-- Header -->
        <tr>
          <td style="background:${t.ink};padding:32px 32px 28px;text-align:center;">
            <p style="margin:0 0 10px;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);">📱 ANDROID TESTERS WANTED</p>
            <div style="width:26px;height:3px;background:${t.accent};border-radius:2px;margin:0 auto 14px;"></div>
            <h1 style="margin:0;font-family:'Archivo Black',sans-serif;font-size:26px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;color:${t.textOnDark};">${competitionName}</h1>
            <p style="margin:8px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.7);">Help us test the new app</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px 32px;">
            <p style="margin:0 0 16px;font-family:'Archivo',system-ui,sans-serif;font-size:16px;color:${t.textPrimary};line-height:1.6;">
              G'day <strong>${firstName || teamName}</strong> 👋
            </p>
            <p style="margin:0 0 16px;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:${t.textSecondary};line-height:1.6;">
              We're building an Android app for Club Rugby Tipping — push notifications for round reminders, the full tipping experience as a proper app on your phone.
            </p>
            <p style="margin:0 0 16px;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:${t.textSecondary};line-height:1.6;">
              Google requires 12 people to install the test version before we can publish it on the Play Store. We're at 7 and need 5 more.
            </p>
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:${t.textSecondary};line-height:1.6;">
              If you've got an Android phone and can spare 2 minutes to help, reply to this email with the Gmail address you use on your phone and I'll send you the install link.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${t.ink};padding:24px 32px;text-align:center;">
            <div style="width:20px;height:3px;background:${t.accent};border-radius:2px;margin:0 auto 10px;"></div>
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:12px;color:${t.textMutedOnDark};">${competitionName}</p>
            <p style="margin:4px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;color:${t.textMutedOnDark};opacity:.6;">You're receiving this because you're enrolled in the 2026 NPC season.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "PUSH_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("x-push-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
    },
  );

  const { data: participants } = await admin
    .from("competition_participants")
    .select("user_id")
    .eq("competition_id", NPC_COMPETITION_ID);

  if (!participants || participants.length === 0) {
    return NextResponse.json({ error: "No participants found" }, { status: 404 });
  }

  const enrolledUserIds = new Set(participants.map((p: { user_id: string }) => p.user_id));

  // listUsers caps at 1000 per page — page through until exhausted.
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[android-tester-email] listUsers failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }

  const { data: profiles } = await admin.from("profiles").select("id, display_name, first_name");

  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
  const limitParam = parseInt(url.searchParams.get("limit") ?? "", 10);
  const dryRun = url.searchParams.get("dryRun") === "true";

  const eligible = users
    .filter((u) => enrolledUserIds.has(u.id) && u.email)
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

  const recipients = Number.isFinite(limitParam)
    ? eligible.slice(offset, offset + limitParam)
    : eligible.slice(offset);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      eligibleTotal: eligible.length,
      wouldSend: recipients.length,
      offset,
    });
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";

  let emailsSent = 0;
  let emailsFailed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const user = recipients[i];
    if (i > 0) await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS));

    const profile = profiles?.find((p: { id: string }) => p.id === user.id);
    const firstName = profile?.first_name?.trim() || "";
    const teamName = profile?.display_name?.trim() || (user.email ?? "").split("@")[0];

    try {
      const { error } = await resend.emails.send({
        from,
        to: user.email!,
        replyTo: REPLY_TO,
        subject: "Android users — help us test the new app (2 mins)",
        html: buildHtml(firstName, teamName),
      });
      if (error) {
        emailsFailed++;
        console.error(`[android-tester-email] Failed to send to ${user.email}:`, error);
        continue;
      }
      emailsSent++;
      console.log(`[android-tester-email] Sent to ${user.email}`);
    } catch (e) {
      emailsFailed++;
      console.error(`[android-tester-email] Unexpected error for ${user.email}:`, e);
    }
  }

  return NextResponse.json({ emailsSent, emailsFailed, eligibleTotal: eligible.length, offset });
}
