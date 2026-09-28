"use client";

import { useEffect, useState } from "react";

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: "var(--accent)",
  color: "var(--accent-text, #11151C)",
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
  lineHeight: 1,
  transition: "opacity .15s",
};

// Square icon-only variant for tight rows (e.g. Manage Leagues).
const compactStyle: React.CSSProperties = {
  ...btnStyle,
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: 8,
};

const svgProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ICONS = {
  share: (
    <svg {...svgProps}>
      <path d="M8 10V2M5 5l3-3 3 3" />
      <path d="M4 7H3v7h10V7h-1" />
    </svg>
  ),
  whatsapp: (
    <svg {...svgProps}>
      <path d="M2.5 13.5l.9-2.6A5.5 5.5 0 1 1 5.6 13l-3.1.5z" />
      <path d="M6 6.2c.2 1.6 1.9 3.3 3.6 3.6l.8-.9-1.2-.6-.5.5c-.7-.3-1.2-.9-1.5-1.5l.5-.5-.6-1.2-1.1.6z" />
    </svg>
  ),
  email: (
    <svg {...svgProps}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 4.5L8 8.5l5.5-4" />
    </svg>
  ),
  link: (
    <svg {...svgProps}>
      <path d="M6.5 9.5l3-3" />
      <path d="M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" />
    </svg>
  ),
  check: (
    <svg {...svgProps}>
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  ),
};

export default function ShareInviteButton({
  leagueName,
  inviteCode,
  siteName = "Club Rugby Tipping",
  compact = false,
}: {
  leagueName: string;
  inviteCode: string;
  siteName?: string;
  compact?: boolean;
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
  const message = `${text} ${url}`;

  async function handleShare() {
    try {
      // URL goes inside text: Apple share targets drop text when a url field is present.
      await navigator.share({ title: leagueName, text: message });
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

  const style = compact ? compactStyle : btnStyle;
  // Compact buttons are icon-only; the label moves to a tooltip + aria-label.
  const a11y = (label: string) => (compact ? { title: label, "aria-label": label } : {});
  const label = (text: string) => (compact ? null : <span>{text}</span>);

  const copyLabel = copied ? "Copied!" : "Copy link";

  return (
    <span style={{ display: "inline-flex", gap: compact ? 6 : 8, flexWrap: "wrap" }}>
      {canShare && (
        <button type="button" onClick={handleShare} style={style} {...a11y("Share invite")}>
          {ICONS.share}
          {label("Share")}
        </button>
      )}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        {...a11y("Share on WhatsApp")}
      >
        {ICONS.whatsapp}
        {label("WhatsApp")}
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(`Join my tipping league: ${leagueName}`)}&body=${encodeURIComponent(message)}`}
        style={style}
        {...a11y("Share by email")}
      >
        {ICONS.email}
        {label("Email")}
      </a>
      {!canShare && (
        <button type="button" onClick={handleCopy} style={style} {...a11y(copyLabel)}>
          {copied ? ICONS.check : ICONS.link}
          {label(copyLabel)}
        </button>
      )}
    </span>
  );
}
