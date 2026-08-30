import type { MatchStatus, MatchPhase } from "./matchCentreTypes";

/**
 * Opta reports match state in three places:
 *
 *   RU1/RU5 game @_status  "Fixture" | "First half" | "Half time" | "Second half" | "Result"
 *                          — the RU1 value is persisted as fixtures.opta_status
 *   opta_match_events      START / END rows carrying period "First Half" | "Second Half"
 *   opta_commentary        "Start Of First Half" … "End Of Second Half"
 *
 * opta_status is preferred when present; otherwise the phase is reconstructed
 * from the period markers, falling back to the result flags and kickoff time.
 */

export type Phase = "pre" | MatchPhase | "fulltime";

/** Ordering of phases — a match only ever moves forwards through these. */
const PHASE_ORDER: Phase[] = ["pre", "first_half", "half_time", "second_half", "fulltime"];

/** A match with no result and no period markers is assumed over this long after kickoff. */
export const LIVE_WINDOW_MS = 3.5 * 60 * 60 * 1000;

/** Maps any of Opta's spellings of a match state onto our phase vocabulary. */
export function normalisePhase(raw: string | null | undefined): Phase | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/[\s_-]+/g, " ");

  if (/^(pre|pre match|fixture|scheduled|upcoming)$/.test(s)) return "pre";
  if (/^(1h|first half|firsthalf|1st half)$/.test(s)) return "first_half";
  if (/^(ht|half time|halftime)$/.test(s)) return "half_time";
  if (/^(2h|second half|secondhalf|2nd half)$/.test(s)) return "second_half";
  if (/^(ft|full time|fulltime|result|finished|complete)$/.test(s)) return "fulltime";
  if (/^(live|playing|in progress)$/.test(s)) return "first_half";
  return null;
}

/**
 * Resolves the phase implied by a single period marker — either a commentary
 * entry ("End Of First Half") or an events START/END row plus its period.
 */
export function markerPhase(type: string | null | undefined, period?: string | null): Phase | null {
  const t = (type ?? "").trim().toLowerCase();
  if (!t) return null;

  if (/start of first half/.test(t)) return "first_half";
  if (/end of first half/.test(t)) return "half_time";
  if (/start of second half/.test(t)) return "second_half";
  if (/end of second half/.test(t)) return "fulltime";

  const p = normalisePhase(period);
  if (t === "start") {
    if (p === "first_half") return "first_half";
    if (p === "second_half") return "second_half";
  }
  if (t === "end") {
    if (p === "first_half") return "half_time";
    if (p === "second_half") return "fulltime";
  }
  return null;
}

/**
 * The furthest-along phase implied by a set of markers. Markers are ranked
 * rather than sorted by minute, because the end of the first half and the start
 * of the second share a minute.
 */
export function phaseFromMarkers(
  markers: { type?: string | null; period?: string | null }[],
): Phase | null {
  let best = -1;
  for (const m of markers) {
    const phase = markerPhase(m.type, m.period);
    if (!phase) continue;
    best = Math.max(best, PHASE_ORDER.indexOf(phase));
  }
  return best >= 0 ? PHASE_ORDER[best] : null;
}

type DeriveOptions = {
  /** result_team_id is set or is_draw — only written once Opta reports a Result. */
  hasResult: boolean;
  kickoff: Date;
  now: Date;
  /** Formatted kickoff time shown while the match is still upcoming. */
  kickoffLabel: string;
  /** Latest minute we have an event for, if any. */
  minute?: number;
  /** Period markers from opta_match_events / opta_commentary. */
  markers?: { type?: string | null; period?: string | null }[];
  /** A raw Opta status string, when one is available. */
  optaStatus?: string | null;
};

export function deriveMatchStatus({
  hasResult,
  kickoff,
  now,
  kickoffLabel,
  minute,
  markers,
  optaStatus,
}: DeriveOptions): MatchStatus {
  const fromStatus = normalisePhase(optaStatus);
  const fromMarkers = phaseFromMarkers(markers ?? []);

  // fixtures.opta_status is the authoritative field, so it is checked first.
  // The one exception: RU1 only ever reports "Fixture" or "Result", so it still
  // reads "Fixture" while a match is being played. Never let a status that lags
  // behind walk the match backwards past markers that prove play has started.
  let phase = fromStatus ?? fromMarkers;
  if (
    fromStatus &&
    fromMarkers &&
    PHASE_ORDER.indexOf(fromMarkers) > PHASE_ORDER.indexOf(fromStatus)
  ) {
    phase = fromMarkers;
  }

  if (hasResult || phase === "fulltime") return { type: "fulltime" };

  if (phase === "first_half" || phase === "half_time" || phase === "second_half") {
    return { type: "live", minute: minute ?? 0, phase };
  }

  const kickedOff = now.getTime() >= kickoff.getTime();
  if (!kickedOff || phase === "pre") return { type: "pre", kickoff: kickoffLabel };

  // Kicked off, no result and no markers: live for as long as a match could
  // plausibly still be running, otherwise treat it as done.
  if (now.getTime() - kickoff.getTime() <= LIVE_WINDOW_MS) {
    return { type: "live", minute: minute ?? 0 };
  }
  return { type: "fulltime" };
}

const PHASE_LABELS: Record<MatchPhase, string> = {
  first_half: "1ST HALF",
  half_time: "HALF TIME",
  second_half: "2ND HALF",
};

export function statusLabel(s: MatchStatus): string {
  if (s.type === "fulltime") return "FULL TIME";
  if (s.type === "pre") return s.kickoff ? `KO ${s.kickoff}` : "UPCOMING";

  const base = s.phase ? PHASE_LABELS[s.phase] : "LIVE";
  // No clock to show while the teams are off the field.
  if (s.phase === "half_time" || !s.minute) return base;
  return `${base} ${s.minute}'`;
}

/** Live states get the pulsing treatment; pre-match and full time stay static. */
export function isLiveStatus(s: MatchStatus): boolean {
  return s.type === "live";
}
