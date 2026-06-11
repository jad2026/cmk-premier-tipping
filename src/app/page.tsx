import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: gameweeks } = await supabase
    .from("gameweeks")
    .select("*")
    .order("number");

  const openWeek = gameweeks?.find((gw) => gw.is_open);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-2xl bg-brand text-white px-8 py-12 text-center shadow-lg">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">
          CMK Premier Tipping
        </h1>
        <p className="text-brand-gold text-lg mb-6">
          Pick the winners. Top the table. Win the glory.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/tips"
            className="px-6 py-3 bg-brand-gold hover:bg-yellow-500 text-white font-semibold rounded-lg transition-colors"
          >
            Make Your Tips
          </Link>
          <Link
            href="/leaderboard"
            className="px-6 py-3 bg-white text-brand font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </section>

      {/* Current round status */}
      {openWeek ? (
        <section className="rounded-xl border border-brand-gold bg-yellow-50 px-6 py-5">
          <p className="text-sm text-yellow-700 font-medium uppercase tracking-wide mb-1">
            Open now
          </p>
          <h2 className="text-xl font-bold text-brand">
            {openWeek.label}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Deadline:{" "}
            {new Date(openWeek.deadline).toLocaleString("en-NZ", {
              timeZone: "Pacific/Auckland",
            })}
          </p>
          <Link
            href="/tips"
            className="inline-block mt-4 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-light transition-colors"
          >
            Submit Tips →
          </Link>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white px-6 py-5 text-center text-gray-500">
          No round is currently open for tipping. Check back soon!
        </section>
      )}

      {/* Rounds list */}
      {gameweeks && gameweeks.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-brand mb-3">All Rounds</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {gameweeks.map((gw) => (
              <li
                key={gw.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="font-medium text-gray-800">
                  {gw.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    gw.is_open
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {gw.is_open ? "Open" : "Closed"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
