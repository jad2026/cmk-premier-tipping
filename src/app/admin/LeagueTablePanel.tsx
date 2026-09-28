"use client";

import { useMemo, useState, useTransition } from "react";
import { parseLeagueResults, parseLeagueTable, type ParseIssue } from "@/lib/manualLadder";
import { saveLeagueResults, saveManualLadder } from "./leagueTableActions";

type RoundOption = { id: string; number: number; label: string };

const TABLE_PLACEHOLDER = `Pos  Team            P  W  D  L  PF   PA   PD   TB  LB  Pts
1    Bridlington     10 9  0  1  350  120  230  8   1   45
2    Wensleydale     10 8  0  2  301  150  151  6   1   39`;

const RESULTS_PLACEHOLDER = `Bridlington 47 - 31 Wensleydale
Malton & Norton 22-19 Scarborough`;

function Issues({ issues }: { issues: ParseIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
      {issues.map((e, i) => (
        <li key={i}>
          {e.line > 0 && <span className="font-semibold">Line {e.line}: </span>}
          {e.message} — <code className="font-mono">{e.text}</code>
        </li>
      ))}
    </ul>
  );
}

function SaveStatus({ status }: { status: { ok: boolean; message: string } | null }) {
  if (!status) return null;
  return <p className={`text-sm font-semibold ${status.ok ? "text-green-700" : "text-red-600"}`}>{status.message}</p>;
}

const textareaClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand resize-y";
const buttonClass =
  "px-5 py-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60";

export default function LeagueTablePanel({ rounds }: { rounds: RoundOption[] }) {
  const [isPending, startTransition] = useTransition();

  // ── League table ──
  const [tableText, setTableText] = useState("");
  const [tableStatus, setTableStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const table = useMemo(() => parseLeagueTable(tableText), [tableText]);

  function handleSaveTable() {
    setTableStatus(null);
    startTransition(async () => {
      const res = await saveManualLadder(tableText);
      setTableStatus(res.error ? { ok: false, message: res.error } : { ok: true, message: `Saved ${res.saved} teams.` });
    });
  }

  // ── Round results ──
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");
  const [resultsText, setResultsText] = useState("");
  const [resultsStatus, setResultsStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const parsedResults = useMemo(() => parseLeagueResults(resultsText), [resultsText]);

  function handleSaveResults() {
    setResultsStatus(null);
    startTransition(async () => {
      const res = await saveLeagueResults(roundId, resultsText);
      setResultsStatus(res.error ? { ok: false, message: res.error } : { ok: true, message: `Saved ${res.saved} results.` });
    });
  }

  return (
    <div className="space-y-10">
      {/* a) League table */}
      <section className="space-y-3">
        <h3 className="font-display uppercase text-lg">Paste league table</h3>
        <p className="text-xs text-gray-500">
          Copy the table from the England Rugby site and paste it here. Header rows are ignored. Saving replaces this
          competition&apos;s whole table.
        </p>
        <textarea
          value={tableText}
          onChange={(e) => { setTableText(e.target.value); setTableStatus(null); }}
          rows={10}
          placeholder={TABLE_PLACEHOLDER}
          className={textareaClass}
          spellCheck={false}
        />
        <Issues issues={table.errors} />
        {table.rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {["Pos", "Team", "P", "W", "D", "L", "PF", "PA", "PD", "BP", "Pts"].map((h) => (
                    <th key={h} className={`px-2 py-1.5 font-semibold ${h === "Team" ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={r.team_name} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 text-right">{r.position}</td>
                    <td className="px-2 py-1.5 font-semibold">{r.team_name}</td>
                    <td className="px-2 py-1.5 text-right">{r.matches_played}</td>
                    <td className="px-2 py-1.5 text-right">{r.matches_won}</td>
                    <td className="px-2 py-1.5 text-right">{r.matches_drawn}</td>
                    <td className="px-2 py-1.5 text-right">{r.matches_lost}</td>
                    <td className="px-2 py-1.5 text-right">{r.points_for}</td>
                    <td className="px-2 py-1.5 text-right">{r.points_against}</td>
                    <td className="px-2 py-1.5 text-right">{r.points_diff > 0 ? `+${r.points_diff}` : r.points_diff}</td>
                    <td className="px-2 py-1.5 text-right">{r.bonus_points}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{r.match_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveTable}
            disabled={isPending || table.rows.length === 0 || table.errors.length > 0}
            className={buttonClass}
          >
            {isPending ? "Saving…" : `Save table${table.rows.length ? ` (${table.rows.length} teams)` : ""}`}
          </button>
          <SaveStatus status={tableStatus} />
        </div>
      </section>

      {/* b) Round results */}
      <section className="space-y-3">
        <h3 className="font-display uppercase text-lg">Paste round results</h3>
        <p className="text-xs text-gray-500">
          One result per line, e.g. <code className="bg-gray-100 px-1 rounded">Home Team 47 - 31 Away Team</code>.
          Saving replaces all league results stored for that round.
        </p>
        <select
          value={roundId}
          onChange={(e) => { setRoundId(e.target.value); setResultsStatus(null); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {rounds.length === 0 && <option value="">No rounds yet</option>}
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <textarea
          value={resultsText}
          onChange={(e) => { setResultsText(e.target.value); setResultsStatus(null); }}
          rows={8}
          placeholder={RESULTS_PLACEHOLDER}
          className={textareaClass}
          spellCheck={false}
        />
        <Issues issues={parsedResults.errors} />
        {parsedResults.results.length > 0 && (
          <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
            {parsedResults.results.map((r, i) => {
              const homeWon = r.home_score > r.away_score;
              const awayWon = r.away_score > r.home_score;
              return (
                <li key={i} className="grid grid-cols-[1fr_auto_1fr] gap-3 px-3 py-1.5 tabular-nums">
                  <span className={`text-right ${homeWon ? "font-bold" : ""}`}>{r.home_team}</span>
                  <span className="font-mono">{r.home_score} – {r.away_score}</span>
                  <span className={awayWon ? "font-bold" : ""}>{r.away_team}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveResults}
            disabled={isPending || !roundId || parsedResults.results.length === 0 || parsedResults.errors.length > 0}
            className={buttonClass}
          >
            {isPending ? "Saving…" : `Save results${parsedResults.results.length ? ` (${parsedResults.results.length})` : ""}`}
          </button>
          <SaveStatus status={resultsStatus} />
        </div>
      </section>
    </div>
  );
}
