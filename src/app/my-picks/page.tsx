import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone } from "@/lib/competition";
import { fmtDate as fmtDateTz } from "@/lib/datetime";
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
  predicted_margin: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(correct: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((correct / total) * 100)}%`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function MyPicksPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const tzLocale = await getCompetitionTimezone(compId);
  const fmtDate = (iso: string) => fmtDateTz(iso, tzLocale);

  const { data: compFeatures } = await supabase
    .from("competitions")
    .select("features")
    .eq("id", compId)
    .single() as unknown as { data: { features: Record<string, boolean> | null } | null };
  const marginPicking = compFeatures?.features?.margin_picking === true;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: compGwRows } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("competition_id", compId);
  const compGwIds = (compGwRows ?? []).map((g) => g.id);

  const [
    { data: gameweeks },
    { data: fixturesRaw },
    { data: profilesForRank },
  ] = await Promise.all([
    supabase
      .from("gameweeks")
      .select("id, number, label, deadline, is_open")
      .eq("competition_id", compId)
      .order("number", { ascending: false }),
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

  const [
    { data: picksRaw, error: picksError },
    { data: allPicksForRank },
  ] = await Promise.all([
    compFixtureIds.length > 0
      ? supabase.from("picks").select("*").eq("user_id", user.id).in("fixture_id", compFixtureIds)
      : Promise.resolve({ data: [], error: null }),
    compFixtureIds.length > 0
      ? supabase.from("picks").select("user_id, points").in("fixture_id", compFixtureIds)
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

  const manualScoredPicks = scoredPicks.filter((p) => !p.auto_picked);
  const manualCorrect = manualScoredPicks.filter((p) => p.is_correct === true).length;
  const manualTotal = manualScoredPicks.length;

  const tallyByUser = new Map<string, number>();
  for (const p of allPicksForRank ?? []) {
    tallyByUser.set(p.user_id, (tallyByUser.get(p.user_id) ?? 0) + (p.points ?? 0));
  }
  const myPoints = tallyByUser.get(user.id) ?? 0;
  const totalPlayers = (profilesForRank ?? []).length;
  const rank = Array.from(tallyByUser.values()).filter((v) => v > myPoints).length + 1;

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
        hasPicks: myPicks.length > 0,
      };
    })
    .filter((r) => r.is_open || r.hasPicks);

  // ── Render ────────────────────────────────────────────────────────────────

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
              Season history
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            My Picks<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
      </section>

      {/* ── Stats summary ────────────────────────────────────────────── */}
      <section className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #E4E1D8",
            borderRadius: 18,
            padding: "28px 32px",
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 24 }}>
            <StatTile label="Correct" value={String(totalCorrect)} />
            <StatTile label="Tipped" value={totalTipped > 0 ? String(totalTipped) : "—"} />
            <StatTile label="Accuracy" value={pct(manualCorrect, manualTotal)} highlight />
            <StatTile
              label="Current Rank"
              value={totalPlayers > 0 ? `#${rank}` : "—"}
              sub={totalPlayers > 0 ? `of ${totalPlayers}` : undefined}
            />
          </div>
        </div>
      </section>

      {/* ── Rounds ───────────────────────────────────────────────────── */}
      <section className="mx-auto" style={{ maxWidth: 1100, padding: "0 32px 70px" }}>
        {rounds.length === 0 ? (
          <div className="text-center" style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "48px 24px" }}>
            <p style={{ fontWeight: 600, color: "#5A6371", margin: 0 }}>No rounds scheduled yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {rounds.map((round) => {
              const hasScoredPicks = round.roundPicked > 0;
              return (
                <div
                  key={round.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #E4E1D8",
                    borderRadius: 18,
                    overflow: "hidden",
                  }}
                >
                  {/* Round header */}
                  <div
                    className="flex items-center justify-between gap-3"
                    style={{
                      background: "#0D1016",
                      padding: "14px 22px",
                      borderRadius: "18px 18px 0 0",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <h2
                        className="font-display uppercase"
                        style={{ fontSize: 15, margin: 0, color: "#fff" }}
                      >
                        {round.label}
                      </h2>
                      <span className="hidden sm:inline" style={{ fontSize: 13, color: "#9AA1AD" }}>
                        {fmtDate(round.deadline)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasScoredPicks && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,.1)",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {round.roundCorrect}/{round.roundPicked}
                        </span>
                      )}
                      {round.is_open && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "rgba(var(--accent-rgb,217,165,33),.25)",
                            color: "var(--accent)",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                          }}
                        >
                          Open
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fixtures */}
                  {round.fixtures.map((fixture, fIdx) => {
                    const pick = pickMap.get(fixture.id);
                    const hasResult = fixture.result_team_id !== null || fixture.is_draw;
                    const pickedDraw = pick?.picked_draw ?? false;
                    const pickedTeamId = pick?.picked_team_id ?? null;
                    const pickedTeam = pickedTeamId
                      ? (fixture.home_team.id === pickedTeamId ? fixture.home_team : fixture.away_team)
                      : null;

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
                      <div
                        key={fixture.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3"
                        style={{
                          padding: "14px 22px",
                          borderTop: fIdx > 0 ? "1px solid #EFEDE6" : "none",
                        }}
                      >
                        {/* Teams */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <TeamBadge team={fixture.home_team} size="xs" />
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#11151C" }} className="truncate">
                            {fixture.home_team.name}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#C7C2B5", letterSpacing: ".06em" }} className="shrink-0">
                            VS
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#11151C" }} className="truncate">
                            {fixture.away_team.name}
                          </span>
                          <TeamBadge team={fixture.away_team} size="xs" />
                        </div>

                        {/* Pick + result */}
                        <div className="flex items-center gap-3 shrink-0 flex-wrap">
                          {pick ? (
                            <div className="flex items-center gap-1.5">
                              {pickedDraw ? (
                                <span
                                  className="inline-flex items-center gap-1"
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 8,
                                    background: "#F5F4EF",
                                    border: "1px solid #E4E1D8",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "#5A6371",
                                  }}
                                >
                                  🤝 Draw
                                </span>
                              ) : pickedTeam ? (
                                <span
                                  className="inline-flex items-center gap-1.5"
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 8,
                                    background: isCorrect === true ? "rgba(31,158,90,.08)" : isCorrect === false ? "rgba(178,58,72,.06)" : "rgba(var(--accent-rgb,217,165,33),.08)",
                                    border: `1px solid ${isCorrect === true ? "rgba(31,158,90,.2)" : isCorrect === false ? "rgba(178,58,72,.15)" : "rgba(var(--accent-rgb,217,165,33),.15)"}`,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isCorrect === true ? "#1F9E5A" : isCorrect === false ? "#B23A48" : "#11151C",
                                  }}
                                >
                                  <TeamBadge team={pickedTeam} size="xs" />
                                  {pickedTeam.name}
                                  {marginPicking && pick?.predicted_margin != null && (
                                    <span style={{ fontWeight: 600, opacity: 0.7 }}> by {Math.abs(pick.predicted_margin)}</span>
                                  )}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: "#8B8676", fontStyle: "italic" }}>No pick</span>
                          )}

                          {hasResult && (
                            <span className="hidden sm:inline" style={{ fontSize: 11, color: "#8B8676" }}>
                              Result: <span style={{ fontWeight: 600, color: "#5A6371" }}>{resultLabel}</span>
                            </span>
                          )}

                          {isCorrect === true && (
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "#1F9E5A",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 800,
                                color: "#fff",
                              }}
                            >
                              ✓
                            </span>
                          )}
                          {isCorrect === false && (
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "#B23A48",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 800,
                                color: "#fff",
                              }}
                            >
                              ✗
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Round footer — score bar */}
                  {hasScoredPicks && (
                    <div
                      className="flex items-center gap-3"
                      style={{
                        padding: "12px 22px",
                        background: "#F9F8F5",
                        borderTop: "1px solid #EFEDE6",
                      }}
                    >
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#EFEDE6", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 3,
                            background: "var(--accent)",
                            width: `${Math.round((round.roundCorrect / round.roundPicked) * 100)}%`,
                            transition: "width .3s",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#5A6371", flexShrink: 0 }}>
                        {round.roundCorrect}/{round.roundPicked} correct · {pct(round.roundCorrect, round.roundPicked)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────────

function StatTile({
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
    <div className="flex flex-col items-center text-center" style={{ gap: 4 }}>
      <span
        className="font-display"
        style={{
          fontSize: 38,
          lineHeight: 1,
          color: highlight ? "var(--accent)" : "#11151C",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8B8676" }}>
        {label}
      </span>
      {sub && <span style={{ fontSize: 12, color: "#8B8676" }}>{sub}</span>}
    </div>
  );
}
