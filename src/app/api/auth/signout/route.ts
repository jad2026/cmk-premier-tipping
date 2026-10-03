import { createClient, createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();

  const widgetToken = request.headers.get("x-widget-token");
  if (widgetToken) {
    const hash = createHash("sha256").update(widgetToken).digest("hex");
    const admin = createAdminClient();
    await (admin.from("widget_tokens") as any).delete().eq("token_hash", hash);
  }

  await supabase.auth.signOut();

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) {
      cookieStore.delete(cookie.name);
    }
  }

  const origin = request.headers.get("origin")
    || request.headers.get("referer")?.replace(/\/[^/]*$/, "")
    || `https://${request.headers.get("host") || "clubrugbytipping.com"}`;
  return NextResponse.redirect(new URL("/", origin), 302);
}
