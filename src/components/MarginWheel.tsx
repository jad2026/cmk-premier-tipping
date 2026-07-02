"use client";

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";

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
};

const MarginWheel = forwardRef<MarginWheelHandle, Props>(function MarginWheel(
  { initialValue = 0, onChange, homeColor, awayColor, disabled, compact = false },
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

  const centerColor =
    current > 0
      ? homeColor || "#11151C"
      : current < 0
      ? awayColor || "#11151C"
      : "#8B8676";

  const trackH = HEIGHT - 12;
  const thumbH = Math.max(10, trackH * (VISIBLE / TOTAL));
  const scrollFraction = (MAX - current) / (TOTAL - 1);
  const thumbY = 6 + scrollFraction * (trackH - thumbH);

  const maskPcts = compact
    ? "rgba(0,0,0,.2), transparent 30%, transparent 70%, rgba(0,0,0,.2)"
    : "rgba(0,0,0,.15), rgba(0,0,0,.4) 20%, transparent 40%, transparent 60%, rgba(0,0,0,.4) 80%, rgba(0,0,0,.15)";
  const maskVal = `linear-gradient(to bottom, ${maskPcts})`;

  return (
    <div style={{ position: "relative", height: HEIGHT, overflow: "hidden" }}>
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
          color: "#C7C2B5",
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
          color: "#C7C2B5",
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
          background: "rgba(0,0,0,.06)",
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
            background: scrolling ? "rgba(0,0,0,.25)" : "rgba(0,0,0,.12)",
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
          background: "rgba(0,0,0,.03)",
          borderTop: "1px solid #E4E1D8",
          borderBottom: "1px solid #E4E1D8",
          pointerEvents: "none",
          zIndex: 2,
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
            fontSize: compact ? 18 : 22,
            color: centerColor,
            transition: "color .15s, transform .12s",
            transform: scrolling ? "scale(1.18)" : "scale(1)",
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
          maskImage: maskVal,
          WebkitMaskImage: maskVal,
        }}
      >
        <div style={{ height: PAD }} />
        {VALUES.map((n) => (
          <div
            key={n}
            style={{
              height: ITEM_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              scrollSnapAlign: "center",
              fontSize: compact ? 12 : 14,
              fontWeight: 600,
              color: "#B4B0A2",
              borderBottom: "1px solid #F0EDE5",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {Math.abs(n)}
          </div>
        ))}
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
