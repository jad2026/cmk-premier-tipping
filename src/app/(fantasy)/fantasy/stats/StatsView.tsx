"use client";

import { useState, useMemo } from "react";
import type { StatPlayer, GameweekInfo } from "./page";

type SortKey =
  | "name"
  | "points"
  | "minutes"
  | "tries"
  | "tryAssists"
  | "conversionGoals"
  | "penaltyGoals"
  | "tackles"
  | "dominantTackles"
  | "carries"
  | "metresCarried"
  | "lineBreaks"
  | "turnoversWon";

type Column = {
  key: SortKey;
  label: string;
  short: string;
  width: number;
  accent?: boolean;
};

const COLUMNS: Column[] = [
  { key: "points", label: "Points", short: "Pts", width: 52, accent: true },
  { key: "minutes", label: "Minutes", short: "Min", width: 44 },
  { key: "tries", label: "Tries", short: "T", width: 36 },
  { key: "tryAssists", label: "Try Assists", short: "TA", width: 36 },
  { key: "conversionGoals", label: "Conversions", short: "Con", width: 40 },
  { key: "penaltyGoals", label: "Penalty Goals", short: "PG", width: 36 },
  { key: "tackles", label: "Tackles", short: "Tck", width: 40 },
  { key: "dominantTackles", label: "Dominant Tackles", short: "DTk", width: 40 },
  { key: "carries", label: "Carries", short: "Car", width: 40 },
  { key: "metresCarried", label: "Metres Carried", short: "Mtr", width: 44 },
  { key: "lineBreaks", label: "Line Breaks", short: "LB", width: 36 },
  { key: "turnoversWon", label: "Turnovers Won", short: "TO", width: 36 },
];

const POSITIONS = [
  "All",
  "Prop",
  "Hooker",
  "Lock",
  "Loose Forward",
  "Halfback",
  "First Five",
  "Centre",
  "Outside Back",
];

type AggPlayer = {
  playerId: string;
  name: string;
  teamName: string;
  position: string;
  points: number;
  minutes: number;
  tries: number;
  tryAssists: number;
  conversionGoals: number;
  penaltyGoals: number;
  tackles: number;
  dominantTackles: number;
  carries: number;
  metresCarried: number;
  lineBreaks: number;
  turnoversWon: number;
};

type Props = {
  players: StatPlayer[];
  gameweeks: GameweekInfo[];
};

export default function StatsView({ players, gameweeks }: Props) {
  const [selectedGw, setSelectedGw] = useState<string>("overall");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("All");

  const mostRecentGw = gameweeks[gameweeks.length - 1]?.id ?? "overall";

  const activeGw = selectedGw === "overall"
    ? "overall"
    : gameweeks.find((g) => g.id === selectedGw)
      ? selectedGw
      : mostRecentGw;

  const aggregated = useMemo(() => {
    const filtered =
      activeGw === "overall"
        ? players
        : players.filter((p) => p.gameweekId === activeGw);

    const byPlayer = new Map<string, AggPlayer>();
    for (const p of filtered) {
      const existing = byPlayer.get(p.playerId);
      if (existing) {
        existing.points += p.points;
        existing.minutes += p.minutes;
        existing.tries += p.tries;
        existing.tryAssists += p.tryAssists;
        existing.conversionGoals += p.conversionGoals;
        existing.penaltyGoals += p.penaltyGoals;
        existing.tackles += p.tackles;
        existing.dominantTackles += p.dominantTackles;
        existing.carries += p.carries;
        existing.metresCarried += p.metresCarried;
        existing.lineBreaks += p.lineBreaks;
        existing.turnoversWon += p.turnoversWon;
      } else {
        byPlayer.set(p.playerId, {
          playerId: p.playerId,
          name: p.name,
          teamName: p.teamName,
          position: p.position,
          points: p.points,
          minutes: p.minutes,
          tries: p.tries,
          tryAssists: p.tryAssists,
          conversionGoals: p.conversionGoals,
          penaltyGoals: p.penaltyGoals,
          tackles: p.tackles,
          dominantTackles: p.dominantTackles,
          carries: p.carries,
          metresCarried: p.metresCarried,
          lineBreaks: p.lineBreaks,
          turnoversWon: p.turnoversWon,
        });
      }
    }
    return Array.from(byPlayer.values());
  }, [players, activeGw]);

  const displayed = useMemo(() => {
    let list = aggregated;

    if (posFilter !== "All") {
      list = list.filter((p) => p.position === posFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q)
      );
    }

    const sorted = [...list].sort((a, b) => {
      if (sortKey === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortAsc ? cmp : -cmp;
      }
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });

    return sorted;
  }, [aggregated, posFilter, search, sortKey, sortAsc]);

  const totalPlayers = aggregated.length;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  const isEmpty = players.length === 0;

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        background: "#0B0E13",
        minHeight: "100vh",
        color: "#fff",
        paddingBottom: 1,
      }}
    >
      {/* ── Hero ── */}
      <section style={{ background: "#0B0E13" }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1100, padding: "48px 24px 24px" }}
        >
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <div
              className="shrink-0"
              style={{ width: 24, height: 3, borderRadius: 2, background: "#2C9FD4" }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: "#C7CCD4",
              }}
            >
              Fantasy Rugby
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 40, lineHeight: 0.9, margin: 0 }}
          >
            Player Stats<span style={{ color: "#2C9FD4" }}>.</span>
          </h1>
          <p
            style={{
              color: "#8C93A0",
              fontSize: 14,
              marginTop: 12,
              maxWidth: 540,
              lineHeight: 1.6,
            }}
          >
            Detailed fantasy stats for every player in the competition.
          </p>
          <div className="flex items-center gap-4" style={{ marginTop: 8 }}>
            <a
              href="/fantasy/picker"
              style={{
                color: "#2C9FD4",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              Pick your squad &rarr;
            </a>
            <a
              href="/fantasy/leaderboard"
              style={{
                color: "#2C9FD4",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              Leaderboard &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ── Round chips ── */}
      <section
        style={{
          background: "#0D1016",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="mx-auto"
          style={{ maxWidth: 1100, padding: "12px 24px" }}
        >
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGw("overall")}
              className="font-display uppercase"
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".06em",
                borderRadius: 6,
                border:
                  activeGw === "overall"
                    ? "1px solid #2C9FD4"
                    : "1px solid rgba(255,255,255,0.1)",
                background:
                  activeGw === "overall"
                    ? "rgba(44,159,212,0.12)"
                    : "transparent",
                color: activeGw === "overall" ? "#2C9FD4" : "#8C93A0",
                cursor: "pointer",
              }}
            >
              Overall
            </button>
            {gameweeks.map((gw) => (
              <button
                key={gw.id}
                onClick={() => setSelectedGw(gw.id)}
                className="font-display uppercase"
                style={{
                  padding: "6px 14px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  borderRadius: 6,
                  border:
                    activeGw === gw.id
                      ? "1px solid #2C9FD4"
                      : "1px solid rgba(255,255,255,0.1)",
                  background:
                    activeGw === gw.id
                      ? "rgba(44,159,212,0.12)"
                      : "transparent",
                  color: activeGw === gw.id ? "#2C9FD4" : "#8C93A0",
                  cursor: "pointer",
                }}
              >
                {gw.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filters ── */}
      <section style={{ background: "#0B0E13" }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1100, padding: "16px 24px 0" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search player or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: "1 1 200px",
                maxWidth: 320,
                padding: "8px 14px",
                fontSize: 13,
                background: "#161B24",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#fff",
                outline: "none",
              }}
            />
            <select
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                fontSize: 13,
                background: "#161B24",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#C7CCD4",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === "All" ? "All positions" : pos}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: "#5A6371", marginLeft: "auto" }}>
              {displayed.length} of {totalPlayers} players
            </span>
          </div>
        </div>
      </section>

      {/* ── Table ── */}
      <section style={{ background: "#0B0E13" }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1100, padding: "16px 24px 80px" }}
        >
          {isEmpty ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#5A6371",
                fontSize: 15,
              }}
            >
              No scored data yet. Stats appear after rounds are scored.
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 8 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 900,
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <th
                      onClick={() => handleSort("name")}
                      style={{
                        ...thStyle,
                        textAlign: "left",
                        minWidth: 160,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      Player{sortKey === "name" ? (sortAsc ? " ▲" : " ▼") : ""}
                    </th>
                    <th style={{ ...thStyle, textAlign: "left", minWidth: 80 }}>
                      Team
                    </th>
                    <th style={{ ...thStyle, textAlign: "left", minWidth: 70 }}>
                      Pos
                    </th>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        title={col.label}
                        style={{
                          ...thStyle,
                          width: col.width,
                          textAlign: "right",
                          cursor: "pointer",
                          userSelect: "none",
                          color: col.accent ? "#2C9FD4" : undefined,
                        }}
                      >
                        {col.short}
                        {sortKey === col.key ? (sortAsc ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((p) => (
                    <tr
                      key={p.playerId}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 600,
                          color: "#C7CCD4",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.name}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#8C93A0",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.teamName}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#5A6371",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.position}
                      </td>
                      {COLUMNS.map((col) => {
                        const val = p[col.key] as number;
                        return (
                          <td
                            key={col.key}
                            style={{
                              ...tdStyle,
                              textAlign: "right",
                              fontWeight: col.accent ? 700 : 400,
                              color: col.accent
                                ? "#2C9FD4"
                                : val > 0
                                  ? "#8FBC8F"
                                  : "#5A6371",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {col.key === "points"
                              ? val % 1 === 0
                                ? val
                                : val.toFixed(1)
                              : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#5A6371",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 13,
};
