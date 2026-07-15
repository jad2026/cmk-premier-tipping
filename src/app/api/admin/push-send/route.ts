import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Gate = { ok: true } | { ok: false; response: NextResponse };

// Same is_admin check the admin pages and server actions use.
async function requireAdmin(): Promise<Gate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { ok: false, response: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }

  return { ok: true };
}

// GET — how many subscribers a send would reach, so the admin sees the blast
// radius before confirming. push_subscriptions is only readable via service role.
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const competitionId = await getCurrentCompetitionId();

  const { count, error } = await admin()
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);

  if (error) {
    console.error("[admin/push-send] count failed", error);
    return NextResponse.json({ error: "Failed to count subscribers" }, { status: 500 });
  }

  return NextResponse.json({ subscribers: count ?? 0 });
}

// POST — admin-authenticated front door for /api/push/send, which is otherwise
// locked behind CRON_SECRET. The competition is resolved from the request host
// rather than the client payload, so an admin can only push to the site they
// are on.
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  let payload: { title?: string; body?: string; url?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim() ?? "";
  const url = payload.url?.trim() || "/";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const competitionId = await getCurrentCompetitionId();

  // Base URL for the internal /api/push/send call — prefer the incoming
  // request's host, then explicit config, then Vercel's deployment URL.
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  const baseUrl =
    (host ? `${proto}://${host}` : undefined) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ competitionId, title, body, url }),
    });
  } catch (err) {
    console.error("[admin/push-send] forward failed", err);
    return NextResponse.json({ error: "Failed to reach push service" }, { status: 502 });
  }

  const result = await res.json().catch(() => ({ error: "Push service returned no body" }));
  return NextResponse.json(result, { status: res.status });
}
