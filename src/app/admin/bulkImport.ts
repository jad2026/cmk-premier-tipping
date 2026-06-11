/**
 * Parses pasted bulk-fixture text and resolves team names against the known
 * teams list using fuzzy matching.
 *
 * Supported input formats
 * ───────────────────────
 * New (grouped) format — round header followed by fixture lines:
 *
 *   Round 1
 *   Coastal RFC vs Hawera RFC, 2026-07-11, Yarrow Stadium
 *   Inglewood RFC vs Marist RFC, 2026-07-11
 *
 *   [Round 2]
 *   Hawera RFC vs Inglewood RFC, 2026-07-18
 *
 * Legacy (flat) format — still accepted for backwards compatibility:
 *
 *   1, Coastal RFC, Hawera RFC, 2026-07-11, Yarrow Stadium
 *
 * Both formats can be mixed freely in the same paste.
 */

import { bestMatch } from "@/lib/fuzzyMatch";
import type { Team } from "@/lib/supabase/types";

// ─── Public types ────────────────────────────────────────────────────────────

export type RowStatus = "ok" | "warning" | "error";

export type PreviewRow = {
  /** 0-based index of the source line */
  lineIndex: number;
  /** Raw text of this line */
  raw: string;

  round: number | null;
  matchDate: string | null; // YYYY-MM-DD
  venue: string | null;

  homeRaw: string;
  awayRaw: string;

  homeTeam: Team | null;
  homeScore: number;
  homeStatus: RowStatus;

  awayTeam: Team | null;
  awayScore: number;
  awayStatus: RowStatus;

  /** Overall row status — worst of home/away + parse errors */
  status: RowStatus;
  /** Human-readable warning / error message */
  message: string | null;
};

export type PreviewGroup = {
  round: number;
  /** Display label derived from the header line, e.g. "Round 1" */
  label: string;
  rows: PreviewRow[];
};

// ─── Internals ───────────────────────────────────────────────────────────────

/**
 * Matches round header lines:
 *   Round 1         Round 1:        [Round 1]       [Round 1:]
 *   ROUND 2         round 3 — Derby
 * Capture group 1 = round number, group 2 = optional trailing label text.
 *
 * `[\]:]*` consumes any combination of `]` and `:` after the number so that
 * both `[Round 1]` and `[Round 2:]` (colon before closing bracket) work.
 */
const ROUND_HEADER_RE = /^\[?round\s+(\d+)[\]:]*\s*(.*)?$/i;

/**
 * Matches the YYYY-MM-DD date pattern inside a comma-separated list.
 * Used to anchor the split between away-team name and date.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function teamRowStatus(tier: string): RowStatus {
  if (tier === "exact") return "ok";
  if (tier === "fuzzy") return "warning";
  return "error";
}

/**
 * Parse the new `Home vs Away, Date[, Venue]` fixture line format.
 * Returns null if the line doesn't contain " vs ".
 */
function parseVsLine(line: string): {
  homeRaw: string;
  awayRaw: string;
  dateRaw: string;
  venue: string | null;
} | null {
  const vsIdx = line.toLowerCase().indexOf(" vs ");
  if (vsIdx === -1) return null;

  const homeRaw = line.slice(0, vsIdx).trim();
  const rest = line.slice(vsIdx + 4); // everything after " vs "

  // Split the remainder by commas and find the date field
  const parts = rest.split(",").map((p) => p.trim());
  const dateIdx = parts.findIndex((p) => DATE_RE.test(p));
  if (dateIdx === -1) {
    // No valid date — return a partial result so we can emit a useful error
    return { homeRaw, awayRaw: parts[0] ?? "", dateRaw: "", venue: null };
  }

  const awayRaw = parts.slice(0, dateIdx).join(",").trim();
  const dateRaw = parts[dateIdx];
  const venue = parts.slice(dateIdx + 1).join(",").trim() || null;

  return { homeRaw, awayRaw, dateRaw, venue };
}

/**
 * Parse the legacy `Round, Home, Away, Date[, Venue]` flat format.
 * Returns null if the line doesn't have ≥4 comma-separated fields with a
 * numeric first field.
 */
function parseLegacyLine(line: string): {
  round: number;
  homeRaw: string;
  awayRaw: string;
  dateRaw: string;
  venue: string | null;
} | null {
  const parts = line.split(",").map((p) => p.trim());
  if (parts.length < 4) return null;
  const round = parseInt(parts[0], 10);
  if (isNaN(round) || round <= 0) return null;
  const [, homeRaw, awayRaw, dateRaw, ...venueParts] = parts;
  return {
    round,
    homeRaw,
    awayRaw,
    dateRaw,
    venue: venueParts.join(",").trim() || null,
  };
}

// ─── Main parse function ─────────────────────────────────────────────────────

export function parseAndMatch(raw: string, teams: Team[]): PreviewRow[] {
  const lines = raw.split("\n");
  const rows: PreviewRow[] = [];
  let currentRound: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip blank lines and comment lines
    if (!line || line.startsWith("#")) continue;

    // ── Round header? ────────────────────────────────────────────────────────
    const headerMatch = ROUND_HEADER_RE.exec(line);
    if (headerMatch) {
      currentRound = parseInt(headerMatch[1], 10);
      continue; // header lines don't produce fixture rows
    }

    // ── Try new "vs" format first, then legacy CSV format ────────────────────
    let homeRaw = "";
    let awayRaw = "";
    let dateRaw = "";
    let venue: string | null = null;
    let round: number | null = currentRound;
    let parseError: string | null = null;

    const vsResult = parseVsLine(line);
    if (vsResult) {
      homeRaw = vsResult.homeRaw;
      awayRaw = vsResult.awayRaw;
      dateRaw = vsResult.dateRaw;
      venue = vsResult.venue;
      if (round === null) {
        parseError = "No round header found before this fixture line.";
      }
    } else {
      const legacyResult = parseLegacyLine(line);
      if (legacyResult) {
        homeRaw = legacyResult.homeRaw;
        awayRaw = legacyResult.awayRaw;
        dateRaw = legacyResult.dateRaw;
        venue = legacyResult.venue;
        round = legacyResult.round; // legacy line carries its own round
      } else {
        // Unrecognisable line
        rows.push({
          lineIndex: i,
          raw: line,
          round: null,
          matchDate: null,
          venue: null,
          homeRaw: "",
          awayRaw: "",
          homeTeam: null,
          homeScore: 0,
          homeStatus: "error",
          awayTeam: null,
          awayScore: 0,
          awayStatus: "error",
          status: "error",
          message: `Line ${i + 1}: unrecognised format. Use "Home vs Away, YYYY-MM-DD" or the legacy "Round, Home, Away, Date" format.`,
        });
        continue;
      }
    }

    // ── Validate date ────────────────────────────────────────────────────────
    const matchDate = DATE_RE.test(dateRaw) ? dateRaw : null;

    // ── Fuzzy-match teams ─────────────────────────────────────────────────────
    const homeResult = bestMatch(homeRaw, teams, (t) => t.name);
    const awayResult = bestMatch(awayRaw, teams, (t) => t.name);

    const homeStatus: RowStatus = homeResult
      ? teamRowStatus(homeResult.tier)
      : "error";
    const awayStatus: RowStatus = awayResult
      ? teamRowStatus(awayResult.tier)
      : "error";

    // ── Collect messages ──────────────────────────────────────────────────────
    const messages: string[] = [];
    if (parseError) messages.push(parseError);
    if (!matchDate) {
      messages.push(
        dateRaw
          ? `Unrecognised date "${dateRaw}" (use YYYY-MM-DD)`
          : "Missing date (use YYYY-MM-DD)"
      );
    }
    if (homeStatus === "error")
      messages.push(`No match for home team "${homeRaw}"`);
    else if (homeStatus === "warning")
      messages.push(
        `"${homeRaw}" fuzzy-matched to "${homeResult!.candidate.name}"`
      );
    if (awayStatus === "error")
      messages.push(`No match for away team "${awayRaw}"`);
    else if (awayStatus === "warning")
      messages.push(
        `"${awayRaw}" fuzzy-matched to "${awayResult!.candidate.name}"`
      );
    if (
      homeResult?.tier !== "none" &&
      awayResult?.tier !== "none" &&
      homeResult?.candidate.id === awayResult?.candidate.id
    ) {
      messages.push("Home and away resolved to the same team");
    }

    const worstStatus: RowStatus =
      homeStatus === "error" ||
      awayStatus === "error" ||
      !round ||
      !matchDate
        ? "error"
        : homeStatus === "warning" || awayStatus === "warning"
        ? "warning"
        : "ok";

    rows.push({
      lineIndex: i,
      raw: line,
      round,
      matchDate,
      venue,
      homeRaw,
      awayRaw,
      homeTeam: homeResult?.candidate ?? null,
      homeScore: homeResult?.score ?? 0,
      homeStatus,
      awayTeam: awayResult?.candidate ?? null,
      awayScore: awayResult?.score ?? 0,
      awayStatus,
      status: worstStatus,
      message: messages.length > 0 ? messages.join(" · ") : null,
    });
  }

  return rows;
}

// ─── Grouping helper ─────────────────────────────────────────────────────────

/**
 * Groups a flat PreviewRow array by round number, sorted ascending.
 * Rows with round === null are placed in a synthetic "Unknown Round" group.
 */
export function groupByRound(rows: PreviewRow[]): PreviewGroup[] {
  const map = new Map<number, PreviewRow[]>();

  for (const row of rows) {
    const key = row.round ?? -1;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, groupRows]) => ({
      round,
      label: round === -1 ? "Unknown Round" : `Round ${round}`,
      rows: groupRows,
    }));
}
