import { Resend } from "resend";
import type { Sponsor } from "@/lib/supabase/types";

export type ReminderFixture = {
  homeTeam: string;
  awayTeam: string;
  matchDate: string; // ISO string
};

export type ReminderEmailPayload = {
  to: string;
  firstName: string;
  teamName: string;
  roundLabel: string;
  deadline: string; // ISO string
  fixtures: ReminderFixture[];
  sponsors?: Sponsor[];
  variant: "wednesday" | "24h";
  picksCount?: number;
  totalFixtures?: number;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://clubrugbytipping.com";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildHtml(p: ReminderEmailPayload): string {
  const { firstName, teamName, roundLabel, deadline, fixtures, sponsors = [], variant, picksCount = 0, totalFixtures = fixtures.length } = p;
  const isPartial = picksCount > 0 && picksCount < totalFixtures;
  const remaining = totalFixtures - picksCount;
  const tipsUrl = `${APP_URL}/tips`;

  const is24h = variant === "24h";
  const subjectLine = is24h
    ? `⏰ Last chance! ${roundLabel} closes soon`
    : `🏉 Midweek reminder — have you made your picks?`;

  const headerBg = is24h ? "#b91c1c" : "#1e3a5f";
  const badgeText = is24h ? "⏰ DEADLINE SOON" : "🏉 REMINDER";

  const fixtureRows = fixtures.map((f) => {
    const date = new Date(f.matchDate).toLocaleString("en-NZ", {
      timeZone: "Pacific/Auckland",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">
          <strong style="color:#1e3a5f;">${f.homeTeam}</strong>
          <span style="color:#9ca3af;font-size:12px;padding:0 6px;">vs</span>
          <strong style="color:#1e3a5f;">${f.awayTeam}</strong>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:12px;color:#6b7280;">
          ${date}
        </td>
      </tr>`;
  }).join("");

  const sponsorBlock = sponsors.length > 0 ? `
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#d1d5db;">Our Sponsors</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            ${sponsors.map((s) => `
              <td style="padding:0 12px;vertical-align:middle;">
                ${s.website_url ? `<a href="${s.website_url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">` : ""}
                ${s.logo_url
                  ? `<img src="${s.logo_url}" alt="${s.name}" height="32" style="display:block;max-height:32px;max-width:100px;object-fit:contain;" />`
                  : `<span style="font-size:13px;font-weight:700;color:#1e3a5f;">${s.name}</span>`}
                ${s.website_url ? `</a>` : ""}
              </td>`).join("")}
          </tr>
        </table>
      </td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${headerBg};padding:28px 32px 24px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">${badgeText}</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Club Rugby Tipping</h1>
            <p style="margin:6px 0 0;font-size:15px;color:rgba(255,255,255,0.8);">${roundLabel}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 12px;font-size:16px;color:#374151;line-height:1.6;">
              G'day <strong style="color:#1e3a5f;">${firstName || teamName}</strong>! 👋
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">
              ${is24h
                ? isPartial
                  ? `The deadline for <strong>${roundLabel}</strong> is coming up fast — you've picked <strong style="color:#b91c1c;">${picksCount} of ${totalFixtures} games</strong> — don't forget the remaining ${remaining}!`
                  : `The deadline for <strong>${roundLabel}</strong> is coming up fast — <strong style="color:#b91c1c;">you haven't made your picks yet!</strong> Don't miss out — get them in before the round closes.`
                : isPartial
                  ? `It's the middle of the week and <strong>${roundLabel}</strong> is open for picks. Your team <strong style="color:#1e3a5f;">${teamName}</strong> has picked <strong style="color:#1e3a5f;">${picksCount} of ${totalFixtures} games</strong> — don't forget the remaining ${remaining}!`
                  : `It's the middle of the week and <strong>${roundLabel}</strong> is open for picks. Your team <strong style="color:#1e3a5f;">${teamName}</strong> hasn't submitted picks yet — don't forget!`}
            </p>
          </td>
        </tr>

        <!-- Deadline callout -->
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${is24h ? "#fef2f2" : "#f0f6ff"};border:1px solid ${is24h ? "#fecaca" : "#bfdbfe"};border-radius:10px;padding:14px 18px;">
                  <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${is24h ? "#991b1b" : "#1e40af"};">Picks deadline</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${is24h ? "#b91c1c" : "#1e3a5f"};">${formatDate(deadline)}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">New Zealand time (NZT)</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Fixtures -->
        <tr>
          <td style="padding:0 32px 24px;">
            <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a5f;">Fixtures this round</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
              ${fixtureRows}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:4px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${tipsUrl}" style="display:inline-block;padding:16px 40px;background:#c9a84c;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;">
                    Make Your Picks →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${sponsorBlock}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Club Rugby Tipping</p>
            <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">You're receiving this because you ${isPartial ? `have only completed ${picksCount} of ${totalFixtures} picks` : "haven't made your picks yet"} for ${roundLabel}.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendReminderEmail(payload: ReminderEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[reminderEmail] RESEND_API_KEY not set — skipping");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";
  const { roundLabel, variant } = payload;

  const subject = variant === "24h"
    ? `Last chance! ${roundLabel} closes in 24 hours`
    : `Midweek reminder — have you made your picks for ${roundLabel}?`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: payload.to,
      subject,
      html: buildHtml(payload),
    });
    if (error) {
      console.error(`[reminderEmail] Failed to send to ${payload.to}:`, error);
    }
  } catch (e) {
    console.error(`[reminderEmail] Unexpected error:`, e);
  }
}
