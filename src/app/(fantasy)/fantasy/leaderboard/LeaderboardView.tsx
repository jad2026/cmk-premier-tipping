"use client";

import { useState } from "react";
import type { LeaderboardEntry, GameweekInfo } from "./page";

type Props = {
  entries: LeaderboardEntry[];
  gameweeks: GameweekInfo[];
};

export default function LeaderboardView({ entries, gameweeks }: Props) {
  const [tab, setTab] = useState<"overall" | "round">("overall");
  const [selectedGw, setSelectedGw] = useState<string>(
    gameweeks[0]?.id ?? ""
  );

  const overallRanked = [...entries].sort(
    (a, b) => b.totalPoints - a.totalPoints
  );

  const roundRanked = selectedGw
    ? [...entries]
        .filter((e) => e.rounds[selectedGw] != null)
        .sort((a, b) => (b.rounds[selectedGw] ?? 0) - (a.rounds[selectedGw] ?? 0))
    : [];

  const isEmpty = entries.length === 0;

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
          style={{ maxWidth: 760, padding: "48px 24px 24px" }}
        >
          <div
            className="flex items-center gap-3"
            style={{ marginBottom: 14 }}
          >
            <div
              className="shrink-0"
              style={{
                width: 24,
                height: 3,
                borderRadius: 2,
                background: "#2C9FD4",
              }}
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
            Leaderboard<span style={{ color: "#2C9FD4" }}>.</span>
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
            See how you stack up against the competition.
          </p>
          <a
            href="/fantasy/picker"
            style={{
              color: "#2C9FD4",
              fontSize: 12,
              fontWeight: 600,
              marginTop: 8,
              display: "inline-block",
              textDecoration: "none",
            }}
          >
            Pick your squad &rarr;
          </a>
        </div>
      </section>

      {/* ── Tabs ── */}
      <section
        style={{
          background: "#0D1016",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="mx-auto flex"
          style={{ maxWidth: 760, padding: "0 24px" }}
        >
          {(["overall", "round"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="font-display uppercase"
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 12,
                letterSpacing: ".08em",
                color: tab === t ? "#fff" : "#5A6371",
                background: "transparent",
                border: "none",
                borderBottom:
                  tab === t
                    ? "2px solid #2C9FD4"
                    : "2px solid transparent",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {t === "overall" ? "Overall" : "By Round"}
            </button>
          ))}
        </div>
      </section>

      {/* ── Content ── */}
      <section style={{ background: "#0B0E13" }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 760, padding: "24px 24px 80px" }}
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
              No scores yet. Points are updated after each round.
            </div>
          ) : tab === "overall" ? (
            <RankingTable
              rows={overallRanked.map((e, i) => ({
                rank: i + 1,
                name: e.displayName,
                points: e.totalPoints,
              }))}
            />
          ) : (
            <>
              {/* ── Round selector ── */}
              <div
                className="flex flex-wrap gap-2"
                style={{ marginBottom: 20 }}
              >
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
                        selectedGw === gw.id
                          ? "1px solid #2C9FD4"
                          : "1px solid rgba(255,255,255,0.1)",
                      background:
                        selectedGw === gw.id
                          ? "rgba(44,159,212,0.12)"
                          : "transparent",
                      color: selectedGw === gw.id ? "#2C9FD4" : "#8C93A0",
                      cursor: "pointer",
                    }}
                  >
                    {gw.label}
                  </button>
                ))}
              </div>

              {roundRanked.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#5A6371",
                    fontSize: 14,
                  }}
                >
                  No scores for this round.
                </div>
              ) : (
                <RankingTable
                  rows={roundRanked.map((e, i) => ({
                    rank: i + 1,
                    name: e.displayName,
                    points: e.rounds[selectedGw] ?? 0,
                  }))}
                />
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Ranking table ── */

function RankingTable({
  rows,
}: {
  rows: { rank: number; name: string; points: number }[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      {/* Header */}
      <div
        className="flex items-center"
        style={{
          padding: "10px 16px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "#5A6371",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span style={{ width: 48 }}>#</span>
        <span style={{ flex: 1 }}>Name</span>
        <span style={{ width: 80, textAlign: "right" }}>Pts</span>
      </div>

      {/* Rows */}
      {rows.map((row) => (
        <div
          key={`${row.rank}-${row.name}`}
          className="flex items-center"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background:
              row.rank <= 3 ? "rgba(44,159,212,0.04)" : "transparent",
          }}
        >
          <span
            style={{
              width: 48,
              fontWeight: 700,
              fontSize: 14,
              color: row.rank <= 3 ? "#2C9FD4" : "#5A6371",
            }}
          >
            {row.rank}
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: "#C7CCD4",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.name}
          </span>
          <span
            style={{
              width: 80,
              textAlign: "right",
              fontWeight: 700,
              fontSize: 14,
              color: "#fff",
            }}
          >
            {row.points}
          </span>
        </div>
      ))}
    </div>
  );
}
