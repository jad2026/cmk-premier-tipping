"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="bg-brand sticky top-0 z-40 shadow-[0_2px_12px_rgba(0,0,0,0.18)]">
      {/* Gold accent line at very bottom of nav */}
      <div className="border-b-2 border-brand-gold/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">

          {/* Brand / logo */}
          <Link href="/" className="flex items-center gap-2.5 group select-none">
            {/* SVG Rugby ball */}
            <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-brand-gold/15 border border-brand-gold/25 group-hover:bg-brand-gold/25 transition-colors">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                {/* Ball outline */}
                <ellipse cx="11" cy="11" rx="9.5" ry="5.8" transform="rotate(-35 11 11)" stroke="#C9A84C" strokeWidth="1.5" fill="none"/>
                {/* Centre seam */}
                <line x1="4.5" y1="11" x2="17.5" y2="11" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
                {/* Stitching top */}
                <path d="M8 7.8 C9.5 8.5 12.5 8.5 14 7.8" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.55"/>
                {/* Stitching bottom */}
                <path d="M8 14.2 C9.5 13.5 12.5 13.5 14 14.2" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.55"/>
                {/* Highlight */}
                <ellipse cx="8.5" cy="9.5" rx="1.8" ry="0.9" transform="rotate(-35 8.5 9.5)" fill="white" opacity="0.12"/>
              </svg>
            </div>
            {/* Text lockup */}
            <div className="leading-none">
              <div className="text-[15px] font-extrabold text-white tracking-tight">Club Rugby</div>
              <div className="text-[10px] font-semibold text-brand-gold tracking-[0.22em] uppercase mt-0.5">Tipping</div>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5">
            {[
              { href: "/", label: "Home" },
              { href: "/tips", label: "Tips" },
              ...(user ? [{ href: "/my-picks", label: "My Picks" }] : []),
              { href: "/leaderboard", label: "Leaderboard" },
              ...(user ? [{ href: "/leagues", label: "Leagues" }] : []),
              ...(user ? [{ href: "/profile", label: "Profile" }] : []),
              { href: "/admin", label: "Admin" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                  isActive(href)
                    ? "text-brand-gold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                {label}
                {isActive(href) && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-brand-gold" />
                )}
              </Link>
            ))}

            <div className="ml-3 pl-3 border-l border-white/10">
              {user ? (
                <button
                  onClick={signOut}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium text-red-300 hover:text-white hover:bg-red-500/20 transition-all duration-150"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-gold text-white hover:bg-brand-gold-dark active:scale-[0.98] transition-all duration-150 shadow-sm"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
