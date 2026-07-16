"use client";

import { useState } from "react";
import Image from "next/image";
import type { Sponsor } from "@/lib/supabase/types";

type Props = {
  sponsors: Sponsor[];
  variant?: "large" | "small";
};

function SponsorItem({ s, isLarge }: { s: Sponsor; isLarge: boolean }) {
  const logoHeight = isLarge ? 150 : 40;

  const inner = s.logo_url ? (
    <div style={{ height: logoHeight, width: isLarge ? 300 : 140 }} className="relative">
      <Image
        src={s.logo_url}
        alt={s.name}
        fill
        className="object-contain"
        sizes={isLarge ? "300px" : "140px"}
      />
    </div>
  ) : (
    <span className={`font-bold ${isLarge ? "text-brand text-2xl" : "text-brand text-sm"}`}>
      {s.name}
    </span>
  );

  const cls = `flex items-center justify-center ${isLarge ? "px-10" : "px-4"}`;

  return s.website_url ? (
    <a
      href={s.website_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} opacity-70 hover:opacity-100 transition-opacity shrink-0`}
      title={s.name}
    >
      {inner}
    </a>
  ) : (
    <div className={`${cls} opacity-70 shrink-0`} title={s.name}>
      {inner}
    </div>
  );
}

export default function SponsorBanner({ sponsors, variant = "large" }: Props) {
  const [paused, setPaused] = useState(false);

  if (sponsors.length === 0) return null;

  const isLarge = variant === "large";

  // Small variant: static card
  if (!isLarge) {
    return (
      <div className="card px-5 py-4">
        <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Our Sponsors
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {sponsors.map((s) => <SponsorItem key={s.id} s={s} isLarge={false} />)}
        </div>
      </div>
    );
  }

  // Large variant: scrolling marquee on dark navy
  const trackStyle: React.CSSProperties = {
    animation: "sponsor-scroll 6s linear infinite",
    animationPlayState: paused ? "paused" : "running",
  };

  return (
    <div className="overflow-hidden py-6">
      <div
        className="flex"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          maskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Two copies for seamless loop */}
        <div className="flex items-center shrink-0" style={trackStyle}>
          {sponsors.map((s) => <SponsorItem key={s.id} s={s} isLarge />)}
        </div>
        <div className="flex items-center shrink-0" style={trackStyle} aria-hidden>
          {sponsors.map((s) => <SponsorItem key={s.id} s={s} isLarge />)}
        </div>
      </div>
    </div>
  );
}
