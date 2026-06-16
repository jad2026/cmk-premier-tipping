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
  seasonCorrect: number;
  sponsors?: Sponsor[];
};

// ── HTML template ──────────────────────────────────────────────────────────────

function buildHtml(p: ResultsEmailPayload): string {
  const { roundLabel, fixtures, picks, correct, total, leaderboardPosition, totalPlayers, seasonCorrect, sponsors = [] } = p;

  const fixtureRows = fixtures
    .map(
      (f) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">
          ${f.homeTeam} <span style="color:#9ca3af;font-size:12px;">vs</span> ${f.awayTeam}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;color:#1e3a5f;">
          ${f.winner ?? '<span style="color:#9ca3af;font-weight:400;">Draw</span>'}
        </td>
      </tr>`
    )
    .join("");

  const pickRows = picks
    .map((pk) => {
      const icon = pk.isCorrect
        ? `<span style="color:#16a34a;font-weight:700;">✓</span>`
        : `<span style="color:#dc2626;font-weight:700;">✗</span>`;
      const auto = pk.autoPicked
        ? `<span style="font-size:10px;color:#9ca3af;font-weight:500;margin-left:4px;">auto</span>`
        : "";
      const bg = pk.isCorrect ? "#f0fdf4" : "#fff5f5";
      const border = pk.isCorrect ? "#bbf7d0" : "#fecaca";
      return `
      <tr style="background:${bg};">
        <td style="padding:10px 16px;border-bottom:1px solid ${border};color:#374151;font-size:14px;">
          ${pk.homeTeam} <span style="color:#9ca3af;font-size:12px;">vs</span> ${pk.awayTeam}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid ${border};font-size:14px;font-weight:600;color:#374151;">
          ${pk.pickedTeam}${auto}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid ${border};text-align:center;font-size:18px;">
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:28px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">Club Rugby Tipping</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">${roundLabel} Results</h1>
          </td>
        </tr>

        <!-- Score summary -->
        <tr>
          <td style="background:#f8faff;padding:20px 32px;border-bottom:2px solid #e5e9f0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">This round</p>
                  <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:#1e3a5f;">${correct}/${total}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${scorePct}% correct</p>
                </td>
                <td style="width:1px;background:#e5e9f0;"></td>
                <td style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">Season total</p>
                  <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:#1e3a5f;">${seasonCorrect}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">correct picks</p>
                </td>
                <td style="width:1px;background:#e5e9f0;"></td>
                <td style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">Position</p>
                  <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:#1e3a5f;">${positionLabel}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">of ${totalPlayers}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Your picks -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a5f;">Your Picks</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e9f0;">
              <thead>
                <tr style="background:#f8faff;">
                  <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Fixture</th>
                  <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Pick</th>
                  <th style="padding:8px 16px;text-align:center;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Result</th>
                </tr>
              </thead>
              <tbody>${pickRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Round results -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a5f;">Round Results</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e9f0;">
              <thead>
                <tr style="background:#f8faff;">
                  <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Fixture</th>
                  <th style="padding:8px 16px;text-align:right;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Winner</th>
                </tr>
              </thead>
              <tbody>${fixtureRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Sponsors -->
        ${sponsors.length > 0 ? `
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#d1d5db;">Our Sponsors</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                ${sponsors.map((s) => `
                  <td style="padding:0 12px;vertical-align:middle;">
                    ${s.website_url
                      ? `<a href="${s.website_url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">`
                      : ""}
                    ${s.logo_url
                      ? `<img src="${s.logo_url}" alt="${s.name}" height="32" style="display:block;max-height:32px;max-width:100px;object-fit:contain;" />`
                      : `<span style="font-size:13px;font-weight:700;color:#1e3a5f;">${s.name}</span>`}
                    ${s.website_url ? `</a>` : ""}
                  </td>`).join("")}
              </tr>
            </table>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Club Rugby Tipping · You're receiving this because you have an account.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send ───────────────────────────────────────────────────────────────────────

export async function sendResultsEmail(payload: ResultsEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resultsEmail] RESEND_API_KEY not set — skipping email");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: `${payload.roundLabel} Results — ${payload.correct}/${payload.total} correct`,
      html: buildHtml(payload),
    });
    if (error) {
      console.error(`[resultsEmail] Failed to send to ${payload.to}:`, error);
    }
  } catch (e) {
    console.error(`[resultsEmail] Unexpected error sending to ${payload.to}:`, e);
  }
}
