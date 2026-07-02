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

  const host = request.headers.get("host") || "clubrugbytipping.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  return NextResponse.redirect(new URL("/", `${protocol}://${host}`), 302);
}
