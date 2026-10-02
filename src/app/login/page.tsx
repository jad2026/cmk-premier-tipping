"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/authErrors";
import PasswordToggle from "@/components/PasswordToggle";
import { BrandMark } from "@/components/CompetitionBrand";
import {
  isBiometricAvailable,
  hasStoredCredentials,
  storeCredentials,
  getCredentialsWithBiometric,
} from "@/lib/native/biometrics";

// Only same-site relative paths; "//" and "/\\" would leave the site.
function safeRelativePath(path: string | null): string | null {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : null;
}

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
  const searchParams = useSearchParams();
  const redirectTo = safeRelativePath(searchParams.get("redirect"));
  const safeNext = safeRelativePath(searchParams.get("next"));
  const supabase = createClient();
  const siteName = useSiteName();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // /auth/callback sends users here with ?error=auth when a link can't be exchanged for a session.
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") ? "That sign-in link is invalid or has expired. Please sign in with your email and password, or request a new link." : null
  );
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const BIOMETRIC_SERVER = "clubrugbytipping.com";

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      if (!available) return;
      const stored = await hasStoredCredentials(BIOMETRIC_SERVER);
      if (stored) setBiometricReady(true);
    })();
  }, []);

  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true);
    setError(null);
    const creds = await getCredentialsWithBiometric(BIOMETRIC_SERVER);
    if (!creds) {
      setBiometricLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: creds.username,
      password: creds.password,
    });
    if (error) {
      setBiometricLoading(false);
      setError(friendlyAuthError(error));
    } else {
      window.location.href = safeNext || redirectTo || "/tips";
    }
  }, [supabase, safeNext, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedEmail = email.trim();
    const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    if (error) {
      setLoading(false);
      setError(friendlyAuthError(error));
    } else {
      const bioAvailable = await isBiometricAvailable();
      const bioStored = await hasStoredCredentials(BIOMETRIC_SERVER);
      if (bioAvailable && !bioStored) {
        setShowBiometricPrompt(true);
        setLoading(false);
        return;
      }
      if (bioAvailable && bioStored) {
        await storeCredentials(BIOMETRIC_SERVER, trimmedEmail, password);
      }
      window.location.href = safeNext || redirectTo || "/tips";
    }
  }

  async function handleBiometricPromptResponse(accepted: boolean) {
    setShowBiometricPrompt(false);
    if (accepted) {
      await storeCredentials(BIOMETRIC_SERVER, email.trim(), password);
    }
    window.location.href = safeNext || redirectTo || "/tips";
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
      setError(friendlyAuthError(error));
    } else {
      setResetSent(true);
    }
  }

  return (
    <div
      className="auth-page-bg -mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", background: "#F2F0EA", minHeight: "100vh" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "40px 36px" }}>
          {/* Wordmark */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <BrandMark />
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

          {biometricReady && (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                style={{
                  width: "100%",
                  background: "#11151C",
                  color: "#fff",
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 16,
                  textTransform: "uppercase" as const,
                  letterSpacing: ".04em",
                  border: "none",
                  cursor: biometricLoading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  opacity: biometricLoading ? 0.7 : 1,
                  transition: "opacity .15s",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
                  <circle cx="12" cy="15" r="1.5" fill="currentColor" />
                </svg>
                {biometricLoading ? "Verifying…" : "Sign in with Face ID"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 0" }}>
                <div style={{ flex: 1, height: 1, background: "#E4E1D8" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#8B8676", textTransform: "uppercase" as const, letterSpacing: ".1em" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "#E4E1D8" }} />
              </div>
            </div>
          )}

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

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "#8B8676" }}>
            No account?{" "}
            <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      {showBiometricPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 18, padding: "32px 28px", maxWidth: 360, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#11151C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
                <circle cx="12" cy="15" r="1.5" fill="#11151C" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#11151C", margin: "0 0 8px" }}>
              Use Face ID to sign in?
            </h2>
            <p style={{ fontSize: 14, color: "#8B8676", margin: "0 0 24px", lineHeight: 1.5 }}>
              Sign in instantly next time using Face ID. Your credentials are stored securely on this device.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleBiometricPromptResponse(false)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid #E4E1D8",
                  background: "#fff",
                  color: "#11151C",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Not now
              </button>
              <button
                onClick={() => handleBiometricPromptResponse(true)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--accent-text, #11151C)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Enable Face ID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
