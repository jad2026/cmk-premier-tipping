import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

  const [{ data: teams }, { data: fixtures }, { data: seasonConfig }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("fixtures")
        .select(
          `*,
           home_team:teams!fixtures_home_team_id_fkey(*),
           away_team:teams!fixtures_away_team_id_fkey(*)`
        )
        .is("result_team_id", null)
        .order("match_date"),
      supabase.from("season_config").select("season_complete, season_name").eq("id", 1).single(),
    ]);

  return (
    <AdminShell
      teams={teams ?? []}
      pendingFixtures={fixtures ?? []}
      seasonComplete={seasonConfig?.season_complete ?? false}
      seasonName={seasonConfig?.season_name ?? "2026 Season"}
    />
  );
}
