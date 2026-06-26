import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, NPC_COMPETITION_ID } from "@/lib/competition";
import Avatar from "@/components/Avatar";
import JoinCompetitionButton from "@/components/JoinCompetitionButton";
import type { Gameweek, Fixture } from "@/lib/supabase/types";
import { parseVideoUrl } from "@/lib/video";

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
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: { user } } = await supabase.auth.getUser();

  let isEnrolled = false;
  if (user) {
    const { data: participant } = await supabase
      .from("competition_participants")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("competition_id", compId)
      .maybeSingle();
    isEnrolled = !!participant;
  }

  // Wave 1: competition-scoped gameweeks + season config + try of the week
  const [{ data: compGwRows }, { data: seasonConfig }, { data: activeTry }] =
    await Promise.all([
      supabase.from("gameweeks").select("*").eq("competition_id", compId).order("number"),
      supabase.from("season_config").select("season_complete, season_name").eq("competition_id", compId).single(),
      supabase.from("try_of_the_week").select("*").eq("competition_id", compId).eq("is_active", true).maybeSingle(),
    ]);

  const gameweeks = compGwRows ?? [];
  const compGwIds = gameweeks.map((g) => g.id);

  // Wave 2: fixtures scoped to this competition's gameweeks
  const { data: allFixtures } = compGwIds.length > 0
    ? await supabase.from("fixtures").select("id, gameweek_id, result_team_id").in("gameweek_id", compGwIds)
    : { data: [] };

  // Build per-round info
  const fixturesByGw = new Map<string, Fixture[]>();
  for (const f of allFixtures ?? []) {
    const list = fixturesByGw.get(f.gameweek_id) ?? [];
    list.push(f as Fixture);
    fixturesByGw.set(f.gameweek_id, list);
  }

  const rounds: RoundInfo[] = gameweeks.map((gw) => {
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

  // Earliest-deadline open round that still has at least one fixture without a result
  const openRoundsWithResults = rounds
    .filter((r) => r.status === "open" && r.total > 0 && r.resultsIn < r.total)
    .sort((a, b) => new Date(a.gameweek.deadline).getTime() - new Date(b.gameweek.deadline).getTime());
  const activeOpenRound = openRoundsWithResults[0] ?? null;
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

  let heroSubtitle = "Next round opens soon";
  if (activeOpenRound && new Date(activeOpenRound.gameweek.deadline) > new Date()) {
    heroSubtitle = `${activeOpenRound.gameweek.label} — Tips close ${fmtDeadline(activeOpenRound.gameweek.deadline)}`;
  } else if (activeOpenRound) {
    heroSubtitle = `${activeOpenRound.gameweek.label} — Picks closed, results pending`;
  } else if (seasonComplete) {
    heroSubtitle = `${seasonName} — Season complete`;
  }

  // ── Top player (season complete banner only) ─────────────────────────────
  let winner: string | null = null;
  let winnerAvatarUrl: string | null = null;
  if (seasonComplete) {
    const compFixtureIds = (allFixtures ?? []).map((f) => f.id);
    const [{ data: correctPicks }, { data: profiles }] = await Promise.all([
      compFixtureIds.length > 0
        ? supabase.from("picks").select("user_id").eq("is_correct", true).in("fixture_id", compFixtureIds)
        : Promise.resolve({ data: [] }),
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
        <Image src={compId === NPC_COMPETITION_ID ? "/npc-hero.jpg" : "/hero.jpg"} alt="" fill priority
          sizes="100vw"
          className="object-cover pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.3))" }} />
        <div className="relative px-6 sm:px-10 py-14 md:py-20 text-left">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 leading-[1.1]">
            CLUB RUGBY<br />
            <span className="text-brand-gold">TIPPING</span>
          </h1>
          <p className="text-sm sm:text-base text-white/60 font-medium mb-6">{heroSubtitle}</p>
          <div className="flex justify-start gap-3 flex-wrap">
            <Link href="/tips" className="btn-gold shadow-lg">Make Your Tips →</Link>
            <Link href="/leaderboard" className="btn-ghost">Leaderboard</Link>
          </div>
        </div>
      </section>

      {/* ── NPC cross-promotion ────────────────────────────────────────────── */}
      {compId !== NPC_COMPETITION_ID && (
        <a
          href="https://npc.clubrugbytipping.com"
          className="card-md group relative overflow-hidden flex items-center gap-5 px-6 py-5 hover:shadow-card-lg transition-shadow"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mb-1">Tip the NPC</p>
            <p className="text-sm text-gray-600 leading-snug">
              Think you know provincial rugby? Join the Bunnings NPC tipping competition and compete nationally.
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-brand-gold group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
            Join NPC Tipping →
          </span>
        </a>
      )}

      {/* ── Join competition banner ─────────────────────────────────────────── */}
      {user && !isEnrolled && !seasonComplete && (
        <section className="card-md px-6 py-6 text-center space-y-3">
          <span className="text-3xl block">🏉</span>
          <h2 className="text-lg font-bold text-brand">Join This Competition</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            You haven&apos;t joined this competition yet. Join now to start tipping and appear on the leaderboard!
          </p>
          <JoinCompetitionButton />
        </section>
      )}

      {/* ── Open round cards (one per open round) ────────────────────────────── */}
      {!seasonComplete && openRoundsWithResults.map((r) => {
        const deadlinePassed = new Date(r.gameweek.deadline) <= new Date();
        return deadlinePassed ? (
          <section key={r.gameweek.id} className="card-md px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <span className="flex w-10 h-10 items-center justify-center rounded-full bg-orange-50 text-xl shrink-0">🔒</span>
              <div>
                <p className="eyebrow mb-0.5">Picks Closed</p>
                <h2 className="text-lg font-bold text-brand leading-tight">{r.gameweek.label}</h2>
                <p className="text-sm text-gray-500 mt-0.5">Results will be entered soon.</p>
              </div>
            </div>
            <Link href="/leaderboard" className="btn-ghost shrink-0">Leaderboard</Link>
          </section>
        ) : (
          <section key={r.gameweek.id} className="card-md px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shrink-0" />
              <div>
                <p className="eyebrow mb-0.5">Open Now</p>
                <h2 className="text-lg font-bold text-brand leading-tight">{r.gameweek.label}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Deadline: <span className="font-medium text-gray-700">{fmtDeadline(r.gameweek.deadline)}</span>
                </p>
              </div>
            </div>
            <Link href={`/tips#${r.gameweek.label.toLowerCase().replace(/\s+/g, "-")}`} className="btn-primary shrink-0">Submit Tips</Link>
          </section>
        );
      })}

      {/* ── Coming soon (no open rounds) ─────────────────────────────────────── */}
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

      {/* ── Try of the Week ────────────────────────────────────────────── */}
      {activeTry && (() => {
        const tryGw = gameweeks.find((gw) => gw.id === activeTry.gameweek_id);
        const video = parseVideoUrl(activeTry.video_url);
        return (
          <section className="card-md overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center gap-2">
              <span className="text-xl select-none">🏉</span>
              <h2 className="text-lg font-bold text-brand">Try of the Week</h2>
              {tryGw && (
                <span className="ml-auto text-xs font-medium text-gray-400">{tryGw.label}</span>
              )}
            </div>
            {video.type === "youtube" ? (
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={video.embedUrl}
                  title="Try of the Week"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            ) : (
              <div className="px-6">
                <a
                  href={video.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  ▶ Watch on {video.type === "facebook" ? "Facebook" : video.type === "instagram" ? "Instagram" : "External Site"}
                </a>
              </div>
            )}
            <div className="px-6 py-4 space-y-1">
              {(activeTry.player_name || activeTry.team_name) && (
                <p className="text-sm font-semibold text-gray-800">
                  {[activeTry.player_name, activeTry.team_name].filter(Boolean).join(" · ")}
                </p>
              )}
              {activeTry.caption && (
                <p className="text-sm text-gray-500 italic">{activeTry.caption}</p>
              )}
            </div>
          </section>
        );
      })()}

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
              {seasonName} — Tipping Champion
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
          <div className="overflow-hidden rounded-lg border border-gray-100">
            {rounds.map(({ gameweek: gw, status, total, resultsIn }, i) => (
              <div key={gw.id} className={`flex items-center justify-between px-4 py-2 hover:bg-gray-50/60 transition-colors${i % 2 === 0 ? " bg-gray-50/40" : ""}`}>
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
      <footer className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
        <span>Club Rugby Tipping &copy; 2026</span>
        <span>clubrugbytipping.com</span>
      </footer>
    </div>
  );
}

// ── Round status badge ────────────────────────────────────────────────────────

function RoundStatusBadge({ status }: { status: RoundStatus }) {
  if (status === "open") {
    return (
      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 shrink-0">
        ● Open
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-brand-gold/15 text-brand-gold-dark shrink-0">
        Completed
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-500 shrink-0">
      Upcoming
    </span>
  );
}
