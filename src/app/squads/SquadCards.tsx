"use client";

import { useState } from "react";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Player } from "@/lib/supabase/types";

type TeamWithPlayers = { team: Team; players: Player[] };

export default function SquadCards({ teams }: { teams: TeamWithPlayers[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(teams.map((t) => t.team.id)));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {teams.map(({ team, players }) => {
        const expanded = open.has(team.id);
        return (
          <div
            key={team.id}
            style={{
              background: "#fff",
              border: "1px solid #E4E1D8",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {/* Team header */}
            <button
              onClick={() => toggle(team.id)}
              className="w-full flex items-center gap-3 text-left transition-colors"
              style={{
                padding: "16px 22px",
                background: expanded ? "#0D1016" : "#FAF9F5",
                borderBottom: expanded ? "none" : "1px solid #E4E1D8",
              }}
            >
              <TeamBadge team={team} size="md" />
              <span
                className="font-display uppercase flex-1 min-w-0 truncate"
                style={{
                  fontSize: 18,
                  color: expanded ? "#fff" : "#11151C",
                }}
              >
                {team.name}
              </span>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: expanded ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: expanded ? "#fff" : "#8B8676",
                }}
              >
                {players.length}
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: expanded ? "#8C93A0" : "#B4B0A2",
                  transition: "transform .2s",
                  transform: expanded ? "rotate(180deg)" : "rotate(0)",
                }}
              >
                ▼
              </span>
            </button>

            {/* Player list */}
            {expanded && (
              <div>
                {players.length === 0 ? (
                  <div style={{ padding: "28px 22px", textAlign: "center" }}>
                    <span style={{ fontSize: 14, color: "#8B8676", fontStyle: "italic" }}>
                      Squad not yet announced
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div
                      className="hidden sm:grid"
                      style={{
                        gridTemplateColumns: "60px 1fr 140px",
                        padding: "10px 22px",
                        borderBottom: "1px solid #EFEDE6",
                        background: "#FAF9F5",
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C" }}>
                        #
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C" }}>
                        Name
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C" }}>
                        Position
                      </span>
                    </div>

                    {players.map((player, idx) => (
                      <div
                        key={player.id}
                        className="grid"
                        style={{
                          gridTemplateColumns: "60px 1fr 140px",
                          padding: "10px 22px",
                          borderBottom: idx < players.length - 1 ? "1px solid #F0EDE5" : "none",
                          alignItems: "center",
                        }}
                      >
                        <span
                          className="font-display"
                          style={{
                            fontSize: 16,
                            color: team.colour || "var(--accent)",
                            fontWeight: 700,
                          }}
                        >
                          {player.jersey_number}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#11151C" }}>
                          {player.first_name} {player.last_name}
                        </span>
                        <span
                          className="hidden sm:block"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#8B8676",
                            textTransform: "uppercase",
                            letterSpacing: ".04em",
                          }}
                        >
                          {player.position}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
