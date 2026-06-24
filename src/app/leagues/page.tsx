import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { fetchMyLeagues } from "./actions";
import LeaguesClient from "./LeaguesClient";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const compId = await getCurrentCompetitionId();
  console.log("LEAGUES PAGE compId:", compId);
  const { leagues } = await fetchMyLeagues(compId);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <p className="eyebrow mb-1">Competition</p>
        <h1 className="text-2xl font-bold tracking-tight text-brand">My Leagues</h1>
      </div>
      <LeaguesClient initialLeagues={leagues} />
    </div>
  );
}
