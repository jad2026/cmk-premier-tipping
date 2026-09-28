"use client";

import { useEffect, useState } from "react";

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: "var(--accent)",
  color: "var(--accent-text, #11151C)",
  padding: "8px 14px",
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "opacity .15s",
};

export default function ShareInviteButton({
  leagueName,
  inviteCode,
  siteName = "Club Rugby Tipping",
}: {
  leagueName: string;
  inviteCode: string;
  siteName?: string;
}) {
  // Resolved after mount so server and client render the same markup.
  const [origin, setOrigin] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);

  const url = `${origin}/join/${encodeURIComponent(inviteCode)}`;
  const text = `Join my league "${leagueName}" on ${siteName} 🏉`;

  async function handleShare() {
    try {
      await navigator.share({ title: leagueName, text, url });
    } catch {
      // User cancelled the share sheet, or sharing failed; nothing to do.
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context).
    }
  }

  if (canShare) {
    return (
      <button type="button" onClick={handleShare} style={btnStyle}>
        Share invite
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={handleCopy} style={btnStyle}>
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={btnStyle}
      >
        WhatsApp
      </a>
    </span>
  );
}
