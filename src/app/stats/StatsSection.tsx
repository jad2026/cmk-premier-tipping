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
  rounds2026: RoundData[];
  defaultRound2026: number;
  statsData: {
    season2025: SeasonData;
    season2026: SeasonData;
  };
  canToggleSeason: boolean;
};

export default function StatsSection({
  rounds2026,
  defaultRound2026,
  statsData,
  canToggleSeason,
}: Props) {
  const [season, setSeason] = useState<"2026" | "2025">("2026");
  const [rounds2025, setRounds2025] = useState<RoundData[] | null>(null);
  const [loading2025, setLoading2025] = useState(false);
  const max2025Round = rounds2025 && rounds2025.length > 0 ? Math.max(...rounds2025.map((r) => r.number)) : 1;
  const [selectedRound2025, setSelectedRound2025] = useState(max2025Round);
  const [selectedRound2026, setSelectedRound2026] = useState(defaultRound2026);

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
          setSelectedRound2025(Math.max(...rounds.map((r) => r.number)));
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

  const selectedRound2025Data = rounds2025?.find((r) => r.number === selectedRound2025);
  const selectedRound2026Data = rounds2026.find((r) => r.number === selectedRound2026);

  const showMatchCentre2026 = activeSeason === "2026" && selectedRound2026Data && selectedRound2026Data.fixtures.length > 0;
  const showMatchCentre2025 = activeSeason === "2025" && selectedRound2025Data && selectedRound2025Data.fixtures.length > 0;

  const selectStyle = {
    padding: "6px 28px 6px 12px",
    borderRadius: 8,
    border: "1px solid #D1CCC0",
    background: "#fff",
    fontSize: 13,
    fontWeight: 700,
    color: "#11151C",
    cursor: "pointer",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%23666' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
  };

  return (
    <>
      {/* 2026 Match Centre */}
      {showMatchCentre2026 && (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 0" }}>
          {rounds2026.length > 1 && (
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <div className="shrink-0" style={{ width: 20, height: 3, borderRadius: 2, background: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#11151C" }}>
                Match Centre
              </span>
              <div style={{ marginLeft: "auto" }}>
                <select
                  value={selectedRound2026}
                  onChange={(e) => setSelectedRound2026(Number(e.target.value))}
                  style={selectStyle}
                >
                  {rounds2026.map((r) => (
                    <option key={r.number} value={r.number}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <MatchCentre
            fixtures={selectedRound2026Data!.fixtures}
            roundLabel={selectedRound2026Data!.label}
            roundDate={null}
            disablePolling={selectedRound2026Data!.fixtures.every(
              (f) => f.status.type === "fulltime" || f.status.type === "pre"
            )}
          />
        </section>
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
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div className="shrink-0" style={{ width: 20, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#11151C" }}>
              2025 Match Centre
            </span>
            <div style={{ marginLeft: "auto" }}>
              <select
                value={selectedRound2025}
                onChange={(e) => setSelectedRound2025(Number(e.target.value))}
                style={selectStyle}
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
            fixtures={selectedRound2025Data.fixtures}
            roundLabel={null}
            roundDate={null}
            disablePolling
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
