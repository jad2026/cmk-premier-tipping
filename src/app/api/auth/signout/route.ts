import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
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
