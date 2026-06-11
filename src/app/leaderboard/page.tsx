import { createClient } from "@/lib/supabase/server";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Fixture, Gameweek } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ── Local types ───────────────────────────────────────────────────────────────

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

type LeaderboardEntry = {
  user_id: string;
  displayName: string;
  correct: number;
  total: number;
};

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
}: {
  fixture: RichFixture;
  picks: RichPick[];
  teamMap: Map<string, Team>;
  profileMap: Map<string, string | null>;
}) {
  const hasResult = fixture.result_team_id !== null;
  const resultTeam = hasResult ? teamMap.get(fixture.result_team_id!) : null;

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
      {/* ── Match header ──────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3">
        {/* Teams */}
        <div className="flex items-center gap-2 mb-3">
          {/* Home */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamBadge team={fixture.home_team} size="sm" />
            <span className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
              {fixture.home_team.name}
            </span>
          </div>

          {/* VS pill */}
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-brand/8 text-brand text-[10px] font-bold tracking-widest">
            VS
          </span>

          {/* Away */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-gray-800 leading-snug text-right line-clamp-2">
              {fixture.away_team.name}
            </span>
            <TeamBadge team={fixture.away_team} size="sm" />
          </div>
        </div>

        {/* Meta + result */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-400">
            {fmtDate(fixture.match_date)}
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

      {/* ── Picks strip ──────────────────────────────────────────────── */}
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

function LeaderboardTable({ rows }: { rows: LeaderboardEntry[] }) {
  if (rows.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="font-medium text-gray-600">No picks recorded yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Check back after the first round!
        </p>
      </div>
    );
  }

  const topCorrect = rows[0].correct;

  return (
    <div className="card overflow-hidden">
      {/* Table head */}
      <div className="grid grid-cols-[3rem_1fr_6rem_5rem_5rem] bg-brand text-white text-xs font-semibold uppercase tracking-wider">
        <div className="px-4 py-3.5 text-center">#</div>
        <div className="px-4 py-3.5">Tipper</div>
        <div className="px-4 py-3.5 text-right">Correct</div>
        <div className="px-4 py-3.5 text-right">Tipped</div>
        <div className="px-4 py-3.5 text-right pr-5">%</div>
      </div>

      <div className="divide-y divide-gray-50">
        {rows.map((entry, idx) => {
          const isLeader = entry.correct === topCorrect && entry.correct > 0;
          const isTop3 = idx < 3 && entry.correct > 0;
          const hitRate = pctNum(entry.correct, entry.total);

          return (
            <div
              key={entry.user_id}
              className={`grid grid-cols-[3rem_1fr_6rem_5rem_5rem] items-center transition-colors ${
                isLeader
                  ? "bg-brand-gold-light/60 border-l-4 border-l-brand-gold"
                  : idx % 2 === 0
                  ? "bg-white hover:bg-gray-50/70"
                  : "bg-[#f9fafb] hover:bg-gray-50"
              }`}
            >
              {/* Position */}
              <div className="px-0 py-4 flex justify-center">
                {isLeader ? (
                  <span className="text-lg leading-none select-none" title="Leader">🏆</span>
                ) : isTop3 ? (
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    idx === 1 ? "bg-gray-400" : "bg-amber-600"
                  }`}>
                    {idx + 1}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 tabular-nums font-medium">
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Name */}
              <div className="px-4 py-4">
                <span className={`text-sm ${isLeader ? "font-bold text-brand" : "font-medium text-gray-800"}`}>
                  {entry.displayName}
                </span>
              </div>

              {/* Correct */}
              <div className="px-4 py-4 text-right">
                <span className={`text-sm tabular-nums font-bold ${isLeader ? "text-brand-gold-dark" : "text-green-700"}`}>
                  {entry.correct}
                </span>
              </div>

              {/* Total */}
              <div className="px-4 py-4 text-right">
                <span className="text-sm tabular-nums text-gray-500">{entry.total}</span>
              </div>

              {/* Percentage with mini bar */}
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

// ── Section heading helper ────────────────────────────────────────────────────

function SectionHeading({
  title,
  sub,
  badge,
}: {
  title: string;
  sub?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5 mb-0.5">
          <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
        </div>
        {sub && <p className="text-xs text-gray-400 ml-3.5">{sub}</p>}
      </div>
      {badge && (
        <span className="card px-3 py-1 text-xs text-gray-500 font-medium shadow-none">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const supabase = await createClient();

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
      .maybeSingle() as unknown as Promise<{ data: Gameweek | null }>,
    supabase.from("picks").select("user_id, is_correct"),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("teams").select("*"),
  ]);

  const teamMap = new Map<string, Team>((teams ?? []).map((t) => [t.id, t]));
  const profileMap = new Map<string, string | null>(
    (profiles ?? []).map((p: Profile) => [p.id, p.display_name])
  );

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
        .select("id, user_id, fixture_id, picked_team_id, is_correct, auto_picked, picked_team:teams!picks_picked_team_id_fkey(*)")
        .in("fixture_id", weekFixtures.map((f) => f.id));

      for (const pick of (picksRaw ?? []) as unknown as RichPick[]) {
        const list = weekPicksByFixture.get(pick.fixture_id) ?? [];
        list.push(pick);
        weekPicksByFixture.set(pick.fixture_id, list);
      }
    }
  }

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

  return (
    <div className="space-y-10">

      {/* ── Page title ──────────────────────────────────────────────────── */}
      <div>
        <p className="eyebrow mb-1">2026 Season</p>
        <h1 className="text-2xl font-bold tracking-tight text-brand">
          Leaderboard
        </h1>
      </div>

      {/* ── This week ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading
          title={openGameweek ? `This Week — ${openGameweek.label}` : "This Week's Results"}
          sub={openGameweek ? `${openGameweek.label} · Deadline ${fmtDeadline(openGameweek.deadline)}` : undefined}
          badge={openGameweek ? `${weekFixtures.length} fixture${weekFixtures.length !== 1 ? "s" : ""}` : undefined}
        />

        {!openGameweek ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-medium text-gray-600">No round currently open</p>
            <p className="text-sm text-gray-400 mt-1">
              Check back when the next round opens for tipping.
            </p>
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
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Overall leaderboard ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading
          title="Overall Standings"
          badge={leaderboard.length > 0 ? `${leaderboard.length} tipper${leaderboard.length !== 1 ? "s" : ""}` : undefined}
        />
        <LeaderboardTable rows={leaderboard} />
      </section>
    </div>
  );
}
