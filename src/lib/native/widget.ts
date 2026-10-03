import { Capacitor, registerPlugin } from "@capacitor/core";

interface WidgetBridgePlugin {
  saveToken(opts: { token: string }): Promise<void>;
  getToken(): Promise<{ token: string | null }>;
  clearToken(): Promise<void>;
  reloadTimelines(): Promise<void>;
}

function available(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios" &&
    Capacitor.isPluginAvailable("WidgetBridge")
  );
}

let _plugin: WidgetBridgePlugin | null = null;

function plugin(): WidgetBridgePlugin {
  if (!_plugin) _plugin = registerPlugin<WidgetBridgePlugin>("WidgetBridge");
  return _plugin;
}

export async function saveWidgetToken(token: string): Promise<void> {
  if (!available()) return;
  await plugin().saveToken({ token });
}

export async function getWidgetToken(): Promise<string | null> {
  if (!available()) return null;
  const result = await plugin().getToken();
  return result.token;
}

export async function clearWidgetToken(): Promise<void> {
  if (!available()) return;
  await plugin().clearToken();
}

export async function reloadWidgetTimelines(): Promise<void> {
  if (!available()) return;
  await plugin().reloadTimelines();
}

export async function ensureWidgetToken(): Promise<void> {
  if (!available()) return;
  try {
    const existing = await plugin().getToken();
    if (existing.token) return;

    const res = await fetch("/api/widget/token", { method: "POST" });
    if (!res.ok) return;
    const { token } = await res.json();
    await plugin().saveToken({ token });
    await plugin().reloadTimelines();
  } catch {
    // Non-critical — widget shows logged-out state
  }
}
