"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISSED_AT_KEY = "push_prompt_dismissed_at";
const DISMISS_COUNT_KEY = "push_prompt_dismiss_count";

/** Key used by the post-save prompt in TipsForm — treated as a permanent no. */
const LEGACY_DISMISSED_KEY = "notification_prompt_dismissed";

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS = 3;

function readCount(): number {
  const raw = localStorage.getItem(DISMISS_COUNT_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Decides whether the opt-in prompt is due, from localStorage alone. The
 * "already subscribed" case is handled by the server, which only renders this
 * component when the user has no row in push_subscriptions.
 */
function isPromptDue(): boolean {
  try {
    if (localStorage.getItem(LEGACY_DISMISSED_KEY) === "true") return false;
    if (readCount() >= MAX_DISMISSALS) return false;

    const dismissedAt = localStorage.getItem(DISMISSED_AT_KEY);
    if (dismissedAt) {
      const ts = parseInt(dismissedAt, 10);
      if (!Number.isNaN(ts) && Date.now() - ts < SNOOZE_MS) return false;
    }
    return true;
  } catch {
    // Private mode or storage disabled — don't nag if we can't remember a no.
    return false;
  }
}

export default function PushPromptBanner({
  competitionId,
}: {
  competitionId: string;
}) {
  const pathname = usePathname();
  const { status, busy, subscribe } = usePushNotifications(competitionId);
  const [due, setDue] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // localStorage is only readable after mount, so the banner starts hidden.
  useEffect(() => {
    setDue(isPromptDue());
  }, []);

  // The hook reports "subscribed" once the browser subscription is saved.
  useEffect(() => {
    if (status === "subscribed") setEnabled(true);
  }, [status]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
      localStorage.setItem(DISMISS_COUNT_KEY, String(readCount() + 1));
    } catch {
      // Ignore — the banner still closes for this session.
    }
    setDue(false);
  }

  if (!due || enabled) return null;
  // Only prompt when there is something to opt into.
  if (status !== "unsubscribed") return null;
  // TipsForm runs its own, better-timed prompt after a user saves their tips.
  if (pathname === "/tips") return null;

  return (
    <div
      role="dialog"
      aria-label="Turn on notifications"
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
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="hidden sm:block shrink-0"
            style={{
              width: 24,
              height: 3,
              borderRadius: 2,
              background: "var(--accent)",
            }}
          />
          <div className="min-w-0 text-center sm:text-left">
            <div
              className="font-display uppercase"
              style={{ fontSize: 15, color: "#fff", lineHeight: 1.2 }}
            >
              Want reminders before tips close?
            </div>
            <div style={{ fontSize: 13, color: "#8C93A0", marginTop: 2 }}>
              Turn on notifications
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => subscribe()}
            disabled={busy}
            className="font-display uppercase"
            style={{
              padding: "9px 20px",
              borderRadius: 9,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-text)",
              fontSize: 13,
              letterSpacing: ".04em",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Enabling…" : "Enable"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,.14)",
              background: "transparent",
              color: "#8C93A0",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
