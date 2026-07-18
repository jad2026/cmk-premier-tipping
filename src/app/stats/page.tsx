import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone, NPC_COMPETITION_ID, CMK_COMPETITION_ID } from "@/lib/competition";
import type { TzLocale } from "@/lib/datetime";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Fixture } from "@/lib/supabase/types";
import { buildPlaceholderFixture } from "./matchCentreTypes";
import type { MatchFixture, MatchStats, MatchEvent, MatchEventType, PlayerMatchStats } from "./matchCentreTypes";
import { getCachedAllTeams } from "@/lib/cached-queries";
import type { TeamAgg, PlayerAgg } from "./StatsLeaders";
import StatsSection from "./StatsSection";
import type { RoundData } from "./StatsSection";

export const revalidate = 300;

type LadderRow = {
  comp_id: string;
  team_id: string;
  team_name: string;
  position: number | null;
  matches_played: number | null;
  matches_won: number | null;
  matches_drawn: number | null;
  matches_lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points_diff: number | null;
  bonus_points: number | null;
  match_points: number | null;
  crest: string | null;
};

function val(n: number | null): string {
  return n != null ? String(n) : "—";
}

function signed(n: number | null): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

function teamMonogram(name: string): string {
  const words = name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type RichFixture = Omit<Fixture, "home_team" | "away_team"> & {
  home_team: Team;
  away_team: Team;
  opta_fixture_id?: string | null;
};

function numStat(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function mapTeamStats(stats: Record<string, string> | null): MatchStats {
  if (!stats) {
    return { possession: 0, territory: 0, carries: 0, metresGained: 0, passes: 0, tacklesMade: 0, missedTackles: 0, scrumsWon: 0, lineoutsWon: 0, penaltiesConceded: 0, turnoversWon: 0 };
  }
  return {
    possession: numStat(stats.ball_possession ?? stats.possession),
    territory: numStat(stats.territory),
    carries: numStat(stats.runs ?? stats.carries),
    metresGained: numStat(stats.carries_metres ?? stats.metres_gained),
    passes: numStat(stats.passes),
    tacklesMade: numStat(stats.tackles ?? stats.tackles_made),
    missedTackles: numStat(stats.missed_tackles),
    scrumsWon: numStat(stats.scrums_won_outright ?? stats.scrums_won),
    lineoutsWon: numStat(stats.lineouts_won),
    penaltiesConceded: numStat(stats.penalties_conceded),
    turnoversWon: numStat(stats.turnovers_conceded ?? stats.turnovers_won),
  };
}

const OPTA_EVENT_MAP: Record<string, MatchEventType> = {
  TRY: "try", "Penalty Try": "try", CONVERSION: "conversion",
  "PENALTY GOAL": "penalty", "Penalty Goal": "penalty",
  "DROP GOAL": "drop_goal", "Drop Goal": "drop_goal",
  "YELLOW CARD": "yellow_card", "Yellow Card": "yellow_card",
  "RED CARD": "red_card", "Red Card": "red_card",
  SUB: "substitution", Substitution: "substitution",
  CONV: "conversion", PENK: "penalty", YELC: "yellow_card",
  DROPG: "drop_goal", SUB_ON: "substitution", SUB_OFF: "substitution",
};

function positionGroupFromId(positionId: number | null, shirtNumber: number | null): PlayerMatchStats["positionGroup"] {
  const pid = positionId ?? 0;
  if (pid >= 1 && pid <= 3) return "Front Row";
  if (pid >= 4 && pid <= 5) return "Second Row";
  if (pid >= 6 && pid <= 8) return "Back Row";
  if (pid >= 9 && pid <= 10) return "Halfbacks";
  if (pid >= 12 && pid <= 13) return "Midfield";
  if (pid === 11 || pid === 14 || pid === 15) return "Outside Backs";
  const n = shirtNumber ?? 0;
  if (n >= 1 && n <= 3) return "Front Row";
  if (n >= 4 && n <= 5) return "Second Row";
  if (n >= 6 && n <= 8) return "Back Row";
  if (n === 9 || n === 10) return "Halfbacks";
  if (n === 12 || n === 13) return "Midfield";
  if (n === 11 || n === 14 || n === 15) return "Outside Backs";
  return "Back Row";
}

async function buildLiveFixtures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fixtures: RichFixture[],
  tz: TzLocale,
): Promise<MatchFixture[]> {
  const optaGameIds = fixtures
    .map((f) => f.opta_fixture_id)
    .filter((id): id is string => !!id);

  if (optaGameIds.length === 0) {
    return fixtures.map((f) =>
      buildPlaceholderFixture(
        f.id, f.home_team, f.away_team, f.venue,
        new Date(f.match_date).toLocaleTimeString(tz.locale, { timeZone: tz.timezone, hour: "numeric", minute: "2-digit" }),
      ),
    );
  }

  type TeamStatRow = { opta_game_id: string; opta_team_id: number; stats: Record<string, string> | null };
  type EventRow = { opta_game_id: string; event_id: string; event_type: string | null; minute: number | null; player_name: string | null; opta_team_id: string | null };
  type PlayerRow = { opta_game_id: string; opta_player_id: string; opta_team_id: number; player_name: string | null; shirt_number: number | null; position_id: number | null; stats: Record<string, string> | null };
  type MappingRow = { opta_team_id: string; team_id: string };
  type CommentaryRow = { opta_game_id: string; minute: number | null; event_type: string | null; comment: string | null };

  const allTeamIds = fixtures.flatMap((f) => [f.home_team.id, f.away_team.id]);
  const [tsResult, evResult, plResult, mapResult, comResult] = await Promise.all([
    supabase.from("opta_team_stats" as "fixtures").select("opta_game_id, opta_team_id, stats").in("opta_game_id", optaGameIds),
    supabase.from("opta_match_events" as "fixtures").select("opta_game_id, event_id, event_type, minute, player_name, opta_team_id").in("opta_game_id", optaGameIds).order("minute", { ascending: true }),
    supabase.from("opta_player_stats" as "fixtures").select("opta_game_id, opta_player_id, opta_team_id, player_name, shirt_number, position_id, stats").in("opta_game_id", optaGameIds),
    supabase.from("opta_team_mapping" as "fixtures").select("opta_team_id, team_id").in("team_id", allTeamIds),
    supabase.from("opta_commentary" as "fixtures").select("opta_game_id, minute, event_type, comment").in("opta_game_id", optaGameIds).order("minute", { ascending: false }),
  ]);
  const teamStatsRows = (tsResult.data ?? []) as unknown as TeamStatRow[];
  const eventsRows = (evResult.data ?? []) as unknown as EventRow[];
  const playerRows = (plResult.data ?? []) as unknown as PlayerRow[];
  const mappingRows = (mapResult.data ?? []) as unknown as MappingRow[];
  const commentaryAllRows = (comResult.data ?? []) as unknown as CommentaryRow[];

  const optaToTeamId = new Map<string, string>();
  for (const m of mappingRows) optaToTeamId.set(String(m.opta_team_id), m.team_id);

  return fixtures.map((f) => {
    const optaId = f.opta_fixture_id;
    const kickoffStr = new Date(f.match_date).toLocaleTimeString(tz.locale, { timeZone: tz.timezone, hour: "numeric", minute: "2-digit" });

    if (!optaId) {
      return buildPlaceholderFixture(f.id, f.home_team, f.away_team, f.venue, kickoffStr);
    }

    const gameTeamStats = teamStatsRows.filter((r) => r.opta_game_id === optaId);
    const gameEvents = eventsRows.filter((r) => r.opta_game_id === optaId);
    const gamePlayers = playerRows.filter((r) => r.opta_game_id === optaId);

    const hasOptaData = gameTeamStats.length > 0 || gameEvents.length > 0;

    if (!hasOptaData && f.home_score == null && f.away_score == null) {
      return buildPlaceholderFixture(f.id, f.home_team, f.away_team, f.venue, kickoffStr);
    }

    let homeStats = mapTeamStats(null);
    let awayStats = mapTeamStats(null);
    for (const ts of gameTeamStats) {
      const tid = optaToTeamId.get(String(ts.opta_team_id));
      if (tid === f.home_team.id) homeStats = mapTeamStats(ts.stats);
      else if (tid === f.away_team.id) awayStats = mapTeamStats(ts.stats);
    }

    const events: MatchEvent[] = [];
    let homeRunning = 0;
    let awayRunning = 0;
    for (const ev of gameEvents) {
      const eventType = OPTA_EVENT_MAP[ev.event_type ?? ""];
      if (!eventType) continue;
      const tid = optaToTeamId.get(String(ev.opta_team_id));
      if (!tid) continue;
      if (eventType === "try") { if (tid === f.home_team.id) homeRunning += 5; else awayRunning += 5; }
      else if (eventType === "conversion") { if (tid === f.home_team.id) homeRunning += 2; else awayRunning += 2; }
      else if (eventType === "penalty" || eventType === "drop_goal") { if (tid === f.home_team.id) homeRunning += 3; else awayRunning += 3; }
      events.push({ id: ev.event_id, minute: ev.minute ?? 0, type: eventType, playerName: ev.player_name ?? "Unknown", teamId: tid, scoreAtTime: `${homeRunning} - ${awayRunning}` });
    }

    const buildPlayers = (teamId: string): PlayerMatchStats[] =>
      gamePlayers.filter((p) => optaToTeamId.get(String(p.opta_team_id)) === teamId).map((p) => {
        const s = p.stats ?? {};
        return {
          playerId: String(p.opta_player_id),
          name: p.player_name ?? "Unknown",
          jerseyNumber: p.shirt_number ?? 0,
          positionGroup: positionGroupFromId(p.position_id, p.shirt_number),
          tries: numStat(s.Tries ?? s.tries),
          carries: numStat(s.Runs ?? s.runs ?? s.Carries ?? s.carries),
          metres: numStat(s.MetresRun ?? s.metres_run ?? s.Metres ?? s.metres),
          tackles: numStat(s.Tackles ?? s.tackles ?? s.TacklesMade ?? s.tackles_made),
          missedTackles: numStat(s.MissedTackles ?? s.missed_tackles),
        };
      });

    const matchDate = new Date(f.match_date);
    const now = new Date();
    const hasResult = f.result_team_id != null || f.is_draw;
    const hasScores = f.home_score != null && f.away_score != null;
    let status: MatchFixture["status"];
    if (hasResult || (hasScores && (f.home_score! > 0 || f.away_score! > 0))) {
      status = { type: "fulltime" };
    } else if (now >= matchDate && hasOptaData) {
      const maxMinute = Math.max(0, ...events.map((e) => e.minute));
      status = { type: "live", minute: maxMinute };
    } else {
      status = { type: "pre", kickoff: kickoffStr };
    }

    return {
      id: f.id,
      homeTeam: { id: f.home_team.id, name: f.home_team.name, short_name: f.home_team.short_name, colour: f.home_team.colour, logo_url: f.home_team.logo_url },
      awayTeam: { id: f.away_team.id, name: f.away_team.name, short_name: f.away_team.short_name, colour: f.away_team.colour, logo_url: f.away_team.logo_url },
      homeScore: f.home_score ?? 0,
      awayScore: f.away_score ?? 0,
      venue: f.venue,
      status,
      homeStats,
      awayStats,
      homePlayers: buildPlayers(f.home_team.id),
      awayPlayers: buildPlayers(f.away_team.id),
      events,
      commentary: commentaryAllRows
        .filter((r) => r.opta_game_id === optaId && r.comment)
        .map((r) => ({ minute: r.minute, period: null, text: r.comment as string, type: r.event_type })),
    };
  });
}

function buildBasicFixtures(fixtures: RichFixture[], tz: TzLocale): MatchFixture[] {
  return fixtures.map((f) => {
    const kickoffStr = new Date(f.match_date).toLocaleTimeString(tz.locale, { timeZone: tz.timezone, hour: "numeric", minute: "2-digit" });
    const hasResult = f.result_team_id != null || f.is_draw;
    const hasScores = f.home_score != null && f.away_score != null && (f.home_score! > 0 || f.away_score! > 0);
    const status: MatchFixture["status"] = hasResult || hasScores
      ? { type: "fulltime" }
      : { type: "pre", kickoff: kickoffStr };

    return {
      id: f.id,
      homeTeam: { id: f.home_team.id, name: f.home_team.name, short_name: f.home_team.short_name, colour: f.home_team.colour, logo_url: f.home_team.logo_url },
      awayTeam: { id: f.away_team.id, name: f.away_team.name, short_name: f.away_team.short_name, colour: f.away_team.colour, logo_url: f.away_team.logo_url },
      homeScore: f.home_score ?? 0,
      awayScore: f.away_score ?? 0,
      venue: f.venue,
      status,
      homeStats: mapTeamStats(null),
      awayStats: mapTeamStats(null),
      homePlayers: [],
      awayPlayers: [],
      events: [],
      commentary: [],
    };
  });
}

const STAT_KEYS = [
  "tries", "tackles", "metres", "clean_breaks", "defenders_beaten",
  "dominant_tackles", "tackle_turnover", "missed_tackles", "kick_penalty_good",
  "conversion_goals", "kick_metres", "kicks_from_hand", "lineouts_won",
  "carries_metres", "offload", "line_break_assists", "points",
  "penalties_conceded", "turnovers_conceded", "handling_errors", "try_assists",
  "runs", "kicks", "scrums_won_outright", "minutes_played_total",
] as const;

type ViewRow = {
  opta_player_id: string;
  player_name: string | null;
  opta_team_id: number | null;
  position: string | null;
  season: string;
  games: number;
} & Record<string, number | null>;

type SeasonStatsData = {
  teams: TeamAgg[];
  players: PlayerAgg[];
  teamNames: string[];
};

function buildSeasonFromView(
  rows: ViewRow[],
  resolveTeamName: (optaId: number | null) => string,
): SeasonStatsData | null {
  if (rows.length === 0) return null;

  const players: PlayerAgg[] = rows.map((r) => {
    const stats: Record<string, number> = {};
    for (const key of STAT_KEYS) stats[key] = Number(r[key]) || 0;
    return {
      name: r.player_name ?? "Unknown",
      teamName: resolveTeamName(r.opta_team_id),
      games: Number(r.games) || 0,
      stats,
      position: r.position ?? "",
    };
  });

  const teamAgg = new Map<string, TeamAgg>();
  for (const p of players) {
    if (p.teamName === "Unknown") continue;
    const existing = teamAgg.get(p.teamName);
    if (existing) {
      existing.games = Math.max(existing.games, p.games);
      for (const key of STAT_KEYS) existing.stats[key] = (existing.stats[key] ?? 0) + p.stats[key];
    } else {
      const stats: Record<string, number> = {};
      for (const key of STAT_KEYS) stats[key] = p.stats[key];
      teamAgg.set(p.teamName, { teamName: p.teamName, games: p.games, stats });
    }
  }

  const teams = Array.from(teamAgg.values());
  const teamNameSet = new Set([
    ...teams.map((t) => t.teamName),
    ...players.map((p) => p.teamName),
  ].filter((n) => n !== "Unknown"));

  return { teams, players, teamNames: Array.from(teamNameSet).sort() };
}

async function getStatsData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  include2025: boolean,
): Promise<{
  season2025: SeasonStatsData | null;
  season2026: SeasonStatsData | null;
} | null> {
  const { data: mappings } = await supabase
    .from("opta_team_mapping")
    .select("opta_team_id, team_id") as {
      data: { opta_team_id: string; team_id: string }[] | null;
    };
  const optaToTeamId = new Map<string, string>();
  for (const m of mappings ?? []) optaToTeamId.set(String(m.opta_team_id), m.team_id);

  const { data: dbTeams } = await supabase.from("teams").select("id, name") as {
    data: { id: string; name: string }[] | null;
  };
  const teamIdToName = new Map<string, string>();
  for (const t of dbTeams ?? []) teamIdToName.set(t.id, t.name);

  function resolveTeamName(optaId: number | null): string {
    if (optaId == null) return "Unknown";
    const pid = optaToTeamId.get(String(optaId));
    return pid ? (teamIdToName.get(pid) ?? "Unknown") : "Unknown";
  }

  const seasons = include2025 ? ["2025", "2026"] : ["2026"];
  const { data: viewRows } = await supabase
    .from("player_season_stats" as "fixtures")
    .select("*")
    .in("season", seasons) as { data: ViewRow[] | null };

  const allRows = (viewRows ?? []) as unknown as ViewRow[];
  const rows2026 = allRows.filter((r) => r.season === "2026");
  const rows2025 = allRows.filter((r) => r.season === "2025");

  const season2026 = buildSeasonFromView(rows2026, resolveTeamName);
  const season2025 = include2025 ? buildSeasonFromView(rows2025, resolveTeamName) : null;

  if (!season2025 && !season2026) return null;

  return { season2025, season2026 };
}

export default async function LadderPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const tz = await getCompetitionTimezone(compId);

  const CMK_WOMEN_COMPETITION_ID = "952743a7-9e79-4c5b-b15c-7fe07c4ca420";
  const tenantIds = compId === CMK_COMPETITION_ID
    ? [CMK_COMPETITION_ID, CMK_WOMEN_COMPETITION_ID]
    : [compId];

  const [
    { data: activeComps },
    teams,
    { data: closedGameweeks },
  ] = await Promise.all([
    supabase
      .from("competitions")
      .select("comp_id")
      .in("id", tenantIds)
      .eq("is_active", true),
    getCachedAllTeams(),
    supabase
      .from("gameweeks")
      .select("number")
      .eq("competition_id", compId)
      .eq("is_open", false)
      .order("number", { ascending: false })
      .limit(1),
  ]);

  const { data: { user } } = await supabase.auth.getUser();
  const GATED_USER_ID = "9f509fc4-1eff-4670-8b3f-b03d4315ad35";
  const statsData = user ? await getStatsData(supabase, user.id === GATED_USER_ID) : null;

  const activeXplorerIds = (activeComps ?? []).map((c: { comp_id: string }) => c.comp_id);

  const { data: rows, error } = activeXplorerIds.length > 0
    ? await supabase
        .from("ladder_standings")
        .select(
          "comp_id, team_id, team_name, position, matches_played, matches_won, matches_drawn, matches_lost, points_for, points_against, points_diff, bonus_points, match_points, crest"
        )
        .in("comp_id", activeXplorerIds)
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (error) console.error("ladder_standings query error:", error);

  const standings = (rows ?? []) as LadderRow[];

  const teamList = teams;
  const teamByName = new Map<string, Team>();
  for (const t of teamList) {
    teamByName.set(t.name.toLowerCase(), t);
  }
  const FALLBACK_COLORS = ["#1E7A3E", "#21409A", "#B23A48", "#2C9FD4", "#7A4B36", "#15324E", "#2B6E2B", "#6E3A2A", "#2C6E8F"];

  function findTeam(name: string): Team | undefined {
    const lower = name.toLowerCase();
    for (const [key, team] of Array.from(teamByName)) {
      if (lower.includes(key) || key.includes(lower)) return team;
    }
    return undefined;
  }

  function getTeamColour(name: string, idx: number): string {
    return findTeam(name)?.colour ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  }

  const isNpc = compId === NPC_COMPETITION_ID;
  const compLabel = isNpc ? "Provincial" : "CMK Premier";
  const latestRound = closedGameweeks?.[0]?.number ?? null;

  // Fetch Round 1 fixtures for the match centre preview
  let matchCentreFixtures: MatchFixture[] = [];
  let round1Label: string | null = null;
  let round1Date: string | null = null;
  if (isNpc) {
    const { data: firstGw } = await supabase
      .from("gameweeks")
      .select("id, label, deadline")
      .eq("competition_id", compId)
      .order("number", { ascending: true })
      .limit(1)
      .single();

    if (firstGw) {
      round1Label = firstGw.label;
      round1Date = new Date(firstGw.deadline).toLocaleDateString(tz.locale, {
        timeZone: tz.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      const { data: r1Fixtures } = await supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
        .eq("gameweek_id", firstGw.id)
        .order("match_date", { ascending: true });

      if (r1Fixtures?.length) {
        const richFixtures = r1Fixtures as unknown as RichFixture[];
        matchCentreFixtures = await buildLiveFixtures(supabase, richFixtures, tz);
      }
    }
  }

  // Fetch 2025 NPC data for gated users
  const NPC_2025_COMPETITION_ID = "aa056357-840d-41be-b311-afd2298d42ad";
  const canToggleSeason = isNpc && user?.id === GATED_USER_ID;
  let rounds2025: RoundData[] = [];

  if (canToggleSeason) {
    const { data: gw2025 } = await supabase
      .from("gameweeks")
      .select("id, number, label")
      .eq("competition_id", NPC_2025_COMPETITION_ID)
      .order("number", { ascending: true });

    if (gw2025?.length) {
      const gwIds = gw2025.map((gw) => gw.id);
      const { data: allFixtures } = await supabase
        .from("fixtures")
        .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
        .in("gameweek_id", gwIds)
        .order("match_date", { ascending: true });

      if (allFixtures?.length) {
        const fixturesByGw = new Map<string, RichFixture[]>();
        for (const f of allFixtures as unknown as RichFixture[]) {
          const list = fixturesByGw.get(f.gameweek_id) ?? [];
          list.push(f);
          fixturesByGw.set(f.gameweek_id, list);
        }

        rounds2025 = gw2025.map((gw) => {
          const gwFixtures = fixturesByGw.get(gw.id) ?? [];
          const fixtures = gwFixtures.length > 0
            ? buildBasicFixtures(gwFixtures, tz)
            : [];
          return { number: gw.number as number, label: gw.label as string, fixtures };
        });
      }
    }
  }

  function compHeading(rows: LadderRow[]): string {
    const names = rows.map((r) => r.team_name.toLowerCase());
    if (names.some((n) => n.includes("women"))) return `${compLabel} Women`;
    if (names.some((n) => n.includes("men"))) return `${compLabel} Men`;
    return compLabel;
  }

  function compEyebrow(rows: LadderRow[]): string {
    const heading = compHeading(rows);
    const roundSuffix = latestRound ? ` · After Round ${latestRound}` : "";
    return `${heading}${roundSuffix}`;
  }

  // Group by comp_id
  const comps = Array.from(
    standings.reduce((map, row) => {
      if (!map.has(row.comp_id)) map.set(row.comp_id, { rows: [] });
      map.get(row.comp_id)!.rows.push(row);
      return map;
    }, new Map<string, { rows: LadderRow[] }>())
  );

  // For each comp, determine total row count for zone borders
  function getBarColor(rank: number, total: number): string {
    if (rank <= 4) return "var(--accent)";

    return "#E4E1D8";
  }

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >

      {/* ── Dark header ──────────────────────────────────────────────── */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              {comps.length > 0 ? compEyebrow(comps[0][1].rows) : compLabel}
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            Stats<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p style={{ fontSize: 16, color: "#AEB4BE", margin: "14px 0 0", maxWidth: 480 }}>
            Season leaders, team standings, and key performance stats.
          </p>
        </div>
      </section>

      {/* ── Match Centre + Stats Leaders ──────────────────────────── */}
      {statsData && (
        <StatsSection
          matchCentre2026={isNpc && matchCentreFixtures.length > 0
            ? { fixtures: matchCentreFixtures, round1Label, round1Date }
            : null
          }
          matchCentre2025={canToggleSeason && rounds2025.length > 0
            ? { rounds: rounds2025 }
            : null
          }
          statsData={statsData}
          canToggleSeason={canToggleSeason}
        />
      )}

      {/* Match Centre only (no stats data / not logged in) */}
      {!statsData && isNpc && matchCentreFixtures.length > 0 && (
        <StatsSection
          matchCentre2026={{ fixtures: matchCentreFixtures, round1Label, round1Date }}
          matchCentre2025={null}
          statsData={{ season2025: null, season2026: null }}
          canToggleSeason={false}
        />
      )}

      {/* ── Standings ────────────────────────────────────────────────── */}
      <section className="mx-auto" style={{ maxWidth: 1100, padding: "24px 32px 0" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
          <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
          <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
            Standings
          </h2>
        </div>
      </section>

      {/* ── Tables per competition ────────────────────────────────────── */}
      {standings.length === 0 ? (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "40px 32px 70px" }}>
          <div className="text-center" style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "56px 24px" }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>🏉</span>
            <p style={{ fontWeight: 600, color: "#5A6371", margin: 0 }}>No standings data available yet</p>
            <p style={{ fontSize: 14, color: "#8B8676", marginTop: 4 }}>Standings will appear here once competition data is available.</p>
          </div>
        </section>
      ) : (
        comps.map(([cId, { rows: compRows }], compIdx) => {
          const total = compRows.length;
          return (
            <div key={cId}>
              {/* Legend */}
              <section className="mx-auto" style={{ maxWidth: 1100, padding: compIdx === 0 ? "30px 32px 18px" : "40px 32px 18px" }}>
                {comps.length > 1 && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
                    <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
                      {compHeading(compRows)}
                    </h2>
                  </div>
                )}
                <div className="flex items-center flex-wrap" style={{ gap: 20 }}>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--accent)" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#5A5546" }}>Top 4 · Semi-finals</span>
                  </div>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: "#C9C5B8" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#5A5546" }}>Mid-table</span>
                  </div>
                </div>
              </section>

              {/* Table */}
              <section className="mx-auto" style={{ maxWidth: 1100, padding: "0 32px 70px" }}>
                <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, overflow: "hidden", fontFeatureSettings: "'tnum'" }}>
                  <div className="overflow-x-auto">
                    {/* Header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "46px 1fr 42px 42px 42px 42px 58px 58px 58px 56px",
                        padding: "15px 20px",
                        background: "#0D1016",
                        color: "#9AA1AD",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        minWidth: 560,
                      }}
                    >
                      <span>#</span>
                      <span>Club</span>
                      <span style={{ textAlign: "center" }}>P</span>
                      <span style={{ textAlign: "center" }}>W</span>
                      <span style={{ textAlign: "center" }}>D</span>
                      <span style={{ textAlign: "center" }}>L</span>
                      <span style={{ textAlign: "center" }}>PF</span>
                      <span style={{ textAlign: "center" }}>PA</span>
                      <span style={{ textAlign: "center" }}>PD</span>
                      <span style={{ textAlign: "right" }}>Pts</span>
                    </div>

                    {/* Rows */}
                    {compRows.map((row, idx) => {
                      const rank = row.position ?? idx + 1;
                      const barColor = getBarColor(rank, total);
                      const teamColor = getTeamColour(row.team_name, idx);
                      const pd = row.points_diff;

                      return (
                        <div
                          key={row.team_id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "46px 1fr 42px 42px 42px 42px 58px 58px 58px 56px",
                            alignItems: "center",
                            padding: "15px 20px",
                            borderTop: "1px solid #EFEDE6",
                            borderLeft: `4px solid ${barColor}`,
                            minWidth: 560,
                          }}
                        >
                          {/* Rank */}
                          <span
                            className="font-display"
                            style={{ fontSize: 16, color: "#11151C" }}
                          >
                            {rank}
                          </span>

                          {/* Club */}
                          <span className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
                            {(() => {
                              const matched = findTeam(row.team_name);
                              if (matched) {
                                return <TeamBadge team={matched} size="sm" />;
                              }
                              return (
                                <span
                                  className="flex items-center justify-center rounded-full shrink-0"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    background: teamColor,
                                    fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                                    fontSize: 11,
                                    color: "#fff",
                                  }}
                                >
                                  {teamMonogram(row.team_name)}
                                </span>
                              );
                            })()}
                            <span className="flex flex-col" style={{ minWidth: 0 }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: "#11151C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {row.team_name}
                              </span>
                            </span>
                          </span>

                          {/* P */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                            {val(row.matches_played)}
                          </span>

                          {/* W */}
                          <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#169B63" }}>
                            {val(row.matches_won)}
                          </span>

                          {/* D */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#8B8676" }}>
                            {val(row.matches_drawn)}
                          </span>

                          {/* L */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#B23A48" }}>
                            {val(row.matches_lost)}
                          </span>

                          {/* PF */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                            {val(row.points_for)}
                          </span>

                          {/* PA */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                            {val(row.points_against)}
                          </span>

                          {/* PD */}
                          <span style={{
                            textAlign: "center",
                            fontSize: 14,
                            fontWeight: 700,
                            color: pd != null && pd > 0 ? "#1F9E5A" : pd != null && pd < 0 ? "#B23A48" : "#5A6371",
                          }}>
                            {signed(pd)}
                          </span>

                          {/* Pts */}
                          <span
                            className="font-display"
                            style={{ textAlign: "right", fontSize: 18, color: "#11151C" }}
                          >
                            {val(row.match_points)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          );
        })
      )}
    </div>
  );
}
