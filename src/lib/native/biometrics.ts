import { Capacitor } from "@capacitor/core";

type NativeBiometricPlugin = {
  isAvailable: () => Promise<{ isAvailable: boolean }>;
  getCredentials: (opts: { server: string }) => Promise<{ username: string; password: string }>;
  setCredentials: (opts: { server: string; username: string; password: string }) => Promise<void>;
  deleteCredentials: (opts: { server: string }) => Promise<void>;
  verifyIdentity: (opts: { reason: string; title: string }) => Promise<void>;
};

let pluginRef: NativeBiometricPlugin | null = null;
let checked = false;

function loadPlugin(): NativeBiometricPlugin | null {
  if (checked) return pluginRef;
  if (!Capacitor.isNativePlatform()) { checked = true; return null; }
  if (!Capacitor.isPluginAvailable("NativeBiometric")) { checked = true; return null; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@capgo/capacitor-native-biometric");
    pluginRef = mod.NativeBiometric as NativeBiometricPlugin;
    checked = true;
    return pluginRef;
  } catch {
    checked = true;
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const plugin = loadPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function hasStoredCredentials(server: string): Promise<boolean> {
  const plugin = loadPlugin();
  if (!plugin) return false;
  try {
    const creds = await plugin.getCredentials({ server });
    return !!creds.username;
  } catch {
    return false;
  }
}

export async function getStoredUsername(server: string): Promise<string | null> {
  const plugin = loadPlugin();
  if (!plugin) return null;
  try {
    const creds = await plugin.getCredentials({ server });
    return creds.username || null;
  } catch {
    return null;
  }
}

export async function storeCredentials(server: string, username: string, password: string): Promise<void> {
  const plugin = loadPlugin();
  if (!plugin) return;
  await plugin.setCredentials({ server, username, password });
}

export async function getCredentialsWithBiometric(server: string): Promise<{ username: string; password: string } | null> {
  const plugin = loadPlugin();
  if (!plugin) return null;
  try {
    await plugin.verifyIdentity({
      reason: "Sign in to Club Rugby Tipping",
      title: "Sign In",
    });
    const creds = await plugin.getCredentials({ server });
    return { username: creds.username, password: creds.password };
  } catch {
    return null;
  }
}

export async function deleteStoredCredentials(server: string): Promise<void> {
  const plugin = loadPlugin();
  if (!plugin) return;
  try {
    await plugin.deleteCredentials({ server });
  } catch {
    // Credentials may not exist
  }
}
