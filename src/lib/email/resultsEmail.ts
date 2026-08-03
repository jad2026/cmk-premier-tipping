import { Resend } from "resend";
import type { Sponsor } from "@/lib/supabase/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type FixtureResult = {
  homeTeam: string;
  awayTeam: string;
  winner: string | null; // null = draw
};

type UserPick = {
  homeTeam: string;
  awayTeam: string;
  pickedTeam: string;
  isCorrect: boolean;
  autoPicked: boolean;
};

export type ResultsEmailPayload = {
  to: string;
  roundLabel: string;
  fixtures: FixtureResult[];
  picks: UserPick[];
  correct: number;
  total: number;
  leaderboardPosition: number;
  totalPlayers: number;
  seasonPoints: number;
  sponsors?: Sponsor[];
  marginCorrect?: number;
  marginTotal?: number;
  competitionName?: string;
  siteUrl?: string;
  accentColor?: string;
  accentTextColor?: string;
  noticeText?: string;
};

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
    winGreen: "#1F9E5A",
    lossRed: "#B23A48",
  };
}

// ── HTML template ──────────────────────────────────────────────────────────────

function buildHtml(p: ResultsEmailPayload): string {
  const { roundLabel, fixtures, picks, correct, total, leaderboardPosition, totalPlayers, seasonPoints, sponsors = [] } = p;
  const t = getTheme(p.accentColor, p.accentTextColor);
  const competitionName = p.competitionName || "Club Rugby Tipping";

  const fixtureRows = fixtures
    .map(
      (f) => `
      <tr>
        <td style="padding:12px 20px;border-bottom:1px solid ${t.borderRow};color:${t.textPrimary};font-family:'Archivo',system-ui,sans-serif;font-size:14px;font-weight:500;">
          ${f.homeTeam} <span style="color:${t.textMuted};font-size:12px;padding:0 4px;">vs</span> ${f.awayTeam}
        </td>
        <td style="padding:12px 20px;border-bottom:1px solid ${t.borderRow};text-align:right;font-family:'Archivo Black',sans-serif;font-size:14px;text-transform:uppercase;color:${t.textPrimary};">
          ${f.winner ?? `<span style="color:${t.textMuted};font-family:'Archivo',system-ui,sans-serif;font-weight:500;text-transform:none;">Draw</span>`}
        </td>
      </tr>`
    )
    .join("");

  const pickRows = picks
    .map((pk) => {
      const icon = pk.isCorrect
        ? `<span style="color:${t.winGreen};font-weight:700;">✓</span>`
        : `<span style="color:${t.lossRed};font-weight:700;">✗</span>`;
      const auto = pk.autoPicked
        ? `<span style="font-size:10px;color:${t.textMuted};font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-left:6px;">auto</span>`
        : "";
      const bg = pk.isCorrect ? "#F0FAF4" : "#FDF5F5";
      const border = pk.isCorrect ? "#C6EECF" : "#F5D5D5";
      return `
      <tr style="background:${bg};">
        <td style="padding:12px 20px;border-bottom:1px solid ${border};color:${t.textPrimary};font-family:'Archivo',system-ui,sans-serif;font-size:14px;font-weight:500;">
          ${pk.homeTeam} <span style="color:${t.textMuted};font-size:12px;padding:0 4px;">vs</span> ${pk.awayTeam}
        </td>
        <td style="padding:12px 20px;border-bottom:1px solid ${border};font-family:'Archivo',system-ui,sans-serif;font-size:14px;font-weight:700;color:${t.textPrimary};">
          ${pk.pickedTeam}${auto}
        </td>
        <td style="padding:12px 20px;border-bottom:1px solid ${border};text-align:center;font-size:18px;">
          ${icon}
        </td>
      </tr>`;
    })
    .join("");

  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const positionLabel =
    leaderboardPosition === 1 ? "1st 🥇"
    : leaderboardPosition === 2 ? "2nd 🥈"
    : leaderboardPosition === 3 ? "3rd 🥉"
    : `${leaderboardPosition}th`;

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
            <div style="width:26px;height:3px;background:${t.accent};border-radius:2px;margin:0 auto 14px;"></div>
            <p style="margin:0 0 6px;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${t.textMutedOnDark};">${competitionName}</p>
            <h1 style="margin:0;font-family:'Archivo Black',sans-serif;font-size:26px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;color:${t.textOnDark};">${roundLabel} Results<span style="color:${t.accent};">.</span></h1>
          </td>
        </tr>

        ${p.noticeText ? `
        <!-- Notice banner -->
        <tr>
          <td style="background:${t.canvas};padding:14px 32px;">
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:12px;font-weight:500;color:${t.textMuted};line-height:1.5;">${p.noticeText}</p>
          </td>
        </tr>` : ""}

        <!-- Score summary -->
        <tr>
          <td style="background:${t.card};padding:24px 32px;border-bottom:1px solid ${t.border};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${t.textMuted};">This round</p>
                  <p style="margin:6px 0 0;font-family:'Archivo Black',sans-serif;font-size:34px;font-weight:400;color:${t.textPrimary};">${correct}/${total}</p>
                  <p style="margin:2px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:13px;color:${t.textSecondary};">${scorePct}% correct</p>
                </td>
                <td style="width:1px;background:${t.border};"></td>
                <td style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${t.textMuted};">Season total</p>
                  <p style="margin:6px 0 0;font-family:'Archivo Black',sans-serif;font-size:34px;font-weight:400;color:${t.textPrimary};">${seasonPoints}</p>
                  <p style="margin:2px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:13px;color:${t.textSecondary};">points</p>
                </td>
                <td style="width:1px;background:${t.border};"></td>
                <td style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${t.textMuted};">Position</p>
                  <p style="margin:6px 0 0;font-family:'Archivo Black',sans-serif;font-size:34px;font-weight:400;color:${t.textPrimary};">${positionLabel}</p>
                  <p style="margin:2px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:13px;color:${t.textSecondary};">of ${totalPlayers}</p>
                </td>
              </tr>
            </table>${p.marginTotal != null && p.marginTotal > 0 ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${t.border};">
              <tr>
                <td style="text-align:center;padding:16px 8px;">
                  <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${t.textMuted};">Margins</p>
                  <p style="margin:6px 0 0;font-family:'Archivo Black',sans-serif;font-size:28px;font-weight:400;color:${t.textPrimary};">${p.marginCorrect ?? 0}/${p.marginTotal}</p>
                  <p style="margin:2px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:13px;color:${t.textSecondary};">margins correct</p>
                </td>
              </tr>
            </table>` : ""}
          </td>
        </tr>

        <!-- Your picks -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <table cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
              <tr>
                <td style="width:4px;height:16px;background:${t.accent};border-radius:2px;"></td>
                <td style="padding-left:10px;font-family:'Archivo Black',sans-serif;font-size:13px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:${t.textPrimary};">Your Picks</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid ${t.border};">
              <thead>
                <tr style="background:${t.ink};">
                  <th style="padding:10px 20px;text-align:left;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${t.textMutedOnDark};">Fixture</th>
                  <th style="padding:10px 20px;text-align:left;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${t.textMutedOnDark};">Pick</th>
                  <th style="padding:10px 20px;text-align:center;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${t.textMutedOnDark};">Result</th>
                </tr>
              </thead>
              <tbody>${pickRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Round results -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <table cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
              <tr>
                <td style="width:4px;height:16px;background:${t.accent};border-radius:2px;"></td>
                <td style="padding-left:10px;font-family:'Archivo Black',sans-serif;font-size:13px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:${t.textPrimary};">Round Results</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid ${t.border};">
              <thead>
                <tr style="background:${t.ink};">
                  <th style="padding:10px 20px;text-align:left;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${t.textMutedOnDark};">Fixture</th>
                  <th style="padding:10px 20px;text-align:right;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${t.textMutedOnDark};">Winner</th>
                </tr>
              </thead>
              <tbody>${fixtureRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Sponsors -->
        ${sponsors.length > 0 ? `
        <tr>
          <td style="padding:24px 32px;border-top:1px solid ${t.border};text-align:center;">
            <p style="margin:0 0 12px;font-family:'Archivo',system-ui,sans-serif;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${t.textMuted};">Our Sponsors</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                ${sponsors.map((s) => `
                  <td style="padding:0 12px;vertical-align:middle;">
                    ${s.website_url
                      ? `<a href="${s.website_url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">`
                      : ""}
                    ${s.logo_url
                      ? `<img src="${s.logo_url}" alt="${s.name}" height="32" style="display:block;max-height:32px;max-width:100px;object-fit:contain;" />`
                      : `<span style="font-family:'Archivo Black',sans-serif;font-size:13px;color:${t.textPrimary};">${s.name}</span>`}
                    ${s.website_url ? `</a>` : ""}
                  </td>`).join("")}
              </tr>
            </table>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="background:${t.ink};padding:24px 32px;text-align:center;">
            <div style="width:20px;height:3px;background:${t.accent};border-radius:2px;margin:0 auto 10px;"></div>
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:12px;color:${t.textMutedOnDark};">${competitionName}</p>
            <p style="margin:4px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;color:${t.textMutedOnDark};opacity:.6;">You're receiving this because you have an account.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send ───────────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const [local, ...rest] = email.split("@");
  const domain = rest.join("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (/\.{2,}/.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  return true;
}

export async function sendResultsEmail(payload: ResultsEmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resultsEmail] RESEND_API_KEY not set — skipping email");
    return false;
  }

  if (!isValidEmail(payload.to)) {
    console.warn(`[resultsEmail] Invalid email address, skipping: ${payload.to}`);
    return false;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: `${payload.competitionName ? `[${payload.competitionName}] ` : ""}${payload.roundLabel} Results — ${payload.correct}/${payload.total} correct`,
      html: buildHtml(payload),
    });
    if (error) {
      console.error(`[resultsEmail] Failed to send to ${payload.to}:`, error);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[resultsEmail] Unexpected error sending to ${payload.to}:`, e);
    return false;
  }
}
