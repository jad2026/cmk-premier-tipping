import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendPushNotification } from "@/lib/sendPushNotification";

export const dynamic = "force-dynamic";

const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";
const ACCENT = "#2C9FD4";
const ACCENT_TEXT = "#FFFFFF";

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
  const tipsUrl = "https://clubrugbytipping.com/tips";
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
            <p style="margin:0 0 10px;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);">🏉 SEASON OPENER</p>
            <div style="width:26px;height:3px;background:${t.accent};border-radius:2px;margin:0 auto 14px;"></div>
            <h1 style="margin:0;font-family:'Archivo Black',sans-serif;font-size:26px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;color:${t.textOnDark};">${competitionName}</h1>
            <p style="margin:8px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.7);">Round 1</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 12px;font-family:'Archivo',system-ui,sans-serif;font-size:16px;color:${t.textPrimary};line-height:1.6;">
              G'day <strong>${firstName || teamName}</strong> 👋
            </p>
            <p style="margin:0 0 20px;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:${t.textSecondary};line-height:1.6;">
              Round 1 tips close tomorrow at 7:10pm — don't miss out.
            </p>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:4px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${tipsUrl}" style="display:inline-block;padding:16px 40px;background:${t.accent};color:${t.accentText};font-family:'Archivo',system-ui,sans-serif;font-size:16px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;text-decoration:none;border-radius:12px;">
                    Make Your Picks →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Invite -->
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0 0 16px;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:${t.textSecondary};line-height:1.6;text-align:center;">
              Know someone who'd be keen? Share the comp with your mates, family, and workmates — the more tippers, the better the competition.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="mailto:?subject=Join%20Club%20Rugby%20Tipping&amp;body=The%20NPC%20tipping%20comp%20is%20back%20for%202026.%20Free%20to%20play%2C%20pick%20the%20winners%20and%20margins%20each%20round.%20Sign%20up%20at%20https%3A%2F%2Fclubrugbytipping.com" style="display:inline-block;padding:16px 40px;background:transparent;color:${t.accent};font-family:'Archivo',system-ui,sans-serif;font-size:16px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;text-decoration:none;border-radius:12px;border:2px solid ${t.accent};">
                    Invite a Friend →
                  </a>
                </td>
              </tr>
            </table>
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
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: participants } = await admin
    .from("competition_participants")
    .select("user_id")
    .eq("competition_id", NPC_COMPETITION_ID);

  if (!participants || participants.length === 0) {
    return NextResponse.json({ error: "No participants found" }, { status: 404 });
  }

  const enrolledUserIds = new Set(participants.map((p: { user_id: string }) => p.user_id));

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const { data: profiles } = await admin.from("profiles").select("id, display_name, first_name");

  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  const eligible = (users ?? [])
    .filter((u) => enrolledUserIds.has(u.id) && u.email)
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

  const recipients = eligible.slice(offset);

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";

  let emailsSent = 0;
  const userIds: string[] = [];

  for (const user of recipients) {

    const profile = profiles?.find((p: { id: string }) => p.id === user.id);
    const firstName = profile?.first_name?.trim() || "";
    const teamName = profile?.display_name?.trim() || (user.email ?? "").split("@")[0];

    if (emailsSent > 0) await new Promise((r) => setTimeout(r, 500));

    try {
      const { error } = await resend.emails.send({
        from,
        to: user.email!,
        subject: "Last chance — Round 1 tips close tomorrow",
        html: buildHtml(firstName, teamName),
      });
      if (error) {
        console.error(`[warmup-email] Failed to send to ${user.email}:`, error);
        continue;
      }
      emailsSent++;
      userIds.push(user.id);
      console.log(`[warmup-email] Sent to ${user.email}`);
    } catch (e) {
      console.error(`[warmup-email] Unexpected error for ${user.email}:`, e);
    }
  }

  let pushResult = null;
  if (userIds.length > 0) {
    try {
      pushResult = await sendPushNotification({
        userIds,
        title: "Round 1 is here",
        body: "Get your picks in early — tips close Thursday 7:10pm",
        data: { url: "/tips" },
      });
      console.log(`[warmup-email] Push: sent=${pushResult.sent} tokens=${pushResult.tokens_found}`);
    } catch (err) {
      console.error("[warmup-email] Push failed:", err);
    }
  }

  return NextResponse.json({ emailsSent, pushResult });
}
