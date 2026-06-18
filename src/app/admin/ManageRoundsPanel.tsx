"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchRounds, setRoundOpen, type RoundRow } from "./actions";

export default function ManageRoundsPanel() {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const { error } = await setRoundOpen(round.id, open);
      if (error) setActionError(error);
      else load();
    });
  }

  function fmtDeadline(iso: string) {
    return new Date(iso).toLocaleString("en-NZ", {
      timeZone: "Pacific/Auckland",
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

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="card overflow-hidden divide-y divide-gray-50">
        {/* Header */}
        <div className="grid grid-cols-[3rem_1fr_10rem_8rem_7rem] bg-brand text-white text-xs font-semibold uppercase tracking-wider">
          <div className="px-4 py-3 text-center">#</div>
          <div className="px-4 py-3">Round</div>
          <div className="px-4 py-3">Deadline</div>
          <div className="px-4 py-3">Fixtures</div>
          <div className="px-4 py-3 text-center">Status</div>
        </div>

        {rounds.map((round) => {
          const isCompleted = round.totalFixtures > 0 && round.resultedFixtures === round.totalFixtures;

          return (
            <div
              key={round.id}
              className={`grid grid-cols-[3rem_1fr_10rem_8rem_7rem] items-center transition-colors ${
                round.is_open ? "bg-green-50/60" : "bg-white hover:bg-gray-50/60"
              }`}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
