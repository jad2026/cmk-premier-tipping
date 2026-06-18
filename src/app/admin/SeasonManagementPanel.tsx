"use client";

import { useState, useTransition, useEffect } from "react";
import {
  setSeasonName,
  closeSeason,
  startNewSeason,
  fetchPastSeasons,
  type PastSeasonRow,
} from "./actions";

type Props = { seasonComplete: boolean; seasonName: string };

export default function SeasonManagementPanel({ seasonComplete: initial, seasonName: initialName }: Props) {
  const [isComplete, setIsComplete] = useState(initial);
  const [nameInput, setNameInput] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameFeedback, setNameFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Close season
  const [closeConfirm, setCloseConfirm] = useState(false);

  // Start new season
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonStep, setNewSeasonStep] = useState<"idle" | "input" | "confirm">("idle");

  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pastSeasons, setPastSeasons] = useState<PastSeasonRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchPastSeasons().then(({ data }) => setPastSeasons(data));
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
        setSavedName(trimmed);
        setNameFeedback({ ok: true, msg: "Season name updated." });
      }
    });
  }

  function handleCloseSeason() {
    setFeedback(null);
    startTransition(async () => {
      const { error } = await closeSeason();
      if (error) {
        setFeedback({ ok: false, msg: error });
      } else {
        setIsComplete(true);
        setCloseConfirm(false);
        setFeedback({ ok: true, msg: "Season closed. The winner banner is now live on the home page." });
        fetchPastSeasons().then(({ data }) => setPastSeasons(data));
      }
    });
  }

  function handleStartNewSeason() {
    const name = newSeasonName.trim() || savedName;
    setFeedback(null);
    startTransition(async () => {
      const { error } = await startNewSeason(name);
      if (error) {
        setFeedback({ ok: false, msg: error });
      } else {
        setIsComplete(false);
        setNewSeasonStep("idle");
        setNewSeasonName("");
        setSavedName(name);
        setNameInput(name);
        setFeedback({ ok: true, msg: "New season started. All data cleared and ready for fixture import." });
        fetchPastSeasons().then(({ data }) => setPastSeasons(data));
      }
    });
  }

  return (
    <div className="space-y-8 max-w-lg">

      {/* ── Season Name ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Current Season Name</h2>
          <p className="text-xs text-gray-500 mt-1">Displayed on the home page and leaderboard.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setNameFeedback(null); }}
            className="input flex-1"
            placeholder="e.g. 2026 CMK Premier Season"
          />
          <button
            onClick={handleSaveName}
            disabled={isPending || nameInput.trim() === savedName || !nameInput.trim()}
            className="btn-primary shrink-0"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
        {nameFeedback && <Feedback ok={nameFeedback.ok} msg={nameFeedback.msg} />}
      </section>

      {/* ── Season Status ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Season Status</h2>

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
                ? "The winner banner is live on the home page."
                : "Rounds are open for tipping as normal."}
            </p>
          </div>
        </div>

        {/* Close Season (only when in progress) */}
        {!isComplete && !closeConfirm && (
          <button
            onClick={() => { setCloseConfirm(true); setFeedback(null); }}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-gold hover:bg-brand-gold-dark text-white transition-colors shadow-sm"
          >
            Close Season
          </button>
        )}

        {!isComplete && closeConfirm && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">
              Archive this season and show the winner banner to all users?
            </p>
            <p className="text-xs text-amber-700">
              The current season data will be saved to the archive. Make sure all results are entered first.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCloseSeason}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-gold hover:bg-brand-gold-dark text-white transition-colors"
              >
                {isPending ? "Saving…" : "Yes, close season"}
              </button>
              <button onClick={() => setCloseConfirm(false)} disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Start New Season (only when complete) */}
        {isComplete && newSeasonStep === "idle" && (
          <button
            onClick={() => { setNewSeasonStep("input"); setFeedback(null); }}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm"
          >
            Start New Season
          </button>
        )}

        {isComplete && newSeasonStep === "input" && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
              New Season Name
            </label>
            <input
              type="text"
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              className="input max-w-xs"
              placeholder="e.g. 2027 CMK Premier Season"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setNewSeasonStep("confirm")}
                disabled={!newSeasonName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Continue
              </button>
              <button onClick={() => { setNewSeasonStep("idle"); setNewSeasonName(""); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {isComplete && newSeasonStep === "confirm" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-red-900">
              Start &ldquo;{newSeasonName}&rdquo; and clear all current data?
            </p>
            <p className="text-xs text-red-700">
              ⚠️ This cannot be undone. All fixtures, results and picks will be cleared.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleStartNewSeason}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                {isPending ? "Resetting…" : "Yes, start new season"}
              </button>
              <button onClick={() => setNewSeasonStep("idle")} disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {feedback && <Feedback ok={feedback.ok} msg={feedback.msg} />}
      </section>

      {/* ── Past Seasons ─────────────────────────────────────────────────── */}
      <section className="space-y-3 border-t border-gray-100 pt-6">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Past Seasons</h2>
        {pastSeasons.length === 0 ? (
          <p className="text-sm text-gray-400">No past seasons yet.</p>
        ) : (
          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {pastSeasons.map((s) => (
              <div key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50/60">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.totalRounds} round{s.totalRounds !== 1 ? "s" : ""} · {s.totalParticipants} participant{s.totalParticipants !== 1 ? "s" : ""}
                  </p>
                </div>
                {s.winnerName && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Winner</p>
                    <p className="text-sm font-bold text-brand-gold-dark">🏆 {s.winnerName}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Feedback({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <p className={`text-sm rounded-xl px-4 py-3 ${
      ok ? "bg-green-50 border border-green-200 text-green-800"
         : "bg-red-50 border border-red-100 text-red-700"
    }`}>
      {msg}
    </p>
  );
}
