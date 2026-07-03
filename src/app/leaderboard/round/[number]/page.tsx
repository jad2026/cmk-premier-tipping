import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone } from "@/lib/competition";
import type { TzLocale } from "@/lib/datetime";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Fixture } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = { id: string; display_name: string | null };

type RichPick = {
  id: string;
  user_id: string;
  fixture_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  auto_picked: boolean;
  picked_team: Team;
};

type RichFixture = Omit<Fixture, "home_team" | "away_team"> & {
  home_team: Team;
  away_team: Team;
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

function fmtDate(iso: string, tz: TzLocale) {
  return new Date(iso).toLocaleDateString(tz.locale, {
    timeZone: tz.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ── Pick chip ─────────────────────────────────────────────────────────────────

function PickChip({ pick, name, hasResult }: { pick: RichPick; name: string; hasResult: boolean }) {
  const state = !hasResult ? "pending" : pick.is_correct ? "correct" : "wrong";
  const chipCls =
    state === "correct"
      ? "bg-green-50 border-green-200 text-green-800"
      : state === "wrong"
      ? "bg-red-50 border-red-100 text-red-700 opacity-80"
      : "bg-white border-gray-200 text-gray-600";

  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-medium ${chipCls}`}
      title={`${name} picked ${pick.picked_team.name}${pick.auto_picked ? " (auto)" : ""}`}
    >
      <TeamBadge team={pick.picked_team} size="xs" />
      <span>{name}</span>
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
  tz,
}: {
  fixture: RichFixture;
  picks: RichPick[];
  teamMap: Map<string, Team>;
  profileMap: Map<string, string | null>;
  score: MatchScore | null;
  tz: TzLocale;
}) {
  const hasResult = fixture.result_team_id !== null || fixture.is_draw;
  const resultTeam = fixture.result_team_id ? teamMap.get(fixture.result_team_id) : null;

  const visiblePicks = hasResult ? picks : picks.filter((p) => !p.auto_picked);

  const correctPicks = visiblePicks.filter((p) => p.is_correct === true);
  const wrongPicks   = visiblePicks.filter((p) => p.is_correct === false);
  const pendingPicks = visiblePicks.filter((p) => p.is_correct === null);

  const sorted = [...visiblePicks].sort((a, b) => {
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
      {/* Match header */}
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
            {fmtDate(fixture.match_date, tz)}
            {fixture.venue && (
              <span className="before:content-['·'] before:mx-1.5 before:text-gray-300">
                {fixture.venue}
              </span>
            )}
          </p>
          {hasResult && resultTeam ? (
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

      {/* Picks breakdown */}
      {sorted.length > 0 && (
        <div className="border-t border-gray-100">
          {/* Summary bar */}
          {hasResult && visiblePicks.length > 0 && (
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="font-semibold text-green-700">{correctPicks.length}</span> correct
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold text-red-500">{wrongPicks.length}</span> wrong
              </span>
              {pendingPicks.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-gray-500">{pendingPicks.length}</span> pending
                </span>
              )}
            </div>
          )}
          <div className="px-5 py-3 bg-[#f8f9fb] flex flex-wrap gap-1.5">
            {sorted.map((pick) => (
              <PickChip
                key={pick.id}
                pick={pick}
                name={resolveDisplayName(pick.user_id, profileMap)}
                hasResult={hasResult}
              />
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="px-5 py-3 bg-[#f8f9fb] border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">No picks submitted.</p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RoundPage({
  params,
}: {
  params: { number: string };
}) {
  const roundNumber = parseInt(params.number, 10);
  if (isNaN(roundNumber)) notFound();

  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const tz = await getCompetitionTimezone(compId);

  // Fetch gameweek, teams, profiles, and match scores in parallel.
  // Filter by competition_id so "Round 1" from one competition doesn't
  // collide with "Round 1" from another.
  const [{ data: gameweek }, { data: teams }, { data: profiles }, { data: matchResultsRaw }, { data: participants }] =
    await Promise.all([
      supabase
        .from("gameweeks")
        .select("*")
        .eq("competition_id", compId)
        .eq("number", roundNumber)
        .single(),
      supabase.from("teams").select("*"),
      supabase.from("profiles").select("id, display_name"),
      supabase
        .from("match_results")
        .select("home_team, away_team, home_score, away_score")
        .eq("result_status", "final"),
      supabase.from("competition_participants").select("user_id").eq("competition_id", compId),
    ]);
  const participantIds = new Set((participants ?? []).map((p) => p.user_id));

  const matchResults = (matchResultsRaw ?? []) as RawMatchResult[];

  if (!gameweek) notFound();

  // Fetch fixtures with teams
  const { data: fixturesRaw } = await supabase
    .from("fixtures")
    .select(
      `*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`
    )
    .eq("gameweek_id", gameweek.id)
    .order("match_date");

  const fixtures = (fixturesRaw ?? []) as RichFixture[];

  // Fetch all picks for this round's fixtures
  const fixtureIds = fixtures.map((f) => f.id);
  let picksByFixture = new Map<string, RichPick[]>();

  if (fixtureIds.length > 0) {
    const { data: picksRaw } = await supabase
      .from("picks")
      .select(
        "id, user_id, fixture_id, picked_team_id, is_correct, auto_picked, picked_team:teams!picks_picked_team_id_fkey(*)"
      )
      .in("fixture_id", fixtureIds);

    for (const pick of (picksRaw ?? []) as unknown as RichPick[]) {
      if (!participantIds.has(pick.user_id)) continue;
      const list = picksByFixture.get(pick.fixture_id) ?? [];
      list.push(pick);
      picksByFixture.set(pick.fixture_id, list);
    }
  }

  const teamMap = new Map<string, Team>((teams ?? []).map((t) => [t.id, t]));
  const profileMap = new Map<string, string | null>(
    (profiles ?? []).map((p: Profile) => [p.id, p.display_name])
  );

  // Round summary stats
  const totalFixtures = fixtures.length;
  const resultsEntered = fixtures.filter((f) => f.result_team_id !== null || f.is_draw).length;
  const allPicks = Array.from(picksByFixture.values()).flat();
  const totalCorrect = allPicks.filter((p) => p.is_correct === true).length;

  return (
    <div className="space-y-8">

      {/* ── Back link ──────────────────────────────────────────────────── */}
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-1.5 text-sm text-brand/70 hover:text-brand transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Leaderboard
      </Link>

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Past Round</p>
          <h1 className="text-2xl font-bold tracking-tight text-brand">
            {gameweek.label}
          </h1>
        </div>

        {/* Stats pills */}
        {totalFixtures > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="card px-3 py-1.5 text-xs font-medium text-gray-600 shadow-none">
              {resultsEntered}/{totalFixtures} results
            </span>
            {resultsEntered > 0 && (
              <span className="card px-3 py-1.5 text-xs font-medium text-green-700 shadow-none">
                {totalCorrect} correct picks
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Fixtures ───────────────────────────────────────────────────── */}
      {fixtures.length === 0 ? (
        <div className="card px-6 py-12 text-center text-gray-500 text-sm">
          No fixtures recorded for this round.
        </div>
      ) : (
        <div className="space-y-3">
          {fixtures.map((fixture) => (
            <FixtureCard
              key={fixture.id}
              fixture={fixture}
              picks={picksByFixture.get(fixture.id) ?? []}
              teamMap={teamMap}
              profileMap={profileMap}
              score={findScore(fixture, matchResults)}
              tz={tz}
            />
          ))}
        </div>
      )}
    </div>
  );
}
