"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Fixture } from "@/lib/supabase/types";
import TeamBadge from "@/components/TeamBadge";
import type { RoundData } from "./page";

type Props = {
  rounds: RoundData[];
  userId: string;
};

export default function TipsForm({ rounds }: Props) {
  const supabase = createClient();

  // picks maps fixture_id → team_id or "draw"
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rounds.flatMap((r) =>
        r.existingPicks
          .filter((p) => p.picked_team_id !== null || p.picked_draw)
          .map((p) => [p.fixture_id, p.picked_draw ? "draw" : p.picked_team_id!])
      )
    )
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const now = new Date();

  function isRoundDeadlinePassed(deadline: string) {
    return now > new Date(deadline);
  }

  function isFixtureResulted(fixture: Fixture) {
    return fixture.result_team_id !== null || fixture.is_draw;
  }

  function selectPick(fixtureId: string, value: string, deadline: string, resultLocked: boolean) {
    if (isRoundDeadlinePassed(deadline) || resultLocked) return;
    setPicks((prev) => ({ ...prev, [fixtureId]: value }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const allFixtures = rounds.flatMap((r) =>
        r.fixtures.map((f) => ({ fixture: f, deadline: r.deadline }))
      );
      const saveable = Object.entries(picks).filter(([fixtureId]) => {
        const entry = allFixtures.find(({ fixture }) => fixture.id === fixtureId);
        if (!entry) return false;
        return !isRoundDeadlinePassed(entry.deadline) && !isFixtureResulted(entry.fixture);
      });

      for (const [fixtureId, value] of saveable) {
        const isDraw = value === "draw";
        const { error: rpcError } = await supabase.rpc("upsert_pick", {
          p_fixture_id: fixtureId,
          p_picked_team_id: isDraw ? null : value,
          p_picked_draw: isDraw,
        });
        if (rpcError) {
          setError(rpcError.message);
          return;
        }
      }
      setSaved(true);
    });
  }

  const allFixtures = rounds.flatMap((r) => r.fixtures);
  const hasAnyPickable = rounds.some(
    (r) => !isRoundDeadlinePassed(r.deadline) && r.fixtures.some((f) => !isFixtureResulted(f))
  );
  const totalPickable = allFixtures.filter((f) => !isFixtureResulted(f)).length;
  const pickedCount = Object.keys(picks).filter((fid) => {
    const f = allFixtures.find((x) => x.id === fid);
    return f && !isFixtureResulted(f);
  }).length;

  if (allFixtures.length === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="text-gray-500">No fixtures scheduled for the open rounds yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {rounds.map((round) => {
        const isPastDeadline = isRoundDeadlinePassed(round.deadline);
        return (
          <section key={round.id}>
            {/* ── Round header ─────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 flex items-center gap-3">
                <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
                <h2 className="text-base font-bold text-brand uppercase tracking-wide">
                  {round.label}
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isPastDeadline ? (
                  <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-100 text-red-600 text-[11px] font-semibold uppercase tracking-wide">
                    Deadline passed
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    Deadline:{" "}
                    <span className="font-medium text-gray-700">
                      {new Date(round.deadline).toLocaleString("en-NZ", {
                        timeZone: "Pacific/Auckland",
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* ── Fixtures ─────────────────────────────────────────────── */}
            <div className="space-y-4">
              {round.fixtures.map((fixture, index) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  index={index}
                  picks={picks}
                  isPastDeadline={isPastDeadline}
                  onSelect={(value) =>
                    selectPick(fixture.id, value, round.deadline, fixture.result_team_id !== null && !fixture.is_draw)
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* ── Save bar ───────────────────────────────────────────────────── */}
      {!hasAnyPickable ? (
        <div className="card px-5 py-3.5 flex items-center gap-3 border-gray-200 bg-gray-50">
          <span className="text-gray-400 text-base">🔒</span>
          <p className="text-sm font-medium text-gray-600">
            All fixtures are locked — no picks can be changed.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending || pickedCount === 0}
            className="btn-primary"
          >
            {isPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              `Save Tips${totalPickable > 1 ? ` (${pickedCount}/${totalPickable})` : ""}`
            )}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-[10px]">✓</span>
              Tips saved!
            </span>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ── FixtureCard ───────────────────────────────────────────────────────────────

function FixtureCard({
  fixture,
  index,
  picks,
  isPastDeadline,
  onSelect,
}: {
  fixture: Fixture;
  index: number;
  picks: Record<string, string>;
  isPastDeadline: boolean;
  onSelect: (value: string) => void;
}) {
  const home = fixture.home_team!;
  const away = fixture.away_team!;
  const picked = picks[fixture.id];
  const homePicked = picked === home.id;
  const awayPicked = picked === away.id;
  const drawPicked = picked === "draw";
  const resultLocked = fixture.result_team_id !== null || fixture.is_draw;
  const isLocked = resultLocked || isPastDeadline;

  return (
    <div className={`card-md overflow-hidden ${resultLocked ? "opacity-80" : ""}`}>
      {/* Match header */}
      <div
        className={`px-5 py-3 flex items-center justify-between gap-2 ${
          resultLocked ? "bg-gray-500" : "bg-gradient-to-r from-brand to-brand-light"
        }`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
          Match {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {resultLocked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white/80 text-[10px] font-semibold uppercase tracking-wide">
              <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                <rect x="2" y="4.5" width="6" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Result entered
            </span>
          )}
          <p className="text-xs text-white/60 text-right">
            {new Date(fixture.match_date).toLocaleString("en-NZ", {
              timeZone: "Pacific/Auckland",
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {fixture.venue && <span className="ml-2 text-white/40">· {fixture.venue}</span>}
          </p>
        </div>
      </div>

      {/* Teams */}
      <div className="px-5 py-5 flex items-center gap-4">
        <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
          <TeamBadge team={home} size="lg" />
          <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{home.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Home</span>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className="w-px h-8 bg-gray-200" />
          <span className="my-2 text-xs font-bold text-gray-400 tracking-widest">VS</span>
          <span className="w-px h-8 bg-gray-200" />
        </div>
        <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
          <TeamBadge team={away} size="lg" />
          <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{away.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Away</span>
        </div>
      </div>

      {/* Pick buttons — home | draw | away */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
        {/* Home button */}
        {(() => {
          const isSelected = homePicked;
          return (
            <button
              onClick={() => onSelect(home.id)}
              disabled={isLocked}
              className={`relative flex items-center justify-center gap-2 py-3.5 px-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${
                isSelected && resultLocked ? "bg-gray-100 text-gray-500"
                : isSelected ? "bg-brand-gold/10 text-brand-gold active:scale-[0.99]"
                : resultLocked ? "bg-white text-gray-300"
                : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 active:scale-[0.99] disabled:opacity-50"
              }`}
            >
              {isSelected && !resultLocked && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-gold rounded-b-sm" />}
              <TeamBadge team={home} size="xs" />
              <span className="truncate">{home.short_name || home.name}</span>
              {isSelected && !resultLocked && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-brand-gold flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
              {isSelected && resultLocked && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-gray-500" viewBox="0 0 10 10" fill="none"><rect x="2" y="5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M3.5 5V3.5a1.5 1.5 0 0 1 3 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                </span>
              )}
            </button>
          );
        })()}

        {/* Draw button */}
        {(() => {
          const isSelected = drawPicked;
          return (
            <button
              onClick={() => onSelect("draw")}
              disabled={isLocked}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-3.5 px-2 text-xs font-bold uppercase tracking-widest transition-all duration-150 disabled:cursor-not-allowed ${
                isSelected && resultLocked ? "bg-gray-100 text-gray-500"
                : isSelected ? "bg-brand-gold/10 text-brand-gold active:scale-[0.99]"
                : resultLocked ? "bg-white text-gray-300"
                : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:scale-[0.99] disabled:opacity-50"
              }`}
            >
              {isSelected && !resultLocked && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-gold rounded-b-sm" />}
              <span className="text-base leading-none">🤝</span>
              <span>Draw</span>
              {isSelected && !resultLocked && (
                <span className="w-4 h-4 rounded-full bg-brand-gold flex items-center justify-center mt-0.5">
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
            </button>
          );
        })()}

        {/* Away button */}
        {(() => {
          const isSelected = awayPicked;
          return (
            <button
              onClick={() => onSelect(away.id)}
              disabled={isLocked}
              className={`relative flex items-center justify-center gap-2 py-3.5 px-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${
                isSelected && resultLocked ? "bg-gray-100 text-gray-500"
                : isSelected ? "bg-brand-gold/10 text-brand-gold active:scale-[0.99]"
                : resultLocked ? "bg-white text-gray-300"
                : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 active:scale-[0.99] disabled:opacity-50"
              }`}
            >
              {isSelected && !resultLocked && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-gold rounded-b-sm" />}
              <span className="truncate">{away.short_name || away.name}</span>
              <TeamBadge team={away} size="xs" />
              {isSelected && !resultLocked && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-brand-gold flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
              {isSelected && resultLocked && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-gray-500" viewBox="0 0 10 10" fill="none"><rect x="2" y="5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M3.5 5V3.5a1.5 1.5 0 0 1 3 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                </span>
              )}
            </button>
          );
        })()}
      </div>

      {/* Footer banner */}
      {resultLocked ? (
        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
          {drawPicked ? (
            <p className="text-xs text-gray-500">Your pick: <span className="font-semibold text-gray-700">🤝 Draw</span></p>
          ) : picked ? (
            <>
              <TeamBadge team={homePicked ? home : away} size="xs" />
              <p className="text-xs text-gray-500">
                Your pick: <span className="font-semibold text-gray-700">{homePicked ? home.name : away.name}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400 italic">No pick submitted for this fixture.</p>
          )}
        </div>
      ) : drawPicked ? (
        <div className="px-5 py-2.5 bg-brand-gold/8 border-t border-brand-gold/20 flex items-center gap-2">
          <p className="text-xs font-medium text-brand-gold-dark">You&apos;re tipping <span className="font-bold">🤝 Draw</span></p>
        </div>
      ) : (homePicked || awayPicked) ? (
        <div className="px-5 py-2.5 bg-brand-gold/8 border-t border-brand-gold/20 flex items-center gap-2">
          <TeamBadge team={homePicked ? home : away} size="xs" />
          <p className="text-xs font-medium text-brand-gold-dark">
            You&apos;re tipping <span className="font-bold">{homePicked ? home.name : away.name}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
