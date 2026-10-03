import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NPC_COMPETITION_ID } from "@/lib/competition";

const FALLBACK_URL = "https://clubrugbytipping.com";

export async function GET(request: NextRequest) {
  const compId = request.nextUrl.searchParams.get("comp");
  if (!compId) {
    return NextResponse.redirect(new URL("/hub", request.url));
  }

  const supabase = await createClient();
  const { data: comp } = await supabase
    .from("competitions")
    .select("site_url")
    .eq("id", compId)
    .maybeSingle() as unknown as { data: { site_url: string | null } | null };

  const siteUrl = comp?.site_url || FALLBACK_URL;
  const isNpc = compId === NPC_COMPETITION_ID;
  const destination = isNpc ? new URL("/tips", request.url) : new URL("/tips", siteUrl);

  const response = NextResponse.redirect(destination, 302);

  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("last-comp", compId, {
    domain: isProd ? ".clubrugbytipping.com" : undefined,
    path: "/",
    sameSite: "lax",
    secure: isProd,
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
