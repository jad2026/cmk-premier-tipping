"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import TeamBadge from "@/components/TeamBadge";
import type { MatchStats, MatchStatus, MatchFixture, MatchEventType, PlayerMatchStats } from "./matchCentreTypes";

const POSITION_GROUPS = ["Front Row", "Second Row", "Back Row", "Halfbacks", "Midfield", "Outside Backs"] as const;
const POLL_INTERVAL = 30_000;

/* ── Props ──────────────────────────────────────────────────────── */

type Props = {
  fixtures: MatchFixture[];
  round1Label: string | null;
  round1Date: string | null;
};

/* ── Tab type ───────────────────────────────────────────────────── */
type Tab = "stats" | "players" | "events";

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

/* ── Component ──────────────────────────────────────────────────── */

export default function MatchCentre({ fixtures: initialFixtures, round1Label, round1Date }: Props) {
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [expanded, setExpanded] = useState(false);
  const [activeFixtureIdx, setActiveFixtureIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const fixture = fixtures[activeFixtureIdx] ?? null;

  const hasLiveOrFinished = fixtures.some(
    (f) => f.status.type === "live" || f.status.type === "fulltime",
  );
  const allPre = fixtures.every((f) => f.status.type === "pre");

  const pollFixtures = useCallback(async () => {
    const updated = await Promise.all(
      fixtures.map(async (f) => {
        try {
          const res = await fetch(`/api/match-centre/${f.id}`);
          if (!res.ok) return f;
          return (await res.json()) as MatchFixture;
        } catch {
          return f;
        }
      }),
    );
    setFixtures(updated);
  }, [fixtures]);

  useEffect(() => {
    if (allPre) return;
    const id = setInterval(pollFixtures, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [allPre, pollFixtures]);

  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContentHeight(entry.contentRect.height);
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [expanded, activeTab, activeFixtureIdx]);

  if (!fixture) return null;

  const isPlaceholder = fixture.status.type === "pre";

  const STAT_ROWS: { key: keyof MatchStats; label: string }[] = [
    { key: "possession", label: "Possession %" },
    { key: "territory", label: "Territory %" },
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

  function statBar(home: number, away: number) {
    const total = home + away || 1;
    const homePct = (home / total) * 100;
    return (
      <div className="flex items-center gap-3 w-full">
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", width: 36, textAlign: "right", fontFeatureSettings: "'tnum'" }}>{home}</span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
          <div className="flex h-full">
            <div style={{ width: `${homePct}%`, background: "var(--accent)", borderRadius: "999px 0 0 999px", transition: "width .4s ease" }} />
            <div style={{ width: `${100 - homePct}%`, background: "rgba(255,255,255,.15)", borderRadius: "0 999px 999px 0", transition: "width .4s ease" }} />
          </div>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", width: 36, textAlign: "left", fontFeatureSettings: "'tnum'" }}>{away}</span>
      </div>
    );
  }

  return (
    <section className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 10px" }}>
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
          <div className="flex items-center justify-between" style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
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
          <div style={{ padding: "28px 24px 20px" }}>
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
            <div className="flex justify-end" style={{ padding: "0 24px" }}>
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
              <div className="flex gap-2 overflow-x-auto" style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
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
            <div className="text-center" style={{ padding: "20px 24px 16px" }}>
              <div className="flex items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <TeamBadge team={fixture.homeTeam} size="xl" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fixture.homeTeam.name}</span>
                </div>
                <div className="flex flex-col items-center" style={{ gap: 4 }}>
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <span className="font-display" style={{ fontSize: 48, color: isPlaceholder ? "rgba(255,255,255,.2)" : "#fff", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
                      {fixture.homeScore}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,.15)" }}>–</span>
                    <span className="font-display" style={{ fontSize: 48, color: isPlaceholder ? "rgba(255,255,255,.2)" : "#fff", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
                      {fixture.awayScore}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
                    color: fixture.status.type === "live" ? "#EF4444" : "rgba(255,255,255,.4)",
                  }}>
                    {statusLabel(fixture.status)}
                  </span>
                  {fixture.venue && (
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 2 }}>{fixture.venue}</span>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <TeamBadge team={fixture.awayTeam} size="xl" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fixture.awayTeam.name}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,.08)", padding: "0 24px" }}>
              {([
                { key: "stats" as Tab, label: "Match Stats" },
                { key: "players" as Tab, label: "Players" },
                { key: "events" as Tab, label: "Events" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  style={{
                    flex: 1, padding: "14px 0", cursor: "pointer",
                    background: "none", border: "none",
                    borderBottom: activeTab === key ? "2px solid var(--accent)" : "2px solid transparent",
                    color: activeTab === key ? "var(--accent)" : "rgba(255,255,255,.4)",
                    fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                    transition: "color .2s, border-color .2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: "20px 24px 24px", position: "relative" }}>
              {/* Placeholder overlay */}
              {isPlaceholder && (
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

              {/* TAB 1: Match Stats */}
              {activeTab === "stats" && (
                <div className="flex flex-col" style={{ gap: 16 }}>
                  {STAT_ROWS.map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-center" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", margin: "0 0 6px" }}>
                        {label}
                      </p>
                      {statBar(fixture.homeStats[key], fixture.awayStats[key])}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 2: Players */}
              {activeTab === "players" && (
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 24 }}>
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
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 320 }}>
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
                              {POSITION_GROUPS.map((group) => {
                                const groupPlayers = players.filter((p) => p.positionGroup === group);
                                if (groupPlayers.length === 0) return null;
                                return [
                                  <tr key={`hdr-${group}`}>
                                    <td colSpan={7} style={{
                                      padding: "10px 6px 4px", fontSize: 10, fontWeight: 800,
                                      letterSpacing: ".1em", textTransform: "uppercase",
                                      color: "var(--accent)", opacity: 0.6,
                                    }}>
                                      {group}
                                    </td>
                                  </tr>,
                                  ...groupPlayers.map((p) => {
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
                                  }),
                                ];
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
              {activeTab === "events" && (
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
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 24px", background: "rgba(var(--accent-rgb,217,165,33),.08)", borderTop: "1px solid rgba(var(--accent-rgb,217,165,33),.15)" }}>
              <p className="text-center" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", margin: 0 }}>
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
          <div style={{ padding: "12px 24px", background: "rgba(var(--accent-rgb,217,165,33),.08)", borderTop: "1px solid rgba(var(--accent-rgb,217,165,33),.15)" }}>
            <p className="text-center" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", margin: 0 }}>
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

