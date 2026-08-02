import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { Database, PushSubscription } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// POST — fan out a web-push notification to every subscriber of a competition.
// Protected by the same CRON_SECRET bearer check the cron routes use.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return NextResponse.json({ error: "VAPID credentials not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let payload: { competitionId?: string; title?: string; body?: string; url?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { competitionId, title, body, url } = payload;
  if (!competitionId || !title) {
    return NextResponse.json(
      { error: "Missing competitionId or title" },
      { status: 400 }
    );
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
    }
  );

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("competition_id", competitionId);

  if (error) {
    console.error("[push/send] query failed", error);
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  const notification = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    (subscriptions as Pick<PushSubscription, "id" | "endpoint" | "p256dh" | "auth">[]).map(
      async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            notification
          );
          sent++;
        } catch (err) {
          failed++;
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404 Not Found / 410 Gone — the endpoint is expired or unsubscribed.
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            console.error("[push/send] send failed", statusCode, sub.endpoint);
          }
        }
      }
    )
  );

  if (staleIds.length > 0) {
    const { error: cleanupError } = await admin
      .from("push_subscriptions")
      .delete()
      .in("id", staleIds);
    if (cleanupError) {
      console.error("[push/send] cleanup failed", cleanupError);
    }
  }

  return NextResponse.json({
    sent,
    failed,
    total: subscriptions.length,
    removed: staleIds.length,
  });
}
