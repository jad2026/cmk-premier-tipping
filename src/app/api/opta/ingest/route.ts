import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

export const dynamic = "force-dynamic";

const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

const OPTA_ALLOWED_CIDRS = [
  { base: parseIp("81.19.62.64"), mask: 26 },
  { base: parseIp("81.19.48.109"), mask: 32 },
  { base: parseIp("81.19.48.69"), mask: 32 },
  { base: parseIp("194.76.58.0"), mask: 23 },
];

function parseIp(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function isIpAllowed(ip: string): boolean {
  const addr = parseIp(ip);
  return OPTA_ALLOWED_CIDRS.some(({ base, mask }) => {
    const m = mask === 32 ? 0xffffffff : (~(0xffffffff >>> mask)) >>> 0;
    return (addr & m) === (base & m);
  });
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  return real?.trim() ?? null;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "fixture" || name === "game" || name === "team",
});

function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  // --- Auth: token check ---
  const expectedToken = process.env.OPTA_INGEST_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "OPTA_INGEST_TOKEN not configured" }, { status: 500 });
  }
  const token = request.headers.get("x-opta-token");
  if (token !== expectedToken) {
    console.error("[opta] Invalid or missing X-Opta-Token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Auth: IP allowlist ---
  const clientIp = getClientIp(request);
  if (clientIp && !isIpAllowed(clientIp)) {
    console.error(`[opta] Blocked IP: ${clientIp}`);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Read body ---
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("xml")) {
    return NextResponse.json({ error: "Expected XML content-type" }, { status: 415 });
  }

  const rawXml = await request.text();
  if (!rawXml) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const admin = createAdmin();

  // --- Determine feed type ---
  let feedType: "RU1" | "RU5" | "unknown" = "unknown";
  if (rawXml.includes("<fixtures")) feedType = "RU1";
  else if (rawXml.includes("<livescores")) feedType = "RU5";

  // --- Capture raw XML first ---
  const { error: rawError } = await admin.from("opta_raw_feed").insert({
    feed_type: feedType,
    raw_xml: rawXml,
  });
  if (rawError) {
    console.error("[opta] Failed to store raw feed:", rawError.message);
  }

  // --- Parse XML ---
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(rawXml);
  } catch (err) {
    console.error("[opta] XML parse error:", err);
    return NextResponse.json({ error: "Invalid XML" }, { status: 400 });
  }

  const optaCompId = process.env.OPTA_NPC_COMP_ID;
  if (!optaCompId) {
    return NextResponse.json({ error: "OPTA_NPC_COMP_ID not configured" }, { status: 500 });
  }

  try {
    if (feedType === "RU1") {
      const result = await processRU1(admin, parsed, optaCompId);
      return NextResponse.json({ feedType, ...result });
    }
    if (feedType === "RU5") {
      const result = await processRU5(admin, parsed, optaCompId);
      return NextResponse.json({ feedType, ...result });
    }

    console.warn("[opta] Unknown feed type — stored raw XML only");
    return NextResponse.json({ feedType: "unknown", stored: true });
  } catch (err) {
    console.error("[opta] Processing error:", err);
    return NextResponse.json(
      { error: "Processing failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Team mapping helper
// ---------------------------------------------------------------------------

async function getTeamMap(
  admin: ReturnType<typeof createAdmin>
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("opta_team_mapping")
    .select("opta_team_id, team_id");
  if (error) throw new Error(`Failed to load team mappings: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(String(row.opta_team_id), row.team_id);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Gameweek lookup helper
// ---------------------------------------------------------------------------

async function getGameweekByRound(
  admin: ReturnType<typeof createAdmin>,
  round: number
): Promise<string | null> {
  const { data } = await admin
    .from("gameweeks")
    .select("id")
    .eq("competition_id", NPC_COMPETITION_ID)
    .eq("number", round)
    .single();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// RU1 — Fixtures & Results
// ---------------------------------------------------------------------------

interface RU1Fixture {
  "@_id": string;
  "@_comp_id": string;
  "@_season_id"?: string;
  "@_status": string;
  "@_round": string;
  "@_datetime"?: string;
  "@_venue"?: string;
  "@_venue_id"?: string;
  "@_MatchWinner"?: string;
  team: Array<{
    "@_home_or_away": string;
    "@_team_id": string;
    "@_score"?: string;
  }>;
}

async function processRU1(
  admin: ReturnType<typeof createAdmin>,
  parsed: Record<string, unknown>,
  optaCompId: string
) {
  const root = parsed.fixtures as { fixture?: RU1Fixture[] } | undefined;
  const fixtures = root?.fixture ?? [];
  const relevant = fixtures.filter(
    (f) => String(f["@_comp_id"]) === optaCompId && f["@_season_id"] === "2026"
  );

  console.log(`[opta/RU1] ${fixtures.length} total fixtures, ${relevant.length} relevant (comp=${optaCompId}, season=2026)`);

  if (relevant.length === 0) {
    return { processed: 0, skipped: fixtures.length };
  }

  const teamMap = await getTeamMap(admin);
  let processed = 0;
  let errors = 0;

  for (const fix of relevant) {
    try {
      const optaFixtureId = String(fix["@_id"]);
      const round = parseInt(fix["@_round"], 10);
      const status = fix["@_status"];

      const gameweekId = await getGameweekByRound(admin, round);
      if (!gameweekId) {
        console.warn(`[opta/RU1] No gameweek for round ${round} — skipping fixture ${optaFixtureId}`);
        errors++;
        continue;
      }

      const homeTeam = fix.team.find((t) => t["@_home_or_away"] === "home");
      const awayTeam = fix.team.find((t) => t["@_home_or_away"] === "away");
      if (!homeTeam || !awayTeam) {
        console.warn(`[opta/RU1] Missing team data for fixture ${optaFixtureId}`);
        errors++;
        continue;
      }

      const homeTeamId = teamMap.get(String(homeTeam["@_team_id"]));
      const awayTeamId = teamMap.get(String(awayTeam["@_team_id"]));
      if (!homeTeamId || !awayTeamId) {
        console.warn(
          `[opta/RU1] Unmapped team: home=${homeTeam["@_team_id"]} away=${awayTeam["@_team_id"]} for fixture ${optaFixtureId}`
        );
        errors++;
        continue;
      }

      const isResult = status === "Result" || status === "FullTime";
      const homeScore = homeTeam["@_score"] != null ? parseInt(homeTeam["@_score"], 10) : null;
      const awayScore = awayTeam["@_score"] != null ? parseInt(awayTeam["@_score"], 10) : null;

      let resultTeamId: string | null = null;
      let isDraw = false;

      if (isResult) {
        if (fix["@_MatchWinner"]) {
          resultTeamId = teamMap.get(String(fix["@_MatchWinner"])) ?? null;
        } else if (homeScore != null && awayScore != null && homeScore === awayScore) {
          isDraw = true;
        }
      }

      const upsertData: Record<string, unknown> = {
        opta_fixture_id: optaFixtureId,
        gameweek_id: gameweekId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        venue: fix["@_venue"] ?? null,
        match_date: fix["@_datetime"] ?? null,
      };

      if (isResult) {
        upsertData.result_team_id = resultTeamId;
        upsertData.is_draw = isDraw;
        upsertData.home_score = homeScore;
        upsertData.away_score = awayScore;
      }

      const { error: upsertError } = await admin
        .from("fixtures")
        .upsert(upsertData, { onConflict: "opta_fixture_id" });

      if (upsertError) {
        console.error(`[opta/RU1] Upsert failed for fixture ${optaFixtureId}:`, upsertError.message);
        errors++;
        continue;
      }

      processed++;
    } catch (err) {
      console.error("[opta/RU1] Fixture processing error:", err);
      errors++;
    }
  }

  console.log(`[opta/RU1] Done: processed=${processed}, errors=${errors}`);
  return { processed, errors, skipped: fixtures.length - relevant.length };
}

// ---------------------------------------------------------------------------
// RU5 — Live Scores
// ---------------------------------------------------------------------------

interface RU5Game {
  "@_id": string;
  "@_comp_id": string;
  "@_status": string;
  "@_round"?: string;
  team: Array<{
    "@_home_or_away": string;
    "@_team_id": string;
    "@_home_score"?: string;
    "@_away_score"?: string;
  }>;
}

async function processRU5(
  admin: ReturnType<typeof createAdmin>,
  parsed: Record<string, unknown>,
  optaCompId: string
) {
  const root = parsed.livescores as { game?: RU5Game[] } | undefined;
  const games = root?.game ?? [];
  const relevant = games.filter((g) => String(g["@_comp_id"]) === optaCompId);

  console.log(`[opta/RU5] ${games.length} total games, ${relevant.length} relevant (comp=${optaCompId})`);

  if (relevant.length === 0) {
    return { processed: 0, skipped: games.length };
  }

  let processed = 0;
  let errors = 0;

  for (const game of relevant) {
    try {
      const optaFixtureId = String(game["@_id"]);
      const status = game["@_status"];

      const homeTeam = game.team.find((t) => t["@_home_or_away"] === "home");
      const awayTeam = game.team.find((t) => t["@_home_or_away"] === "away");
      if (!homeTeam || !awayTeam) {
        console.warn(`[opta/RU5] Missing team data for game ${optaFixtureId}`);
        errors++;
        continue;
      }

      const homeScore = homeTeam["@_home_score"] != null ? parseInt(homeTeam["@_home_score"], 10) : null;
      const awayScore = awayTeam["@_away_score"] != null ? parseInt(awayTeam["@_away_score"], 10) : null;

      const updateData: Record<string, unknown> = {
        home_score: homeScore,
        away_score: awayScore,
      };

      const isResult = status === "Result" || status === "FullTime";
      if (isResult && homeScore != null && awayScore != null) {
        if (homeScore === awayScore) {
          updateData.is_draw = true;
          updateData.result_team_id = null;
        } else {
          updateData.is_draw = false;
          // Determine winner from scores — need to look up our team IDs
          const { data: fixture } = await admin
            .from("fixtures")
            .select("home_team_id, away_team_id")
            .eq("opta_fixture_id", optaFixtureId)
            .single();
          if (fixture) {
            updateData.result_team_id =
              homeScore > awayScore ? fixture.home_team_id : fixture.away_team_id;
          }
        }
      }

      const { error: updateError, count } = await admin
        .from("fixtures")
        .update(updateData)
        .eq("opta_fixture_id", optaFixtureId);

      if (updateError) {
        console.error(`[opta/RU5] Update failed for game ${optaFixtureId}:`, updateError.message);
        errors++;
        continue;
      }

      processed++;
    } catch (err) {
      console.error("[opta/RU5] Game processing error:", err);
      errors++;
    }
  }

  console.log(`[opta/RU5] Done: processed=${processed}, errors=${errors}`);
  return { processed, errors, skipped: games.length - relevant.length };
}
