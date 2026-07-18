import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCompetitionTimezone } from "@/lib/competition";
import type { MatchFixture, MatchStats, MatchEvent, MatchEventType, PlayerMatchStats, CommentaryEntry } from "@/app/stats/matchCentreTypes";

const NPC_2025_COMPETITION_ID = "aa056357-840d-41be-b311-afd2298d42ad";
const GATED_USER_ID = "9f509fc4-1eff-4670-8b3f-b03d4315ad35";

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function emptyStats(): MatchStats {
  return {
    possession: 0, territory: 0, carries: 0, metresGained: 0,
    passes: 0, tacklesMade: 0, missedTackles: 0, scrumsWon: 0,
    lineoutsWon: 0, penaltiesConceded: 0, turnoversWon: 0,
  };
}

function mapTeamStats(stats: Record<string, string> | null): MatchStats {
  if (!stats) return emptyStats();
  return {
    possession: num(stats.ball_possession ?? stats.possession),
    territory: num(stats.territory),
    carries: num(stats.runs ?? stats.carries),
    metresGained: num(stats.carries_metres ?? stats.metres_gained),
    passes: num(stats.passes),
    tacklesMade: num(stats.tackles ?? stats.tackles_made),
    missedTackles: num(stats.missed_tackles),
    scrumsWon: num(stats.scrums_won_outright ?? stats.scrums_won),
    lineoutsWon: num(stats.lineouts_won),
    penaltiesConceded: num(stats.penalties_conceded),
    turnoversWon: num(stats.turnovers_conceded ?? stats.turnovers_won),
  };
}

const OPTA_EVENT_MAP: Record<string, MatchEventType> = {
  TRY: "try", "Penalty Try": "try",
  CONVERSION: "conversion", CONV: "conversion",
  "PENALTY GOAL": "penalty", "Penalty Goal": "penalty", PENK: "penalty",
  "DROP GOAL": "drop_goal", "Drop Goal": "drop_goal", DROPG: "drop_goal",
  "YELLOW CARD": "yellow_card", "Yellow Card": "yellow_card", YELC: "yellow_card",
  "RED CARD": "red_card", "Red Card": "red_card",
  SUB: "substitution", Substitution: "substitution", SUB_ON: "substitution", SUB_OFF: "substitution",
};

function positionGroup(positionId: number | null, shirtNumber: number | null): PlayerMatchStats["positionGroup"] {
  const n = shirtNumber ?? 0;
  if (positionId != null) {
    if (positionId >= 1 && positionId <= 3) return "Front Row";
    if (positionId >= 4 && positionId <= 5) return "Second Row";
    if (positionId >= 6 && positionId <= 8) return "Back Row";
    if (positionId >= 9 && positionId <= 10) return "Halfbacks";
    if (positionId >= 12 && positionId <= 13) return "Midfield";
    if (positionId === 11 || positionId === 14 || positionId === 15) return "Outside Backs";
  }
  if (n >= 1 && n <= 3) return "Front Row";
  if (n >= 4 && n <= 5) return "Second Row";
  if (n >= 6 && n <= 8) return "Back Row";
  if (n === 9 || n === 10) return "Halfbacks";
  if (n === 12 || n === 13) return "Midfield";
  if (n === 11 || n === 14 || n === 15) return "Outside Backs";
  return "Back Row";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== GATED_USER_ID) {
    return NextResponse.json({ rounds: [] }, { status: 403 });
  }

  const tz = await getCompetitionTimezone(NPC_2025_COMPETITION_ID);

  const { data: gw2025 } = await supabase
    .from("gameweeks")
    .select("id, number, label")
    .eq("competition_id", NPC_2025_COMPETITION_ID)
    .order("number", { ascending: true });

  if (!gw2025?.length) {
    return NextResponse.json({ rounds: [] });
  }

  const gwIds = gw2025.map((gw) => gw.id);
  const { data: allFixtures } = await supabase
    .from("fixtures")
    .select("*, home_team:teams!fixtures_home_team_id_fkey(id, name, short_name, colour, logo_url), away_team:teams!fixtures_away_team_id_fkey(id, name, short_name, colour, logo_url)")
    .in("gameweek_id", gwIds)
    .order("match_date", { ascending: true });

  if (!allFixtures?.length) {
    return NextResponse.json({ rounds: [] });
  }

  // Collect all opta_fixture_ids for batch querying
  const optaGameIds: string[] = [];
  const fixtureOptaMap = new Map<string, string>(); // fixture.id -> opta_fixture_id
  for (const f of allFixtures) {
    const optaId = (f as Record<string, unknown>).opta_fixture_id as string | null;
    if (optaId) {
      optaGameIds.push(optaId);
      fixtureOptaMap.set(f.id, optaId);
    }
  }

  // Collect all team IDs for team mapping
  const allTeamIds = allFixtures.flatMap((f) => {
    const home = f.home_team as { id: string };
    const away = f.away_team as { id: string };
    return [home.id, away.id];
  });
  const uniqueTeamIds = Array.from(new Set(allTeamIds));

  // Batch fetch all opta data in parallel
  const [
    { data: teamMapping },
    { data: allTeamStats },
    { data: allMatchEvents },
    { data: allPlayerStats },
    { data: allCommentary },
  ] = await Promise.all([
    supabase.from("opta_team_mapping" as "fixtures").select("opta_team_id, team_id").in("team_id", uniqueTeamIds) as unknown as Promise<{ data: { opta_team_id: string; team_id: string }[] | null }>,
    optaGameIds.length > 0
      ? supabase.from("opta_team_stats").select("opta_game_id, opta_team_id, stats").in("opta_game_id", optaGameIds)
      : Promise.resolve({ data: [] as { opta_game_id: string; opta_team_id: string; stats: Record<string, string> }[] }),
    optaGameIds.length > 0
      ? supabase.from("opta_match_events").select("opta_game_id, event_id, event_type, minute, player_name, opta_team_id").in("opta_game_id", optaGameIds).order("minute", { ascending: true })
      : Promise.resolve({ data: [] as { opta_game_id: string; event_id: string; event_type: string; minute: number; player_name: string; opta_team_id: string }[] }),
    optaGameIds.length > 0
      ? supabase.from("opta_player_stats").select("opta_game_id, opta_player_id, opta_team_id, player_name, shirt_number, position_id, stats").in("opta_game_id", optaGameIds)
      : Promise.resolve({ data: [] as { opta_game_id: string; opta_player_id: string; opta_team_id: string; player_name: string; shirt_number: number; position_id: number; stats: Record<string, string> }[] }),
    optaGameIds.length > 0
      ? supabase.from("opta_commentary").select("opta_game_id, minute, event_type, comment").in("opta_game_id", optaGameIds).order("minute", { ascending: false })
      : Promise.resolve({ data: [] as { opta_game_id: string; minute: number; event_type: string; comment: string }[] }),
  ]);

  // Build lookup: opta_team_id -> platform team_id
  const optaToTeamId = new Map<string, string>();
  for (const m of teamMapping ?? []) {
    optaToTeamId.set(String(m.opta_team_id), m.team_id);
  }

  // Index opta data by game ID
  const teamStatsByGame = new Map<string, typeof allTeamStats>();
  for (const ts of allTeamStats ?? []) {
    const list = teamStatsByGame.get(ts.opta_game_id) ?? [];
    list.push(ts);
    teamStatsByGame.set(ts.opta_game_id, list);
  }

  const eventsByGame = new Map<string, typeof allMatchEvents>();
  for (const ev of allMatchEvents ?? []) {
    const list = eventsByGame.get(ev.opta_game_id) ?? [];
    list.push(ev);
    eventsByGame.set(ev.opta_game_id, list);
  }

  const playerStatsByGame = new Map<string, typeof allPlayerStats>();
  for (const ps of allPlayerStats ?? []) {
    const list = playerStatsByGame.get(ps.opta_game_id) ?? [];
    list.push(ps);
    playerStatsByGame.set(ps.opta_game_id, list);
  }

  const commentaryByGame = new Map<string, typeof allCommentary>();
  for (const c of allCommentary ?? []) {
    const list = commentaryByGame.get(c.opta_game_id) ?? [];
    list.push(c);
    commentaryByGame.set(c.opta_game_id, list);
  }

  type FixtureRow = typeof allFixtures[number];
  const fixturesByGw = new Map<string, FixtureRow[]>();
  for (const f of allFixtures) {
    const list = fixturesByGw.get(f.gameweek_id) ?? [];
    list.push(f);
    fixturesByGw.set(f.gameweek_id, list);
  }

  const rounds = gw2025.map((gw) => {
    const gwFixtures = fixturesByGw.get(gw.id) ?? [];
    const fixtures: MatchFixture[] = gwFixtures.map((f) => {
      const home = f.home_team as { id: string; name: string; short_name: string; colour: string; logo_url: string | null };
      const away = f.away_team as { id: string; name: string; short_name: string; colour: string; logo_url: string | null };
      const kickoffStr = new Date(f.match_date).toLocaleTimeString(tz.locale, { timeZone: tz.timezone, hour: "numeric", minute: "2-digit" });
      const hasResult = f.result_team_id != null || f.is_draw;
      const hasScores = f.home_score != null && f.away_score != null && (f.home_score! > 0 || f.away_score! > 0);

      const optaGameId = fixtureOptaMap.get(f.id);

      if (!optaGameId) {
        return {
          id: f.id,
          homeTeam: home,
          awayTeam: away,
          homeScore: f.home_score ?? 0,
          awayScore: f.away_score ?? 0,
          venue: f.venue,
          status: hasResult || hasScores
            ? { type: "fulltime" as const }
            : { type: "pre" as const, kickoff: kickoffStr },
          homeStats: emptyStats(),
          awayStats: emptyStats(),
          homePlayers: [],
          awayPlayers: [],
          events: [],
          commentary: [],
        };
      }

      // Build team stats
      let homeStats = emptyStats();
      let awayStats = emptyStats();
      for (const ts of teamStatsByGame.get(optaGameId) ?? []) {
        const platformTeamId = optaToTeamId.get(String(ts.opta_team_id));
        if (platformTeamId === home.id) {
          homeStats = mapTeamStats(ts.stats as Record<string, string> | null);
        } else if (platformTeamId === away.id) {
          awayStats = mapTeamStats(ts.stats as Record<string, string> | null);
        }
      }

      // Build events with running score
      const events: MatchEvent[] = [];
      let homeRunning = 0;
      let awayRunning = 0;
      for (const ev of eventsByGame.get(optaGameId) ?? []) {
        const eventType = OPTA_EVENT_MAP[ev.event_type ?? ""];
        if (!eventType) continue;
        const platformTeamId = optaToTeamId.get(String(ev.opta_team_id));
        if (!platformTeamId) continue;

        if (eventType === "try") {
          if (platformTeamId === home.id) homeRunning += 5; else awayRunning += 5;
        } else if (eventType === "conversion") {
          if (platformTeamId === home.id) homeRunning += 2; else awayRunning += 2;
        } else if (eventType === "penalty" || eventType === "drop_goal") {
          if (platformTeamId === home.id) homeRunning += 3; else awayRunning += 3;
        }

        events.push({
          id: ev.event_id,
          minute: ev.minute ?? 0,
          type: eventType,
          playerName: ev.player_name ?? "Unknown",
          teamId: platformTeamId,
          scoreAtTime: `${homeRunning} - ${awayRunning}`,
        });
      }

      // Build players
      const buildPlayers = (teamId: string): PlayerMatchStats[] => {
        const rows = (playerStatsByGame.get(optaGameId) ?? []).filter(
          (p) => optaToTeamId.get(String(p.opta_team_id)) === teamId,
        );
        return rows.map((p) => {
          const s = (p.stats ?? {}) as Record<string, string>;
          return {
            playerId: String(p.opta_player_id),
            name: p.player_name ?? "Unknown",
            jerseyNumber: p.shirt_number ?? 0,
            positionGroup: positionGroup(p.position_id as number | null, p.shirt_number as number | null),
            tries: num(s.Tries ?? s.tries),
            carries: num(s.Runs ?? s.runs ?? s.Carries ?? s.carries),
            metres: num(s.MetresRun ?? s.metres_run ?? s.Metres ?? s.metres),
            tackles: num(s.Tackles ?? s.tackles ?? s.TacklesMade ?? s.tackles_made),
            missedTackles: num(s.MissedTackles ?? s.missed_tackles),
          };
        });
      };

      // Build commentary
      const commentary: CommentaryEntry[] = (commentaryByGame.get(optaGameId) ?? [])
        .filter((r) => r.comment)
        .map((r) => ({
          minute: r.minute ?? null,
          period: null,
          text: r.comment as string,
          type: r.event_type ?? null,
        }));

      return {
        id: f.id,
        homeTeam: home,
        awayTeam: away,
        homeScore: f.home_score ?? 0,
        awayScore: f.away_score ?? 0,
        venue: f.venue,
        status: hasResult || hasScores
          ? { type: "fulltime" as const }
          : { type: "pre" as const, kickoff: kickoffStr },
        homeStats,
        awayStats,
        homePlayers: buildPlayers(home.id),
        awayPlayers: buildPlayers(away.id),
        events,
        commentary,
      };
    });
    return { number: gw.number as number, label: gw.label as string, fixtures };
  });

  return NextResponse.json({ rounds }, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
