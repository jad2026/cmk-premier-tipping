import { createClient as createAdminClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const APNS_HOST = "https://api.push.apple.com";
const APNS_TOPIC = "com.clubrugbytipping.app";

interface PushPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: object;
}

let cachedToken: { jwt: string; expires: number } | null = null;

function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedToken.expires) return cachedToken.jwt;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !privateKey) {
    throw new Error("Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_PRIVATE_KEY");
  }

  const token = jwt.sign({}, privateKey.replace(/\\n/g, "\n"), {
    algorithm: "ES256",
    header: { alg: "ES256", kid: keyId },
    issuer: teamId,
    issuedAt: now,
    expiresIn: "50m",
  });

  cachedToken = { jwt: token, expires: now + 2400 };
  return token;
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

  let apnsToken: string;
  try {
    apnsToken = getApnsJwt();
  } catch (err) {
    console.error("[sendPushNotification]", err);
    return { tokens_found: tokens.length, sent: 0 };
  }

  const apnsPayload = JSON.stringify({
    aps: { alert: { title, body }, sound: "default" },
    ...data,
  });

  let sent = 0;
  const staleTokens: string[] = [];

  await Promise.all(
    tokens.map(async (t) => {
      try {
        const res = await fetch(`${APNS_HOST}/3/device/${t.token}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${apnsToken}`,
            "apns-topic": APNS_TOPIC,
            "apns-push-type": "alert",
            "apns-priority": "10",
          },
          body: apnsPayload,
        });

        if (res.ok) {
          sent++;
        } else {
          const resBody = await res.json().catch(() => ({})) as { reason?: string };
          if (res.status === 410 || resBody.reason === "Unregistered") {
            staleTokens.push(t.token);
          }
          console.error(
            `[sendPushNotification] APNs ${res.status} for ${t.token.slice(0, 12)}…:`,
            resBody.reason ?? res.statusText,
          );
        }
      } catch (err) {
        console.error(`[sendPushNotification] fetch failed for ${t.token.slice(0, 12)}…:`, err);
      }
    }),
  );

  if (staleTokens.length > 0) {
    const { error: cleanupError } = await admin
      .from("push_tokens")
      .delete()
      .in("token", staleTokens);
    if (cleanupError) {
      console.error("[sendPushNotification] cleanup failed", cleanupError);
    }
  }

  return { tokens_found: tokens.length, sent, removed: staleTokens.length };
}
