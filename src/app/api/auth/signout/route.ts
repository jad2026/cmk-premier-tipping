import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) {
      cookieStore.delete(cookie.name);
    }
  }

  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL || "https://clubrugbytipping.com"),
    302
  );
}
