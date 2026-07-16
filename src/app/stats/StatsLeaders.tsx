"use client";

import { useState, useMemo } from "react";

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
};

type ColDef = { key: string; label: string };

const TEAM_DEFAULT_COLS: ColDef[] = [
  { key: "tries", label: "Tries" },
  { key: "tackles", label: "Tackles" },
  { key: "metres", label: "Metres" },
  { key: "clean_breaks", label: "Clean Breaks" },
  { key: "possession_pct", label: "Poss %" },
  { key: "territory_pct", label: "Terr %" },
];

const TEAM_MORE_COLS: ColDef[] = [
  { key: "penalties_conceded", label: "Penalties Conceded" },
  { key: "turnovers_conceded", label: "Turnovers" },
  { key: "lineout_success", label: "Lineout Success" },
  { key: "scrum_success", label: "Scrum Success" },
  { key: "handling_errors", label: "Handling Errors" },
  { key: "offload", label: "Offloads" },
  { key: "carries_metres", label: "Carry Metres" },
  { key: "defenders_beaten", label: "Defenders Beaten" },
  { key: "kick_metres", label: "Kick Metres" },
  { key: "dominant_tackles", label: "Dominant Tackles" },
  { key: "missed_tackles", label: "Missed Tackles" },
  { key: "tackle_turnover", label: "Tackle Turnovers" },
];

const PLAYER_DEFAULT_COLS: ColDef[] = [
  { key: "tries", label: "Tries" },
  { key: "tackles", label: "Tackles" },
  { key: "metres", label: "Metres" },
  { key: "clean_breaks", label: "Clean Breaks" },
  { key: "games", label: "GP" },
  { key: "points", label: "Points" },
];

const PLAYER_MORE_COLS: ColDef[] = [
  { key: "defenders_beaten", label: "Defenders Beaten" },
  { key: "offload", label: "Offloads" },
  { key: "kick_penalty_good", label: "Penalty Goals" },
  { key: "conversion_goals", label: "Conversions" },
  { key: "missed_tackles", label: "Missed Tackles" },
  { key: "tackle_turnover", label: "Turnovers Won" },
  { key: "lineouts_won", label: "Lineouts Won" },
  { key: "kick_metres", label: "Kick Metres" },
  { key: "dominant_tackles", label: "Dominant Tackles" },
  { key: "carries_metres", label: "Carry Metres" },
  { key: "line_break_assists", label: "Line Break Assists" },
  { key: "kicks_from_hand", label: "Kicks From Hand" },
];

const TH: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#9AA1AD",
  whiteSpace: "nowrap",
  cursor: "pointer",
  userSelect: "none",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  color: "#11151C",
  whiteSpace: "nowrap",
};

function SelectDropdown({
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
        border: "1px solid #E4E1D8",
        background: "#fff",
        fontSize: 14,
        fontWeight: 600,
        color: "#11151C",
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

function swapCol(current: ColDef[], morePool: ColDef[], addKey: string): ColDef[] {
  const col = morePool.find((c) => c.key === addKey);
  if (!col || current.some((c) => c.key === addKey)) return current;
  return [...current.slice(0, -1), col];
}

export default function StatsLeaders({
  teams,
  players,
  teamNames,
}: {
  teams: TeamAgg[];
  players: PlayerAgg[];
  teamNames: string[];
}) {
  // Team Stats state
  const [teamFilter, setTeamFilter] = useState("all");
  const [teamCols, setTeamCols] = useState<ColDef[]>(TEAM_DEFAULT_COLS);
  const [teamSortKey, setTeamSortKey] = useState("tries");
  const [teamMoreOpen, setTeamMoreOpen] = useState(false);

  // Player Stats state
  const [playerTeamFilter, setPlayerTeamFilter] = useState("all");
  const [playerCols, setPlayerCols] = useState<ColDef[]>(PLAYER_DEFAULT_COLS);
  const [playerSortKey, setPlayerSortKey] = useState("tries");
  const [playerMoreOpen, setPlayerMoreOpen] = useState(false);

  const filteredTeams = useMemo(() => {
    const list = teamFilter === "all" ? teams : teams.filter((t) => t.teamName === teamFilter);
    return [...list].sort(
      (a, b) => (b.stats[teamSortKey] ?? 0) - (a.stats[teamSortKey] ?? 0)
    );
  }, [teams, teamFilter, teamSortKey]);

  const filteredPlayers = useMemo(() => {
    const list =
      playerTeamFilter === "all"
        ? players
        : players.filter((p) => p.teamName === playerTeamFilter);
    if (playerSortKey === "games") {
      return [...list].sort((a, b) => b.games - a.games).slice(0, 20);
    }
    return [...list]
      .sort((a, b) => (b.stats[playerSortKey] ?? 0) - (a.stats[playerSortKey] ?? 0))
      .slice(0, 20);
  }, [players, playerTeamFilter, playerSortKey]);

  const teamMoreAvailable = TEAM_MORE_COLS.filter(
    (c) => !teamCols.some((tc) => tc.key === c.key)
  );
  const playerMoreAvailable = PLAYER_MORE_COLS.filter(
    (c) => !playerCols.some((pc) => pc.key === c.key)
  );

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  TEAM STATS                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section id="team-stats" className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 10px" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
          <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
          <a href="#team-stats" className="no-underline">
            <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
              Team Stats
            </h2>
          </a>
        </div>

        <div className="flex flex-wrap gap-3" style={{ marginBottom: 14 }}>
          <SelectDropdown value={teamFilter} onChange={setTeamFilter}>
            <option value="all">All Teams</option>
            {teamNames.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </SelectDropdown>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setTeamMoreOpen((o) => !o)}
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
              More Stats {teamMoreOpen ? "▲" : "▼"}
            </button>
            {teamMoreOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #E4E1D8",
                  borderRadius: 12,
                  boxShadow: "0 4px 16px rgba(0,0,0,.1)",
                  zIndex: 20,
                  minWidth: 200,
                  padding: "6px 0",
                }}
              >
                {teamMoreAvailable.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => {
                      setTeamCols((prev) => swapCol(prev, TEAM_MORE_COLS.concat(TEAM_DEFAULT_COLS), col.key));
                      setTeamMoreOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 16px",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#11151C",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(var(--accent-rgb,217,165,33),.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    {col.label}
                  </button>
                ))}
                {teamMoreAvailable.length === 0 && (
                  <div style={{ padding: "8px 16px", color: "#8B8676", fontSize: 13 }}>All stats shown</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #E4E1D8",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0D1016" }}>
                  <th style={{ ...TH, textAlign: "left", color: "#9AA1AD", cursor: "default" }}>#</th>
                  <th style={{ ...TH, textAlign: "left", color: "#9AA1AD", cursor: "default" }}>Team</th>
                  <th style={{ ...TH, textAlign: "center", color: "#9AA1AD", cursor: "default" }}>GP</th>
                  {teamCols.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => setTeamSortKey(col.key)}
                      style={{
                        ...TH,
                        textAlign: "right",
                        color: teamSortKey === col.key ? "var(--accent)" : "#9AA1AD",
                      }}
                    >
                      {col.label} {teamSortKey === col.key ? "▼" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((t, i) => (
                  <tr key={t.teamName} style={{ borderTop: "1px solid #EFEDE6" }}>
                    <td style={{ ...TD, fontWeight: 700, width: 40 }}>{i + 1}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{t.teamName}</td>
                    <td style={{ ...TD, textAlign: "center", color: "#5A6371" }}>{t.games}</td>
                    {teamCols.map((col) => (
                      <td
                        key={col.key}
                        className={teamSortKey === col.key ? "font-display" : ""}
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontWeight: teamSortKey === col.key ? 700 : 400,
                          fontSize: teamSortKey === col.key ? 16 : 14,
                        }}
                      >
                        {col.key.includes("pct")
                          ? `${(t.stats[col.key] ?? 0).toFixed(1)}%`
                          : (t.stats[col.key] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td colSpan={3 + teamCols.length} style={{ padding: "20px 18px", textAlign: "center", color: "#8B8676" }}>
                      No team data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  PLAYER STATS                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section id="player-stats" className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 20px" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
          <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
          <a href="#player-stats" className="no-underline">
            <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
              Player Stats
            </h2>
          </a>
        </div>

        <div className="flex flex-wrap gap-3" style={{ marginBottom: 14 }}>
          <SelectDropdown value={playerTeamFilter} onChange={setPlayerTeamFilter}>
            <option value="all">All Teams</option>
            {teamNames.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </SelectDropdown>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setPlayerMoreOpen((o) => !o)}
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
              More Stats {playerMoreOpen ? "▲" : "▼"}
            </button>
            {playerMoreOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #E4E1D8",
                  borderRadius: 12,
                  boxShadow: "0 4px 16px rgba(0,0,0,.1)",
                  zIndex: 20,
                  minWidth: 200,
                  padding: "6px 0",
                }}
              >
                {playerMoreAvailable.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => {
                      setPlayerCols((prev) => swapCol(prev, PLAYER_MORE_COLS.concat(PLAYER_DEFAULT_COLS), col.key));
                      setPlayerMoreOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 16px",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#11151C",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(var(--accent-rgb,217,165,33),.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    {col.label}
                  </button>
                ))}
                {playerMoreAvailable.length === 0 && (
                  <div style={{ padding: "8px 16px", color: "#8B8676", fontSize: 13 }}>All stats shown</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #E4E1D8",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0D1016" }}>
                  <th style={{ ...TH, textAlign: "left", color: "#9AA1AD", cursor: "default" }}>#</th>
                  <th style={{ ...TH, textAlign: "left", color: "#9AA1AD", cursor: "default" }}>Player</th>
                  <th style={{ ...TH, textAlign: "left", color: "#9AA1AD", cursor: "default" }}>Team</th>
                  {playerCols.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => setPlayerSortKey(col.key)}
                      style={{
                        ...TH,
                        textAlign: "right",
                        color: playerSortKey === col.key ? "var(--accent)" : "#9AA1AD",
                      }}
                    >
                      {col.label} {playerSortKey === col.key ? "▼" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #EFEDE6" }}>
                    <td style={{ ...TD, fontWeight: 700, width: 40 }}>{i + 1}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{p.name}</td>
                    <td style={{ ...TD, color: "#5A6371" }}>{p.teamName}</td>
                    {playerCols.map((col) => (
                      <td
                        key={col.key}
                        className={playerSortKey === col.key ? "font-display" : ""}
                        style={{
                          ...TD,
                          textAlign: "right",
                          fontWeight: playerSortKey === col.key ? 700 : 400,
                          fontSize: playerSortKey === col.key ? 16 : 14,
                        }}
                      >
                        {col.key === "games" ? p.games : (p.stats[col.key] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={3 + playerCols.length} style={{ padding: "20px 18px", textAlign: "center", color: "#8B8676" }}>
                      No player data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
