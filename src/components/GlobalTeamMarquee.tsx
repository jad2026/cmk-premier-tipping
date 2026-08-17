import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import TeamMarquee from "@/components/TeamMarquee";

export default async function GlobalTeamMarquee() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (pathname.startsWith("/admin") || pathname === "/" || pathname === "" || pathname === "/leaderboard" || pathname.startsWith("/leaderboard/") || pathname === "/stats" || pathname === "/tips" || pathname === "/my-picks" || pathname === "/profile" || pathname === "/leagues" || pathname.startsWith("/leagues/") || pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password") return null;

  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("competition_id", compId)
    .not("name", "like", "%Women")
    .order("name");

  if (!teams || teams.length === 0) return null;

  return (
    <div className="md:hidden max-w-content mx-auto px-4 sm:px-8 pt-6">
      <TeamMarquee teams={teams} />
    </div>
  );
}
