"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { sendWelcomeEmail } from "@/lib/email/welcomeEmail";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";

export async function getSignupConfig(): Promise<{
  showSupportedTeam: boolean;
  teams: { id: string; name: string; short_name: string; colour: string; logo_url: string | null }[];
}> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const [{ data: compFeatures }, { data: teams }] = await Promise.all([
    supabase.from("competitions").select("features").eq("id", compId).single() as unknown as Promise<{ data: { features: Record<string, boolean> | null } | null }>,
    supabase.from("teams").select("id, name, short_name, colour, logo_url").eq("competition_id", compId).order("name"),
  ]);

  return {
    showSupportedTeam: compFeatures?.features?.show_supported_team === true,
    teams: teams ?? [],
  };
}

export async function joinLeagueByCode(
  inviteCode: string
): Promise<{ success?: boolean; leagueName?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .single();

  if (!league) return { error: "League not found" };

  const { data: existing } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .single();

  if (existing) return { success: true, leagueName: league.name };

  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id, joined_at: new Date().toISOString() });

  if (error) return { error: error.message };
  return { success: true, leagueName: league.name };
}

export async function checkTeamNameAvailable(teamName: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", teamName.trim())
    .limit(1);
  return !data || data.length === 0;
}

export async function triggerWelcomeEmail(
  email: string,
  firstName: string,
  teamName: string
): Promise<void> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const [{ data: seasonConfig }, { data: compConfig }, emailSponsors] = await Promise.all([
    supabase.from("season_config").select("season_name").eq("competition_id", compId).single(),
    supabase.from("competitions").select("name, accent_color, accent_text_color").eq("id", compId).single() as unknown as Promise<{ data: { name: string | null; accent_color: string | null; accent_text_color: string | null } | null }>,
    fetchActiveSponsors("email"),
  ]);

  const seasonName = seasonConfig?.season_name ?? "2026 Season";
  const competitionName = compConfig?.name ?? "Club Rugby Tipping";

  const COMPETITION_SITE_URLS: Record<string, string> = {
    "b3dbe30d-91ef-40c3-9680-3586c6d17ef8": "https://clubrugbytipping.com",
    "bf6bb916-86c7-4cb1-8268-ba887a973c1f": "https://clubrugbytipping.com",
    "7a27f36c-aab6-4ba8-86e3-2bd9b182361e": "https://bridlington.clubrugbytipping.com",
  };

  console.log("[welcomeEmail] compId:", compId, "| competitionName:", competitionName, "| seasonName:", seasonName, "| accentColor:", compConfig?.accent_color);

  await sendWelcomeEmail({
    to: email,
    firstName: firstName || email.split("@")[0],
    teamName,
    seasonName,
    sponsors: emailSponsors,
    competitionName,
    siteUrl: COMPETITION_SITE_URLS[compId] ?? "https://clubrugbytipping.com",
    accentColor: compConfig?.accent_color ?? undefined,
    accentTextColor: compConfig?.accent_text_color ?? undefined,
  });
}
