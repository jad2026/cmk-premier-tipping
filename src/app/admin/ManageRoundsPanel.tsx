"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchRounds, setRoundOpen, autoFillRandomPicks, type RoundRow } from "./actions";
import FixtureListPanel from "./FixtureListPanel";
import type { Team } from "@/lib/supabase/types";

export default function ManageRoundsPanel({ teams, timezone, locale }: { teams: Team[]; timezone: string; locale: string }) {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fillingId, setFillingId] = useState<string | null>(null);

  function load() {
    startTransition(async () => {
      const { data, error } = await fetchRounds();
      if (error) setLoadError(error);
      else { setLoadError(null); setRounds(data); }
    });
  }

  useEffect(() => { load(); }, []);

  function toggle(round: RoundRow, open: boolean) {
    setActionError(null);
    setActionFeedback(null);
    startTransition(async () => {
      const { error } = await setRoundOpen(round.id, open);
      if (error) setActionError(error);
      else load();
    });
  }

  async function handleAutoFill(round: RoundRow) {
    setActionError(null);
    setActionFeedback(null);
    setFillingId(round.id);
    const { count, error } = await autoFillRandomPicks(round.id);
    setFillingId(null);
    if (error) {
      setActionError(error);
    } else {
      setActionFeedback(`Auto-filled ${count} pick${count !== 1 ? "s" : ""} for ${round.label}.`);
    }
  }

  function fmtDeadline(iso: string) {
    return new Date(iso).toLocaleString(locale, {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
        Failed to load rounds: {loadError}
      </div>
    );
  }

  if (rounds.length === 0 && !isPending) {
    return (
      <div className="card px-6 py-12 text-center">
        <span className="text-4xl mb-3 block">📅</span>
        <p className="font-medium text-gray-600">No rounds yet</p>
        <p className="text-sm text-gray-400 mt-1">Add fixtures first to create rounds.</p>
      </div>
    );
  }

  const gridCols = "3rem 1fr 10rem 8rem 7rem 7rem";

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      {actionFeedback && (
        <div style={{ borderRadius: 12, background: "rgba(31,158,90,.06)", border: "1px solid rgba(31,158,90,.15)", padding: "12px 16px" }}>
          <p style={{ fontSize: 14, color: "#1F9E5A", margin: 0 }}>{actionFeedback}</p>
        </div>
      )}

      <div className="card overflow-hidden divide-y divide-gray-50">
        {/* Header */}
        <div
          className="bg-brand text-white text-xs font-semibold uppercase tracking-wider"
          style={{ display: "grid", gridTemplateColumns: gridCols }}
        >
          <div className="px-4 py-3 text-center">#</div>
          <div className="px-4 py-3">Round</div>
          <div className="px-4 py-3">Deadline</div>
          <div className="px-4 py-3">Fixtures</div>
          <div className="px-4 py-3 text-center">Status</div>
          <div className="px-4 py-3 text-center">Auto-fill</div>
        </div>

        {rounds.map((round) => {
          const isCompleted = round.totalFixtures > 0 && round.resultedFixtures === round.totalFixtures;
          const deadlinePassed = new Date(round.deadline) < new Date();
          const canAutoFill = deadlinePassed && !isCompleted && round.totalFixtures > 0;

          return (
            <div
              key={round.id}
              className={`items-center transition-colors ${
                round.is_open ? "bg-green-50/60" : "bg-white hover:bg-gray-50/60"
              }`}
              style={{ display: "grid", gridTemplateColumns: gridCols }}
            >
              {/* # */}
              <div className="px-4 py-4 text-center">
                <span className="w-7 h-7 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center mx-auto tabular-nums">
                  {round.number}
                </span>
              </div>

              {/* Label */}
              <div className="px-4 py-4">
                <span className="text-sm font-medium text-gray-800">{round.label}</span>
              </div>

              {/* Deadline */}
              <div className="px-4 py-4">
                <span className="text-xs text-gray-500">{fmtDeadline(round.deadline)}</span>
              </div>

              {/* Fixtures */}
              <div className="px-4 py-4">
                <span className="text-xs text-gray-500">
                  {round.totalFixtures === 0
                    ? "No fixtures"
                    : isCompleted
                    ? `${round.totalFixtures}/${round.totalFixtures} results`
                    : round.resultedFixtures > 0
                    ? `${round.resultedFixtures}/${round.totalFixtures} results`
                    : `${round.totalFixtures} fixture${round.totalFixtures !== 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Status / action */}
              <div className="px-4 py-4 flex justify-center">
                {isCompleted ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-gold/15 text-brand-gold-dark whitespace-nowrap">
                    ✓ Completed
                  </span>
                ) : round.is_open ? (
                  <button
                    onClick={() => toggle(round, false)}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Close
                  </button>
                ) : (
                  <button
                    onClick={() => toggle(round, true)}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Open
                  </button>
                )}
              </div>

              {/* Auto-fill */}
              <div className="px-4 py-4 flex justify-center">
                {canAutoFill ? (
                  <button
                    onClick={() => handleAutoFill(round)}
                    disabled={fillingId === round.id || isPending}
                    style={{
                      border: "1px solid #E4E1D8",
                      borderRadius: 10,
                      padding: "6px 12px",
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                      background: "transparent",
                      color: "#11151C",
                      cursor: fillingId === round.id ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                      opacity: fillingId === round.id ? 0.6 : 1,
                      transition: "opacity .15s, border-color .15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; }}
                  >
                    {fillingId === round.id ? "Filling…" : "Fill Picks"}
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: "#C9C5B8" }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <span className="shrink-0" style={{ width: 4, height: 24, borderRadius: 2, background: "var(--accent)" }} />
          <h2 className="font-display uppercase" style={{ fontSize: 23, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>Fixtures</h2>
        </div>
        <FixtureListPanel teams={teams} timezone={timezone} locale={locale} />
      </div>
    </div>
  );
}
