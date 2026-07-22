import { createClient as createAdminClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const APNS_HOST = "https://api.push.apple.com";
const APNS_TOPIC = "com.clubrugbytipping.app";
const FCM_PROJECT_ID = "club-rugby-tipping";

interface PushPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: object;
}

let cachedApnsToken: { jwt: string; expires: number } | null = null;
let cachedFcmToken: { token: string; expires: number } | null = null;

function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsToken && now < cachedApnsToken.expires) return cachedApnsToken.jwt;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !privateKey) {
    throw new Error("Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_PRIVATE_KEY");
  }

  const token = jwt.sign({ iss: teamId, iat: now }, privateKey.replace(/\\n/g, "\n"), {
    algorithm: "ES256",
    header: { alg: "ES256", kid: keyId },
  });

  cachedApnsToken = { jwt: token, expires: now + 2400 };
  return token;
}

function getFcmServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
  return JSON.parse(raw);
}

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && now < cachedFcmToken.expires) return cachedFcmToken.token;

  const sa = getFcmServiceAccount();
  const token = jwt.sign(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    },
    sa.private_key.replace(/\\n/g, "\n"),
    { algorithm: "RS256" },
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${token}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FCM token exchange failed: ${res.status} ${err}`);
  }

  const { access_token, expires_in } = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedFcmToken = { token: access_token, expires: now + expires_in - 60 };
  return access_token;
}

async function sendViaApns(
  iosTokens: { user_id: string; token: string }[],
  title: string,
  body: string,
  data?: object,
): Promise<{ sent: number; staleTokens: string[] }> {
  let apnsJwt: string;
  try {
    apnsJwt = getApnsJwt();
  } catch (err) {
    console.error("[sendPushNotification] APNs JWT error:", err);
    return { sent: 0, staleTokens: [] };
  }

  const payload = JSON.stringify({
    aps: { alert: { title, body }, sound: "default" },
    ...data,
  });

  let sent = 0;
  const staleTokens: string[] = [];

  await Promise.all(
    iosTokens.map(async (t) => {
      try {
        const res = await fetch(`${APNS_HOST}/3/device/${t.token}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${apnsJwt}`,
            "apns-topic": APNS_TOPIC,
            "apns-push-type": "alert",
            "apns-priority": "10",
          },
          body: payload,
        });

        if (res.ok) {
          sent++;
        } else {
          const resBody = (await res.json().catch(() => ({}))) as { reason?: string };
          if (res.status === 410 || resBody.reason === "Unregistered") {
            staleTokens.push(t.token);
          }
          console.error(
            `[sendPushNotification] APNs ${res.status} for ${t.token.slice(0, 12)}…:`,
            resBody.reason ?? res.statusText,
          );
        }
      } catch (err) {
        console.error(`[sendPushNotification] APNs fetch failed for ${t.token.slice(0, 12)}…:`, err);
      }
    }),
  );

  return { sent, staleTokens };
}

async function sendViaFcm(
  androidTokens: { user_id: string; token: string }[],
  title: string,
  body: string,
  data?: object,
): Promise<{ sent: number; staleTokens: string[] }> {
  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken();
  } catch (err) {
    console.error("[sendPushNotification] FCM auth error:", err);
    return { sent: 0, staleTokens: [] };
  }

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  let sent = 0;
  const staleTokens: string[] = [];

  const dataFields: Record<string, string> = {};
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      dataFields[k] = String(v);
    }
  }

  await Promise.all(
    androidTokens.map(async (t) => {
      try {
        const res = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title, body },
              android: { priority: "high" },
              ...(Object.keys(dataFields).length > 0 ? { data: dataFields } : {}),
            },
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          const resBody = (await res.json().catch(() => ({}))) as {
            error?: { code?: number; status?: string; message?: string };
          };
          const errStatus = resBody.error?.status;
          if (errStatus === "NOT_FOUND" || errStatus === "UNREGISTERED") {
            staleTokens.push(t.token);
          }
          console.error(
            `[sendPushNotification] FCM ${res.status} for ${t.token.slice(0, 12)}…:`,
            resBody.error?.message ?? res.statusText,
          );
        }
      } catch (err) {
        console.error(`[sendPushNotification] FCM fetch failed for ${t.token.slice(0, 12)}…:`, err);
      }
    }),
  );

  return { sent, staleTokens };
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

  const iosTokens = tokens.filter((t) => t.platform === "ios");
  const androidTokens = tokens.filter((t) => t.platform === "android");

  const [apnsResult, fcmResult] = await Promise.all([
    iosTokens.length > 0 ? sendViaApns(iosTokens, title, body, data) : { sent: 0, staleTokens: [] },
    androidTokens.length > 0 ? sendViaFcm(androidTokens, title, body, data) : { sent: 0, staleTokens: [] },
  ]);

  const allStale = [...apnsResult.staleTokens, ...fcmResult.staleTokens];
  if (allStale.length > 0) {
    const { error: cleanupError } = await admin
      .from("push_tokens")
      .delete()
      .in("token", allStale);
    if (cleanupError) {
      console.error("[sendPushNotification] cleanup failed", cleanupError);
    }
  }

  const totalSent = apnsResult.sent + fcmResult.sent;
  return { tokens_found: tokens.length, sent: totalSent, removed: allStale.length };
}
