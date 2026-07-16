"use client";

import { useState } from "react";
import TeamBadge from "@/components/TeamBadge";
import type { Team } from "@/lib/supabase/types";

export default function TeamMarquee({ teams }: { teams: Team[] }) {
  const [paused, setPaused] = useState(false);

  if (teams.length === 0) return null;

  // Duplicate for seamless loop
  const track = [...teams, ...teams];

  const trackStyle: React.CSSProperties = {
    animation: "sponsor-scroll 6s linear infinite",
    animationPlayState: paused ? "paused" : "running",
  };

  return (
    <div
      className="overflow-hidden py-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex"
        style={{
          WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="flex items-center shrink-0" style={trackStyle}>
          {track.map((team, i) => (
            <div key={`${team.id}-${i}`} className="px-4 shrink-0 opacity-80 hover:opacity-100 transition-opacity" title={team.name}>
              <TeamBadge team={team} size="lg" />
            </div>
          ))}
        </div>
        <div className="flex items-center shrink-0" style={trackStyle} aria-hidden>
          {track.map((team, i) => (
            <div key={`dup-${team.id}-${i}`} className="px-4 shrink-0 opacity-80 hover:opacity-100 transition-opacity" title={team.name}>
              <TeamBadge team={team} size="lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
