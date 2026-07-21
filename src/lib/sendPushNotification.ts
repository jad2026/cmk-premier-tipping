import { createClient as createAdminClient } from "@supabase/supabase-js";

interface PushPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: object;
}

export async function sendPushNotification({ userIds, title, body, data }: PushPayload) {
  if (!userIds.length) return { tokens_found: 0, sent: 0 };

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: tokens, error } = await admin
    .from("push_tokens")
    .select("user_id, token, platform")
    .in("user_id", userIds);

  if (error) {
    console.error("[sendPushNotification] query failed", error);
    return { tokens_found: 0, sent: 0 };
  }

  if (!tokens || tokens.length === 0) {
    return { tokens_found: 0, sent: 0 };
  }

  // TODO: Send via APNs once developer certificate is configured.
  // For each token, send { title, body, data } through Apple Push Notification service.
  for (const t of tokens) {
    console.log(`[sendPushNotification] Would send to ${t.platform} token ${t.token.slice(0, 12)}… for user ${t.user_id}:`, { title, body, data });
  }

  return { tokens_found: tokens.length, sent: 0 };
}
