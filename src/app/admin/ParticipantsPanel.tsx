"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchParticipants, flagSuspectedBots, type ParticipantRow } from "./actions";

export default function ParticipantsPanel({ timezone, locale }: { timezone: string; locale: string }) {
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [botResult, setBotResult] = useState<{ flagged: number; names: string[] } | null>(null);
  const [botRunning, setBotRunning] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const { data, error } = await fetchParticipants();
      setRows(data);
      setError(error);
    });
  }, []);

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: timezone,
    });
  }

  if (isPending) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading participants…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No participants yet.</p>;
  }

  async function handleFlagBots() {
    setBotRunning(true);
    setBotResult(null);
    try {
      const result = await flagSuspectedBots();
      setBotResult(result);
    } catch {
      setBotResult({ flagged: 0, names: [] });
    } finally {
      setBotRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{rows.length} registered participant{rows.length !== 1 ? "s" : ""}</p>
        <button
          onClick={handleFlagBots}
          disabled={botRunning}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            border: "1px solid #E4E1D8",
            background: botRunning ? "#F4F2EC" : "#fff",
            color: botRunning ? "#8B8676" : "#B23A48",
            cursor: botRunning ? "wait" : "pointer",
          }}
        >
          {botRunning ? "Scanning…" : "Flag Suspected Bots"}
        </button>
      </div>
      {botResult && (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid #E4E1D8",
            background: botResult.flagged > 0 ? "#FDF5F5" : "#F4F9F4",
            padding: "12px 16px",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: botResult.flagged > 0 ? "#B23A48" : "#2D7A3A", margin: 0 }}>
            {botResult.flagged === 0
              ? "No new bots detected."
              : `Flagged ${botResult.flagged} suspected bot${botResult.flagged !== 1 ? "s" : ""}: ${botResult.names.join(", ")}`}
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Team Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Rounds</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Correct</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{r.displayName}</td>
                <td className="px-4 py-3 text-gray-500">{r.email}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(r.joinedAt)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.roundsSubmitted}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand">{r.totalCorrect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
