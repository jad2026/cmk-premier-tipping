import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone } from "@/lib/competition";
import type { TzLocale } from "@/lib/datetime";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Fixture, Gameweek } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type RichFixture = Omit<Fixture, "home_team" | "away_team"> & {
  home_team: Team;
  away_team: Team;
};

type ResultPick = {
  user_id: string;
  fixture_id: string;
  is_correct: boolean | null;
  margin_bonus: number;
  points: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

// Supabase caps responses at 1,000 rows, so page through with .range().
async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await query(from, from + PAGE_SIZE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function hasResult(f: Pick<Fixture, "result_team_id" | "is_draw">) {
  return f.result_team_id !== null || f.is_draw;
}

function fmtDate(iso: string, tz: TzLocale) {
  return new Date(iso).toLocaleDateString(tz.locale, {
    timeZone: tz.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ResultsPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: comp } = await supabase
    .from("competitions")
    .select("features")
    .eq("id", compId)
    .maybeSingle() as { data: { features: Record<string, boolean> | null } | null };
  if (comp?.features?.results_page !== true) redirect("/");
  const marginPicking = comp.features.margin_picking === true;

  const tz = await getCompetitionTimezone(compId);

  const { data: gameweeksRaw } = await supabase
    .from("gameweeks")
    .select("*")
    .eq("competition_id", compId)
    .order("number", { ascending: false });
  const gameweeks = (gameweeksRaw ?? []) as Gameweek[];

  // Fixtures (with teams) for every round in this competition.
  const fixtures: RichFixture[] = [];
  for (const ids of chunk(gameweeks.map((g) => g.id), ID_CHUNK)) {
    const rows = await fetchAllRows<RichFixture>((from, to) =>
      supabase
        .from("fixtures")
        .select(
          `*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`
        )
        .in("gameweek_id", ids)
        .order("match_date")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: RichFixture[] | null }>
    );
    fixtures.push(...rows);
  }

  const fixturesByRound = new Map<string, RichFixture[]>();
  for (const f of fixtures) {
    const list = fixturesByRound.get(f.gameweek_id) ?? [];
    list.push(f);
    fixturesByRound.set(f.gameweek_id, list);
  }

  // Only rounds with at least one result, newest first.
  const rounds = gameweeks
    .map((gw) => ({ gw, fixtures: fixturesByRound.get(gw.id) ?? [] }))
    .filter((r) => r.fixtures.some(hasResult));

  // Participants, then picks for every fixture in those rounds.
  const participants = await fetchAllRows<{ user_id: string }>((from, to) =>
    supabase
      .from("competition_participants")
      .select("user_id")
      .eq("competition_id", compId)
      .order("user_id")
      .range(from, to)
  );
  const participantIds = new Set(participants.map((p) => p.user_id));

  const picksByFixture = new Map<string, ResultPick[]>();
  const roundFixtureIds = rounds.flatMap((r) => r.fixtures.map((f) => f.id));
  for (const ids of chunk(roundFixtureIds, ID_CHUNK)) {
    const rows = await fetchAllRows<ResultPick>((from, to) =>
      supabase
        .from("picks")
        .select("user_id, fixture_id, is_correct, margin_bonus, points")
        .in("fixture_id", ids)
        .order("id")
        .range(from, to)
    );
    for (const p of rows) {
      if (!participantIds.has(p.user_id)) continue;
      const list = picksByFixture.get(p.fixture_id) ?? [];
      list.push(p);
      picksByFixture.set(p.fixture_id, list);
    }
  }

  // Per-round winners: highest total points across the round's fixtures.
  const roundWinners = new Map<string, { userIds: string[]; points: number }>();
  for (const { gw, fixtures: roundFixtures } of rounds) {
    const totals = new Map<string, number>();
    for (const f of roundFixtures) {
      for (const p of picksByFixture.get(f.id) ?? []) {
        totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
      }
    }
    if (totals.size === 0) continue;
    const best = Math.max(...Array.from(totals.values()));
    const userIds = Array.from(totals.entries())
      .filter(([, pts]) => pts === best)
      .map(([id]) => id);
    roundWinners.set(gw.id, { userIds, points: best });
  }

  const winnerIds = Array.from(new Set(Array.from(roundWinners.values()).flatMap((w) => w.userIds)));
  const profileMap = new Map<string, string | null>();
  for (const ids of chunk(winnerIds, ID_CHUNK)) {
    const rows = await fetchAllRows<{ id: string; display_name: string | null }>((from, to) =>
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids)
        .order("id")
        .range(from, to)
    );
    for (const p of rows) profileMap.set(p.id, p.display_name);
  }
  const displayName = (id: string) =>
    profileMap.get(id)?.trim() || `Player ${id.slice(0, 5).toUpperCase()}`;

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Dark header */}
      <section style={{ background: "var(--surface, #0B0E13)", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Competition
            </span>
          </div>
          <h1 className="font-display uppercase" style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}>
            Results<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
      </section>

      {/* Content */}
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto space-y-5" style={{ maxWidth: 800, padding: "28px 16px 60px" }}>
          {rounds.length === 0 ? (
            <div
              className="rounded-[18px] text-center text-[15px] text-[#5A6371]"
              style={{ background: "#fff", border: "1px solid #E4E1D8", padding: "48px 24px" }}
            >
              No results yet — check back after the first round.
            </div>
          ) : (
            rounds.map(({ gw, fixtures: roundFixtures }) => {
              const winners = roundWinners.get(gw.id);
              const firstDate = roundFixtures[0]?.match_date ?? gw.deadline;
              return (
                <Link
                  key={gw.id}
                  href={`/leaderboard/round/${gw.number}`}
                  className="block rounded-[18px] overflow-hidden no-underline text-inherit hover:shadow-md transition-shadow"
                  style={{ background: "#fff", border: "1px solid #E4E1D8" }}
                >
                  {/* Round header */}
                  <div
                    className="flex items-baseline justify-between gap-3 flex-wrap"
                    style={{ background: "var(--surface-alt, #0D1016)", color: "#fff", padding: "16px 20px" }}
                  >
                    <h2 className="font-display uppercase text-[20px] tracking-[.02em] m-0">{gw.label}</h2>
                    <span className="text-[12px] font-semibold text-[#C7CCD4]">{fmtDate(firstDate, tz)}</span>
                  </div>

                  {/* Fixtures */}
                  <div>
                    {roundFixtures.map((f) => {
                      const done = hasResult(f);
                      const picks = picksByFixture.get(f.id) ?? [];
                      const correct = picks.filter((p) => p.is_correct === true).length;
                      const pct = picks.length > 0 ? Math.round((correct / picks.length) * 100) : null;
                      const maxBonus = picks.reduce((m, p) => Math.max(m, p.margin_bonus ?? 0), 0);
                      const exactCount = maxBonus > 0 ? picks.filter((p) => p.margin_bonus === maxBonus).length : 0;
                      const hasScore = f.home_score !== null && f.away_score !== null;
                      const side = (team: Team, score: number | null) => {
                        const won = f.result_team_id === team.id;
                        return (
                          <div className="flex items-center gap-3 min-w-0">
                            <TeamBadge team={team} size="sm" />
                            <span className={`flex-1 min-w-0 truncate text-[15px] ${won ? "font-extrabold text-[#11151C]" : "text-[#5A6371]"}`}>
                              {team.name}
                            </span>
                            {hasScore && (
                              <span
                                className={`text-[17px] tabular-nums ${won ? "font-extrabold text-[#11151C]" : "text-[#5A6371]"}`}
                              >
                                {score}
                              </span>
                            )}
                          </div>
                        );
                      };
                      return (
                        <div key={f.id} style={{ padding: "14px 20px", borderTop: "1px solid #EEEBE3" }}>
                          <div className="space-y-2">
                            {side(f.home_team, f.home_score)}
                            {side(f.away_team, f.away_score)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-[#8C93A0]">
                            {!done && <span>Result pending</span>}
                            {f.is_draw && (
                              <span className="font-extrabold uppercase tracking-[.08em]" style={{ color: "var(--accent)" }}>
                                Draw
                              </span>
                            )}
                            {done && pct !== null && (
                              <span>
                                {pct}% tipped correctly ({picks.length} {picks.length === 1 ? "tip" : "tips"})
                              </span>
                            )}
                            {done && marginPicking && picks.length > 0 && <span>Exact margin: {exactCount}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Round winner(s) */}
                  {winners && (
                    <div
                      className="flex items-center gap-3 flex-wrap"
                      style={{ padding: "14px 20px", borderTop: "1px solid #E4E1D8", background: "#FAF9F5" }}
                    >
                      <span className="shrink-0" style={{ width: 18, height: 3, borderRadius: 2, background: "var(--accent)" }} />
                      <span className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#8C93A0]">
                        {winners.userIds.length > 1 ? "Joint winners" : "Round winner"}
                      </span>
                      <span className="text-[14px] font-bold text-[#11151C]">
                        {winners.userIds.map(displayName).join(", ")}
                      </span>
                      <span className="text-[13px] text-[#5A6371] tabular-nums">
                        {winners.points} {winners.points === 1 ? "pt" : "pts"}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
