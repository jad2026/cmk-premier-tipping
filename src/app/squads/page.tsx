import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Player } from "@/lib/supabase/types";
import SquadCards from "./SquadCards";

export const dynamic = "force-dynamic";

export default async function SquadsPage() {
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
        .select("*")
        .in("team_id", teamIds)
        .eq("is_active", true)
        .order("jersey_number")
    : { data: [] as Player[] };

  const playersByTeam = new Map<string, Player[]>();
  for (const p of (players ?? []) as Player[]) {
    const list = playersByTeam.get(p.team_id) ?? [];
    list.push(p);
    playersByTeam.set(p.team_id, list);
  }

  const teamsWithPlayers = (teams ?? []).map((t) => ({
    team: t as Team,
    players: playersByTeam.get(t.id) ?? [],
  }));

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Dark header */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Team rosters
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            Squads<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
      </section>

      {/* Squad cards */}
      <section className="mx-auto" style={{ maxWidth: 1100, padding: "30px 32px 70px" }}>
        {teamsWithPlayers.length === 0 ? (
          <div className="text-center" style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "48px 24px" }}>
            <p style={{ fontWeight: 600, color: "#5A6371", margin: 0 }}>No teams available yet.</p>
          </div>
        ) : (
          <SquadCards teams={teamsWithPlayers} />
        )}
      </section>
    </div>
  );
}
