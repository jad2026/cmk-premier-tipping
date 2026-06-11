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

  const linkClass = (href: string) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href
        ? "bg-brand-gold text-white"
        : "text-gray-200 hover:bg-brand-light"
    }`;

  return (
    <nav className="bg-brand text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="font-bold text-lg tracking-tight">
          CMK Premier Tipping
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/" className={linkClass("/")}>
            Home
          </Link>
          <Link href="/tips" className={linkClass("/tips")}>
            Tips
          </Link>
          <Link href="/leaderboard" className={linkClass("/leaderboard")}>
            Leaderboard
          </Link>
          <Link href="/admin" className={linkClass("/admin")}>
            Admin
          </Link>
          {user ? (
            <button
              onClick={signOut}
              className="ml-3 px-3 py-2 rounded text-sm font-medium bg-red-600 hover:bg-red-700 transition-colors"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="ml-3 px-3 py-2 rounded text-sm font-medium bg-brand-gold hover:bg-yellow-600 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
