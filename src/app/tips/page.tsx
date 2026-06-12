import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TipsForm from "./TipsForm";
import type { Fixture, Pick } from "@/lib/supabase/types";

export type RoundData = {
  id: string;
  number: number;
  label: string;
  deadline: string;
  fixtures: Fixture[];
  existingPicks: Pick[];
};

export default async function TipsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gameweeks } = await supabase
    .from("gameweeks")
    .select("*")
    .eq("is_open", true)
    .order("number");

  if (!gameweeks || gameweeks.length === 0) {
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

  // Fetch all fixtures for all open gameweeks in parallel
  const fixtureResults = await Promise.all(
    gameweeks.map((gw) =>
      supabase
        .from("fixtures")
        .select(
          `*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`
        )
        .eq("gameweek_id", gw.id)
        .order("match_date")
    )
  );

  const allFixtureIds = fixtureResults.flatMap(
    (r) => r.data?.map((f) => f.id) ?? []
  );

  const { data: allPicks } = allFixtureIds.length > 0
    ? await supabase
        .from("picks")
        .select("*")
        .eq("user_id", user.id)
        .in("fixture_id", allFixtureIds)
    : { data: [] as Pick[] };

  const picksMap = new Map<string, Pick>(
    (allPicks ?? []).map((p) => [p.fixture_id, p])
  );

  const rounds: RoundData[] = gameweeks.map((gw, i) => {
    const fixtures = (fixtureResults[i].data ?? []) as Fixture[];
    return {
      id: gw.id,
      number: gw.number,
      label: gw.label,
      deadline: gw.deadline,
      fixtures,
      existingPicks: fixtures
        .map((f) => picksMap.get(f.id))
        .filter((p): p is Pick => p !== undefined),
    };
  });

  const totalCount = rounds.reduce((s, r) => s + r.fixtures.length, 0);
  const pickedCount = rounds.reduce((s, r) => s + r.existingPicks.length, 0);

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">
            {rounds.length === 1 ? `Round ${rounds[0].number}` : `${rounds.length} Open Rounds`}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-brand">
            Submit Your Tips
          </h1>
          {rounds.length === 1 && (
            <p className="text-sm text-gray-500 mt-1">
              Deadline:{" "}
              <span className="font-medium text-gray-700">
                {new Date(rounds[0].deadline).toLocaleString("en-NZ", {
                  timeZone: "Pacific/Auckland",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          )}
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

      <TipsForm rounds={rounds} userId={user.id} />
    </div>
  );
}
