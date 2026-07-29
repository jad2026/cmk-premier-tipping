"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import TeamBadge from "@/components/TeamBadge";
import type { MatchStats, MatchStatus, MatchFixture, MatchEventType, PlayerMatchStats, CommentaryEntry } from "./matchCentreTypes";

const POLL_INTERVAL = 30_000;

/* ── Props ──────────────────────────────────────────────────────── */

type Props = {
  fixtures: MatchFixture[];
  round1Label: string | null;
  round1Date: string | null;
  disablePolling?: boolean;
};

/* ── Tab type ───────────────────────────────────────────────────── */
type Tab = "stats" | "players" | "events" | "commentary";

const EVENT_ICONS: Record<MatchEventType, string> = {
  try: "🏉", conversion: "🥅", penalty: "🏈", drop_goal: "🏈",
  yellow_card: "🟨", red_card: "🟥", substitution: "🔄",
};
const EVENT_LABELS: Record<MatchEventType, string> = {
  try: "Try", conversion: "Conversion", penalty: "Penalty Goal", drop_goal: "Drop Goal",
  yellow_card: "Yellow Card", red_card: "Red Card", substitution: "Substitution",
};

function countEvents(fixture: MatchFixture, type: MatchEventType): number {
  return fixture.events.filter((e) => e.type === type).length;
}

function hasRealPlayers(players: PlayerMatchStats[]): boolean {
  return players.length > 0 && players.some((p) => !/^Player \d+$/.test(p.name));
}

function hasDetailData(f: MatchFixture): boolean {
  return (
    f.events.length > 0 ||
    hasRealPlayers(f.homePlayers) ||
    Object.values(f.homeStats).some((v) => v > 0) ||
    Object.values(f.awayStats).some((v) => v > 0)
  );
}

/* ── Component ──────────────────────────────────────────────────── */

export default function MatchCentre({ fixtures: initialFixtures, round1Label, round1Date, disablePolling }: Props) {
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [expanded, setExpanded] = useState(false);
  const [activeFixtureIdx, setActiveFixtureIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const [fetchCache, setFetchCache] = useState<Record<string, MatchFixture>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setFixtures(initialFixtures);
    setActiveFixtureIdx(0);
    setFetchCache({});
    setLoadingId(null);
  }, [initialFixtures]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const baseFixture = fixtures[activeFixtureIdx] ?? null;
  const fixture = baseFixture
    ? fetchCache[baseFixture.id] ?? baseFixture
    : null;

  const hasLiveOrFinished = fixtures.some(
    (f) => f.status.type === "live" || f.status.type === "fulltime",
  );
  const allPre = fixtures.every((f) => f.status.type === "pre");

  const fetchFixtureDetail = useCallback(async (fixtureId: string) => {
    if (fetchCache[fixtureId] || loadingId === fixtureId) return;
    setLoadingId(fixtureId);
    try {
      const res = await fetch(`/api/match-centre/${fixtureId}?_t=${Date.now()}`);
      if (res.ok) {
        const data = (await res.json()) as MatchFixture;
        setFetchCache((prev) => ({ ...prev, [fixtureId]: data }));
      }
    } finally {
      setLoadingId((prev) => (prev === fixtureId ? null : prev));
    }
  }, [fetchCache, loadingId]);

  // On-demand fetch: when expanded and active fixture lacks detail data, fetch it
  useEffect(() => {
    if (!expanded || !baseFixture) return;
    if (hasDetailData(fetchCache[baseFixture.id] ?? baseFixture)) return;
    fetchFixtureDetail(baseFixture.id);
  }, [expanded, baseFixture, fetchCache, fetchFixtureDetail]);

  // Polling: only when expanded, not disabled, and not all pre-match
  const pollFixtures = useCallback(async () => {
    const updated = await Promise.all(
      fixtures.map(async (f) => {
        try {
          const res = await fetch(`/api/match-centre/${f.id}?_t=${Date.now()}`);
          if (!res.ok) return f;
          return (await res.json()) as MatchFixture;
        } catch {
          return f;
        }
      }),
    );
    setFixtures(updated);
  }, [fixtures]);

  const shouldPoll = expanded && !allPre && !disablePolling;
  useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(pollFixtures, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [shouldPoll, pollFixtures]);

  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContentHeight(entry.contentRect.height);
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [expanded, activeTab, activeFixtureIdx]);

  if (!fixture) return null;

  const isFixtureLoading = loadingId === fixture.id;
  const fixtureHasDetail = hasDetailData(fixture);

  const hasRealData =
    fixture.events.length > 0 ||
    fixture.homeScore > 0 ||
    fixture.awayScore > 0 ||
    hasRealPlayers(fixture.homePlayers) ||
    Object.values(fixture.homeStats).some((v) => v > 0) ||
    Object.values(fixture.awayStats).some((v) => v > 0);
  const isPlaceholder = !hasRealData;

  const STAT_ROWS: { key: keyof MatchStats; label: string; suffix?: string }[] = [
    { key: "possession", label: "Possession", suffix: "%" },
    { key: "territory", label: "Territory", suffix: "%" },
    { key: "carries", label: "Carries" },
    { key: "metresGained", label: "Metres Gained" },
    { key: "passes", label: "Passes" },
    { key: "tacklesMade", label: "Tackles Made" },
    { key: "missedTackles", label: "Missed Tackles" },
    { key: "scrumsWon", label: "Scrums Won" },
    { key: "lineoutsWon", label: "Lineouts Won" },
    { key: "penaltiesConceded", label: "Penalties Conceded" },
    { key: "turnoversWon", label: "Turnovers Won" },
  ];

  function statusLabel(s: MatchStatus): string {
    if (s.type === "live") return `LIVE ${s.minute}'`;
    if (s.type === "fulltime") return "FULL TIME";
    return `KO ${s.kickoff}`;
  }

  function statBar(home: number, away: number, suffix?: string) {
    const total = home + away || 1;
    const homePct = (home / total) * 100;
    const s = suffix ?? "";
    return (
      <div className="flex items-center gap-2 sm:gap-3 w-full">
        <span className="text-xs sm:text-sm shrink-0 text-right" style={{ fontWeight: 700, color: "#fff", width: 36, fontFeatureSettings: "'tnum'" }}>{home}{s}</span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
          <div className="flex h-full">
            <div style={{ width: `${homePct}%`, background: "var(--accent)", borderRadius: "999px 0 0 999px", transition: "width .4s ease" }} />
            <div style={{ width: `${100 - homePct}%`, background: "rgba(255,255,255,.15)", borderRadius: "0 999px 999px 0", transition: "width .4s ease" }} />
          </div>
        </div>
        <span className="text-xs sm:text-sm shrink-0 text-left" style={{ fontWeight: 700, color: "#fff", width: 36, fontFeatureSettings: "'tnum'" }}>{away}{s}</span>
      </div>
    );
  }

  const loadingSpinner = (
    <div className="flex flex-col items-center justify-center" style={{ padding: "48px 0", gap: 12 }}>
      <div style={{
        width: 28, height: 28, border: "3px solid rgba(255,255,255,.1)",
        borderTopColor: "var(--accent)", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.35)" }}>Loading match data...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <section className="mx-auto px-3 sm:px-8" style={{ maxWidth: 1100, paddingTop: 30, paddingBottom: 10 }}>
      <style>{`
        @keyframes accent-glow {
          0%, 100% { box-shadow: 0 0 20px 0 rgba(var(--accent-rgb,217,165,33),.15), inset 0 0 0 1px rgba(var(--accent-rgb,217,165,33),.25); }
          50% { box-shadow: 0 0 32px 4px rgba(var(--accent-rgb,217,165,33),.25), inset 0 0 0 1px rgba(var(--accent-rgb,217,165,33),.4); }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .5; transform: scale(1.4); }
        }
      `}</style>

      <div
        style={{
          background: "#0B0E13",
          borderRadius: 20,
          overflow: "hidden",
          animation: "accent-glow 3s ease-in-out infinite",
        }}
      >
        {/* ── Clickable banner ──────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="w-full text-left"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <div className="flex items-center gap-3">
              <div className="shrink-0" style={{ width: 20, height: 3, borderRadius: 2, background: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#fff" }}>
                Match Day Live Stats
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#EF4444", display: "inline-block",
                    animation: "live-pulse 2s ease-in-out infinite",
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#EF4444" }}>
                  Live
                </span>
              </div>
              <svg
                width="16" height="16" viewBox="0 0 16 16" fill="none"
                style={{ color: "rgba(255,255,255,.4)", transition: "transform .3s ease", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Match preview */}
          <div className="px-4 sm:px-6 pt-5 sm:pt-7 pb-4 sm:pb-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <TeamBadge team={fixture.homeTeam} size="lg" />
                <span className="text-center" style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                  {fixture.homeTeam.short_name}
                </span>
              </div>
              <div className="flex flex-col items-center shrink-0" style={{ gap: 6 }}>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <span className="font-display" style={{ fontSize: 36, color: isPlaceholder ? "rgba(255,255,255,.2)" : "#fff", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
                    {String(fixture.homeScore).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,.15)", letterSpacing: ".1em" }}>–</span>
                  <span className="font-display" style={{ fontSize: 36, color: isPlaceholder ? "rgba(255,255,255,.2)" : "#fff", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
                    {String(fixture.awayScore).padStart(2, "0")}
                  </span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase",
                  color: fixture.status.type === "live" ? "#EF4444" : "rgba(var(--accent-rgb,217,165,33),.5)",
                  padding: "3px 10px", borderRadius: 999,
                  background: fixture.status.type === "live" ? "rgba(239,68,68,.1)" : "rgba(var(--accent-rgb,217,165,33),.08)",
                }}>
                  {statusLabel(fixture.status)}
                </span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <TeamBadge team={fixture.awayTeam} size="lg" />
                <span className="text-center" style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                  {fixture.awayTeam.short_name}
                </span>
              </div>
            </div>

            {/* Quick stat icons */}
            <div className="flex items-center justify-center gap-6 sm:gap-10" style={{ marginTop: 24, padding: "14px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
              {[
                { label: "Tries", icon: "🏉", count: countEvents(fixture, "try") },
                { label: "Conv", icon: "🥅", count: countEvents(fixture, "conversion") },
                { label: "Pens", icon: "🏈", count: countEvents(fixture, "penalty") },
                { label: "Cards", icon: "🟨", count: countEvents(fixture, "yellow_card") + countEvents(fixture, "red_card") },
              ].map(({ label, icon, count }) => (
                <div key={label} className="flex flex-col items-center" style={{ gap: 4 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span className="font-display" style={{ fontSize: 18, color: count > 0 ? "#fff" : "rgba(255,255,255,.15)", lineHeight: 1 }}>{count}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.25)" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </button>

        {/* ── Expandable Match Centre ───────────────────────────────── */}
        <div
          style={{
            height: expanded ? contentHeight : 0,
            overflow: "hidden",
            transition: "height .4s cubic-bezier(.4,0,.2,1)",
          }}
        >
          <div ref={contentRef}>
            {/* Close button */}
            <div className="flex justify-end px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                style={{
                  background: "rgba(255,255,255,.06)", border: "none", borderRadius: 8,
                  padding: "6px 14px", cursor: "pointer", color: "rgba(255,255,255,.5)",
                  fontSize: 12, fontWeight: 700,
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Fixture strip (if multiple) */}
            {fixtures.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                {fixtures.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setActiveFixtureIdx(i); setActiveTab("stats"); }}
                    style={{
                      background: i === activeFixtureIdx ? "rgba(var(--accent-rgb,217,165,33),.12)" : "rgba(255,255,255,.04)",
                      border: i === activeFixtureIdx ? "1px solid rgba(var(--accent-rgb,217,165,33),.3)" : "1px solid rgba(255,255,255,.08)",
                      borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                      whiteSpace: "nowrap", color: "#fff", fontSize: 12, fontWeight: 700,
                    }}
                  >
                    {f.homeTeam.short_name} v {f.awayTeam.short_name}
                  </button>
                ))}
              </div>
            )}

            {/* Match header */}
            <div className="text-center px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4">
              <div className="flex items-center justify-center gap-3 sm:gap-6">
                <div className="flex-1 flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
                  <TeamBadge team={fixture.homeTeam} size="lg" />
                  <span className="text-center text-xs sm:text-sm" style={{ fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{fixture.homeTeam.short_name}</span>
                </div>
                <div className="flex flex-col items-center shrink-0" style={{ gap: 4 }}>
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <span className="font-display text-3xl sm:text-5xl" style={{ color: isPlaceholder ? "rgba(255,255,255,.2)" : "#fff", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
                      {fixture.homeScore}
                    </span>
                    <span className="text-sm sm:text-xl" style={{ fontWeight: 800, color: "rgba(255,255,255,.15)" }}>–</span>
                    <span className="font-display text-3xl sm:text-5xl" style={{ color: isPlaceholder ? "rgba(255,255,255,.2)" : "#fff", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
                      {fixture.awayScore}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
                    color: fixture.status.type === "live" ? "#EF4444" : "rgba(255,255,255,.4)",
                  }}>
                    {statusLabel(fixture.status)}
                  </span>
                  {fixture.venue && (
                    <span className="text-[10px] sm:text-xs" style={{ color: "rgba(255,255,255,.3)", marginTop: 2 }}>{fixture.venue}</span>
                  )}
                </div>
                <div className="flex-1 flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
                  <TeamBadge team={fixture.awayTeam} size="lg" />
                  <span className="text-center text-xs sm:text-sm" style={{ fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{fixture.awayTeam.short_name}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex px-4 sm:px-6" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              {([
                { key: "stats" as Tab, label: "Stats", labelFull: "Match Stats" },
                { key: "players" as Tab, label: "Players", labelFull: "Players" },
                { key: "events" as Tab, label: "Events", labelFull: "Events" },
                { key: "commentary" as Tab, label: "Live", labelFull: "Commentary" },
              ]).map(({ key, label, labelFull }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className="flex-1 py-3 sm:py-3.5"
                  style={{
                    cursor: "pointer",
                    background: "none", border: "none",
                    borderBottom: activeTab === key ? "2px solid var(--accent)" : "2px solid transparent",
                    color: activeTab === key ? "var(--accent)" : "rgba(255,255,255,.4)",
                    fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                    transition: "color .2s, border-color .2s",
                  }}
                >
                  <span className="text-[10px] sm:hidden">{label}</span>
                  <span className="hidden sm:inline text-[13px]">{labelFull}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="px-4 sm:px-6 py-4 sm:py-5" style={{ position: "relative" }}>
              {/* Placeholder overlay */}
              {isPlaceholder && !isFixtureLoading && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(11,14,19,.7)", backdropFilter: "blur(2px)",
                  borderRadius: "0 0 20px 20px",
                }}>
                  <div className="text-center" style={{ padding: "24px 32px" }}>
                    <div style={{
                      display: "inline-block", padding: "8px 20px", borderRadius: 10,
                      background: "rgba(var(--accent-rgb,217,165,33),.12)",
                      border: "1px solid rgba(var(--accent-rgb,217,165,33),.25)",
                    }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", margin: 0 }}>
                        Live stats available from {round1Label ?? "Round 1"}
                      </p>
                      {round1Date && (
                        <p style={{ fontSize: 12, color: "rgba(var(--accent-rgb,217,165,33),.6)", margin: "4px 0 0" }}>
                          {round1Date}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Loading spinner */}
              {isFixtureLoading && !fixtureHasDetail && loadingSpinner}

              {/* TAB 1: Match Stats */}
              {activeTab === "stats" && !isFixtureLoading && (
                <div className="flex flex-col gap-3 sm:gap-4">
                  {STAT_ROWS.map(({ key, label, suffix }) => (
                    <div key={key}>
                      <p className="text-center text-[10px] sm:text-[11px]" style={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", margin: "0 0 4px" }}>
                        {label}
                      </p>
                      {statBar(fixture.homeStats[key], fixture.awayStats[key], suffix)}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 2: Players */}
              {activeTab === "players" && !isFixtureLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  {[
                    { label: fixture.homeTeam.short_name, players: fixture.homePlayers, team: fixture.homeTeam },
                    { label: fixture.awayTeam.short_name, players: fixture.awayPlayers, team: fixture.awayTeam },
                  ].map(({ label, players, team }) => {
                    const maxTackles = Math.max(...players.map((p) => p.tackles), 1);
                    const maxMetres = Math.max(...players.map((p) => p.metres), 1);
                    return (
                      <div key={label}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                          <TeamBadge team={team} size="xs" />
                          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#fff" }}>
                            {label}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 280 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                                <th style={{ textAlign: "left", padding: "8px 6px", color: "rgba(255,255,255,.3)", fontWeight: 700, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>#</th>
                                <th style={{ textAlign: "left", padding: "8px 6px", color: "rgba(255,255,255,.3)", fontWeight: 700, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>Player</th>
                                <th style={{ textAlign: "center", padding: "8px 4px", color: "rgba(255,255,255,.3)", fontWeight: 700, fontSize: 10 }}>T</th>
                                <th style={{ textAlign: "center", padding: "8px 4px", color: "rgba(255,255,255,.3)", fontWeight: 700, fontSize: 10 }}>C</th>
                                <th style={{ textAlign: "center", padding: "8px 4px", color: "rgba(255,255,255,.3)", fontWeight: 700, fontSize: 10 }}>M</th>
                                <th style={{ textAlign: "center", padding: "8px 4px", color: "rgba(255,255,255,.3)", fontWeight: 700, fontSize: 10 }}>TK</th>
                                <th style={{ textAlign: "center", padding: "8px 4px", color: "rgba(255,255,255,.3)", fontWeight: 700, fontSize: 10 }}>MT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber).map((p) => {
                                const isTryScorer = p.tries > 0;
                                const isMostTackles = p.tackles === maxTackles && p.tackles > 0;
                                const isMostMetres = p.metres === maxMetres && p.metres > 0;
                                return (
                                  <tr key={p.playerId} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                    <td style={{ padding: "7px 6px", color: "rgba(255,255,255,.4)", fontWeight: 600, fontFeatureSettings: "'tnum'" }}>{p.jerseyNumber}</td>
                                    <td style={{
                                      padding: "7px 6px", fontWeight: 600,
                                      color: isTryScorer ? "var(--accent)" : "#fff",
                                      whiteSpace: "nowrap",
                                    }}>
                                      {p.name}
                                      {isTryScorer && <span style={{ marginLeft: 4, fontSize: 10 }}>🏉</span>}
                                    </td>
                                    <td style={{ textAlign: "center", padding: "7px 4px", color: isTryScorer ? "var(--accent)" : "rgba(255,255,255,.5)", fontWeight: isTryScorer ? 800 : 400 }}>{p.tries}</td>
                                    <td style={{ textAlign: "center", padding: "7px 4px", color: "rgba(255,255,255,.5)" }}>{p.carries}</td>
                                    <td style={{ textAlign: "center", padding: "7px 4px", color: "rgba(255,255,255,.5)", fontWeight: isMostMetres ? 800 : 400 }}>{p.metres}</td>
                                    <td style={{ textAlign: "center", padding: "7px 4px", color: "rgba(255,255,255,.5)", fontWeight: isMostTackles ? 800 : 400 }}>{p.tackles}</td>
                                    <td style={{ textAlign: "center", padding: "7px 4px", color: p.missedTackles > 0 ? "#EF4444" : "rgba(255,255,255,.5)" }}>{p.missedTackles}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: Events */}
              {activeTab === "events" && !isFixtureLoading && (
                <div>
                  {fixture.events.length === 0 ? (
                    <div className="text-center" style={{ padding: "32px 0", color: "rgba(255,255,255,.25)" }}>
                      <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>📋</span>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>No match events yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col" style={{ gap: 0 }}>
                      {[...fixture.events].reverse().map((evt) => {
                        const isHome = evt.teamId === fixture.homeTeam.id;
                        const evtTeam = isHome ? fixture.homeTeam : fixture.awayTeam;
                        return (
                          <div
                            key={evt.id}
                            className="flex items-center gap-3"
                            style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}
                          >
                            <span style={{
                              width: 36, textAlign: "center", fontSize: 13,
                              fontWeight: 800, color: "rgba(255,255,255,.4)",
                              fontFeatureSettings: "'tnum'",
                            }}>
                              {evt.minute}&apos;
                            </span>
                            <span style={{ fontSize: 16 }}>{EVENT_ICONS[evt.type]}</span>
                            <TeamBadge team={evtTeam} size="xs" />
                            <div className="flex-1 min-w-0">
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{evt.playerName}</span>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginLeft: 6 }}>{EVENT_LABELS[evt.type]}</span>
                            </div>
                            {evt.scoreAtTime && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.3)", fontFeatureSettings: "'tnum'" }}>
                                {evt.scoreAtTime}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Commentary */}
              {activeTab === "commentary" && !isFixtureLoading && (
                <div>
                  {(fixture.commentary ?? []).length === 0 ? (
                    <div className="text-center" style={{ padding: "32px 0", color: "rgba(255,255,255,.25)" }}>
                      <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>💬</span>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>No commentary available</p>
                    </div>
                  ) : (
                    <div className="flex flex-col" style={{ gap: 0 }}>
                      {[...(fixture.commentary ?? [])].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0)).map((entry, i) => (
                        <div
                          key={i}
                          className="flex gap-3"
                          style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}
                        >
                          <div className="shrink-0 flex flex-col items-center" style={{ width: 36 }}>
                            <span style={{
                              fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,.4)",
                              fontFeatureSettings: "'tnum'",
                            }}>
                              {entry.minute != null ? `${entry.minute}'` : "—"}
                            </span>
                            {entry.period && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.2)", textTransform: "uppercase", marginTop: 2 }}>
                                {entry.period}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 13, color: "#fff", margin: 0, lineHeight: 1.5, flex: 1 }}>
                            {entry.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3" style={{ background: "rgba(var(--accent-rgb,217,165,33),.08)", borderTop: "1px solid rgba(var(--accent-rgb,217,165,33),.15)" }}>
              <p className="text-center text-xs sm:text-[13px]" style={{ fontWeight: 700, color: "var(--accent)", margin: 0 }}>
                {hasLiveOrFinished
                  ? fixture.status.type === "live" ? "Updating every 30 seconds" : "Full Time"
                  : <>Live stats coming {round1Label ?? "Round 1"}{round1Date && <span style={{ fontWeight: 500, color: "rgba(var(--accent-rgb,217,165,33),.6)" }}> · {round1Date}</span>}</>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Non-expanded footer */}
        {!expanded && (
          <div className="px-4 sm:px-6 py-3" style={{ background: "rgba(var(--accent-rgb,217,165,33),.08)", borderTop: "1px solid rgba(var(--accent-rgb,217,165,33),.15)" }}>
            <p className="text-center text-xs sm:text-[13px]" style={{ fontWeight: 700, color: "var(--accent)", margin: 0 }}>
              {hasLiveOrFinished
                ? fixture.status.type === "live" ? "Updating every 30 seconds" : "Full Time"
                : <>Live stats coming {round1Label ?? "Round 1"}{round1Date && <span style={{ fontWeight: 500, color: "rgba(var(--accent-rgb,217,165,33),.6)" }}> · {round1Date}</span>}</>
              }
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
