import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return new Response(renderPage("Missing token.", false), { headers: { "content-type": "text/html" } });
  }

  let email: string;
  try {
    email = Buffer.from(token, "base64").toString("utf-8");
  } catch {
    return new Response(renderPage("Invalid token.", false), { headers: { "content-type": "text/html" } });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: "no-store" }) },
    }
  );

  let userId: string | null = null;
  let page = 1;
  while (true) {
    const { data: { users: batch } } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const match = batch.find((u) => u.email === email);
    if (match) { userId = match.id; break; }
    if (batch.length < 1000) break;
    page++;
  }

  if (!userId) {
    return new Response(renderPage("Email not found.", false), { headers: { "content-type": "text/html" } });
  }

  const { error } = await admin
    .from("profiles")
    .update({ unsubscribed: true })
    .eq("id", userId);

  if (error) {
    console.error("[unsubscribe] Failed:", error);
    return new Response(renderPage("Something went wrong. Please try again.", false), { headers: { "content-type": "text/html" } });
  }

  return new Response(renderPage("You've been unsubscribed from Club Rugby Tipping emails.", true), {
    headers: { "content-type": "text/html" },
  });
}

function renderPage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe</title>
<style>body{margin:0;padding:40px 20px;background:#F2F0EA;font-family:system-ui,sans-serif;display:flex;justify-content:center;}
.card{max-width:440px;background:#fff;border-radius:16px;padding:40px;text-align:center;border:1px solid #E4E1D8;}
h1{font-size:20px;color:#0B0E13;margin:0 0 12px;}
p{font-size:15px;color:#5A6371;line-height:1.5;margin:0;}
.icon{font-size:40px;margin-bottom:16px;}</style></head>
<body><div class="card">
<div class="icon">${success ? "✅" : "⚠️"}</div>
<h1>${success ? "Unsubscribed" : "Oops"}</h1>
<p>${message}</p>
</div></body></html>`;
}
