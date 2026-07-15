"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

export async function getSponsoredLeagueData(compId: string) {
  const admin = serviceClient();

  const [{ data: leagues }, { data: gameweeks }] = await Promise.all([
    admin
      .from("leagues")
      .select("*, league_members(count)")
      .eq("competition_id", compId)
      .order("name"),
    admin
      .from("gameweeks")
      .select("id, number, label, deadline")
      .eq("competition_id", compId)
      .order("deadline"),
  ]);

  const mapped = (leagues ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    member_count:
      Array.isArray(l.league_members) && l.league_members.length > 0
        ? (l.league_members[0] as { count: number }).count
        : 0,
    league_members: undefined,
  }));

  return { leagues: mapped, gameweeks: gameweeks ?? [] };
}

export async function updateLeagueSponsor(
  leagueId: string,
  data: {
    is_sponsored: boolean;
    sponsor_name: string | null;
    sponsor_logo_url: string | null;
    sponsor_accent_color: string | null;
  }
): Promise<{ error?: string }> {
  const admin = serviceClient();
  const { error } = await admin.from("leagues").update(data).eq("id", leagueId);
  if (error) return { error: error.message };
  return {};
}

export async function upsertPrizes(
  prizes: { league_id: string; gameweek_id: string; prize_description: string }[]
): Promise<{ error?: string }> {
  if (prizes.length === 0) return {};
  const admin = serviceClient();
  const { error } = await admin
    .from("league_prizes")
    .upsert(prizes, { onConflict: "league_id,gameweek_id" });
  if (error) return { error: error.message };
  return {};
}

export async function awardPrize(
  prizeId: string,
  winnerUserId: string
): Promise<{ error?: string }> {
  const admin = serviceClient();
  const { error } = await admin
    .from("league_prizes")
    .update({ winner_user_id: winnerUserId, awarded_at: new Date().toISOString() })
    .eq("id", prizeId);
  if (error) return { error: error.message };
  return {};
}
