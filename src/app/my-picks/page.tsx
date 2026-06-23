import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import TeamBadge from "@/components/TeamBadge";
import type { Team } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type RoundRow = {
  id: string;
  number: number;
  label: string;
  deadline: string;
  is_open: boolean;
};

type FixtureRow = {
  id: string;
  gameweek_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  result_team_id: string | null;
  is_draw: boolean;
  home_team: Team;
  away_team: Team;
  result_team: Team | null;
};

type PickRow = {
  fixture_id: string;
  picked_team_id: string | null;
  picked_draw: boolean;
  is_correct: boolean | null;
  auto_picked: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(correct: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((correct / total) * 100)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function MyPicksPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get competition's gameweek IDs to scope fixtures and picks
  const { data: compGwRows } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("competition_id", compId);
  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  // Fetch everything in parallel, scoped to this competition
  const [
    { data: gameweeks },
    { data: fixturesRaw },
    { data: profilesForRank },
  ] = await Promise.all([
    supabase
      .from("gameweeks")
      .select("id, number, label, deadline, is_open")
      .eq("competition_id", compId)
      .order("number"),
    compGwIds.length > 0
      ? supabase
          .from("fixtures")
          .select("id, gameweek_id, home_team_id, away_team_id, match_date, result_team_id, is_draw, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*), result_team:teams!fixtures_result_team_id_fkey(*)")
          .in("gameweek_id", compGwIds)
          .order("match_date")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const compFixtureIds = (fixturesRaw ?? []).map((f: { id: string }) => f.id);

  // Picks scoped to this competition's fixtures
  const [
    { data: picksRaw, error: picksError },
    { data: allPicksForRank },
  ] = await Promise.all([
    compFixtureIds.length > 0
      ? supabase.from("picks").select("*").eq("user_id", user.id).in("fixture_id", compFixtureIds)
      : Promise.resolve({ data: [], error: null }),
    compFixtureIds.length > 0
      ? supabase.from("picks").select("user_id, is_correct").eq("is_correct", true).in("fixture_id", compFixtureIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (picksError) {
    console.error("[my-picks] picks query error:", picksError);
  }

  const fixtures = (fixturesRaw ?? []) as unknown as FixtureRow[];
  const picks = (picksRaw ?? []) as PickRow[];
  const pickMap = new Map(picks.map((p) => [p.fixture_id, p]));

  // ── Season-level stats ────────────────────────────────────────────────────

  const scoredPicks = picks.filter((p) => p.is_correct !== null);
  const totalCorrect = picks.filter((p) => p.is_correct === true).length;
  const totalTipped = scoredPicks.length;

  // Rank: count users with more correct picks than me
  const tallyByUser = new Map<string, number>();
  for (const p of allPicksForRank ?? []) {
    tallyByUser.set(p.user_id, (tallyByUser.get(p.user_id) ?? 0) + 1);
  }
  const myCorrect = tallyByUser.get(user.id) ?? 0;
  const totalPlayers = (profilesForRank ?? []).length;
  const rank = Array.from(tallyByUser.values()).filter((v) => v > myCorrect).length + 1;

  // ── Build round-by-round data ─────────────────────────────────────────────

  type RoundData = RoundRow & {
    fixtures: FixtureRow[];
    roundCorrect: number;
    roundPicked: number;
  };

  const fixturesByGw = new Map<string, FixtureRow[]>();
  for (const f of fixtures) {
    if (!fixturesByGw.has(f.gameweek_id)) fixturesByGw.set(f.gameweek_id, []);
    fixturesByGw.get(f.gameweek_id)!.push(f);
  }

  const rounds: RoundData[] = (gameweeks ?? [])
    .filter((gw) => fixturesByGw.has(gw.id))
    .map((gw) => {
      const gwFixtures = fixturesByGw.get(gw.id) ?? [];
      const myPicks = gwFixtures.map((f) => pickMap.get(f.id)).filter(Boolean) as PickRow[];
      return {
        ...gw,
        fixtures: gwFixtures,
        roundCorrect: myPicks.filter((p) => p.is_correct === true).length,
        roundPicked: myPicks.filter((p) => p.is_correct !== null).length,
      };
    });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div>
        <p className="eyebrow mb-1">Season History</p>
        <h1 className="text-3xl font-bold text-brand">My Picks</h1>
      </div>

      {/* ── Summary card ─────────────────────────────────────────────── */}
      <div className="card-md px-6 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Correct" value={String(totalCorrect)} />
          <Stat label="Tipped" value={totalTipped > 0 ? String(totalTipped) : "—"} />
          <Stat label="Accuracy" value={pct(totalCorrect, totalTipped)} highlight />
          <Stat
            label="Current Rank"
            value={totalPlayers > 0 ? `#${rank}` : "—"}
            sub={totalPlayers > 0 ? `of ${totalPlayers}` : undefined}
          />
        </div>
      </div>

      {/* ── Rounds ───────────────────────────────────────────────────── */}
      {rounds.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-gray-500">No rounds scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {rounds.map((round) => {
            const hasScoredPicks = round.roundPicked > 0;
            return (
              <section key={round.id} className="card-md overflow-hidden">
                {/* Round header */}
                <div className="bg-gradient-to-r from-brand to-brand-light px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                      {round.label}
                    </h2>
                    <span className="text-white/40 text-xs hidden sm:inline">·</span>
                    <span className="text-white/60 text-xs hidden sm:inline">
                      {fmtDate(round.deadline)}
                    </span>
                  </div>
                  {hasScoredPicks && (
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-white/15 text-white text-xs font-bold">
                      {round.roundCorrect}/{round.roundPicked}
                    </span>
                  )}
                  {round.is_open && (
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-brand-gold/30 text-brand-gold text-[10px] font-bold uppercase tracking-wide">
                      Open
                    </span>
                  )}
                </div>

                {/* Fixtures */}
                <div className="divide-y divide-gray-100">
                  {round.fixtures.map((fixture) => {
                    const pick = pickMap.get(fixture.id);
                    const hasResult = fixture.result_team_id !== null || fixture.is_draw;
                    const pickedDraw = pick?.picked_draw ?? false;
                    const pickedTeamId = pick?.picked_team_id ?? null;
                    const pickedTeam = pickedTeamId
                      ? (fixture.home_team.id === pickedTeamId ? fixture.home_team : fixture.away_team)
                      : null;

                    // Derive correctness from the fixture result directly so it
                    // shows even when is_correct hasn't been written yet by the
                    // scoring function (e.g. result entered while round is still open).
                    let isCorrect: boolean | null = null;
                    if (pick && hasResult) {
                      if (fixture.is_draw) {
                        isCorrect = pickedDraw;
                      } else {
                        isCorrect = pickedTeamId === fixture.result_team_id;
                      }
                    } else if (pick?.is_correct !== null && pick?.is_correct !== undefined) {
                      isCorrect = pick.is_correct;
                    }
                    const autoPicked = pick?.auto_picked ?? false;

                    const resultLabel = fixture.is_draw
                      ? "Draw"
                      : fixture.result_team?.name ?? null;

                    return (
                      <div key={fixture.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Teams */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <TeamBadge team={fixture.home_team} size="xs" />
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {fixture.home_team.name}
                          </span>
                          <span className="text-gray-300 text-xs font-bold shrink-0">vs</span>
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {fixture.away_team.name}
                          </span>
                          <TeamBadge team={fixture.away_team} size="xs" />
                        </div>

                        {/* Pick + result row */}
                        <div className="flex items-center gap-3 shrink-0 flex-wrap">
                          {/* User's pick */}
                          {pick ? (
                            <div className="flex items-center gap-1.5">
                              {autoPicked && (
                                <span title="Auto-picked" className="text-sm leading-none">🎲</span>
                              )}
                              {pickedDraw ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">
                                  🤝 Draw
                                </span>
                              ) : pickedTeam ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-semibold">
                                  <TeamBadge team={pickedTeam} size="xs" />
                                  {pickedTeam.short_name || pickedTeam.name}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No pick</span>
                          )}

                          {/* Result */}
                          {hasResult && (
                            <span className="text-[11px] text-gray-400 hidden sm:inline">
                              Result: <span className="font-medium text-gray-600">{resultLabel}</span>
                            </span>
                          )}

                          {/* Correct / wrong badge */}
                          {isCorrect === true && (
                            <span className="text-base leading-none" title="Correct">✅</span>
                          )}
                          {isCorrect === false && (
                            <span className="text-base leading-none" title="Wrong">❌</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Round footer — score bar if scored */}
                {hasScoredPicks && (
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-gold transition-all"
                        style={{ width: `${Math.round((round.roundCorrect / round.roundPicked) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 shrink-0">
                      {round.roundCorrect}/{round.roundPicked} correct
                      {" "}·{" "}
                      {pct(round.roundCorrect, round.roundPicked)}
                    </span>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-0.5">
      <span className={`text-3xl font-bold ${highlight ? "text-brand-gold" : "text-brand"}`}>
        {value}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
