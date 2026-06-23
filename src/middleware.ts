import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";
const CMK_COMPETITION_ID = "b3dbe30d-91ef-40c3-9680-3586c6d17ef8";

const HOST_TO_COMPETITION_ID: Record<string, string> = {
  "npc.clubrugbytipping.com": NPC_COMPETITION_ID,
};

export async function middleware(request: NextRequest) {
  // Resolve competition from hostname and inject as a request header so all
  // server components and actions can read it via getCurrentCompetitionId().
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  const competitionId = HOST_TO_COMPETITION_ID[host] ?? CMK_COMPETITION_ID;
  const requestWithCompetition = new Request(request, {
    headers: (() => {
      const h = new Headers(request.headers);
      h.set("x-competition-id", competitionId);
      return h;
    })(),
  });

  let supabaseResponse = NextResponse.next({ request: requestWithCompetition });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = ["/tips", "/leaderboard", "/my-picks", "/admin"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Expose pathname to server components via a request header
  supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|icons|manifest).*)"],
};
