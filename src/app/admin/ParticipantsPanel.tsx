"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchParticipants, type ParticipantRow } from "./actions";

export default function ParticipantsPanel({ timezone, locale }: { timezone: string; locale: string }) {
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{rows.length} registered participant{rows.length !== 1 ? "s" : ""}</p>
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
