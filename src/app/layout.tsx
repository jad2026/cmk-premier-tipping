import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import GlobalTeamMarquee from "@/components/GlobalTeamMarquee";
import GlobalSponsorBanner from "@/components/GlobalSponsorBanner";
import { getCurrentCompetitionId, NPC_COMPETITION_ID } from "@/lib/competition";
import { getAccentForCompetition, getAccentCSSVars } from "@/lib/theme";

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

export const metadata: Metadata = {
  title: "Club Rugby Tipping",
  description: "Rugby tipping competition — pick the winners and top the table.",
  appleWebApp: {
    capable: true,
    title: "CRT Tipping",
    statusBarStyle: "default",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const compId = await getCurrentCompetitionId();
  const themeClass = compId === NPC_COMPETITION_ID ? "theme-npc" : "";
  const accentName = getAccentForCompetition(compId);
  const accentVars = getAccentCSSVars(accentName);

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${themeClass}`}
      style={accentVars as React.CSSProperties}
    >
      <body className={`${archivo.className} min-h-screen`}>
        <Navbar />
        <div className="max-w-content mx-auto px-4 sm:px-8 pt-6">
          <GlobalTeamMarquee />
        </div>
        <main className="max-w-content mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
        <GlobalSponsorBanner />
        <footer className="bg-ink border-t border-white/[.06]">
          <div className="max-w-content mx-auto px-4 sm:px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="block w-[26px] h-[3px] rounded-full shrink-0"
                style={{ background: "var(--accent)" }}
              />
              <span className="font-display text-[14px] uppercase tracking-[.06em] text-white">
                Club Rugby Tipping
              </span>
            </div>
            <span className="text-[12px] text-[#8C93A0]">
              &copy; 2026 &middot; CMK Premier Club Rugby &middot; Taranaki
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
