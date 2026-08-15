import { createAdminClient } from "@/lib/supabase/server";
import StatsView from "./StatsView";

export const revalidate = 60;

export const metadata = {
  title: "Fantasy Stats — Club Rugby Tipping",
};

const FANTASY_COMP_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

type MatchStatRow = {
  player_id: string;
  fixture_id: string;
  minutes_played: number;
  stats: Record<string, string> | null;
  fantasy_points: number;
};

type FixtureGwRow = {
  id: string;
  gameweek_id: string;
};

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  team_id: string;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
};

type GameweekRow = {
  id: string;
  number: number;
  label: string;
};

type PoolRow = {
  player_id: string;
  position: string | null;
};

export type StatPlayer = {
  playerId: string;
  name: string;
  teamName: string;
  position: string;
  gameweekId: string;
  points: number;
  minutes: number;
  tries: number;
  tryAssists: number;
  conversionGoals: number;
  penaltyGoals: number;
  tackles: number;
  dominantTackles: number;
  carries: number;
  metresCarried: number;
  lineBreaks: number;
  turnoversWon: number;
};

export type GameweekInfo = {
  id: string;
  number: number;
  label: string;
};

function statNum(stats: Record<string, string> | null, key: string): number {
  if (!stats) return 0;
  const v = stats[key];
  if (v == null) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

const POOL_POS_TO_DISPLAY: Record<string, string> = {
  prop: "Prop",
  hooker: "Hooker",
  lock: "Lock",
  loose_forward: "Loose Forward",
  halfback: "Halfback",
  first_five: "First Five",
  centre: "Centre",
  outside_back: "Outside Back",
};

export default async function FantasyStatsPage() {
  const admin = createAdminClient();

  const { data: matchStats } = (await (
    admin.from("fantasy_player_match_stats") as unknown as AnyTable
  )
    .select("player_id, fixture_id, minutes_played, stats, fantasy_points")) as {
    data: MatchStatRow[] | null;
  };

  if (!matchStats?.length) {
    return <StatsView players={[]} gameweeks={[]} />;
  }

  const fixtureIds = Array.from(new Set(matchStats.map((s) => s.fixture_id)));
  const playerIds = Array.from(new Set(matchStats.map((s) => s.player_id)));

  const [{ data: fixtures }, { data: players }, { data: poolRows }] =
    await Promise.all([
      admin
        .from("fixtures")
        .select("id, gameweek_id")
        .in("id", fixtureIds) as unknown as Promise<{
        data: FixtureGwRow[] | null;
      }>,
      admin
        .from("players")
        .select("id, first_name, last_name, team_id")
        .in("id", playerIds) as unknown as Promise<{
        data: PlayerRow[] | null;
      }>,
      (admin.from("fantasy_player_pool") as unknown as AnyTable)
        .select("player_id, position")
        .eq("competition_id", FANTASY_COMP_ID)
        .in("player_id", playerIds) as Promise<{
        data: PoolRow[] | null;
      }>,
    ]);

  const fixtureGw = new Map<string, string>();
  for (const f of fixtures ?? []) fixtureGw.set(f.id, f.gameweek_id);

  const gwIds = Array.from(new Set(
    (fixtures ?? []).map((f) => f.gameweek_id).filter(Boolean)
  ));

  const [{ data: teams }, { data: gameweeks }] = await Promise.all([
    admin
      .from("teams")
      .select("id, name, short_name") as unknown as Promise<{
      data: TeamRow[] | null;
    }>,
    admin
      .from("gameweeks")
      .select("id, number, label")
      .in("id", gwIds)
      .order("number") as unknown as Promise<{
      data: GameweekRow[] | null;
    }>,
  ]);

  const teamById = new Map<string, TeamRow>();
  for (const t of teams ?? []) teamById.set(t.id, t);

  const playerById = new Map<string, PlayerRow>();
  for (const p of players ?? []) playerById.set(p.id, p);

  const poolPos = new Map<string, string>();
  for (const r of poolRows ?? []) {
    if (r.position) poolPos.set(r.player_id, r.position);
  }

  const statPlayers: StatPlayer[] = [];
  for (const ms of matchStats) {
    const gwId = fixtureGw.get(ms.fixture_id);
    if (!gwId) continue;
    const player = playerById.get(ms.player_id);
    if (!player) continue;
    const team = teamById.get(player.team_id);
    const rawPos = poolPos.get(ms.player_id) || "";
    const position = POOL_POS_TO_DISPLAY[rawPos] || rawPos || "Unknown";

    statPlayers.push({
      playerId: ms.player_id,
      name: `${player.first_name} ${player.last_name}`,
      teamName: team?.name ?? "Unknown",
      position,
      gameweekId: gwId,
      points: ms.fantasy_points,
      minutes: ms.minutes_played,
      tries: statNum(ms.stats, "tries"),
      tryAssists: statNum(ms.stats, "try_assists"),
      conversionGoals: statNum(ms.stats, "conversion_goals"),
      penaltyGoals: statNum(ms.stats, "penalty_goals"),
      tackles: statNum(ms.stats, "tackles"),
      dominantTackles: statNum(ms.stats, "dominant_tackles"),
      carries: statNum(ms.stats, "runs"),
      metresCarried: Math.round(statNum(ms.stats, "carry_metres_total")),
      lineBreaks: statNum(ms.stats, "clean_breaks"),
      turnoversWon: statNum(ms.stats, "turnover_won"),
    });
  }

  const gwInfo: GameweekInfo[] = (gameweeks ?? []).map((g) => ({
    id: g.id,
    number: g.number,
    label: g.label,
  }));

  return <StatsView players={statPlayers} gameweeks={gwInfo} />;
}
