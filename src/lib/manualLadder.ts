// Parsing for competitions whose league table and results are pasted in by an
// admin (competitions.ladder_source = 'manual'). Shared by the admin preview
// (client) and the save actions (server), so both see the same result.

// ladder_standings.comp_id key for a manual competition. Feed competitions use
// their Xplorer/Opta ids, so this can't collide with them.
export function manualLadderKey(competitionId: string): string {
  return `manual:${competitionId}`;
}

export type ParseIssue = { line: number; text: string; message: string };

export type ParsedLadderRow = {
  position: number;
  team_name: string;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  points_for: number;
  points_against: number;
  points_diff: number;
  bonus_points: number;
  match_points: number;
};

export type ParsedResult = {
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
};

const INT = /^[+\-−]?\d+$/;
const toInt = (s: string) => parseInt(s.replace("−", "-"), 10);
const HEADER_WORD = /\b(pos|position|team|club|played|pts|points)\b/i;
// Column headings on their own (the England Rugby table can paste them one per line).
const HEADER_TOKENS = new Set([
  "#", "pos", "position", "team", "club", "p", "pl", "played", "w", "won", "d", "drawn", "l", "lost",
  "pf", "pa", "f", "a", "+/-", "pd", "diff", "tb", "lb", "bp", "b", "pts", "points", "logo", "form",
]);
const isHeaderLine = (text: string) => text.split(/\s+/).every((t) => HEADER_TOKENS.has(t.toLowerCase()));

// ladder_standings.team_id (TEXT) for manual rows: a stable slug of the team
// name, e.g. "Malton & Norton" -> "manual-malton-norton".
export function manualTeamId(teamName: string): string {
  const slug = teamName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `manual-${slug}`;
}

/**
 * Parses a league table copied from the England Rugby site:
 *   Pos  Team  P  W  D  L  PF  PA  PD  [bonus columns…]  Pts
 * Columns may be separated by tabs or runs of spaces, team names may contain
 * spaces, header rows are skipped, and a row split over several lines (e.g.
 * position / team / numbers) is joined back together.
 *
 * The England Rugby site pastes each team over 4 lines: position, a "logo"
 * line (skipped), the team name, then the tab-separated numbers
 *   P  W  D  L  PF  PA  +/-  TB  LB  Pts
 * where bonus points = TB + LB.
 */
export function parseLeagueTable(input: string): { rows: ParsedLadderRow[]; errors: ParseIssue[] } {
  const rows: ParsedLadderRow[] = [];
  const errors: ParseIssue[] = [];
  let pending: { tokens: string[]; line: number; text: string[] } | null = null;

  const flushPending = (message: string) => {
    if (pending) errors.push({ line: pending.line, text: pending.text.join(" / "), message });
    pending = null;
  };

  input.split(/\r?\n/).forEach((raw, idx) => {
    const text = raw.trim();
    if (!text) return;
    if (/^(.*\s)?logo$/i.test(text)) return; // crest image alt text from the England Rugby table
    if (isHeaderLine(text)) return; // "#", "TEAM", "P" … "Pts", whether on one line or one per line
    if (!/\d/.test(text) && HEADER_WORD.test(text) && !pending) return; // other header rows

    const tokens: string[] = pending ? [...pending.tokens, ...text.split(/\s+/)] : text.split(/\s+/);
    const line: number = pending ? pending.line : idx + 1;
    const lineText: string[] = pending ? [...pending.text, text] : [text];

    // Drop a trailing "form" column such as "WWLDW".
    while (tokens.length > 1 && /^[WDL]+$/i.test(tokens[tokens.length - 1]) && INT.test(tokens[tokens.length - 2])) {
      tokens.pop();
    }

    let k = 0;
    while (k < tokens.length && INT.test(tokens[tokens.length - 1 - k])) k++;

    if (k < 8) {
      // Probably a row split across lines; wait for the rest (max 3 lines).
      if (lineText.length >= 3) {
        pending = { tokens, line, text: lineText };
        flushPending("Couldn't find the P W D L PF PA … Pts numbers for this row");
      } else {
        pending = { tokens, line, text: lineText };
      }
      return;
    }
    pending = null;

    // When the numbers arrived on their own line after the name, take exactly
    // that line's numbers, so a name ending in a digit ("Hull 2") stays intact.
    const ownLine = text.split(/\s+/);
    const numbersOnOwnLine = lineText.length > 1 && ownLine.every((t) => INT.test(t)) && ownLine.length >= 8;
    const numCount = numbersOnOwnLine ? ownLine.length : k;
    const nums = tokens.slice(tokens.length - numCount).map(toInt);
    const prefix = tokens.slice(0, tokens.length - numCount);
    let position: number | null = null;
    if (prefix.length > 0 && /^=?\d+(st|nd|rd|th)?\.?$/i.test(prefix[0])) {
      position = parseInt(prefix[0].replace(/\D/g, ""), 10);
      prefix.shift();
    }
    const teamName = prefix.join(" ").trim();
    if (!teamName) {
      errors.push({ line, text: lineText.join(" / "), message: "Missing team name" });
      return;
    }

    const [p, w, d, l, pf, pa] = nums;
    const rest = nums.slice(6);
    const pts = rest[rest.length - 1];
    const middle = rest.slice(0, -1);
    let pd = pf - pa;
    let bonusCols = middle;
    if (nums.length === 10) {
      // England Rugby layout: P W D L PF PA +/- TB LB Pts.
      pd = middle[0];
      bonusCols = middle.slice(1);
    } else if (middle.length > 0 && middle[0] === pf - pa) {
      // Other layouts: PD is present when the first middle column equals PF − PA.
      pd = middle[0];
      bonusCols = middle.slice(1);
    }

    rows.push({
      position: position ?? rows.length + 1,
      team_name: teamName,
      matches_played: p,
      matches_won: w,
      matches_drawn: d,
      matches_lost: l,
      points_for: pf,
      points_against: pa,
      points_diff: pd,
      bonus_points: bonusCols.reduce((a, b) => a + b, 0),
      match_points: pts,
    });
  });
  flushPending("Couldn't find the P W D L PF PA … Pts numbers for this row");

  // team_id must be unique per competition, so names that slug the same clash.
  const seen = new Set<string>();
  for (const r of rows) {
    const key = manualTeamId(r.team_name);
    if (seen.has(key)) errors.push({ line: 0, text: r.team_name, message: "Team appears more than once" });
    seen.add(key);
  }

  return { rows, errors };
}

const RESULT_LINE = /^(.+?)\s+(\d{1,3})\s*[-–—:]\s*(\d{1,3})\s+(.+)$/;

/** Parses lines like "Home Team 47 - 31 Away Team" (also "47-31"). */
export function parseLeagueResults(input: string): { results: ParsedResult[]; errors: ParseIssue[] } {
  const results: ParsedResult[] = [];
  const errors: ParseIssue[] = [];

  input.split(/\r?\n/).forEach((raw, idx) => {
    const text = raw.trim();
    if (!text) return;
    const m = text.match(RESULT_LINE);
    if (!m) {
      errors.push({ line: idx + 1, text, message: 'Expected "Home Team 47 - 31 Away Team"' });
      return;
    }
    const home = m[1].trim();
    const away = m[4].trim();
    if (home.toLowerCase() === away.toLowerCase()) {
      errors.push({ line: idx + 1, text, message: "Home and away teams are the same" });
      return;
    }
    results.push({ home_team: home, away_team: away, home_score: toInt(m[2]), away_score: toInt(m[3]) });
  });

  return { results, errors };
}
