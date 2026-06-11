import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TipsForm from "./TipsForm";

export default async function TipsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gameweek } = await supabase
    .from("gameweeks")
    .select("*")
    .eq("is_open", true)
    .single();

  if (!gameweek) {
    return (
      <div className="text-center py-20 text-gray-500">
        <h1 className="text-2xl font-bold text-brand mb-2">No Open Round</h1>
        <p>There are no rounds open for tipping right now. Check back soon!</p>
      </div>
    );
  }

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select(
      `*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`
    )
    .eq("gameweek_id", gameweek.id)
    .order("match_date");

  const { data: existingPicks } = await supabase
    .from("picks")
    .select("*")
    .eq("user_id", user.id)
    .in("fixture_id", fixtures?.map((f) => f.id) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">
          Round {gameweek.number} Tips
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Deadline:{" "}
          {new Date(gameweek.deadline).toLocaleString("en-NZ", {
            timeZone: "Pacific/Auckland",
          })}
        </p>
      </div>
      <TipsForm
        fixtures={fixtures ?? []}
        existingPicks={existingPicks ?? []}
        userId={user.id}
        deadline={gameweek.deadline}
      />
    </div>
  );
}
