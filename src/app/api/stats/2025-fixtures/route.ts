import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCompetitionTimezone } from "@/lib/competition";
import type { MatchFixture, MatchStats } from "@/app/stats/matchCentreTypes";

const NPC_2025_COMPETITION_ID = "aa056357-840d-41be-b311-afd2298d42ad";

function emptyStats(): MatchStats {
  return {
    possession: 0, territory: 0, carries: 0, metresGained: 0,
    passes: 0, tacklesMade: 0, missedTackles: 0, scrumsWon: 0,
    lineoutsWon: 0, penaltiesConceded: 0, turnoversWon: 0,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ rounds: [] }, { status: 403 });
  }

  const tz = await getCompetitionTimezone(NPC_2025_COMPETITION_ID);

  const { data: gw2025 } = await supabase
    .from("gameweeks")
    .select("id, number, label")
    .eq("competition_id", NPC_2025_COMPETITION_ID)
    .order("number", { ascending: true });

  if (!gw2025?.length) {
    return NextResponse.json({ rounds: [] });
  }

  const gwIds = gw2025.map((gw) => gw.id);
  const { data: allFixtures } = await supabase
    .from("fixtures")
    .select("*, home_team:teams!fixtures_home_team_id_fkey(id, name, short_name, colour, logo_url), away_team:teams!fixtures_away_team_id_fkey(id, name, short_name, colour, logo_url)")
    .in("gameweek_id", gwIds)
    .order("match_date", { ascending: true });

  if (!allFixtures?.length) {
    return NextResponse.json({ rounds: [] });
  }

  type FixtureRow = typeof allFixtures[number];
  const fixturesByGw = new Map<string, FixtureRow[]>();
  for (const f of allFixtures) {
    const list = fixturesByGw.get(f.gameweek_id) ?? [];
    list.push(f);
    fixturesByGw.set(f.gameweek_id, list);
  }

  const rounds = gw2025.map((gw) => {
    const gwFixtures = fixturesByGw.get(gw.id) ?? [];
    const fixtures: MatchFixture[] = gwFixtures.map((f) => {
      const kickoffStr = new Date(f.match_date).toLocaleTimeString(tz.locale, { timeZone: tz.timezone, hour: "numeric", minute: "2-digit" });
      const hasResult = f.result_team_id != null || f.is_draw;
      const hasScores = f.home_score != null && f.away_score != null && (f.home_score! > 0 || f.away_score! > 0);
      const home = f.home_team as { id: string; name: string; short_name: string; colour: string; logo_url: string | null };
      const away = f.away_team as { id: string; name: string; short_name: string; colour: string; logo_url: string | null };

      return {
        id: f.id,
        homeTeam: home,
        awayTeam: away,
        homeScore: f.home_score ?? 0,
        awayScore: f.away_score ?? 0,
        venue: f.venue,
        status: hasResult || hasScores
          ? { type: "fulltime" as const }
          : { type: "pre" as const, kickoff: kickoffStr },
        homeStats: emptyStats(),
        awayStats: emptyStats(),
        homePlayers: [],
        awayPlayers: [],
        events: [],
        commentary: [],
      };
    });
    return { number: gw.number as number, label: gw.label as string, fixtures };
  });

  return NextResponse.json({ rounds }, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
