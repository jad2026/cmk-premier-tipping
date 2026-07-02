import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, NPC_COMPETITION_ID, CMK_COMPETITION_ID } from "@/lib/competition";
import Image from "next/image";

export const revalidate = 300;

type LadderRow = {
  comp_id: string;
  team_id: string;
  team_name: string;
  position: number | null;
  matches_played: number | null;
  matches_won: number | null;
  matches_drawn: number | null;
  matches_lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points_diff: number | null;
  bonus_points: number | null;
  match_points: number | null;
  crest: string | null;
};

function val(n: number | null): string {
  return n != null ? String(n) : "—";
}

function signed(n: number | null): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

function teamMonogram(name: string): string {
  const words = name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function LadderPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const CMK_WOMEN_COMPETITION_ID = "952743a7-9e79-4c5b-b15c-7fe07c4ca420";
  const tenantIds = compId === CMK_COMPETITION_ID
    ? [CMK_COMPETITION_ID, CMK_WOMEN_COMPETITION_ID]
    : [compId];

  const [
    { data: activeComps },
    { data: teams },
    { data: closedGameweeks },
  ] = await Promise.all([
    supabase
      .from("competitions")
      .select("comp_id")
      .in("id", tenantIds)
      .eq("is_active", true),
    supabase.from("teams").select("name, colour"),
    supabase
      .from("gameweeks")
      .select("number")
      .eq("competition_id", compId)
      .eq("is_open", false)
      .order("number", { ascending: false })
      .limit(1),
  ]);

  const activeXplorerIds = (activeComps ?? []).map((c: { comp_id: string }) => c.comp_id);

  const { data: rows, error } = activeXplorerIds.length > 0
    ? await supabase
        .from("ladder_standings")
        .select(
          "comp_id, team_id, team_name, position, matches_played, matches_won, matches_drawn, matches_lost, points_for, points_against, points_diff, bonus_points, match_points, crest"
        )
        .in("comp_id", activeXplorerIds)
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (error) console.error("ladder_standings query error:", error);

  const standings = (rows ?? []) as LadderRow[];

  // Build team colour map from teams table
  const teamColourMap = new Map<string, string>();
  for (const t of teams ?? []) {
    teamColourMap.set(t.name.toLowerCase(), t.colour);
  }
  const FALLBACK_COLORS = ["#1E7A3E", "#21409A", "#B23A48", "#2C9FD4", "#7A4B36", "#15324E", "#2B6E2B", "#6E3A2A", "#2C6E8F"];

  function getTeamColour(name: string, idx: number): string {
    const lower = name.toLowerCase();
    for (const [key, colour] of Array.from(teamColourMap)) {
      if (lower.includes(key) || key.includes(lower)) return colour;
    }
    return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  }

  const isNpc = compId === NPC_COMPETITION_ID;
  const compLabel = isNpc ? "Bunnings NPC" : "CMK Premier";
  const latestRound = closedGameweeks?.[0]?.number ?? null;

  function compHeading(rows: LadderRow[]): string {
    const names = rows.map((r) => r.team_name.toLowerCase());
    if (names.some((n) => n.includes("women"))) return `${compLabel} Women`;
    if (names.some((n) => n.includes("men"))) return `${compLabel} Men`;
    return compLabel;
  }

  function compEyebrow(rows: LadderRow[]): string {
    const heading = compHeading(rows);
    const roundSuffix = latestRound ? ` · After Round ${latestRound}` : "";
    return `${heading}${roundSuffix}`;
  }

  // Group by comp_id
  const comps = Array.from(
    standings.reduce((map, row) => {
      if (!map.has(row.comp_id)) map.set(row.comp_id, { rows: [] });
      map.get(row.comp_id)!.rows.push(row);
      return map;
    }, new Map<string, { rows: LadderRow[] }>())
  );

  // For each comp, determine total row count for zone borders
  function getBarColor(rank: number, total: number): string {
    if (rank <= 4) return "var(--accent)";

    return "#E4E1D8";
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
              {comps.length > 0 ? compEyebrow(comps[0][1].rows) : compLabel}
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            The Ladder<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p style={{ fontSize: 16, color: "#AEB4BE", margin: "14px 0 0", maxWidth: 480 }}>
            Four points a win, two a draw, bonus for four tries or a loss inside seven.
          </p>
        </div>
      </section>

      {/* ── Tables per competition ────────────────────────────────────── */}
      {standings.length === 0 ? (
        <section className="mx-auto" style={{ maxWidth: 1100, padding: "40px 32px 70px" }}>
          <div className="text-center" style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "56px 24px" }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>🏉</span>
            <p style={{ fontWeight: 600, color: "#5A6371", margin: 0 }}>No ladder data available yet</p>
            <p style={{ fontSize: 14, color: "#8B8676", marginTop: 4 }}>Standings will appear here once competition data is available.</p>
          </div>
        </section>
      ) : (
        comps.map(([cId, { rows: compRows }], compIdx) => {
          const total = compRows.length;
          return (
            <div key={cId}>
              {/* Legend */}
              <section className="mx-auto" style={{ maxWidth: 1100, padding: compIdx === 0 ? "30px 32px 18px" : "40px 32px 18px" }}>
                {comps.length > 1 && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
                    <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, color: "#11151C" }}>
                      {compHeading(compRows)}
                    </h2>
                  </div>
                )}
                <div className="flex items-center flex-wrap" style={{ gap: 20 }}>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--accent)" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#5A5546" }}>Top 4 · Semi-finals</span>
                  </div>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: "#C9C5B8" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#5A5546" }}>Mid-table</span>
                  </div>
                </div>
              </section>

              {/* Table */}
              <section className="mx-auto" style={{ maxWidth: 1100, padding: "0 32px 70px" }}>
                <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, overflow: "hidden", fontFeatureSettings: "'tnum'" }}>
                  <div className="overflow-x-auto">
                    {/* Header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "46px 1fr 42px 42px 42px 42px 58px 58px 58px 56px",
                        padding: "15px 20px",
                        background: "#0D1016",
                        color: "#9AA1AD",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        minWidth: 560,
                      }}
                    >
                      <span>#</span>
                      <span>Club</span>
                      <span style={{ textAlign: "center" }}>P</span>
                      <span style={{ textAlign: "center" }}>W</span>
                      <span style={{ textAlign: "center" }}>D</span>
                      <span style={{ textAlign: "center" }}>L</span>
                      <span style={{ textAlign: "center" }}>PF</span>
                      <span style={{ textAlign: "center" }}>PA</span>
                      <span style={{ textAlign: "center" }}>PD</span>
                      <span style={{ textAlign: "right" }}>Pts</span>
                    </div>

                    {/* Rows */}
                    {compRows.map((row, idx) => {
                      const rank = row.position ?? idx + 1;
                      const barColor = getBarColor(rank, total);
                      const teamColor = getTeamColour(row.team_name, idx);
                      const pd = row.points_diff;

                      return (
                        <div
                          key={row.team_id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "46px 1fr 42px 42px 42px 42px 58px 58px 58px 56px",
                            alignItems: "center",
                            padding: "15px 20px",
                            borderTop: "1px solid #EFEDE6",
                            borderLeft: `4px solid ${barColor}`,
                            minWidth: 560,
                          }}
                        >
                          {/* Rank */}
                          <span
                            className="font-display"
                            style={{ fontSize: 16, color: "#11151C" }}
                          >
                            {rank}
                          </span>

                          {/* Club */}
                          <span className="flex items-center" style={{ gap: 12, minWidth: 0 }}>
                            {row.crest ? (
                              <Image
                                src={row.crest}
                                alt={row.team_name}
                                width={32}
                                height={32}
                                className="rounded-full object-contain shrink-0"
                                style={{ width: 32, height: 32 }}
                                unoptimized
                              />
                            ) : (
                              <span
                                className="flex items-center justify-center rounded-full shrink-0"
                                style={{
                                  width: 32,
                                  height: 32,
                                  background: teamColor,
                                  fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                                  fontSize: 11,
                                  color: "#fff",
                                }}
                              >
                                {teamMonogram(row.team_name)}
                              </span>
                            )}
                            <span className="flex flex-col" style={{ minWidth: 0 }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: "#11151C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {row.team_name}
                              </span>
                            </span>
                          </span>

                          {/* P */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                            {val(row.matches_played)}
                          </span>

                          {/* W */}
                          <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#169B63" }}>
                            {val(row.matches_won)}
                          </span>

                          {/* D */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#8B8676" }}>
                            {val(row.matches_drawn)}
                          </span>

                          {/* L */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#B23A48" }}>
                            {val(row.matches_lost)}
                          </span>

                          {/* PF */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                            {val(row.points_for)}
                          </span>

                          {/* PA */}
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>
                            {val(row.points_against)}
                          </span>

                          {/* PD */}
                          <span style={{
                            textAlign: "center",
                            fontSize: 14,
                            fontWeight: 700,
                            color: pd != null && pd > 0 ? "#1F9E5A" : pd != null && pd < 0 ? "#B23A48" : "#5A6371",
                          }}>
                            {signed(pd)}
                          </span>

                          {/* Pts */}
                          <span
                            className="font-display"
                            style={{ textAlign: "right", fontSize: 18, color: "#11151C" }}
                          >
                            {val(row.match_points)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          );
        })
      )}
    </div>
  );
}
