import { createClient } from "jsr:@supabase/supabase-js@2";

const XPLORER_GQL = "https://rugby-au-cms.graphcdn.app/";

const FIXTURES_QUERY = `
query FixturesAndResults($comps: [CompInput], $teams: [String], $type: String, $skip: Int, $limit: Int) {
  getFixtureItems(comps: $comps, teams: $teams, type: $type, skip: $skip, limit: $limit) {
    id compId compName dateTime round roundLabel season status venue isLive isBye
    homeTeam { id name teamId score }
    awayTeam { id name teamId score }
  }
}`;

const ENTITY_FIXTURES_QUERY = `
query EntityFixturesAndResults($entityId: Int, $entityType: String, $season: String, $comps: [CompInput], $teams: [String], $type: String, $skip: Int, $limit: Int) {
  getEntityFixturesAndResults(season: $season, comps: $comps, teams: $teams, entityId: $entityId, entityType: $entityType, type: $type, limit: $limit, skip: $skip) {
    id compId compName dateTime round roundLabel season status venue isLive isBye
    homeTeam { id name teamId score }
    awayTeam { id name teamId score }
  }
}`;

const LADDER_QUERY = `
query CompLadderQuery($comp: CompInput) {
  compLadder(comp: $comp) {
    id
    ladderPools {
      id poolName
      teams {
        id name crest position matchesPlayed matchesWon matchesDrawn matchesLost byes
        pointsFor pointsAgainst pointsDifference totalBonusPoints totalMatchPoints
      }
    }
  }
}`;

type Comp = { comp_id: string; source_type: string; name: string; entity_id?: number; entity_type?: string; season?: string };

type FixtureItem = {
  id: string; compId: string; compName: string | null; dateTime: string | null;
  round: string | number | null; roundLabel: string | null; status: string | null;
  venue: string | null; isLive: boolean | null; isBye: boolean | null;
  homeTeam: { name: string; teamId: string | null; score: string | number | null } | null;
  awayTeam: { name: string; teamId: string | null; score: string | number | null } | null;
};

type LadderTeam = {
  id: string; name: string; crest: string | null; position: number | null;
  matchesPlayed: number | null; matchesWon: number | null; matchesDrawn: number | null;
  matchesLost: number | null; byes: number | null; pointsFor: number | null;
  pointsAgainst: number | null; pointsDifference: number | null;
  totalBonusPoints: number | null; totalMatchPoints: number | null;
};

function deriveStatus(item: FixtureItem): "scheduled" | "live" | "final" {
  if (item.isLive) return "live";
  const s = (item.status ?? "").toLowerCase();
  if (s.includes("full") || s.includes("final") || s.includes("ft")) return "final";
  const hs = item.homeTeam?.score;
  const as = item.awayTeam?.score;
  const hasScore = (v: unknown) => v !== null && v !== undefined && v !== "";
  if (!item.isLive && hasScore(hs) && hasScore(as)) return "final";
  return "scheduled";
}

async function gql(query: string, variables: unknown, opName: string) {
  const res = await fetch(XPLORER_GQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operationName: opName, query, variables }),
  });
  if (!res.ok) throw new Error(`Xplorer ${opName} HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`${opName} GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function fetchFixtures(comp: Comp, type: "results" | "fixtures") {
  if (comp.entity_id) {
    const data = await gql(ENTITY_FIXTURES_QUERY, {
      comps: [{ id: comp.comp_id, sourceType: comp.source_type, displayResult: true }],
      teams: [], type, skip: 0, limit: 200,
      entityId: comp.entity_id, entityType: comp.entity_type || "provincial-union",
      season: comp.season || "2026",
    }, "EntityFixturesAndResults");
    return (data?.getEntityFixturesAndResults ?? []) as FixtureItem[];
  } else {
    const data = await gql(FIXTURES_QUERY, {
      comps: [{ id: comp.comp_id, sourceType: comp.source_type }],
      teams: [], type, skip: 0, limit: 200,
    }, "FixturesAndResults");
    return (data?.getFixtureItems ?? []) as FixtureItem[];
  }
}

async function fetchLadder(comp: Comp) {
  const data = await gql(LADDER_QUERY, {
    comp: { id: comp.comp_id, sourceType: comp.source_type },
  }, "CompLadderQuery");
  const pools = data?.compLadder?.ladderPools ?? [];
  const teams: LadderTeam[] = [];
  for (const pool of pools) for (const t of (pool.teams ?? [])) teams.push(t);
  return teams;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: comps, error: compErr } = await supabase
    .from("competitions")
    .select("comp_id, source_type, name, entity_id, entity_type, season")
    .eq("is_active", true);

  if (compErr) return new Response(`comp load failed: ${compErr.message}`, { status: 500 });
  if (!comps?.length) return new Response("no active competitions configured", { status: 200 });

  let upserted = 0;
  let ladderRows = 0;
  const problems: string[] = [];

  for (const comp of comps) {
    try {
      const items = [
        ...(await fetchFixtures(comp, "results")),
        ...(await fetchFixtures(comp, "fixtures")),
      ];
      const rows = items
        .filter((i) => i.homeTeam && i.awayTeam)
        .map((i) => ({
          external_id: i.id, comp_id: i.compId, comp_name: i.compName,
          round: i.round != null ? String(i.round) : null,
          round_label: i.roundLabel, match_date: i.dateTime, venue: i.venue,
          home_team: i.homeTeam!.name, home_team_id: i.homeTeam!.teamId,
          home_score: i.homeTeam!.score != null ? String(i.homeTeam!.score) : null,
          away_team: i.awayTeam!.name, away_team_id: i.awayTeam!.teamId,
          away_score: i.awayTeam!.score != null ? String(i.awayTeam!.score) : null,
          is_bye: !!i.isBye, is_live: !!i.isLive, status: i.status,
          result_status: deriveStatus(i), source: "xplorer", raw: i,
        }));
      if (rows.length) {
        const { error } = await supabase
          .from("match_results")
          .upsert(rows, { onConflict: "external_id" });
        if (error) problems.push(`${comp.name} results: ${error.message}`);
        else upserted += rows.length;
      }
    } catch (e) {
      problems.push(`${comp.name} results: ${(e as Error).message}`);
    }

    try {
      const teams = await fetchLadder(comp);
      const rows = teams.map((t) => ({
        comp_id: comp.comp_id, team_id: t.id, team_name: t.name,
        position: t.position, matches_played: t.matchesPlayed,
        matches_won: t.matchesWon, matches_drawn: t.matchesDrawn,
        matches_lost: t.matchesLost, byes: t.byes,
        points_for: t.pointsFor, points_against: t.pointsAgainst,
        points_diff: t.pointsDifference, bonus_points: t.totalBonusPoints,
        match_points: t.totalMatchPoints, crest: t.crest, raw: t,
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("ladder_standings")
          .upsert(rows, { onConflict: "comp_id,team_id" });
        if (error) problems.push(`${comp.name} ladder: ${error.message}`);
        else ladderRows += rows.length;
      }
    } catch (e) {
      problems.push(`${comp.name} ladder: ${(e as Error).message}`);
    }
  }

  let rounds = { gameweeks_created: 0, fixtures_created: 0, rounds_opened: 0, rounds_closed: 0 };
  try {
    const { data, error } = await supabase.rpc("auto_manage_rounds");
    if (error) problems.push(`rounds: ${error.message}`);
    else if (data) rounds = data;
  } catch (e) {
    problems.push(`rounds: ${(e as Error).message}`);
  }

  let bridge = { updated: 0, skipped: 0 };
  try {
    const { data, error } = await supabase.rpc("bridge_xplorer_results");
    if (error) problems.push(`bridge: ${error.message}`);
    else if (data) bridge = data;
  } catch (e) {
    problems.push(`bridge: ${(e as Error).message}`);
  }

  return new Response(
    JSON.stringify({ upserted, ladderRows, bridge, rounds, problems }, null, 2),
    { headers: { "content-type": "application/json" }, status: problems.length ? 207 : 200 },
  );
});
