import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/sendPushNotification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.PUSH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "PUSH_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("x-push-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { user_ids?: string[]; title?: string; body?: string; data?: object };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user_ids, title, body, data } = payload;
  if (!user_ids?.length || !title || !body) {
    return NextResponse.json(
      { error: "Missing user_ids, title, or body" },
      { status: 400 },
    );
  }

  const result = await sendPushNotification({ userIds: user_ids, title, body, data });
  return NextResponse.json(result);
}
