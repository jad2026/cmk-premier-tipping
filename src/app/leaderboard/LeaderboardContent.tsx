"use client";

import React, { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import TeamBadge from "@/components/TeamBadge";
import LeaderboardTable from "./LeaderboardTable";
import { createLeague, joinLeague, leaveLeague } from "../leagues/actions";
import { rankByScore } from "@/lib/ranking";

export type LeaderboardRow = {
  user_id: string;
  displayName: string;
  avatarUrl: string | null;
  supportedTeamId: string | null;
  supportedTeam: { name: string; short_name: string; colour: string; logo_url: string | null } | null;
  correct: number;
  total: number;
  manualCorrect: number;
  manualTotal: number;
  manualResulted: number;
  marginsCorrect: number;
  marginBonus: number;
  totalScore: number;
  thisRoundCorrect: number | null;
};

export type LeagueInfo = {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  memberUserIds: string[];
  created_by: string;
  is_sponsored?: boolean;
};

export type RoundScoreEntry = {
  user_id: string;
  score: number;
  correct: number;
  total: number;
  marginBonus: number;
};

export type RoundData = {
  gameweekId: string;
  gameweekNumber: number;
  gameweekLabel: string;
  hasResults: boolean;
  scores: RoundScoreEntry[];
};

type Props = {
  leaderboard: LeaderboardRow[];
  leagues: LeagueInfo[];
  currentUserId: string | null;
  marginPicking: boolean;
  showSupportedTeam: boolean;
  noRoundsPlayed: boolean;
  roundsData: RoundData[];
};

const AVATAR_COLORS = ["#1E7A3E", "#21409A", "#B23A48", "#2C9FD4", "#7A4B36", "#15324E", "#2B6E2B", "#6E3A2A", "#2C6E8F"];

function pct(correct: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((correct / total) * 100)}%`;
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function PodiumCard({ entry, rank, isFirst }: { entry: LeaderboardRow; rank: number; isFirst: boolean }) {
  const colorIdx = entry.displayName.charCodeAt(0) % AVATAR_COLORS.length;

  return (
    <div
      className="relative overflow-hidden p-3 sm:p-[22px]"
      style={{
        background: isFirst ? "#0D1016" : "#fff",
        border: `1px solid ${isFirst ? "#0D1016" : "#E4E1D8"}`,
        borderRadius: 18,
        ...(isFirst ? { transform: "translateY(-14px)" } : {}),
      }}
    >
      <div
        className="text-[28px] sm:text-[46px]"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
          lineHeight: 1,
          color: isFirst ? "var(--accent)" : "rgba(17,21,28,.10)",
          opacity: 0.9,
        }}
      >
        {rank}
      </div>

      {entry.avatarUrl ? (
        <div className="mb-2 sm:mb-4">
          <span className="sm:hidden"><Avatar url={entry.avatarUrl} name={entry.displayName} size={34} /></span>
          <span className="hidden sm:block"><Avatar url={entry.avatarUrl} name={entry.displayName} size={54} /></span>
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-full mb-2 sm:mb-4 w-[34px] h-[34px] sm:w-[54px] sm:h-[54px] text-[12px] sm:text-[18px]"
          style={{
            background: AVATAR_COLORS[colorIdx],
            fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
            color: "#fff",
          }}
        >
          {initials(entry.displayName)}
        </div>
      )}

      <div
        className="font-display uppercase truncate text-[13px] sm:text-[21px]"
        style={{ lineHeight: 1.1, color: isFirst ? "#fff" : "#11151C" }}
      >
        {entry.displayName}
      </div>

      <div className="text-[10px] sm:text-[13px] mt-1 sm:mt-1.5" style={{ color: isFirst ? "#9AA1AD" : "#8B8676", fontWeight: 600 }}>
        {pct(entry.manualCorrect, entry.manualResulted)} acc
      </div>

      <div className="flex items-baseline gap-1 mt-2 sm:mt-[18px]">
        <span
          className="font-display text-[24px] sm:text-[38px]"
          style={{ lineHeight: 1, color: isFirst ? "var(--accent)" : "#11151C" }}
        >
          {entry.totalScore}
        </span>
        <span className="text-[10px] sm:text-[13px]" style={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: isFirst ? "#9AA1AD" : "#8B8676" }}>
          pts
        </span>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E4E1D8",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 15,
  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
  background: "#fff",
  color: "#11151C",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

const btnAccent: React.CSSProperties = {
  width: "100%",
  background: "var(--accent)",
  color: "var(--accent-text, #11151C)",
  padding: "12px 20px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  border: "none",
  cursor: "pointer",
  transition: "opacity .15s",
};

export default function LeaderboardContent({
  leaderboard,
  leagues,
  currentUserId,
  marginPicking,
  showSupportedTeam,
  noRoundsPlayed,
  roundsData,
}: Props) {
  const [selectedLeague, setSelectedLeague] = useState("overall");
  const [selectedRound, setSelectedRound] = useState("total"); // "total" or gameweekId
  const [showManage, setShowManage] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [createFeedback, setCreateFeedback] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinFeedback, setJoinFeedback] = useState("");
  const [sponsorLogos, setSponsorLogos] = useState<{id: string; name: string; logo_url: string; display_order: number}[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setRowRef = useCallback((userId: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(userId, el);
    else rowRefs.current.delete(userId);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (searchQuery.length < 2) {
      setDebouncedQuery("");
      return;
    }
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  useEffect(() => {
    setSelectedRound("total");
    setSearchQuery("");
    setDebouncedQuery("");
    setHighlightedIds(new Set());
  }, [selectedLeague]);

  const selectedLeagueInfo = leagues.find((l) => l.id === selectedLeague);
  const isSponsored = selectedLeagueInfo?.is_sponsored ?? false;

  // Filter rounds that have results for the round selector
  const availableRounds = roundsData.filter((r) => r.hasResults);

  useEffect(() => {
    if (!selectedLeague || selectedLeague === "overall") {
      setSponsorLogos([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("league_sponsor_logos")
      .select("id, name, logo_url, display_order")
      .eq("league_id", selectedLeague)
      .order("display_order", { ascending: true })
      .then(({ data }) => setSponsorLogos(data || []));
  }, [selectedLeague]);

  const filtered =
    selectedLeague === "overall"
      ? leaderboard
      : leaderboard.filter((e) => {
          const league = leagues.find((l) => l.id === selectedLeague);
          return league?.memberUserIds.includes(e.user_id);
        });

  // If a specific round is selected, override scores with that round's data
  const selectedRoundData = selectedRound !== "total"
    ? roundsData.find((r) => r.gameweekId === selectedRound)
    : null;

  const withRoundScores: LeaderboardRow[] = selectedRoundData
    ? filtered.map((entry) => {
        const roundScore = selectedRoundData.scores.find((s) => s.user_id === entry.user_id);
        return {
          ...entry,
          totalScore: roundScore?.score ?? 0,
          correct: roundScore?.correct ?? 0,
          total: roundScore?.total ?? 0,
          marginBonus: roundScore?.marginBonus ?? 0,
          manualCorrect: roundScore?.correct ?? 0,
          manualTotal: roundScore?.total ?? 0,
          manualResulted: roundScore?.total ?? 0,
        };
      })
    : filtered;

  const sorted = [...withRoundScores].sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.correct - a.correct ||
      b.total - a.total ||
      a.displayName.localeCompare(b.displayName)
  );

  const ranks = rankByScore(sorted.map((e) => e.totalScore));

  const podiumEntries =
    sorted.length >= 3 ? [sorted[1], sorted[0], sorted[2]] : [];

  const gridCls = marginPicking
    ? "grid-cols-[22px_1fr_28px_28px_32px_28px_32px] sm:grid-cols-[54px_1fr_64px_64px_68px_56px_68px]"
    : "grid-cols-[22px_1fr_24px_32px_28px_32px] sm:grid-cols-[54px_1fr_76px_68px_56px_68px]";

  const matchedUserIds = debouncedQuery
    ? sorted
        .filter((e) => e.displayName.toLowerCase().includes(debouncedQuery.toLowerCase()))
        .map((e) => e.user_id)
    : [];

  const noMatch = debouncedQuery.length >= 2 && matchedUserIds.length === 0;

  const matchKey = matchedUserIds.join(",");
  useEffect(() => {
    if (!matchKey) {
      setHighlightedIds(new Set());
      return;
    }
    const ids = matchKey.split(",");
    setHighlightedIds(new Set(ids));
    requestAnimationFrame(() => {
      const el = rowRefs.current.get(ids[0]);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = setTimeout(() => setHighlightedIds(new Set()), 2000);
    return () => clearTimeout(timer);
  }, [matchKey]);

  function copyCode(code: string, leagueId: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(leagueId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreateError("");
    setCreateFeedback("");
    startTransition(async () => {
      const res = await createLeague(createName);
      if (res.error) {
        setCreateError(res.error);
      } else if (res.league) {
        setCreateFeedback(`League "${res.league.name}" created! Code: ${res.league.invite_code}`);
        setCreateName("");
        router.refresh();
      }
    });
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinError("");
    setJoinFeedback("");
    startTransition(async () => {
      const res = await joinLeague(joinCode);
      if (res.error) {
        setJoinError(res.error);
      } else if (res.league) {
        setJoinFeedback(`Joined "${res.league.name}"!`);
        setJoinCode("");
        router.refresh();
      }
    });
  }

  function handleLeave(leagueId: string, leagueName: string) {
    if (!confirm(`Leave "${leagueName}"? You can rejoin later with the invite code.`)) return;
    startTransition(async () => {
      const res = await leaveLeague(leagueId);
      if (res.error) {
        alert(res.error);
      } else {
        if (selectedLeague === leagueId) setSelectedLeague("overall");
        router.refresh();
      }
    });
  }

  return (
    <>
      {/* Dropdown */}
      {currentUserId && leagues.length > 0 && (
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "20px 32px 0" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                style={{
                  appearance: "none",
                  background: "#fff",
                  border: "1px solid #E4E1D8",
                  borderRadius: 12,
                  padding: "10px 40px 10px 16px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#11151C",
                  cursor: "pointer",
                  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                  outline: "none",
                  minWidth: 200,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E4E1D8";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <option value="overall">Overall Leaderboard</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path d="M4 6l4 4 4-4" stroke="#8B8676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {selectedLeague !== "overall" && (
              <span style={{ fontSize: 13, color: "#8B8676" }}>
                {sorted.length} tipper{sorted.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {sponsorLogos.length > 0 && (
            <div style={{ background: '#0B0E13', borderRadius: 12, padding: '16px 20px', marginTop: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#C7CCD4', marginBottom: 12, textAlign: 'center' as const }}>Proudly supported by</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' as const }}>
                {sponsorLogos.map((logo, i) => (
                  <React.Fragment key={logo.id}>
                    {i > 0 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>x</span>}
                    <div style={{
                      background: '#fff',
                      borderRadius: 8,
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <img
                        src={logo.logo_url}
                        alt={logo.name}
                        title={logo.name}
                        style={{ maxHeight: 88, maxWidth: 280, objectFit: 'contain' as const, display: 'block' }}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Round selector — visible for overall + all leagues */}
      {availableRounds.length > 0 && (
        <div className="mx-auto" style={{ maxWidth: 1100, padding: currentUserId && leagues.length > 0 ? "16px 32px 0" : "20px 32px 0" }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            padding: '4px',
            background: '#fff',
            border: '1px solid #E4E1D8',
            borderRadius: 14,
          }}>
            <button
              onClick={() => setSelectedRound("total")}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                transition: 'all .15s',
                background: selectedRound === "total" ? '#0D1016' : 'transparent',
                color: selectedRound === "total" ? '#fff' : '#8B8676',
              }}
            >
              Total
            </button>
            {availableRounds.map((round) => (
              <button
                key={round.gameweekId}
                onClick={() => setSelectedRound(round.gameweekId)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                  transition: 'all .15s',
                  background: selectedRound === round.gameweekId ? '#0D1016' : 'transparent',
                  color: selectedRound === round.gameweekId ? '#fff' : '#8B8676',
                  whiteSpace: 'nowrap',
                }}
              >
                Rd {round.gameweekNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Round label when a specific round is selected */}
      {selectedRound !== "total" && selectedRoundData && (
        <div className="mx-auto px-3 sm:px-8" style={{ maxWidth: 1100, paddingTop: 24 }}>
          <div className="flex items-center gap-3">
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#11151C" }}>
              {selectedRoundData.gameweekLabel}
            </span>
            {sorted.length > 0 && sorted[0].totalScore > 0 && (
              <span style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(var(--accent-rgb,217,165,33),.12)',
                color: 'var(--accent)',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.04em',
              }}>
                Round Winner: {sorted[0].displayName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Podium */}
      {podiumEntries.length === 3 && !noRoundsPlayed && !(selectedRoundData && sorted.every((e) => e.totalScore === 0)) && (
        <section className="mx-auto px-3 sm:px-8" style={{ maxWidth: 1100, paddingTop: 34, paddingBottom: 16 }}>
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
            {podiumEntries.map((entry, idx) => {
              const isFirst = idx === 1;
              const podiumRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
              return (
                <PodiumCard
                  key={entry.user_id}
                  entry={entry}
                  rank={podiumRank}
                  isFirst={isFirst}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Full table */}
      <section className="mx-auto px-3 sm:px-8 pt-[18px] pb-10" style={{ maxWidth: 1100 }}>
        {/* Search input */}
        {sorted.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ position: "relative" }}>
              <svg
                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                width="16" height="16" viewBox="0 0 16 16" fill="none"
              >
                <circle cx="7" cy="7" r="4.5" stroke="#8B8676" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="#8B8676" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a tipper..."
                style={{
                  width: "100%",
                  border: "1px solid #E4E1D8",
                  borderRadius: 12,
                  padding: "11px 40px 11px 40px",
                  fontSize: 14,
                  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                  background: "#fff",
                  color: "#11151C",
                  outline: "none",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E4E1D8";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setDebouncedQuery(""); setHighlightedIds(new Set()); }}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#8B8676",
                    fontSize: 16,
                    padding: "4px 6px",
                    lineHeight: 1,
                    borderRadius: 6,
                    transition: "color .15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#11151C"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#8B8676"; }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            {noMatch && (
              <p style={{ fontSize: 13, color: "#8B8676", margin: "8px 0 0 4px" }}>
                No tipper found
              </p>
            )}
          </div>
        )}

        {(noRoundsPlayed || (selectedRoundData && sorted.every((e) => e.totalScore === 0))) && (
          <div
            className="flex items-center gap-3"
            style={{ borderRadius: 14, background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "14px 20px", marginBottom: 18 }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>🏉</span>
            <p style={{ fontSize: 14, color: "#1E40AF", fontWeight: 600, margin: 0 }}>
              {selectedRoundData
                ? "No results for this round yet — scores will appear once fixtures are complete."
                : "No rounds played yet — scores will appear here once the first round is complete."}
            </p>
          </div>
        )}

        {sorted.length === 0 ? (
          <div
            className="text-center"
            style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "48px 24px" }}
          >
            <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>📋</span>
            <p style={{ fontWeight: 600, color: "#5A6371", margin: 0 }}>
              {selectedLeague === "overall" ? "No participants yet" : "No league members in this competition"}
            </p>
            <p style={{ fontSize: 14, color: "#8B8676", marginTop: 4 }}>
              {selectedLeague === "overall"
                ? "Registered users will appear here once they sign up."
                : "Invite your league members to join the competition."}
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              border: "1px solid #E4E1D8",
              borderRadius: 18,
              overflow: "hidden",
              fontFeatureSettings: "'tnum'",
            }}
          >
            <div
              className={`grid gap-x-1 sm:gap-x-2 ${gridCls} px-3 py-3 sm:px-[22px] sm:py-[15px] text-[10px] sm:text-[11px]`}
              style={{
                background: "#0D1016",
                color: "#9AA1AD",
                fontWeight: 800,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <span>#</span>
              <span>Tipper</span>
              {marginPicking ? (
                <>
                  <span style={{ textAlign: "center" }}>
                    <span className="sm:hidden">Cor</span>
                    <span className="hidden sm:inline">Correct</span>
                  </span>
                  <span style={{ textAlign: "center" }}>
                    <span className="sm:hidden">Bon</span>
                    <span className="hidden sm:inline">Bonus</span>
                  </span>
                </>
              ) : (
                <span style={{ textAlign: "center" }}>
                  <span className="sm:hidden">Rd</span>
                  <span className="hidden sm:inline">This rd</span>
                </span>
              )}
              <span style={{ textAlign: "center" }}>
                <span className="sm:hidden">Acc%</span>
                <span className="hidden sm:inline">Accuracy</span>
              </span>
              <span style={{ textAlign: "center" }}>Tips</span>
              <span style={{ textAlign: "right" }}>
                <span className="sm:hidden">Pts</span>
                <span className="hidden sm:inline">Total</span>
              </span>
            </div>

            <LeaderboardTable totalCount={sorted.length} forceExpanded={debouncedQuery.length >= 2}>
              {sorted.map((entry, idx) => {
                const isYou = currentUserId === entry.user_id;
                const displayRank = ranks[idx];
                const colorIdx = entry.displayName.charCodeAt(0) % AVATAR_COLORS.length;
                const isHighlighted = highlightedIds.has(entry.user_id);

                return (
                  <div
                    key={entry.user_id}
                    ref={(el) => setRowRef(entry.user_id, el)}
                    data-user-id={entry.user_id}
                    className={`grid gap-x-1 sm:gap-x-2 ${gridCls} px-3 py-2.5 sm:px-[22px] sm:py-[15px]${isHighlighted ? " leaderboard-highlight" : ""}`}
                    style={{
                      alignItems: "center",
                      borderTop: "1px solid #EFEDE6",
                      background: isHighlighted
                        ? "rgba(44,159,212,.15)"
                        : isYou
                        ? "var(--accent-wash, rgba(217,165,33,.10))"
                        : "#fff",
                      borderLeft: isYou ? "3px solid var(--accent)" : "3px solid transparent",
                      transition: "background .3s ease-out",
                    }}
                  >
                    <span
                      className="font-display text-[12px] sm:text-[16px]"
                      style={{ color: displayRank <= 3 ? "var(--accent)" : "#11151C" }}
                    >
                      {displayRank}
                    </span>

                    <span className="flex items-center min-w-0" style={{ gap: 6 }}>
                      {entry.avatarUrl ? (
                        <span className="shrink-0">
                          <span className="sm:hidden"><Avatar url={entry.avatarUrl} name={entry.displayName} size={24} /></span>
                          <span className="hidden sm:block"><Avatar url={entry.avatarUrl} name={entry.displayName} size={34} /></span>
                        </span>
                      ) : (
                        <span
                          className="flex items-center justify-center rounded-full shrink-0 w-6 h-6 sm:w-[34px] sm:h-[34px] text-[9px] sm:text-[12px]"
                          style={{
                            background: isYou ? "var(--accent)" : AVATAR_COLORS[colorIdx],
                            fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                            color: "#fff",
                          }}
                        >
                          {initials(entry.displayName)}
                        </span>
                      )}
                      <span className="flex flex-col min-w-0">
                        <span className="truncate text-[12px] sm:text-[15px]" style={{ fontWeight: 700, color: "#11151C" }}>
                          {entry.displayName}
                        </span>
                      </span>
                      {showSupportedTeam && entry.supportedTeam && (
                        <span className="hidden sm:inline-flex shrink-0"><TeamBadge team={entry.supportedTeam} size="xs" /></span>
                      )}
                      {isYou && (
                        <span
                          className="shrink-0"
                          style={{
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "var(--accent)",
                            color: "var(--accent-text, #11151C)",
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                          }}
                        >
                          You
                        </span>
                      )}
                    </span>

                    {marginPicking ? (
                      <>
                        <span className="text-[11px] sm:text-[14px]" style={{ textAlign: "center", fontWeight: 700, color: entry.correct > 0 ? "#11151C" : "#C7C2B5" }}>
                          {entry.correct}
                        </span>
                        <span className="text-[11px] sm:text-[14px]" style={{ textAlign: "center", fontWeight: 700, color: entry.marginBonus > 0 ? "#1F9E5A" : "#C7C2B5" }}>
                          {entry.marginBonus}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] sm:text-[14px]" style={{ textAlign: "center", fontWeight: 700, color: entry.thisRoundCorrect !== null ? "#1F9E5A" : "#C7C2B5" }}>
                        {entry.thisRoundCorrect !== null ? entry.thisRoundCorrect : "—"}
                      </span>
                    )}

                    <span className="text-[11px] sm:text-[14px]" style={{ textAlign: "center", color: "#5A6371" }}>
                      {pct(entry.manualCorrect, entry.manualResulted)}
                    </span>

                    <span className="text-[11px] sm:text-[14px]" style={{ textAlign: "center", color: entry.manualTotal > 0 ? "#5A6371" : "#C7C2B5" }}>
                      {entry.manualTotal > 0 ? entry.manualTotal : "—"}
                    </span>

                    <span
                      className="font-display text-[14px] sm:text-[18px]"
                      style={{ textAlign: "right", color: "#11151C" }}
                    >
                      {entry.totalScore}
                    </span>
                  </div>
                );
              })}
            </LeaderboardTable>
          </div>
        )}
      </section>

      <style>{`
        @keyframes leaderboardPulse {
          0% { background-color: rgba(44,159,212,.25); }
          100% { background-color: transparent; }
        }
        .leaderboard-highlight {
          animation: leaderboardPulse 2s ease-out forwards;
        }
      `}</style>

      {/* League management */}
      {currentUserId && (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "0 32px 70px" }}>
          {leagues.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "24px 28px" }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>👥</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "#11151C", margin: 0 }}>
                    Compete with friends
                  </p>
                  <p style={{ fontSize: 13, color: "#8B8676", margin: "2px 0 0" }}>
                    Create or join a league to see a filtered leaderboard.
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2" style={{ gap: 16 }}>
                <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    style={inputStyle}
                    placeholder="League name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    maxLength={80}
                    required
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <button type="submit" disabled={isPending} style={{ ...btnAccent, opacity: isPending ? 0.7 : 1 }}>
                    {isPending ? "Creating…" : "Create League"}
                  </button>
                  {createError && <p style={{ fontSize: 13, color: "#B23A48", margin: 0 }}>{createError}</p>}
                  {createFeedback && <p style={{ fontSize: 13, color: "#1F9E5A", fontWeight: 600, margin: 0 }}>{createFeedback}</p>}
                </form>
                <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    style={{ ...inputStyle, fontFamily: "monospace", textTransform: "uppercase" }}
                    placeholder="Invite code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    required
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <button type="submit" disabled={isPending} style={{ ...btnAccent, opacity: isPending ? 0.7 : 1 }}>
                    {isPending ? "Joining…" : "Join League"}
                  </button>
                  {joinError && <p style={{ fontSize: 13, color: "#B23A48", margin: 0 }}>{joinError}</p>}
                  {joinFeedback && <p style={{ fontSize: 13, color: "#1F9E5A", fontWeight: 600, margin: 0 }}>{joinFeedback}</p>}
                </form>
              </div>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, overflow: "hidden" }}>
              <button
                onClick={() => setShowManage((v) => !v)}
                className="flex items-center justify-between w-full"
                style={{
                  padding: "16px 24px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#11151C",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                <span className="flex items-center gap-2.5">
                  <span style={{ fontSize: 16 }}>👥</span>
                  Manage Leagues
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ transform: showManage ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s" }}
                >
                  <path d="M4 6l4 4 4-4" stroke="#8B8676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showManage && (
                <div style={{ borderTop: "1px solid #EFEDE6" }}>
                  {/* League list */}
                  <div style={{ padding: "0 24px" }}>
                    {leagues.map((league, i) => (
                      <div
                        key={league.id}
                        className="flex items-center justify-between gap-3 flex-wrap"
                        style={{ padding: "14px 0", borderTop: i > 0 ? "1px solid #EFEDE6" : "none" }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: "#11151C", margin: 0 }}>
                            {league.name}
                          </p>
                          <p style={{ fontSize: 12, color: "#8B8676", margin: "2px 0 0" }}>
                            {league.member_count} member{league.member_count !== 1 ? "s" : ""} · Code:{" "}
                            <button
                              onClick={() => copyCode(league.invite_code, league.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                color: "var(--accent)",
                                padding: 0,
                                fontSize: 12,
                              }}
                              title="Copy invite code"
                            >
                              {copiedId === league.id ? "Copied!" : league.invite_code}
                            </button>
                          </p>
                        </div>
                        <button
                          onClick={() => handleLeave(league.id, league.name)}
                          disabled={isPending}
                          style={{
                            background: "none",
                            border: "1px solid #E4E1D8",
                            borderRadius: 8,
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#8B8676",
                            cursor: "pointer",
                            transition: "all .15s",
                            opacity: isPending ? 0.5 : 1,
                          }}
                        >
                          Leave
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Create / Join forms */}
                  <div className="grid sm:grid-cols-2" style={{ gap: 16, padding: "16px 24px 20px", borderTop: "1px solid #EFEDE6" }}>
                    <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8B8676" }}>
                        Create a league
                      </span>
                      <input
                        style={inputStyle}
                        placeholder="League name"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        maxLength={80}
                        required
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                      <button type="submit" disabled={isPending} style={{ ...btnAccent, opacity: isPending ? 0.7 : 1 }}>
                        {isPending ? "Creating…" : "Create League"}
                      </button>
                      {createError && <p style={{ fontSize: 13, color: "#B23A48", margin: 0 }}>{createError}</p>}
                      {createFeedback && <p style={{ fontSize: 13, color: "#1F9E5A", fontWeight: 600, margin: 0 }}>{createFeedback}</p>}
                    </form>
                    <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8B8676" }}>
                        Join a league
                      </span>
                      <input
                        style={{ ...inputStyle, fontFamily: "monospace", textTransform: "uppercase" }}
                        placeholder="Invite code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        required
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                      <button type="submit" disabled={isPending} style={{ ...btnAccent, opacity: isPending ? 0.7 : 1 }}>
                        {isPending ? "Joining…" : "Join League"}
                      </button>
                      {joinError && <p style={{ fontSize: 13, color: "#B23A48", margin: 0 }}>{joinError}</p>}
                      {joinFeedback && <p style={{ fontSize: 13, color: "#1F9E5A", fontWeight: 600, margin: 0 }}>{joinFeedback}</p>}
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
