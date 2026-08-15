import { createAdminClient } from "@/lib/supabase/server";
import StatsView from "./StatsView";

export const revalidate = 60;

export const metadata = {
  title: "Fantasy Stats — Club Rugby Tipping",
};

const FANTASY_COMP_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

type OptaStatRow = {
  opta_player_id: string;
  opta_team_id: number;
  player_name: string;
  position: string | null;
  stats: Record<string, string> | null;
  fixture_id: string;
};

type FixtureRow = {
  id: string;
  gameweek_id: string;
  home_score: number | null;
};

type PlayerIdRow = {
  id: string;
  first_name: string;
  last_name: string;
  team_id: string;
  opta_player_id: string;
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

type ScoringRule = {
  stat_key: string;
  points_per: number;
  applies_to: string[] | null;
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

/* ── Opta position → fantasy_position slug ── */

const OPTA_TO_FANTASY_POS: Record<string, string> = {
  "Forward 1": "prop",
  "Forward 3": "prop",
  "Forward 2": "hooker",
  "Forward 4": "lock",
  "Forward 5": "lock",
  "Forward 6": "loose_forward",
  "Forward 7": "loose_forward",
  "Forward 8": "loose_forward",
  "Back 1": "halfback",
  "Back 2": "first_five",
  "Back 3": "outside_back",
  "Back 4": "centre",
  "Back 5": "centre",
  "Back 6": "outside_back",
  "Back 7": "outside_back",
  "Replacement 1": "prop",
  "Replacement 2": "hooker",
  "Replacement 3": "prop",
  "Replacement 4": "lock",
  "Replacement 5": "loose_forward",
  "Replacement 6": "halfback",
  "Replacement 7": "first_five",
  "Replacement 8": "outside_back",
};

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

const STAT_KEY_REMAP: Record<string, string> = {
  carry_metres_fwd: "carry_metres_total",
  carry_metres_back: "carry_metres_total",
  tackles_fwd: "tackles",
  tackles_back: "tackles",
  lineout_throw_fwd: "lineout_won_own_throw",
};

const MINUTES_KEYS = [
  "MinutesPlayedTotal",
  "minutes_played_total",
  "MinutesPlayed",
  "minutes_played",
];

/* ── Scoring helpers (mirrors scoring engine) ── */

function readStat(stats: Record<string, string> | null, key: string): number {
  if (!stats) return 0;
  const v = stats[key];
  if (v == null) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function readStatMulti(
  stats: Record<string, string> | null,
  keys: string[]
): number {
  if (!stats) return 0;
  for (const k of keys) {
    const v = stats[k];
    if (v != null) {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

function scorePlayer(
  stats: Record<string, string> | null,
  position: string | null,
  rules: ScoringRule[]
): { points: number; minutes: number } {
  const minutes = readStatMulti(stats, MINUTES_KEYS);

  let points = 0;
  if (minutes > 0) points += 2;
  if (minutes >= 60) points += 2;

  const fantasyPos = position
    ? (OPTA_TO_FANTASY_POS[position] || null)
    : null;

  for (const rule of rules) {
    if (rule.applies_to && rule.applies_to.length > 0) {
      if (!fantasyPos || !rule.applies_to.includes(fantasyPos)) continue;
    }

    const optaKey = STAT_KEY_REMAP[rule.stat_key] || rule.stat_key;
    let count = readStat(stats, optaKey);

    if (rule.stat_key.startsWith("carry_metres")) {
      count = Math.floor(count / 10);
    }

    points += count * rule.points_per;
  }

  return { points: Math.round(points * 100) / 100, minutes };
}

export default async function FantasyStatsPage() {
  const admin = createAdminClient();

  /* ── 1. Load scoring rules ── */

  const { data: rules } = (await (
    admin.from("fantasy_scoring_rules") as unknown as AnyTable
  )
    .select("stat_key, points_per, applies_to")
    .eq("competition_id", FANTASY_COMP_ID)) as {
    data: ScoringRule[] | null;
  };

  if (!rules?.length) {
    return <StatsView players={[]} gameweeks={[]} liveGwIds={[]} />;
  }

  /* ── 2. Load all gameweeks for the fantasy competition ── */

  const { data: gameweeks } = (await admin
    .from("gameweeks")
    .select("id, number, label")
    .eq("competition_id", FANTASY_COMP_ID)
    .order("number")) as unknown as {
    data: GameweekRow[] | null;
  };

  if (!gameweeks?.length) {
    return <StatsView players={[]} gameweeks={[]} liveGwIds={[]} />;
  }

  const allGwIds = gameweeks.map((g) => g.id);

  /* ── 3. Load all fixtures for these gameweeks ── */

  const { data: allFixtures } = (await admin
    .from("fixtures")
    .select("id, gameweek_id, home_score")
    .in("gameweek_id", allGwIds)) as unknown as {
    data: FixtureRow[] | null;
  };

  if (!allFixtures?.length) {
    return <StatsView players={[]} gameweeks={[]} liveGwIds={[]} />;
  }

  const scoredFixtures = allFixtures.filter((f) => f.home_score != null);
  if (!scoredFixtures.length) {
    return <StatsView players={[]} gameweeks={[]} liveGwIds={[]} />;
  }

  const fixtureIds = scoredFixtures.map((f) => f.id);

  /* ── 4. Determine live rounds (partially complete) ── */

  const gwFixtureCounts = new Map<string, { total: number; scored: number }>();
  for (const f of allFixtures) {
    const entry = gwFixtureCounts.get(f.gameweek_id) || { total: 0, scored: 0 };
    entry.total++;
    if (f.home_score != null) entry.scored++;
    gwFixtureCounts.set(f.gameweek_id, entry);
  }

  const liveGwIds: string[] = [];
  const scoredGwIds = new Set<string>();
  for (const [gwId, counts] of Array.from(gwFixtureCounts.entries())) {
    if (counts.scored > 0) {
      scoredGwIds.add(gwId);
      if (counts.scored < counts.total) {
        liveGwIds.push(gwId);
      }
    }
  }

  /* ── 5. Map fixtures to gameweeks ── */

  const fixtureGw = new Map<string, string>();
  for (const f of scoredFixtures) fixtureGw.set(f.id, f.gameweek_id);

  /* ── 5. Load opta player stats for scored fixtures ── */

  const { data: optaStats } = (await admin
    .from("opta_player_stats")
    .select("opta_player_id, opta_team_id, player_name, position, stats, fixture_id")
    .in("fixture_id", fixtureIds)) as unknown as {
    data: OptaStatRow[] | null;
  };

  if (!optaStats?.length) {
    return <StatsView players={[]} gameweeks={[]} liveGwIds={[]} />;
  }

  /* ── 6. Load player/team/pool data ── */

  const [{ data: playerRows }, { data: teams }, { data: poolRows }, { data: mappings }] =
    await Promise.all([
      admin
        .from("players")
        .select("id, first_name, last_name, team_id, opta_player_id") as unknown as Promise<{
        data: PlayerIdRow[] | null;
      }>,
      admin
        .from("teams")
        .select("id, name, short_name") as unknown as Promise<{
        data: TeamRow[] | null;
      }>,
      (admin.from("fantasy_player_pool") as unknown as AnyTable)
        .select("player_id, position")
        .eq("competition_id", FANTASY_COMP_ID) as Promise<{
        data: PoolRow[] | null;
      }>,
      admin
        .from("opta_team_mapping")
        .select("opta_team_id, team_id") as unknown as Promise<{
        data: { opta_team_id: string; team_id: string }[] | null;
      }>,
    ]);

  const optaToUuid = new Map<string, string>();
  const playerById = new Map<string, PlayerIdRow>();
  for (const p of playerRows || []) {
    playerById.set(p.id, p);
    if (p.opta_player_id) optaToUuid.set(p.opta_player_id, p.id);
  }

  const teamById = new Map<string, TeamRow>();
  for (const t of teams || []) teamById.set(t.id, t);

  const optaTeamToUuid = new Map<string, string>();
  for (const m of mappings || []) optaTeamToUuid.set(String(m.opta_team_id), m.team_id);

  const poolPos = new Map<string, string>();
  for (const r of poolRows || []) {
    if (r.position) poolPos.set(r.player_id, r.position);
  }

  /* ── 7. Score each player per fixture and build stat rows ── */

  const statPlayers: StatPlayer[] = [];

  for (const row of optaStats) {
    const gwId = fixtureGw.get(row.fixture_id);
    if (!gwId) continue;

    const uuid = optaToUuid.get(row.opta_player_id);
    if (!uuid) continue;

    const player = playerById.get(uuid);
    if (!player) continue;

    const teamId = optaTeamToUuid.get(String(row.opta_team_id)) || player.team_id;
    const team = teamById.get(teamId);

    const poolPosition = poolPos.get(uuid) || "";
    const displayPos = POOL_POS_TO_DISPLAY[poolPosition] || poolPosition || "Unknown";

    const { points, minutes } = scorePlayer(row.stats, row.position, rules);

    statPlayers.push({
      playerId: uuid,
      name: `${player.first_name} ${player.last_name}`,
      teamName: team?.name || "Unknown",
      position: displayPos,
      gameweekId: gwId,
      points,
      minutes,
      tries: readStat(row.stats, "tries"),
      tryAssists: readStat(row.stats, "try_assists"),
      conversionGoals: readStat(row.stats, "conversion_goals"),
      penaltyGoals: readStat(row.stats, "penalty_goals"),
      tackles: readStat(row.stats, "tackles"),
      dominantTackles: readStat(row.stats, "dominant_tackles"),
      carries: readStat(row.stats, "runs"),
      metresCarried: Math.round(readStat(row.stats, "carry_metres_total")),
      lineBreaks: readStat(row.stats, "clean_breaks"),
      turnoversWon: readStat(row.stats, "turnover_won"),
    });
  }

  const gwInfo: GameweekInfo[] = gameweeks
    .filter((g) => scoredGwIds.has(g.id))
    .map((g) => ({
      id: g.id,
      number: g.number,
      label: g.label,
    }));

  return <StatsView players={statPlayers} gameweeks={gwInfo} liveGwIds={liveGwIds} />;
}
