import { headers } from "next/headers";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";
import SponsorBanner from "@/components/SponsorBanner";

export default async function GlobalSponsorBanner() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (pathname.startsWith("/admin") || pathname === "/" || pathname === "" || pathname === "/leaderboard" || pathname.startsWith("/leaderboard/") || pathname === "/stats" || pathname === "/tips" || pathname === "/my-picks" || pathname === "/profile" || pathname === "/leagues" || pathname.startsWith("/leagues/") || pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password") return null;

  const sponsors = await fetchActiveSponsors("home");
  if (sponsors.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10">
      <SponsorBanner sponsors={sponsors} variant="large" />
    </div>
  );
}
