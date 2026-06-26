import { headers } from "next/headers";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";
import SponsorBanner from "@/components/SponsorBanner";

export default async function GlobalSponsorBanner() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (pathname.startsWith("/admin") || pathname === "/" || pathname === "" || pathname === "/leaderboard" || pathname.startsWith("/leaderboard/") || pathname === "/ladder" || pathname === "/tips" || pathname === "/my-picks" || pathname === "/profile") return null;

  const sponsors = await fetchActiveSponsors("home");
  if (sponsors.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10">
      <SponsorBanner sponsors={sponsors} variant="large" />
    </div>
  );
}
