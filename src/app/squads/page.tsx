import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Player } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SquadsIndexPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: compFeatures } = await supabase
    .from("competitions")
    .select("features")
    .eq("id", compId)
    .single() as unknown as { data: { features: Record<string, boolean> | null } | null };

  if (compFeatures?.features?.show_squads !== true) {
    redirect("/");
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("competition_id", compId)
    .order("name");

  const teamIds = (teams ?? []).map((t) => t.id);

  const { data: players } = teamIds.length > 0
    ? await supabase
        .from("players")
        .select("team_id")
        .in("team_id", teamIds)
        .eq("is_active", true)
    : { data: [] as Pick<Player, "team_id">[] };

  const countByTeam = new Map<string, number>();
  for (const p of players ?? []) {
    countByTeam.set(p.team_id, (countByTeam.get(p.team_id) ?? 0) + 1);
  }

  const teamList = (teams ?? []) as Team[];

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Header */}
      <section style={{ background: "#F2F0EA", borderBottom: "1px solid #E4E1D8" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#8B8676" }}>
              Team rosters
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0, color: "#0B0E13" }}
          >
            Squads<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
      </section>

      {/* Team grid */}
      <section style={{ background: "#F2F0EA", minHeight: "60vh" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 70px" }}>
          {teamList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#8B8676", fontSize: 15, fontStyle: "italic" }}>
              No teams available yet.
            </div>
          ) : (
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}
            >
              {teamList.map((team) => {
                const playerCount = countByTeam.get(team.id) ?? 0;
                return (
                  <Link
                    key={team.id}
                    href={`/squads/${team.id}`}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "28px 16px 22px",
                      border: "1px solid #E4E1D8",
                      textDecoration: "none",
                      transition: "transform .15s, border-color .15s",
                    }}
                    className="w-[calc(50%-7px)] sm:w-[calc(33.333%-10px)] lg:w-[calc(25%-11px)] hover:scale-[1.03] hover:!border-[var(--accent)]"
                  >
                    <TeamBadge team={team} size="rail" />
                    <span
                      className="font-display uppercase"
                      style={{
                        fontSize: 16,
                        color: "#0B0E13",
                        marginTop: 14,
                        textAlign: "center",
                        lineHeight: 1.2,
                        letterSpacing: ".02em",
                      }}
                    >
                      {team.name}
                    </span>
                    <span
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#8B8676",
                      }}
                    >
                      {playerCount} player{playerCount !== 1 ? "s" : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
