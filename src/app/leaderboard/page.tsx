import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone } from "@/lib/competition";
import type { TzLocale } from "@/lib/datetime";
import TeamBadge from "@/components/TeamBadge";
import Avatar from "@/components/Avatar";
import LeaderboardTable from "./LeaderboardTable";
import type { Team, Fixture, Gameweek } from "@/lib/supabase/types";

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

function pct(correct: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((correct / total) * 100)}%`;
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

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
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
        {sorted.length === 0 ? (
          <p style={{ fontSize: 12, color: "#8B8676", fontStyle: "italic", margin: 0 }}>No picks submitted yet.</p>
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

// ── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  rank,
  isFirst,
}: {
  entry: LeaderboardEntry;
  rank: number;
  isFirst: boolean;
}) {
  const AVATAR_COLORS = ["#1E7A3E", "#21409A", "#B23A48", "#2C9FD4", "#7A4B36", "#15324E", "#2B6E2B", "#6E3A2A", "#2C6E8F"];
  const colorIdx = entry.displayName.charCodeAt(0) % AVATAR_COLORS.length;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: isFirst ? "#0D1016" : "#fff",
        border: `1px solid ${isFirst ? "#0D1016" : "#E4E1D8"}`,
        borderRadius: 18,
        padding: "24px 22px",
        ...(isFirst ? { transform: "translateY(-14px)" } : {}),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 18,
          fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
          fontSize: 46,
          lineHeight: 1,
          color: isFirst ? "var(--accent)" : "rgba(17,21,28,.10)",
          opacity: 0.9,
        }}
      >
        {rank}
      </div>

      {entry.avatarUrl ? (
        <div className="mb-4">
          <Avatar url={entry.avatarUrl} name={entry.displayName} size={54} />
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-full mb-4"
          style={{
            width: 54,
            height: 54,
            background: AVATAR_COLORS[colorIdx],
            fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
            fontSize: 18,
            color: "#fff",
          }}
        >
          {initials(entry.displayName)}
        </div>
      )}

      <div
        className="font-display uppercase"
        style={{
          fontSize: 21,
          lineHeight: 1,
          color: isFirst ? "#fff" : "#11151C",
        }}
      >
        {entry.displayName}
      </div>

      <div style={{ fontSize: 13, color: isFirst ? "#9AA1AD" : "#8B8676", marginTop: 6, fontWeight: 600 }}>
        {pct(entry.manualCorrect, entry.manualTotal)} accuracy
      </div>

      <div className="flex items-baseline gap-2" style={{ marginTop: 18 }}>
        <span
          className="font-display"
          style={{
            fontSize: 38,
            lineHeight: 1,
            color: isFirst ? "var(--accent)" : "#11151C",
          }}
        >
          {entry.totalScore}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: isFirst ? "#9AA1AD" : "#8B8676",
          }}
        >
          pts
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const tz = await getCompetitionTimezone(compId);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const [
    { data: compGwRows },
    { data: profiles },
    { data: teams },
    { data: seasonConfig },
    { data: matchResultsRaw },
    { data: participants },
    { data: compFeatures },
  ] = await Promise.all([
    supabase.from("gameweeks").select("id").eq("competition_id", compId),
    supabase.from("profiles").select("id, display_name, avatar_url, supported_team_id"),
    supabase.from("teams").select("*"),
    supabase.from("season_config").select("season_complete, season_name").eq("competition_id", compId).single(),
    supabase.from("match_results").select("home_team, away_team, home_score, away_score").eq("result_status", "final"),
    supabase.from("competition_participants").select("user_id").eq("competition_id", compId),
    supabase.from("competitions").select("features").eq("id", compId).single() as unknown as Promise<{ data: { features: Record<string, boolean> | null } | null }>,
  ]);
  const marginPicking = compFeatures?.features?.margin_picking === true;
  const showSupportedTeam = compFeatures?.features?.show_supported_team === true;
  const participantIds = new Set((participants ?? []).map((p) => p.user_id));

  const compGwIds = (compGwRows ?? []).map((g) => g.id);

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

  const { data: allPicksRaw } = compFixtureIds.length > 0
    ? await supabase.from("picks").select("user_id, is_correct, margin_correct, margin_bonus, auto_picked, points").in("fixture_id", compFixtureIds)
    : { data: [] as { user_id: string; is_correct: boolean | null; margin_correct: boolean | null; margin_bonus: number; auto_picked: boolean; points: number }[] };

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
  const supportedTeamMap = new Map<string, string | null>(
    (profiles ?? []).map((p: Profile) => [p.id, p.supported_team_id])
  );

  const gwIdsWithResults = new Set((fixturesWithResults ?? []).map((f) => f.gameweek_id));
  const pastRounds = (closedGameweeks ?? []).filter((gw) => gwIdsWithResults.has(gw.id));

  const latestCompletedRound = pastRounds.length > 0
    ? Math.max(...pastRounds.map((gw) => gw.number))
    : null;

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
        if (!participantIds.has(pick.user_id)) continue;
        const list = weekPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        weekPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

  const lbMap = new Map<string, { correct: number; total: number; manualCorrect: number; manualTotal: number; marginsCorrect: number; marginBonus: number; totalPoints: number }>(
    Array.from(participantIds).map((id) => [id, { correct: 0, total: 0, manualCorrect: 0, manualTotal: 0, marginsCorrect: 0, marginBonus: 0, totalPoints: 0 }])
  );
  for (const pick of allPicksRaw ?? []) {
    if (!participantIds.has(pick.user_id)) continue;
    const e = lbMap.get(pick.user_id) ?? { correct: 0, total: 0, manualCorrect: 0, manualTotal: 0, marginsCorrect: 0, marginBonus: 0, totalPoints: 0 };
    e.total += 1;
    if (pick.is_correct) e.correct += 1;
    if (pick.margin_correct) e.marginsCorrect += 1;
    e.marginBonus += pick.margin_bonus ?? 0;
    e.totalPoints += pick.points ?? 0;
    if (!pick.auto_picked) {
      e.manualTotal += 1;
      if (pick.is_correct) e.manualCorrect += 1;
    }
    lbMap.set(pick.user_id, e);
  }

  const leaderboard: LeaderboardEntry[] = Array.from(lbMap.entries())
    .map(([user_id, stats]) => ({
      user_id,
      displayName: resolveDisplayName(user_id, profileMap),
      avatarUrl: avatarMap.get(user_id) ?? null,
      supportedTeamId: supportedTeamMap.get(user_id) ?? null,
      ...stats,
      totalScore: stats.totalPoints,
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

  // Rank calculation (1, 1, 3 style)
  const ranks: number[] = [];
  let rank = 0;
  let prevScore = -1;
  for (const entry of leaderboard) {
    if (entry.totalScore !== prevScore) { rank++; prevScore = entry.totalScore; }
    ranks.push(rank);
  }

  // Podium: 2nd | 1st | 3rd
  const podiumEntries = leaderboard.length >= 3
    ? [leaderboard[1], leaderboard[0], leaderboard[2]]
    : [];

  // Season summary data
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
        if (!participantIds.has(pick.user_id)) continue;
        const list = summaryPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        summaryPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

  const AVATAR_COLORS = ["#1E7A3E", "#21409A", "#B23A48", "#2C9FD4", "#7A4B36", "#15324E", "#2B6E2B", "#6E3A2A", "#2C6E8F"];

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
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            Leaderboard<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p style={{ fontSize: 16, color: "#AEB4BE", margin: "14px 0 0", maxWidth: 480 }}>
            Every correct tip is worth a point.{" "}
            {leaderboard.length > 0 && `${leaderboard.length} tipper${leaderboard.length !== 1 ? "s" : ""} in the comp this season.`}
          </p>
        </div>
      </section>

      {/* ── Podium ───────────────────────────────────────────────────── */}
      {podiumEntries.length === 3 && !noRoundsPlayed && (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "34px 32px 16px" }}>
          <div className="grid grid-cols-3 items-end" style={{ gap: 16 }}>
            {podiumEntries.map((entry, idx) => {
              const isFirst = idx === 1;
              const podiumRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
              return (
                <PodiumCard
                  key={entry.user_id}
                  entry={entry}
                  rank={podiumRank}
                  isFirst={isFirst}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Full table ───────────────────────────────────────────────── */}
      <section className="mx-auto" style={{ maxWidth: 1100, padding: "18px 32px 70px" }}>
        {noRoundsPlayed && (
          <div className="flex items-center gap-3" style={{ borderRadius: 14, background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "14px 20px", marginBottom: 18 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🏉</span>
            <p style={{ fontSize: 14, color: "#1E40AF", fontWeight: 600, margin: 0 }}>No rounds played yet — scores will appear here once the first round is complete.</p>
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className="text-center" style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "48px 24px" }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>📋</span>
            <p style={{ fontWeight: 600, color: "#5A6371", margin: 0 }}>No participants yet</p>
            <p style={{ fontSize: 14, color: "#8B8676", marginTop: 4 }}>Registered users will appear here once they sign up.</p>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, overflow: "hidden", fontFeatureSettings: "'tnum'" }}>
            <div
              className={`grid gap-x-1 sm:gap-x-2 ${marginPicking
                ? "grid-cols-[28px_1fr_32px_32px_38px_34px_36px] sm:grid-cols-[54px_1fr_64px_64px_68px_56px_68px]"
                : "grid-cols-[28px_1fr_28px_38px_34px_36px] sm:grid-cols-[54px_1fr_76px_68px_56px_68px]"
              }`}
              style={{
                padding: "15px 22px",
                background: "#0D1016",
                color: "#9AA1AD",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <span>#</span>
              <span>Tipper</span>
              {marginPicking ? (
                <>
                  <span style={{ textAlign: "center" }}>
                    <span className="sm:hidden">Cor</span>
                    <span className="hidden sm:inline">Correct</span>
                  </span>
                  <span style={{ textAlign: "center" }}>
                    <span className="sm:hidden">Bon</span>
                    <span className="hidden sm:inline">Bonus</span>
                  </span>
                </>
              ) : (
                <span style={{ textAlign: "center" }}>
                  <span className="sm:hidden">Rd</span>
                  <span className="hidden sm:inline">This rd</span>
                </span>
              )}
              <span style={{ textAlign: "center" }}>
                <span className="sm:hidden">Acc%</span>
                <span className="hidden sm:inline">Accuracy</span>
              </span>
              <span style={{ textAlign: "center" }}>Tips</span>
              <span style={{ textAlign: "right" }}>
                <span className="sm:hidden">Pts</span>
                <span className="hidden sm:inline">Total</span>
              </span>
            </div>

            <LeaderboardTable totalCount={leaderboard.length}>
              {leaderboard.map((entry, idx) => {
                const isYou = currentUserId === entry.user_id;
                const displayRank = ranks[idx];
                const thisRound = thisRoundScores.get(entry.user_id);
                const thisRoundCorrect = thisRound?.correct ?? null;
                const colorIdx = entry.displayName.charCodeAt(0) % AVATAR_COLORS.length;

                return (
                  <div
                    key={entry.user_id}
                    className={`grid gap-x-1 sm:gap-x-2 ${marginPicking
                      ? "grid-cols-[28px_1fr_32px_32px_38px_34px_36px] sm:grid-cols-[54px_1fr_64px_64px_68px_56px_68px]"
                      : "grid-cols-[28px_1fr_28px_38px_34px_36px] sm:grid-cols-[54px_1fr_76px_68px_56px_68px]"
                    }`}
                    style={{
                      alignItems: "center",
                      padding: "15px 22px",
                      borderTop: "1px solid #EFEDE6",
                      background: isYou ? "var(--accent-wash, rgba(217,165,33,.10))" : "#fff",
                      borderLeft: isYou ? "3px solid var(--accent)" : "3px solid transparent",
                    }}
                  >
                    <span
                      className="font-display"
                      style={{
                        fontSize: 16,
                        color: displayRank <= 3 ? "var(--accent)" : "#11151C",
                      }}
                    >
                      {displayRank}
                    </span>

                    <span className="flex items-center" style={{ gap: 12 }}>
                      {entry.avatarUrl ? (
                        <Avatar url={entry.avatarUrl} name={entry.displayName} size={34} />
                      ) : (
                        <span
                          className="flex items-center justify-center rounded-full shrink-0"
                          style={{
                            width: 34,
                            height: 34,
                            background: isYou ? "var(--accent)" : AVATAR_COLORS[colorIdx],
                            fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                            fontSize: 12,
                            color: "#fff",
                          }}
                        >
                          {initials(entry.displayName)}
                        </span>
                      )}
                      <span className="flex flex-col">
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#11151C" }}>{entry.displayName}</span>
                      </span>
                      {showSupportedTeam && entry.supportedTeamId && teamMap.get(entry.supportedTeamId) && (
                        <TeamBadge team={teamMap.get(entry.supportedTeamId)!} size="xs" />
                      )}
                      {isYou && (
                        <span
                          style={{
                            marginLeft: 4,
                            padding: "3px 9px",
                            borderRadius: 999,
                            background: "var(--accent)",
                            color: "var(--accent-text, #11151C)",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                          }}
                        >
                          You
                        </span>
                      )}
                    </span>

                    {marginPicking ? (
                      <>
                        <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: entry.correct > 0 ? "#11151C" : "#C7C2B5" }}>
                          {entry.correct}
                        </span>
                        <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: entry.marginBonus > 0 ? "#1F9E5A" : "#C7C2B5" }}>
                          {entry.marginBonus}
                        </span>
                      </>
                    ) : (
                      <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: thisRoundCorrect !== null ? "#1F9E5A" : "#C7C2B5" }}>
                        {thisRoundCorrect !== null ? thisRoundCorrect : "—"}
                      </span>
                    )}

                    <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                      {pct(entry.manualCorrect, entry.manualTotal)}
                    </span>

                    <span style={{ textAlign: "center", fontSize: 14, color: entry.manualTotal > 0 ? "#5A6371" : "#C7C2B5" }}>
                      {entry.manualTotal > 0 ? entry.manualTotal : "—"}
                    </span>

                    <span
                      className="font-display"
                      style={{ textAlign: "right", fontSize: 18, color: "#11151C" }}
                    >
                      {entry.totalScore}
                    </span>
                  </div>
                );
              })}
            </LeaderboardTable>
          </div>
        )}
      </section>

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

      {/* ── Past Rounds ──────────────────────────────────────────────── */}
      {!seasonComplete && pastRounds.length > 0 && (
        <section style={{ background: "#F2F0EA" }}>
          <div className="mx-auto" style={{ maxWidth: 1100, padding: "0 32px 50px" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
              <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
                Past Rounds
              </h2>
              <span style={{ fontSize: 12, color: "#8B8676", fontWeight: 600 }}>
                {pastRounds.length} round{pastRounds.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, overflow: "hidden" }}>
              {pastRounds.map((gw, i) => (
                <Link
                  key={gw.id}
                  href={`/leaderboard/round/${gw.number}`}
                  className="flex items-center justify-between group"
                  style={{
                    padding: "14px 22px",
                    borderTop: i > 0 ? "1px solid #EFEDE6" : "none",
                    textDecoration: "none",
                  }}
                >
                  <div className="flex items-center gap-3">
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
                    <span style={{ fontWeight: 600, color: "#11151C", fontSize: 14 }}>{gw.label}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: "#8B8676" }}>
                    <span style={{ fontSize: 12 }}>View results</span>
                    <svg className="group-hover:translate-x-0.5 transition-transform" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </Link>
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
