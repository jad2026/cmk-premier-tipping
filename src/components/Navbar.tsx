"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import PushNotificationToggle from "@/components/PushNotificationToggle";

export default function Navbar({ siteName = "Club Rugby Tipping", showSquads = false, user = null, isAdmin = false, competitionId = "" }: { siteName?: string; showSquads?: boolean; user?: User | null; isAdmin?: boolean; competitionId?: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMenuOpen(false); }
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/tips", label: "Tips" },
    ...(user ? [{ href: "/my-picks", label: "My Picks" }] : []),
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/stats", label: "Stats" },
    ...(showSquads ? [{ href: "/squads", label: "Squads" }] : []),
    ...(user ? [{ href: "/profile", label: "Profile" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header
      ref={menuRef}
      className="sticky top-0 z-40"
      style={{
        background: "rgba(13,16,22,.94)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="max-w-content mx-auto px-4 sm:px-8 flex items-center justify-between h-[74px]">

        {/* Logo: accent tick + wordmark */}
        <Link href="/" className="flex items-center gap-3 select-none min-w-0">
          <span
            className="block w-[26px] h-[3px] rounded-full shrink-0"
            style={{ background: "var(--accent)" }}
          />
          <span className="font-display text-[17px] uppercase tracking-[.06em] text-white lg:truncate">
            {siteName}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-1.5 px-[15px] py-[9px] rounded-[9px] text-sm font-medium transition-all duration-150 outline-none"
              style={{
                color: isActive(href) ? "#FFFFFF" : "#99A0AC",
                background: isActive(href) ? "transparent" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive(href)) {
                  e.currentTarget.style.color = "#FFFFFF";
                  e.currentTarget.style.background = "rgba(255,255,255,.06)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(href)) {
                  e.currentTarget.style.color = "#99A0AC";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {isActive(href) && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "var(--accent)" }}
                />
              )}
              {label}
            </Link>
          ))}
          {user && competitionId && (
            <div className="ml-2">
              <PushNotificationToggle competitionId={competitionId} />
            </div>
          )}
          <div className="ml-3 pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,.1)" }}>
            {user ? (
              <form method="POST" action="/api/auth/signout">
                <button
                  type="submit"
                  className="px-[15px] py-[9px] rounded-[9px] text-sm font-medium transition-all duration-150"
                  style={{ color: "#99A0AC" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#FFFFFF";
                    e.currentTarget.style.background = "rgba(255,255,255,.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#99A0AC";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Sign out
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="px-[20px] py-[10px] rounded-[10px] text-sm font-extrabold uppercase tracking-[.02em] transition-all duration-150 active:scale-[0.98]"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                }}
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>

        {/* Mobile right side: sign-in pill + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {user && competitionId && (
            <PushNotificationToggle competitionId={competitionId} />
          )}
          {!user && (
            <Link
              href="/login"
              className="px-3 py-2 rounded-[10px] text-[11px] sm:text-xs font-extrabold uppercase tracking-[.02em] whitespace-nowrap"
              style={{
                background: "var(--accent)",
                color: "var(--accent-text)",
              }}
            >
              Sign in
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex items-center justify-center w-11 h-11 rounded-[9px] transition-colors"
            style={{ color: "#99A0AC" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="md:hidden shadow-lg"
          style={{
            background: "rgba(13,16,22,.98)",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <nav className="max-w-content mx-auto px-4 py-2 flex flex-col">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-3.5 rounded-[9px] text-sm font-medium transition-colors"
                style={{
                  color: isActive(href) ? "#FFFFFF" : "#99A0AC",
                  background: isActive(href) ? "rgba(255,255,255,.06)" : "transparent",
                }}
              >
                {isActive(href) && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "var(--accent)" }}
                  />
                )}
                {label}
              </Link>
            ))}
            {user && (
              <form method="POST" action="/api/auth/signout">
                <button
                  type="submit"
                  className="flex items-center px-3 py-3.5 rounded-[9px] text-sm font-medium transition-colors mt-1 mb-1"
                  style={{ color: "#99A0AC" }}
                >
                  Sign out
                </button>
              </form>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
