"use client";

import { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from "react";

const ITEM_H = 38;
const VISIBLE = 5;
const HEIGHT = ITEM_H * VISIBLE;
const MAX = 100;
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;
const TOTAL = MAX * 2 + 1;

const VALUES = Array.from({ length: TOTAL }, (_, i) => MAX - i);

const itemStyle: React.CSSProperties = {
  height: ITEM_H,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  scrollSnapAlign: "center",
  fontSize: 17,
  fontWeight: 600,
  color: "#B4B0A2",
  userSelect: "none",
  WebkitUserSelect: "none",
};

export type MarginWheelHandle = { scrollTo(v: number): void };

type Props = {
  initialValue?: number;
  onChange: (value: number) => void;
  homeColor?: string;
  awayColor?: string;
  disabled?: boolean;
};

const MarginWheel = forwardRef<MarginWheelHandle, Props>(function MarginWheel(
  { initialValue = 0, onChange, homeColor, awayColor, disabled },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout>>();
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
  }, []);

  const items = useMemo(
    () => VALUES.map((n) => <div key={n} style={itemStyle}>{Math.abs(n)}</div>),
    [],
  );

  const tint = current > 0 ? homeColor : current < 0 ? awayColor : undefined;
  const tintAlpha = tint ? Math.min(Math.abs(current) / 50, 0.12) : 0;

  return (
    <div style={{ position: "relative", height: HEIGHT, borderRadius: 12, overflow: "hidden" }}>
      {/* Team colour tint */}
      {tint && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: tint,
            opacity: tintAlpha,
            pointerEvents: "none",
            zIndex: 3,
            transition: "opacity .15s, background .2s",
          }}
        />
      )}

      {/* Centre highlight band with value overlay */}
      <div
        style={{
          position: "absolute",
          top: PAD,
          left: 0,
          right: 0,
          height: ITEM_H,
          background: "#fff",
          borderTop: "1.5px solid #E4E1D8",
          borderBottom: "1.5px solid #E4E1D8",
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
            fontSize: 26,
            color:
              current > 0
                ? homeColor || "#11151C"
                : current < 0
                ? awayColor || "#11151C"
                : "var(--accent, #D9A521)",
            transition: "color .15s",
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
          overflowY: disabled ? "hidden" : "scroll",
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          position: "relative",
          zIndex: 1,
          background: "#FAFAF7",
          maskImage:
            "linear-gradient(to bottom, transparent, rgba(0,0,0,.35) 28%, rgba(0,0,0,.35) 72%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, rgba(0,0,0,.35) 28%, rgba(0,0,0,.35) 72%, transparent)",
        }}
      >
        <div style={{ height: PAD }} />
        {items}
        <div style={{ height: PAD }} />
      </div>

      <style>{`.margin-wheel::-webkit-scrollbar{display:none}.margin-wheel{scrollbar-width:none}`}</style>
    </div>
  );
});

export default MarginWheel;
