"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5c0 4-1.5 5.5-1.5 5.5h12s-1.5-1.5-1.5-5.5A4.5 4.5 0 0 0 10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
      <path
        d="M8.5 16a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active && (
        <circle cx="15" cy="5" r="2.6" fill="var(--accent)" stroke="#0D1016" strokeWidth="1.4" />
      )}
    </svg>
  );
}

export default function PushNotificationToggle({ competitionId }: { competitionId: string }) {
  const { status, busy, subscribe, unsubscribe } = usePushNotifications(competitionId);

  console.log("[PushNotificationToggle] mounted, status:", status, "competitionId:", competitionId);

  const baseClasses =
    "flex items-center justify-center w-11 h-11 rounded-[9px] transition-all duration-150 outline-none";

  // Nothing useful to show if the browser can't do push at all.
  if (status === "unsupported") return null;

  if (status === "loading") {
    return (
      <button
        type="button"
        disabled
        aria-label="Checking notification support…"
        className={`${baseClasses} opacity-40 cursor-default text-[#99A0AC]`}
      >
        <BellIcon active={false} />
      </button>
    );
  }

  const isSubscribed = status === "subscribed";
  const isDenied = status === "denied";

  const label = isDenied
    ? "Notifications blocked in browser settings"
    : isSubscribed
      ? "Notifications on — click to turn off"
      : "Enable notifications";

  if (isDenied) {
    return (
      <button
        type="button"
        disabled
        title={label}
        aria-label={label}
        className={`${baseClasses} cursor-not-allowed opacity-40 text-[#99A0AC]`}
      >
        <BellIcon active={false} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={busy}
      title={label}
      aria-label={label}
      aria-pressed={isSubscribed}
      className={`${baseClasses} ${busy ? "opacity-60 cursor-wait" : "hover:bg-white/[.06]"}`}
      style={{ color: isSubscribed ? "var(--accent)" : "#99A0AC" }}
    >
      <BellIcon active={isSubscribed} />
    </button>
  );
}
