"use client";

import { useState } from "react";
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

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <CardShell>
        <div style={{ textAlign: "center" }}>
          <Wordmark />
          <h1
            className="font-display uppercase"
            style={{ fontSize: 28, lineHeight: 0.9, margin: "0 0 20px", color: "#11151C" }}
          >
            Check Your Email<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p style={{ fontSize: 14, color: "#5A6371", lineHeight: 1.6, marginBottom: 8 }}>
            We sent a password reset link to{" "}
            <strong style={{ color: "#11151C" }}>{email}</strong>.<br />
            Click the link in that email to choose a new password.
          </p>
          <p style={{ fontSize: 12, color: "#8B8676", marginBottom: 24 }}>
            Didn&apos;t receive it? Check your spam folder or{" "}
            <button
              onClick={() => setDone(false)}
              style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", fontSize: 12, padding: 0 }}
            >
              try again
            </button>.
          </p>
          <Link href="/login" style={btnStyle}>
            Back to Sign In
          </Link>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Wordmark />
        <h1
          className="font-display uppercase"
          style={{ fontSize: 28, lineHeight: 0.9, margin: 0, color: "#11151C" }}
        >
          Reset Password<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
      </div>

      <p style={{ fontSize: 14, color: "#5A6371", marginBottom: 20, lineHeight: 1.5 }}>
        Enter the email address you signed up with and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
            autoFocus
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {error && (
          <div style={{ borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
            <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ ...btnStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer", marginTop: 4 }}
        >
          {loading ? (
            <>
              <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Sending…
            </>
          ) : "Send Reset Link"}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "#8B8676" }}>
        Remember it?{" "}
        <Link href="/login" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
          Back to sign in
        </Link>
      </p>
    </CardShell>
  );
}
