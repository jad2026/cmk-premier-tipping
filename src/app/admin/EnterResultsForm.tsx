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

type ScoreEntry = { home: string; away: string };

export default function EnterResultsForm({ fixtures, teams, timezone, locale }: Props) {
  const [scores, setScores] = useState<Record<string, ScoreEntry>>(
    Object.fromEntries(fixtures.map((f) => [f.id, { home: "", away: "" }]))
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  function setScore(fixtureId: string, side: "home" | "away", value: string) {
    setScores((prev) => ({
      ...prev,
      [fixtureId]: { ...prev[fixtureId], [side]: value },
    }));
    setFeedback(null);
  }

  function handleSave() {
    const toSave: { fixtureId: string; resultTeamId: string; homeScore: number; awayScore: number }[] = [];

    for (const fixture of fixtures) {
      const entry = scores[fixture.id];
      if (entry.home === "" || entry.away === "") continue;

      const homeScore = parseInt(entry.home, 10);
      const awayScore = parseInt(entry.away, 10);
      if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) continue;

      let resultTeamId: string;
      if (homeScore > awayScore) {
        resultTeamId = fixture.home_team_id;
      } else if (awayScore > homeScore) {
        resultTeamId = fixture.away_team_id;
      } else {
        resultTeamId = "draw";
      }

      toSave.push({ fixtureId: fixture.id, resultTeamId, homeScore, awayScore });
    }

    if (toSave.length === 0) {
      setFeedback({ ok: false, msg: "Enter scores for at least one fixture before saving." });
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
        Enter the final scores. The winner (or draw) is determined automatically.
        Picks and margins will be scored on save.
      </p>

      <div className="space-y-3">
        {fixtures.map((fixture) => {
          const home = fixture.home_team!;
          const away = fixture.away_team!;
          const entry = scores[fixture.id];
          const homeVal = entry?.home ?? "";
          const awayVal = entry?.away ?? "";
          const bothFilled = homeVal !== "" && awayVal !== "";
          const h = parseInt(homeVal, 10);
          const a = parseInt(awayVal, 10);
          const resultLabel = bothFilled && !isNaN(h) && !isNaN(a)
            ? h > a ? `${home.name} win` : a > h ? `${away.name} win` : "Draw"
            : null;

          return (
            <div
              key={fixture.id}
              className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-gray-400">
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
                {resultLabel && (
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {resultLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TeamDot colour={home.colour} />
                  <span className="text-sm font-medium text-gray-800 truncate">{home.name}</span>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="—"
                  value={homeVal}
                  onChange={(e) => setScore(fixture.id, "home", e.target.value)}
                  className="w-16 text-center border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-bold"
                />
                <span className="text-gray-400 text-xs font-bold">–</span>
                <input
                  type="number"
                  min="0"
                  placeholder="—"
                  value={awayVal}
                  onChange={(e) => setScore(fixture.id, "away", e.target.value)}
                  className="w-16 text-center border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-bold"
                />
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-medium text-gray-800 truncate text-right">{away.name}</span>
                  <TeamDot colour={away.colour} />
                </div>
              </div>
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
      className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle shrink-0"
      style={{ backgroundColor: colour }}
    />
  );
}
