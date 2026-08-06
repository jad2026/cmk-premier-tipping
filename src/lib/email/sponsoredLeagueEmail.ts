export type SponsoredLeagueEmailPayload = {
  to: string;
  recipientName: string;
  leagueName: string;
  roundLabel: string;
  sponsorLogos: { name: string; logo_url: string }[];
  prize: { description: string } | null;
  lastWinner: { name: string; score: string; prize: string } | null;
  standings: { rank: number; name: string; total: number; isRecipient: boolean }[];
  siteUrl: string;
};

export function buildSponsoredLeagueEmail(p: SponsoredLeagueEmailPayload): { subject: string; html: string } {
  const subject = `[${p.leagueName}] — ${p.roundLabel} Weekly Update`;

  const sponsorLogosCells = p.sponsorLogos
    .map(
      (logo, i) =>
        `${i > 0 ? '<td style="padding:0 6px;vertical-align:middle;color:rgba(139,134,118,0.4);font-size:12px;">x</td>' : ""}
         <td style="padding:0 8px;vertical-align:middle;">
           <div style="background:#fff;border-radius:8px;padding:8px 14px;display:inline-block;">
             <img src="${logo.logo_url}" alt="${logo.name}" title="${logo.name}" style="display:block;max-height:60px;max-width:140px;" />
           </div>
         </td>`
    )
    .join("");

  const footerLogosCells = p.sponsorLogos
    .map(
      (logo, i) =>
        `${i > 0 ? '<td style="padding:0 4px;vertical-align:middle;color:rgba(255,255,255,0.2);font-size:10px;">x</td>' : ""}
         <td style="padding:0 6px;vertical-align:middle;">
           <div style="background:#fff;border-radius:6px;padding:4px 8px;display:inline-block;">
             <img src="${logo.logo_url}" alt="${logo.name}" style="display:block;max-height:40px;max-width:110px;" />
           </div>
         </td>`
    )
    .join("");

  const sponsorBlock =
    p.sponsorLogos.length > 0
      ? `<tr>
          <td style="padding:24px 32px;background:#FFFFFF;text-align:center;">
            <p style="margin:0 0 14px;font-family:'Archivo',system-ui,sans-serif;font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#999999;">Proudly supported by</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${sponsorLogosCells}</tr></table>
          </td>
        </tr>`
      : "";

  const prizeBlock = p.prize
    ? `<tr>
        <td style="padding:0 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#F8F6F0;border-left:4px solid #D9A521;border-radius:12px;padding:18px 22px;">
                <p style="margin:0 0 6px;font-family:'Archivo',system-ui,sans-serif;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#D9A521;">This Week's Prize</p>
                <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:15px;font-weight:600;color:#11151C;line-height:1.5;">${p.prize.description}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const winnerBlock = p.lastWinner
    ? `<tr>
        <td style="padding:0 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#FFFFFF;border:1px solid #E4E1D8;border-radius:12px;padding:18px 22px;text-align:center;">
                <p style="margin:0 0 8px;font-family:'Archivo',system-ui,sans-serif;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#2C9FD4;">Last Round's Winner</p>
                <p style="margin:0 0 4px;font-family:'Archivo Black',sans-serif;font-size:20px;font-weight:400;color:#11151C;">${p.lastWinner.name}</p>
                <p style="margin:0 0 6px;font-family:'Archivo',system-ui,sans-serif;font-size:14px;color:#5A6371;">${p.lastWinner.score}</p>
                <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:13px;font-weight:600;color:#D9A521;">Won: ${p.lastWinner.prize}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const standingsRows = p.standings
    .map(
      (s) =>
        `<tr>
          <td style="padding:12px 20px;border-bottom:1px solid #EFEDE6;font-family:'Archivo',system-ui,sans-serif;font-size:14px;font-weight:700;color:#11151C;background:${s.isRecipient ? "#EBF5FF" : "#FFFFFF"};">
            ${s.rank}
          </td>
          <td style="padding:12px 20px;border-bottom:1px solid #EFEDE6;font-family:'Archivo',system-ui,sans-serif;font-size:14px;font-weight:600;color:#11151C;background:${s.isRecipient ? "#EBF5FF" : "#FFFFFF"};">
            ${s.name}${s.isRecipient ? ' <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#2C9FD4;color:#FFFFFF;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;vertical-align:middle;margin-left:6px;">You</span>' : ""}
          </td>
          <td style="padding:12px 20px;border-bottom:1px solid #EFEDE6;text-align:right;font-family:'Archivo Black',sans-serif;font-size:16px;font-weight:400;color:#11151C;background:${s.isRecipient ? "#EBF5FF" : "#FFFFFF"};">
            ${s.total}
          </td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F2F0EA;font-family:'Archivo',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0EA;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;border-radius:18px;overflow:hidden;border:1px solid #E4E1D8;">

        <!-- Header -->
        <tr>
          <td style="background:#0B0E13;padding:32px 32px 28px;text-align:center;">
            <p style="margin:0 0 10px;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);">Club Rugby Tipping</p>
            <h1 style="margin:0 0 14px;font-family:'Archivo Black',sans-serif;font-size:26px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;color:#FFFFFF;">Weekly Update</h1>
            <div style="width:40px;height:3px;background:#2C9FD4;border-radius:2px;margin:0 auto 14px;"></div>
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:15px;color:#9AA1AD;">${p.leagueName} · ${p.roundLabel}</p>
          </td>
        </tr>

        ${sponsorBlock}

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 32px 20px;background:#FFFFFF;">
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:16px;color:#11151C;line-height:1.6;">
              Hey <strong>${p.recipientName}</strong>
            </p>
            <p style="margin:8px 0 0;font-family:'Archivo',system-ui,sans-serif;font-size:14px;color:#5A6371;line-height:1.6;">
              Here's your weekly update for <strong style="color:#11151C;">${p.leagueName}</strong>.
            </p>
          </td>
        </tr>

        ${prizeBlock}
        ${winnerBlock}

        <!-- Standings -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
              <tr>
                <td style="width:4px;height:16px;background:#2C9FD4;border-radius:2px;"></td>
                <td style="padding-left:10px;font-family:'Archivo Black',sans-serif;font-size:13px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:#11151C;">League Standings</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E1D8;border-radius:12px;overflow:hidden;">
              <thead>
                <tr style="background:#0B0E13;">
                  <th style="padding:10px 20px;text-align:left;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9AA1AD;width:50px;">#</th>
                  <th style="padding:10px 20px;text-align:left;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9AA1AD;">Tipper</th>
                  <th style="padding:10px 20px;text-align:right;font-family:'Archivo',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9AA1AD;">Total</th>
                </tr>
              </thead>
              <tbody>${standingsRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:4px 32px 32px;text-align:center;">
            <a href="${p.siteUrl}/tips" style="display:inline-block;padding:16px 40px;background:#2C9FD4;color:#FFFFFF;font-family:'Archivo',system-ui,sans-serif;font-size:16px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;text-decoration:none;border-radius:12px;">
              Make Your Picks →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0B0E13;padding:24px 32px;text-align:center;">
            ${p.sponsorLogos.length > 0 ? `<table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;"><tr>${footerLogosCells}</tr></table>` : ""}
            <p style="margin:0;font-family:'Archivo',system-ui,sans-serif;font-size:12px;color:#9AA1AD;">clubrugbytipping.com</p>
            <p style="margin:8px 0 0;"><a href="${p.siteUrl}/api/unsubscribe?token=${Buffer.from(p.to).toString('base64')}" style="font-family:'Archivo',system-ui,sans-serif;font-size:11px;color:#9AA1AD;opacity:.6;text-decoration:underline;">Unsubscribe</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
