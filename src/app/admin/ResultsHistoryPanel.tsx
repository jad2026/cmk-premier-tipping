"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchResultsHistory, type RoundHistoryRow } from "./actions";

export default function ResultsHistoryPanel() {
  const [rounds, setRounds] = useState<RoundHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const { data, error } = await fetchResultsHistory();
      setRounds(data);
      setError(error);
    });
  }, []);

  if (isPending) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading results…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (rounds.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No results entered yet.</p>;
  }

  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <div key={round.gameweekId} className="card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-brand-gold shrink-0" />
            <h3 className="text-sm font-bold text-brand">{round.label}</h3>
            <span className="ml-auto text-xs text-gray-400">
              {round.fixtures.length} fixture{round.fixtures.length !== 1 ? "s" : ""}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fixture</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Winner</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Correct / Total</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {round.fixtures.map((f) => {
                const pct = f.totalPicks > 0
                  ? Math.round((f.correctPicks / f.totalPicks) * 100)
                  : 0;
                return (
                  <tr key={f.fixtureId} className="hover:bg-gray-50/40">
                    <td className="px-5 py-3 text-gray-700">
                      {f.homeTeam} <span className="text-gray-400">vs</span> {f.awayTeam}
                    </td>
                    <td className="px-5 py-3 font-semibold text-brand">
                      {f.winner ?? <span className="text-gray-400 font-normal">Draw</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {f.correctPicks}/{f.totalPicks}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        pct >= 50 ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"
                      }`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
