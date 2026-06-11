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
      <div className="card px-6 py-10 text-center">
        <p className="text-gray-500">No fixtures scheduled for this round yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fixtures.map((fixture, index) => {
        const home = fixture.home_team!;
        const away = fixture.away_team!;
        const picked = picks[fixture.id];
        const homePicked = picked === home.id;
        const awayPicked = picked === away.id;

        return (
          <div
            key={fixture.id}
            className="card-md overflow-hidden"
          >
            {/* ── Match header ────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-brand to-brand-light px-5 py-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-200/70">
                Match {index + 1}
              </span>
              <p className="text-xs text-blue-100/80 text-right">
                {new Date(fixture.match_date).toLocaleString("en-NZ", {
                  timeZone: "Pacific/Auckland",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {fixture.venue && (
                  <span className="ml-2 text-blue-200/50">· {fixture.venue}</span>
                )}
              </p>
            </div>

            {/* ── Teams display ────────────────────────────────────────── */}
            <div className="px-5 py-5 flex items-center gap-4">
              {/* Home team */}
              <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
                <TeamBadge team={home} size="lg" />
                <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                  {home.name}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">
                  Home
                </span>
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center shrink-0">
                <span className="w-px h-8 bg-gray-200" />
                <span className="my-2 text-xs font-bold text-gray-400 tracking-widest">
                  VS
                </span>
                <span className="w-px h-8 bg-gray-200" />
              </div>

              {/* Away team */}
              <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
                <TeamBadge team={away} size="lg" />
                <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                  {away.name}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">
                  Away
                </span>
              </div>
            </div>

            {/* ── Pick buttons ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100">
              {[home, away].map((team) => {
                const isSelected = picked === team.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => selectTeam(fixture.id, team.id)}
                    disabled={isPastDeadline}
                    className={`relative flex items-center justify-center gap-2.5 py-3.5 px-4 text-sm font-semibold transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-brand-gold/10 text-brand-gold"
                        : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-gold rounded-b-sm" />
                    )}
                    <TeamBadge team={team} size="xs" />
                    <span className="truncate">{team.short_name || team.name}</span>
                    {isSelected && (
                      <span className="ml-auto shrink-0 w-4 h-4 rounded-full bg-brand-gold flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Picked confirmation banner ─────────────────────────── */}
            {(homePicked || awayPicked) && (
              <div className="px-5 py-2.5 bg-brand-gold/8 border-t border-brand-gold/20 flex items-center gap-2">
                <TeamBadge team={homePicked ? home : away} size="xs" />
                <p className="text-xs font-medium text-brand-gold-dark">
                  You&apos;re tipping{" "}
                  <span className="font-bold">
                    {homePicked ? home.name : away.name}
                  </span>
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Save bar ────────────────────────────────────────────────────── */}
      {isPastDeadline ? (
        <div className="card px-5 py-3.5 flex items-center gap-3 border-red-100 bg-red-50/60">
          <span className="text-red-400 text-base">🔒</span>
          <p className="text-sm font-medium text-red-600">
            The deadline has passed — picks are locked.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending || Object.keys(picks).length === 0}
            className="btn-primary"
          >
            {isPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              "Save Tips"
            )}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-[10px]">✓</span>
              Tips saved!
            </span>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
