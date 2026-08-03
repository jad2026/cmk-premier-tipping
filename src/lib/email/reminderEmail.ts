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
  competitionName?: string;
  siteUrl?: string;
  timezone?: string;
  locale?: string;
  accentColor?: string;
  accentTextColor?: string;
};

const DEFAULT_SITE_URL = "https://clubrugbytipping.com";

// ── Theme helper ──────────────────────────────────────────────────────────────

function getTheme(accent?: string, accentText?: string) {
  return {
    accent: accent || "#D9A521",
    accentText: accentText || "#11151C",
    ink: "#0B0E13",
    canvas: "#F2F0EA",
    card: "#FFFFFF",
    border: "#E4E1D8",
    borderRow: "#EFEDE6",
    textPrimary: "#11151C",
    textSecondary: "#5A6371",
    textMuted: "#8B8676",
    textOnDark: "#FFFFFF",
    textMutedOnDark: "#9AA1AD",
    urgentRed: "#B23A48",
  };
}

function formatDate(iso: string, timezone = "Pacific/Auckland", locale = "en-NZ"): string {
  return new Date(iso).toLocaleString(locale, {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildHtml(p: ReminderEmailPayload): string {
  const { firstName, teamName, roundLabel, deadline, fixtures, sponsors = [], variant, picksCount = 0, totalFixtures = fixtures.length, timezone = "Pacific/Auckland", locale = "en-NZ" } = p;
  const t = getTheme(p.accentColor, p.accentTextColor);
  const isPartial = picksCount > 0 && picksCount < totalFixtures;
  const remaining = totalFixtures - picksCount;
  const siteUrl = p.siteUrl || DEFAULT_SITE_URL;
  const competitionName = p.competitionName || "Club Rugby Tipping";
  const tipsUrl = `${siteUrl}/tips`;

  const is24h = variant === "24h";
  const headerBg = is24h ? t.urgentRed : t.ink;
  const badgeText = is24h ? "⏰ DEADLINE SOON" : "🏉 REMINDER";

  const fixtureRows = fixtures.map((f) => {
    const date = new Date(f.matchDate).toLocaleString(locale, {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `
      <tr>
        <td style="padding:12px 20px;border-bottom:1px solid ${t.borderRow};color:${t.textPrimary};font-family:'Archivo',system-ui,sans-serif;font-size:14px;font-weight:500;">
          <strong style="color:${t.textPrimary};">${f.homeTeam}</strong>
          <span style="color:${t.textMuted};font-size:12px;padding:0 6px;">vs</span>
          <strong style="color:${t.textPrimary};">${f.awayTeam}</strong>
        </td>
        <td style="padding:12px 20px;border-bottom:1px solid ${t.borderRow};text-align:right;font-family:'Archivo',system-ui,sans-serif;font-size:12px;color:${t.textSecondary};">
          ${date}
        </td>
      </tr>`;
  }).join("");

  const sponsorBlock = sponsors.length > 0 ? `
    <tr>
      <td style="padding:24px 32px;border-top:1px solid ${t.border};text-align:center;">
        <p style="margin:0 0 12px;font-family:'Archivo',system-ui,sans-serif;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${t.textMuted};">Our Sponsors</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            ${sponsors.map((s) => `
              <td style="padding:0 12px;vertical-align:middle;">
                ${s.website_url ? `<a href="${s.website_url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">` : ""}
                ${s.logo_url
                  ? `<img src="${s.logo_url}" alt="${s.name}" height="32" style="display:block;max-height:32px;max-width:100px;object-fit:contain;" />`
                  : `<span style="font-family:'Archivo Black',sans-serif;font-size:13px;color:${t.textPrimary};">${s.name}</span>`}
                ${s.website_url ? `</a>` : ""}
              </td>`).join("")}
          </tr>
        </table>
      </td>
    </tr>` : "";

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
          <td style="background:${headerBg};padding:32px 32px 28px;text-align:center;">
            <p style="margin:0 0 10px;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);">${badgeText}</p>
            <div style="width:26px;height:3px;background:${is24h ? "#FFFFFF" : t.accent};border-radius:2px;margin:0 auto 14px;"></div>
            <h1 style="margin:0;font-family:'Archivo Black',sans-serif;font-size:26px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;color:${t.textOnDark};">${competitionName}</h1>
            <p style="margin:8px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.7);">${roundLabel}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 12px;font-family:'Archivo',system-ui,sans-serif;font-size:16px;color:${t.textPrimary};line-height:1.6;">
              G'day <strong>${firstName || teamName}</strong> 👋
            </p>
            <p style="margin:0 0 20px;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:${t.textSecondary};line-height:1.6;">
              ${is24h
                ? isPartial
                  ? `The deadline for <strong style="color:${t.textPrimary};">${roundLabel}</strong> is coming up fast — you've picked <strong style="color:${t.urgentRed};">${picksCount} of ${totalFixtures} games</strong> — don't forget the remaining ${remaining}!`
                  : `The deadline for <strong style="color:${t.textPrimary};">${roundLabel}</strong> is coming up fast — <strong style="color:${t.urgentRed};">you haven't made your picks yet!</strong> Don't miss out — get them in before the round closes.`
                : isPartial
                  ? `It's the middle of the week and <strong style="color:${t.textPrimary};">${roundLabel}</strong> is open for picks. Your team <strong style="color:${t.textPrimary};">${teamName}</strong> has picked <strong>${picksCount} of ${totalFixtures} games</strong> — don't forget the remaining ${remaining}!`
                  : `It's the middle of the week and <strong style="color:${t.textPrimary};">${roundLabel}</strong> is open for picks. Your team <strong style="color:${t.textPrimary};">${teamName}</strong> hasn't submitted picks yet — don't forget!`}
            </p>
          </td>
        </tr>

        <!-- Deadline callout -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${is24h ? "#FDF5F5" : t.canvas};border:1px solid ${is24h ? "#F5D5D5" : t.border};border-radius:14px;padding:16px 20px;">
                  <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${is24h ? t.urgentRed : t.textMuted};">Picks deadline</p>
                  <p style="margin:6px 0 0;font-family:'Archivo Black',sans-serif;font-size:17px;font-weight:400;text-transform:uppercase;color:${is24h ? t.urgentRed : t.textPrimary};">${formatDate(deadline, timezone, locale)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Fixtures -->
        <tr>
          <td style="padding:0 32px 28px;">
            <table cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
              <tr>
                <td style="width:4px;height:16px;background:${t.accent};border-radius:2px;"></td>
                <td style="padding-left:10px;font-family:'Archivo Black',sans-serif;font-size:13px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:${t.textPrimary};">Fixtures This Round</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${t.border};border-radius:12px;overflow:hidden;">
              <thead>
                <tr style="background:${t.ink};">
                  <th style="padding:10px 20px;text-align:left;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${t.textMutedOnDark};">Match</th>
                  <th style="padding:10px 20px;text-align:right;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${t.textMutedOnDark};">Kickoff</th>
                </tr>
              </thead>
              <tbody>${fixtureRows}</tbody>
            </table>
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

        ${sponsorBlock}

        <!-- Footer -->
        <tr>
          <td style="background:${t.ink};padding:24px 32px;text-align:center;">
            <div style="width:20px;height:3px;background:${t.accent};border-radius:2px;margin:0 auto 10px;"></div>
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:12px;color:${t.textMutedOnDark};">${competitionName}</p>
            <p style="margin:4px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;color:${t.textMutedOnDark};opacity:.6;">You're receiving this because you ${isPartial ? `have only completed ${picksCount} of ${totalFixtures} picks` : "haven't made your picks yet"} for ${roundLabel}.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const [local, ...rest] = email.split("@");
  const domain = rest.join("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (/\.{2,}/.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  return true;
}

export async function sendReminderEmail(payload: ReminderEmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[reminderEmail] RESEND_API_KEY not set — skipping");
    return false;
  }

  if (!isValidEmail(payload.to)) {
    console.warn(`[reminderEmail] Invalid email address, skipping: ${payload.to}`);
    return false;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";
  const { roundLabel, variant, competitionName } = payload;
  const compPrefix = competitionName ? `[${competitionName}] ` : "";

  const subject = variant === "24h"
    ? `${compPrefix}Last chance! ${roundLabel} closes in 24 hours`
    : `${compPrefix}Midweek reminder — have you made your picks for ${roundLabel}?`;

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
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[reminderEmail] Unexpected error:`, e);
    return false;
  }
}
