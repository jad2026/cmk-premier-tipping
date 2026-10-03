import Image from "next/image";
import Link from "next/link";

type SiteCard = {
  compId: string;
  slug: string;
  displayName: string;
  logoUrl: string | null;
  siteUrl: string;
  accentColor: string;
  surfaceColor: string | null;
};

interface AppWelcomeProps {
  sites: SiteCard[];
}

export default function AppWelcome({ sites }: AppWelcomeProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center bg-[#0B0E13] text-white px-6 py-12 overflow-y-auto">

      {/* Logo */}
      <div className="mt-8 mb-6">
        <Image
          src="/logo.png"
          alt="Club Rugby Tipping"
          width={180}
          height={180}
          className="mx-auto"
          priority
        />
      </div>

      {/* Pitch */}
      <p className="text-[#A0A6B3] text-[17px] tracking-wide mb-10 text-center">
        Back your team. Pick your winners.
      </p>

      {/* Auth buttons */}
      <div className="flex gap-3 w-full max-w-xs mb-14">
        <Link
          href="/login"
          className="flex-1 text-center py-[14px] rounded-full bg-white text-[#0B0E13] text-[15px] font-bold no-underline active:scale-[0.97] transition-transform"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="flex-1 text-center py-[14px] rounded-full border border-white/40 text-white text-[15px] font-bold no-underline active:scale-[0.97] transition-transform"
        >
          Sign up
        </Link>
      </div>

      {/* Browse competitions */}
      {sites.length > 0 && (
        <div className="w-full max-w-lg">
          <h2 className="text-[13px] font-extrabold tracking-[.18em] uppercase text-[#6B7280] mb-5 text-center">
            Browse competitions
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sites.map((site) => (
              <a
                key={site.compId}
                href={site.siteUrl}
                className="flex items-center gap-4 rounded-2xl px-5 py-4 no-underline transition-colors hover:bg-white/[.06]"
                style={{
                  background: "rgba(255,255,255,.04)",
                  border: `1px solid ${site.accentColor}22`,
                }}
              >
                {/* Logo or letter fallback */}
                {site.logoUrl ? (
                  <Image
                    src={site.logoUrl}
                    alt={site.displayName}
                    width={40}
                    height={40}
                    className="rounded-full object-contain shrink-0"
                    style={{ width: 40, height: 40 }}
                    unoptimized
                  />
                ) : (
                  <span
                    className="flex items-center justify-center rounded-full shrink-0 font-display text-[15px] text-white"
                    style={{
                      width: 40,
                      height: 40,
                      background: site.accentColor,
                    }}
                  >
                    {site.displayName.charAt(0).toUpperCase()}
                  </span>
                )}

                <span className="text-[15px] font-semibold text-white truncate">
                  {site.displayName}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
