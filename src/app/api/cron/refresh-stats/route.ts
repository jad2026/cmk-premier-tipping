import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
    }
  );

  const { error } = await admin.rpc("refresh_season_stats");
  if (error) {
    console.error("[refresh-stats] Failed to refresh season stats matviews:", error.message);
    return NextResponse.json({ refreshed: false, error: error.message }, { status: 500 });
  }

  console.log("[refresh-stats] Season stats matviews refreshed");
  return NextResponse.json({ refreshed: true });
}
