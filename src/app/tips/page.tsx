import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import TipsForm from "./TipsForm";
import JoinCompetitionButton from "@/components/JoinCompetitionButton";
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
  const compId = await getCurrentCompetitionId();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: participant } = await supabase
    .from("competition_participants")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("competition_id", compId)
    .maybeSingle();

  if (!participant) {
    return (
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8 space-y-4">
        <span className="text-4xl block">🏉</span>
        <h1 className="text-xl font-bold text-brand">Join to Start Tipping</h1>
        <p className="text-gray-500 text-sm">
          You need to join this competition before you can submit tips.
        </p>
        <JoinCompetitionButton />
      </div>
    );
  }

  const { data: seasonConfig } = await supabase
    .from("season_config")
    .select("season_complete")
    .eq("competition_id", compId)
    .single();

  if (seasonConfig?.season_complete) {
    return (
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8">
        <span className="text-4xl mb-4 block">🏆</span>
        <h1 className="text-xl font-bold text-brand mb-2">Competition Ended</h1>
        <p className="text-gray-500 text-sm mb-6">
          The competition has ended. Thanks for playing!
        </p>
        <Link href="/leaderboard" className="btn-primary inline-flex">
          View Final Standings
        </Link>
      </div>
    );
  }

  // Get this competition's gameweek IDs first so we can scope fixture queries
  const { data: compGwRows } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("competition_id", compId);
  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  // Check if any fixtures exist for this competition
  const { count: fixtureCount } = compGwIds.length > 0
    ? await supabase
        .from("fixtures")
        .select("id", { count: "exact", head: true })
        .in("gameweek_id", compGwIds)
    : { count: 0 };

  if (!fixtureCount) {
    return (
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8">
        <span className="text-4xl mb-4 block">🏉</span>
        <h1 className="text-xl font-bold text-brand mb-2">Fixtures Coming Soon</h1>
        <p className="text-gray-500 text-sm">
          The season is being set up — check back soon to start tipping!
        </p>
      </div>
    );
  }

  const { data: openGameweeks } = await supabase
    .from("gameweeks")
    .select("*")
    .eq("competition_id", compId)
    .eq("is_open", true)
    .order("number");

  // Fetch fixtures for all open gameweeks in parallel
  const fixtureResults = await Promise.all(
    (openGameweeks ?? []).map((gw) =>
      supabase
        .from("fixtures")
        .select(
          `*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`
        )
        .eq("gameweek_id", gw.id)
        .order("match_date")
    )
  );

  // Only include rounds that have at least one fixture without a result entered
  const gameweeks = (openGameweeks ?? []).filter((_, i) => {
    const fixtures = fixtureResults[i].data ?? [];
    return fixtures.length > 0 && fixtures.some((f) => f.result_team_id === null);
  });

  if (gameweeks.length === 0) {
    return (
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8">
        <span className="text-4xl mb-4 block">🏉</span>
        <h1 className="text-xl font-bold text-brand mb-2">No Rounds Open for Tipping</h1>
        <p className="text-gray-500 text-sm mb-6">
          There are no rounds currently open. Check back soon for the next round!
        </p>
        <Link href="/leaderboard" className="btn-primary inline-flex">View Leaderboard</Link>
      </div>
    );
  }

  // Build active rounds from filtered gameweeks, carrying their fixture data
  const activeRounds = gameweeks.map((gw) => {
    const idx = (openGameweeks ?? []).findIndex((g) => g.id === gw.id);
    const fixtures = (fixtureResults[idx]?.data ?? []) as Fixture[];
    return { gw, fixtures };
  });

  const allFixtureIds = activeRounds.flatMap((r) => r.fixtures.map((f) => f.id));

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

  const rounds: RoundData[] = activeRounds.map(({ gw, fixtures }) => ({
    id: gw.id,
    number: gw.number,
    label: gw.label,
    deadline: gw.deadline,
    fixtures,
    existingPicks: fixtures
      .map((f) => picksMap.get(f.id))
      .filter((p): p is Pick => p !== undefined),
  }));

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
              <span className="font-medium text-gray-800">
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
