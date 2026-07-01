"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { sendWelcomeEmail } from "@/lib/email/welcomeEmail";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";

export async function triggerWelcomeEmail(
  email: string,
  firstName: string,
  teamName: string
): Promise<void> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const [{ data: seasonConfig }, { data: compConfig }, emailSponsors] = await Promise.all([
    supabase.from("season_config").select("season_name").eq("competition_id", compId).single(),
    supabase.from("competitions").select("accent_color, accent_text_color").eq("id", compId).single() as unknown as Promise<{ data: { accent_color: string | null; accent_text_color: string | null } | null }>,
    fetchActiveSponsors("email"),
  ]);

  const seasonName = seasonConfig?.season_name ?? "2026 Season";

  const COMPETITION_SITE_URLS: Record<string, string> = {
    "b3dbe30d-91ef-40c3-9680-3586c6d17ef8": "https://clubrugbytipping.com",
    "bf6bb916-86c7-4cb1-8268-ba887a973c1f": "https://npc.clubrugbytipping.com",
    "7a27f36c-aab6-4ba8-86e3-2bd9b182361e": "https://bridlington.clubrugbytipping.com",
  };

  console.log(`[welcomeEmail] Sending to ${email} — competitionName: "${seasonName}", siteUrl: "${COMPETITION_SITE_URLS[compId] ?? "https://clubrugbytipping.com"}", accentColor: "${compConfig?.accent_color}"`);

  await sendWelcomeEmail({
    to: email,
    firstName: firstName || email.split("@")[0],
    teamName,
    seasonName,
    sponsors: emailSponsors,
    competitionName: seasonName,
    siteUrl: COMPETITION_SITE_URLS[compId] ?? "https://clubrugbytipping.com",
    accentColor: compConfig?.accent_color ?? undefined,
    accentTextColor: compConfig?.accent_text_color ?? undefined,
  });
}
