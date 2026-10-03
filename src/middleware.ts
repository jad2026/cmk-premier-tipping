import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

// Module-level cache
let hostnameCache: Map<string, string> | null = null;
let cacheTTL = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function resolveCompetitionId(hostname: string): Promise<string> {
  const now = Date.now();
  if (!hostnameCache || now > cacheTTL) {
    // Query Supabase REST API directly (competitions has public-read RLS)
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/competitions?is_active=eq.true&is_main_comp=eq.true&select=id,site_url`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      }
    );
    if (res.ok) {
      const rows: { id: string; site_url: string }[] = await res.json();
      const map = new Map<string, string>();
      for (const row of rows) {
        try {
          const url = new URL(row.site_url);
          map.set(url.hostname, row.id);
          // Local dev: also map bare subdomain (e.g., "taranaki" for "taranaki.clubrugbytipping.com")
          const sub = url.hostname.replace('.clubrugbytipping.com', '');
          if (sub !== url.hostname) {
            map.set(sub, row.id);
          }
        } catch {}
      }
      hostnameCache = map;
      cacheTTL = now + CACHE_DURATION;
    }
  }
  return hostnameCache?.get(hostname) ?? NPC_COMPETITION_ID;
}

export async function middleware(request: NextRequest) {
  // Resolve competition from hostname and inject as a request header so all
  // server components and actions can read it via getCurrentCompetitionId().
  // Redirect old npc. subdomain to root domain
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (host === "npc.clubrugbytipping.com") {
    const url = request.nextUrl.clone();
    url.host = "clubrugbytipping.com";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }
  const competitionId = await resolveCompetitionId(host);
  const h = new Headers(request.headers);
  h.set("x-competition-id", competitionId);
  if (request.headers.get("user-agent")?.includes("CRTApp")) {
    h.set("x-is-app", "1");
  }
  const requestWithCompetition = new Request(request, {
    headers: h,
  });

  let supabaseResponse = NextResponse.next({ request: requestWithCompetition });

  const isProd = process.env.NODE_ENV === "production";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: isProd ? ".clubrugbytipping.com" : undefined,
        path: "/",
        sameSite: "lax" as const,
        secure: isProd,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: requestWithCompetition });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const protectedPaths = ["/tips", "/leaderboard", "/my-picks", "/admin", "/profile"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // Expose pathname to server components via a request header
  supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|icons|manifest).*)"],
};
