import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
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
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const compId = await getCurrentCompetitionId();
  const isNpc = compId === NPC_COMPETITION_ID;
  return {
    title: isNpc ? "Club Rugby Tipping" : "Club Rugby Tipping",
    description: isNpc
      ? "Free rugby tipping comp — pick the winners each round, predict margins, and climb the national leaderboard. Back your province."
      : "Rugby tipping competition — pick the winners and top the table.",
    appleWebApp: {
      capable: true,
      title: isNpc ? "Club Rugby Tipping" : "CRT Tipping",
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
  const siteName = isNpc ? "Club Rugby Tipping" : "Club Rugby Tipping";
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

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${themeClass}`}
      style={accentVars as React.CSSProperties}
    >
      <body className={`${archivo.className} min-h-screen`}>
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '106320556126251');
          fbq('init', '719351428247571');
          fbq('init', '1519118086653618');
          fbq('track', 'PageView');
        `}</Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "xss6v9bboi");
        `}</Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=106320556126251&ev=PageView&noscript=1"
            alt=""
          />
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=719351428247571&ev=PageView&noscript=1"
            alt=""
          />
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1519118086653618&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <Analytics />
        <Navbar siteName={siteName} showSquads={showSquads} user={user} isAdmin={isAdmin} competitionId={compId} />
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
            <div className="flex items-center gap-3 text-[12px] text-[#8C93A0]">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <span>&copy; 2026</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
