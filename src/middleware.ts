import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";
const CMK_COMPETITION_ID = "b3dbe30d-91ef-40c3-9680-3586c6d17ef8";
const BRIDLINGTON_COMPETITION_ID = "7a27f36c-aab6-4ba8-86e3-2bd9b182361e";
const WAIKATO_COMPETITION_ID = "24d98bce-ce4b-4411-be28-8af22f4663a7";

const HOST_TO_COMPETITION_ID: Record<string, string> = {
  "taranaki.clubrugbytipping.com": CMK_COMPETITION_ID,
  "bridlington.clubrugbytipping.com": BRIDLINGTON_COMPETITION_ID,
  "waikato.clubrugbytipping.com": WAIKATO_COMPETITION_ID,
  // Local dev hostnames
  "bridlington": BRIDLINGTON_COMPETITION_ID,
  "taranaki": CMK_COMPETITION_ID,
};

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
  const competitionId = HOST_TO_COMPETITION_ID[host] ?? NPC_COMPETITION_ID;
  const requestWithCompetition = new Request(request, {
    headers: (() => {
      const h = new Headers(request.headers);
      h.set("x-competition-id", competitionId);
      return h;
    })(),
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
