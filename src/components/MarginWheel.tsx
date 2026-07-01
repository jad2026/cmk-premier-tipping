"use client";

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";

const ITEM_H = 28;
const VISIBLE = 5;
const HEIGHT = ITEM_H * VISIBLE;
const MAX = 100;
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;
const TOTAL = MAX * 2 + 1;

const VALUES = Array.from({ length: TOTAL }, (_, i) => MAX - i);

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

  const centerColor =
    current > 0
      ? homeColor || "#11151C"
      : current < 0
      ? awayColor || "#11151C"
      : "#8B8676";

  return (
    <div style={{ position: "relative", height: HEIGHT, overflow: "hidden" }}>
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
            fontSize: 22,
            color: centerColor,
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
          overflowY: disabled ? "hidden" : "auto",
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          position: "relative",
          zIndex: 1,
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,.25), rgba(0,0,0,.45) 25%, transparent 42%, transparent 58%, rgba(0,0,0,.45) 75%, rgba(0,0,0,.25))",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,.25), rgba(0,0,0,.45) 25%, transparent 42%, transparent 58%, rgba(0,0,0,.45) 75%, rgba(0,0,0,.25))",
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
              fontSize: 14,
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

      <style>{`.margin-wheel::-webkit-scrollbar{display:none}.margin-wheel{scrollbar-width:none}`}</style>
    </div>
  );
});

export default MarginWheel;
