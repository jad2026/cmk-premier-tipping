"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Fixture, Pick } from "@/lib/supabase/types";
import TeamBadge from "@/components/TeamBadge";

type Props = {
  fixtures: Fixture[];
  existingPicks: Pick[];
  userId: string;
  deadline: string;
};

export default function TipsForm({
  fixtures,
  existingPicks,
  deadline,
}: Props) {
  const supabase = createClient();
  const [picks, setPicks] = useState<Record<string, string>>(
    Object.fromEntries(existingPicks.map((p) => [p.fixture_id, p.picked_team_id]))
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPastDeadline = new Date() > new Date(deadline);

  function selectTeam(fixtureId: string, teamId: string) {
    if (isPastDeadline) return;
    setPicks((prev) => ({ ...prev, [fixtureId]: teamId }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      for (const [fixtureId, pickedTeamId] of Object.entries(picks)) {
        const { error: rpcError } = await supabase.rpc("upsert_pick", {
          p_fixture_id: fixtureId,
          p_picked_team_id: pickedTeamId,
        });
        if (rpcError) {
          setError(rpcError.message);
          return;
        }
      }
      setSaved(true);
    });
  }

  if (fixtures.length === 0) {
    return (
      <p className="text-gray-500">No fixtures scheduled for this round yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {fixtures.map((fixture) => {
        const home = fixture.home_team!;
        const away = fixture.away_team!;
        const picked = picks[fixture.id];

        return (
          <div
            key={fixture.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4"
          >
            <p className="text-xs text-gray-400 mb-3">
              {new Date(fixture.match_date).toLocaleString("en-NZ", {
                timeZone: "Pacific/Auckland",
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {fixture.venue && ` · ${fixture.venue}`}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {[home, away].map((team) => (
                <button
                  key={team.id}
                  onClick={() => selectTeam(fixture.id, team.id)}
                  disabled={isPastDeadline}
                  className={`relative flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${
                    picked === team.id
                      ? "border-brand-gold bg-yellow-50 shadow"
                      : "border-gray-200 hover:border-gray-400 disabled:cursor-not-allowed"
                  }`}
                >
                  <TeamBadge team={team} size="sm" />
                  <span className="font-medium text-sm text-gray-800">
                    {team.name}
                  </span>
                  {picked === team.id && (
                    <span className="ml-auto text-brand-gold text-xs font-bold">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {isPastDeadline ? (
        <p className="text-sm text-red-500 font-medium">
          The deadline has passed — picks are locked.
        </p>
      ) : (
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending || Object.keys(picks).length === 0}
            className="px-6 py-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save Tips"}
          </button>
          {saved && (
            <p className="text-sm text-green-600 font-medium">Tips saved!</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
