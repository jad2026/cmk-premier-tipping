import Image from "next/image";
import type { Sponsor } from "@/lib/supabase/types";

type Props = {
  sponsors: Sponsor[];
  variant?: "large" | "small";
};

export default function SponsorBanner({ sponsors, variant = "large" }: Props) {
  if (sponsors.length === 0) return null;

  const isLarge = variant === "large";

  return (
    <div className={`card ${isLarge ? "px-6 py-5" : "px-5 py-4"}`}>
      <p className={`text-center font-semibold uppercase tracking-widest text-gray-400 mb-${isLarge ? "4" : "3"} ${isLarge ? "text-[11px]" : "text-[10px]"}`}>
        Our Sponsors
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {sponsors.map((s) => {
          const inner = s.logo_url ? (
            <Image
              src={s.logo_url}
              alt={s.name}
              width={isLarge ? 120 : 80}
              height={isLarge ? 48 : 32}
              className="object-contain max-h-12"
              style={{ maxHeight: isLarge ? 48 : 32 }}
            />
          ) : (
            <span className={`font-bold text-brand ${isLarge ? "text-base" : "text-sm"}`}>
              {s.name}
            </span>
          );

          return s.website_url ? (
            <a
              key={s.id}
              href={s.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 hover:opacity-100 transition-opacity"
              title={s.name}
            >
              {inner}
            </a>
          ) : (
            <div key={s.id} className="opacity-80" title={s.name}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
