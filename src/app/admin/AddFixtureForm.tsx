"use client";

import { useRef, useState, useTransition } from "react";
import { addFixture } from "./actions";
import type { Team } from "@/lib/supabase/types";
import FixtureListPanel from "./FixtureListPanel";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export default function AddFixtureForm({ teams }: { teams: Team[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addFixture(data);
      if (result.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: "Fixture added successfully." });
        formRef.current?.reset();
      }
    });
  }

  return (
    <>
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-bold text-brand mb-5">Add Fixture</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gameweek number */}
          <div>
            <label className={labelClass} htmlFor="gw-number">
              Round number
            </label>
            <input
              id="gw-number"
              name="gameweek_number"
              type="number"
              min={1}
              max={99}
              required
              className={inputClass}
              placeholder="e.g. 1"
            />
          </div>

          {/* Match date */}
          <div>
            <label className={labelClass} htmlFor="match-date">
              Match date &amp; time
            </label>
            <input
              id="match-date"
              name="match_date"
              type="datetime-local"
              required
              className={inputClass}
            />
          </div>

          {/* Home team */}
          <div>
            <label className={labelClass} htmlFor="home-team">
              Home team
            </label>
            <select
              id="home-team"
              name="home_team_id"
              required
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>
                Select home team…
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Away team */}
          <div>
            <label className={labelClass} htmlFor="away-team">
              Away team
            </label>
            <select
              id="away-team"
              name="away_team_id"
              required
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>
                Select away team…
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Venue */}
        <div>
          <label className={labelClass} htmlFor="venue">
            Venue <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="venue"
            name="venue"
            type="text"
            className={inputClass}
            placeholder="e.g. Yarrow Stadium"
          />
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add Fixture"}
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
      </form>
    </section>

    <div className="mt-6">
      <h2 className="text-lg font-bold text-brand mb-4">All Fixtures</h2>
      <FixtureListPanel teams={teams} />
    </div>
    </>
  );
}
