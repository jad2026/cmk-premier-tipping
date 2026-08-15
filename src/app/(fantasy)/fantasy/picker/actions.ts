"use server";

import { createClient } from "@/lib/supabase/server";

const FANTASY_COMP_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

type SaveSquadInput = {
  gameweekId: string;
  squad: Record<number, string>;
  captainId: string;
  viceCaptainId: string;
  totalSpent: number;
  prices: Record<string, number>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

export async function saveSquad(
  input: SaveSquadInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { gameweekId, squad, captainId, viceCaptainId, totalSpent, prices } =
    input;

  const filledSlots = Object.entries(squad).filter(([, pid]) => pid);
  if (filledSlots.length !== 15) return { error: "Squad must have 15 players" };
  if (!captainId || !viceCaptainId)
    return { error: "Captain and vice-captain required" };

  const squadsTable = supabase.from("fantasy_squads") as unknown as AnyTable;
  const picksTable = supabase.from("fantasy_squad_picks") as unknown as AnyTable;

  const { data: existing } = await squadsTable
    .select("id, is_locked")
    .eq("user_id", user.id)
    .eq("gameweek_id", gameweekId)
    .maybeSingle() as { data: { id: string; is_locked: boolean } | null };

  if (existing?.is_locked) return { error: "This round is locked" };

  let squadId: string;

  if (existing) {
    const { error } = await squadsTable
      .update({
        captain_player_id: captainId,
        vice_captain_player_id: viceCaptainId,
        total_spent: totalSpent,
        is_complete: true,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    squadId = existing.id;
  } else {
    const { data: inserted, error } = await squadsTable
      .insert({
        user_id: user.id,
        competition_id: FANTASY_COMP_ID,
        gameweek_id: gameweekId,
        captain_player_id: captainId,
        vice_captain_player_id: viceCaptainId,
        total_spent: totalSpent,
        is_complete: true,
      })
      .select("id")
      .single();
    if (error || !inserted)
      return { error: error?.message ?? "Failed to create squad" };
    squadId = (inserted as { id: string }).id;
  }

  const { error: deleteErr } = await picksTable
    .delete()
    .eq("squad_id", squadId);
  if (deleteErr) return { error: deleteErr.message };

  const picks = filledSlots.map(([jersey, playerId]) => ({
    squad_id: squadId,
    player_id: playerId,
    slot_number: Number(jersey),
    price_at_pick: prices[playerId] ?? 0,
  }));

  const { error: pickErr } = await picksTable.insert(picks);
  if (pickErr) return { error: pickErr.message };

  return {};
}
