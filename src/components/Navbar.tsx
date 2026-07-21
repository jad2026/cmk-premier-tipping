"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { createClient } from "@/lib/supabase/client";
import { initPushNotifications } from "@/lib/pushNotifications";

const AVATAR_COLORS = ["#1E7A3E", "#21409A", "#B23A48", "#2C9FD4", "#7A4B36", "#15324E", "#2B6E2B"];

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    Home: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 7.5L9 3l6 4.5V15a1 1 0 01-1 1H4a1 1 0 01-1-1V7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 16V10h4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    Tips: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L11.1 6.3 16 6.9 12.5 10.3 13.3 15.2 9 12.9 4.7 15.2 5.5 10.3 2 6.9 6.9 6.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
    "My Picks": <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="2.5" y="3" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/></svg>,
    Leaderboard: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="9" width="3.5" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><rect x="7.25" y="4" width="3.5" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><rect x="12.5" y="7" width="3.5" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
    Stats: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-5 3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    Squads: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2.5 15c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="13" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M13 10.5c1.7 0 3 1.3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    Profile: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    Admin: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.2 3.5.5-2.5 2.5.6 3.5L9 10.2 5.9 11.7l.6-3.5L4 5.7l3.5-.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  };
  return <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center">{icons[name] ?? null}</span>;
}

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

  // Init Capacitor push notifications once per session
  const pushInitRef = useRef(false);
  useEffect(() => {
    if (!user || pushInitRef.current) return;
    pushInitRef.current = true;
    try {
      const supabase = createClient();
      initPushNotifications(supabase, user.id).catch(() => {});
    } catch (err) {
      console.error("Push init failed:", err);
    }
  }, [user]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const mainLinks = [
    { href: "/", label: "Home" },
    { href: "/tips", label: "Tips" },
    ...(user ? [{ href: "/my-picks", label: "My Picks" }] : []),
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/stats", label: "Stats" },
    ...(showSquads ? [{ href: "/squads", label: "Squads" }] : []),
  ];

  const accountLinks = [
    ...(user ? [{ href: "/profile", label: "Profile" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const navLinks = [...mainLinks, ...accountLinks];

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
      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: menuOpen ? "80vh" : "0",
          opacity: menuOpen ? 1 : 0,
          background: "rgba(13,16,22,.98)",
          borderTop: menuOpen ? "1px solid rgba(255,255,255,.08)" : "1px solid transparent",
        }}
      >
        <nav className="max-w-content mx-auto px-4 py-3 flex flex-col gap-0.5">
          {/* User card */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-3 mb-1 rounded-xl" style={{ background: "rgba(255,255,255,.04)" }}>
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: AVATAR_COLORS[(user.email?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length] }}
              >
                {(user.user_metadata?.display_name ?? user.user_metadata?.first_name ?? user.email ?? "?")[0].toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {user.user_metadata?.display_name ?? user.user_metadata?.first_name ?? "Player"}
                </div>
                <div className="text-xs truncate" style={{ color: "#99A0AC" }}>{user.email}</div>
              </div>
            </div>
          )}

          {/* Main nav links */}
          {mainLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
              style={{
                color: isActive(href) ? "#FFFFFF" : "#99A0AC",
                background: isActive(href) ? "rgba(255,255,255,.06)" : "transparent",
              }}
            >
              <NavIcon name={label} />
              {label}
              {isActive(href) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
              )}
            </Link>
          ))}

          {/* Divider + Account section */}
          {(accountLinks.length > 0 || user) && (
            <>
              <div className="mx-3 my-1.5" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }} />
              {accountLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                  style={{
                    color: isActive(href) ? "#FFFFFF" : "#99A0AC",
                    background: isActive(href) ? "rgba(255,255,255,.06)" : "transparent",
                  }}
                >
                  <NavIcon name={label} />
                  {label}
                  {isActive(href) && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                  )}
                </Link>
              ))}
              {user && (
                <form method="POST" action="/api/auth/signout">
                  <button
                    type="submit"
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                    style={{ color: "#99A0AC" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 16H4a1 1 0 01-1-1V3a1 1 0 011-1h3M12 13l4-4-4-4M16 9H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Sign out
                  </button>
                </form>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
