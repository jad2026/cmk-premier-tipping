"use server";

import { createClient } from "@/lib/supabase/server";

// Known competition IDs that should be joined together (Taranaki = Men + Women)
const COMPANION_COMPS: Record<string, string[]> = {
  "b3dbe30d-91ef-40c3-9680-3586c6d17ef8": [
    "952743a7-9e79-4c5b-b15c-7fe07c4ca420",
  ], // CMK Men → also join CMK Women
};

export async function joinSelectedComps(compIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Expand companion comps (e.g., selecting Taranaki also joins CMK Women)
  const allIds = new Set(compIds);
  for (const id of compIds) {
    const companions = COMPANION_COMPS[id];
    if (companions) companions.forEach((c) => allIds.add(c));
  }

  // Insert all, ignoring duplicates (23505 = unique violation)
  for (const compId of Array.from(allIds)) {
    await supabase
      .from("competition_participants")
      .insert({ user_id: user.id, competition_id: compId })
      .then(({ error }) => {
        if (error && error.code !== "23505") {
          console.error("[join-comp] failed:", error.message);
        }
      });
  }
}
