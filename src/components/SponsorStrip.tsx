import { headers } from "next/headers";
import { fetchActiveSponsors } from "@/app/admin/sponsorActions";

// Slim "Proudly supported by" strip shown under the navbar for competitions
// with features.sponsor_strip enabled. Only sponsors with a logo are shown.
export default async function SponsorStrip() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  if (pathname.startsWith("/admin")) return null;

  const sponsors = (await fetchActiveSponsors("all")).filter((s) => s.logo_url);
  if (sponsors.length === 0) return null;

  return (
    <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E4E1D8" }}>
      <div className="max-w-content mx-auto px-4 sm:px-8 h-[64px] flex items-center gap-6">
        <span className="hidden sm:block shrink-0 text-[11px] font-extrabold tracking-[.14em] uppercase text-[#8C93A0]">
          Proudly supported by
        </span>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-4 sm:gap-10">
          {sponsors.map((s) => {
            // eslint-disable-next-line @next/next/no-img-element
            const logo = <img src={s.logo_url!} alt={s.name} className="block max-h-[44px] max-w-full w-auto object-contain" />;
            return s.website_url ? (
              <a
                key={s.id}
                href={s.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex items-center hover:opacity-75 transition-opacity"
              >
                {logo}
              </a>
            ) : (
              <span key={s.id} className="min-w-0 flex items-center">
                {logo}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
