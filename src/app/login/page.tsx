"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { autoEnrollCurrentCompetition } from "@/app/competition-actions";

const REVIEW_EMAIL = "review@clubrugbytipping.com";

function useSiteName() {
  const [name, setName] = useState("Club Rugby Tipping");
  useEffect(() => {
    if (document.documentElement.classList.contains("theme-npc")) setName("Club Rugby Tipping");
  }, []);
  return name;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E4E1D8",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 15,
  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
  background: "#fff",
  color: "#11151C",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "#8B8676",
  marginBottom: 6,
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const supabase = createClient();
  const siteName = useSiteName();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const isReviewAccount = email.trim().toLowerCase() === REVIEW_EMAIL;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isReviewAccount) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setLoading(false);
        setError(error.message);
      } else {
        if (data.user) {
          autoEnrollCurrentCompetition(data.user.id).catch(() => {});
        }
        window.location.href = redirectTo || "/tips";
      }
    } else {
      const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo || "/tips")}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectUrl },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setMagicLinkSent(true);
      }
    }
  }

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", background: "#F2F0EA", minHeight: "100vh" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "40px 36px" }}>
          {/* Wordmark */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="9" fill="var(--accent)" />
                <path d="M7 9.5L8.5 11L11.5 7.5" stroke="var(--accent-text, #11151C)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-display" style={{ fontSize: 15, letterSpacing: ".06em", textTransform: "uppercase", color: "#11151C" }}>
                {siteName}
              </span>
            </div>
            <h1
              className="font-display uppercase"
              style={{ fontSize: 32, lineHeight: 0.9, margin: 0, color: "#11151C" }}
            >
              Sign In<span style={{ color: "var(--accent)" }}>.</span>
            </h1>
          </div>

          {magicLinkSent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>✉️</span>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#11151C", margin: "0 0 8px" }}>Check your email</h2>
              <p style={{ fontSize: 15, color: "#8B8676", margin: 0, lineHeight: 1.5 }}>
                We sent a sign-in link to <strong style={{ color: "#11151C" }}>{email}</strong>. Click the link in the email to sign in.
              </p>
              <button
                type="button"
                onClick={() => { setMagicLinkSent(false); setError(null); }}
                style={{ marginTop: 24, fontSize: 14, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="you@example.com"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>

                {isReviewAccount && (
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                )}

                {error && (
                  <div style={{ borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
                    <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: "var(--accent)",
                    color: "var(--accent-text, #11151C)",
                    padding: "14px 28px",
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 16,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    border: "none",
                    cursor: loading ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: loading ? 0.7 : 1,
                    transition: "opacity .15s",
                    marginTop: 4,
                  }}
                >
                  {loading ? (
                    <>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          border: "2px solid rgba(255,255,255,.3)",
                          borderTopColor: "#fff",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      {isReviewAccount ? "Signing in…" : "Sending link…"}
                    </>
                  ) : isReviewAccount ? "Sign In" : "Send Sign-In Link"}
                </button>
              </form>

              {!isReviewAccount && (
                <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#AEB4BE" }}>
                  No password needed — we&apos;ll email you a sign-in link.
                </p>
              )}

              <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "#8B8676" }}>
                No account?{" "}
                <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                  Sign up free
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
