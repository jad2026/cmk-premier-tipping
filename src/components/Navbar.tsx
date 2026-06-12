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
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
          >
            {/* Rugby ball icon */}
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-gold/20 border border-brand-gold/30 text-brand-gold text-base select-none group-hover:bg-brand-gold/30 transition-colors">
              🏉
            </span>
            <span className="font-bold text-white text-[15px] tracking-tight leading-none">
              Club Rugby<br />
              <span className="font-normal text-brand-gold text-[11px] tracking-widest uppercase">Tipping</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5">
            {[
              { href: "/", label: "Home" },
              { href: "/tips", label: "Tips" },
              { href: "/leaderboard", label: "Leaderboard" },
              { href: "/admin", label: "Admin" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive(href)
                    ? "text-brand-gold"
                    : "text-blue-100/80 hover:text-white hover:bg-white/10"
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
