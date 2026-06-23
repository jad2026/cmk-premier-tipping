import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentCompetitionId } from "@/lib/competition";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/");

  const compId = await getCurrentCompetitionId();

  // Wave 1: teams (TODO: scope to competition once teams have a competition_id FK),
  // compGwIds for fixture scoping, and season config
  const [{ data: teams }, { data: compGwRows }, { data: seasonConfig }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("gameweeks").select("id").eq("competition_id", compId),
      supabase.from("season_config").select("season_complete, season_name").eq("id", 1).single(),
    ]);

  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  // Wave 2: pending fixtures scoped to this competition's gameweeks
  const { data: fixtures } = compGwIds.length > 0
    ? await supabase
        .from("fixtures")
        .select(
          `*,
           home_team:teams!fixtures_home_team_id_fkey(*),
           away_team:teams!fixtures_away_team_id_fkey(*)`
        )
        .in("gameweek_id", compGwIds)
        .is("result_team_id", null)
        .order("match_date")
    : { data: [] };

  return (
    <AdminShell
      teams={teams ?? []}
      pendingFixtures={fixtures ?? []}
      seasonComplete={seasonConfig?.season_complete ?? false}
      seasonName={seasonConfig?.season_name ?? "2026 Season"}
    />
  );
}
