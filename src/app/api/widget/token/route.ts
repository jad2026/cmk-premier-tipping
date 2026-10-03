import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = randomBytes(32).toString("base64url");
  const hash = hashToken(raw);

  const admin = createAdminClient();
  const { error } = await (admin
    .from("widget_tokens") as any)
    .insert({ user_id: user.id, token_hash: hash });

  if (error) {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }

  return NextResponse.json({ token: raw });
}
