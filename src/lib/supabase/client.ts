import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const PROD_DOMAIN = ".clubrugbytipping.com";
const cookieDomain = process.env.NODE_ENV === "production" ? PROD_DOMAIN : undefined;

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    }
  );
}
