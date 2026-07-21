import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.PUSH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "PUSH_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("x-push-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { user_ids?: string[]; title?: string; body?: string; data?: object };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user_ids, title, body, data } = payload;
  if (!user_ids?.length || !title || !body) {
    return NextResponse.json(
      { error: "Missing user_ids, title, or body" },
      { status: 400 },
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: tokens, error } = await admin
    .from("push_tokens")
    .select("user_id, token, platform")
    .in("user_id", user_ids);

  if (error) {
    console.error("[push/send-native] query failed", error);
    return NextResponse.json({ error: "Failed to load tokens" }, { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ tokens_found: 0, sent: 0 });
  }

  // TODO: Send via APNs once developer certificate is configured.
  // For each token, send { title, body, data } through Apple Push Notification service.
  for (const t of tokens) {
    console.log(`[push/send-native] Would send to ${t.platform} token ${t.token.slice(0, 12)}… for user ${t.user_id}:`, { title, body, data });
  }

  return NextResponse.json({ tokens_found: tokens.length, sent: 0 });
}
