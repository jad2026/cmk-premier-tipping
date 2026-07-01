import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, NPC_COMPETITION_ID, getCompetitionTimezone } from "@/lib/competition";
import TipsForm from "./TipsForm";
import JoinCompetitionButton from "@/components/JoinCompetitionButton";
import type { Fixture, Pick } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

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
  const compLabel = compId === NPC_COMPETITION_ID ? "Bunnings NPC" : "CMK Premier · Taranaki";
  const tzLocale = await getCompetitionTimezone(compId);

  const { data: compFeatures } = await supabase
    .from("competitions")
    .select("features")
    .eq("id", compId)
    .single() as unknown as { data: { features: Record<string, boolean> | null } | null };
  const marginPicking = compFeatures?.features?.margin_picking === true;

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
        <h1 className="text-xl font-display uppercase text-md-text">Join to Start Tipping</h1>
        <p className="text-md-text-secondary text-sm">
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
        <h1 className="text-xl font-display uppercase text-md-text mb-2">Competition Ended</h1>
        <p className="text-md-text-secondary text-sm mb-6">
          The competition has ended. Thanks for playing!
        </p>
        <Link href="/leaderboard" className="btn-primary inline-flex">
          View Final Standings
        </Link>
      </div>
    );
  }

  const { data: compGwRows } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("competition_id", compId);
  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  const { count: fixtureCount } = compGwIds.length > 0
    ? await supabase
        .from("fixtures")
        .select("id", { count: "exact", head: true })
        .in("gameweek_id", compGwIds)
    : { count: 0 };

  if (!fixtureCount) {
    return (
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8">
        <h1 className="text-xl font-display uppercase text-md-text mb-2">Fixtures Coming Soon</h1>
        <p className="text-md-text-secondary text-sm">
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

  const gameweeks = (openGameweeks ?? []).filter((_, i) => {
    const fixtures = fixtureResults[i].data ?? [];
    return fixtures.length > 0 && fixtures.some((f) => f.result_team_id === null && !f.is_draw);
  });

  if (gameweeks.length === 0) {
    return (
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8">
        <h1 className="text-xl font-display uppercase text-md-text mb-2">No Rounds Open for Tipping</h1>
        <p className="text-md-text-secondary text-sm mb-6">
          There are no rounds currently open. Check back soon for the next round!
        </p>
        <Link href="/leaderboard" className="btn-primary inline-flex">View Leaderboard</Link>
      </div>
    );
  }

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

  return (
    <div className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8" style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}>
      <TipsForm rounds={rounds} userId={user.id} compLabel={compLabel} timezone={tzLocale.timezone} locale={tzLocale.locale} marginPicking={marginPicking} />
    </div>
  );
}
