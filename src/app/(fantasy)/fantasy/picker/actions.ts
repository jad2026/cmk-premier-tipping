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
  console.log("[fantasy] saveSquad called", JSON.stringify(input).slice(0, 200));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("[fantasy] user:", user?.id ?? "NOT SIGNED IN");
  if (!user) return { error: "Not signed in" };

  const { gameweekId, squad, captainId, viceCaptainId, totalSpent, prices } =
    input;

  const filledSlots = Object.entries(squad).filter(([, pid]) => pid);
  console.log("[fantasy] filledSlots:", filledSlots.length, "gameweek:", gameweekId);

  if (filledSlots.length !== 15) return { error: "Squad must have 15 players" };
  if (!captainId || !viceCaptainId)
    return { error: "Captain and vice-captain required" };

  const squadsTable = supabase.from("fantasy_squads") as unknown as AnyTable;
  const picksTable = supabase.from("fantasy_squad_picks") as unknown as AnyTable;

  const { data: existing, error: fetchErr } = await squadsTable
    .select("id, is_locked")
    .eq("user_id", user.id)
    .eq("gameweek_id", gameweekId)
    .maybeSingle() as { data: { id: string; is_locked: boolean } | null; error: any };

  console.log("[fantasy] existing squad:", existing, "fetchErr:", fetchErr);

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
    console.log("[fantasy] update result:", error);
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
    console.log("[fantasy] insert result:", inserted, "error:", error);
    if (error || !inserted)
      return { error: error?.message ?? "Failed to create squad" };
    squadId = (inserted as { id: string }).id;
  }

  console.log("[fantasy] squadId:", squadId, "— deleting old picks");

  const { error: deleteErr } = await picksTable
    .delete()
    .eq("squad_id", squadId);
  console.log("[fantasy] delete picks:", deleteErr);
  if (deleteErr) return { error: deleteErr.message };

  const picks = filledSlots.map(([jersey, playerId]) => ({
    squad_id: squadId,
    player_id: playerId,
    slot_number: Number(jersey),
    price_at_pick: prices[playerId] ?? 0,
  }));

  console.log("[fantasy] inserting", picks.length, "picks");

  const { error: pickErr } = await picksTable.insert(picks);
  console.log("[fantasy] pick insert:", pickErr);
  if (pickErr) return { error: pickErr.message };

  console.log("[fantasy] SAVE COMPLETE");
  return {};
}
