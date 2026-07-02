"use client";

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle, useMemo } from "react";

const ITEM_H = 28;
const MAX = 100;
const TOTAL = MAX * 2 + 1;

const VALUES = Array.from({ length: TOTAL }, (_, i) => MAX - i);

export type MarginWheelHandle = { scrollTo(v: number): void };

type Props = {
  initialValue?: number;
  onChange: (value: number) => void;
  homeColor?: string;
  awayColor?: string;
  disabled?: boolean;
  compact?: boolean;
  accentColor?: string;
};

const MarginWheel = forwardRef<MarginWheelHandle, Props>(function MarginWheel(
  { initialValue = 0, onChange, homeColor, awayColor, disabled, compact = false, accentColor },
  ref,
) {
  const VISIBLE = compact ? 3 : 5;
  const HEIGHT = ITEM_H * VISIBLE;
  const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

  const el = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(initialValue);
  const [scrolling, setScrolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout>>();
  const frame = useRef<number>();
  const settling = useRef(true);

  const scroll = useCallback((v: number, smooth = true) => {
    el.current?.scrollTo({
      top: (MAX - v) * ITEM_H,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  useImperativeHandle(ref, () => ({
    scrollTo(v: number) {
      settling.current = false;
      scroll(v);
    },
  }), [scroll]);

  useEffect(() => {
    scroll(initialValue, false);
    const id = setTimeout(() => { settling.current = false; }, 60);
    return () => clearTimeout(id);
  }, []);

  const handleScroll = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setScrolling(true);
    clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => setScrolling(false), 150);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const e = el.current;
      if (!e || disabled) return;
      const idx = Math.round(e.scrollTop / ITEM_H);
      const v = MAX - Math.max(0, Math.min(TOTAL - 1, idx));
      setCurrent(v);
      if (settling.current) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(v), 80);
    });
  }, [disabled, onChange]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    clearTimeout(timer.current);
    clearTimeout(scrollEndTimer.current);
  }, []);

  const accent = accentColor || "var(--accent)";

  const centerColor =
    current > 0
      ? homeColor || accent
      : current < 0
      ? awayColor || accent
      : accent;

  const trackH = HEIGHT - 12;
  const thumbH = Math.max(10, trackH * (VISIBLE / TOTAL));
  const scrollFraction = (MAX - current) / (TOTAL - 1);
  const thumbY = 6 + scrollFraction * (trackH - thumbH);

  const half = Math.floor(VISIBLE / 2);

  const itemStyles = useMemo(() => {
    const styles: Record<number, { fontSize: number; fontWeight: number; color: string; opacity: number }> = {};
    for (const n of VALUES) {
      const dist = Math.abs(n - current);
      if (dist === 0) {
        styles[n] = { fontSize: 0, fontWeight: 800, color: "transparent", opacity: 0 };
      } else if (dist === 1) {
        styles[n] = { fontSize: compact ? 14 : 16, fontWeight: 700, color: "#333", opacity: 0.7 };
      } else if (dist === 2) {
        styles[n] = { fontSize: compact ? 12 : 14, fontWeight: 600, color: "#666", opacity: compact ? 0 : 0.5 };
      } else {
        styles[n] = { fontSize: compact ? 12 : 14, fontWeight: 600, color: "#999", opacity: 0.3 };
      }
    }
    return styles;
  }, [current, compact]);

  return (
    <div
      style={{
        position: "relative",
        height: HEIGHT,
        overflow: "hidden",
        borderRadius: 8,
        boxShadow: "inset 0 1px 3px rgba(0,0,0,.08)",
        border: "1px solid #E4E1D8",
        background: "#FAFAF8",
      }}
    >
      {/* Arrow hint top */}
      <div
        className="margin-wheel-arrow"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: compact ? 10 : 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 5,
          color: "#999",
          fontSize: compact ? 7 : 9,
        }}
      >
        ▲
      </div>

      {/* Arrow hint bottom */}
      <div
        className="margin-wheel-arrow"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: compact ? 10 : 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 5,
          color: "#999",
          fontSize: compact ? 7 : 9,
        }}
      >
        ▼
      </div>

      {/* Scrollbar track */}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 2,
          width: 3,
          height: trackH,
          borderRadius: 2,
          background: "rgba(0,0,0,.08)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: thumbY - 6,
            width: 3,
            height: thumbH,
            borderRadius: 2,
            background: scrolling ? "rgba(0,0,0,.3)" : "rgba(0,0,0,.15)",
            transition: "background .15s",
          }}
        />
      </div>

      {/* Centre highlight band */}
      <div
        style={{
          position: "absolute",
          top: PAD,
          left: 0,
          right: 0,
          height: ITEM_H,
          background: `color-mix(in srgb, ${centerColor} 12%, transparent)`,
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: `color-mix(in srgb, ${centerColor} 25%, transparent)`,
          pointerEvents: "none",
          zIndex: 2,
          transition: "background .15s, border-color .15s",
        }}
      />

      {/* Centre value overlay */}
      <div
        style={{
          position: "absolute",
          top: PAD,
          left: 0,
          right: 0,
          height: ITEM_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
            fontSize: compact ? 28 : 24,
            fontWeight: 800,
            color: centerColor,
            transition: "color .15s, transform .12s",
            transform: scrolling ? "scale(1.15)" : "scale(1)",
            display: "inline-block",
          }}
        >
          {Math.abs(current)}
        </span>
      </div>

      {/* Scrollable number strip */}
      <div
        ref={el}
        onScroll={handleScroll}
        className="margin-wheel"
        style={{
          height: HEIGHT,
          overflowY: disabled ? "hidden" : "auto",
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ height: PAD }} />
        {VALUES.map((n) => {
          const s = itemStyles[n];
          return (
            <div
              key={n}
              style={{
                height: ITEM_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scrollSnapAlign: "center",
                fontSize: s?.fontSize ?? 14,
                fontWeight: s?.fontWeight ?? 600,
                color: s?.color ?? "#999",
                opacity: s?.opacity ?? 0.3,
                borderBottom: "1px solid #ECEAE3",
                userSelect: "none",
                WebkitUserSelect: "none",
                transition: "opacity .1s, font-size .1s",
              }}
            >
              {Math.abs(n)}
            </div>
          );
        })}
        <div style={{ height: PAD }} />
      </div>

      <style>{`
        .margin-wheel::-webkit-scrollbar{display:none}
        .margin-wheel{scrollbar-width:none}
        @keyframes mw-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        .margin-wheel-arrow{animation:mw-bounce 1.8s ease-in-out infinite}
      `}</style>
    </div>
  );
});

export default MarginWheel;
