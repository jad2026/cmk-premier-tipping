"use client";

import { useState, useTransition } from "react";
import { setSeasonComplete } from "./actions";

type Props = {
  seasonComplete: boolean;
};

export default function SeasonPanel({ seasonComplete: initial }: Props) {
  const [isComplete, setIsComplete] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function toggle(complete: boolean) {
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
            ? "Season marked as complete. The winner banner will now show on the home page."
            : "Season reopened. The home page will show round status as normal.",
        });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Season Status</h2>
        <p className="text-sm text-gray-500">
          When the season is marked complete, the home page replaces the round
          card with a winner banner showing the top-scoring player.
        </p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border px-5 py-4 flex items-center gap-4 ${
        isComplete
          ? "bg-brand-gold/8 border-brand-gold/30"
          : "bg-green-50 border-green-200"
      }`}>
        <span className="text-2xl shrink-0">{isComplete ? "🏆" : "🟢"}</span>
        <div>
          <p className={`text-sm font-semibold ${isComplete ? "text-brand-gold-dark" : "text-green-800"}`}>
            {isComplete ? "Season complete" : "Season in progress"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isComplete
              ? "The competition has finished. The winner banner is live on the home page."
              : "The competition is active. Rounds are open for tipping as normal."}
          </p>
        </div>
      </div>

      {/* Action button */}
      {isComplete ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Need to reopen the season? This will restore normal round display on the home page.
          </p>
          <button
            onClick={() => toggle(false)}
            disabled={isPending}
            className="btn-primary bg-gray-600 hover:bg-gray-700"
          >
            {isPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              "Reopen Season"
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-800 font-medium">⚠️ This action is visible to all users immediately.</p>
            <p className="text-xs text-amber-700 mt-1">
              The home page will switch to the winner banner as soon as you confirm. Make sure all results are entered first.
            </p>
          </div>
          <button
            onClick={() => toggle(true)}
            disabled={isPending}
            className="btn-primary"
          >
            {isPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              "Mark Season as Complete"
            )}
          </button>
        </div>
      )}

      {feedback && (
        <p className={`text-sm rounded-xl px-4 py-3 ${
          feedback.ok
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-100 text-red-700"
        }`}>
          {feedback.msg}
        </p>
      )}
    </div>
  );
}
