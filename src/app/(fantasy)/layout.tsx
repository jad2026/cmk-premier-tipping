import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";

export default async function FantasyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: comp } = (await supabase
    .from("competitions")
    .select("features")
    .eq("id", compId)
    .single()) as unknown as {
    data: { features: Record<string, boolean> | null } | null;
  };

  if (comp?.features?.fantasy_enabled !== true) {
    redirect("/");
  }

  return <>{children}</>;
}
