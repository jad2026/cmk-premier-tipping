import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone, NPC_COMPETITION_ID, CMK_COMPETITION_ID } from "@/lib/competition";
import type { TzLocale } from "@/lib/datetime";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Fixture } from "@/lib/supabase/types";
import MatchCentre from "./MatchCentre";
import { buildPlaceholderFixture } from "./matchCentreTypes";
import { getCachedAllTeams } from "@/lib/cached-queries";
import StatsLeaders from "./StatsLeaders";
import type { TeamAgg, PlayerAgg } from "./StatsLeaders";

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
};

const STAT_ALIASES: Record<string, string[]> = {
  tries: ["Tries", "tries"],
  tackles: ["Tackles", "tackles", "TacklesMade", "tackles_made"],
  metres: ["MetresRun", "metres_run", "Metres", "metres", "MetresGained"],
  clean_breaks: ["CleanBreaks", "clean_breaks", "LineBreaks", "line_breaks"],
  defenders_beaten: ["DefendersBeaten", "defenders_beaten"],
  dominant_tackles: ["DominantTackles", "dominant_tackles"],
  tackle_turnover: ["TackleTurnover", "tackle_turnover", "TurnoverWon", "turnover_won"],
  missed_tackles: ["MissedTackles", "missed_tackles"],
  kick_penalty_good: ["KickPenaltyGood", "kick_penalty_good", "PenaltyGoals", "penalty_goals"],
  conversion_goals: ["ConversionGoals", "conversion_goals", "Conversions", "conversions"],
  kick_metres: ["KickMetres", "kick_metres", "KickingMetres", "kicking_metres"],
  kicks_from_hand: ["KicksFromHand", "kicks_from_hand"],
  lineout_success: ["LineoutSuccess", "lineout_success"],
  lineouts_won: ["LineoutsWon", "lineouts_won"],
  total_lineouts: ["TotalLineouts", "total_lineouts"],
  carries_metres: ["CarriesMetres", "carries_metres"],
  offload: ["Offload", "offload", "Offloads", "offloads"],
  line_break_assists: ["LineBreakAssists", "line_break_assists"],
  points: ["Points", "points"],
  possession_pct: ["PossessionPercentage", "possession_percentage", "Possession", "possession"],
  territory_pct: ["TerritoryPercentage", "territory_percentage", "Territory", "territory"],
  penalties_conceded: ["PenaltiesConceded", "penalties_conceded"],
  turnovers_conceded: ["TurnoversConceded", "turnovers_conceded", "Turnovers", "turnovers"],
  scrum_success: ["ScrumSuccess", "scrum_success"],
  handling_errors: ["HandlingErrors", "handling_errors", "HandlingError", "handling_error"],
  try_assists: ["TryAssists", "try_assists"],
  runs: ["Runs", "runs", "Carries", "carries"],
  tackle_success: ["TackleSuccess", "tackle_success", "TackleSuccessRate", "tackle_success_rate"],
  turnover_won: ["TurnoverWon", "turnover_won", "TurnoversWon", "turnovers_won"],
  kicks: ["Kicks", "kicks", "KicksFromHand", "kicks_from_hand"],
  scrums_won_outright: ["ScrumsWonOutright", "scrums_won_outright", "ScrumWon", "scrum_won"],
  minutes_played_total: ["MinutesPlayedTotal", "minutes_played_total", "MinutesPlayed", "minutes_played"],
};

function extractStat(s: Record<string, string>, key: string): number {
  const aliases = STAT_ALIASES[key];
  if (!aliases) return parseInt(s[key] ?? "0", 10) || 0;
  for (const a of aliases) {
    if (s[a] != null) return parseFloat(s[a]) || 0;
  }
  return 0;
}

type StatsPageRow = { opta_team_id: number | null; opta_game_id?: string | null; stats: Record<string, string> | null };

async function fetchAllRows<T extends StatsPageRow>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  selectCols: string,
): Promise<T[]> {
  const allRows: T[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data: page } = await supabase
      .from(table)
      .select(selectCols)
      .range(offset, offset + PAGE_SIZE - 1) as { data: T[] | null };
    if (!page || page.length === 0) break;
    allRows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allRows;
}

const SEASON_2025_MIN = 946625;
const SEASON_2025_MAX = 946701;

function isGameId2025(gameId: string | null | undefined): boolean {
  if (!gameId) return false;
  const n = parseInt(gameId, 10);
  return n >= SEASON_2025_MIN && n <= SEASON_2025_MAX;
}

type SeasonStatsData = {
  teams: TeamAgg[];
  players: PlayerAgg[];
  teamNames: string[];
};

async function getStatsData(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{
  season2025: SeasonStatsData | null;
  season2026: SeasonStatsData | null;
} | null> {
  const [playerRows, teamStatRows] = await Promise.all([
    fetchAllRows<{
      opta_player_id: string;
      opta_game_id: string | null;
      player_name: string | null;
      first_name: string | null;
      last_name: string | null;
      opta_team_id: number | null;
      position: string | null;
      stats: Record<string, string> | null;
    }>(supabase, "opta_player_stats", "opta_player_id, opta_game_id, player_name, first_name, last_name, opta_team_id, position, stats"),
    fetchAllRows<{
      opta_team_id: number | null;
      opta_game_id: string | null;
      stats: Record<string, string> | null;
    }>(supabase, "opta_team_stats", "opta_team_id, opta_game_id, stats"),
  ]);

  if (playerRows.length === 0 && teamStatRows.length === 0) return null;

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

  const statKeys = Object.keys(STAT_ALIASES);

  type PlayerRow = typeof playerRows[number];
  type TeamRow = typeof teamStatRows[number];

  function aggregateSeason(
    pRows: PlayerRow[],
    tRows: TeamRow[],
  ): SeasonStatsData | null {
    if (pRows.length === 0 && tRows.length === 0) return null;

    const teamAgg = new Map<string, TeamAgg & { _sumPcts: Record<string, number>; _pctCount: Record<string, number> }>();
    for (const row of tRows) {
      const teamName = resolveTeamName(row.opta_team_id);
      if (teamName === "Unknown") continue;
      const s = (row.stats ?? {}) as Record<string, string>;
      const existing = teamAgg.get(teamName);
      if (existing) {
        existing.games++;
        for (const key of statKeys) {
          const val = extractStat(s, key);
          if (key.includes("pct")) {
            existing._sumPcts[key] = (existing._sumPcts[key] ?? 0) + val;
            existing._pctCount[key] = (existing._pctCount[key] ?? 0) + (val > 0 ? 1 : 0);
          } else {
            existing.stats[key] = (existing.stats[key] ?? 0) + val;
          }
        }
      } else {
        const stats: Record<string, number> = {};
        const _sumPcts: Record<string, number> = {};
        const _pctCount: Record<string, number> = {};
        for (const key of statKeys) {
          const val = extractStat(s, key);
          if (key.includes("pct")) {
            _sumPcts[key] = val;
            _pctCount[key] = val > 0 ? 1 : 0;
          } else {
            stats[key] = val;
          }
        }
        teamAgg.set(teamName, { teamName, games: 1, stats, _sumPcts, _pctCount });
      }
    }
    const teamsResult: TeamAgg[] = Array.from(teamAgg.values()).map((t) => {
      for (const key of Object.keys(t._sumPcts)) {
        t.stats[key] = t._pctCount[key] > 0 ? t._sumPcts[key] / t._pctCount[key] : 0;
      }
      return { teamName: t.teamName, games: t.games, stats: t.stats };
    });

    const playerAggMap = new Map<string, PlayerAgg & { _posCounts: Record<string, number> }>();
    for (const row of pRows) {
      const pid = String(row.opta_player_id);
      const s = (row.stats ?? {}) as Record<string, string>;
      const teamName = resolveTeamName(row.opta_team_id);
      const name = row.player_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unknown";
      const pos = row.position ?? "";

      const existing = playerAggMap.get(pid);
      if (existing) {
        existing.games++;
        for (const key of statKeys) existing.stats[key] = (existing.stats[key] ?? 0) + extractStat(s, key);
        if (teamName !== "Unknown") existing.teamName = teamName;
        if (name !== "Unknown") existing.name = name;
        if (pos) existing._posCounts[pos] = (existing._posCounts[pos] ?? 0) + 1;
      } else {
        const stats: Record<string, number> = {};
        for (const key of statKeys) stats[key] = extractStat(s, key);
        const _posCounts: Record<string, number> = {};
        if (pos) _posCounts[pos] = 1;
        playerAggMap.set(pid, { name, teamName, games: 1, stats, position: pos, _posCounts });
      }
    }

    const playersResult = Array.from(playerAggMap.values()).map((p) => {
      let bestPos = "";
      let bestCount = 0;
      for (const [pos, count] of Object.entries(p._posCounts)) {
        if (count > bestCount) { bestPos = pos; bestCount = count; }
      }
      return { name: p.name, teamName: p.teamName, games: p.games, stats: p.stats, position: bestPos };
    });

    const teamNameSet = new Set([
      ...teamsResult.map((t) => t.teamName),
      ...playersResult.map((p) => p.teamName),
    ].filter((n) => n !== "Unknown"));

    return { teams: teamsResult, players: playersResult, teamNames: Array.from(teamNameSet).sort() };
  }

  const players2025 = playerRows.filter((r) => isGameId2025(r.opta_game_id));
  const players2026 = playerRows.filter((r) => !isGameId2025(r.opta_game_id));
  const teams2025 = teamStatRows.filter((r) => isGameId2025(r.opta_game_id));
  const teams2026 = teamStatRows.filter((r) => !isGameId2025(r.opta_game_id));

  return {
    season2025: aggregateSeason(players2025, teams2025),
    season2026: aggregateSeason(players2026, teams2026),
  };
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
  const statsData = user ? await getStatsData(supabase) : null;

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
  let previewFixtures: RichFixture[] = [];
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

      if (r1Fixtures?.length) previewFixtures = r1Fixtures as unknown as RichFixture[];
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

      {/* ── Match Centre (NPC only) ──────────────────────────────── */}
      {isNpc && previewFixtures.length > 0 && (
        <MatchCentre
          fixtures={previewFixtures.map((f) =>
            buildPlaceholderFixture(
              f.id,
              f.home_team,
              f.away_team,
              f.venue,
              new Date(f.match_date).toLocaleTimeString(tz.locale, {
                timeZone: tz.timezone,
                hour: "numeric",
                minute: "2-digit",
              }),
            )
          )}
          round1Label={round1Label}
          round1Date={round1Date}
        />
      )}

      {/* ── Team & Player stat leaders ──────────────────────────────── */}
      {statsData && (
        <div style={{ background: "#0D1117" }}>
          <StatsLeaders
            season2025={statsData.season2025}
            season2026={statsData.season2026}
          />
        </div>
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
