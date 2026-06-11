"use client";

import { useState, useTransition } from "react";
import {
  parseAndMatch,
  groupByRound,
  type PreviewRow,
  type PreviewGroup,
  type RowStatus,
} from "./bulkImport";
import { bulkImportFixtures, type BulkFixtureRow } from "./actions";
import type { Team } from "@/lib/supabase/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const PLACEHOLDER = `Round 1
Coastal RFC vs Hawera RFC, 2026-07-11, Yarrow Stadium
Inglewood RFC vs Marist RFC, 2026-07-11

Round 2
Hawera RFC vs Inglewood RFC, 2026-07-18
Southern RFC vs Stratford RFC, 2026-07-18, TET Stadium`;

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-green-700 font-medium text-xs">
        <span className="text-base leading-none">✓</span> OK
      </span>
    );
  if (status === "warning")
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs">
        <span className="text-base leading-none">⚠</span> Fuzzy
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-red-600 font-medium text-xs">
      <span className="text-base leading-none">✕</span> Error
    </span>
  );
}

function TeamCell({
  rowIdx,
  side,
  team,
  rawName,
  status,
  teams,
  onOverride,
}: {
  rowIdx: number;
  side: "home" | "away";
  team: Team | null;
  rawName: string;
  status: RowStatus;
  teams: Team[];
  onOverride: (rowIdx: number, side: "home" | "away", teamId: string) => void;
}) {
  if (status === "ok" && team) {
    return (
      <span className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: team.colour }}
        />
        <span className="text-gray-800">{team.name}</span>
      </span>
    );
  }

  return (
    <div>
      {status === "warning" && team && (
        <p className="text-xs text-amber-600 mb-1">"{rawName}" → matched as:</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-500 mb-1">No match for "{rawName}":</p>
      )}
      <select
        value={team?.id ?? ""}
        onChange={(e) => onOverride(rowIdx, side, e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">— select team —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Round group card ─────────────────────────────────────────────────────────

function RoundGroupCard({
  group,
  teams,
  overrides,
  resolvedTeam,
  resolvedStatus,
  rowFinalStatus,
  applyOverride,
}: {
  group: PreviewGroup;
  teams: Team[];
  overrides: Record<number, { home?: string; away?: string }>;
  resolvedTeam: (row: PreviewRow, side: "home" | "away") => Team | null;
  resolvedStatus: (row: PreviewRow, side: "home" | "away") => RowStatus;
  rowFinalStatus: (row: PreviewRow) => RowStatus;
  applyOverride: (
    rowIdx: number,
    side: "home" | "away",
    teamId: string
  ) => void;
}) {
  const okCount = group.rows.filter((r) => rowFinalStatus(r) === "ok").length;
  const warnCount = group.rows.filter(
    (r) => rowFinalStatus(r) === "warning"
  ).length;
  const errCount = group.rows.filter(
    (r) => rowFinalStatus(r) === "error"
  ).length;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Group header */}
      <div className="flex items-center justify-between bg-brand px-4 py-2.5">
        <span className="font-semibold text-white text-sm">{group.label}</span>
        <div className="flex items-center gap-2 text-xs">
          {okCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-200 font-medium">
              {okCount} ok
            </span>
          )}
          {warnCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-medium">
              {warnCount} fuzzy
            </span>
          )}
          {errCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-400/20 text-red-200 font-medium">
              {errCount} error
            </span>
          )}
        </div>
      </div>

      {/* Fixtures table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Home team</th>
              <th className="px-3 py-2 text-center w-8 text-gray-300">vs</th>
              <th className="px-3 py-2 text-left">Away team</th>
              <th className="px-3 py-2 text-left w-28">Date</th>
              <th className="px-3 py-2 text-left">Venue</th>
              <th className="px-3 py-2 text-left w-20">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {group.rows.map((row) => {
              const finalStatus = rowFinalStatus(row);
              const rowBg =
                finalStatus === "error"
                  ? "bg-red-50"
                  : finalStatus === "warning"
                  ? "bg-amber-50"
                  : "";
              return (
                <tr key={row.lineIndex} className={rowBg}>
                  <td className="px-3 py-3">
                    <TeamCell
                      rowIdx={row.lineIndex}
                      side="home"
                      team={resolvedTeam(row, "home")}
                      rawName={row.homeRaw}
                      status={resolvedStatus(row, "home")}
                      teams={teams}
                      onOverride={applyOverride}
                    />
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-400 font-medium">
                    vs
                  </td>
                  <td className="px-3 py-3">
                    <TeamCell
                      rowIdx={row.lineIndex}
                      side="away"
                      team={resolvedTeam(row, "away")}
                      rawName={row.awayRaw}
                      status={resolvedStatus(row, "away")}
                      teams={teams}
                      onOverride={applyOverride}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    {row.matchDate ?? (
                      <span className="text-red-500 text-xs">invalid</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">
                    {row.venue ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={finalStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Inline error messages for this group */}
      {group.rows.some((r) => r.message && rowFinalStatus(r) === "error") && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2">
          <ul className="space-y-0.5">
            {group.rows
              .filter((r) => r.message && rowFinalStatus(r) === "error")
              .map((r) => (
                <li key={r.lineIndex} className="text-xs text-red-600">
                  Line {r.lineIndex + 1}: {r.message}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Stage = "input" | "preview" | "done";

export default function BulkImportForm({ teams }: { teams: Team[] }) {
  const [stage, setStage] = useState<Stage>("input");
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [groups, setGroups] = useState<PreviewGroup[]>([]);
  // Override map: [lineIndex][side] → teamId
  const [overrides, setOverrides] = useState<
    Record<number, { home?: string; away?: string }>
  >({});
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    imported: number;
    errors: string[];
  } | null>(null);

  // ── Parse ────────────────────────────────────────────────────────────────
  function handleParse() {
    const parsed = parseAndMatch(rawText, teams);
    const grouped = groupByRound(parsed);
    setRows(parsed);
    setGroups(grouped);
    setOverrides({});
    setStage("preview");
  }

  // ── Override helpers ─────────────────────────────────────────────────────
  function applyOverride(
    rowIdx: number,
    side: "home" | "away",
    teamId: string
  ) {
    setOverrides((prev) => ({
      ...prev,
      [rowIdx]: { ...prev[rowIdx], [side]: teamId },
    }));
  }

  function resolvedTeam(row: PreviewRow, side: "home" | "away"): Team | null {
    const overrideId = overrides[row.lineIndex]?.[side];
    if (overrideId) return teams.find((t) => t.id === overrideId) ?? null;
    return side === "home" ? row.homeTeam : row.awayTeam;
  }

  function resolvedStatus(
    row: PreviewRow,
    side: "home" | "away"
  ): RowStatus {
    if (overrides[row.lineIndex]?.[side]) return "ok";
    return side === "home" ? row.homeStatus : row.awayStatus;
  }

  function rowFinalStatus(row: PreviewRow): RowStatus {
    const hs = resolvedStatus(row, "home");
    const as_ = resolvedStatus(row, "away");
    if (hs === "error" || as_ === "error" || !row.round || !row.matchDate)
      return "error";
    if (hs === "warning" || as_ === "warning") return "warning";
    return "ok";
  }

  // ── Aggregate counts ──────────────────────────────────────────────────────
  const importableRows = rows.filter((r) => rowFinalStatus(r) !== "error");
  const totalErrorCount = rows.filter(
    (r) => rowFinalStatus(r) === "error"
  ).length;
  const totalWarnCount = rows.filter(
    (r) => rowFinalStatus(r) === "warning"
  ).length;

  // ── Import ───────────────────────────────────────────────────────────────
  function handleImport() {
    const payload: BulkFixtureRow[] = importableRows.map((row) => ({
      round: row.round!,
      homeTeamId: resolvedTeam(row, "home")!.id,
      awayTeamId: resolvedTeam(row, "away")!.id,
      matchDate: row.matchDate!,
      venue: row.venue,
    }));

    startTransition(async () => {
      const res = await bulkImportFixtures(payload);
      setResult(res);
      setStage("done");
    });
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function reset() {
    setRawText("");
    setRows([]);
    setGroups([]);
    setOverrides({});
    setResult(null);
    setStage("input");
  }

  // ─────────────────────────────── Render ──────────────────────────────────

  // ── Done ──
  if (stage === "done" && result) {
    return (
      <div className="space-y-4">
        <div
          className={`rounded-xl border px-6 py-5 ${
            result.errors.length === 0
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <p className="font-semibold text-gray-800">
            {result.imported} fixture{result.imported !== 1 ? "s" : ""} imported
            successfully.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-sm text-red-600">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-light transition-colors"
        >
          Import more fixtures
        </button>
      </div>
    );
  }

  // ── Preview ──
  if (stage === "preview") {
    return (
      <div className="space-y-5">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-gray-700">
            {groups.length} round{groups.length !== 1 ? "s" : ""},{" "}
            {rows.length} fixture{rows.length !== 1 ? "s" : ""} parsed
          </span>
          {importableRows.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium text-xs">
              {importableRows.length} ready to import
            </span>
          )}
          {totalWarnCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium text-xs">
              {totalWarnCount} fuzzy match{totalWarnCount !== 1 ? "es" : ""} —
              please confirm
            </span>
          )}
          {totalErrorCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium text-xs">
              {totalErrorCount} error{totalErrorCount !== 1 ? "s" : ""} — will
              be skipped
            </span>
          )}
        </div>

        {/* One card per round */}
        {groups.map((group) => (
          <RoundGroupCard
            key={group.round}
            group={group}
            teams={teams}
            overrides={overrides}
            resolvedTeam={resolvedTeam}
            resolvedStatus={resolvedStatus}
            rowFinalStatus={rowFinalStatus}
            applyOverride={applyOverride}
          />
        ))}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleImport}
            disabled={isPending || importableRows.length === 0}
            className="px-5 py-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {isPending
              ? "Importing…"
              : `Import ${importableRows.length} fixture${
                  importableRows.length !== 1 ? "s" : ""
                } across ${groups.filter((g) => g.rows.some((r) => rowFinalStatus(r) !== "error")).length} round${
                  groups.filter((g) =>
                    g.rows.some((r) => rowFinalStatus(r) !== "error")
                  ).length !== 1
                    ? "s"
                    : ""
                }`}
          </button>
          <button
            onClick={() => setStage("input")}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Back to edit
          </button>
        </div>
      </div>
    );
  }

  // ── Input ──
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 space-y-1.5">
        <p className="font-medium text-gray-700">Format</p>
        <p>
          Use a round header on its own line, then one fixture per line:
        </p>
        <pre className="text-xs bg-white border border-gray-200 rounded p-2 text-gray-700 leading-relaxed overflow-x-auto">{`Round 1
Home Team vs Away Team, YYYY-MM-DD, Venue (optional)
Home Team vs Away Team, YYYY-MM-DD

Round 2
Home Team vs Away Team, YYYY-MM-DD`}</pre>
        <p className="text-xs text-gray-400">
          Round headers can also be written as{" "}
          <code className="bg-gray-100 px-1 rounded">[Round 1]</code> or{" "}
          <code className="bg-gray-100 px-1 rounded">Round 1:</code>. Team
          names are fuzzy-matched so partial names work. Blank lines are
          ignored.
        </p>
      </div>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={12}
        placeholder={PLACEHOLDER}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand resize-y"
        spellCheck={false}
      />
      <button
        onClick={handleParse}
        disabled={!rawText.trim()}
        className="px-5 py-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
      >
        Preview import →
      </button>
    </div>
  );
}
