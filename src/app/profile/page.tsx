import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const compId = await getCurrentCompetitionId();

  const [{ data: profile }, { data: compFeatures }, { data: teams }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, display_name, avatar_url, supported_team_id")
      .eq("id", user.id)
      .single(),
    supabase.from("competitions").select("features").eq("id", compId).single() as unknown as Promise<{ data: { features: Record<string, boolean> | null } | null }>,
    supabase.from("teams").select("id, name, short_name, colour, logo_url").eq("competition_id", compId).order("name"),
  ]);

  const showSupportedTeam = compFeatures?.features?.show_supported_team === true;

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* ── Dark header ──────────────────────────────────────────────── */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Account details
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            My Profile<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
      </section>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        initialFirstName={profile?.first_name ?? ""}
        initialLastName={profile?.last_name ?? ""}
        initialDisplayName={profile?.display_name?.trim() || null}
        initialAvatarUrl={profile?.avatar_url ?? null}
        showSupportedTeam={showSupportedTeam}
        initialSupportedTeamId={profile?.supported_team_id ?? null}
        teams={showSupportedTeam ? (teams ?? []) : []}
      />
    </div>
  );
}
