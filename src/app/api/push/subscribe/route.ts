import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
    }
  );
}

// POST — save (upsert) a browser push subscription for the current user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    competitionId?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscription, competitionId } = payload;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth || !competitionId) {
    return NextResponse.json(
      { error: "Missing subscription keys or competitionId" },
      { status: 400 }
    );
  }

  const { error } = await admin()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        competition_id: competitionId,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: "user_id,endpoint,competition_id" }
    );

  if (error) {
    console.error("[push/subscribe] upsert failed", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove a subscription for the current user.
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { endpoint?: string; competitionId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { endpoint, competitionId } = payload;
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  let query = admin()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (competitionId) {
    query = query.eq("competition_id", competitionId);
  }

  const { error } = await query;
  if (error) {
    console.error("[push/subscribe] delete failed", error);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
