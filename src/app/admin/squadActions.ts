"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import type { Player } from "@/lib/supabase/types";

export async function fetchPlayers(teamId: string): Promise<Player[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId)
    .order("jersey_number");
  return (data ?? []) as Player[];
}

export async function upsertPlayer(
  player: {
    id?: string;
    team_id: string;
    first_name: string;
    last_name: string;
    position: string;
    jersey_number: number;
    is_active: boolean;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", player.team_id)
    .eq("competition_id", compId)
    .single();

  if (!team) return { error: "Team not found in this competition" };

  if (player.id) {
    const { error } = await supabase
      .from("players")
      .update({
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
        jersey_number: player.jersey_number,
        is_active: player.is_active,
      })
      .eq("id", player.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("players").insert({
      team_id: player.team_id,
      first_name: player.first_name,
      last_name: player.last_name,
      position: player.position,
      jersey_number: player.jersey_number,
      is_active: player.is_active,
    });
    if (error) return { error: error.message };
  }
  return {};
}

export async function deletePlayer(playerId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { error: error.message };
  return {};
}
