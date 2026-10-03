"use server";

import { createClient } from "@/lib/supabase/server";

export async function joinSpecificCompetition(competitionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("competition_participants")
    .insert({ user_id: user.id, competition_id: competitionId });

  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  return { success: true };
}
