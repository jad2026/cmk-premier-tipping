import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { MatchFixture, MatchStats, MatchEvent, MatchEventType, PlayerMatchStats } from "@/app/stats/matchCentreTypes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function mapTeamStats(stats: Record<string, string> | null): MatchStats {
  if (!stats) {
    return {
      possession: 0, territory: 0, carries: 0, metresGained: 0,
      passes: 0, tacklesMade: 0, missedTackles: 0, scrumsWon: 0,
      lineoutsWon: 0, penaltiesConceded: 0, turnoversWon: 0,
    };
  }
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
  TRY: "try",
  "Penalty Try": "try",
  CONVERSION: "conversion",
  "PENALTY GOAL": "penalty",
  "Penalty Goal": "penalty",
  "DROP GOAL": "drop_goal",
  "Drop Goal": "drop_goal",
  "YELLOW CARD": "yellow_card",
  "Yellow Card": "yellow_card",
  "RED CARD": "red_card",
  "Red Card": "red_card",
  SUB: "substitution",
  Substitution: "substitution",
  CONV: "conversion",
  PENK: "penalty",
  YELC: "yellow_card",
  DROPG: "drop_goal",
  SUB_ON: "substitution",
  SUB_OFF: "substitution",
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;

  const { data: fixture } = await supabase
    .from("fixtures")
    .select("*, home_team:teams!fixtures_home_team_id_fkey(id, name, short_name, colour, logo_url), away_team:teams!fixtures_away_team_id_fkey(id, name, short_name, colour, logo_url)")
    .eq("id", fixtureId)
    .single();

  if (!fixture) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const optaGameId = (fixture as Record<string, unknown>).opta_fixture_id as string | null;

  if (!optaGameId) {
    return NextResponse.json({ error: "No Opta data linked" }, { status: 404 });
  }

  const homeTeam = fixture.home_team as { id: string; name: string; short_name: string; colour: string; logo_url: string | null };
  const awayTeam = fixture.away_team as { id: string; name: string; short_name: string; colour: string; logo_url: string | null };

  const { data: teamMapping } = await supabase
    .from("opta_team_mapping")
    .select("opta_team_id, team_id")
    .in("team_id", [homeTeam.id, awayTeam.id]);

  const optaToTeamId = new Map<string, string>();
  for (const m of teamMapping ?? []) {
    optaToTeamId.set(String(m.opta_team_id), m.team_id);
  }

  const [
    { data: teamStats },
    { data: matchEvents },
    { data: playerStats },
  ] = await Promise.all([
    supabase
      .from("opta_team_stats")
      .select("opta_team_id, stats")
      .eq("opta_game_id", optaGameId),
    supabase
      .from("opta_match_events")
      .select("event_id, event_type, minute, player_name, opta_team_id")
      .eq("opta_game_id", optaGameId)
      .order("minute", { ascending: true }),
    supabase
      .from("opta_player_stats")
      .select("opta_player_id, opta_team_id, player_name, shirt_number, position_id, stats")
      .eq("opta_game_id", optaGameId),
  ]);

  let homeStats = mapTeamStats(null);
  let awayStats = mapTeamStats(null);

  for (const ts of teamStats ?? []) {
    const platformTeamId = optaToTeamId.get(String(ts.opta_team_id));
    if (platformTeamId === homeTeam.id) {
      homeStats = mapTeamStats(ts.stats as Record<string, string> | null);
    } else if (platformTeamId === awayTeam.id) {
      awayStats = mapTeamStats(ts.stats as Record<string, string> | null);
    }
  }

  const events: MatchEvent[] = [];
  let homeRunning = 0;
  let awayRunning = 0;

  for (const ev of matchEvents ?? []) {
    const eventType = OPTA_EVENT_MAP[ev.event_type ?? ""];
    if (!eventType) continue;

    const platformTeamId = optaToTeamId.get(String(ev.opta_team_id));
    if (!platformTeamId) continue;

    if (eventType === "try") {
      if (platformTeamId === homeTeam.id) homeRunning += 5;
      else awayRunning += 5;
    } else if (eventType === "conversion") {
      if (platformTeamId === homeTeam.id) homeRunning += 2;
      else awayRunning += 2;
    } else if (eventType === "penalty" || eventType === "drop_goal") {
      if (platformTeamId === homeTeam.id) homeRunning += 3;
      else awayRunning += 3;
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

  const buildPlayers = (teamId: string): PlayerMatchStats[] => {
    const rows = (playerStats ?? []).filter(
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

  const hasScores = fixture.home_score != null && fixture.away_score != null;
  const matchDate = new Date(fixture.match_date);
  const now = new Date();
  const kickedOff = now >= matchDate;

  const hasResult = fixture.result_team_id != null || fixture.is_draw;
  let status: MatchFixture["status"];
  if (hasResult || (hasScores && (fixture.home_score! > 0 || fixture.away_score! > 0))) {
    status = { type: "fulltime" };
  } else if (kickedOff && (teamStats?.length ?? 0) > 0) {
    const maxMinute = Math.max(0, ...events.map((e) => e.minute));
    status = { type: "live", minute: maxMinute };
  } else {
    status = {
      type: "pre",
      kickoff: matchDate.toLocaleTimeString("en-NZ", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  }

  const result: MatchFixture = {
    id: fixture.id,
    homeTeam: homeTeam,
    awayTeam: awayTeam,
    homeScore: fixture.home_score ?? 0,
    awayScore: fixture.away_score ?? 0,
    venue: fixture.venue,
    status,
    homeStats,
    awayStats,
    homePlayers: buildPlayers(homeTeam.id),
    awayPlayers: buildPlayers(awayTeam.id),
    events,
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
  });
}
