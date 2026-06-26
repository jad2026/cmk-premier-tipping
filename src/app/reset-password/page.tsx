"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

const btnStyle: React.CSSProperties = {
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
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "opacity .15s",
  textDecoration: "none",
};

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", background: "#F2F0EA", minHeight: "100vh" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "40px 36px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="9" fill="var(--accent)" />
        <path d="M7 9.5L8.5 11L11.5 7.5" stroke="var(--accent-text, #11151C)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display" style={{ fontSize: 15, letterSpacing: ".06em", textTransform: "uppercase", color: "#11151C" }}>
        Club Rugby Tipping
      </span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSessionReady(true);
      } else {
        setError("This reset link is invalid or has expired. Please request a new one.");
      }
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/tips"), 2500);
    }
  }

  if (done) {
    return (
      <CardShell>
        <div style={{ textAlign: "center" }}>
          <Wordmark />
          <h1 className="font-display uppercase" style={{ fontSize: 28, lineHeight: 0.9, margin: "0 0 20px", color: "#11151C" }}>
            Password Updated<span style={{ color: "var(--accent)" }}>!</span>
          </h1>
          <p style={{ fontSize: 14, color: "#5A6371", marginBottom: 16 }}>
            Your password has been changed. Redirecting you to your tips…
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span style={{ width: 20, height: 20, border: "2px solid #E4E1D8", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
          <Link href="/tips" style={btnStyle}>
            Go to Tips Now
          </Link>
        </div>
      </CardShell>
    );
  }

  if (!sessionReady && error) {
    return (
      <CardShell>
        <div style={{ textAlign: "center" }}>
          <Wordmark />
          <h1 className="font-display uppercase" style={{ fontSize: 28, lineHeight: 0.9, margin: "0 0 20px", color: "#11151C" }}>
            Link Expired<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p style={{ fontSize: 14, color: "#5A6371", marginBottom: 24 }}>{error}</p>
          <Link href="/forgot-password" style={btnStyle}>
            Request a New Link
          </Link>
        </div>
      </CardShell>
    );
  }

  if (!sessionReady) {
    return (
      <CardShell>
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <span style={{ width: 24, height: 24, border: "2px solid #E4E1D8", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Wordmark />
        <h1 className="font-display uppercase" style={{ fontSize: 28, lineHeight: 0.9, margin: 0, color: "#11151C" }}>
          New Password<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>New Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            style={inputStyle}
            autoFocus
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        <div>
          <label style={labelStyle}>Confirm Password</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your new password"
            style={{
              ...inputStyle,
              borderColor: confirm ? (confirm === password ? "#4ADE80" : "#FCA5A5") : "#E4E1D8",
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
          />
          {confirm && confirm !== password && (
            <p style={{ fontSize: 12, color: "#B23A48", marginTop: 6 }}>Passwords don&apos;t match</p>
          )}
          {confirm && confirm === password && (
            <p style={{ fontSize: 12, color: "#1F9E5A", marginTop: 6 }}>Passwords match</p>
          )}
        </div>

        {error && (
          <div style={{ borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
            <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password || password !== confirm}
          style={{ ...btnStyle, opacity: (loading || !password || password !== confirm) ? 0.5 : 1, cursor: loading ? "wait" : "pointer", marginTop: 4 }}
        >
          {loading ? (
            <>
              <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Updating…
            </>
          ) : "Update Password"}
        </button>
      </form>
    </CardShell>
  );
}
