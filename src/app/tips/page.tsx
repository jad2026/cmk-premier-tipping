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
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8">
        <span className="text-4xl mb-4 block">🏉</span>
        <h1 className="text-xl font-bold text-brand mb-2">No Open Round</h1>
        <p className="text-gray-500 text-sm">
          There are no rounds open for tipping right now. Check back soon!
        </p>
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

  const pickedCount = existingPicks?.length ?? 0;
  const totalCount = fixtures?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Round {gameweek.number}</p>
          <h1 className="text-2xl font-bold tracking-tight text-brand">
            Submit Your Tips
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Deadline:{" "}
            <span className="font-medium text-gray-700">
              {new Date(gameweek.deadline).toLocaleString("en-NZ", {
                timeZone: "Pacific/Auckland",
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
        </div>
        {totalCount > 0 && (
          <div className="card px-4 py-3 text-center min-w-[80px]">
            <p className="text-2xl font-bold text-brand tabular-nums">
              {pickedCount}/{totalCount}
            </p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">
              Picked
            </p>
          </div>
        )}
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
