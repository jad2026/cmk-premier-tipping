import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const meta = data.user.user_metadata ?? {};
      const displayName = (meta.display_name as string | undefined)?.trim();
      const firstName = (meta.first_name as string | undefined)?.trim();
      const lastName = (meta.last_name as string | undefined)?.trim();
      if (displayName || firstName || lastName) {
        await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            ...(displayName && { display_name: displayName }),
            ...(firstName && { first_name: firstName }),
            ...(lastName && { last_name: lastName }),
          },
          { onConflict: "id" }
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
