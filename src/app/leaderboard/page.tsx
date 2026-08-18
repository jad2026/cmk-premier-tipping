import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone } from "@/lib/competition";
import type { TzLocale } from "@/lib/datetime";
import TeamBadge from "@/components/TeamBadge";
import LeaderboardContent from "./LeaderboardContent";
import type { LeaderboardRow, LeagueInfo } from "./LeaderboardContent";
import type { Team, Fixture, Gameweek } from "@/lib/supabase/types";
import { getCachedTeams, getCachedCompetitionFeatures, getCachedSeasonConfig } from "@/lib/cached-queries";

export const dynamic = "force-dynamic";

// ── Local types ───────────────────────────────────────────────────────────────

type Profile = { id: string; display_name: string | null; avatar_url: string | null; supported_team_id: string | null };

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
  supportedTeamId: string | null;
  correct: number;
  total: number;
  manualCorrect: number;
  manualTotal: number;
  manualResulted: number;
  marginsCorrect: number;
  marginBonus: number;
  totalScore: number;
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

function fmtDeadline(iso: string, tz: TzLocale) {
  return new Date(iso).toLocaleString(tz.locale, {
    timeZone: tz.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Aggregate pick bar ───────────────────────────────────────────────────────

function AggregatePickBar({
  fixture,
  picks,
}: {
  fixture: RichFixture;
  picks: RichPick[];
}) {
  const total = picks.length;
  if (total === 0) return null;

  const homeCount = picks.filter((p) => p.picked_team_id === fixture.home_team_id).length;
  const awayCount = picks.filter((p) => p.picked_team_id === fixture.away_team_id).length;
  const drawCount = total - homeCount - awayCount;

  const homePct = Math.round((homeCount / total) * 100);
  const awayPct = Math.round((awayCount / total) * 100);
  const drawPct = drawCount > 0 ? 100 - homePct - awayPct : 0;

  const homeColour = fixture.home_team.colour || "#2C9FD4";
  const awayColour = fixture.away_team.colour || "#1A1E27";

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <TeamBadge team={fixture.home_team} size="xs" />
          <span style={{ color: "#11151C" }}>{fixture.home_team.short_name || fixture.home_team.name}</span>
          <span style={{ color: "#5A6371" }}>{homeCount}</span>
          <span style={{ color: "#8B8676" }}>({homePct}%)</span>
        </span>
        {drawCount > 0 && (
          <span style={{ color: "#8B8676" }}>
            Draw {drawCount} ({drawPct}%)
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span style={{ color: "#8B8676" }}>({awayPct}%)</span>
          <span style={{ color: "#5A6371" }}>{awayCount}</span>
          <span style={{ color: "#11151C" }}>{fixture.away_team.short_name || fixture.away_team.name}</span>
          <TeamBadge team={fixture.away_team} size="xs" />
        </span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {homePct > 0 && (
          <div
            className="rounded-l-full transition-all"
            style={{ width: `${homePct}%`, backgroundColor: homeColour, minWidth: 8 }}
          />
        )}
        {drawPct > 0 && (
          <div
            className="transition-all"
            style={{ width: `${drawPct}%`, backgroundColor: "#9CA3AF", minWidth: 8 }}
          />
        )}
        {awayPct > 0 && (
          <div
            className="rounded-r-full transition-all"
            style={{ width: `${awayPct}%`, backgroundColor: awayColour, minWidth: 8 }}
          />
        )}
      </div>
    </div>
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

  return (
    <div className="overflow-hidden" style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18 }}>
      <div style={{ padding: "20px 22px 16px" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamBadge team={fixture.home_team} size="sm" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#11151C" }} className="leading-snug line-clamp-2">
              {fixture.home_team.name}
            </span>
          </div>
          {score ? (
            <span className="shrink-0" style={{ padding: "4px 12px", borderRadius: 999, background: "#E8F5ED", border: "1px solid #C3E6CF", color: "#1F9E5A", fontSize: 14, fontWeight: 700, fontFeatureSettings: "'tnum'" }}>
              {score.home} – {score.away}
            </span>
          ) : (
            <span className="shrink-0" style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(var(--accent-rgb,217,165,33),.08)", fontSize: 10, fontWeight: 800, letterSpacing: ".12em", color: "var(--accent)" }}>
              VS
            </span>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span style={{ fontSize: 14, fontWeight: 700, color: "#11151C" }} className="leading-snug text-right line-clamp-2">
              {fixture.away_team.name}
            </span>
            <TeamBadge team={fixture.away_team} size="sm" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p style={{ fontSize: 12, color: "#8B8676", margin: 0 }}>
            {fmtDate(fixture.match_date, tz)}
            {fixture.venue && (
              <span className="before:content-['·'] before:mx-1.5" style={{ color: "#8B8676" }}>
                {fixture.venue}
              </span>
            )}
          </p>
          {fixture.is_draw ? (
            <span className="inline-flex items-center gap-1.5" style={{ padding: "4px 12px", borderRadius: 999, background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 700 }}>
              🤝 Draw
            </span>
          ) : hasResult && resultTeam ? (
            <span className="inline-flex items-center gap-1.5" style={{ padding: "4px 12px", borderRadius: 999, background: "#E8F5ED", color: "#1F9E5A", fontSize: 12, fontWeight: 700 }}>
              <span
                className="w-2 h-2 rounded-full ring-1 ring-black/10 shrink-0"
                style={{ backgroundColor: resultTeam.colour }}
              />
              {resultTeam.name} won
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5" style={{ padding: "4px 12px", borderRadius: 999, background: "#F5F4EF", color: "#8B8676", fontSize: 12, fontWeight: 600 }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#C7C2B5" }} />
              Pending
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "12px 22px", background: "#F9F8F5", borderTop: "1px solid #EFEDE6" }}>
        {visiblePicks.length === 0 ? (
          <p style={{ fontSize: 12, color: "#8B8676", fontStyle: "italic", margin: 0 }}>No picks submitted yet.</p>
        ) : (
          <AggregatePickBar fixture={fixture} picks={visiblePicks} />
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const compId = await getCurrentCompetitionId();

  // ── Batch 1: all independent queries that only need compId ────────────
  async function fetchAllProfiles(): Promise<Profile[]> {
    const all: Profile[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await admin.from("profiles").select("id, display_name, avatar_url, supported_team_id").order("id").range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...(data as Profile[]));
      if (data.length < 1000) break;
    }
    return all;
  }

  const [
    { data: compGwRows },
    teams,
    seasonConfig,
    { data: matchResultsRaw },
    compFeatures,
    { data: { user } },
    tz,
    allProfiles,
  ] = await Promise.all([
    admin.from("gameweeks").select("id").eq("competition_id", compId),
    getCachedTeams(compId),
    getCachedSeasonConfig(compId),
    admin.from("match_results").select("home_team, away_team, home_score, away_score").eq("result_status", "final"),
    getCachedCompetitionFeatures(compId),
    supabase.auth.getUser(),
    getCompetitionTimezone(compId),
    fetchAllProfiles(),
  ]);

  const currentUserId = user?.id ?? null;
  const marginPicking = compFeatures?.margin_picking === true;
  const showSupportedTeam = compFeatures?.show_supported_team === true;

  // ── Batch 2: league chain + gameweek/fixture queries run concurrently ──
  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  async function fetchUserLeagues(): Promise<LeagueInfo[]> {
    if (!currentUserId) return [];
    const { data: memberships } = await admin
      .from("league_members")
      .select("league_id")
      .eq("user_id", currentUserId);
    if (!memberships?.length) return [];

    const leagueIds = memberships.map((m) => m.league_id);
    const { data: leagues } = await admin
      .from("leagues")
      .select("*")
      .in("id", leagueIds)
      .eq("competition_id", compId);
    if (!leagues?.length) return [];

    const filteredIds = leagues.map((l) => l.id);
    const { data: allMembers } = await admin
      .from("league_members")
      .select("league_id, user_id")
      .in("league_id", filteredIds);

    const memberMap = new Map<string, string[]>();
    const countMap = new Map<string, number>();
    for (const m of allMembers ?? []) {
      const list = memberMap.get(m.league_id) ?? [];
      list.push(m.user_id);
      memberMap.set(m.league_id, list);
      countMap.set(m.league_id, (countMap.get(m.league_id) ?? 0) + 1);
    }

    return leagues.map((l) => ({
      id: l.id,
      name: l.name,
      invite_code: l.invite_code,
      member_count: countMap.get(l.id) ?? 0,
      memberUserIds: memberMap.get(l.id) ?? [],
      created_by: l.created_by,
      is_sponsored: (l as Record<string, unknown>).is_sponsored === true,
    }));
  }

  const [
    [
      { data: openGameweek },
      { data: closedGameweeks },
      { data: fixturesWithResults },
      { data: allGwsForRounds },
    ],
    userLeagues,
    { data: lbScores },
    { data: roundScoresRaw },
  ] = await Promise.all([
    Promise.all([
      admin
        .from("gameweeks")
        .select("id, number, label, deadline, is_open")
        .eq("competition_id", compId)
        .eq("is_open", true)
        .maybeSingle() as unknown as Promise<{ data: Gameweek | null }>,
      admin
        .from("gameweeks")
        .select("id, number, label, deadline, is_open")
        .eq("competition_id", compId)
        .eq("is_open", false)
        .order("number"),
      compGwIds.length > 0
        ? admin
            .from("fixtures")
            .select("gameweek_id")
            .or("result_team_id.not.is.null,is_draw.eq.true")
            .in("gameweek_id", compGwIds)
        : Promise.resolve({ data: [] as { gameweek_id: string }[], error: null }),
      admin
        .from("gameweeks")
        .select("id, number, label, deadline, is_open")
        .eq("competition_id", compId)
        .order("number"),
    ]),
    fetchUserLeagues(),
    admin.rpc("get_leaderboard_scores", { comp_id: compId }),
    admin.rpc("get_round_scores", { comp_id: compId }),
  ]);

  const participantIds = new Set((lbScores ?? []).map((r) => r.user_id));

  const matchResults = (matchResultsRaw ?? []) as RawMatchResult[];

  const seasonComplete = seasonConfig?.season_complete ?? false;
  const seasonName = seasonConfig?.season_name ?? `${new Date().getFullYear()} Season`;

  const teamMap = new Map<string, Team>((teams ?? []).map((t) => [t.id, t]));
  const profileMap = new Map<string, string | null>(
    allProfiles.map((p) => [p.id, p.display_name])
  );
  const avatarMap = new Map<string, string | null>(
    allProfiles.map((p) => [p.id, p.avatar_url])
  );
  const supportedTeamMap = new Map<string, string | null>(
    allProfiles.map((p) => [p.id, p.supported_team_id])
  );

  const gwIdsWithResults = new Set((fixturesWithResults ?? []).map((f) => f.gameweek_id));
  const pastRounds = (closedGameweeks ?? []).filter((gw) => gwIdsWithResults.has(gw.id));

  const latestCompletedRound = pastRounds.length > 0
    ? Math.max(...pastRounds.map((gw) => gw.number))
    : null;

  let weekFixtures: RichFixture[] = [];
  let weekPicksByFixture = new Map<string, RichPick[]>();

  if (openGameweek) {
    const { data: fixturesRaw } = await admin
      .from("fixtures")
      .select(`*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`)
      .eq("gameweek_id", openGameweek.id)
      .order("match_date");

    weekFixtures = (fixturesRaw ?? []) as RichFixture[];

    if (weekFixtures.length > 0) {
      const weekFixtureIds = weekFixtures.map((f) => f.id);
      const allWeekPicks: RichPick[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await admin
          .from("picks")
          .select("id, user_id, fixture_id, picked_team_id, picked_draw, is_correct, auto_picked, picked_team:teams!picks_picked_team_id_fkey(*)")
          .in("fixture_id", weekFixtureIds)
          .order("id")
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        allWeekPicks.push(...(data as unknown as RichPick[]));
        if (data.length < 1000) break;
      }

      for (const pick of allWeekPicks) {
        if (!participantIds.has(pick.user_id)) continue;
        const list = weekPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        weekPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

  const leaderboard: LeaderboardEntry[] = (lbScores ?? [])
    .map((row) => ({
      user_id: row.user_id,
      displayName: resolveDisplayName(row.user_id, profileMap),
      avatarUrl: avatarMap.get(row.user_id) ?? null,
      supportedTeamId: supportedTeamMap.get(row.user_id) ?? null,
      correct: Number(row.correct),
      total: Number(row.total),
      manualCorrect: Number(row.manual_correct),
      manualTotal: Number(row.manual_total),
      manualResulted: Number(row.manual_resulted),
      marginsCorrect: Number(row.margins_correct),
      marginBonus: Number(row.margin_bonus),
      totalScore: Number(row.total_points),
    }))
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        b.correct - a.correct ||
        b.total - a.total ||
        a.displayName.localeCompare(b.displayName)
    );

  const noRoundsPlayed = leaderboard.length > 0 && leaderboard.every((e) => e.total === 0);

  // This-round scores per user
  const thisRoundScores = new Map<string, { correct: number; total: number }>();
  if (openGameweek) {
    for (const [, picks] of Array.from(weekPicksByFixture)) {
      for (const pick of picks) {
        const s = thisRoundScores.get(pick.user_id) ?? { correct: 0, total: 0 };
        s.total += 1;
        if (pick.is_correct) s.correct += 1;
        thisRoundScores.set(pick.user_id, s);
      }
    }
  }

  // ── Per-round scores (from database aggregation) ───────────────────────
  const roundScoreMap = new Map<string, Map<string, { score: number; correct: number; total: number; marginBonus: number }>>();
  for (const row of roundScoresRaw ?? []) {
    if (!roundScoreMap.has(row.gameweek_id)) roundScoreMap.set(row.gameweek_id, new Map());
    roundScoreMap.get(row.gameweek_id)!.set(row.user_id, {
      score: Number(row.score),
      correct: Number(row.correct),
      total: Number(row.total),
      marginBonus: Number(row.margin_bonus),
    });
  }

  const allGameweeksForRounds = (allGwsForRounds ?? []) as Pick<Gameweek, "id" | "number" | "label" | "deadline" | "is_open">[];

  type RoundScoreEntry = {
    user_id: string;
    score: number;
    correct: number;
    total: number;
    marginBonus: number;
  };

  type RoundData = {
    gameweekId: string;
    gameweekNumber: number;
    gameweekLabel: string;
    hasResults: boolean;
    scores: RoundScoreEntry[];
  };

  const roundsData: RoundData[] = allGameweeksForRounds.map((gw) => {
    const gwScores = roundScoreMap.get(gw.id);
    const hasResults = gwIdsWithResults.has(gw.id);
    const scores: RoundScoreEntry[] = [];

    if (gwScores) {
      gwScores.forEach((s, userId) => {
        scores.push({ user_id: userId, ...s });
      });
      scores.sort((a, b) => b.score - a.score || b.correct - a.correct);
    }

    return {
      gameweekId: gw.id,
      gameweekNumber: gw.number,
      gameweekLabel: gw.label,
      hasResults,
      scores,
    };
  });

  // Serialize leaderboard for client component
  const serializedLeaderboard: LeaderboardRow[] = leaderboard.map((entry) => {
    const team = entry.supportedTeamId ? teamMap.get(entry.supportedTeamId) : null;
    return {
      ...entry,
      supportedTeam: team
        ? { name: team.name, short_name: team.short_name, colour: team.colour, logo_url: team.logo_url }
        : null,
      thisRoundCorrect: thisRoundScores.get(entry.user_id)?.correct ?? null,
    };
  });

  // Season summary data
  let summaryGameweeks: Pick<Gameweek, "id" | "number" | "label" | "deadline" | "is_open">[] = [];
  const summaryFixturesByGw = new Map<string, RichFixture[]>();
  const summaryPicksByFixture = new Map<string, RichPick[]>();

  if (seasonComplete) {
    const [{ data: allGws }, { data: allFixturesRich }] = await Promise.all([
      admin
        .from("gameweeks")
        .select("id, number, label, deadline, is_open")
        .eq("competition_id", compId)
        .order("number"),
      admin
        .from("fixtures")
        .select(`*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`)
        .in("gameweek_id", compGwIds)
        .order("match_date"),
    ]);

    summaryGameweeks = allGws ?? [];

    const richFixtures = (allFixturesRich ?? []) as RichFixture[];
    for (const f of richFixtures) {
      const list = summaryFixturesByGw.get(f.gameweek_id) ?? [];
      list.push(f);
      summaryFixturesByGw.set(f.gameweek_id, list);
    }

    const allFixtureIds = richFixtures.map((f) => f.id);
    if (allFixtureIds.length > 0) {
      const allSummaryPicks: RichPick[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await admin
          .from("picks")
          .select("id, user_id, fixture_id, picked_team_id, picked_draw, is_correct, auto_picked, picked_team:teams!picks_picked_team_id_fkey(*)")
          .in("fixture_id", allFixtureIds)
          .order("id")
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        allSummaryPicks.push(...(data as unknown as RichPick[]));
        if (data.length < 1000) break;
      }

      for (const pick of allSummaryPicks) {
        if (!participantIds.has(pick.user_id)) continue;
        const list = summaryPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        summaryPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >

      {/* ── Dark header ──────────────────────────────────────────────── */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              {seasonComplete ? "Final standings" : latestCompletedRound ? `Season standings · After Round ${latestCompletedRound}` : "Season standings"}
              {seasonComplete && (
                <span style={{ marginLeft: 10, padding: "3px 10px", borderRadius: 999, background: "rgba(var(--accent-rgb,217,165,33),.15)", color: "var(--accent)", fontSize: 10, fontWeight: 800 }}>
                  🏆 COMPLETE
                </span>
              )}
            </span>
          </div>
          <h1
            className="font-display uppercase text-[36px] sm:text-[48px] md:text-[60px]"
            style={{ lineHeight: 0.86, margin: 0 }}
          >
            Leaderboard<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p style={{ fontSize: 16, color: "#AEB4BE", margin: "14px 0 0", maxWidth: 480 }}>
            Every correct tip is worth a point.{" "}
            {participantIds.size > 0 && `${participantIds.size} tipper${participantIds.size !== 1 ? "s" : ""} in the comp this season.`}
          </p>
        </div>
      </section>

      {/* ── Podium + Table + Leagues (client) ─────────────────────── */}
      <LeaderboardContent
        leaderboard={serializedLeaderboard}
        leagues={userLeagues}
        currentUserId={currentUserId}
        marginPicking={marginPicking}
        showSupportedTeam={showSupportedTeam}
        noRoundsPlayed={noRoundsPlayed}
        roundsData={roundsData}
      />

      {/* ── This Week ────────────────────────────────────────────────── */}
      {openGameweek && weekFixtures.length > 0 && (
        <section style={{ background: "#F2F0EA" }}>
          <div className="mx-auto" style={{ maxWidth: 1100, padding: "40px 32px 50px" }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
              <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
                This Week — {openGameweek.label}
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "#8B8676", marginLeft: 36, marginBottom: 20 }}>
              Deadline {fmtDeadline(openGameweek.deadline, tz)} · {weekFixtures.length} fixture{weekFixtures.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-3">
              {weekFixtures.map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  picks={weekPicksByFixture.get(fixture.id) ?? []}
                  teamMap={teamMap}
                  profileMap={profileMap}
                  score={findScore(fixture, matchResults)}
                  tz={tz}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Season Summary ───────────────────────────────────────────── */}
      {seasonComplete && summaryGameweeks.length > 0 && (
        <section style={{ background: "#F2F0EA" }}>
          <div className="mx-auto" style={{ maxWidth: 1100, padding: "40px 32px 60px" }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
              <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
                Season Summary
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "#8B8676", marginLeft: 36, marginBottom: 24 }}>
              Complete results for every round · {summaryGameweeks.length} round{summaryGameweeks.length !== 1 ? "s" : ""}
            </p>

            <div className="space-y-8">
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
                  <div key={gw.id}>
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex items-center justify-center shrink-0"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "rgba(var(--accent-rgb,217,165,33),.12)",
                            color: "var(--accent)",
                            fontSize: 12,
                            fontWeight: 800,
                            fontFeatureSettings: "'tnum'",
                          }}
                        >
                          {gw.number}
                        </span>
                        <span style={{ fontWeight: 700, color: "#11151C", fontSize: 14 }}>{gw.label}</span>
                      </div>
                      {roundTotal > 0 && (
                        <span style={{ fontSize: 12, color: "#8B8676" }}>
                          <span style={{ fontWeight: 700, color: "#1F9E5A" }}>{roundCorrect}</span>
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
                          tz={tz}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
