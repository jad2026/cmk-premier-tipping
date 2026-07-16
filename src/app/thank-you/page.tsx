"use client";

import { useEffect } from "react";
import Link from "next/link";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function ThankYouPage() {
  useEffect(() => {
    if (window.fbq) {
      window.fbq("track", "CompleteRegistration");
    }
  }, []);

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        background: "#F2F0EA",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "40px 16px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            background: "#fff",
            border: "1px solid #E4E1D8",
            borderRadius: 18,
            padding: "40px 36px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="var(--accent-text, #11151C)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1
            className="font-display uppercase"
            style={{
              fontSize: 28,
              lineHeight: 1,
              margin: "0 0 12px",
              color: "#11151C",
            }}
          >
            You&apos;re In<span style={{ color: "var(--accent)" }}>.</span>
          </h1>

          <p
            style={{
              fontSize: 15,
              color: "#8B8676",
              lineHeight: 1.5,
              margin: "0 0 32px",
            }}
          >
            Your account has been created. Time to pick some winners.
          </p>

          <Link
            href="/tips"
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "var(--accent-text, #11151C)",
              padding: "14px 36px",
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: ".04em",
              textDecoration: "none",
            }}
          >
            Start Tipping
          </Link>
        </div>
      </div>
    </div>
  );
}
