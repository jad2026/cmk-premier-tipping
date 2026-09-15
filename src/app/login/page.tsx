"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PasswordToggle from "@/components/PasswordToggle";

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

/* ── OAuth (Google / Apple) ── */
type OAuthProvider = "google" | "apple";

const oauthButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #E4E1D8",
  background: "#fff",
  color: "#11151C",
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
  cursor: "pointer",
  transition: "border-color .15s, background .15s, opacity .15s",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.73c-.02-2.36 1.93-3.5 2.02-3.55-1.1-1.61-2.81-1.83-3.42-1.85-1.45-.15-2.84.86-3.58.86-.74 0-1.88-.84-3.09-.82-1.59.02-3.05.93-3.87 2.35-1.65 2.86-.42 7.1 1.19 9.42.79 1.14 1.72 2.42 2.95 2.37 1.19-.05 1.64-.77 3.07-.77s1.84.77 3.09.75c1.28-.02 2.09-1.16 2.87-2.3.9-1.32 1.28-2.6 1.3-2.66-.03-.01-2.5-.96-2.53-3.8zM14.02 5.8c.65-.79 1.09-1.89.97-2.99-.94.04-2.08.63-2.75 1.42-.6.7-1.13 1.82-.99 2.89 1.05.08 2.12-.53 2.77-1.32z" />
    </svg>
  );
}

/** "Or continue with" divider + Google / Apple sign-in buttons.
 *  Both providers redirect back through /auth/callback, which exchanges the
 *  code for a session and forwards to `next`. */
function OAuthButtons({ next }: { next?: string | null }) {
  const supabase = createClient();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setPending(null);
      setError(error.message);
    }
    // On success the browser navigates away to the provider.
  }

  const hover = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    e.currentTarget.style.borderColor = on ? "#C9C5B8" : "#E4E1D8";
    e.currentTarget.style.background = on ? "#F9F8F5" : "#fff";
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ flex: 1, height: 1, background: "#E4E1D8" }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8B8676" }}>
          Or continue with
        </span>
        <span style={{ flex: 1, height: 1, background: "#E4E1D8" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={() => signInWith("google")}
          disabled={pending !== null}
          style={{ ...oauthButtonStyle, opacity: pending && pending !== "google" ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}
          onMouseEnter={(e) => hover(e, true)}
          onMouseLeave={(e) => hover(e, false)}
        >
          <GoogleIcon />
          {pending === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
        <button
          type="button"
          onClick={() => signInWith("apple")}
          disabled={pending !== null}
          style={{ ...oauthButtonStyle, opacity: pending && pending !== "apple" ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}
          onMouseEnter={(e) => hover(e, true)}
          onMouseLeave={(e) => hover(e, false)}
        >
          <AppleIcon />
          {pending === "apple" ? "Redirecting…" : "Continue with Apple"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
          <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const supabase = createClient();
  const siteName = useSiteName();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(error.message);
    } else {
      window.location.href = redirectTo || "/tips";
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setResetting(true);
    setError(null);
    setResetSent(false);

    const redirectUrl = `${window.location.origin}/auth/callback?type=recovery&next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    setResetting(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
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

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); setResetSent(false); }}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetting}
                  style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: resetting ? "wait" : "pointer", padding: 0 }}
                >
                  {resetting ? "Sending…" : "Forgot password?"}
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                />
                <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
            </div>

            {resetSent && (
              <div style={{ borderRadius: 12, background: "rgba(31,158,90,.06)", border: "1px solid rgba(31,158,90,.15)", padding: "12px 16px" }}>
                <p style={{ fontSize: 14, color: "#1F9E5A", margin: 0 }}>Password reset link sent — check your email.</p>
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
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>

          <OAuthButtons next={redirectTo} />

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "#8B8676" }}>
            No account?{" "}
            <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
