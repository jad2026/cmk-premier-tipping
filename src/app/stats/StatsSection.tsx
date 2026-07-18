"use client";

import { useState, useEffect, useCallback } from "react";
import MatchCentre from "./MatchCentre";
import StatsLeaders from "./StatsLeaders";
import type { MatchFixture } from "./matchCentreTypes";
import type { SeasonData } from "./StatsLeaders";

export type RoundData = {
  number: number;
  label: string;
  fixtures: MatchFixture[];
};

type Props = {
  matchCentre2026: {
    fixtures: MatchFixture[];
    round1Label: string | null;
    round1Date: string | null;
  } | null;
  statsData: {
    season2025: SeasonData;
    season2026: SeasonData;
  };
  canToggleSeason: boolean;
};

export default function StatsSection({
  matchCentre2026,
  statsData,
  canToggleSeason,
}: Props) {
  const [season, setSeason] = useState<"2026" | "2025">("2026");
  const [rounds2025, setRounds2025] = useState<RoundData[] | null>(null);
  const [loading2025, setLoading2025] = useState(false);
  const maxRound = rounds2025 && rounds2025.length > 0 ? Math.max(...rounds2025.map((r) => r.number)) : 1;
  const [selectedRound, setSelectedRound] = useState(maxRound);

  const activeSeason = canToggleSeason ? season : "2026";

  const fetch2025 = useCallback(async () => {
    if (rounds2025 || loading2025) return;
    setLoading2025(true);
    try {
      const res = await fetch("/api/stats/2025-fixtures");
      if (res.ok) {
        const data = await res.json();
        const rounds = data.rounds as RoundData[];
        setRounds2025(rounds);
        if (rounds.length > 0) {
          setSelectedRound(Math.max(...rounds.map((r) => r.number)));
        }
      }
    } finally {
      setLoading2025(false);
    }
  }, [rounds2025, loading2025]);

  useEffect(() => {
    if (activeSeason === "2025" && !rounds2025 && !loading2025) {
      fetch2025();
    }
  }, [activeSeason, rounds2025, loading2025, fetch2025]);

  const selectedRoundData = rounds2025?.find((r) => r.number === selectedRound);

  const showMatchCentre2026 = activeSeason === "2026" && matchCentre2026 && matchCentre2026.fixtures.length > 0;
  const showMatchCentre2025 = activeSeason === "2025" && selectedRoundData && selectedRoundData.fixtures.length > 0;

  return (
    <>
      {/* Match Centre */}
      {showMatchCentre2026 && (
        <MatchCentre
          fixtures={matchCentre2026.fixtures}
          round1Label={matchCentre2026.round1Label}
          round1Date={matchCentre2026.round1Date}
        />
      )}

      {activeSeason === "2025" && loading2025 && (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 0" }}>
          <div className="text-center" style={{ padding: "40px 0", color: "#5A6371" }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Loading 2025 season data...</p>
          </div>
        </section>
      )}

      {showMatchCentre2025 && (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 0" }}>
          {/* Round selector */}
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div className="shrink-0" style={{ width: 20, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#11151C" }}>
              2025 Match Centre
            </span>
            <div style={{ marginLeft: "auto" }}>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                style={{
                  padding: "6px 28px 6px 12px",
                  borderRadius: 8,
                  border: "1px solid #D1CCC0",
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#11151C",
                  cursor: "pointer",
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%23666' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
              >
                {rounds2025!.map((r) => (
                  <option key={r.number} value={r.number}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <MatchCentre
            fixtures={selectedRoundData.fixtures}
            round1Label={null}
            round1Date={null}
          />
        </section>
      )}

      {/* Stats Leaders */}
      {(statsData.season2025 || statsData.season2026) && (
        <div style={{ background: "#0D1117" }}>
          <StatsLeaders
            season2025={statsData.season2025}
            season2026={statsData.season2026}
            season={canToggleSeason ? activeSeason : undefined}
            onSeasonChange={canToggleSeason ? setSeason : undefined}
          />
        </div>
      )}
    </>
  );
}
