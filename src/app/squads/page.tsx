import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import type { Team, Player, CoachingStaff } from "@/lib/supabase/types";
import SquadDisplay from "./SquadDisplay";

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

  const { data: coachData } = teamIds.length > 0
    ? await supabase
        .from("coaching_staff")
        .select("*")
        .in("team_id", teamIds)
        .order("display_order")
    : { data: [] as CoachingStaff[] };

  const playersByTeam = new Map<string, Player[]>();
  for (const p of (players ?? []) as Player[]) {
    const list = playersByTeam.get(p.team_id) ?? [];
    list.push(p);
    playersByTeam.set(p.team_id, list);
  }

  const coachesByTeam = new Map<string, CoachingStaff[]>();
  for (const c of (coachData ?? []) as CoachingStaff[]) {
    const list = coachesByTeam.get(c.team_id) ?? [];
    list.push(c);
    coachesByTeam.set(c.team_id, list);
  }

  const teamsWithData = (teams ?? []).map((t) => ({
    team: t as Team,
    players: playersByTeam.get(t.id) ?? [],
    coaches: coachesByTeam.get(t.id) ?? [],
  }));

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <SquadDisplay teams={teamsWithData} />
    </div>
  );
}
