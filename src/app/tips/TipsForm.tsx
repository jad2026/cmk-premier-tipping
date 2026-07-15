"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Fixture } from "@/lib/supabase/types";
import TeamBadge from "@/components/TeamBadge";
import MarginWheel, { type MarginWheelHandle } from "@/components/MarginWheel";
import type { RoundData } from "./page";

// ── Mobile scroll-snap margin picker ────────────────────────────────────────

const PICKER_MAX = 50;
const PICKER_ITEM_H = 36;
const PICKER_VISIBLE = 5;
const PICKER_HEIGHT = PICKER_ITEM_H * PICKER_VISIBLE;
const PICKER_PAD = Math.floor(PICKER_VISIBLE / 2) * PICKER_ITEM_H;

function buildPickerItems(homeName: string, awayName: string) {
  const items: { label: string; value: number }[] = [];
  for (let i = PICKER_MAX; i >= 1; i--) items.push({ label: `${homeName} by ${i}`, value: i });
  items.push({ label: "Draw", value: 0 });
  for (let i = 1; i <= PICKER_MAX; i++) items.push({ label: `${awayName} by ${i}`, value: -i });
  return items;
}

function MobileMarginPicker({
  homeName,
  awayName,
  homeColor,
  awayColor,
  value,
  onChange,
  disabled,
}: {
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const items = useRef(buildPickerItems(homeName, awayName)).current;
  const scrollRef = useRef<HTMLDivElement>(null);
  const settling = useRef(true);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const valueToIndex = (v: number) => {
    if (v > 0) return PICKER_MAX - v;
    if (v < 0) return PICKER_MAX + Math.abs(v);
    return PICKER_MAX;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = valueToIndex(value) * PICKER_ITEM_H;
    const id = setTimeout(() => { settling.current = false; }, 80);
    return () => clearTimeout(id);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || disabled || settling.current) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / PICKER_ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      onChange(items[clamped].value);
    }, 60);
  }, [disabled, onChange, items]);

  useEffect(() => () => clearTimeout(debounce.current), []);

  useEffect(() => {
    if (settling.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const targetIdx = valueToIndex(value);
    const targetTop = targetIdx * PICKER_ITEM_H;
    if (Math.abs(el.scrollTop - targetTop) > 2) {
      settling.current = true;
      el.scrollTo({ top: targetTop, behavior: "smooth" });
      setTimeout(() => { settling.current = false; }, 200);
    }
  }, [value]);

  const centerColor = value > 0 ? (homeColor || "var(--accent)") : value < 0 ? (awayColor || "var(--accent)") : "var(--accent)";

  return (
    <div
      style={{
        position: "relative",
        height: PICKER_HEIGHT,
        overflow: "hidden",
        background: "#FAFAF8",
        borderBottom: "1px solid #EFEDE6",
      }}
    >
      {/* Centre highlight band */}
      <div
        style={{
          position: "absolute",
          top: PICKER_PAD,
          left: 0,
          right: 0,
          height: PICKER_ITEM_H,
          background: `color-mix(in srgb, ${centerColor} 12%, transparent)`,
          borderTop: `1px solid color-mix(in srgb, ${centerColor} 25%, transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${centerColor} 25%, transparent)`,
          pointerEvents: "none",
          zIndex: 2,
          transition: "background .15s, border-color .15s",
        }}
      />

      {/* Top/bottom fade masks */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: PICKER_PAD, background: "linear-gradient(to bottom, #FAFAF8 0%, transparent 100%)", pointerEvents: "none", zIndex: 3 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: PICKER_PAD, background: "linear-gradient(to top, #FAFAF8 0%, transparent 100%)", pointerEvents: "none", zIndex: 3 }} />

      {/* Scrollable list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="mobile-margin-picker"
        style={{
          height: PICKER_HEIGHT,
          overflowY: disabled ? "hidden" : "auto",
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          touchAction: "pan-y",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ height: PICKER_PAD }} />
        {items.map((item, i) => {
          const dist = Math.abs(i - valueToIndex(value));
          const isCenter = dist === 0;
          const opacity = isCenter ? 1 : dist === 1 ? 0.7 : dist === 2 ? 0.45 : 0.3;
          const fontSize = isCenter ? 15 : 13;
          const fontWeight = isCenter ? 800 : 600;
          const color = isCenter ? centerColor : "#555";
          return (
            <div
              key={item.value}
              style={{
                height: PICKER_ITEM_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scrollSnapAlign: "center",
                fontSize,
                fontWeight,
                color,
                opacity,
                userSelect: "none",
                WebkitUserSelect: "none",
                textAlign: "center",
                transition: "opacity .1s",
                fontFamily: "var(--font-archivo-black), 'Archivo Black', sans-serif",
                textTransform: "uppercase",
                letterSpacing: ".02em",
              }}
            >
              {item.label}
            </div>
          );
        })}
        <div style={{ height: PICKER_PAD }} />
      </div>

      <style>{`
        .mobile-margin-picker::-webkit-scrollbar{display:none}
        .mobile-margin-picker{scrollbar-width:none}
      `}</style>
    </div>
  );
}

type Props = {
  rounds: RoundData[];
  userId: string;
  compLabel: string;
  timezone: string;
  locale: string;
  marginPicking?: boolean;
};

function useCountdown(deadline: string) {
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
  const expired = diff === 0;
  return { d, h, m, s, expired, diff };
}

function formatCountdown(d: number, h: number, m: number, s: number) {
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return mobile;
}

export default function TipsForm({ rounds, compLabel, timezone, locale, marginPicking = false }: Props) {
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rounds.flatMap((r) =>
        r.existingPicks
          .filter((p) => p.picked_team_id !== null || p.picked_draw)
          .map((p) => [p.fixture_id, p.picked_draw ? "draw" : p.picked_team_id!])
      )
    )
  );
  const [margins, setMargins] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      rounds.flatMap((r) =>
        r.existingPicks
          .filter((p) => typeof p.predicted_margin === "number")
          .map((p) => [p.fixture_id, p.predicted_margin as number])
      )
    )
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const now = new Date();

  function isRoundDeadlinePassed(deadline: string) {
    return now > new Date(deadline);
  }

  function isFixtureResulted(fixture: Fixture) {
    return fixture.result_team_id !== null || fixture.is_draw;
  }

  function selectPick(fixtureId: string, value: string, deadline: string, resultLocked: boolean) {
    if (isRoundDeadlinePassed(deadline) || resultLocked) return;
    setPicks((prev) => ({ ...prev, [fixtureId]: value }));
    setSaved(false);
  }

  function handleWheelChange(fixtureId: string, value: number, homeTeamId: string, awayTeamId: string, deadline: string, resultLocked: boolean) {
    if (isRoundDeadlinePassed(deadline) || resultLocked) return;
    if (value > 0) {
      setPicks((prev) => ({ ...prev, [fixtureId]: homeTeamId }));
    } else if (value < 0) {
      setPicks((prev) => ({ ...prev, [fixtureId]: awayTeamId }));
    } else {
      setPicks((prev) => ({ ...prev, [fixtureId]: "draw" }));
    }
    setMargins((prev) => ({ ...prev, [fixtureId]: Math.abs(value) }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const allFixturesWithDeadline = rounds.flatMap((r) =>
        r.fixtures.map((f) => ({ fixture: f, deadline: r.deadline }))
      );
      const saveable = Object.entries(picks).filter(([fixtureId]) => {
        const entry = allFixturesWithDeadline.find(({ fixture }) => fixture.id === fixtureId);
        if (!entry) return false;
        return !isRoundDeadlinePassed(entry.deadline) && !isFixtureResulted(entry.fixture);
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not signed in."); return; }

      for (const [fixtureId, value] of saveable) {
        const isDraw = value === "draw";
        const margin = isDraw ? null : (margins[fixtureId] ?? null);
        const { error: upsertError } = await supabase
          .from("picks")
          .upsert(
            {
              fixture_id: fixtureId,
              user_id: user.id,
              picked_team_id: isDraw ? null : value,
              picked_draw: isDraw,
              auto_picked: false,
              is_correct: null,
              predicted_margin: margin,
              margin_correct: null,
              points: 0,
            },
            { onConflict: "fixture_id,user_id" }
          );
        if (upsertError) {
          setError(upsertError.message);
          return;
        }
      }
      setSaved(true);
    });
  }

  const allFixtures = rounds.flatMap((r) => r.fixtures);
  const hasAnyPickable = rounds.some(
    (r) => !isRoundDeadlinePassed(r.deadline) && r.fixtures.some((f) => !isFixtureResulted(f))
  );
  const totalPickable = allFixtures.filter((f) => !isFixtureResulted(f)).length;
  const pickedCount = Object.keys(picks).filter((fid) => {
    const f = allFixtures.find((x) => x.id === fid);
    return f && !isFixtureResulted(f);
  }).length;
  const allPicked = totalPickable > 0 && pickedCount === totalPickable;
  const progressPct = totalPickable > 0 ? (pickedCount / totalPickable) * 100 : 0;

  const primaryRound = rounds[0];
  const primaryDeadline = primaryRound?.deadline ?? new Date().toISOString();

  if (allFixtures.length === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="text-md-text-secondary">No fixtures scheduled for the open rounds yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Dark header section ─────────────────────────────────────────── */}
      <TipsHeader
        rounds={rounds}
        deadline={primaryDeadline}
        compLabel={compLabel}
        timezone={timezone}
        locale={locale}
      />

      {/* ── Sticky progress bar ─────────────────────────────────────────── */}
      <div
        className="sticky z-40"
        style={{
          top: 74,
          background: "rgba(242,240,234,.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid #E0DDD3",
        }}
      >
        <div className="max-w-content-inner mx-auto flex items-center gap-[18px]" style={{ padding: "14px 32px" }}>
          <div className="flex-1 h-2 rounded-full bg-[#E2DFD5] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%`, background: "var(--accent)" }}
            />
          </div>
          <span className="text-[13px] font-extrabold tracking-[.02em] text-[#5A5546] whitespace-nowrap">
            {pickedCount} / {totalPickable} tipped
          </span>
        </div>
      </div>

      {/* ── Match cards ─────────────────────────────────────────────────── */}
      <section className="max-w-content-inner mx-auto flex flex-col gap-2 sm:gap-4" style={{ padding: "20px 16px 32px" }}>
        {rounds.map((round) => {
          const isPastDeadline = isRoundDeadlinePassed(round.deadline);
          return round.fixtures.map((fixture) => (
            <FixtureCard
              key={fixture.id}
              fixture={fixture}
              picks={picks}
              margins={margins}
              marginPicking={marginPicking}
              isPastDeadline={isPastDeadline}
              compact={isMobile}
              onSelect={(value) =>
                selectPick(fixture.id, value, round.deadline, fixture.result_team_id !== null && !fixture.is_draw)
              }
              onWheelChange={(value) =>
                handleWheelChange(fixture.id, value, fixture.home_team_id, fixture.away_team_id, round.deadline, fixture.result_team_id !== null || fixture.is_draw)
              }
              timezone={timezone}
              locale={locale}
            />
          ));
        })}
      </section>

      {/* ── Sticky bottom action bar ────────────────────────────────────── */}
      {hasAnyPickable && (
        <div
          className="sticky bottom-0 z-40"
          style={{
            background: "rgba(13,16,22,.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(255,255,255,.1)",
          }}
        >
          <div className="max-w-content-inner mx-auto flex items-center justify-between gap-5" style={{ padding: "16px 32px" }}>
            <div className="text-white min-w-0">
              <div className="font-display text-[18px] uppercase leading-none">
                {pickedCount} of {totalPickable} tipped
              </div>
              <div className="text-[13px] text-[#8C93A0] mt-1">
                {saved
                  ? "Tips saved successfully!"
                  : allPicked
                  ? "All picks made — lock them in!"
                  : `Pick ${totalPickable - pickedCount} more to lock in your tips`}
              </div>
              {error && <div className="text-[13px] text-loss-red mt-1">{error}</div>}
            </div>
            <button
              onClick={handleSave}
              disabled={isPending || pickedCount === 0}
              className="shrink-0 inline-flex items-center gap-2.5 rounded-[12px] text-[16px] font-extrabold uppercase tracking-[.02em] transition-all duration-150 disabled:cursor-not-allowed"
              style={{
                padding: "16px 34px",
                ...(saved
                  ? { background: "#2CC36B", color: "#fff" }
                  : allPicked
                  ? { background: "var(--accent)", color: "var(--accent-text)" }
                  : { background: "rgba(255,255,255,.14)", color: "#737A86" }),
              }}
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                "Tips locked ✓"
              ) : (
                "Lock in tips →"
              )}
            </button>
          </div>
        </div>
      )}

      {!hasAnyPickable && (
        <div className="max-w-content-inner mx-auto pb-8" style={{ padding: "0 32px 32px" }}>
          <div className="card px-5 py-3.5 flex items-center gap-3">
            <span className="text-md-text-muted text-base">🔒</span>
            <p className="text-sm font-medium text-md-text-secondary">
              All fixtures are locked — no picks can be changed.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tips dark header ─────────────────────────────────────────────────────────

function TipsHeader({ rounds, deadline, compLabel, timezone, locale }: { rounds: RoundData[]; deadline: string; compLabel: string; timezone: string; locale: string }) {
  const { d, h, m, s, expired } = useCountdown(deadline);
  const primaryRound = rounds[0];

  return (
    <section className="bg-ink text-white">
      <div className="max-w-content-inner mx-auto" style={{ padding: "40px 32px 34px" }}>
        {/* Pulsing dot + eyebrow */}
        <div className="flex items-center gap-3 mb-[18px]">
          <span
            className="w-[9px] h-[9px] rounded-full bg-live-green shrink-0"
            style={{ animation: "pulseDot 1.6s ease-in-out infinite" }}
          />
          <span className="text-[12px] font-extrabold tracking-[.18em] uppercase text-live-green">
            Open · {compLabel}
          </span>
        </div>

        {/* Title + countdown */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-display text-[60px] leading-[.86] uppercase m-0">
              {rounds.length === 1 ? `Round ${primaryRound.number}` : `${rounds.length} Rounds`}
              <span style={{ color: "var(--accent)" }}>.</span>
            </h1>
            <p className="text-[16px] text-[#AEB4BE] mt-[14px]">
              Pick a winner in every match. Tips lock at the first kickoff.
            </p>
          </div>
          {!expired && (
            <div className="flex gap-2.5 items-center">
              <div className="text-right">
                <div className="text-[11px] font-bold tracking-[.14em] uppercase text-[#8C93A0]">Tips close</div>
                <div className="text-[15px] font-bold text-[#E6E8EC]">
                  {new Date(deadline).toLocaleString(locale, {
                    timeZone: timezone,
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <div
                className="min-w-[78px] px-3.5 py-3 rounded-[12px] text-center"
                style={{
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.12)",
                }}
              >
                <div className="font-display text-[26px] leading-none" style={{ color: "var(--accent)" }}>
                  {formatCountdown(d, h, m, s)}
                </div>
                <div className="text-[10px] font-bold tracking-[.12em] uppercase text-[#8C93A0] mt-1">
                  to lock
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── FixtureCard ──────────────────────────────────────────────────────────────

function FixtureCard({
  fixture,
  picks,
  margins,
  marginPicking,
  isPastDeadline,
  compact,
  onSelect,
  onWheelChange,
  timezone,
  locale,
}: {
  fixture: Fixture;
  picks: Record<string, string>;
  margins: Record<string, number>;
  marginPicking: boolean;
  isPastDeadline: boolean;
  compact: boolean;
  onSelect: (value: string) => void;
  onWheelChange: (value: number) => void;
  timezone: string;
  locale: string;
}) {
  const home = fixture.home_team!;
  const away = fixture.away_team!;
  const picked = picks[fixture.id];
  const homePicked = picked === home.id;
  const awayPicked = picked === away.id;
  const drawPicked = picked === "draw";
  const resultLocked = fixture.result_team_id !== null || fixture.is_draw;
  const isLocked = resultLocked || isPastDeadline;
  const hasSelection = homePicked || awayPicked || drawPicked;

  const wheelRef = useRef<MarginWheelHandle>(null);

  const wheelInitial = (() => {
    if (!picked) return 0;
    const m = margins[fixture.id] ?? 7;
    if (homePicked) return m;
    if (awayPicked) return -m;
    return 0;
  })();

  const cardBorder = hasSelection && !resultLocked ? "var(--accent)" : "#E4E1D8";

  return (
    <div
      className="overflow-hidden rounded-xl sm:rounded-2xl"
      style={{
        background: "#fff",
        border: `1px solid ${cardBorder}`,
        boxShadow: "0 1px 2px rgba(17,21,28,.04)",
        opacity: resultLocked ? 0.7 : 1,
      }}
    >
      {/* Header strip */}
      <div
        className="flex items-center justify-between"
        style={{ padding: compact ? "6px 10px" : "8px 12px", background: "#FAF9F5", borderBottom: "1px solid #EFEDE6" }}
      >
        <span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#A39E8C]">
          {fixture.venue || "TBC"}
        </span>
        <span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#A39E8C]">
          {new Date(fixture.match_date).toLocaleString(locale, {
            timeZone: timezone,
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* ── Wheel mode (NPC margin picking) ────────────────────────────── */}
      {marginPicking && !resultLocked && (
        <>
          {compact ? (
            /* Mobile: inline scroll-snap picker */
            <MobileMarginPicker
              homeName={home.name}
              awayName={away.name}
              homeColor={home.colour}
              awayColor={away.colour}
              value={wheelInitial}
              onChange={onWheelChange}
              disabled={isLocked}
            />
          ) : (
            /* Desktop: team rows + MarginWheel */
            <>
              {/* Home team row */}
              <button
                onClick={() => { wheelRef.current?.scrollTo(7); onWheelChange(7); }}
                disabled={isLocked}
                className="w-full flex items-center gap-2 text-left transition-all duration-150 disabled:cursor-not-allowed"
                style={{
                  padding: "6px 12px",
                  background: homePicked
                    ? `color-mix(in srgb, ${home.colour || "var(--accent)"} 6%, #fff)`
                    : "#fff",
                  borderLeft: homePicked ? `4px solid ${home.colour || "var(--accent)"}` : "4px solid transparent",
                  borderBottom: "1px solid #EFEDE6",
                  opacity: awayPicked ? 0.5 : 1,
                }}
              >
                <TeamBadge team={home} size="xs" />
                <span className="font-display text-[14px] leading-none uppercase truncate flex-1 min-w-0">{home.name}</span>
                {homePicked ? (
                  <span className="text-[11px] shrink-0" style={{ color: home.colour || "var(--accent)" }}>✓</span>
                ) : (
                  <span className="text-[9px] text-[#B4B0A2] font-bold tracking-wide uppercase shrink-0">▲</span>
                )}
              </button>

              <div className="px-3 sm:px-5" style={{ background: "#fff" }}>
                <MarginWheel
                  ref={wheelRef}
                  initialValue={wheelInitial}
                  onChange={onWheelChange}
                  homeColor={home.colour}
                  awayColor={away.colour}
                  disabled={isLocked}
                  compact={compact}
                />
              </div>

              {/* Away team row */}
              <button
                onClick={() => { wheelRef.current?.scrollTo(-7); onWheelChange(-7); }}
                disabled={isLocked}
                className="w-full flex items-center gap-2 text-left transition-all duration-150 disabled:cursor-not-allowed"
                style={{
                  padding: "6px 12px",
                  background: awayPicked
                    ? `color-mix(in srgb, ${away.colour || "var(--accent)"} 6%, #fff)`
                    : "#fff",
                  borderLeft: awayPicked ? `4px solid ${away.colour || "var(--accent)"}` : "4px solid transparent",
                  borderBottom: "1px solid #EFEDE6",
                  opacity: homePicked ? 0.5 : 1,
                }}
              >
                <TeamBadge team={away} size="xs" />
                <span className="font-display text-[14px] leading-none uppercase truncate flex-1 min-w-0">{away.name}</span>
                {awayPicked ? (
                  <span className="text-[11px] shrink-0" style={{ color: away.colour || "var(--accent)" }}>✓</span>
                ) : (
                  <span className="text-[9px] text-[#B4B0A2] font-bold tracking-wide uppercase shrink-0">▼</span>
                )}
              </button>
            </>
          )}

          {/* Prediction label */}
          <div
            className="flex items-center justify-center"
            style={{
              padding: compact ? "3px 10px" : "5px 12px",
              background: "#FAF9F5",
            }}
          >
            {hasSelection ? (
              <span
                className="font-display text-[12px] sm:text-[14px] uppercase"
                style={{ color: "var(--accent)" }}
              >
                {drawPicked
                  ? "Draw"
                  : `${homePicked ? home.name : away.name} by ${margins[fixture.id] ?? 0}`}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#C7C2B5]">
                ↕ Scroll to pick
              </span>
            )}
          </div>
        </>
      )}

      {/* ── Button mode (CMK / default) ────────────────────────────────── */}
      {!marginPicking && (
        <>
          {/* 3-col: Home | VS | Away */}
          <div className="grid grid-cols-[1fr_64px_1fr] sm:grid-cols-[1fr_64px_1fr]">
            {/* Home button */}
            <button
              onClick={() => onSelect(home.id)}
              disabled={isLocked}
              className="flex items-center gap-[14px] text-left transition-colors duration-150 disabled:cursor-not-allowed"
              style={{
                padding: compact ? "14px 16px" : "20px 22px",
                background: homePicked && !resultLocked ? "rgba(44,159,212,.10)" : "#fff",
                boxShadow: homePicked && !resultLocked ? "inset 4px 0 0 #2C9FD4" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isLocked && !homePicked) e.currentTarget.style.background = "#FBFAF6";
              }}
              onMouseLeave={(e) => {
                if (!isLocked && !homePicked) e.currentTarget.style.background = "#fff";
              }}
            >
              <TeamBadge team={home} size="lg" className="!w-[46px] !h-[46px]" />
              <span className="flex flex-col items-start min-w-0">
                <span className="font-display text-[19px] leading-none uppercase truncate max-w-full">
                  {home.name}
                </span>
                <span className="text-[12px] text-md-text-muted mt-1 font-semibold">Home</span>
              </span>
              {homePicked && !resultLocked && (
                <span
                  className="ml-auto w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-extrabold shrink-0"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  ✓
                </span>
              )}
            </button>

            {/* VS divider */}
            <div
              className="flex items-center justify-center"
              style={{
                background: "#F4F2EC",
                borderLeft: "1px solid #EFEDE6",
                borderRight: "1px solid #EFEDE6",
              }}
            >
              <span className="font-display text-[13px] text-[#B4B0A2] tracking-[.05em]">VS</span>
            </div>

            {/* Away button */}
            <button
              onClick={() => onSelect(away.id)}
              disabled={isLocked}
              className="flex items-center gap-[14px] text-right justify-end transition-colors duration-150 disabled:cursor-not-allowed"
              style={{
                padding: compact ? "14px 16px" : "20px 22px",
                background: awayPicked && !resultLocked ? "rgba(44,159,212,.10)" : "#fff",
                boxShadow: awayPicked && !resultLocked ? "inset -4px 0 0 #2C9FD4" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isLocked && !awayPicked) e.currentTarget.style.background = "#FBFAF6";
              }}
              onMouseLeave={(e) => {
                if (!isLocked && !awayPicked) e.currentTarget.style.background = "#fff";
              }}
            >
              {awayPicked && !resultLocked && (
                <span
                  className="mr-auto w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-extrabold shrink-0"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  ✓
                </span>
              )}
              <span className="flex flex-col items-end min-w-0">
                <span className="font-display text-[19px] leading-none uppercase truncate max-w-full">
                  {away.name}
                </span>
                <span className="text-[12px] text-md-text-muted mt-1 font-semibold">Away</span>
              </span>
              <TeamBadge team={away} size="lg" className="!w-[46px] !h-[46px]" />
            </button>
          </div>

          {/* Draw option row */}
          {!resultLocked && (
            <button
              onClick={() => onSelect("draw")}
              disabled={isLocked}
              className={`w-full flex items-center justify-center gap-2 ${compact ? "py-2" : "py-3"} text-[13px] font-bold uppercase tracking-[.06em] transition-colors duration-150 disabled:cursor-not-allowed`}
              style={{
                borderTop: "1px solid #EFEDE6",
                background: drawPicked ? "var(--accent-wash)" : "#FAF9F5",
                boxShadow: drawPicked ? "inset 0 0 0 2px var(--accent)" : "none",
                color: drawPicked ? "var(--accent)" : "#A39E8C",
              }}
            >
              Draw
              {drawPicked && (
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-extrabold"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  ✓
                </span>
              )}
            </button>
          )}
        </>
      )}

      {/* Locked footer */}
      {resultLocked && (
        <div className="flex items-center gap-2" style={{ padding: compact ? "8px 14px" : "10px 22px", borderTop: "1px solid #EFEDE6", background: "#FAF9F5" }}>
          {drawPicked ? (
            <p className="text-xs text-md-text-muted">Your pick: <span className="font-semibold text-md-text">Draw</span></p>
          ) : picked ? (
            <>
              <TeamBadge team={homePicked ? home : away} size="xs" />
              <p className="text-xs text-md-text-muted">
                Your pick: <span className="font-semibold text-md-text">
                  {homePicked ? home.name : away.name}
                  {marginPicking && margins[fixture.id] ? ` by ${margins[fixture.id]}` : ""}
                </span>
              </p>
            </>
          ) : (
            <p className="text-xs text-md-text-muted italic">No pick submitted for this fixture.</p>
          )}
        </div>
      )}
    </div>
  );
}
