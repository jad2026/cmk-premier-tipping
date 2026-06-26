"use client";

import { useState, useEffect } from "react";

export function HomeCountdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, new Date(deadline).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  if (diff === 0) return null;

  const tiles = [
    { value: d, label: "Days" },
    { value: h, label: "Hrs" },
    { value: m, label: "Min" },
    { value: s, label: "Sec", accent: true },
  ];

  return (
    <div className="flex gap-2.5 flex-wrap">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="min-w-[84px] px-[18px] py-4 rounded-[13px] text-center"
          style={{
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
          }}
        >
          <div
            className="font-display text-[34px] leading-none"
            style={{ color: t.accent ? "var(--accent)" : "#fff" }}
          >
            {String(t.value).padStart(2, "0")}
          </div>
          <div className="text-[11px] font-bold tracking-[.14em] uppercase text-[#8C93A0] mt-1.5">
            {t.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeaturedCountdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, new Date(deadline).getTime() - now);
  if (diff === 0) return null;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  let text: string;
  if (d > 0) text = `${d}d ${h}h`;
  else if (h > 0) text = `${h}h ${m}m`;
  else text = `${m}:${String(s).padStart(2, "0")}`;

  return (
    <span className="font-display text-[22px] leading-none" style={{ color: "var(--accent)" }}>
      {text}
    </span>
  );
}
