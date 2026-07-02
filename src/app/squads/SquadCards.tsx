"use client";

import { useState } from "react";
import Image from "next/image";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Player } from "@/lib/supabase/types";

type TeamWithPlayers = { team: Team; players: Player[] };

function PlayerAvatar({ player, className }: { player: Player; className?: string }) {
  const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();
  if (player.photo_url) {
    return (
      <Image
        src={player.photo_url}
        alt={`${player.first_name} ${player.last_name}`}
        width={40}
        height={40}
        className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 ${className ?? ""}`}
        style={{ borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      className={`shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-[11px] sm:text-[13px] ${className ?? ""}`}
      style={{
        borderRadius: "50%",
        background: "#E4E1D8",
        fontWeight: 700,
        color: "#8B8676",
      }}
    >
      {initials}
    </span>
  );
}

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
                        gridTemplateColumns: "50px 48px 1fr 140px",
                        padding: "10px 22px",
                        borderBottom: "1px solid #EFEDE6",
                        background: "#FAF9F5",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C" }}>
                        #
                      </span>
                      <span />
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
                        className="flex items-center gap-3 sm:grid"
                        style={{
                          gridTemplateColumns: "50px 48px 1fr 140px",
                          padding: "10px 22px",
                          borderBottom: idx < players.length - 1 ? "1px solid #F0EDE5" : "none",
                          alignItems: "center",
                        }}
                      >
                        <span
                          className="font-display shrink-0"
                          style={{
                            fontSize: 16,
                            color: team.colour || "var(--accent)",
                            fontWeight: 700,
                            width: 30,
                          }}
                        >
                          {player.jersey_number}
                        </span>
                        <PlayerAvatar player={player} />
                        <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14, fontWeight: 600, color: "#11151C" }}>
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
