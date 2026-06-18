"use client";

import { useState, useTransition } from "react";
import { setSeasonComplete, setSeasonName, startNewSeason } from "./actions";

type Props = { seasonComplete: boolean; seasonName: string };

export default function SeasonManagementPanel({ seasonName: initialName }: Props) {
  const [nameInput, setNameInput] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameFeedback, setNameFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Close season
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closeFeedback, setCloseFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Start new season
  const [newSeasonName, setNewSeasonName] = useState(`${new Date().getFullYear() + 1} Season`);
  const [newSeasonStep, setNewSeasonStep] = useState<"idle" | "input" | "confirm">("idle");
  const [newSeasonFeedback, setNewSeasonFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [isPending, startTransition] = useTransition();

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
    setCloseFeedback(null);
    startTransition(async () => {
      const { error } = await setSeasonComplete(true);
      if (error) {
        setCloseFeedback({ ok: false, msg: error });
      } else {
        setCloseConfirm(false);
        setCloseFeedback({ ok: true, msg: "Season marked as complete. The winner banner is now live." });
      }
    });
  }

  function handleStartNewSeason() {
    const name = newSeasonName.trim() || `${new Date().getFullYear() + 1} Season`;
    setNewSeasonFeedback(null);
    startTransition(async () => {
      const { error } = await startNewSeason(name);
      if (error) {
        setNewSeasonFeedback({ ok: false, msg: error });
      } else {
        setNewSeasonStep("idle");
        setNewSeasonFeedback({ ok: true, msg: "New season started. All data has been archived and cleared." });
      }
    });
  }

  return (
    <div className="space-y-10 max-w-lg">

      {/* ── Season Name ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Current Season Name</h2>
          <p className="text-xs text-gray-500 mt-1">Displayed on the home page below the hero banner.</p>
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
        {nameFeedback && (
          <Feedback ok={nameFeedback.ok} msg={nameFeedback.msg} />
        )}
      </section>

      {/* ── Season Actions ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Season Actions</h2>

        <div className="flex gap-3 flex-wrap">
          {/* Close Season */}
          <button
            onClick={() => { setCloseConfirm(true); setCloseFeedback(null); }}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-gold hover:bg-brand-gold-dark text-white transition-colors shadow-sm"
          >
            Close Season
          </button>

          {/* Start New Season */}
          <button
            onClick={() => { setNewSeasonStep("input"); setNewSeasonFeedback(null); }}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm"
          >
            Start New Season
          </button>
        </div>

        {/* Close season confirmation */}
        {closeConfirm && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">
              Close the season and show the winner banner to all users?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCloseSeason}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-gold hover:bg-brand-gold-dark text-white transition-colors"
              >
                {isPending ? "Saving…" : "Yes, close season"}
              </button>
              <button
                onClick={() => setCloseConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {closeFeedback && <Feedback ok={closeFeedback.ok} msg={closeFeedback.msg} />}

        {/* Start new season — name input step */}
        {newSeasonStep === "input" && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
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
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setNewSeasonStep("confirm")}
                disabled={!newSeasonName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Continue
              </button>
              <button
                onClick={() => setNewSeasonStep("idle")}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Start new season — confirm step */}
        {newSeasonStep === "confirm" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-red-900">
              Archive current season and start &ldquo;{newSeasonName}&rdquo;?
            </p>
            <p className="text-xs text-red-700">
              ⚠️ This cannot be undone. All fixtures, results and picks will be archived then cleared.
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
                onClick={() => setNewSeasonStep("idle")}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {newSeasonFeedback && <Feedback ok={newSeasonFeedback.ok} msg={newSeasonFeedback.msg} />}
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
