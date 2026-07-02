import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import type { Team, Player, CoachingStaff } from "@/lib/supabase/types";
import SquadDisplay from "../SquadDisplay";

export const dynamic = "force-dynamic";

export default async function TeamSquadPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
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

  const { data: teamData } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .eq("competition_id", compId)
    .single();

  if (!teamData) notFound();

  const team = teamData as Team;

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("jersey_number");

  const { data: coachData } = await supabase
    .from("coaching_staff")
    .select("*")
    .eq("team_id", teamId)
    .order("display_order");

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <SquadDisplay
        team={team}
        players={(players ?? []) as Player[]}
        coaches={(coachData ?? []) as CoachingStaff[]}
      />
    </div>
  );
}
