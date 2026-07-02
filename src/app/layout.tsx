import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import GlobalTeamMarquee from "@/components/GlobalTeamMarquee";
import GlobalSponsorBanner from "@/components/GlobalSponsorBanner";
import SignupBanner from "@/components/SignupBanner";
import { getCurrentCompetitionId, NPC_COMPETITION_ID } from "@/lib/competition";
import { getAccentForCompetition, getAccentCSSVars } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-archivo-black",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0B0E13",
};

export async function generateMetadata(): Promise<Metadata> {
  const compId = await getCurrentCompetitionId();
  const isNpc = compId === NPC_COMPETITION_ID;
  return {
    title: isNpc ? "NPC Tipping" : "Club Rugby Tipping",
    description: "Rugby tipping competition — pick the winners and top the table.",
    appleWebApp: {
      capable: true,
      title: isNpc ? "NPC Tipping" : "CRT Tipping",
      statusBarStyle: "default",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const compId = await getCurrentCompetitionId();
  const isNpc = compId === NPC_COMPETITION_ID;
  const themeClass = isNpc ? "theme-npc" : "";
  const siteName = isNpc ? "NPC Tipping" : "Club Rugby Tipping";
  const accentName = getAccentForCompetition(compId);
  const accentVars = getAccentCSSVars(accentName);

  const supabase = await createClient();
  const { data: compFeatures } = await supabase
    .from("competitions")
    .select("features")
    .eq("id", compId)
    .single() as unknown as { data: { features: Record<string, boolean> | null } | null };
  const showSquads = compFeatures?.features?.show_squads === true;

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedOut = !user;

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${themeClass}`}
      style={accentVars as React.CSSProperties}
    >
      <body className={`${archivo.className} min-h-screen`}>
        <Navbar siteName={siteName} showSquads={showSquads} />
        <GlobalTeamMarquee />
        <main className="max-w-content mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
        <GlobalSponsorBanner />
        {isLoggedOut && <SignupBanner siteName={siteName} />}
        <footer className="bg-ink border-t border-white/[.06]">
          <div className="max-w-content mx-auto px-4 sm:px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="block w-[26px] h-[3px] rounded-full shrink-0"
                style={{ background: "var(--accent)" }}
              />
              <span className="font-display text-[14px] uppercase tracking-[.06em] text-white">
                {siteName}
              </span>
            </div>
            <span className="text-[12px] text-[#8C93A0]">
              &copy; 2026 &middot; John Dazley &middot; Club Rugby Tipping
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
