"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchAllFixtures, updateFixture, deleteFixture, type FixtureAdminRow } from "./actions";
import TeamBadge from "@/components/TeamBadge";
import type { Team } from "@/lib/supabase/types";

type Props = { teams: Team[] };

type EditState = {
  fixtureId: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  venue: string;
};

type DeleteState = { fixtureId: string; picks_count: number };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white";

export default function FixtureListPanel({ teams }: Props) {
  const [fixtures, setFixtures] = useState<FixtureAdminRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  function load() {
    startTransition(async () => {
      const { data, error } = await fetchAllFixtures();
      if (error) setLoadError(error);
      else { setLoadError(null); setFixtures(data); }
    });
  }

  useEffect(() => { load(); }, []);

  function startEdit(f: FixtureAdminRow) {
    setActionFeedback(null);
    setDeleting(null);
    setEditing({
      fixtureId: f.id,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
      match_date: toLocalDatetimeValue(f.match_date),
      venue: f.venue ?? "",
    });
  }

  function startDelete(f: FixtureAdminRow) {
    setActionFeedback(null);
    setEditing(null);
    setDeleting({ fixtureId: f.id, picks_count: f.picks_count });
  }

  function handleSaveEdit() {
    if (!editing) return;
    setActionFeedback(null);
    startTransition(async () => {
      const { error } = await updateFixture(editing.fixtureId, {
        home_team_id: editing.home_team_id,
        away_team_id: editing.away_team_id,
        match_date: editing.match_date,
        venue: editing.venue,
      });
      if (error) {
        setActionFeedback({ ok: false, msg: error });
      } else {
        setEditing(null);
        setActionFeedback({ ok: true, msg: "Fixture updated." });
        load();
      }
    });
  }

  function handleDelete() {
    if (!deleting) return;
    setActionFeedback(null);
    startTransition(async () => {
      const { error } = await deleteFixture(deleting.fixtureId);
      if (error) {
        setActionFeedback({ ok: false, msg: error });
      } else {
        setDeleting(null);
        setActionFeedback({ ok: true, msg: "Fixture deleted." });
        load();
      }
    });
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
        Failed to load fixtures: {loadError}
      </div>
    );
  }

  // Group by gameweek
  const grouped = new Map<string, { label: string; number: number; fixtures: FixtureAdminRow[] }>();
  for (const f of fixtures) {
    const key = f.gameweek_id;
    if (!grouped.has(key)) grouped.set(key, { label: f.gameweek_label, number: f.gameweek_number, fixtures: [] });
    grouped.get(key)!.fixtures.push(f);
  }
  const rounds = Array.from(grouped.values()).sort((a, b) => b.number - a.number);

  if (rounds.length === 0 && !isPending) {
    return (
      <div className="text-center py-10 text-sm text-gray-400">No fixtures added yet.</div>
    );
  }

  return (
    <div className="space-y-4">
      {actionFeedback && (
        <p className={`text-sm rounded-xl px-4 py-3 ${
          actionFeedback.ok
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-100 text-red-700"
        }`}>
          {actionFeedback.msg}
        </p>
      )}

      {rounds.map((round) => (
        <div key={round.label} className="card overflow-hidden">
          {/* Round header */}
          <div className="bg-brand px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-bold text-white">{round.label}</span>
            <span className="text-xs text-white/50">{round.fixtures.length} fixture{round.fixtures.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="divide-y divide-gray-50">
            {round.fixtures.map((f) => {
              const homeTeam = teamMap.get(f.home_team_id);
              const awayTeam = teamMap.get(f.away_team_id);
              const hasResult = f.result_team_id !== null || f.is_draw;
              const isEditingThis = editing?.fixtureId === f.id;
              const isDeletingThis = deleting?.fixtureId === f.id;

              return (
                <div key={f.id}>
                  {/* Fixture row */}
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    {/* Teams */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {homeTeam && <TeamBadge team={homeTeam} size="xs" />}
                        <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">
                          {homeTeam?.name ?? "—"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">vs</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {awayTeam && <TeamBadge team={awayTeam} size="xs" />}
                        <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">
                          {awayTeam?.name ?? "—"}
                        </span>
                      </div>
                    </div>

                    {/* Date + venue */}
                    <div className="flex flex-col sm:items-end min-w-0 shrink-0">
                      <span className="text-xs text-gray-500">{fmtDate(f.match_date)}</span>
                      {f.venue && <span className="text-xs text-gray-400 truncate max-w-[160px]">{f.venue}</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasResult && (
                        <span className="text-xs text-brand-gold-dark font-medium shrink-0">✓ Result</span>
                      )}
                      <button
                        onClick={() => isEditingThis ? setEditing(null) : startEdit(f)}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-50"
                      >
                        {isEditingThis ? "Cancel" : "Edit"}
                      </button>
                      <button
                        onClick={() => isDeletingThis ? setDeleting(null) : startDelete(f)}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                      >
                        {isDeletingThis ? "Cancel" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isEditingThis && editing && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Fixture</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Home Team</label>
                          <select
                            value={editing.home_team_id}
                            onChange={(e) => setEditing({ ...editing, home_team_id: e.target.value })}
                            className={inputClass}
                          >
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Away Team</label>
                          <select
                            value={editing.away_team_id}
                            onChange={(e) => setEditing({ ...editing, away_team_id: e.target.value })}
                            className={inputClass}
                          >
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time</label>
                          <input
                            type="datetime-local"
                            value={editing.match_date}
                            onChange={(e) => setEditing({ ...editing, match_date: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Venue (optional)</label>
                          <input
                            type="text"
                            value={editing.venue}
                            onChange={(e) => setEditing({ ...editing, venue: e.target.value })}
                            className={inputClass}
                            placeholder="e.g. Victoria Park"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isPending}
                          className="btn-primary text-sm py-1.5 px-4"
                        >
                          {isPending ? "Saving…" : "Save Changes"}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          disabled={isPending}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline delete confirmation */}
                  {isDeletingThis && deleting && (
                    <div className="bg-red-50 border-t border-red-100 px-4 py-4 space-y-2">
                      <p className="text-sm font-semibold text-red-900">Delete this fixture?</p>
                      {deleting.picks_count > 0 && (
                        <p className="text-xs text-red-700">
                          ⚠️ {deleting.picks_count} pick{deleting.picks_count !== 1 ? "s" : ""} will also be deleted.
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleDelete}
                          disabled={isPending}
                          className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                        >
                          {isPending ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setDeleting(null)}
                          disabled={isPending}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
