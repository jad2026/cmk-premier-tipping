import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import JoinLeagueButton from "./JoinLeagueButton";

export default async function JoinLeaguePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, invite_code")
    .eq("invite_code", code.toUpperCase())
    .single();

  if (!league) {
    return (
      <div
        className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", background: "#F2F0EA", minHeight: "100vh" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 16px" }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "40px 36px", textAlign: "center" }}>
            <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>🏉</span>
            <h1 className="font-display uppercase" style={{ fontSize: 24, margin: "0 0 12px", color: "#11151C" }}>
              League Not Found
            </h1>
            <p style={{ fontSize: 15, color: "#8B8676", lineHeight: 1.5, margin: "0 0 24px" }}>
              We couldn&apos;t find a league with that invite code. Check the code and try again.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                background: "var(--accent)",
                color: "var(--accent-text, #11151C)",
                padding: "12px 28px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: ".04em",
                textDecoration: "none",
              }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [{ data: logos }, { count: memberCount }, { data: { user } }] = await Promise.all([
    supabase
      .from("league_sponsor_logos")
      .select("id, name, logo_url, display_order")
      .eq("league_id", league.id)
      .order("display_order"),
    supabase
      .from("league_members")
      .select("league_id", { count: "exact", head: true })
      .eq("league_id", league.id),
    supabase.auth.getUser(),
  ]);

  if (user) {
    const { data: membership } = await supabase
      .from("league_members")
      .select("league_id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .single();

    if (membership) {
      redirect("/leaderboard");
    }
  }

  const sponsorLogos = (logos ?? []) as { id: string; name: string; logo_url: string; display_order: number }[];

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", background: "#F2F0EA", minHeight: "100vh" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 440, overflow: "hidden", borderRadius: 18, border: "1px solid #E4E1D8" }}>

          {/* Dark header */}
          <div style={{ background: "#0B0E13", padding: "32px 32px 28px", textAlign: "center" }}>
            <p
              className="font-display"
              style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}
            >
              Club Rugby Tipping
            </p>
            <h1
              className="font-display uppercase"
              style={{ margin: "0 0 14px", fontSize: 26, lineHeight: 1, color: "#FFFFFF" }}
            >
              Join League<span style={{ color: "#2C9FD4" }}>.</span>
            </h1>
            <div style={{ width: 40, height: 3, background: "#2C9FD4", borderRadius: 2, margin: "0 auto" }} />
          </div>

          {/* Sponsor logos */}
          {sponsorLogos.length > 0 && (
            <div style={{ background: "#FFFFFF", padding: "20px 32px", textAlign: "center", borderBottom: "1px solid #E4E1D8" }}>
              <p style={{ margin: "0 0 14px", fontSize: 9, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#999999" }}>
                Proudly supported by
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                {sponsorLogos.map((logo, i) => (
                  <span key={logo.id} style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                    {i > 0 && (
                      <span style={{ color: "rgba(139,134,118,0.4)", fontSize: 12 }}>x</span>
                    )}
                    <span style={{ background: "#fff", borderRadius: 8, padding: "8px 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #F0EDE6" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.logo_url}
                        alt={logo.name}
                        style={{ display: "block", maxHeight: 60, maxWidth: 140, objectFit: "contain" }}
                      />
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* League info + CTA */}
          <div style={{ background: "#FFFFFF", padding: "32px 36px", textAlign: "center" }}>
            <h2
              className="font-display uppercase"
              style={{ fontSize: 22, lineHeight: 1.1, margin: "0 0 8px", color: "#11151C" }}
            >
              {league.name}
            </h2>
            <p style={{ fontSize: 13, color: "#8B8676", margin: "0 0 28px" }}>
              {memberCount ?? 0} member{(memberCount ?? 0) !== 1 ? "s" : ""}
            </p>

            {user ? (
              <JoinLeagueButton leagueId={league.id} />
            ) : (
              <>
                <Link
                  href={`/signup?redirect=/join/${code}`}
                  style={{
                    display: "block",
                    width: "100%",
                    background: "#2C9FD4",
                    color: "#FFFFFF",
                    padding: "14px 28px",
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 16,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    textDecoration: "none",
                    textAlign: "center",
                    fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
                  }}
                >
                  Sign Up to Join
                </Link>
                <p style={{ fontSize: 13, color: "#8B8676", marginTop: 16 }}>
                  Already have an account?{" "}
                  <Link href={`/login?redirect=/join/${code}`} style={{ color: "#2C9FD4", fontWeight: 700, textDecoration: "none" }}>
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
