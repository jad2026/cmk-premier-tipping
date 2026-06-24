"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";

export type TryOfTheWeek = {
  id: string;
  competition_id: string;
  gameweek_id: string;
  video_url: string;
  player_name: string | null;
  team_name: string | null;
  caption: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchTries(compIdOverride?: string): Promise<TryOfTheWeek[]> {
  const supabase = await createClient();
  const compId = compIdOverride ?? await getCurrentCompetitionId();

  const { data } = await supabase
    .from("try_of_the_week")
    .select("*")
    .eq("competition_id", compId)
    .order("created_at", { ascending: false });

  return (data ?? []) as TryOfTheWeek[];
}

export async function saveTry(payload: {
  gameweek_id: string;
  video_url: string;
  player_name: string;
  team_name: string;
  caption: string;
  compId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const compId = payload.compId;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { error: "Not authorized" };

  // Deactivate previous entries for this competition
  await supabase
    .from("try_of_the_week")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("competition_id", compId)
    .eq("is_active", true);

  // Insert new entry
  const { error } = await supabase.from("try_of_the_week").insert({
    competition_id: compId,
    gameweek_id: payload.gameweek_id,
    video_url: payload.video_url.trim(),
    player_name: payload.player_name.trim() || null,
    team_name: payload.team_name.trim() || null,
    caption: payload.caption.trim() || null,
    is_active: true,
  });

  if (error) return { error: error.message };
  return {};
}

export async function deleteTry(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { error: "Not authorized" };

  const { error } = await supabase.from("try_of_the_week").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}
