import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TeamMarquee from "@/components/TeamMarquee";

export default async function GlobalTeamMarquee() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (pathname.startsWith("/admin")) return null;

  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .not("name", "like", "%Women")
    .order("name");

  if (!teams || teams.length === 0) return null;

  return <TeamMarquee teams={teams} />;
}
