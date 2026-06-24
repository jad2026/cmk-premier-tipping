import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { fetchLeagueLeaderboard } from "../actions";

export const dynamic = "force-dynamic";

function displayName(entry: { display_name: string | null; first_name: string | null; last_name: string | null }) {
  if (entry.display_name) return entry.display_name;
  const parts = [entry.first_name, entry.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown";
}

export default async function LeagueLeaderboardPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const compId = await getCurrentCompetitionId();
  const { league, entries } = await fetchLeagueLeaderboard(params.id, compId);

  if (!league) {
    return (
      <div className="card px-8 py-16 text-center max-w-lg mx-auto mt-8">
        <h1 className="text-xl font-bold text-brand mb-2">League Not Found</h1>
        <Link href="/leagues" className="btn-primary inline-flex mt-4">Back to Leagues</Link>
      </div>
    );
  }

  const noRoundsPlayed = entries.length > 0 && entries.every((e) => e.total === 0);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">League Leaderboard</p>
          <h1 className="text-2xl font-bold tracking-tight text-brand">{league.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Invite code: <span className="font-mono font-bold text-gray-800">{league.invite_code}</span>
          </p>
        </div>
        <Link href="/leagues" className="btn-ghost text-sm">← All Leagues</Link>
      </div>

      <div className="card p-6">
        {noRoundsPlayed && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
            No rounds played yet — scores will appear here once the first round is complete.
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-3 text-gray-500 font-medium w-8">#</th>
                  <th className="text-left pb-3 text-gray-500 font-medium">Player</th>
                  <th className="text-right pb-3 text-gray-500 font-medium">Correct</th>
                  <th className="text-right pb-3 text-gray-500 font-medium">Picked</th>
                  <th className="text-right pb-3 text-gray-500 font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry, i) => {
                  const pct = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
                  const isFirst = i === 0 && entry.total > 0;
                  return (
                    <tr key={entry.user_id} className={isFirst ? "bg-brand-gold/5" : ""}>
                      <td className="py-3 text-gray-400 font-medium">
                        {isFirst ? "🏆" : i + 1}
                      </td>
                      <td className="py-3 font-semibold text-gray-900">
                        {displayName(entry)}
                        {entry.user_id === user.id && (
                          <span className="ml-2 text-xs text-brand/60 font-normal">(you)</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-bold text-brand tabular-nums">{entry.correct}</td>
                      <td className="py-3 text-right text-gray-500 tabular-nums">{entry.total}</td>
                      <td className="py-3 text-right text-gray-400 tabular-nums">{entry.total > 0 ? `${pct}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
