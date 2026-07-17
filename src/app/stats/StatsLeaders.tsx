"use client";

import { useState, useMemo, useRef, useEffect } from "react";

export type TeamAgg = {
  teamName: string;
  games: number;
  stats: Record<string, number>;
};

export type PlayerAgg = {
  name: string;
  teamName: string;
  games: number;
  stats: Record<string, number>;
  position: string;
};

type StatDef = { key: string; label: string };
type StatGroup = { label: string; stats: StatDef[] };

const TEAM_DEFAULT_STATS: StatDef[] = [
  { key: "tries", label: "Tries Scored" },
  { key: "tackles", label: "Tackles Made" },
  { key: "metres", label: "Metres Gained" },
  { key: "clean_breaks", label: "Clean Breaks" },
  { key: "possession_pct", label: "Possession %" },
  { key: "territory_pct", label: "Territory %" },
];

const TEAM_ALL_GROUPS: StatGroup[] = [
  {
    label: "Attack",
    stats: [
      { key: "tries", label: "Tries" },
      { key: "carries_metres", label: "Carries" },
      { key: "clean_breaks", label: "Clean Breaks" },
      { key: "defenders_beaten", label: "Defenders Beaten" },
      { key: "offload", label: "Offloads" },
      { key: "line_break_assists", label: "Line Break Assists" },
      { key: "try_assists", label: "Try Assists" },
      { key: "runs", label: "Runs" },
    ],
  },
  {
    label: "Defence",
    stats: [
      { key: "tackles", label: "Tackles" },
      { key: "dominant_tackles", label: "Dominant Tackles" },
      { key: "missed_tackles", label: "Missed Tackles" },
      { key: "tackle_turnover", label: "Tackle Turnovers" },
      { key: "turnover_won", label: "Turnovers Won" },
      { key: "tackle_success", label: "Tackle Success" },
    ],
  },
  {
    label: "Kicking",
    stats: [
      { key: "kicks", label: "Kicks" },
      { key: "kick_metres", label: "Kick Metres" },
      { key: "points", label: "Points" },
      { key: "kick_penalty_good", label: "Penalty Goals" },
      { key: "conversion_goals", label: "Conversions" },
    ],
  },
  {
    label: "Set Piece",
    stats: [
      { key: "lineouts_won", label: "Lineouts Won" },
      { key: "lineout_success", label: "Lineout Success" },
      { key: "total_lineouts", label: "Total Lineouts" },
      { key: "scrums_won_outright", label: "Scrums Won" },
    ],
  },
  {
    label: "General",
    stats: [
      { key: "penalties_conceded", label: "Penalties Conceded" },
      { key: "handling_errors", label: "Handling Errors" },
      { key: "turnovers_conceded", label: "Turnovers Conceded" },
    ],
  },
];

const PLAYER_DEFAULT_STATS: StatDef[] = [
  { key: "tries", label: "Tries" },
  { key: "tackles", label: "Tackles" },
  { key: "metres", label: "Metres" },
  { key: "clean_breaks", label: "Clean Breaks" },
  { key: "defenders_beaten", label: "Defenders Beaten" },
  { key: "points", label: "Points" },
];

const PLAYER_ALL_GROUPS: StatGroup[] = [
  {
    label: "Attack",
    stats: [
      { key: "tries", label: "Tries" },
      { key: "carries_metres", label: "Carries" },
      { key: "clean_breaks", label: "Clean Breaks" },
      { key: "defenders_beaten", label: "Defenders Beaten" },
      { key: "offload", label: "Offloads" },
      { key: "line_break_assists", label: "Line Break Assists" },
      { key: "try_assists", label: "Try Assists" },
      { key: "runs", label: "Runs" },
    ],
  },
  {
    label: "Defence",
    stats: [
      { key: "tackles", label: "Tackles" },
      { key: "dominant_tackles", label: "Dominant Tackles" },
      { key: "missed_tackles", label: "Missed Tackles" },
      { key: "tackle_turnover", label: "Tackle Turnovers" },
      { key: "turnover_won", label: "Turnovers Won" },
    ],
  },
  {
    label: "Kicking",
    stats: [
      { key: "kicks", label: "Kicks" },
      { key: "kick_metres", label: "Kick Metres" },
      { key: "points", label: "Points" },
      { key: "kick_penalty_good", label: "Penalty Goals" },
      { key: "conversion_goals", label: "Conversions" },
    ],
  },
  {
    label: "Set Piece",
    stats: [
      { key: "lineouts_won", label: "Lineouts Won" },
      { key: "lineout_success", label: "Lineout Success" },
      { key: "total_lineouts", label: "Total Lineouts" },
      { key: "scrums_won_outright", label: "Scrums Won" },
    ],
  },
  {
    label: "General",
    stats: [
      { key: "minutes_played_total", label: "Minutes Played" },
      { key: "penalties_conceded", label: "Penalties Conceded" },
      { key: "handling_errors", label: "Handling Errors" },
    ],
  },
];

const TEAM_SWAP_POOL: StatDef[] = TEAM_ALL_GROUPS.flatMap((g) => g.stats);
const PLAYER_SWAP_POOL: StatDef[] = PLAYER_ALL_GROUPS.flatMap((g) => g.stats);

const TEAM_PROFILE_GROUPS = TEAM_ALL_GROUPS;
const PLAYER_PROFILE_GROUPS = PLAYER_ALL_GROUPS;

function formatPlayerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function formatStatValue(key: string, value: number): string {
  if (key.includes("pct") || key.includes("success")) return `${value.toFixed(1)}%`;
  return String(Math.round(value));
}

function DropdownPicker({
  open,
  onToggle,
  label,
  items,
  onSelect,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  items: StatDef[];
  onSelect: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5"
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.06)",
          fontSize: 13,
          fontWeight: 600,
          color: "#ccc",
          cursor: "pointer",
        }}
      >
        {label} <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && items.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            background: "#1A1E27",
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.4)",
            zIndex: 30,
            minWidth: 200,
            padding: "6px 0",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {items.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                onSelect(s.key);
                onToggle();
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 16px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 500,
                color: "#ddd",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(44,159,212,.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DarkSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "8px 14px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.06)",
        fontSize: 13,
        fontWeight: 600,
        color: "#ccc",
        cursor: "pointer",
        appearance: "none",
        paddingRight: 28,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
      }}
    >
      {children}
    </select>
  );
}

const TOGGLE_BTN: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
  fontSize: 13,
  fontWeight: 600,
  color: "#ccc",
  cursor: "pointer",
};

function MiniLeaderCard({
  stat,
  rows,
}: {
  stat: StatDef;
  rows: { rank: number; name: string; value: string; position?: string; teamName?: string }[];
}) {
  return (
    <div
      style={{
        background: "#0B0E13",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "2px solid #2C9FD4",
          background: "rgba(44,159,212,.08)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "#2C9FD4",
          }}
        >
          {stat.label}
        </span>
      </div>
      <div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center"
            style={{
              padding: "8px 16px",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,.05)" : "none",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 20,
                fontSize: 12,
                fontWeight: 700,
                color: i === 0 ? "#2C9FD4" : "#666",
                flexShrink: 0,
              }}
            >
              {r.rank}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: i === 0 ? 700 : 500,
                  color: i === 0 ? "#fff" : "#bbb",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.name}
              </div>
              {(r.position || r.teamName) && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#556",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}
                >
                  {[r.position, r.teamName].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <span
              className="font-display"
              style={{
                fontSize: i === 0 ? 16 : 14,
                fontWeight: 700,
                color: i === 0 ? "#fff" : "#999",
                flexShrink: 0,
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: "16px", textAlign: "center", color: "#555", fontSize: 13 }}>
            No data
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryHeader({ label }: { label: string }) {
  return (
    <div
      className="col-span-1 sm:col-span-2 lg:col-span-3"
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "#556",
        paddingTop: 14,
        paddingBottom: 4,
        borderBottom: "1px solid rgba(255,255,255,.06)",
        marginBottom: -4,
      }}
    >
      {label}
    </div>
  );
}

function ProfileStatRow({
  label,
  value,
  rank,
  total,
}: {
  label: string;
  value: string;
  rank: number;
  total: number;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,.05)",
      }}
    >
      <span style={{ fontSize: 13, color: "#aaa", fontWeight: 500 }}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
          {value}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: rank <= 3 ? "#2C9FD4" : "#666",
            background: rank <= 3 ? "rgba(44,159,212,.12)" : "rgba(255,255,255,.05)",
            padding: "2px 8px",
            borderRadius: 6,
          }}
        >
          {rank}/{total}
        </span>
      </div>
    </div>
  );
}

function TeamCardGrid({
  groups,
  rankings,
}: {
  groups: StatGroup[];
  rankings: Record<string, { name: string; value: number; rank: number }[]>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {groups.map((group) => (
        <React.Fragment key={group.label}>
          <CategoryHeader label={group.label} />
          {group.stats.map((stat) => {
            const ranked = rankings[stat.key] ?? [];
            return (
              <MiniLeaderCard
                key={stat.key}
                stat={stat}
                rows={ranked.slice(0, 5).map((r) => ({
                  rank: r.rank,
                  name: r.name,
                  value: formatStatValue(stat.key, r.value),
                }))}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function PlayerCardGrid({
  groups,
  rankings,
  teamFilter,
}: {
  groups: StatGroup[];
  rankings: Record<string, { name: string; fullName: string; teamName: string; position: string; value: number; rank: number }[]>;
  teamFilter: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {groups.map((group) => (
        <React.Fragment key={group.label}>
          <CategoryHeader label={group.label} />
          {group.stats.map((stat) => {
            let ranked = rankings[stat.key] ?? [];
            if (teamFilter !== "all") {
              ranked = ranked.filter((r) => r.teamName === teamFilter);
            }
            return (
              <MiniLeaderCard
                key={stat.key}
                stat={stat}
                rows={ranked.slice(0, 5).map((r, i) => ({
                  rank: i + 1,
                  name: r.name,
                  position: r.position,
                  teamName: r.teamName,
                  value: formatStatValue(stat.key, r.value),
                }))}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

import React from "react";

export default function StatsLeaders({
  teams,
  players,
  teamNames,
}: {
  teams: TeamAgg[];
  players: PlayerAgg[];
  teamNames: string[];
}) {
  const [teamFilter, setTeamFilter] = useState("all");
  const [teamVisibleStats, setTeamVisibleStats] = useState<StatDef[]>(TEAM_DEFAULT_STATS);
  const [teamMoreOpen, setTeamMoreOpen] = useState(false);
  const [showAllTeamStats, setShowAllTeamStats] = useState(false);

  const [playerTeamFilter, setPlayerTeamFilter] = useState("all");
  const [playerFilter, setPlayerFilter] = useState("all");
  const [playerVisibleStats, setPlayerVisibleStats] = useState<StatDef[]>(PLAYER_DEFAULT_STATS);
  const [playerMoreOpen, setPlayerMoreOpen] = useState(false);
  const [showAllPlayerStats, setShowAllPlayerStats] = useState(false);

  const allStatKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const g of TEAM_ALL_GROUPS) for (const s of g.stats) keys.add(s.key);
    for (const g of PLAYER_ALL_GROUPS) for (const s of g.stats) keys.add(s.key);
    for (const s of TEAM_DEFAULT_STATS) keys.add(s.key);
    for (const s of PLAYER_DEFAULT_STATS) keys.add(s.key);
    return Array.from(keys);
  }, []);

  const teamRankings = useMemo(() => {
    const rankings: Record<string, { name: string; value: number; rank: number }[]> = {};
    for (const key of allStatKeys) {
      const sorted = [...teams].sort(
        (a, b) => (b.stats[key] ?? 0) - (a.stats[key] ?? 0)
      );
      rankings[key] = sorted.map((t, i) => ({
        name: t.teamName,
        value: t.stats[key] ?? 0,
        rank: i + 1,
      }));
    }
    return rankings;
  }, [teams, allStatKeys]);

  const playerRankings = useMemo(() => {
    const rankings: Record<string, { name: string; fullName: string; teamName: string; position: string; value: number; rank: number }[]> = {};
    for (const key of allStatKeys) {
      const sorted = [...players].sort(
        (a, b) => (b.stats[key] ?? 0) - (a.stats[key] ?? 0)
      );
      rankings[key] = sorted.map((p, i) => ({
        name: formatPlayerName(p.name),
        fullName: p.name,
        teamName: p.teamName,
        position: p.position,
        value: p.stats[key] ?? 0,
        rank: i + 1,
      }));
    }
    return rankings;
  }, [players, allStatKeys]);

  const selectedTeam = teamFilter !== "all" ? teams.find((t) => t.teamName === teamFilter) : null;

  const playersForTeam = useMemo(
    () =>
      playerTeamFilter === "all"
        ? []
        : players.filter((p) => p.teamName === playerTeamFilter),
    [players, playerTeamFilter]
  );

  const selectedPlayer =
    playerFilter !== "all" ? players.find((p) => p.name === playerFilter) : null;

  const teamMoreAvailable = useMemo(
    () =>
      TEAM_SWAP_POOL.filter(
        (s) => !teamVisibleStats.some((v) => v.key === s.key)
      ),
    [teamVisibleStats]
  );

  const playerMoreAvailable = useMemo(
    () =>
      PLAYER_SWAP_POOL.filter(
        (s) => !playerVisibleStats.some((v) => v.key === s.key)
      ),
    [playerVisibleStats]
  );

  function swapTeamStat(newKey: string) {
    const stat = TEAM_SWAP_POOL.find((s) => s.key === newKey);
    if (!stat || teamVisibleStats.some((s) => s.key === newKey)) return;
    setTeamVisibleStats((prev) => [...prev.slice(0, -1), stat]);
  }

  function swapPlayerStat(newKey: string) {
    const stat = PLAYER_SWAP_POOL.find((s) => s.key === newKey);
    if (!stat || playerVisibleStats.some((s) => s.key === newKey)) return;
    setPlayerVisibleStats((prev) => [...prev.slice(0, -1), stat]);
  }

  function getTeamRank(teamName: string, statKey: string): number {
    const list = teamRankings[statKey];
    if (!list) return teams.length;
    const entry = list.find((r) => r.name === teamName);
    return entry?.rank ?? teams.length;
  }

  function getPlayerRank(playerName: string, statKey: string): number {
    const list = playerRankings[statKey];
    if (!list) return players.length;
    const entry = list.find((r) => r.fullName === playerName);
    return entry?.rank ?? players.length;
  }

  return (
    <>
      {/* TEAM STATS */}
      <section id="team-stats" className="mx-auto" style={{ maxWidth: 1100, padding: "30px 24px 10px" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
          <div
            className="shrink-0"
            style={{ width: 4, height: 24, borderRadius: 2, background: "#2C9FD4" }}
          />
          <a href="#team-stats" className="no-underline">
            <h2
              className="font-display uppercase"
              style={{ fontSize: 22, margin: 0, color: "#fff" }}
            >
              Team Stats
            </h2>
          </a>
        </div>

        <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
          <DarkSelect value={teamFilter} onChange={setTeamFilter}>
            <option value="all">All Teams</option>
            {teamNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </DarkSelect>

          {!selectedTeam && !showAllTeamStats && (
            <DropdownPicker
              open={teamMoreOpen}
              onToggle={() => setTeamMoreOpen((o) => !o)}
              label="More Stats"
              items={teamMoreAvailable}
              onSelect={swapTeamStat}
            />
          )}
          {!selectedTeam && (
            <button
              onClick={() => setShowAllTeamStats((o) => !o)}
              style={TOGGLE_BTN}
            >
              {showAllTeamStats ? "Show Less" : "Show All"}
            </button>
          )}
        </div>

        {selectedTeam ? (
          <div
            style={{
              background: "#0B0E13",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 16,
              padding: "20px 24px",
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h3
                className="font-display"
                style={{ fontSize: 20, margin: 0, color: "#fff" }}
              >
                {selectedTeam.teamName}
              </h3>
              <span style={{ fontSize: 12, color: "#666" }}>
                {selectedTeam.games} games played
              </span>
            </div>
            {TEAM_PROFILE_GROUPS.map((group) => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "#2C9FD4",
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: "1px solid rgba(44,159,212,.2)",
                  }}
                >
                  {group.label}
                </div>
                {group.stats.map((s) => (
                  <ProfileStatRow
                    key={s.key}
                    label={s.label}
                    value={formatStatValue(s.key, selectedTeam.stats[s.key] ?? 0)}
                    rank={getTeamRank(selectedTeam.teamName, s.key)}
                    total={teams.length}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : showAllTeamStats ? (
          <TeamCardGrid groups={TEAM_ALL_GROUPS} rankings={teamRankings} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamVisibleStats.map((stat) => {
              const ranked = teamRankings[stat.key] ?? [];
              return (
                <MiniLeaderCard
                  key={stat.key}
                  stat={stat}
                  rows={ranked.slice(0, 5).map((r) => ({
                    rank: r.rank,
                    name: r.name,
                    value: formatStatValue(stat.key, r.value),
                  }))}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* PLAYER STATS */}
      <section id="player-stats" className="mx-auto" style={{ maxWidth: 1100, padding: "30px 24px 20px" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
          <div
            className="shrink-0"
            style={{ width: 4, height: 24, borderRadius: 2, background: "#2C9FD4" }}
          />
          <a href="#player-stats" className="no-underline">
            <h2
              className="font-display uppercase"
              style={{ fontSize: 22, margin: 0, color: "#fff" }}
            >
              Player Stats
            </h2>
          </a>
        </div>

        <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
          <DarkSelect
            value={playerTeamFilter}
            onChange={(v) => {
              setPlayerTeamFilter(v);
              setPlayerFilter("all");
            }}
          >
            <option value="all">All Teams</option>
            {teamNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </DarkSelect>

          {playerTeamFilter !== "all" && (
            <DarkSelect value={playerFilter} onChange={setPlayerFilter}>
              <option value="all">All Players</option>
              {playersForTeam
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </DarkSelect>
          )}

          {!selectedPlayer && !showAllPlayerStats && (
            <DropdownPicker
              open={playerMoreOpen}
              onToggle={() => setPlayerMoreOpen((o) => !o)}
              label="More Stats"
              items={playerMoreAvailable}
              onSelect={swapPlayerStat}
            />
          )}
          {!selectedPlayer && (
            <button
              onClick={() => setShowAllPlayerStats((o) => !o)}
              style={TOGGLE_BTN}
            >
              {showAllPlayerStats ? "Show Less" : "Show All"}
            </button>
          )}
        </div>

        {selectedPlayer ? (
          <div
            style={{
              background: "#0B0E13",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 16,
              padding: "20px 24px",
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-3">
                <h3
                  className="font-display"
                  style={{ fontSize: 20, margin: 0, color: "#fff" }}
                >
                  {selectedPlayer.name}
                </h3>
                {selectedPlayer.position && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#2C9FD4",
                      background: "rgba(44,159,212,.12)",
                      padding: "3px 10px",
                      borderRadius: 6,
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                    }}
                  >
                    {selectedPlayer.position}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#666" }}>
                {selectedPlayer.teamName} &middot; {selectedPlayer.games} games
              </span>
            </div>
            {PLAYER_PROFILE_GROUPS.map((group) => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "#2C9FD4",
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: "1px solid rgba(44,159,212,.2)",
                  }}
                >
                  {group.label}
                </div>
                {group.stats.map((s) => (
                  <ProfileStatRow
                    key={s.key}
                    label={s.label}
                    value={formatStatValue(s.key, selectedPlayer.stats[s.key] ?? 0)}
                    rank={getPlayerRank(selectedPlayer.name, s.key)}
                    total={players.length}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : showAllPlayerStats ? (
          <PlayerCardGrid
            groups={PLAYER_ALL_GROUPS}
            rankings={playerRankings}
            teamFilter={playerTeamFilter}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {playerVisibleStats.map((stat) => {
              let ranked = playerRankings[stat.key] ?? [];
              if (playerTeamFilter !== "all") {
                ranked = ranked.filter((r) => r.teamName === playerTeamFilter);
              }
              return (
                <MiniLeaderCard
                  key={stat.key}
                  stat={stat}
                  rows={ranked.slice(0, 5).map((r, i) => ({
                    rank: i + 1,
                    name: r.name,
                    position: r.position,
                    value: formatStatValue(stat.key, r.value),
                  }))}
                />
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
