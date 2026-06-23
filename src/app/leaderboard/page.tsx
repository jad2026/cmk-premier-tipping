import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import TeamBadge from "@/components/TeamBadge";
import Avatar from "@/components/Avatar";
import type { Team, Fixture, Gameweek } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ── Local types ───────────────────────────────────────────────────────────────

type Profile = { id: string; display_name: string | null; avatar_url: string | null };

type RichPick = {
  id: string;
  user_id: string;
  fixture_id: string;
  picked_team_id: string | null;
  picked_draw: boolean;
  is_correct: boolean | null;
  auto_picked: boolean;
  picked_team: Team | null;
};

type RichFixture = Omit<Fixture, "home_team" | "away_team"> & {
  home_team: Team;
  away_team: Team;
};

type LeaderboardEntry = {
  user_id: string;
  displayName: string;
  avatarUrl: string | null;
  correct: number;
  total: number;
};

// ── Score types + helper ──────────────────────────────────────────────────────

type MatchScore = { home: string; away: string };
type RawMatchResult = {
  home_team: string;
  away_team: string;
  home_score: string | null;
  away_score: string | null;
};

function findScore(
  fixture: { home_team: { name: string }; away_team: { name: string } },
  results: RawMatchResult[]
): MatchScore | null {
  const hn = fixture.home_team.name.toLowerCase();
  const an = fixture.away_team.name.toLowerCase();
  for (const r of results) {
    if (!r.home_score || !r.away_score) continue;
    const rh = r.home_team.toLowerCase();
    const ra = r.away_team.toLowerCase();
    if ((rh.includes(hn) || hn.includes(rh)) && (ra.includes(an) || an.includes(ra))) {
      return { home: r.home_score, away: r.away_score };
    }
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveDisplayName(
  userId: string,
  profileMap: Map<string, string | null>
): string {
  const name = profileMap.get(userId)?.trim();
  return name || `Player ${userId.slice(0, 5).toUpperCase()}`;
}

function pct(correct: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((correct / total) * 100)}%`;
}

function pctNum(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

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

// ── Pick chip ─────────────────────────────────────────────────────────────────

function PickChip({
  pick,
  name,
  hasResult,
}: {
  pick: RichPick;
  name: string;
  hasResult: boolean;
}) {
  const state = !hasResult ? "pending" : pick.is_correct ? "correct" : "wrong";

  const chipCls =
    state === "correct"
      ? "bg-green-50 border-green-200 text-green-800"
      : state === "wrong"
      ? "bg-red-50 border-red-100 text-red-700 opacity-80"
      : "bg-white border-gray-200 text-gray-600";

  const pickLabel = pick.picked_draw ? "Draw" : pick.picked_team?.name ?? "—";
  const title = `${name} picked ${pickLabel}${pick.auto_picked ? " (auto)" : ""}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-medium ${chipCls}`}
      title={title}
    >
      {pick.picked_draw ? (
        <span className="text-sm leading-none">🤝</span>
      ) : pick.picked_team ? (
        <TeamBadge team={pick.picked_team} size="xs" />
      ) : null}
      <span>{name}</span>
      {pick.picked_draw && <span className="text-gray-400 text-[10px]">Draw</span>}
      {hasResult && (
        <span className={state === "correct" ? "text-green-500 font-bold" : "text-red-400"}>
          {state === "correct" ? "✓" : "✗"}
        </span>
      )}
      {pick.auto_picked && (
        <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-gray-200/80 text-gray-500 border border-gray-300/60 leading-none">
          auto
        </span>
      )}
    </span>
  );
}

// ── Fixture card ──────────────────────────────────────────────────────────────

function FixtureCard({
  fixture,
  picks,
  teamMap,
  profileMap,
  score,
}: {
  fixture: RichFixture;
  picks: RichPick[];
  teamMap: Map<string, Team>;
  profileMap: Map<string, string | null>;
  score: MatchScore | null;
}) {
  const hasResult = fixture.result_team_id !== null || fixture.is_draw;
  const resultTeam = fixture.result_team_id ? teamMap.get(fixture.result_team_id) : null;

  const sorted = [...picks].sort((a, b) => {
    const stateOrder = (p: RichPick) => (!hasResult ? 1 : p.is_correct ? 0 : 2);
    const diff = stateOrder(a) - stateOrder(b);
    if (diff !== 0) return diff;
    const autoDiff = (a.auto_picked ? 1 : 0) - (b.auto_picked ? 1 : 0);
    if (autoDiff !== 0) return autoDiff;
    return resolveDisplayName(a.user_id, profileMap).localeCompare(
      resolveDisplayName(b.user_id, profileMap)
    );
  });

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamBadge team={fixture.home_team} size="sm" />
            <span className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
              {fixture.home_team.name}
            </span>
          </div>
          {score ? (
            <span className="shrink-0 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 text-sm font-bold tabular-nums whitespace-nowrap">
              {score.home} – {score.away}
            </span>
          ) : (
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-brand/8 text-brand text-[10px] font-bold tracking-widest">
              VS
            </span>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-gray-800 leading-snug text-right line-clamp-2">
              {fixture.away_team.name}
            </span>
            <TeamBadge team={fixture.away_team} size="sm" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-400">
            {fmtDate(fixture.match_date)}
            {fixture.venue && (
              <span className="before:content-['·'] before:mx-1.5 before:text-gray-300">
                {fixture.venue}
              </span>
            )}
          </p>
          {fixture.is_draw ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              🤝 Draw
            </span>
          ) : hasResult && resultTeam ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
              <span
                className="w-2 h-2 rounded-full ring-1 ring-black/10 shrink-0"
                style={{ backgroundColor: resultTeam.colour }}
              />
              {resultTeam.name} won
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
              Pending
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 bg-[#f8f9fb] border-t border-gray-100">
        {sorted.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No picks submitted yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((pick) => (
              <PickChip
                key={pick.id}
                pick={pick}
                name={resolveDisplayName(pick.user_id, profileMap)}
                hasResult={hasResult}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Leaderboard table ─────────────────────────────────────────────────────────

function LeaderboardTable({ rows, seasonComplete }: { rows: LeaderboardEntry[]; seasonComplete: boolean }) {
  // Build rank medals from distinct score levels so ties share the same medal
  const distinctScores = Array.from(new Set(rows.map((e) => e.correct))).filter((s) => s > 0).sort((a, b) => b - a);
  const medalForScore = new Map<number, "gold" | "silver" | "bronze">();
  if (distinctScores[0] !== undefined) medalForScore.set(distinctScores[0], "gold");
  if (distinctScores[1] !== undefined) medalForScore.set(distinctScores[1], "silver");
  if (distinctScores[2] !== undefined) medalForScore.set(distinctScores[2], "bronze");

  // Compute display rank (1, 1, 3, 4 — not 1, 1, 2, 3)
  let rank = 0;
  let prevCorrect = -1;
  const rankForIndex: number[] = [];
  for (const entry of rows) {
    if (entry.correct !== prevCorrect) { rank++; prevCorrect = entry.correct; }
    rankForIndex.push(rank);
  }

  return (
    <div className="card overflow-hidden">
      {/* Sticky header — lives outside the scroll container */}
      <div className="grid grid-cols-[3rem_1fr_6rem_5rem_5rem] bg-brand text-white text-xs font-semibold uppercase tracking-wider sticky top-0 z-10">
        <div className="px-4 py-3.5 text-center">#</div>
        <div className="px-4 py-3.5">Tipper</div>
        <div className="px-4 py-3.5 text-right">Correct</div>
        <div className="px-4 py-3.5 text-right">Tipped</div>
        <div className="px-4 py-3.5 text-right pr-5">%</div>
      </div>

      {/* Scrollable rows */}
      <div
        className="divide-y divide-gray-50 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#c9a84c_#f3f4f6]"
        style={{ maxHeight: "600px" }}
      >
        {rows.map((entry, idx) => {
          const medal = medalForScore.get(entry.correct);
          const isGold = medal === "gold";
          const hitRate = pctNum(entry.correct, entry.total);
          const displayRank = rankForIndex[idx];

          return (
            <div
              key={entry.user_id}
              className={`grid grid-cols-[3rem_1fr_6rem_5rem_5rem] items-center transition-colors ${
                isGold
                  ? "bg-brand-gold-light/60 border-l-4 border-l-brand-gold"
                  : idx % 2 === 0
                  ? "bg-white hover:bg-gray-50/70"
                  : "bg-[#f9fafb] hover:bg-gray-50"
              }`}
            >
              <div className="px-0 py-4 flex justify-center">
                {medal === "gold" ? (
                  <span className="text-lg leading-none select-none" title={seasonComplete ? "Season Winner" : "Leader"}>🥇</span>
                ) : medal === "silver" ? (
                  <span className="text-lg leading-none select-none" title="2nd place">🥈</span>
                ) : medal === "bronze" ? (
                  <span className="text-lg leading-none select-none" title="3rd place">🥉</span>
                ) : (
                  <span className="text-sm text-gray-400 tabular-nums font-medium">{displayRank}</span>
                )}
              </div>
              <div className="px-4 py-3 flex items-center gap-2.5">
                <Avatar url={entry.avatarUrl} name={entry.displayName} size={32} />
                <span className={`text-sm ${isGold ? "font-bold text-brand" : "font-medium text-gray-800"}`}>
                  {entry.displayName}
                </span>
              </div>
              <div className="px-4 py-4 text-right">
                <span className={`text-sm tabular-nums font-bold ${isGold ? "text-brand-gold-dark" : "text-green-700"}`}>
                  {entry.correct}
                </span>
              </div>
              <div className="px-4 py-4 text-right">
                <span className="text-sm tabular-nums text-gray-500">{entry.total}</span>
              </div>
              <div className="px-4 pr-5 py-4 text-right">
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs tabular-nums font-semibold ${
                    entry.total === 0 ? "text-gray-400" :
                    hitRate >= 60 ? "text-green-600" : "text-gray-600"
                  }`}>
                    {pct(entry.correct, entry.total)}
                  </span>
                  {entry.total > 0 && (
                    <div className="w-12 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          hitRate >= 60 ? "bg-green-500" :
                          hitRate >= 40 ? "bg-amber-400" : "bg-gray-400"
                        }`}
                        style={{ width: `${hitRate}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ title, sub, badge }: { title: string; sub?: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5 mb-0.5">
          <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
          <h2 className="text-lg font-bold text-brand tracking-tight">{title}</h2>
        </div>
        {sub && <p className="text-xs text-gray-400 ml-3.5">{sub}</p>}
      </div>
      {badge && (
        <span className="card px-3 py-1 text-xs text-gray-500 font-medium shadow-none">{badge}</span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  // Wave 1 — items that don't need competition scoping, plus the competition's
  // gameweek IDs which are required to scope everything else.
  const [
    { data: compGwRows },
    { data: profiles },
    { data: teams },
    { data: seasonConfig },
    { data: matchResultsRaw },
  ] = await Promise.all([
    supabase.from("gameweeks").select("id").eq("competition_id", compId),
    supabase.from("profiles").select("id, display_name, avatar_url"),
    supabase.from("teams").select("*"),
    supabase.from("season_config").select("season_complete, season_name").eq("id", 1).single(),
    supabase.from("match_results").select("home_team, away_team, home_score, away_score").eq("result_status", "final"),
  ]);

  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  // Wave 2 — queries scoped to this competition via compGwIds.
  // Also pre-fetch all fixture IDs for this competition so we can scope picks.
  const [
    { data: openGameweek },
    { data: closedGameweeks },
    { data: fixturesWithResults },
    { data: compFixtureRows },
  ] = await Promise.all([
    supabase
      .from("gameweeks")
      .select("*")
      .eq("competition_id", compId)
      .eq("is_open", true)
      .maybeSingle() as unknown as Promise<{ data: Gameweek | null }>,
    supabase
      .from("gameweeks")
      .select("*")
      .eq("competition_id", compId)
      .eq("is_open", false)
      .order("number"),
    compGwIds.length > 0
      ? supabase
          .from("fixtures")
          .select("gameweek_id")
          .or("result_team_id.not.is.null,is_draw.eq.true")
          .in("gameweek_id", compGwIds)
      : Promise.resolve({ data: [] as { gameweek_id: string }[], error: null }),
    compGwIds.length > 0
      ? supabase.from("fixtures").select("id").in("gameweek_id", compGwIds)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ]);

  const compFixtureIds = (compFixtureRows ?? []).map((f) => f.id);

  // Overall picks — scoped to this competition's fixtures.
  // (season_config and match_results are left unscoped as per-competition follow-ups)
  const { data: allPicksRaw } = compFixtureIds.length > 0
    ? await supabase.from("picks").select("user_id, is_correct").in("fixture_id", compFixtureIds)
    : { data: [] as { user_id: string; is_correct: boolean | null }[] };

  const matchResults = (matchResultsRaw ?? []) as RawMatchResult[];

  const seasonComplete = seasonConfig?.season_complete ?? false;
  const seasonName = seasonConfig?.season_name ?? `${new Date().getFullYear()} Season`;

  const teamMap = new Map<string, Team>((teams ?? []).map((t) => [t.id, t]));
  const profileMap = new Map<string, string | null>(
    (profiles ?? []).map((p: Profile) => [p.id, p.display_name])
  );
  const avatarMap = new Map<string, string | null>(
    (profiles ?? []).map((p: Profile) => [p.id, p.avatar_url])
  );

  // Gameweek IDs that have at least one result
  const gwIdsWithResults = new Set((fixturesWithResults ?? []).map((f) => f.gameweek_id));

  // Past rounds = closed and have results
  const pastRounds = (closedGameweeks ?? []).filter((gw) => gwIdsWithResults.has(gw.id));

  // This week's fixtures and picks
  let weekFixtures: RichFixture[] = [];
  let weekPicksByFixture = new Map<string, RichPick[]>();

  if (openGameweek) {
    const { data: fixturesRaw } = await supabase
      .from("fixtures")
      .select(`*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`)
      .eq("gameweek_id", openGameweek.id)
      .order("match_date");

    weekFixtures = (fixturesRaw ?? []) as RichFixture[];

    if (weekFixtures.length > 0) {
      const { data: picksRaw } = await supabase
        .from("picks")
        .select("id, user_id, fixture_id, picked_team_id, picked_draw, is_correct, auto_picked, picked_team:teams!picks_picked_team_id_fkey(*)")
        .in("fixture_id", weekFixtures.map((f) => f.id));

      for (const pick of (picksRaw ?? []) as unknown as RichPick[]) {
        const list = weekPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        weekPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

  // Overall leaderboard — seed from profiles so all registered users appear even with 0 picks
  const lbMap = new Map<string, { correct: number; total: number }>(
    (profiles ?? []).map((p: Profile) => [p.id, { correct: 0, total: 0 }])
  );
  for (const pick of allPicksRaw ?? []) {
    const e = lbMap.get(pick.user_id) ?? { correct: 0, total: 0 };
    e.total += 1;
    if (pick.is_correct) e.correct += 1;
    lbMap.set(pick.user_id, e);
  }

  const leaderboard: LeaderboardEntry[] = Array.from(lbMap.entries())
    .map(([user_id, stats]) => ({
      user_id,
      displayName: resolveDisplayName(user_id, profileMap),
      avatarUrl: avatarMap.get(user_id) ?? null,
      ...stats,
    }))
    .sort(
      (a, b) =>
        b.correct - a.correct ||
        b.total - a.total ||
        a.displayName.localeCompare(b.displayName)
    );

  const noRoundsPlayed = leaderboard.length > 0 && leaderboard.every((e) => e.total === 0);

  // ── Season summary data (only when season is complete) ───────────────────
  let summaryGameweeks: Gameweek[] = [];
  const summaryFixturesByGw = new Map<string, RichFixture[]>();
  const summaryPicksByFixture = new Map<string, RichPick[]>();

  if (seasonComplete) {
    const { data: allGws } = await supabase
      .from("gameweeks")
      .select("*")
      .eq("competition_id", compId)
      .order("number");

    summaryGameweeks = allGws ?? [];

    const { data: allFixturesRich } = await supabase
      .from("fixtures")
      .select(`*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`)
      .in("gameweek_id", compGwIds)
      .order("match_date");

    const richFixtures = (allFixturesRich ?? []) as RichFixture[];
    for (const f of richFixtures) {
      const list = summaryFixturesByGw.get(f.gameweek_id) ?? [];
      list.push(f);
      summaryFixturesByGw.set(f.gameweek_id, list);
    }

    const allFixtureIds = richFixtures.map((f) => f.id);
    if (allFixtureIds.length > 0) {
      const { data: summaryPicksRaw } = await supabase
        .from("picks")
        .select("id, user_id, fixture_id, picked_team_id, picked_draw, is_correct, auto_picked, picked_team:teams!picks_picked_team_id_fkey(*)")
        .in("fixture_id", allFixtureIds);

      for (const pick of (summaryPicksRaw ?? []) as unknown as RichPick[]) {
        const list = summaryPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        summaryPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

  return (
    <div className="space-y-10">

      {/* ── Page title ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <p className="eyebrow mb-1">{seasonName}</p>
          <h1 className="text-2xl font-bold tracking-tight text-brand">Leaderboard</h1>
        </div>
        {seasonComplete && (
          <span className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold-dark text-xs font-semibold uppercase tracking-wide">
            🏆 Season Complete
          </span>
        )}
      </div>

      {/* ── 1. Overall Standings ────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading
          title={seasonComplete ? "Final Standings" : "Overall Standings"}
          badge={leaderboard.length > 0 ? `${leaderboard.length} tipper${leaderboard.length !== 1 ? "s" : ""}` : undefined}
        />
        {noRoundsPlayed && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-3.5 flex items-center gap-3">
            <span className="text-xl shrink-0">🏉</span>
            <p className="text-sm text-blue-800 font-medium">No rounds played yet — scores will appear here once the first round is complete.</p>
          </div>
        )}
        {leaderboard.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <span className="text-4xl mb-3 block">📋</span>
            <p className="font-medium text-gray-600">No participants yet</p>
            <p className="text-sm text-gray-400 mt-1">Registered users will appear here once they sign up.</p>
          </div>
        ) : (
          <LeaderboardTable rows={leaderboard} seasonComplete={seasonComplete} />
        )}
      </section>

      {/* ── 2. This Week ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading
          title={openGameweek ? `This Week — ${openGameweek.label}` : "This Week's Results"}
          sub={openGameweek ? `Deadline ${fmtDeadline(openGameweek.deadline)}` : undefined}
          badge={openGameweek ? `${weekFixtures.length} fixture${weekFixtures.length !== 1 ? "s" : ""}` : undefined}
        />

        {!openGameweek ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-medium text-gray-600">No round currently open</p>
            <p className="text-sm text-gray-400 mt-1">Check back when the next round opens for tipping.</p>
          </div>
        ) : weekFixtures.length === 0 ? (
          <div className="card px-6 py-10 text-center text-sm text-gray-500">
            No fixtures scheduled for this round yet.
          </div>
        ) : (
          <div className="space-y-3">
            {weekFixtures.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                picks={weekPicksByFixture.get(fixture.id) ?? []}
                teamMap={teamMap}
                profileMap={profileMap}
                score={findScore(fixture, matchResults)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 3. Past Rounds ──────────────────────────────────────────────── */}
      {!seasonComplete && pastRounds.length > 0 && (
        <section className="space-y-4">
          <SectionHeading
            title="Past Rounds"
            badge={`${pastRounds.length} round${pastRounds.length !== 1 ? "s" : ""}`}
          />
          <div className="card overflow-hidden divide-y divide-gray-50">
            {pastRounds.map((gw) => (
              <Link
                key={gw.id}
                href={`/leaderboard/round/${gw.number}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/70 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center tabular-nums">
                    {gw.number}
                  </span>
                  <span className="font-medium text-gray-800 text-sm">{gw.label}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-xs">View results</span>
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 4. Season Summary (season complete only) ────────────────────── */}
      {seasonComplete && summaryGameweeks.length > 0 && (
        <section className="space-y-6">
          <SectionHeading
            title="Season Summary"
            sub="Complete results for every round"
            badge={`${summaryGameweeks.length} round${summaryGameweeks.length !== 1 ? "s" : ""}`}
          />

          {summaryGameweeks.map((gw) => {
            const fixtures = summaryFixturesByGw.get(gw.id) ?? [];
            if (fixtures.length === 0) return null;
            const roundCorrect = fixtures.reduce((sum, f) => {
              const picks = summaryPicksByFixture.get(f.id) ?? [];
              return sum + picks.filter((p) => p.is_correct).length;
            }, 0);
            const roundTotal = fixtures.reduce((sum, f) => {
              return sum + (summaryPicksByFixture.get(f.id)?.length ?? 0);
            }, 0);

            return (
              <div key={gw.id} className="space-y-3">
                {/* Round sub-header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                      {gw.number}
                    </span>
                    <span className="font-semibold text-gray-800 text-sm">{gw.label}</span>
                  </div>
                  {roundTotal > 0 && (
                    <span className="text-xs text-gray-500">
                      <span className="font-semibold text-green-700">{roundCorrect}</span>
                      {" / "}
                      {roundTotal} correct picks
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {fixtures.map((fixture) => (
                    <FixtureCard
                      key={fixture.id}
                      fixture={fixture}
                      picks={summaryPicksByFixture.get(fixture.id) ?? []}
                      teamMap={teamMap}
                      profileMap={profileMap}
                      score={findScore(fixture, matchResults)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
