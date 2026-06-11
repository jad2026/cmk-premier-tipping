import { createClient } from "@/lib/supabase/server";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Fixture, Gameweek } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ── Local types ───────────────────────────────────────────────────────────────

type Profile = { id: string; display_name: string | null };

/** A pick row with its picked team already joined */
type RichPick = {
  id: string;
  user_id: string;
  fixture_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  auto_picked: boolean;
  picked_team: Team;
};

/** A fixture with both team relations resolved */
type RichFixture = Omit<Fixture, "home_team" | "away_team"> & {
  home_team: Team;
  away_team: Team;
};

type LeaderboardEntry = {
  user_id: string;
  displayName: string;
  correct: number;
  total: number;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

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
  const state = !hasResult
    ? "pending"
    : pick.is_correct
    ? "correct"
    : "wrong";

  const chipCls =
    state === "correct"
      ? "bg-green-50 border-green-200 text-green-800"
      : state === "wrong"
      ? "bg-red-50 border-red-100 text-red-700 opacity-80"
      : "bg-white border-gray-200 text-gray-700";

  const title = `${name} picked ${pick.picked_team.name}${pick.auto_picked ? " (auto-assigned)" : ""}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-medium ${chipCls}`}
      title={title}
    >
      <TeamBadge team={pick.picked_team} size="xs" />
      <span>{name}</span>

      {/* Correctness indicator */}
      {hasResult && (
        <span
          aria-label={state === "correct" ? "correct" : "incorrect"}
          className={
            state === "correct" ? "text-green-500 font-bold" : "text-red-400"
          }
        >
          {state === "correct" ? "✓" : "✗"}
        </span>
      )}

      {/* Auto-pick badge */}
      {pick.auto_picked && (
        <span
          aria-label="auto-assigned pick"
          className="inline-block text-[9px] font-semibold uppercase tracking-wide leading-none px-1 py-0.5 rounded bg-gray-200/80 text-gray-500 border border-gray-300/60"
        >
          auto
        </span>
      )}
    </span>
  );
}

// ── Fixture result card ───────────────────────────────────────────────────────

function FixtureCard({
  fixture,
  picks,
  teamMap,
  profileMap,
}: {
  fixture: RichFixture;
  picks: RichPick[];
  teamMap: Map<string, Team>;
  profileMap: Map<string, string | null>;
}) {
  const hasResult = fixture.result_team_id !== null;
  const resultTeam = hasResult
    ? teamMap.get(fixture.result_team_id!)
    : null;

  // Sort: correct → wrong → pending; manual before auto within each group; then alpha
  const sorted = [...picks].sort((a, b) => {
    const stateOrder = (p: RichPick) =>
      !hasResult ? 1 : p.is_correct ? 0 : 2;
    const stateDiff = stateOrder(a) - stateOrder(b);
    if (stateDiff !== 0) return stateDiff;
    // Manual picks before auto-picks in each group
    const autoDiff = (a.auto_picked ? 1 : 0) - (b.auto_picked ? 1 : 0);
    if (autoDiff !== 0) return autoDiff;
    return resolveDisplayName(a.user_id, profileMap).localeCompare(
      resolveDisplayName(b.user_id, profileMap)
    );
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ── Match header ────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        {/* Teams row */}
        <div className="flex items-center gap-2 mb-3">
          {/* Home */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamBadge team={fixture.home_team} size="sm" />
            <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
              {fixture.home_team.name}
            </span>
          </div>

          {/* vs pill */}
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[11px] font-semibold">
            vs
          </span>

          {/* Away — mirrored: name then badge */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-gray-800 leading-tight text-right line-clamp-2">
              {fixture.away_team.name}
            </span>
            <TeamBadge team={fixture.away_team} size="sm" />
          </div>
        </div>

        {/* Meta row: date/venue + result badge */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-400">
            {fmtDate(fixture.match_date)}
            {fixture.venue && (
              <span className="before:content-['·'] before:mx-1.5">
                {fixture.venue}
              </span>
            )}
          </p>

          {hasResult && resultTeam ? (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10 shrink-0"
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

      {/* ── Picks strip ─────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
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

function LeaderboardTable({ rows }: { rows: LeaderboardEntry[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-10 text-center text-gray-500">
        No picks recorded yet — check back after the first round!
      </div>
    );
  }

  // Find the top score so ties at the top both get 🏆
  const topCorrect = rows[0].correct;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-brand text-white">
          <tr>
            <th className="px-4 py-3 text-left w-12 font-semibold">#</th>
            <th className="px-4 py-3 text-left font-semibold">Tipper</th>
            <th className="px-4 py-3 text-right font-semibold">Correct</th>
            <th className="px-4 py-3 text-right font-semibold">Tipped</th>
            <th className="px-4 py-3 text-right font-semibold w-16">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((entry, idx) => {
            const isLeader = entry.correct === topCorrect && entry.correct > 0;
            return (
              <tr
                key={entry.user_id}
                className={
                  isLeader
                    ? "bg-yellow-50 font-semibold"
                    : "hover:bg-gray-50/70 transition-colors"
                }
              >
                {/* Position */}
                <td className="px-4 py-3.5">
                  {isLeader ? (
                    <span className="text-lg leading-none">🏆</span>
                  ) : (
                    <span className="text-gray-400 tabular-nums">{idx + 1}</span>
                  )}
                </td>

                {/* Name */}
                <td className="px-4 py-3.5 text-gray-800">{entry.displayName}</td>

                {/* Correct */}
                <td className="px-4 py-3.5 text-right text-green-700 tabular-nums font-semibold">
                  {entry.correct}
                </td>

                {/* Total tipped */}
                <td className="px-4 py-3.5 text-right text-gray-500 tabular-nums">
                  {entry.total}
                </td>

                {/* Percentage */}
                <td className="px-4 py-3.5 text-right tabular-nums">
                  <span
                    className={
                      entry.total === 0
                        ? "text-gray-400"
                        : entry.correct / entry.total >= 0.6
                        ? "text-green-600 font-semibold"
                        : "text-gray-600"
                    }
                  >
                    {pct(entry.correct, entry.total)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const supabase = await createClient();

  // ── Parallel fetches that don't depend on each other ─────────────────────
  const [
    { data: openGameweek },
    { data: allPicksRaw },
    { data: profiles },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from("gameweeks")
      .select("*")
      .eq("is_open", true)
      .maybeSingle() as Promise<{ data: Gameweek | null }>,
    supabase.from("picks").select("user_id, is_correct"),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("teams").select("*"),
  ]);

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const teamMap = new Map<string, Team>(
    (teams ?? []).map((t) => [t.id, t])
  );
  const profileMap = new Map<string, string | null>(
    (profiles ?? []).map((p: Profile) => [p.id, p.display_name])
  );

  // ── Fetch this week's fixtures + picks (serial — needs openGameweek.id) ──
  let weekFixtures: RichFixture[] = [];
  let weekPicksByFixture = new Map<string, RichPick[]>();

  if (openGameweek) {
    const { data: fixturesRaw } = await supabase
      .from("fixtures")
      .select(
        `*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`
      )
      .eq("gameweek_id", openGameweek.id)
      .order("match_date");

    weekFixtures = (fixturesRaw ?? []) as RichFixture[];

    if (weekFixtures.length > 0) {
      const { data: picksRaw } = await supabase
        .from("picks")
        .select(
          "id, user_id, fixture_id, picked_team_id, is_correct, auto_picked, picked_team:teams!picks_picked_team_id_fkey(*)"
        )
        .in(
          "fixture_id",
          weekFixtures.map((f) => f.id)
        );

      for (const pick of (picksRaw ?? []) as RichPick[]) {
        const list = weekPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        weekPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

  // ── Overall leaderboard aggregation ───────────────────────────────────────
  const lbMap = new Map<string, { correct: number; total: number }>();
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
      ...stats,
    }))
    .sort(
      (a, b) =>
        b.correct - a.correct ||
        b.total - a.total ||
        a.displayName.localeCompare(b.displayName)
    );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-brand">Leaderboard</h1>

      {/* ── Section 1: This Week ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {openGameweek
                ? `This Week's Results — ${openGameweek.label}`
                : "This Week's Results"}
            </h2>
            {openGameweek && (
              <p className="text-xs text-gray-400 mt-0.5">
                Round {openGameweek.number} · Deadline{" "}
                {fmtDeadline(openGameweek.deadline)}
              </p>
            )}
          </div>
          {openGameweek && (
            <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
              {weekFixtures.length} fixture
              {weekFixtures.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!openGameweek ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-10 text-center">
            <p className="font-medium text-gray-600">No round currently open</p>
            <p className="text-sm text-gray-400 mt-1">
              Check back when the next round is open for tipping.
            </p>
          </div>
        ) : weekFixtures.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-10 text-center text-gray-500 text-sm">
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
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Overall Leaderboard ───────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900">
            Overall Leaderboard
          </h2>
          {leaderboard.length > 0 && (
            <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
              {leaderboard.length} tipper
              {leaderboard.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <LeaderboardTable rows={leaderboard} />
      </section>
    </div>
  );
}
