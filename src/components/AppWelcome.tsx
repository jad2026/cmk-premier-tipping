"use client";

import Image from "next/image";

export type RoundState =
  | { mode: "open"; label: string; deadline: string }
  | { mode: "closed"; label: string }
  | { mode: "upcoming"; label: string; deadline: string }
  | { mode: "coming-soon"; label: string }
  | { mode: "none" };

export type WelcomeSite = {
  compId: string;
  displayName: string;
  subtitle: string | null;
  logoUrl: string | null;
  siteUrl: string;
  accentColor: string;
  surfaceColor: string;
  heroImage: string | null;
  round: RoundState;
};

interface AppWelcomeProps {
  sites: WelcomeSite[];
}

function RoundBadge({ round }: { round: RoundState }) {
  if (round.mode === "none")
    return <p className="text-sm" style={{ color: "#8C93A0" }}>No open round</p>;

  if (round.mode === "coming-soon") {
    return (
      <div className="text-sm space-y-1">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        <p className="text-xs" style={{ color: "#8C93A0" }}>Next round coming soon</p>
      </div>
    );
  }

  if (round.mode === "closed") {
    return (
      <div className="text-sm space-y-1">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        <p className="text-xs" style={{ color: "#8C93A0" }}>Tips closed — results pending</p>
      </div>
    );
  }

  if (round.mode === "upcoming") {
    return (
      <div className="text-sm space-y-1">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        <p className="text-xs" style={{ color: "#8C93A0" }}>
          Opens{" "}
          {new Date(round.deadline).toLocaleDateString("en-NZ", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm space-y-1">
      <div className="flex items-center justify-between">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(16,185,129,.15)", color: "#34d399" }}
        >
          Tips open
        </span>
      </div>
      <p className="text-xs" style={{ color: "#8C93A0" }}>
        Deadline:{" "}
        {new Date(round.deadline).toLocaleDateString("en-NZ", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

function CompCard({ site }: { site: WelcomeSite }) {
  return (
    <a
      href={site.siteUrl}
      className="block rounded-xl overflow-hidden transition-transform hover:scale-[1.01]"
      style={{ background: site.surfaceColor, border: "1px solid rgba(255,255,255,.08)" }}
    >
      {site.heroImage ? (
        <div className="relative h-32 overflow-hidden">
          <Image
            src={site.heroImage}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
            unoptimized
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${site.surfaceColor} 10%, transparent 70%)`,
            }}
          />
        </div>
      ) : (
        <div className="h-2 rounded-t-xl" style={{ background: site.accentColor }} />
      )}

      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          {site.logoUrl && (
            <Image
              src={site.logoUrl}
              alt=""
              width={44}
              height={44}
              className="rounded-lg shrink-0"
              unoptimized
            />
          )}
          <div className="min-w-0">
            <h3 className="font-display text-white text-[15px] uppercase tracking-[.04em] leading-tight truncate">
              {site.displayName}
            </h3>
            {site.subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "#8C93A0" }}>
                {site.subtitle}
              </p>
            )}
          </div>
        </div>

        <RoundBadge round={site.round} />
      </div>
    </a>
  );
}

export default function AppWelcome({ sites }: AppWelcomeProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0B0E13] text-white overflow-y-auto">
      {/* ── Hero — same pattern as homepage ─────────────────────────────── */}
      <section className="relative overflow-hidden flex-shrink-0">
        <Image
          src="/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover pointer-events-none"
          style={{ objectPosition: "center 20%" }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,14,19,.4) 0%, rgba(11,14,19,.65) 40%, rgba(11,14,19,.92) 75%, rgba(11,14,19,1) 100%)",
          }}
        />

        <div
          className="relative z-[2] flex flex-col items-center text-center px-6"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 40px)",
            paddingBottom: 40,
          }}
        >
          {/* Eyebrow — Navbar wordmark lockup */}
          <div className="flex items-center gap-3 mb-8">
            <span
              className="block w-[26px] h-[3px] rounded-full"
              style={{ background: "#D9A521" }}
            />
            <span className="font-display text-[17px] uppercase tracking-[.06em] text-white">
              Club Rugby Tipping
            </span>
          </div>

          {/* Display headline with coloured full stop */}
          <h1 className="font-display text-[48px] sm:text-[64px] leading-[.86] tracking-[-.01em] uppercase mb-4">
            Back your
            <br />
            team
            <span style={{ color: "#D9A521" }}>.</span>
          </h1>

          {/* Subline */}
          <p className="text-[17px] leading-[1.5] text-[#C2C7D0] max-w-[320px] mb-8">
            Tip your club, your province, your mates.
          </p>

          {/* Primary + secondary buttons — same style as hero CTAs */}
          <div className="flex gap-[14px] w-full max-w-xs">
            <button
              onClick={() => {
                window.location.href = "/signup";
              }}
              className="flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-[15px] rounded-[12px] text-[15px] font-extrabold tracking-[.02em] uppercase active:scale-[0.98] transition-transform cursor-pointer"
              style={{ background: "#D9A521", color: "#11151C" }}
            >
              Sign up&ensp;→
            </button>
            <button
              onClick={() => {
                window.location.href = "/login";
              }}
              className="flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-[15px] rounded-[12px] text-[15px] font-bold text-white active:scale-[0.98] transition-transform cursor-pointer"
              style={{ border: "1.5px solid rgba(255,255,255,.28)" }}
            >
              Sign in
            </button>
          </div>
        </div>
      </section>

      {/* ── Competition cards — same as hub SiteCard ─────────────────── */}
      {sites.length > 0 && (
        <section
          className="px-4 sm:px-6"
          style={{
            paddingTop: 8,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          }}
        >
          <h2
            className="font-display text-lg uppercase tracking-[.04em] mb-4"
            style={{ color: "#D9A521" }}
          >
            Browse Competitions
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {sites.map((site) => (
              <CompCard key={site.compId} site={site} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
