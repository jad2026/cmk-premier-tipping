"use client";

import { useCallback, useEffect, useState } from "react";

export type PushStatus =
  | "loading"
  | "unsupported"
  | "denied"
  | "unsubscribed"
  | "subscribed";

const SW_PATH = "/sw-push.js";
const SW_SCOPE = "/sw-push/";

/**
 * Converts the URL-safe base64 VAPID public key into the Uint8Array
 * expected by PushManager.subscribe's applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function waitForActive(registration: ServiceWorkerRegistration): Promise<void> {
  const sw = registration.installing ?? registration.waiting ?? registration.active;
  if (sw?.state === "activated") return Promise.resolve();
  return new Promise((resolve) => {
    sw?.addEventListener("statechange", function handler() {
      if (sw.state === "activated" || sw.state === "redundant") {
        sw.removeEventListener("statechange", handler);
        resolve();
      }
    });
  });
}

export function usePushNotifications(competitionId: string) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      console.log("[usePush] init — checking support");
      if (!isPushSupported()) {
        console.log("[usePush] push not supported");
        if (!cancelled) setStatus("unsupported");
        return;
      }

      console.log("[usePush] Notification.permission:", Notification.permission);
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      try {
        console.log("[usePush] registering SW at", SW_PATH, "scope", SW_SCOPE);
        const registration = await navigator.serviceWorker.register(SW_PATH, {
          scope: SW_SCOPE,
        });
        console.log("[usePush] SW registered, waiting for activation");
        await waitForActive(registration);
        console.log("[usePush] SW active, checking existing subscription");
        const existing = await registration.pushManager.getSubscription();
        console.log("[usePush] existing subscription:", existing ? "yes" : "no");
        if (cancelled) return;

        if (existing) {
          const res = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: existing, competitionId }),
          });
          console.log("[usePush] sync existing subscription to DB:", res.status);
        }

        setStatus(existing ? "subscribed" : "unsubscribed");
      } catch (err) {
        console.error("[usePush] init failed:", err);
        if (!cancelled) {
          setStatus("unsupported");
          setError(err instanceof Error ? err.message : "Service worker registration failed");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      console.log("[usePush] VAPID key:", vapidKey ? `${vapidKey.slice(0, 8)}…` : "MISSING");
      if (!vapidKey) {
        throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
      }

      const registration = await navigator.serviceWorker.register(SW_PATH, {
        scope: SW_SCOPE,
      });
      await waitForActive(registration);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, competitionId }),
      });
      const body = await res.json().catch(() => null);
      console.log("[usePush] subscribe API response:", res.status, body);
      if (!res.ok) {
        throw new Error(`Failed to save subscription (${res.status}): ${JSON.stringify(body)}`);
      }

      setStatus("subscribed");
    } catch (err) {
      console.error("[usePush] subscribe failed:", err);
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
    } finally {
      setBusy(false);
    }
  }, [competitionId]);

  const unsubscribe = useCallback(async () => {
    if (!isPushSupported()) return;
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        // Remove from the server first so we still have the endpoint to match on.
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint, competitionId }),
        });
        await subscription.unsubscribe();
      }

      setStatus("unsubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable notifications");
    } finally {
      setBusy(false);
    }
  }, [competitionId]);

  return { status, busy, error, subscribe, unsubscribe };
}
