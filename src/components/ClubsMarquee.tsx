"use client";

import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";

export default function ClubsMarquee({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const half = track.scrollWidth / 2;
    if (half > 0) setDuration(half / 30);
  }, []);

  return (
    <>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .clubs-marquee::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        className="clubs-marquee"
        style={{
          overflow: "hidden",
          minWidth: 0,
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          ref={trackRef}
          className="flex flex-nowrap gap-[28px]"
          style={{
            animationName: duration > 0 ? "marquee-scroll" : undefined,
            animationDuration: duration > 0 ? `${duration}s` : undefined,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          {children}
          {children}
        </div>
      </div>
    </>
  );
}
