import { Resend } from "resend";
import type { Sponsor } from "@/lib/supabase/types";

export type WelcomeEmailPayload = {
  to: string;
  firstName: string;
  teamName: string;
  seasonName: string;
  sponsors?: Sponsor[];
  accentColor?: string;
  accentTextColor?: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://clubrugbytipping.com";

// ── Theme helper ──────────────────────────────────────────────────────────────

function getTheme(accent?: string, accentText?: string) {
  return {
    accent: accent || "#D9A521",
    accentText: accentText || "#11151C",
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

function buildHtml(p: WelcomeEmailPayload): string {
  const { firstName, teamName, seasonName, sponsors = [] } = p;
  const t = getTheme(p.accentColor, p.accentTextColor);
  const tipsUrl = `${APP_URL}/tips`;

  const steps = [
    { num: "1", title: "Pick your winners", desc: "Each round, select the team you think will win each match — or pick a draw." },
    { num: "2", title: "Score points for correct picks", desc: "Every correct pick earns you a point. You'll get a results email after each round." },
    { num: "🏆", title: "Top the leaderboard to win", desc: "The tipper with the most correct picks at the end of the season takes the glory.", isAccent: true },
  ];

  const stepRows = steps.map((s) => {
    const circleBg = s.isAccent ? t.accent : t.ink;
    const circleColor = s.isAccent ? t.accentText : "#FFFFFF";
    return `
              <tr>
                <td style="padding:14px 18px;background:${t.canvas};border-radius:12px;margin-bottom:8px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:36px;vertical-align:top;padding-top:2px;">
                        <span style="display:inline-block;width:30px;height:30px;background:${circleBg};border-radius:50%;text-align:center;line-height:30px;font-family:'Archivo Black',sans-serif;font-size:13px;color:${circleColor};">${s.num}</span>
                      </td>
                      <td style="padding-left:14px;">
                        <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:14px;font-weight:700;color:${t.textPrimary};">${s.title}</p>
                        <p style="margin:4px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:13px;color:${t.textSecondary};line-height:1.5;">${s.desc}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>`;
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
          <td style="background:${t.ink};padding:36px 32px 30px;text-align:center;">
            <div style="width:26px;height:3px;background:${t.accent};border-radius:2px;margin:0 auto 14px;"></div>
            <p style="margin:0 0 6px;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${t.textMutedOnDark};">${seasonName}</p>
            <h1 style="margin:0;font-family:'Archivo Black',sans-serif;font-size:26px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;color:${t.textOnDark};">Welcome<span style="color:${t.accent};">.</span></h1>
          </td>
        </tr>

        <!-- Welcome message -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 16px;font-family:'Archivo',system-ui,sans-serif;font-size:16px;color:${t.textPrimary};line-height:1.6;">
              G'day <strong>${firstName}</strong> 👋
            </p>
            <p style="margin:0 0 16px;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:${t.textSecondary};line-height:1.6;">
              You're in! Your account is all set up and your team <strong style="color:${t.textPrimary};">${teamName}</strong> is ready to compete in the ${seasonName}.
            </p>
          </td>
        </tr>

        <!-- How it works -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
              <tr>
                <td style="width:4px;height:16px;background:${t.accent};border-radius:2px;"></td>
                <td style="padding-left:10px;font-family:'Archivo Black',sans-serif;font-size:13px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:${t.textPrimary};">How It Works</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${stepRows}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${tipsUrl}" style="display:inline-block;padding:16px 40px;background:${t.accent};color:${t.accentText};font-family:'Archivo',system-ui,sans-serif;font-size:16px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;text-decoration:none;border-radius:12px;">
                    Make Your First Picks →
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
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:12px;color:${t.textMutedOnDark};">Club Rugby Tipping · ${seasonName}</p>
            <p style="margin:4px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:11px;color:${t.textMutedOnDark};opacity:.6;">You're receiving this because you just created an account.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[welcomeEmail] RESEND_API_KEY not set — skipping");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@clubrugbytipping.com";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: `Welcome to Club Rugby Tipping, ${payload.firstName}! 🏉`,
      html: buildHtml(payload),
    });
    if (error) {
      console.error(`[welcomeEmail] Failed to send to ${payload.to}:`, error);
    }
  } catch (e) {
    console.error(`[welcomeEmail] Unexpected error:`, e);
  }
}
