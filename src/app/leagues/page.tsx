import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { fetchMyLeagues } from "./actions";
import LeaguesClient from "./LeaguesClient";

export const dynamic = "force-dynamic";

export default async function LeaguesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const compId = await getCurrentCompetitionId();
  const { leagues } = await fetchMyLeagues(compId);
  const { error } = searchParams;

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Dark header */}
      <section className="page-header-bg" style={{ background: "var(--surface, #0B0E13)", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Competition
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            Leagues<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
      </section>

      {/* Content */}
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 700, padding: "28px 32px 60px" }}>
          {error === "invalid-code" && (
            <p
              role="alert"
              style={{ fontSize: 14, fontWeight: 600, color: "#B23A48", background: "#fff", border: "1px solid rgba(178,58,72,.25)", borderRadius: 12, padding: "12px 16px", margin: "0 0 20px" }}
            >
              That invite code isn&apos;t valid for this competition
            </p>
          )}
          <LeaguesClient initialLeagues={leagues} />
        </div>
      </section>
    </div>
  );
}
