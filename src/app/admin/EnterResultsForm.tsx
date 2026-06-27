"use client";

import { useState, useTransition } from "react";
import { saveResults } from "./actions";
import type { Fixture, Team } from "@/lib/supabase/types";

type Props = {
  fixtures: Fixture[];
  teams: Team[];
  timezone: string;
  locale: string;
};

const DRAW = "draw";

export default function EnterResultsForm({ fixtures, teams, timezone, locale }: Props) {
  const [results, setResults] = useState<Record<string, string>>(
    Object.fromEntries(fixtures.map((f) => [f.id, ""]))
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  function setResult(fixtureId: string, value: string) {
    setResults((prev) => ({ ...prev, [fixtureId]: value }));
    setFeedback(null);
  }

  function handleSave() {
    const toSave = Object.entries(results)
      .filter(([, v]) => v !== "")
      .map(([fixtureId, resultTeamId]) => ({
        fixtureId,
        resultTeamId: resultTeamId === DRAW ? "draw" : resultTeamId,
      }));

    if (toSave.length === 0) {
      setFeedback({ ok: false, msg: "Select at least one result before saving." });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const { errors } = await saveResults(toSave);
      if (errors.length > 0) {
        setFeedback({ ok: false, msg: errors.join("; ") });
      } else {
        setFeedback({
          ok: true,
          msg: `${toSave.length} result${toSave.length > 1 ? "s" : ""} saved and picks scored.`,
        });
      }
    });
  }

  if (fixtures.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2"><span className="shrink-0" style={{ width: 4, height: 24, borderRadius: 2, background: "var(--accent)" }} /><h2 className="font-display uppercase" style={{ fontSize: 23, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>Enter Results</h2></div>
        <p className="text-sm text-gray-500">
          All fixtures have results entered. Nothing to do here!
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5"><span className="shrink-0" style={{ width: 4, height: 24, borderRadius: 2, background: "var(--accent)" }} /><h2 className="font-display uppercase" style={{ fontSize: 23, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>Enter Results</h2></div>
      <p className="text-xs text-gray-400 mb-4">
        Showing fixtures without a result. Select the winner (or Draw) then hit
        Save. Picks will be scored automatically.
      </p>

      <div className="space-y-3">
        {fixtures.map((fixture) => {
          const home = fixture.home_team!;
          const away = fixture.away_team!;

          return (
            <div
              key={fixture.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
            >
              {/* Match label */}
              <div>
                <p className="text-sm font-medium text-gray-800">
                  <TeamDot colour={home.colour} />
                  {home.name}
                  <span className="mx-2 text-gray-400">vs</span>
                  <TeamDot colour={away.colour} />
                  {away.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(fixture.match_date).toLocaleString(locale, {
                    timeZone: timezone,
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {fixture.venue && ` · ${fixture.venue}`}
                </p>
              </div>

              {/* Result dropdown */}
              <select
                value={results[fixture.id] ?? ""}
                onChange={(e) => setResult(fixture.id, e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand min-w-[180px]"
              >
                <option value="">— Select result —</option>
                <option value={home.id}>{home.name} (win)</option>
                <option value={away.id}>{away.name} (win)</option>
                <option value={DRAW}>Draw</option>
              </select>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-5">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-5 py-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Results"}
        </button>
        {feedback && (
          <p
            className={`text-sm font-medium ${
              feedback.ok ? "text-green-600" : "text-red-600"
            }`}
          >
            {feedback.msg}
          </p>
        )}
      </div>
    </section>
  );
}

function TeamDot({ colour }: { colour: string }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle"
      style={{ backgroundColor: colour }}
    />
  );
}
