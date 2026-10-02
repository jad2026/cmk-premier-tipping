import { Capacitor } from "@capacitor/core";

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Capacitor.isPluginAvailable("NativeBiometric")) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function hasStoredCredentials(server: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Capacitor.isPluginAvailable("NativeBiometric")) return false;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const creds = await NativeBiometric.getCredentials({ server });
    return !!creds.username;
  } catch {
    return false;
  }
}

export async function storeCredentials(server: string, username: string, password: string): Promise<void> {
  const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
  await NativeBiometric.setCredentials({ server, username, password });
}

export async function getCredentialsWithBiometric(server: string): Promise<{ username: string; password: string } | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason: "Sign in to Club Rugby Tipping",
      title: "Sign In",
    });
    const creds = await NativeBiometric.getCredentials({ server });
    return { username: creds.username, password: creds.password };
  } catch {
    return null;
  }
}

export async function deleteStoredCredentials(server: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.deleteCredentials({ server });
  } catch {
    // Credentials may not exist — ignore
  }
}
