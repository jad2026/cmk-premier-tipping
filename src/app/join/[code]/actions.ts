"use server";

import { createClient } from "@/lib/supabase/server";

export async function joinLeagueById(leagueId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data: existing } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (existing) return { error: "Already a member" };

  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: leagueId, user_id: user.id, joined_at: new Date().toISOString() });

  if (error) return { error: error.message };
  return { success: true };
}
