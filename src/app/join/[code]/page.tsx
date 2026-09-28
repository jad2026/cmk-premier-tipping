import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { joinLeague } from "@/app/leagues/actions";
import { joinCompetition } from "@/app/competition-actions";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?code=${encodeURIComponent(code)}`);

  // Only accept leagues belonging to the competition whose site we're on.
  const inviteCode = code.trim().toUpperCase();
  const compId = await getCurrentCompetitionId();
  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("invite_code", inviteCode)
    .eq("competition_id", compId)
    .maybeSingle();
  if (!league) redirect("/leagues?error=invalid-code");

  // Make sure they're in the competition itself, then the league.
  await joinCompetition();

  const { data: membership } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    const res = await joinLeague(inviteCode);
    if (res.error) redirect("/leagues?error=invalid-code");
  }

  redirect(`/leagues/${league.id}`);
}
