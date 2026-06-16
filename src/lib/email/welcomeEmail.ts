import { Resend } from "resend";
import type { Sponsor } from "@/lib/supabase/types";

export type WelcomeEmailPayload = {
  to: string;
  firstName: string;
  teamName: string;
  seasonName: string;
  sponsors?: Sponsor[];
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://clubrugbytipping.com";

function buildHtml(p: WelcomeEmailPayload): string {
  const { firstName, teamName, seasonName, sponsors = [] } = p;
  const tipsUrl = `${APP_URL}/tips`;

  const sponsorBlock = sponsors.length > 0 ? `
        <!-- Sponsors -->
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
          <td style="background:#1e3a5f;padding:32px 32px 28px;text-align:center;">
            <p style="margin:0 0 8px;font-size:28px;">🏉</p>
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">${seasonName}</p>
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">Welcome to Club Rugby Tipping!</h1>
          </td>
        </tr>

        <!-- Welcome message -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
              G'day <strong style="color:#1e3a5f;">${firstName}</strong>! 👋
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
              You're in! Your account is all set up and your team <strong style="color:#1e3a5f;">${teamName}</strong> is ready to compete in the ${seasonName}.
            </p>
          </td>
        </tr>

        <!-- How it works -->
        <tr>
          <td style="padding:20px 32px 0;">
            <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a5f;">How It Works</h2>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:12px 16px;background:#f8faff;border-radius:10px;margin-bottom:8px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:36px;vertical-align:top;padding-top:2px;">
                        <span style="display:inline-block;width:28px;height:28px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#fff;">1</span>
                      </td>
                      <td style="padding-left:12px;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:#1e3a5f;">Pick your winners</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Each round, select the team you think will win each match — or pick a draw.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="padding:12px 16px;background:#f8faff;border-radius:10px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:36px;vertical-align:top;padding-top:2px;">
                        <span style="display:inline-block;width:28px;height:28px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#fff;">2</span>
                      </td>
                      <td style="padding-left:12px;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:#1e3a5f;">Score points for correct picks</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Every correct pick earns you a point. You'll get a results email after each round.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="padding:12px 16px;background:#f8faff;border-radius:10px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:36px;vertical-align:top;padding-top:2px;">
                        <span style="display:inline-block;width:28px;height:28px;background:#c9a84c;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#fff;">🏆</span>
                      </td>
                      <td style="padding-left:12px;">
                        <p style="margin:0;font-size:14px;font-weight:600;color:#1e3a5f;">Top the leaderboard to win</p>
                        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">The tipper with the most correct picks at the end of the season takes the glory.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${tipsUrl}" style="display:inline-block;padding:14px 36px;background:#c9a84c;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
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
          <td style="padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Club Rugby Tipping · ${seasonName}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">You're receiving this because you just created an account.</p>
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
