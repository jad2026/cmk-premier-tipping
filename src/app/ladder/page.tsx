import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import Image from "next/image";

export const dynamic = "force-dynamic";

type LadderRow = {
  comp_id: string;
  team_id: string;
  team_name: string;
  position: number | null;
  matches_played: number | null;
  matches_won: number | null;
  matches_drawn: number | null;
  matches_lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points_diff: number | null;
  bonus_points: number | null;
  match_points: number | null;
  crest: string | null;
};

function val(n: number | null): string {
  return n != null ? String(n) : "—";
}

function signed(n: number | null): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

export default async function LadderPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _compId = await getCurrentCompetitionId();

  // Scope ladder to the active Xplorer competitions for this competition.
  // When a competition_id FK is added to the competitions table this can be
  // tightened; for now, is_active=true reliably selects the right comps.
  const { data: activeComps } = await supabase
    .from("competitions")
    .select("comp_id")
    .eq("is_active", true);
  const activeXplorerIds = (activeComps ?? []).map((c: { comp_id: string }) => c.comp_id);

  const { data: rows, error } = activeXplorerIds.length > 0
    ? await supabase
        .from("ladder_standings")
        .select(
          "comp_id, team_id, team_name, position, matches_played, matches_won, matches_drawn, matches_lost, points_for, points_against, points_diff, bonus_points, match_points, crest"
        )
        .in("comp_id", activeXplorerIds)
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (error) console.error("ladder_standings query error:", error);

  const standings = (rows ?? []) as LadderRow[];

  function compHeading(rows: LadderRow[]): string {
    const names = rows.map((r) => r.team_name.toLowerCase());
    if (names.some((n) => n.includes("women"))) return "CMK Premier Women";
    if (names.some((n) => n.includes("men"))) return "CMK Premier Men";
    return "CMK Premier";
  }

  // Group by comp_id so multiple competitions each get their own table
  const comps = Array.from(
    standings.reduce((map, row) => {
      if (!map.has(row.comp_id)) map.set(row.comp_id, { rows: [] });
      map.get(row.comp_id)!.rows.push(row);
      return map;
    }, new Map<string, { rows: LadderRow[] }>())
  );

  return (
    <div className="space-y-10">
      {/* Page heading */}
      <div>
        <p className="eyebrow mb-1">CMK Premier</p>
        <h1 className="text-2xl font-bold tracking-tight text-brand">Competition Ladder</h1>
      </div>

      {standings.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <span className="text-4xl mb-3 block">🏉</span>
          <p className="font-medium text-gray-600">No ladder data yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Standings will appear here once the ingest function has run.
          </p>
        </div>
      ) : (
        comps.map(([compId, { rows: compRows }]) => (
          <section key={compId} className="space-y-4">
            <div className="flex items-center gap-2.5 mb-0.5">
              <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
              <h2 className="text-lg font-bold text-brand tracking-tight">
                {compHeading(compRows)}
              </h2>
            </div>

            {/* Horizontally scrollable on mobile */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-brand text-white text-xs font-semibold uppercase tracking-wider">
                      <th className="px-3 py-3.5 text-center w-10">#</th>
                      <th className="px-4 py-3.5 text-left">Team</th>
                      <th className="px-3 py-3.5 text-center">P</th>
                      <th className="px-3 py-3.5 text-center">W</th>
                      <th className="px-3 py-3.5 text-center">D</th>
                      <th className="px-3 py-3.5 text-center">L</th>
                      <th className="px-3 py-3.5 text-center">PF</th>
                      <th className="px-3 py-3.5 text-center">PA</th>
                      <th className="px-3 py-3.5 text-center">PD</th>
                      <th className="px-3 py-3.5 text-center">BP</th>
                      <th className="px-3 py-3.5 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {compRows.map((row, idx) => (
                      <tr
                        key={row.team_id}
                        className={`transition-colors ${
                          idx % 2 === 0
                            ? "bg-white hover:bg-gray-50/70"
                            : "bg-[#f9fafb] hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm text-gray-400 tabular-nums font-medium">
                            {row.position ?? idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {row.crest ? (
                              <Image
                                src={row.crest}
                                alt={row.team_name}
                                width={24}
                                height={24}
                                className="w-6 h-6 object-contain shrink-0"
                                unoptimized
                              />
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-brand/10 shrink-0" />
                            )}
                            <span className="font-medium text-gray-800 whitespace-nowrap">
                              {row.team_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-600">
                          {val(row.matches_played)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums font-semibold text-green-700">
                          {val(row.matches_won)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-500">
                          {val(row.matches_drawn)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-red-500">
                          {val(row.matches_lost)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-600">
                          {val(row.points_for)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-600">
                          {val(row.points_against)}
                        </td>
                        <td className={`px-3 py-3 text-center tabular-nums font-medium ${
                          (row.points_diff ?? 0) > 0
                            ? "text-green-600"
                            : (row.points_diff ?? 0) < 0
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}>
                          {signed(row.points_diff)}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-500">
                          {val(row.bonus_points)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="tabular-nums font-bold text-brand">
                            {val(row.match_points)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-gray-400 text-right">
        Updated automatically every 10 minutes
      </p>
    </div>
  );
}
