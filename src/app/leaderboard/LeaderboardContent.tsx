"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import TeamBadge from "@/components/TeamBadge";
import LeaderboardTable from "./LeaderboardTable";
import { createLeague, joinLeague, leaveLeague } from "../leagues/actions";

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
};

type Props = {
  leaderboard: LeaderboardRow[];
  leagues: LeagueInfo[];
  currentUserId: string | null;
  marginPicking: boolean;
  showSupportedTeam: boolean;
  noRoundsPlayed: boolean;
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
      className="relative overflow-hidden"
      style={{
        background: isFirst ? "#0D1016" : "#fff",
        border: `1px solid ${isFirst ? "#0D1016" : "#E4E1D8"}`,
        borderRadius: 18,
        padding: "24px 22px",
        ...(isFirst ? { transform: "translateY(-14px)" } : {}),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 18,
          fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
          fontSize: 46,
          lineHeight: 1,
          color: isFirst ? "var(--accent)" : "rgba(17,21,28,.10)",
          opacity: 0.9,
        }}
      >
        {rank}
      </div>

      {entry.avatarUrl ? (
        <div className="mb-4">
          <Avatar url={entry.avatarUrl} name={entry.displayName} size={54} />
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-full mb-4"
          style={{
            width: 54,
            height: 54,
            background: AVATAR_COLORS[colorIdx],
            fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
            fontSize: 18,
            color: "#fff",
          }}
        >
          {initials(entry.displayName)}
        </div>
      )}

      <div
        className="font-display uppercase"
        style={{ fontSize: 21, lineHeight: 1, color: isFirst ? "#fff" : "#11151C" }}
      >
        {entry.displayName}
      </div>

      <div style={{ fontSize: 13, color: isFirst ? "#9AA1AD" : "#8B8676", marginTop: 6, fontWeight: 600 }}>
        {pct(entry.manualCorrect, entry.manualTotal)} accuracy
      </div>

      <div className="flex items-baseline gap-2" style={{ marginTop: 18 }}>
        <span
          className="font-display"
          style={{ fontSize: 38, lineHeight: 1, color: isFirst ? "var(--accent)" : "#11151C" }}
        >
          {entry.totalScore}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: isFirst ? "#9AA1AD" : "#8B8676" }}>
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
}: Props) {
  const [selectedLeague, setSelectedLeague] = useState("overall");
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

  const filtered =
    selectedLeague === "overall"
      ? leaderboard
      : leaderboard.filter((e) => {
          const league = leagues.find((l) => l.id === selectedLeague);
          return league?.memberUserIds.includes(e.user_id);
        });

  const sorted = [...filtered].sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.correct - a.correct ||
      b.total - a.total ||
      a.displayName.localeCompare(b.displayName)
  );

  const ranks: number[] = [];
  let rank = 0;
  let prevScore = -1;
  for (const entry of sorted) {
    if (entry.totalScore !== prevScore) {
      rank++;
      prevScore = entry.totalScore;
    }
    ranks.push(rank);
  }

  const podiumEntries =
    sorted.length >= 3 ? [sorted[1], sorted[0], sorted[2]] : [];

  const gridCls = marginPicking
    ? "grid-cols-[28px_1fr_32px_32px_38px_34px_36px] sm:grid-cols-[54px_1fr_64px_64px_68px_56px_68px]"
    : "grid-cols-[28px_1fr_28px_38px_34px_36px] sm:grid-cols-[54px_1fr_76px_68px_56px_68px]";

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
        </div>
      )}

      {/* Podium */}
      {podiumEntries.length === 3 && !noRoundsPlayed && (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "34px 32px 16px" }}>
          <div className="grid grid-cols-3 items-end" style={{ gap: 16 }}>
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
      <section className="mx-auto" style={{ maxWidth: 1100, padding: "18px 32px 40px" }}>
        {noRoundsPlayed && (
          <div
            className="flex items-center gap-3"
            style={{ borderRadius: 14, background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "14px 20px", marginBottom: 18 }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>🏉</span>
            <p style={{ fontSize: 14, color: "#1E40AF", fontWeight: 600, margin: 0 }}>
              No rounds played yet — scores will appear here once the first round is complete.
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
              className={`grid gap-x-1 sm:gap-x-2 ${gridCls}`}
              style={{
                padding: "15px 22px",
                background: "#0D1016",
                color: "#9AA1AD",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: ".1em",
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

            <LeaderboardTable totalCount={sorted.length}>
              {sorted.map((entry, idx) => {
                const isYou = currentUserId === entry.user_id;
                const displayRank = ranks[idx];
                const colorIdx = entry.displayName.charCodeAt(0) % AVATAR_COLORS.length;

                return (
                  <div
                    key={entry.user_id}
                    className={`grid gap-x-1 sm:gap-x-2 ${gridCls}`}
                    style={{
                      alignItems: "center",
                      padding: "15px 22px",
                      borderTop: "1px solid #EFEDE6",
                      background: isYou ? "var(--accent-wash, rgba(217,165,33,.10))" : "#fff",
                      borderLeft: isYou ? "3px solid var(--accent)" : "3px solid transparent",
                    }}
                  >
                    <span
                      className="font-display"
                      style={{ fontSize: 16, color: displayRank <= 3 ? "var(--accent)" : "#11151C" }}
                    >
                      {displayRank}
                    </span>

                    <span className="flex items-center" style={{ gap: 12 }}>
                      {entry.avatarUrl ? (
                        <Avatar url={entry.avatarUrl} name={entry.displayName} size={34} />
                      ) : (
                        <span
                          className="flex items-center justify-center rounded-full shrink-0"
                          style={{
                            width: 34,
                            height: 34,
                            background: isYou ? "var(--accent)" : AVATAR_COLORS[colorIdx],
                            fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                            fontSize: 12,
                            color: "#fff",
                          }}
                        >
                          {initials(entry.displayName)}
                        </span>
                      )}
                      <span className="flex flex-col">
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#11151C" }}>
                          {entry.displayName}
                        </span>
                      </span>
                      {showSupportedTeam && entry.supportedTeam && (
                        <TeamBadge team={entry.supportedTeam} size="xs" />
                      )}
                      {isYou && (
                        <span
                          style={{
                            marginLeft: 4,
                            padding: "3px 9px",
                            borderRadius: 999,
                            background: "var(--accent)",
                            color: "var(--accent-text, #11151C)",
                            fontSize: 10,
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
                        <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: entry.correct > 0 ? "#11151C" : "#C7C2B5" }}>
                          {entry.correct}
                        </span>
                        <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: entry.marginBonus > 0 ? "#1F9E5A" : "#C7C2B5" }}>
                          {entry.marginBonus}
                        </span>
                      </>
                    ) : (
                      <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: entry.thisRoundCorrect !== null ? "#1F9E5A" : "#C7C2B5" }}>
                        {entry.thisRoundCorrect !== null ? entry.thisRoundCorrect : "—"}
                      </span>
                    )}

                    <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                      {pct(entry.manualCorrect, entry.manualTotal)}
                    </span>

                    <span style={{ textAlign: "center", fontSize: 14, color: entry.manualTotal > 0 ? "#5A6371" : "#C7C2B5" }}>
                      {entry.manualTotal > 0 ? entry.manualTotal : "—"}
                    </span>

                    <span
                      className="font-display"
                      style={{ textAlign: "right", fontSize: 18, color: "#11151C" }}
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
