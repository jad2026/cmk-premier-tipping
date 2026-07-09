import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Team } from "@/lib/supabase/types";

function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export const getCachedTeams = unstable_cache(
  async (compId: string) => {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("competition_id", compId)
      .order("name");
    return (data ?? []) as Team[];
  },
  ["teams"],
  { revalidate: 3600, tags: ["teams"] }
);

export const getCachedAllTeams = unstable_cache(
  async () => {
    const supabase = createAnonClient();
    const { data } = await supabase.from("teams").select("*");
    return (data ?? []) as Team[];
  },
  ["all-teams"],
  { revalidate: 3600, tags: ["teams"] }
);

export const getCachedCompetitionFeatures = unstable_cache(
  async (compId: string) => {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("competitions")
      .select("features")
      .eq("id", compId)
      .single();
    const row = data as { features: Record<string, boolean> } | null;
    return (row?.features ?? null) as Record<string, boolean> | null;
  },
  ["competition-features"],
  { revalidate: 3600, tags: ["competition"] }
);

export const getCachedSeasonConfig = unstable_cache(
  async (compId: string) => {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("season_config")
      .select("season_complete, season_name")
      .eq("competition_id", compId)
      .single();
    return data as { season_complete: boolean; season_name: string } | null;
  },
  ["season-config"],
  { revalidate: 3600, tags: ["season"] }
);
