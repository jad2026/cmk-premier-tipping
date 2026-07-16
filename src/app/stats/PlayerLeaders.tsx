"use client";

import { useState, useMemo } from "react";

export type PlayerStat = {
  name: string;
  teamName: string;
  games: number;
  stats: Record<string, number>;
};

type CategoryDef = {
  label: string;
  tables: { title: string; statKey: string }[];
};

const CATEGORIES: Record<string, CategoryDef> = {
  attack: {
    label: "Attack",
    tables: [
      { title: "Top Try Scorers", statKey: "tries" },
      { title: "Most Metres Gained", statKey: "metres" },
      { title: "Most Clean Breaks", statKey: "clean_breaks" },
      { title: "Defenders Beaten", statKey: "defenders_beaten" },
    ],
  },
  defence: {
    label: "Defence",
    tables: [
      { title: "Top Tacklers", statKey: "tackles" },
      { title: "Dominant Tackles", statKey: "dominant_tackles" },
      { title: "Tackle Turnovers", statKey: "tackle_turnover" },
      { title: "Missed Tackles", statKey: "missed_tackles" },
    ],
  },
  kicking: {
    label: "Kicking",
    tables: [
      { title: "Penalty Goals", statKey: "kick_penalty_good" },
      { title: "Conversions", statKey: "conversion_goals" },
      { title: "Kick Metres", statKey: "kick_metres" },
      { title: "Kicks From Hand", statKey: "kicks_from_hand" },
    ],
  },
  set_piece: {
    label: "Set Piece",
    tables: [
      { title: "Lineout Success", statKey: "lineout_success" },
      { title: "Lineouts Won", statKey: "lineouts_won" },
      { title: "Total Lineouts", statKey: "total_lineouts" },
      { title: "Carries (Metres)", statKey: "carries_metres" },
    ],
  },
};

const TH: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#9AA1AD",
};

export default function PlayerLeaders({
  players,
  teamNames,
}: {
  players: PlayerStat[];
  teamNames: string[];
}) {
  const [team, setTeam] = useState("all");
  const [category, setCategory] = useState("attack");

  const filtered = useMemo(
    () => (team === "all" ? players : players.filter((p) => p.teamName === team)),
    [players, team]
  );

  const cat = CATEGORIES[category];

  return (
    <section className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 10px" }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
        <div
          className="shrink-0"
          style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }}
        />
        <h2
          className="font-display uppercase"
          style={{ fontSize: 22, margin: 0, color: "#11151C" }}
        >
          Season Leaders
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3" style={{ marginBottom: 18 }}>
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #E4E1D8",
            background: "#fff",
            fontSize: 14,
            fontWeight: 600,
            color: "#11151C",
            cursor: "pointer",
          }}
        >
          <option value="all">All Teams</option>
          {teamNames.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #E4E1D8",
            background: "#fff",
            fontSize: 14,
            fontWeight: 600,
            color: "#11151C",
            cursor: "pointer",
          }}
        >
          {Object.entries(CATEGORIES).map(([key, c]) => (
            <option key={key} value={key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 18 }}>
        {cat.tables.map(({ title, statKey }) => {
          const sorted = [...filtered]
            .sort((a, b) => (b.stats[statKey] ?? 0) - (a.stats[statKey] ?? 0))
            .slice(0, 10);

          return (
            <div
              key={title}
              style={{
                background: "#fff",
                border: "1px solid #E4E1D8",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 18px",
                  background: "rgba(var(--accent-rgb,217,165,33),.08)",
                  borderBottom: "2px solid var(--accent)",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                  }}
                >
                  {title}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #EFEDE6" }}>
                      <th style={{ padding: "10px 18px", textAlign: "left", ...TH }}>#</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", ...TH }}>Player</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", ...TH }}>Team</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", ...TH }}>GP</th>
                      <th style={{ padding: "10px 18px", textAlign: "right", ...TH }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: i < sorted.length - 1 ? "1px solid #EFEDE6" : "none",
                        }}
                      >
                        <td style={{ padding: "10px 18px", fontWeight: 700, color: "#11151C" }}>
                          {i + 1}
                        </td>
                        <td
                          style={{
                            padding: "10px 8px",
                            fontWeight: 600,
                            color: "#11151C",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </td>
                        <td style={{ padding: "10px 8px", color: "#5A6371", whiteSpace: "nowrap" }}>
                          {p.teamName}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", color: "#5A6371" }}>
                          {p.games}
                        </td>
                        <td
                          className="font-display"
                          style={{
                            padding: "10px 18px",
                            textAlign: "right",
                            fontSize: 18,
                            color: "#11151C",
                          }}
                        >
                          {p.stats[statKey] ?? 0}
                        </td>
                      </tr>
                    ))}
                    {sorted.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ padding: "20px 18px", textAlign: "center", color: "#8B8676" }}
                        >
                          No data available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
