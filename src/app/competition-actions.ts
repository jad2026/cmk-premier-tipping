"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";

export async function joinCompetition() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("competition_participants")
    .insert({ user_id: user.id, competition_id: compId });

  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  return { success: true };
}

export async function autoEnrollCurrentCompetition(userId: string) {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  await supabase
    .from("competition_participants")
    .insert({ user_id: userId, competition_id: compId })
    .then(({ error }) => {
      if (error && error.code !== "23505") {
        console.error("[auto-enroll] failed:", error.message);
      }
    });
}
