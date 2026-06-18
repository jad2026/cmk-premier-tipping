import Link from "next/link";
import Image from "next/image";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Avatar from "@/components/Avatar";
import type { Gameweek, Fixture, Database } from "@/lib/supabase/types";

// Force fresh data on every request — no caching for season state or round rollover
export const dynamic = "force-dynamic";

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
  if (fixtures.length > 0 && fixtures.every((f) => f.result_team_id !== null)) return "completed";
  if (gw.is_open) return "open";
  return "upcoming";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const [{ data: gameweeks }, { data: teams }, { data: allFixtures }, { data: seasonConfig }] =
    await Promise.all([
      supabase.from("gameweeks").select("*").order("number"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("fixtures").select("id, gameweek_id, result_team_id"),
      supabase.from("season_config").select("season_complete, season_name").eq("id", 1).single(),
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
  const seasonComplete = seasonConfig?.season_complete ?? false;
  const seasonName = seasonConfig?.season_name ?? `${new Date().getFullYear()} Season`;

  // First open round that still has at least one fixture without a result
  const activeOpenRound = rounds.find(
    (r) => r.status === "open" && r.total > 0 && r.resultsIn < r.total
  );
  // First closed round that has fixtures but no results yet (coming soon)
  const nextUpcoming = rounds.find((r) => r.status === "upcoming" && r.total > 0);

  const hasAnyFixtures = (allFixtures ?? []).length > 0;

  let activeRound: RoundInfo | null = null;
  let activeMode: "open" | "picks-closed" | "coming-soon" | "season-complete" | "no-fixtures" | "none" = "none";

  if (seasonComplete) {
    activeMode = "season-complete";
  } else if (!hasAnyFixtures) {
    activeMode = "no-fixtures";
  } else if (activeOpenRound) {
    activeRound = activeOpenRound;
    activeMode = new Date(activeOpenRound.gameweek.deadline) > new Date() ? "open" : "picks-closed";
  } else if (nextUpcoming) {
    activeRound = nextUpcoming;
    activeMode = "coming-soon";
  }

  // ── Top player (season complete banner only) ─────────────────────────────
  let winner: string | null = null;
  let winnerAvatarUrl: string | null = null;
  if (seasonComplete) {
    const [{ data: correctPicks }, { data: profiles }] = await Promise.all([
      supabase.from("picks").select("user_id").eq("is_correct", true),
      supabase.from("profiles").select("id, display_name, avatar_url"),
    ]);

    if (correctPicks && correctPicks.length > 0) {
      const tally = new Map<string, number>();
      for (const p of correctPicks) {
        tally.set(p.user_id, (tally.get(p.user_id) ?? 0) + 1);
      }
      const topUserId = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const profile = profiles?.find((p) => p.id === topUserId);
      winner = profile?.display_name?.trim() || `Player ${topUserId.slice(0, 5).toUpperCase()}`;
      winnerAvatarUrl = profile?.avatar_url ?? null;
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative rounded-3xl bg-brand overflow-hidden shadow-card-lg">
        <Image src="/hero.jpg" alt="" fill priority
          sizes="100vw"
          className="object-cover pointer-events-none" />
        <div className="absolute inset-0 bg-brand-dark/75 pointer-events-none" />
        <div className="absolute inset-0 bg-hero-pattern pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-60 h-60 rounded-full bg-brand-light/30 blur-3xl pointer-events-none" />
        <div className="relative px-8 sm:px-12 py-10 sm:py-12 text-center">
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

      {/* ── Season name strip ────────────────────────────────────────────────── */}
      {!seasonComplete && (
        <div className="text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-sm font-semibold tracking-wide">
            {seasonName}
          </span>
        </div>
      )}

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

      {activeMode === "picks-closed" && activeRound && (
        <section className="card-md px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="flex w-10 h-10 items-center justify-center rounded-full bg-orange-50 text-xl shrink-0">🔒</span>
            <div>
              <p className="eyebrow mb-0.5">Picks Closed</p>
              <h2 className="text-lg font-bold text-brand leading-tight">{activeRound.gameweek.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">Results will be entered soon.</p>
            </div>
          </div>
          <Link href="/leaderboard" className="btn-ghost shrink-0">Leaderboard</Link>
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
        <section className="relative rounded-3xl overflow-hidden shadow-card-lg text-center">
          {/* Background */}
          <div className="absolute inset-0 bg-brand-dark" />
          <div className="absolute inset-0 bg-hero-pattern opacity-30 pointer-events-none" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-brand-light/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-brand-light/20 blur-3xl pointer-events-none" />

          <div className="relative px-8 sm:px-16 py-16 sm:py-20">
            {/* Trophy */}
            <div className="text-7xl sm:text-8xl mb-6 select-none leading-none">🏆</div>

            {/* Label */}
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-gold/70 mb-3">
              Season Complete
            </p>

            {/* Heading */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-8">
              2026 Tipping Champion
            </h1>

            {winner ? (
              <>
                {/* Winner avatar */}
                <div className="flex justify-center mb-5">
                  <div className="rounded-full ring-4 ring-brand-gold shadow-[0_0_32px_rgba(201,168,76,0.4)]">
                    <Avatar
                      url={winnerAvatarUrl}
                      name={winner}
                      size={120}
                      goldFallback
                    />
                  </div>
                </div>

                {/* Winner name */}
                <p
                  className="font-extrabold text-brand-gold leading-none mb-5 break-words"
                  style={{ fontSize: "clamp(2rem, 8vw, 4.5rem)" }}
                >
                  {winner}
                </p>

                {/* Congratulations */}
                <p className="text-white/70 text-base sm:text-lg max-w-md mx-auto mb-10">
                  Congratulations! 🎉 Thanks to everyone who played this season.
                </p>
              </>
            ) : (
              <p className="text-white/70 text-base sm:text-lg max-w-md mx-auto mb-10">
                The 2026 tipping competition has finished. Thanks to everyone who played!
              </p>
            )}

            {/* CTA */}
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-gold hover:bg-brand-gold-dark text-white font-bold text-base shadow-lg transition-all duration-150 active:scale-[0.98]"
            >
              View Final Standings →
            </Link>
          </div>
        </section>
      )}

      {/* ── All rounds — only when a round is actively open ───────────────────── */}
      {activeMode === "open" && rounds.length > 0 && (
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
