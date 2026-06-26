import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { fetchLeagueLeaderboard } from "../actions";

export const dynamic = "force-dynamic";

function displayName(entry: { display_name: string | null; first_name: string | null; last_name: string | null }) {
  if (entry.display_name) return entry.display_name;
  const parts = [entry.first_name, entry.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown";
}

export default async function LeagueLeaderboardPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const compId = await getCurrentCompetitionId();
  const { league, entries } = await fetchLeagueLeaderboard(params.id, compId);

  if (!league) {
    return (
      <div
        className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      >
        <section style={{ background: "#0B0E13", color: "#fff" }}>
          <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
            <h1 className="font-display uppercase" style={{ fontSize: 48, lineHeight: 0.86, margin: 0 }}>
              League Not Found<span style={{ color: "var(--accent)" }}>.</span>
            </h1>
          </div>
        </section>
        <section style={{ background: "#F2F0EA" }}>
          <div className="mx-auto" style={{ maxWidth: 700, padding: "40px 32px", textAlign: "center" }}>
            <Link
              href="/leagues"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--accent)", color: "var(--accent-text, #11151C)",
                padding: "12px 24px", borderRadius: 12, fontWeight: 800, fontSize: 14,
                textTransform: "uppercase", letterSpacing: ".04em", textDecoration: "none",
              }}
            >
              ← Back to Leagues
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const noRoundsPlayed = entries.length > 0 && entries.every((e) => e.total === 0);

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Dark header */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              League leaderboard
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="font-display uppercase"
                style={{ fontSize: 48, lineHeight: 0.86, margin: 0 }}
              >
                {league.name}<span style={{ color: "var(--accent)" }}>.</span>
              </h1>
              <p style={{ fontSize: 13, color: "#C7CCD4", marginTop: 12 }}>
                Invite code: <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#fff" }}>{league.invite_code}</span>
              </p>
            </div>
            <Link
              href="/leagues"
              style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}
            >
              ← All Leagues
            </Link>
          </div>
        </div>
      </section>

      {/* Table */}
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 700, padding: "28px 32px 60px" }}>
          <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, overflow: "hidden" }}>
            {noRoundsPlayed && (
              <div style={{ margin: "20px 24px 0", borderRadius: 12, background: "rgba(217,165,33,.06)", border: "1px solid rgba(217,165,33,.2)", padding: "12px 16px" }}>
                <p style={{ fontSize: 14, color: "#8B6F1A", margin: 0 }}>
                  No rounds played yet — scores will appear here once the first round is complete.
                </p>
              </div>
            )}

            {entries.length === 0 ? (
              <p style={{ fontSize: 14, color: "#8B8676", textAlign: "center", padding: "40px 24px" }}>No members yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                {/* Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "46px 1fr 72px 64px 56px",
                  padding: "12px 20px",
                  background: "#0D1016",
                  color: "#8B8E94",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}>
                  <span>#</span>
                  <span>Player</span>
                  <span style={{ textAlign: "right" }}>Correct</span>
                  <span style={{ textAlign: "right" }}>Picked</span>
                  <span style={{ textAlign: "right" }}>%</span>
                </div>

                {entries.map((entry, i) => {
                  const pct = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
                  const isYou = entry.user_id === user.id;
                  return (
                    <div
                      key={entry.user_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "46px 1fr 72px 64px 56px",
                        padding: "12px 20px",
                        alignItems: "center",
                        borderTop: i > 0 ? "1px solid #EFEDE6" : "none",
                        background: isYou ? "var(--accent-wash, rgba(217,165,33,.08))" : "transparent",
                        borderLeft: isYou ? "3px solid var(--accent)" : "3px solid transparent",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#8B8676" }}>
                        {i === 0 && entry.total > 0 ? "🏆" : i + 1}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#11151C" }}>
                        {displayName(entry)}
                        {isYou && (
                          <span style={{
                            marginLeft: 8, fontSize: 10, fontWeight: 800,
                            textTransform: "uppercase", letterSpacing: ".08em",
                            background: "var(--accent)", color: "var(--accent-text, #11151C)",
                            padding: "2px 7px", borderRadius: 4,
                          }}>
                            You
                          </span>
                        )}
                      </span>
                      <span style={{ textAlign: "right", fontSize: 14, fontWeight: 800, color: "#11151C", fontVariantNumeric: "tabular-nums" }}>{entry.correct}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: "#8B8676", fontVariantNumeric: "tabular-nums" }}>{entry.total}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: "#8B8676", fontVariantNumeric: "tabular-nums" }}>
                        {entry.total > 0 ? `${pct}%` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
