import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FANTASY_COMP_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

/* ── Types ── */

type ScoringRule = {
  stat_key: string;
  points_per: number;
  applies_to: string[] | null;
};

type PlayerStatRow = {
  opta_player_id: string;
  opta_team_id: number;
  player_name: string;
  position: string | null;
  stats: Record<string, string> | null;
  fixture_id: string | null;
};

type FixtureRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

type GameweekRow = {
  id: string;
  number: number;
  label: string;
};

/* ── Opta position → fantasy_position ── */

const OPTA_TO_FANTASY_POS: Record<string, string> = {
  "Forward 1": "prop",
  "Forward 3": "prop",
  "Forward 2": "hooker",
  "Forward 4": "lock",
  "Forward 5": "lock",
  "Forward 6": "loose_forward",
  "Forward 7": "loose_forward",
  "Forward 8": "loose_forward",
  "Back 1": "halfback",
  "Back 2": "first_five",
  "Back 3": "outside_back",
  "Back 4": "centre",
  "Back 5": "centre",
  "Back 6": "outside_back",
  "Back 7": "outside_back",
  "Replacement 1": "prop",
  "Replacement 2": "hooker",
  "Replacement 3": "prop",
  "Replacement 4": "lock",
  "Replacement 5": "loose_forward",
  "Replacement 6": "halfback",
  "Replacement 7": "first_five",
  "Replacement 8": "outside_back",
};

/* ── Special-case stat_key → actual opta blob key ── */

const STAT_KEY_REMAP: Record<string, string> = {
  carry_metres_fwd: "carry_metres_total",
  carry_metres_back: "carry_metres_total",
  tackles_fwd: "tackles",
  tackles_back: "tackles",
  lineout_throw_fwd: "lineout_won_own_throw",
};

const MINUTES_KEYS = [
  "MinutesPlayedTotal",
  "minutes_played_total",
  "MinutesPlayed",
  "minutes_played",
];

/* ── Helpers ── */

function readStat(stats: Record<string, string> | null, key: string): number {
  if (!stats) return 0;
  const v = stats[key];
  if (v == null) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function readStatMulti(
  stats: Record<string, string> | null,
  keys: string[]
): number {
  if (!stats) return 0;
  for (const k of keys) {
    const v = stats[k];
    if (v != null) {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

function resolveOptaKey(statKey: string): string {
  return STAT_KEY_REMAP[statKey] ?? statKey;
}

function scorePlayer(
  stats: Record<string, string> | null,
  position: string | null,
  rules: ScoringRule[]
): { points: number; minutes: number } {
  const minutes = readStatMulti(stats, MINUTES_KEYS);

  let points = 0;
  if (minutes > 0) points += 2;
  if (minutes >= 60) points += 2;

  const fantasyPos = position
    ? (OPTA_TO_FANTASY_POS[position] ?? null)
    : null;

  for (const rule of rules) {
    if (rule.applies_to && rule.applies_to.length > 0) {
      if (!fantasyPos || !rule.applies_to.includes(fantasyPos)) continue;
    }

    const optaKey = resolveOptaKey(rule.stat_key);
    let count = readStat(stats, optaKey);

    if (rule.stat_key.startsWith("carry_metres")) {
      count = Math.floor(count / 10);
    }

    points += count * rule.points_per;
  }

  return { points: Math.round(points * 100) / 100, minutes };
}

/* ── GET handler ── */

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const url = new URL(request.url);
  const warnings: string[] = [];

  /* ── 1. Resolve gameweek ── */

  let gameweekId = url.searchParams.get("gameweek_id");
  let gameweekLabel = "";

  if (gameweekId) {
    const { data: gw } = (await admin
      .from("gameweeks")
      .select("id, number, label")
      .eq("id", gameweekId)
      .single()) as unknown as { data: GameweekRow | null };
    if (!gw) {
      return NextResponse.json(
        { error: `Gameweek ${gameweekId} not found` },
        { status: 404 }
      );
    }
    gameweekLabel = gw.label;
  } else {
    const { data: gameweeks } = (await admin
      .from("gameweeks")
      .select("id, number, label")
      .order("number", { ascending: false })) as unknown as {
      data: GameweekRow[] | null;
    };

    if (!gameweeks?.length) {
      return NextResponse.json(
        { error: "No gameweeks found" },
        { status: 404 }
      );
    }

    const gwIds = gameweeks.map((g) => g.id);
    const { data: allFix } = (await admin
      .from("fixtures")
      .select("gameweek_id, home_score")
      .in("gameweek_id", gwIds)) as unknown as {
      data: { gameweek_id: string; home_score: number | null }[] | null;
    };

    const byGw = new Map<string, { total: number; scored: number }>();
    for (const f of allFix ?? []) {
      const e = byGw.get(f.gameweek_id) ?? { total: 0, scored: 0 };
      e.total++;
      if (f.home_score !== null) e.scored++;
      byGw.set(f.gameweek_id, e);
    }

    for (const gw of gameweeks) {
      const s = byGw.get(gw.id);
      if (s && s.total > 0 && s.total === s.scored) {
        gameweekId = gw.id;
        gameweekLabel = gw.label;
        break;
      }
    }

    if (!gameweekId) {
      return NextResponse.json(
        { error: "No fully completed gameweek found" },
        { status: 404 }
      );
    }
  }

  /* ── 2. Load scoring rules ── */

  const { data: rules } = (await admin
    .from("fantasy_scoring_rules")
    .select("*")
    .eq("competition_id", FANTASY_COMP_ID)) as unknown as {
    data: ScoringRule[] | null;
  };

  if (!rules?.length) {
    return NextResponse.json(
      { error: "No scoring rules found" },
      { status: 404 }
    );
  }

  /* ── 3. Load scored fixtures for this gameweek ── */

  const { data: fixtures } = (await admin
    .from("fixtures")
    .select("id, home_team_id, away_team_id, home_score, away_score")
    .eq("gameweek_id", gameweekId)
    .not("home_score", "is", null)) as unknown as {
    data: FixtureRow[] | null;
  };

  if (!fixtures?.length) {
    return NextResponse.json(
      { error: "No scored fixtures in this gameweek" },
      { status: 404 }
    );
  }

  /* ── 4. Load opta player stats for those fixtures ── */

  const fixtureIds = fixtures.map((f) => f.id);
  const { data: playerStats } = (await admin
    .from("opta_player_stats")
    .select(
      "opta_player_id, opta_team_id, player_name, position, stats, fixture_id"
    )
    .in("fixture_id", fixtureIds)) as unknown as {
    data: PlayerStatRow[] | null;
  };

  if (!playerStats?.length) {
    return NextResponse.json(
      { error: "No player stats found for scored fixtures" },
      { status: 404 }
    );
  }

  /* ── 5. Load player ID mapping (opta_player_id → UUID) ── */

  const { data: playerIdRows } = (await admin
    .from("players")
    .select("id, opta_player_id")) as unknown as {
    data: { id: string; opta_player_id: string }[] | null;
  };

  const optaToUuid = new Map<string, string>();
  for (const row of playerIdRows ?? []) {
    if (row.opta_player_id) optaToUuid.set(row.opta_player_id, row.id);
  }

  /* ── 6. Score each player per fixture ── */

  const matchStatsTable = admin.from(
    "fantasy_player_match_stats"
  ) as unknown as AnyTable;

  const upsertRows: {
    fixture_id: string;
    player_id: string;
    minutes_played: number;
    stats: Record<string, string> | null;
    fantasy_points: number;
  }[] = [];

  // In-memory lookup for squad scoring: `fixtureId:playerUuid` → { points, minutes }
  const playerMatchPts = new Map<
    string,
    { points: number; minutes: number }
  >();

  // Reconciliation accumulators per fixture per opta team
  type TeamRecon = {
    tries: number;
    conversions: number;
    penalties: number;
    drops: number;
  };
  const reconMap = new Map<string, Map<number, TeamRecon>>();

  let playersScored = 0;

  for (const ps of playerStats) {
    if (!ps.fixture_id) continue;
    const uuid = optaToUuid.get(ps.opta_player_id);
    if (!uuid) continue;

    const { points, minutes } = scorePlayer(ps.stats, ps.position, rules);

    upsertRows.push({
      fixture_id: ps.fixture_id,
      player_id: uuid,
      minutes_played: minutes,
      stats: ps.stats,
      fantasy_points: points,
    });

    playerMatchPts.set(`${ps.fixture_id}:${uuid}`, { points, minutes });
    playersScored++;

    // Reconciliation tracking
    if (!reconMap.has(ps.fixture_id))
      reconMap.set(ps.fixture_id, new Map<number, TeamRecon>());
    const tm = reconMap.get(ps.fixture_id)!;
    const tr = tm.get(ps.opta_team_id) ?? {
      tries: 0,
      conversions: 0,
      penalties: 0,
      drops: 0,
    };
    tr.tries += readStat(ps.stats, "tries");
    tr.conversions += readStat(ps.stats, "conversion_goals");
    tr.penalties += readStat(ps.stats, "penalty_goals");
    tr.drops += readStat(ps.stats, "drop_goals_converted");
    tm.set(ps.opta_team_id, tr);
  }

  /* ── 7. Upsert fantasy_player_match_stats ── */

  const BATCH = 500;
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const batch = upsertRows.slice(i, i + BATCH);
    const { error } = await matchStatsTable.upsert(batch, {
      onConflict: "fixture_id,player_id",
    });
    if (error) {
      return NextResponse.json(
        { error: `Match stats upsert failed: ${error.message}` },
        { status: 500 }
      );
    }
  }

  /* ── 8. Reconciliation check ── */

  const { data: teamMappings } = (await admin
    .from("opta_team_mapping")
    .select("opta_team_id, team_id")) as unknown as {
    data: { opta_team_id: string; team_id: string }[] | null;
  };

  const optaTeamToUuid = new Map<string, string>();
  for (const m of teamMappings ?? [])
    optaTeamToUuid.set(String(m.opta_team_id), m.team_id);

  for (const fix of fixtures) {
    const tm = reconMap.get(fix.id);
    if (!tm) continue;

    for (const [otId, rc] of Array.from(tm.entries())) {
      const computed =
        rc.tries * 5 + rc.conversions * 2 + rc.penalties * 3 + rc.drops * 3;
      const teamUuid = optaTeamToUuid.get(String(otId));

      let actual: number | null = null;
      if (teamUuid === fix.home_team_id) actual = fix.home_score;
      else if (teamUuid === fix.away_team_id) actual = fix.away_score;

      if (actual !== null && computed !== actual) {
        warnings.push(
          `Fixture ${fix.id}: team ${otId} computed=${computed} actual=${actual}`
        );
      }
    }
  }

  /* ── 9. Score squads ── */

  const squadsTable = admin.from("fantasy_squads") as unknown as AnyTable;
  const picksTable = admin.from("fantasy_squad_picks") as unknown as AnyTable;

  const { data: squads } = (await squadsTable
    .select("id, captain_player_id, vice_captain_player_id")
    .eq("gameweek_id", gameweekId)
    .eq("competition_id", FANTASY_COMP_ID)
    .eq("is_complete", true)) as {
    data:
      | {
          id: string;
          captain_player_id: string | null;
          vice_captain_player_id: string | null;
        }[]
      | null;
  };

  let squadsUpdated = 0;

  if (squads?.length) {
    const squadIds = squads.map((s) => s.id);
    const { data: allPicks } = (await picksTable
      .select("id, squad_id, player_id")
      .in("squad_id", squadIds)) as {
      data: { id: string; squad_id: string; player_id: string }[] | null;
    };

    const picksBySquad = new Map<
      string,
      { id: string; player_id: string }[]
    >();
    for (const p of allPicks ?? []) {
      const arr = picksBySquad.get(p.squad_id) ?? [];
      arr.push({ id: p.id, player_id: p.player_id });
      picksBySquad.set(p.squad_id, arr);
    }

    for (const squad of squads) {
      const picks = picksBySquad.get(squad.id) ?? [];

      let captainMinutes = 0;
      const pickScores: {
        pickId: string;
        playerId: string;
        raw: number;
      }[] = [];

      for (const pick of picks) {
        let raw = 0;
        let mins = 0;
        for (const fId of fixtureIds) {
          const mp = playerMatchPts.get(`${fId}:${pick.player_id}`);
          if (mp) {
            raw += mp.points;
            mins += mp.minutes;
          }
        }
        pickScores.push({ pickId: pick.id, playerId: pick.player_id, raw });
        if (pick.player_id === squad.captain_player_id) captainMinutes = mins;
      }

      let squadTotal = 0; console.log("[fantasy] captain_id:", squad.captain_player_id, "vice:", squad.vice_captain_player_id, "picks:", pickScores.map(p => p.playerId));
      for (const ps of pickScores) {
        let mult = 1;
        if (ps.playerId === squad.captain_player_id) { console.log("[fantasy] CAPTAIN MATCH", ps.playerId);
          mult = 2;
        } else if (ps.playerId === squad.vice_captain_player_id) {
          mult = captainMinutes === 0 ? 1.5 : 1;
        }
        const final = Math.round(ps.raw * mult * 100) / 100;
        squadTotal += final;

        await picksTable.update({ points: final }).eq("id", ps.pickId);
      }

      await squadsTable
        .update({ points: Math.round(squadTotal * 100) / 100 })
        .eq("id", squad.id);
      squadsUpdated++;
    }
  }

  /* ── 10. Return summary ── */

  return NextResponse.json({
    gameweek: { id: gameweekId, label: gameweekLabel },
    fixturesScored: fixtures.length,
    playersScored,
    squadsUpdated,
    warnings: warnings.length ? warnings : undefined,
  });
}
