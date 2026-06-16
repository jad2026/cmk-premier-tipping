"use server";

import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/welcomeEmail";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";

export async function triggerWelcomeEmail(
  email: string,
  firstName: string,
  teamName: string
): Promise<void> {
  const supabase = await createClient();

  const [{ data: seasonConfig }, emailSponsors] = await Promise.all([
    supabase.from("season_config").select("season_name").eq("id", 1).single(),
    fetchActiveSponsors("email"),
  ]);

  const seasonName = seasonConfig?.season_name ?? "2026 Season";

  await sendWelcomeEmail({
    to: email,
    firstName: firstName || email.split("@")[0],
    teamName,
    seasonName,
    sponsors: emailSponsors,
  });
}
