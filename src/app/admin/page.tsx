import { createClient } from "@/lib/supabase/server";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: fixtures }] = await Promise.all([
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
  ]);

  return (
    <AdminShell
      teams={teams ?? []}
      pendingFixtures={fixtures ?? []}
    />
  );
}
