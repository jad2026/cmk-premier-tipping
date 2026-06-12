import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import TeamBadge from "@/components/TeamBadge";
import type { Gameweek, Fixture } from "@/lib/supabase/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type RoundStatus = "open" | "completed" | "upcoming";

type RoundInfo = {
  gameweek: Gameweek;
  status: RoundStatus;
  total: number;
  resultsIn: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDeadline(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roundStatus(gw: Gameweek, fixtures: Fixture[]): RoundStatus {
  if (gw.is_open) return "open";
  if (fixtures.length > 0 && fixtures.every((f) => f.result_team_id !== null)) return "completed";
  return "upcoming";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: gameweeks }, { data: teams }, { data: allFixtures }] =
    await Promise.all([
      supabase.from("gameweeks").select("*").order("number"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("fixtures").select("id, gameweek_id, result_team_id"),
    ]);

  // Build per-round info
  const fixturesByGw = new Map<string, Fixture[]>();
  for (const f of allFixtures ?? []) {
    const list = fixturesByGw.get(f.gameweek_id) ?? [];
    list.push(f as Fixture);
    fixturesByGw.set(f.gameweek_id, list);
  }

  const rounds: RoundInfo[] = (gameweeks ?? []).map((gw) => {
    const fixtures = fixturesByGw.get(gw.id) ?? [];
    return {
      gameweek: gw,
      status: roundStatus(gw, fixtures),
      total: fixtures.length,
      resultsIn: fixtures.filter((f) => f.result_team_id !== null).length,
    };
  });

  // ── Active round logic ────────────────────────────────────────────────────
  // Find the open round. If it's fully completed (all results in), prefer
  // the next upcoming round as the "active" one to display.
  const openRound = rounds.find((r) => r.status === "open");
  const nextUpcoming = rounds.find((r) => r.status === "upcoming");
  const allComplete = rounds.length > 0 && rounds.every((r) => r.status === "completed");

  let activeRound: RoundInfo | null = null;
  let activeMode: "open" | "open-complete" | "coming-soon" | "season-complete" | "none" = "none";

  if (allComplete) {
    activeMode = "season-complete";
  } else if (openRound) {
    const allResultsIn = openRound.total > 0 && openRound.resultsIn === openRound.total;
    if (allResultsIn && nextUpcoming) {
      activeRound = nextUpcoming;
      activeMode = "coming-soon";
    } else if (allResultsIn) {
      // Open but all done, no next round
      activeRound = openRound;
      activeMode = "open-complete";
    } else {
      activeRound = openRound;
      activeMode = "open";
    }
  } else if (nextUpcoming) {
    activeRound = nextUpcoming;
    activeMode = "coming-soon";
  }

  // ── Top player (season complete only) ────────────────────────────────────
  let winner: string | null = null;
  if (activeMode === "season-complete") {
    const [{ data: correctPicks }, { data: profiles }] = await Promise.all([
      supabase.from("picks").select("user_id").eq("is_correct", true),
      supabase.from("profiles").select("id, display_name"),
    ]);

    if (correctPicks && correctPicks.length > 0) {
      const tally = new Map<string, number>();
      for (const p of correctPicks) {
        tally.set(p.user_id, (tally.get(p.user_id) ?? 0) + 1);
      }
      const topUserId = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const profile = profiles?.find((p) => p.id === topUserId);
      winner = profile?.display_name?.trim() || `Player ${topUserId.slice(0, 5).toUpperCase()}`;
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[5.5rem_1fr_5.5rem] items-stretch gap-3">
        <div className="hidden md:flex flex-col justify-around items-center py-8">
          {teams?.slice(0, 4).map((team) => (
            <div key={team.id} className="opacity-60 hover:opacity-90 transition-opacity duration-200" title={team.name}>
              <TeamBadge team={team} size="xl" />
            </div>
          ))}
        </div>

        <section className="relative rounded-3xl bg-brand overflow-hidden shadow-card-lg">
          <Image src="/hero.jpg" alt="" fill priority
            sizes="(min-width: 768px) calc(100vw - 12rem), 100vw"
            className="object-cover pointer-events-none" />
          <div className="absolute inset-0 bg-brand-dark/75 pointer-events-none" />
          <div className="absolute inset-0 bg-hero-pattern pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-60 h-60 rounded-full bg-brand-light/30 blur-3xl pointer-events-none" />
          <div className="relative px-8 sm:px-12 py-14 sm:py-16 text-center">
            <span className="inline-block mb-4 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/30 text-brand-gold text-xs font-semibold uppercase tracking-widest">
              2026 Season
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 leading-[1.1]">
              Club Rugby<br />
              <span className="text-brand-gold">Tipping</span>
            </h1>
            <p className="text-blue-200/80 text-lg mb-8 max-w-sm mx-auto">
              Pick the winners. Top the table. Win the glory.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link href="/tips" className="btn-gold shadow-lg">Make Your Tips →</Link>
              <Link href="/leaderboard" className="btn-ghost">Leaderboard</Link>
            </div>
          </div>
        </section>

        <div className="hidden md:flex flex-col justify-around items-center py-8">
          {teams?.slice(4, 8).map((team) => (
            <div key={team.id} className="opacity-60 hover:opacity-90 transition-opacity duration-200" title={team.name}>
              <TeamBadge team={team} size="xl" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Active round card ─────────────────────────────────────────────────── */}
      {activeMode === "open" && activeRound && (
        <section className="card-md px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <span className="flex w-10 h-10 items-center justify-center rounded-full bg-green-100 text-green-600 text-lg">🟢</span>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-70" />
            </div>
            <div>
              <p className="eyebrow mb-0.5">Open Now</p>
              <h2 className="text-lg font-bold text-brand leading-tight">{activeRound.gameweek.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Deadline: <span className="font-medium text-gray-700">{fmtDeadline(activeRound.gameweek.deadline)}</span>
              </p>
            </div>
          </div>
          <Link href="/tips" className="btn-primary shrink-0">Submit Tips</Link>
        </section>
      )}

      {activeMode === "open-complete" && activeRound && (
        <section className="card-md px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="flex w-10 h-10 items-center justify-center rounded-full bg-brand-gold/15 text-xl shrink-0">✅</span>
            <div>
              <p className="eyebrow mb-0.5">Round Complete</p>
              <h2 className="text-lg font-bold text-brand leading-tight">{activeRound.gameweek.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">All results are in for this round.</p>
            </div>
          </div>
          <Link href="/leaderboard" className="btn-primary shrink-0">View Leaderboard</Link>
        </section>
      )}

      {activeMode === "coming-soon" && activeRound && (
        <section className="card-md px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="flex w-10 h-10 items-center justify-center rounded-full bg-blue-50 text-xl shrink-0">📅</span>
            <div>
              <p className="eyebrow mb-0.5">Coming Soon</p>
              <h2 className="text-lg font-bold text-brand leading-tight">{activeRound.gameweek.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Opens for tips before: <span className="font-medium text-gray-700">{fmtDeadline(activeRound.gameweek.deadline)}</span>
              </p>
            </div>
          </div>
          <Link href="/leaderboard" className="btn-ghost shrink-0">Leaderboard</Link>
        </section>
      )}

      {activeMode === "season-complete" && (
        <section className="card-md overflow-hidden">
          <div className="bg-gradient-to-r from-brand to-brand-light px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Season Complete</p>
              <p className="text-white font-bold text-lg leading-tight">Competition Finished!</p>
            </div>
          </div>
          <div className="px-6 py-5">
            {winner ? (
              <p className="text-gray-700">
                Congratulations to{" "}
                <span className="font-bold text-brand">{winner}</span>{" "}
                — our 2026 tipping champion! Thanks to everyone who played this season.
              </p>
            ) : (
              <p className="text-gray-700">
                The 2026 tipping competition has finished. Thanks to everyone who played!
              </p>
            )}
            <Link href="/leaderboard" className="btn-primary mt-4 inline-flex">View Final Standings</Link>
          </div>
        </section>
      )}

      {activeMode === "none" && (
        <section className="card px-6 py-5 text-center">
          <p className="text-gray-500 text-sm">No rounds are currently open for tipping. Check back soon!</p>
        </section>
      )}

      {/* ── All rounds ────────────────────────────────────────────────────────── */}
      {rounds.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
            <h2 className="text-base font-bold text-brand uppercase tracking-wide">All Rounds</h2>
          </div>
          <div className="card overflow-hidden divide-y divide-gray-50">
            {rounds.map(({ gameweek: gw, status, total, resultsIn }) => (
              <div key={gw.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                <div className="min-w-0">
                  <span className="font-medium text-gray-800 text-sm">{gw.label}</span>
                  {status === "completed" && total > 0 && (
                    <span className="ml-2 text-xs text-gray-400">{resultsIn}/{total} results</span>
                  )}
                </div>
                <RoundStatusBadge status={status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Round status badge ────────────────────────────────────────────────────────

function RoundStatusBadge({ status }: { status: RoundStatus }) {
  if (status === "open") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 shrink-0">
        ● Open
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-gold/15 text-brand-gold-dark shrink-0">
        ✓ Completed
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 shrink-0">
      Upcoming
    </span>
  );
}
