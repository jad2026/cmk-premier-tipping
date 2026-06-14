"use client";

import { useEffect, useState, useTransition } from "react";
import {
  setSeasonComplete,
  setSeasonName,
  startNewSeason,
  fetchPastSeasons,
  type PastSeasonRow,
} from "./actions";

type Props = { seasonComplete: boolean; seasonName: string };

export default function SeasonManagementPanel({ seasonComplete: initial, seasonName: initialName }: Props) {
  const [isComplete, setIsComplete] = useState(initial);
  const [currentSeasonName, setCurrentSeasonName] = useState(initialName);
  const [nameInput, setNameInput] = useState(initialName);
  const [nameFeedback, setNameFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newSeasonName, setNewSeasonName] = useState(`${new Date().getFullYear()} Season`);
  const [confirm, setConfirm] = useState(false);
  const [pastSeasons, setPastSeasons] = useState<PastSeasonRow[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const { data } = await fetchPastSeasons();
      setPastSeasons(data);
    });
  }, []);

  function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setNameFeedback(null);
    startTransition(async () => {
      const { error } = await setSeasonName(trimmed);
      if (error) {
        setNameFeedback({ ok: false, msg: error });
      } else {
        setCurrentSeasonName(trimmed);
        setNameFeedback({ ok: true, msg: "Season name updated." });
      }
    });
  }

  function toggleComplete(complete: boolean) {
    setFeedback(null);
    startTransition(async () => {
      const { error } = await setSeasonComplete(complete);
      if (error) {
        setFeedback({ ok: false, msg: error });
      } else {
        setIsComplete(complete);
        setFeedback({
          ok: true,
          msg: complete
            ? "Season marked as complete."
            : "Season reopened.",
        });
      }
    });
  }

  function handleStartNewSeason() {
    setFeedback(null);
    startTransition(async () => {
      const { error } = await startNewSeason(newSeasonName.trim() || `${new Date().getFullYear()} Season`);
      if (error) {
        setFeedback({ ok: false, msg: error });
      } else {
        setIsComplete(false);
        setConfirm(false);
        setFeedback({ ok: true, msg: "New season started. All fixtures, results and picks have been archived and cleared." });
        const { data } = await fetchPastSeasons();
        setPastSeasons(data);
      }
    });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-NZ", {
      day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland",
    });
  }

  return (
    <div className="space-y-8 max-w-xl">

      {/* ── Season name ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Season Name</h2>
          <p className="text-xs text-gray-500 mt-1">Displayed on the home page below the hero banner.</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setNameFeedback(null); }}
            className="input flex-1 max-w-xs"
            placeholder="e.g. 2026 CMK Premier Season"
          />
          <button
            onClick={handleSaveName}
            disabled={isPending || nameInput.trim() === currentSeasonName || !nameInput.trim()}
            className="btn-primary shrink-0"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
        {nameFeedback && (
          <p className={`text-sm rounded-xl px-4 py-3 ${
            nameFeedback.ok
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-100 text-red-700"
          }`}>
            {nameFeedback.msg}
          </p>
        )}
      </section>

      {/* ── Current season status ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Current Season</h2>

        <div className={`rounded-2xl border px-5 py-4 flex items-center gap-4 ${
          isComplete ? "bg-brand-gold/8 border-brand-gold/30" : "bg-green-50 border-green-200"
        }`}>
          <span className="text-2xl shrink-0">{isComplete ? "🏆" : "🟢"}</span>
          <div>
            <p className={`text-sm font-semibold ${isComplete ? "text-brand-gold-dark" : "text-green-800"}`}>
              {isComplete ? "Season complete" : "Season in progress"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isComplete
                ? "The competition has finished. The winner banner is live."
                : "The competition is active. Rounds are open for tipping as normal."}
            </p>
          </div>
        </div>

        {isComplete ? (
          <button onClick={() => toggleComplete(false)} disabled={isPending} className="btn-primary bg-gray-600 hover:bg-gray-700">
            {isPending ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : "Reopen Season"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800 font-medium">⚠️ This shows the winner banner to all users immediately.</p>
            </div>
            <button onClick={() => toggleComplete(true)} disabled={isPending} className="btn-primary">
              {isPending ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : "Mark Season as Complete"}
            </button>
          </div>
        )}
      </section>

      {/* ── Start new season ─────────────────────────────────────────────── */}
      <section className="space-y-4 border-t border-gray-100 pt-6">
        <div>
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Start New Season</h2>
          <p className="text-xs text-gray-500 mt-1">
            Archives all current gameweeks, fixtures and picks, then clears the tables ready for a fresh season.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Season Name
          </label>
          <input
            type="text"
            value={newSeasonName}
            onChange={(e) => setNewSeasonName(e.target.value)}
            className="input max-w-xs"
            placeholder="e.g. 2027 Season"
          />
        </div>

        {!confirm ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-800 font-medium">⚠️ This cannot be undone.</p>
              <p className="text-xs text-red-700 mt-1">
                All fixtures, results and picks will be archived then permanently removed from the active tables. Make sure the season is complete before proceeding.
              </p>
            </div>
            <button
              onClick={() => setConfirm(true)}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Start New Season…
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-red-800">
              Archive "{newSeasonName}" and clear all active data?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleStartNewSeason}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                {isPending ? "Archiving…" : "Yes, archive and reset"}
              </button>
              <button
                onClick={() => setConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      {feedback && (
        <p className={`text-sm rounded-xl px-4 py-3 ${
          feedback.ok
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-100 text-red-700"
        }`}>
          {feedback.msg}
        </p>
      )}

      {/* ── Past seasons ─────────────────────────────────────────────────── */}
      {pastSeasons.length > 0 && (
        <section className="space-y-3 border-t border-gray-100 pt-6">
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Season History</h2>
          <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
            {pastSeasons.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/60">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Archived {fmtDate(s.archivedAt)} · {s.totalParticipants} participant{s.totalParticipants !== 1 ? "s" : ""}
                  </p>
                </div>
                {s.winnerName && (
                  <div className="text-right shrink-0">
                    <span className="text-xs text-gray-400">Winner</span>
                    <p className="text-sm font-bold text-brand-gold-dark">🏆 {s.winnerName}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
