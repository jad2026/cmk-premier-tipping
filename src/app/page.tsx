import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: gameweeks } = await supabase
    .from("gameweeks")
    .select("*")
    .order("number");

  const openWeek = gameweeks?.find((gw) => gw.is_open);

  return (
    <div className="space-y-8">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative rounded-3xl bg-brand overflow-hidden shadow-card-lg">
        {/* Background image */}
        <Image
          src="/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover pointer-events-none"
        />
        {/* Dark navy overlay for text readability */}
        <div className="absolute inset-0 bg-brand-dark/75 pointer-events-none" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-hero-pattern pointer-events-none" />
        {/* Radial glow */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-60 h-60 rounded-full bg-brand-light/30 blur-3xl pointer-events-none" />

        <div className="relative px-8 sm:px-12 py-14 sm:py-16 text-center">
          <span className="inline-block mb-4 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/30 text-brand-gold text-xs font-semibold uppercase tracking-widest">
            2026 Season
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 leading-[1.1]">
            Club Rugby<br />
            <span className="text-brand-gold">Tipping</span>
          </h1>
          <p className="text-blue-200/80 text-lg mb-8 max-w-sm mx-auto">
            Pick the winners. Top the table. Win the glory.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link
              href="/tips"
              className="btn-gold shadow-lg"
            >
              Make Your Tips →
            </Link>
            <Link
              href="/leaderboard"
              className="btn-ghost"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Current round status ───────────────────────────────────────────── */}
      {openWeek ? (
        <section className="card-md px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Pulsing indicator */}
            <div className="relative shrink-0">
              <span className="flex w-10 h-10 items-center justify-center rounded-full bg-green-100 text-green-600 text-lg">
                🟢
              </span>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-70" />
            </div>
            <div>
              <p className="eyebrow mb-0.5">Open Now</p>
              <h2 className="text-lg font-bold text-brand leading-tight">
                {openWeek.label}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Deadline:{" "}
                {new Date(openWeek.deadline).toLocaleString("en-NZ", {
                  timeZone: "Pacific/Auckland",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <Link href="/tips" className="btn-primary shrink-0">
            Submit Tips
          </Link>
        </section>
      ) : (
        <section className="card px-6 py-5 text-center">
          <p className="text-gray-500 text-sm">
            No round is currently open for tipping. Check back soon!
          </p>
        </section>
      )}

      {/* ── All rounds ─────────────────────────────────────────────────────── */}
      {gameweeks && gameweeks.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
            <h2 className="text-base font-bold text-brand uppercase tracking-wide">
              All Rounds
            </h2>
          </div>

          <div className="card overflow-hidden divide-y divide-gray-50">
            {gameweeks.map((gw) => (
              <div
                key={gw.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
              >
                <span className="font-medium text-gray-800 text-sm">
                  {gw.label}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    gw.is_open
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {gw.is_open ? "● Open" : "Closed"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
