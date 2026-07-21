import type { SupabaseClient } from "@supabase/supabase-js";

export async function initPushNotifications(
  supabase: SupabaseClient,
  userId: string,
) {
  const { Capacitor } = await import("@capacitor/core").catch(() => ({ Capacitor: null }));
  if (!Capacitor?.isNativePlatform()) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    const { error } = await supabase.from("push_tokens").upsert(
      { user_id: userId, token: token.value, platform: "ios" },
      { onConflict: "user_id,token" },
    );
    if (error) console.error("Failed to save push token:", error);
  });

  PushNotifications.addListener("registrationError", (error) => {
    console.error("Push registration failed:", error);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push received in foreground:", notification);
  });

  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      console.log("Push notification tapped:", action);
    },
  );
}
