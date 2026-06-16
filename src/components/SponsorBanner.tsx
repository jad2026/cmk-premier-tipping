import Image from "next/image";
import type { Sponsor } from "@/lib/supabase/types";

type Props = {
  sponsors: Sponsor[];
  variant?: "large" | "small";
};

export default function SponsorBanner({ sponsors, variant = "large" }: Props) {
  if (sponsors.length === 0) return null;

  const isLarge = variant === "large";

  const logoHeight = isLarge ? 120 : 40;
  const logoWidth = isLarge ? 240 : 100;

  return (
    <div className={`card ${isLarge ? "px-8 py-8" : "px-5 py-4"}`}>
      <p className={`text-center font-semibold uppercase tracking-widest text-gray-400 ${isLarge ? "text-[11px] mb-6" : "text-[10px] mb-3"}`}>
        Our Sponsors
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8">
        {sponsors.map((s) => {
          const inner = s.logo_url ? (
            <Image
              src={s.logo_url}
              alt={s.name}
              width={logoWidth}
              height={logoHeight}
              className="object-contain"
              style={{ maxHeight: logoHeight, width: "auto" }}
            />
          ) : (
            <span className={`font-bold text-brand ${isLarge ? "text-xl" : "text-sm"}`}>
              {s.name}
            </span>
          );

          const wrapperCls = `flex items-center justify-center ${isLarge ? "px-6 py-4" : "px-3 py-2"}`;

          return s.website_url ? (
            <a
              key={s.id}
              href={s.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${wrapperCls} opacity-80 hover:opacity-100 transition-opacity`}
              title={s.name}
            >
              {inner}
            </a>
          ) : (
            <div key={s.id} className={`${wrapperCls} opacity-80`} title={s.name}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
