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
  { base: parseIp("194.76.104.0"), mask: 23 },
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
  isArray: (name) =>
    name === "fixture" || name === "game" || name === "team" ||
    name === "match" || name === "event" || name === "sub" ||
    name === "Player" || name === "PlayerStat" || name === "TeamStat" ||
    name === "Team" || name === "Message" || name === "players",
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

  // --- Auth: IP allowlist (advisory — valid token is sufficient) ---
  const clientIp = getClientIp(request);
  if (clientIp && !isIpAllowed(clientIp)) {
    console.warn(`[opta] Request from non-Opta IP ${clientIp} — allowed via valid token`);
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
  let feedType: "RU1" | "RU5" | "RU6" | "RU7" | "RU8" | "RU10" | "RU13" | "unknown" = "unknown";
  if (rawXml.includes("<fixtures")) feedType = "RU1";
  else if (rawXml.includes("<livescores")) feedType = "RU5";
  else if (rawXml.includes("<wapresults")) feedType = "RU6";
  else if (rawXml.includes("<RRML")) feedType = "RU7";
  else if (rawXml.includes("<RugbyCommentary")) feedType = "RU8";
  else if (rawXml.includes("<RU10_Profile")) feedType = "RU10";
  else if (rawXml.includes("<RU13LINEUP")) feedType = "RU13";

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
    if (feedType === "RU6") {
      const result = await processRU6(admin, parsed);
      return NextResponse.json({ feedType, ...result });
    }
    if (feedType === "RU7") {
      const result = await processRU7(admin, parsed);
      return NextResponse.json({ feedType, ...result });
    }
    if (feedType === "RU8") {
      const result = await processRU8(admin, parsed);
      return NextResponse.json({ feedType, ...result });
    }
    if (feedType === "RU10") {
      const result = await processRU10(admin, parsed, optaCompId);
      return NextResponse.json({ feedType, ...result });
    }
    if (feedType === "RU13") {
      const result = await processRU13(admin, parsed);
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
    (f) => String(f["@_comp_id"]) === optaCompId && f["@_season_id"] === (process.env.OPTA_NPC_SEASON_ID || "2027")
  );

  console.log(`[opta/RU1] ${fixtures.length} total fixtures, ${relevant.length} relevant (comp=${optaCompId}, season=${process.env.OPTA_NPC_SEASON_ID || "2027"})`);

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

// ---------------------------------------------------------------------------
// Fixture lookup by opta_fixture_id (shared by RU6, RU7, RU8)
// ---------------------------------------------------------------------------

async function lookupFixtureId(
  admin: ReturnType<typeof createAdmin>,
  optaGameId: string
): Promise<string | null> {
  const { data } = await admin
    .from("fixtures")
    .select("id")
    .eq("opta_fixture_id", optaGameId)
    .single();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// RU6 — Key Events (wapresults)
// ---------------------------------------------------------------------------

interface RU6Event {
  "@_period"?: string;
  "@_time"?: string;
  "@_secs"?: string;
  "@_type"?: string;
  "@_event_id"?: string;
  "player-name"?: string;
  "player-code"?: string;
  "team-id"?: string;
}

interface RU6Sub {
  "@_period"?: string;
  "@_time"?: string;
  "@_secs"?: string;
  "@_event_id"?: string;
  "player-code"?: string;
  "player-name"?: string;
  "team-id"?: string;
  type?: { "@_event_name"?: string } | string;
  "@_type"?: string;
  "sub-id"?: string;
}

interface RU6Match {
  "@_game-id"?: string;
  events?: { event?: RU6Event[] };
  subs?: { sub?: RU6Sub[] };
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

async function processRU6(
  admin: ReturnType<typeof createAdmin>,
  parsed: Record<string, unknown>
) {
  const root = parsed.wapresults as { match?: RU6Match | RU6Match[] } | undefined;
  const matches = toArray(root?.match);

  let processed = 0;
  let errors = 0;

  for (const match of matches) {
    const optaGameId = String(match["@_game-id"] ?? "");
    if (!optaGameId) { errors++; continue; }

    const fixtureId = await lookupFixtureId(admin, optaGameId);

    // Process events
    const events = toArray(match.events?.event);
    for (const ev of events) {
      try {
        const { error } = await admin.from("opta_match_events").upsert(
          {
            opta_game_id: optaGameId,
            event_id: String(ev["@_event_id"] ?? ""),
            fixture_id: fixtureId,
            event_type: ev["@_type"] ?? null,
            minute: ev["@_time"] != null ? parseInt(ev["@_time"], 10) : null,
            second: ev["@_secs"] != null ? parseInt(ev["@_secs"], 10) : null,
            period: ev["@_period"] ?? null,
            player_name: ev["player-name"] ?? null,
            opta_player_id: ev["player-code"] != null ? String(ev["player-code"]) : null,
            opta_team_id: ev["team-id"] != null ? String(ev["team-id"]) : null,
          },
          { onConflict: "opta_game_id,event_id" }
        );
        if (error) {
          console.error(`[opta/RU6] Event upsert failed (game=${optaGameId}, event=${ev["@_event_id"]}):`, error.message);
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        console.error("[opta/RU6] Event error:", err);
        errors++;
      }
    }

    // Process subs
    const subs = toArray(match.subs?.sub);
    for (const sub of subs) {
      try {
        const eventName =
          (typeof sub.type === "object" && sub.type?.["@_event_name"]) ||
          (typeof sub.type === "string" ? sub.type : null) ||
          sub["@_type"] ||
          "SUB";
        const { error } = await admin.from("opta_match_events").upsert(
          {
            opta_game_id: optaGameId,
            event_id: String(sub["@_event_id"] ?? ""),
            fixture_id: fixtureId,
            event_type: eventName,
            minute: sub["@_time"] != null ? parseInt(sub["@_time"], 10) : null,
            second: sub["@_secs"] != null ? parseInt(sub["@_secs"], 10) : null,
            period: sub["@_period"] ?? null,
            player_name: sub["player-name"] ?? null,
            opta_player_id: sub["player-code"] != null ? String(sub["player-code"]) : null,
            opta_team_id: sub["team-id"] != null ? String(sub["team-id"]) : null,
            sub_id: sub["sub-id"] != null ? String(sub["sub-id"]) : null,
          },
          { onConflict: "opta_game_id,event_id" }
        );
        if (error) {
          console.error(`[opta/RU6] Sub upsert failed (game=${optaGameId}, event=${sub["@_event_id"]}):`, error.message);
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        console.error("[opta/RU6] Sub error:", err);
        errors++;
      }
    }
  }

  console.log(`[opta/RU6] Done: processed=${processed}, errors=${errors}`);
  return { processed, errors };
}

// ---------------------------------------------------------------------------
// RU7 — Player/Team Stats (RRML)
// ---------------------------------------------------------------------------

interface RU7PlayerStat {
  [key: string]: string | undefined;
}

interface RU7Player {
  "@_id"?: string;
  "@_player_name"?: string;
  "@_playerFirstName"?: string;
  "@_playerLastName"?: string;
  "@_shirtNum"?: string;
  "@_position"?: string;
  "@_position_id"?: string;
  "@_captain"?: string;
  PlayerStats?: { PlayerStat?: RU7PlayerStat[] };
}

interface RU7TeamStat {
  [key: string]: string | undefined;
}

interface RU7Team {
  "@_home_or_away"?: string;
  "@_team_id"?: string;
  "@_team_name"?: string;
  Player?: RU7Player[];
  TeamStats?: { TeamStat?: RU7TeamStat[] };
}

async function processRU7(
  admin: ReturnType<typeof createAdmin>,
  parsed: Record<string, unknown>
) {
  const root = parsed.RRML as Record<string, unknown> | undefined;
  const optaGameId = String(root?.["@_id"] ?? "");
  if (!optaGameId) {
    console.warn("[opta/RU7] No game ID found in RRML root");
    return { processed: 0, errors: 1 };
  }

  const fixtureId = await lookupFixtureId(admin, optaGameId);

  const homeTeamIdRaw = root?.["@_home_team_id"];
  const awayTeamIdRaw = root?.["@_away_team_id"];
  const homeTeamId = homeTeamIdRaw != null ? parseInt(String(homeTeamIdRaw), 10) : NaN;
  const awayTeamId = awayTeamIdRaw != null ? parseInt(String(awayTeamIdRaw), 10) : NaN;

  if (isNaN(homeTeamId) || isNaN(awayTeamId)) {
    console.warn(`[opta/RU7] Missing team IDs on RRML root: home="${homeTeamIdRaw}" away="${awayTeamIdRaw}" (game=${optaGameId})`);
    return { processed: 0, errors: 1 };
  }

  const teamDetail = root?.TeamDetail as { Team?: RU7Team | RU7Team[] } | undefined;
  const teams = toArray(teamDetail?.Team);

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const optaTeamId = i === 0 ? homeTeamId : awayTeamId;
    const homeOrAway = i === 0 ? "home" : "away";

    // Player stats
    const players = toArray(team.Player);
    for (const player of players) {
      try {
        const stats: Record<string, string> = {};
        const playerStats = toArray(player.PlayerStats?.PlayerStat);
        for (const ps of playerStats) {
          for (const [key, val] of Object.entries(ps)) {
            if (key.startsWith("@_") || val == null) continue;
            stats[key] = String(val);
          }
          for (const [key, val] of Object.entries(ps)) {
            if (!key.startsWith("@_") || key === "@_") continue;
            const statName = key.slice(2);
            if (val != null) stats[statName] = String(val);
          }
        }

        const { error } = await admin.from("opta_player_stats").upsert(
          {
            opta_game_id: optaGameId,
            opta_player_id: String(player["@_id"] ?? ""),
            fixture_id: fixtureId,
            opta_team_id: optaTeamId,
            player_name: player["@_player_name"] ?? null,
            first_name: player["@_playerFirstName"] ?? null,
            last_name: player["@_playerLastName"] ?? null,
            shirt_number: player["@_shirtNum"] != null ? parseInt(player["@_shirtNum"], 10) : null,
            position: player["@_position"] ?? null,
            position_id: player["@_position_id"] != null ? parseInt(player["@_position_id"], 10) : null,
            is_captain: player["@_captain"] === "true" || player["@_captain"] === "1",
            stats,
          },
          { onConflict: "opta_game_id,opta_player_id" }
        );
        if (error) {
          console.error(`[opta/RU7] Player stat upsert failed (game=${optaGameId}, team_id=${optaTeamId}, player=${player["@_id"]}):`, error.message);
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        console.error("[opta/RU7] Player stat error:", err);
        errors++;
      }
    }

    // Team stats
    try {
      const teamStats: Record<string, string> = {};
      const tStats = toArray(team.TeamStats?.TeamStat);
      for (const ts of tStats) {
        for (const [key, val] of Object.entries(ts)) {
          if (!key.startsWith("@_") || key === "@_") continue;
          const statName = key.slice(2);
          if (val != null) teamStats[statName] = String(val);
        }
      }

      if (Object.keys(teamStats).length > 0) {
        const { error } = await admin.from("opta_team_stats").upsert(
          {
            opta_game_id: optaGameId,
            opta_team_id: optaTeamId,
            fixture_id: fixtureId,
            stats: teamStats,
          },
          { onConflict: "opta_game_id,opta_team_id" }
        );
        if (error) {
          console.error(`[opta/RU7] Team stat upsert failed (game=${optaGameId}, team_id=${optaTeamId}):`, error.message);
          errors++;
        } else {
          processed++;
        }
      }
    } catch (err) {
      console.error("[opta/RU7] Team stat error:", err);
      errors++;
    }
  }

  console.log(`[opta/RU7] Done: processed=${processed}, errors=${errors}`);

  if (processed > 0) {
    try {
      await admin.rpc('refresh_season_stats');
    } catch (err) {
      console.error("[opta/RU7] Failed to refresh season stats matviews:", err);
    }
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// RU8 — Commentary (RugbyCommentary)
// ---------------------------------------------------------------------------

interface RU8Message {
  "@_id"?: string;
  "@_comment"?: string;
  "@_time"?: string;
  "@_type"?: string;
  "@_player_id"?: string;
  "@_team_id"?: string;
}

async function processRU8(
  admin: ReturnType<typeof createAdmin>,
  parsed: Record<string, unknown>
) {
  const root = parsed.RugbyCommentary as Record<string, unknown> | undefined;
  const gameDetail = root?.GameDetail as Record<string, unknown> | undefined;
  const optaGameId = String(gameDetail?.["@_game_id"] ?? "");
  if (!optaGameId) {
    console.warn("[opta/RU8] No game_id found in GameDetail");
    return { processed: 0, errors: 1 };
  }

  const fixtureId = await lookupFixtureId(admin, optaGameId);

  const messages = toArray(root?.Message) as RU8Message[];
  const filtered = messages.filter((m) => m["@_type"] !== "Leader Table" && m["@_id"] != null);

  console.log(`[opta/RU8] ${messages.length} total messages, ${filtered.length} after filtering (game=${optaGameId})`);

  let processed = 0;
  let errors = 0;

  for (const msg of filtered) {
    try {
      const { error } = await admin.from("opta_commentary").upsert(
        {
          opta_game_id: optaGameId,
          message_id: String(msg["@_id"]),
          fixture_id: fixtureId,
          minute: msg["@_time"] != null ? parseInt(msg["@_time"], 10) : null,
          event_type: msg["@_type"] ?? null,
          comment: msg["@_comment"] ?? null,
          opta_player_id: msg["@_player_id"] != null ? String(msg["@_player_id"]) : null,
          opta_team_id: msg["@_team_id"] != null ? String(msg["@_team_id"]) : null,
        },
        { onConflict: "opta_game_id,message_id" }
      );
      if (error) {
        console.error(`[opta/RU8] Commentary upsert failed (game=${optaGameId}, msg=${msg["@_id"]}):`, error.message);
        errors++;
      } else {
        processed++;
      }
    } catch (err) {
      console.error("[opta/RU8] Commentary error:", err);
      errors++;
    }
  }

  console.log(`[opta/RU8] Done: processed=${processed}, errors=${errors}`);
  return { processed, errors };
}

// ---------------------------------------------------------------------------
// RU10 — Competition Profiles / Squad Data (RU10_Profile)
// ---------------------------------------------------------------------------

interface RU10Player {
  "@_player_id"?: string;
  "@_player_first_name"?: string;
  "@_player_last_name"?: string;
  "@_position"?: string;
  "@_appearances"?: string;
}

interface RU10Team {
  "@_id"?: string;
  "@_name"?: string;
  players?: RU10Player[];
}

interface RU10Competition {
  "@_id"?: string;
  "@_season_id"?: string;
}

async function processRU10(
  admin: ReturnType<typeof createAdmin>,
  parsed: Record<string, unknown>,
  _optaCompId: string
) {
  const root = parsed.RU10_Profile as Record<string, unknown> | undefined;
  if (!root) {
    console.warn("[opta/RU10] No RU10_Profile root found");
    return { processed: 0, errors: 1 };
  }

  const competition = root.competition as RU10Competition | undefined;
  const seasonId = process.env.OPTA_NPC_SEASON_ID ?? "2026";
  if (competition?.["@_season_id"] && competition["@_season_id"] !== seasonId) {
    console.log(`[opta/RU10] Skipping — season_id ${competition["@_season_id"]} does not match ${seasonId}`);
    return { processed: 0, skipped: true, reason: "season_id mismatch" };
  }

  const teamMap = await getTeamMap(admin);
  const teams = (root.team ?? []) as RU10Team[];

  let processed = 0;
  let errors = 0;
  let teamsProcessed = 0;

  for (const team of teams) {
    const optaTeamId = String(team["@_id"] ?? "");
    const teamName = team["@_name"] ?? optaTeamId;
    const platformTeamId = teamMap.get(optaTeamId);

    if (!platformTeamId) {
      console.warn(`[opta/RU10] Unmapped team: ${teamName} (opta_id=${optaTeamId}) — skipping`);
      continue;
    }

    const players = team.players ?? [];
    let teamPlayerCount = 0;

    for (const p of players) {
      const position = p["@_position"] ?? "";
      if (position === "Unknown") continue;

      const firstName = p["@_player_first_name"] ?? "";
      const lastName = p["@_player_last_name"] ?? "";
      const optaPlayerId = p["@_player_id"] != null ? String(p["@_player_id"]) : "";
      if ((!firstName && !lastName) || !optaPlayerId) continue;

      try {
        const appearances = parseInt(p["@_appearances"] ?? "0", 10) || 0;
        const { error } = await admin.from("players").upsert(
          {
            first_name: firstName,
            last_name: lastName,
            team_id: platformTeamId,
            is_active: true,
            opta_player_id: optaPlayerId,
            position,
            apps: appearances,
          },
          { onConflict: "opta_player_id" }
        );
        if (error) {
          console.error(`[opta/RU10] Player upsert failed (${firstName} ${lastName}, opta_id=${optaPlayerId}):`, error.message);
          errors++;
        } else {
          processed++;
          teamPlayerCount++;
        }
      } catch (err) {
        console.error("[opta/RU10] Player error:", err);
        errors++;
      }
    }

    if (teamPlayerCount > 0) teamsProcessed++;
  }

  console.log(`[opta/RU10] Imported ${processed} players across ${teamsProcessed} teams`);
  return { processed, errors, teams: teamsProcessed };
}

// ---------------------------------------------------------------------------
// RU13 — Team Line-Ups (RU13LINEUP)
// ---------------------------------------------------------------------------

interface RU13Player {
  "@_id"?: string;
  "@_player_name"?: string;
  "@_position"?: string;
  "@_position_id"?: string;
  "@_captain"?: string;
}

interface RU13Team {
  "@_home_or_away"?: string;
  "@_team_id"?: string;
  "@_team_name"?: string;
  Player?: RU13Player[];
}

async function processRU13(
  admin: ReturnType<typeof createAdmin>,
  parsed: Record<string, unknown>
) {
  const root = parsed.RU13LINEUP as Record<string, unknown> | undefined;
  const optaGameId = String(root?.["@_id"] ?? "");
  if (!optaGameId) {
    console.warn("[opta/RU13] No game ID found in RU13LINEUP root");
    return { processed: 0, errors: 1 };
  }

  const fixtureId = await lookupFixtureId(admin, optaGameId);

  const teamDetail = root?.TeamDetail as { Team?: RU13Team | RU13Team[] } | undefined;
  const teams = toArray(teamDetail?.Team);

  let processed = 0;
  let errors = 0;

  for (const team of teams) {
    const optaTeamId = parseInt(String(team["@_team_id"] ?? "0"), 10);
    if (!optaTeamId) { errors++; continue; }

    const players = toArray(team.Player);
    for (const player of players) {
      try {
        const positionId = player["@_position_id"] != null
          ? parseInt(player["@_position_id"], 10)
          : null;
        const isSubstitute = positionId != null && positionId >= 16;

        const nameParts = (player["@_player_name"] ?? "").split(/\s+/);
        const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] ?? "";
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

        const { error } = await admin.from("opta_lineups").upsert(
          {
            opta_game_id: optaGameId,
            opta_team_id: optaTeamId,
            opta_player_id: player["@_id"] != null ? parseInt(String(player["@_id"]), 10) : null,
            fixture_id: fixtureId,
            player_name: player["@_player_name"] ?? "Unknown",
            first_name: firstName,
            last_name: lastName,
            shirt_number: positionId,
            position: player["@_position"] ?? null,
            is_captain: player["@_captain"] === "Yes",
            is_substitute: isSubstitute,
          },
          { onConflict: "opta_game_id,opta_team_id,opta_player_id" }
        );
        if (error) {
          console.error(`[opta/RU13] Lineup upsert failed (game=${optaGameId}, team=${optaTeamId}, player=${player["@_id"]}):`, error.message);
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        console.error("[opta/RU13] Player error:", err);
        errors++;
      }
    }
  }

  console.log(`[opta/RU13] Done: processed=${processed}, errors=${errors}`);
  return { processed, errors };
}
