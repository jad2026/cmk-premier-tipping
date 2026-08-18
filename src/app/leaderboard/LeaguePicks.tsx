"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Avatar from "@/components/Avatar";
import type { RoundData } from "./LeaderboardContent";

type FixtureTeam = {
  id: string;
  name: string;
  short_name: string;
  colour: string;
  logo_url: string | null;
};

type FixtureData = {
  id: string;
  home_team: FixtureTeam;
  away_team: FixtureTeam;
  home_score: number | null;
  away_score: number | null;
  result_team_id: string | null;
  is_draw: boolean;
};

type PickData = {
  fixture_id: string;
  picked_team: { id: string; short_name: string; colour: string } | null;
  picked_draw: boolean;
  predicted_margin: number | null;
  is_correct: boolean | null;
  margin_correct: boolean | null;
  margin_bonus: number;
  points: number;
  auto_picked: boolean;
};

type MemberData = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  round_correct: number;
  round_score: number;
  picks: PickData[];
};

type CachedData = {
  fixtures: FixtureData[];
  members: MemberData[];
};

const AVATAR_COLORS = ["#1E7A3E", "#21409A", "#B23A48", "#2C9FD4", "#7A4B36", "#15324E", "#2B6E2B", "#6E3A2A", "#2C6E8F"];

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

type Props = {
  leagueId: string;
  roundsData: RoundData[];
};

export default function LeaguePicks({ leagueId, roundsData }: Props) {
  const [showPicks, setShowPicks] = useState(false);
  const pastRounds = roundsData.filter((r) => r.hasResults);
  const [selectedRound, setSelectedRound] = useState<string>(() =>
    pastRounds.length > 0 ? pastRounds[pastRounds.length - 1].gameweekId : ""
  );
  const [selectedFixture, setSelectedFixture] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cache = useRef<Map<string, CachedData>>(new Map());
  const [data, setData] = useState<CachedData | null>(null);
  const fixtureTabsRef = useRef<HTMLDivElement>(null);

  const fetchRound = useCallback(async (gameweekId: string) => {
    const cached = cache.current.get(gameweekId);
    if (cached) {
      setData(cached);
      setSelectedFixture(cached.fixtures[0]?.id ?? "");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/league-picks?leagueId=${leagueId}&gameweekId=${gameweekId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load picks");
      }
      const result: CachedData = await res.json();
      cache.current.set(gameweekId, result);
      setData(result);
      setSelectedFixture(result.fixtures[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load picks");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    cache.current.clear();
    setData(null);
    setShowPicks(false);
    setSelectedRound(pastRounds.length > 0 ? pastRounds[pastRounds.length - 1].gameweekId : "");
  }, [leagueId]);

  useEffect(() => {
    if (showPicks && selectedRound) {
      fetchRound(selectedRound);
    }
  }, [showPicks, selectedRound, fetchRound]);

  if (pastRounds.length === 0) return null;

  const currentFixture = data?.fixtures.find((f) => f.id === selectedFixture);

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={() => setShowPicks((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 18px",
          background: showPicks ? "#0D1016" : "#fff",
          border: `1px solid ${showPicks ? "#0D1016" : "#E4E1D8"}`,
          borderRadius: 12,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          color: showPicks ? "#fff" : "#11151C",
          fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
          transition: "all .15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h8" stroke={showPicks ? "#fff" : "#8B8676"} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {showPicks ? "Hide Picks" : "View Picks"}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: showPicks ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s" }}
        >
          <path d="M3 4.5l3 3 3-3" stroke={showPicks ? "#fff" : "#8B8676"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {showPicks && (
        <div style={{ marginTop: 14, background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, overflow: "hidden" }}>
          {/* Round selector */}
          <div style={{ padding: "14px 16px 0", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", minWidth: "max-content" }}>
              {pastRounds.map((round) => (
                <button
                  key={round.gameweekId}
                  onClick={() => setSelectedRound(round.gameweekId)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                    transition: "all .15s",
                    background: selectedRound === round.gameweekId ? "#0D1016" : "#F2F0EA",
                    color: selectedRound === round.gameweekId ? "#fff" : "#8B8676",
                    whiteSpace: "nowrap",
                  }}
                >
                  Rd {round.gameweekNumber}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <div style={{
                width: 28, height: 28, border: "3px solid #E4E1D8", borderTopColor: "var(--accent)",
                borderRadius: "50%", animation: "leaguePicksSpin 0.7s linear infinite", margin: "0 auto 10px",
              }} />
              <p style={{ fontSize: 13, color: "#8B8676", margin: 0 }}>Loading picks...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#B23A48", margin: 0 }}>{error}</p>
            </div>
          )}

          {!loading && !error && data && data.fixtures.length > 0 && (
            <>
              {/* Fixture tabs */}
              <div
                ref={fixtureTabsRef}
                style={{
                  padding: "12px 16px 0",
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                  borderBottom: "1px solid #EFEDE6",
                }}
              >
                <div style={{ display: "flex", gap: 4, minWidth: "max-content" }}>
                  {data.fixtures.map((fixture) => {
                    const isActive = selectedFixture === fixture.id;
                    const hasResult = fixture.home_score !== null && fixture.away_score !== null;
                    return (
                      <button
                        key={fixture.id}
                        onClick={() => setSelectedFixture(fixture.id)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px 8px 0 0",
                          border: "none",
                          borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                          background: isActive ? "rgba(var(--accent-rgb,217,165,33),.08)" : "transparent",
                          color: isActive ? "#11151C" : "#8B8676",
                          whiteSpace: "nowrap",
                          transition: "all .15s",
                        }}
                      >
                        {fixture.home_team.short_name}{" "}
                        {hasResult ? (
                          <span style={{ color: "#11151C", fontWeight: 800 }}>
                            {fixture.home_score} - {fixture.away_score}
                          </span>
                        ) : (
                          <span style={{ color: "#C7C2B5" }}>v</span>
                        )}{" "}
                        {fixture.away_team.short_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Member picks list */}
              <div style={{ padding: "0" }}>
                {data.members.map((member, idx) => {
                  const colorIdx = member.display_name.charCodeAt(0) % AVATAR_COLORS.length;
                  const fixturePick = member.picks.find((p) => p.fixture_id === selectedFixture);
                  const isCorrect = fixturePick?.is_correct === true;
                  const isWrong = fixturePick?.is_correct === false;
                  const isPending = fixturePick?.is_correct === null;

                  return (
                    <div
                      key={member.user_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 16px",
                        borderTop: idx > 0 ? "1px solid #EFEDE6" : "none",
                      }}
                    >
                      {/* Avatar */}
                      <div className="shrink-0">
                        {member.avatar_url ? (
                          <Avatar url={member.avatar_url} name={member.display_name} size={32} />
                        ) : (
                          <div
                            style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: AVATAR_COLORS[colorIdx],
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                              color: "#fff", fontSize: 11,
                            }}
                          >
                            {initials(member.display_name)}
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#11151C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {member.display_name}
                        </div>
                      </div>

                      {/* Pick badge for selected fixture */}
                      <div className="shrink-0">
                        {fixturePick && !fixturePick.auto_picked && fixturePick.picked_team ? (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 8,
                            background: isCorrect ? "rgba(31,158,90,.12)" : isWrong ? "rgba(178,58,72,.10)" : "rgba(0,0,0,.05)",
                            border: `1px solid ${isCorrect ? "rgba(31,158,90,.25)" : isWrong ? "rgba(178,58,72,.2)" : "rgba(0,0,0,.08)"}`,
                          }}>
                            <span style={{
                              fontSize: 12, fontWeight: 800, color: isCorrect ? "#1F9E5A" : isWrong ? "#B23A48" : "#5A6371",
                              fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                            }}>
                              {fixturePick.picked_team.short_name}
                            </span>
                            {fixturePick.predicted_margin !== null && (
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                color: fixturePick.margin_correct ? "#1F9E5A" : isWrong ? "#B23A48" : "#8B8676",
                              }}>
                                +{fixturePick.predicted_margin}
                              </span>
                            )}
                          </div>
                        ) : fixturePick && fixturePick.picked_draw ? (
                          <div style={{
                            padding: "4px 10px", borderRadius: 8,
                            background: isCorrect ? "rgba(31,158,90,.12)" : isWrong ? "rgba(178,58,72,.10)" : "rgba(0,0,0,.05)",
                            border: `1px solid ${isCorrect ? "rgba(31,158,90,.25)" : isWrong ? "rgba(178,58,72,.2)" : "rgba(0,0,0,.08)"}`,
                            fontSize: 12, fontWeight: 800,
                            color: isCorrect ? "#1F9E5A" : isWrong ? "#B23A48" : "#5A6371",
                            fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                          }}>
                            DRAW
                          </div>
                        ) : (
                          <div style={{
                            padding: "4px 10px", borderRadius: 8,
                            background: "rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.06)",
                            fontSize: 11, fontWeight: 600, color: "#C7C2B5", fontStyle: "italic",
                          }}>
                            auto
                          </div>
                        )}
                      </div>

                      {/* At-a-glance fixture dots */}
                      <div className="hidden sm:flex shrink-0" style={{ gap: 3, alignItems: "center" }}>
                        {data.fixtures.map((f) => {
                          const p = member.picks.find((pk) => pk.fixture_id === f.id);
                          const correct = p?.is_correct === true;
                          const wrong = p?.is_correct === false;
                          const isCurrent = f.id === selectedFixture;
                          return (
                            <div
                              key={f.id}
                              style={{
                                width: isCurrent ? 10 : 8,
                                height: isCurrent ? 10 : 8,
                                borderRadius: "50%",
                                background: correct ? "#1F9E5A" : wrong ? "#B23A48" : "#E4E1D8",
                                border: isCurrent ? "2px solid #0D1016" : "none",
                                transition: "all .15s",
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Round score */}
                      <div className="shrink-0" style={{ textAlign: "right", minWidth: 36 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#8B8676", letterSpacing: ".04em" }}>
                          {member.round_correct}/{data.fixtures.length}
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color: "#11151C",
                          fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                        }}>
                          {member.round_score}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {data.members.length === 0 && (
                  <div style={{ padding: "30px 20px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "#8B8676", margin: 0 }}>No picks found for this round.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !error && data && data.fixtures.length === 0 && (
            <div style={{ padding: "30px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#8B8676", margin: 0 }}>No fixtures for this round.</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes leaguePicksSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
