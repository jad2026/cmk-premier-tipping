"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DISMISSED_KEY = "signup-banner-dismissed";

export default function SignupBanner({ siteName }: { siteName: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(DISMISSED_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "#0B0E13",
        borderTop: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <div
        className="mx-auto flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4"
        style={{ maxWidth: 1100, padding: "14px 24px" }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            textAlign: "center",
          }}
        >
          Join {siteName} — Pick the winners. Top the table.
        </span>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/login"
            style={{
              padding: "8px 20px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,.2)",
              background: "transparent",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".04em",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            style={{
              padding: "8px 20px",
              borderRadius: 9,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-text, #11151C)",
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".04em",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Sign Up Free
          </Link>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,.4)",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}
