import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* ── GET handler ──
   All scoring logic (player match stats, squad scoring, avg_points, carryover)
   lives in the run_fantasy_scoring() database function. This route only
   authenticates the cron caller and invokes it. */

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any).rpc("run_fantasy_scoring");

  if (error) {
    return NextResponse.json(
      { error: `run_fantasy_scoring failed: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
