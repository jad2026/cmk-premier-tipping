import type { Team } from "@/lib/supabase/types";

/* ── Data interfaces (Opta feed will populate these later) ──────── */

export type MatchStats = {
  possession: number;
  territory: number;
  carries: number;
  metresGained: number;
  passes: number;
  tacklesMade: number;
  missedTackles: number;
  scrumsWon: number;
  lineoutsWon: number;
  penaltiesConceded: number;
  turnoversWon: number;
};

export type PlayerMatchStats = {
  playerId: string;
  name: string;
  jerseyNumber: number;
  positionGroup: "Front Row" | "Second Row" | "Back Row" | "Halfbacks" | "Midfield" | "Outside Backs";
  tries: number;
  carries: number;
  metres: number;
  tackles: number;
  missedTackles: number;
};

export type MatchEventType = "try" | "conversion" | "penalty" | "drop_goal" | "yellow_card" | "red_card" | "substitution";

export type MatchEvent = {
  id: string;
  minute: number;
  type: MatchEventType;
  playerName: string;
  teamId: string;
  scoreAtTime?: string;
};

export type MatchPhase = "first_half" | "half_time" | "second_half";

export type MatchStatus =
  | { type: "pre"; kickoff: string }
  | { type: "live"; minute: number; phase?: MatchPhase }
  | { type: "fulltime" };

export type CommentaryEntry = {
  minute: number | null;
  period: string | null;
  text: string;
  type: string | null;
};

export type MatchFixture = {
  id: string;
  homeTeam: Pick<Team, "id" | "name" | "short_name" | "colour" | "logo_url">;
  awayTeam: Pick<Team, "id" | "name" | "short_name" | "colour" | "logo_url">;
  homeScore: number;
  awayScore: number;
  venue: string | null;
  status: MatchStatus;
  homeStats: MatchStats;
  awayStats: MatchStats;
  homePlayers: PlayerMatchStats[];
  awayPlayers: PlayerMatchStats[];
  events: MatchEvent[];
  commentary: CommentaryEntry[];
};

/* ── Empty placeholder builders ─────────────────────────────────── */

function emptyStats(): MatchStats {
  return {
    possession: 0, territory: 0, carries: 0, metresGained: 0,
    passes: 0, tacklesMade: 0, missedTackles: 0, scrumsWon: 0,
    lineoutsWon: 0, penaltiesConceded: 0, turnoversWon: 0,
  };
}

function placeholderPlayers(teamShort: string): PlayerMatchStats[] {
  const template: { group: PlayerMatchStats["positionGroup"]; count: number; start: number }[] = [
    { group: "Front Row", count: 3, start: 1 },
    { group: "Second Row", count: 2, start: 4 },
    { group: "Back Row", count: 3, start: 6 },
    { group: "Halfbacks", count: 2, start: 9 },
    { group: "Midfield", count: 2, start: 12 },
    { group: "Outside Backs", count: 3, start: 13 },
  ];
  return template.flatMap(({ group, count, start }) =>
    Array.from({ length: count }, (_, i) => ({
      playerId: `${teamShort}-${start + i}`,
      name: `Player ${start + i}`,
      jerseyNumber: start + i,
      positionGroup: group,
      tries: 0, carries: 0, metres: 0, tackles: 0, missedTackles: 0,
    }))
  );
}

export function buildPlaceholderFixture(
  fixtureId: string,
  homeTeam: Team,
  awayTeam: Team,
  venue: string | null,
  kickoff: string,
): MatchFixture {
  return {
    id: fixtureId,
    homeTeam: { id: homeTeam.id, name: homeTeam.name, short_name: homeTeam.short_name, colour: homeTeam.colour, logo_url: homeTeam.logo_url },
    awayTeam: { id: awayTeam.id, name: awayTeam.name, short_name: awayTeam.short_name, colour: awayTeam.colour, logo_url: awayTeam.logo_url },
    homeScore: 0,
    awayScore: 0,
    venue,
    status: { type: "pre", kickoff },
    homeStats: emptyStats(),
    awayStats: emptyStats(),
    homePlayers: placeholderPlayers(homeTeam.short_name),
    awayPlayers: placeholderPlayers(awayTeam.short_name),
    events: [],
    commentary: [],
  };
}
