import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error: picksErr } = await admin
    .from("picks")
    .delete()
    .eq("user_id", user.id);
  if (picksErr) {
    return NextResponse.json({ error: "Failed to delete picks" }, { status: 500 });
  }

  const { error: partErr } = await admin
    .from("competition_participants")
    .delete()
    .eq("user_id", user.id);
  if (partErr) {
    return NextResponse.json({ error: "Failed to delete participation records" }, { status: 500 });
  }

  const { error: pushErr } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id);
  if (pushErr) {
    return NextResponse.json({ error: "Failed to delete push subscriptions" }, { status: 500 });
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .delete()
    .eq("id", user.id);
  if (profileErr) {
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
  if (authErr) {
    return NextResponse.json({ error: "Failed to delete auth account" }, { status: 500 });
  }

  await supabase.auth.signOut();

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) {
      cookieStore.delete(cookie.name);
    }
  }

  return NextResponse.json({ ok: true });
}
