import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import SquadPicker from "./SquadPicker";

export const revalidate = 0;

export const metadata = {
  title: "Fantasy Squad Picker — Club Rugby Tipping",
};

type RawPlayerRow = {
  opta_game_id: string;
  opta_player_id: string;
  player_name: string;
  opta_team_id: number;
  position: string | null;
  stats: Record<string, string> | null;
};

type MappingRow = {
  opta_team_id: string;
  team_id: string;
};

type PoolRow = {
  player_id: string;
  price: number;
  avg_points: number;
};

type PlayerIdRow = {
  id: string;
  opta_player_id: string;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
  colour: string;
  logo_url: string | null;
};

export type PickerPlayer = {
  id: string;
  name: string;
  position: string;
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamColour: string;
  teamLogoUrl: string | null;
  games: number;
  tries: number;
  tackles: number;
  metres: number;
  cleanBreaks: number;
  points: number;
  avgPoints: number;
  price: number;
};

export type PickerTeam = {
  id: string;
  name: string;
  shortName: string;
  colour: string;
  logoUrl: string | null;
};

export type SavedSquadPick = {
  slot_number: number;
  player_id: string;
};

export type SavedSquad = {
  id: string;
  gameweekId: string;
  gameweekLabel: string;
  captainId: string | null;
  viceCaptainId: string | null;
  isLocked: boolean;
  picks: SavedSquadPick[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

/* ── Opta position → fantasy position mapping ── */

const OPTA_TO_FANTASY: Record<string, string> = {
  "Forward 1":      "Prop",
  "Forward 3":      "Prop",
  "Replacement 1":  "Prop",
  "Replacement 3":  "Prop",
  "Forward 2":      "Hooker",
  "Replacement 2":  "Hooker",
  "Forward 4":      "Lock",
  "Forward 5":      "Lock",
  "Replacement 4":  "Lock",
  "Forward 6":      "Loose Forward",
  "Forward 7":      "Loose Forward",
  "Forward 8":      "Loose Forward",
  "Replacement 5":  "Loose Forward",
  "Back 1":         "Halfback",
  "Replacement 6":  "Halfback",
  "Back 2":         "First Five",
  "Replacement 7":  "First Five",
  "Back 4":         "Centre",
  "Back 5":         "Centre",
  "Back 3":         "Outside Back",
  "Back 6":         "Outside Back",
  "Back 7":         "Outside Back",
  "Replacement 8":  "Outside Back",
};

function mapOptaPosition(raw: string | null): string | null {
  if (!raw) return null;
  return OPTA_TO_FANTASY[raw] ?? null;
}

function statVal(stats: Record<string, string> | null, ...keys: string[]): number {
  if (!stats) return 0;
  let total = 0;
  for (const k of keys) {
    const v = stats[k];
    if (v != null) {
      const n = parseInt(v, 10);
      if (!isNaN(n)) total += n;
    }
  }
  return total;
}

/* ── Aggregate per-game rows into one player ── */

type PlayerAccum = {
  name: string;
  optaTeamId: number;
  games: Set<string>;
  positionCounts: Record<string, number>;
  tries: number;
  tackles: number;
  metres: number;
  cleanBreaks: number;
  points: number;
};

export default async function FantasyPickerPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const compId = await getCurrentCompetitionId();

  const FANTASY_COMP_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

  const [{ data: mappings }, { data: teams }, { data: rawRows }, { data: poolRows }, { data: playerIdRows }] = await Promise.all([
    supabase
      .from("opta_team_mapping")
      .select("opta_team_id, team_id") as unknown as Promise<{
      data: MappingRow[] | null;
    }>,
    supabase
      .from("teams")
      .select("id, name, short_name, colour, logo_url")
      .eq("competition_id", compId)
      .order("name") as unknown as Promise<{
      data: TeamRow[] | null;
    }>,
    supabase
      .from("opta_player_stats")
      .select("opta_game_id, opta_player_id, player_name, opta_team_id, position, stats") as unknown as Promise<{
      data: RawPlayerRow[] | null;
    }>,
    admin
      .from("fantasy_player_pool")
      .select("player_id, price, avg_points")
      .eq("competition_id", FANTASY_COMP_ID)
      .eq("is_active", true) as unknown as Promise<{
      data: PoolRow[] | null;
    }>,
    admin
      .from("players")
      .select("id, opta_player_id") as unknown as Promise<{
      data: PlayerIdRow[] | null;
    }>,
  ]);

  const optaToTeamId = new Map<string, string>();
  for (const m of mappings ?? []) optaToTeamId.set(String(m.opta_team_id), m.team_id);

  const teamById = new Map<string, TeamRow>();
  for (const t of teams ?? []) teamById.set(t.id, t);

  const compTeamIds = new Set((teams ?? []).map((t) => t.id));

  // Build pool lookup: opta_player_id → { price, avgPoints }
  const poolByPlayerId = new Map<string, { price: number; avgPoints: number }>();
  for (const row of poolRows ?? []) {
    poolByPlayerId.set(row.player_id, { price: row.price, avgPoints: row.avg_points });
  }
  const playerIdToOpta = new Map<string, string>();
  const optaToPlayerId = new Map<string, string>();
  for (const row of playerIdRows ?? []) {
    if (row.opta_player_id) {
      playerIdToOpta.set(row.id, row.opta_player_id);
      optaToPlayerId.set(row.opta_player_id, row.id);
    }
  }
  // Map opta_player_id → pool data
  const poolByOpta = new Map<string, { price: number; avgPoints: number }>();
  for (const [playerId, pool] of Array.from(poolByPlayerId.entries())) {
    const optaId = playerIdToOpta.get(playerId);
    if (optaId) poolByOpta.set(optaId, pool);
  }

  const accum = new Map<string, PlayerAccum>();
  for (const row of rawRows ?? []) {
    if (!poolByOpta.has(row.opta_player_id)) continue;
    const teamId = optaToTeamId.get(String(row.opta_team_id));
    if (!teamId || !compTeamIds.has(teamId)) continue;

    let entry = accum.get(row.opta_player_id);
    if (!entry) {
      entry = {
        name: row.player_name,
        optaTeamId: row.opta_team_id,
        games: new Set<string>(),
        positionCounts: {},
        tries: 0,
        tackles: 0,
        metres: 0,
        cleanBreaks: 0,
        points: 0,
      };
      accum.set(row.opta_player_id, entry);
    }

    entry.games.add(row.opta_game_id);

    const fantasyPos = mapOptaPosition(row.position);
    if (fantasyPos) {
      entry.positionCounts[fantasyPos] = (entry.positionCounts[fantasyPos] ?? 0) + 1;
    }

    entry.tries += statVal(row.stats, "Tries", "tries");
    entry.tackles += statVal(row.stats, "Tackles", "tackles", "TacklesMade", "tackles_made");
    entry.metres += statVal(row.stats, "MetresRun", "metres_run", "Metres", "metres");
    entry.cleanBreaks += statVal(row.stats, "CleanBreaks", "clean_breaks", "LineBreaks", "line_breaks");
    entry.points += statVal(row.stats, "Points", "points");
  }

  const players: PickerPlayer[] = [];
  for (const [optaId, entry] of Array.from(accum.entries())) {
    const teamId = optaToTeamId.get(String(entry.optaTeamId));
    if (!teamId) continue;
    const team = teamById.get(teamId);
    if (!team) continue;

    const position = mostCommonPosition(entry.positionCounts);
    if (!position) continue;

    const gameCount = entry.games.size;
    const pool = poolByOpta.get(optaId);
    if (!pool) continue;

    const uuid = optaToPlayerId.get(optaId);
    if (!uuid) continue;

    players.push({
      id: uuid,
      name: entry.name,
      position,
      teamId,
      teamName: team.name,
      teamShortName: team.short_name,
      teamColour: team.colour,
      teamLogoUrl: team.logo_url,
      games: gameCount,
      tries: entry.tries,
      tackles: entry.tackles,
      metres: entry.metres,
      cleanBreaks: entry.cleanBreaks,
      points: entry.points,
      avgPoints: pool.avgPoints,
      price: pool.price,
    });
  }

  players.sort((a, b) => b.avgPoints - a.avgPoints || a.name.localeCompare(b.name));

  const pickerTeams: PickerTeam[] = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    colour: t.colour,
    logoUrl: t.logo_url,
  }));

  // Find the current editable gameweek: earliest with deadline in the future
  const { data: currentGw } = (await admin
    .from("gameweeks")
    .select("id, number, label, deadline")
    .eq("competition_id", FANTASY_COMP_ID)
    .gt("deadline", new Date().toISOString())
    .order("number")
    .limit(1)
    .maybeSingle()) as unknown as {
    data: { id: string; number: number; label: string; deadline: string } | null;
  };

  // Check if user is signed in and load/carryover squad
  const { data: { user } } = await supabase.auth.getUser();
  let savedSquad: SavedSquad | null = null;

  if (user && currentGw) {
    const { data: squad } = (await (
      admin.from("fantasy_squads") as unknown as AnyTable
    )
      .select("id, captain_player_id, vice_captain_player_id, is_locked")
      .eq("user_id", user.id)
      .eq("gameweek_id", currentGw.id)
      .maybeSingle()) as {
      data: { id: string; captain_player_id: string | null; vice_captain_player_id: string | null; is_locked: boolean } | null;
    };

    if (squad) {
      const { data: picks } = (await (
        admin.from("fantasy_squad_picks") as unknown as AnyTable
      )
        .select("slot_number, player_id")
        .eq("squad_id", squad.id)) as {
        data: SavedSquadPick[] | null;
      };

      savedSquad = {
        id: squad.id,
        gameweekId: currentGw.id,
        gameweekLabel: currentGw.label,
        captainId: squad.captain_player_id,
        viceCaptainId: squad.vice_captain_player_id,
        isLocked: squad.is_locked ?? false,
        picks: picks ?? [],
      };
    } else if (currentGw.number > 1) {
      const { data: prevGws } = (await admin
        .from("gameweeks")
        .select("id")
        .eq("competition_id", FANTASY_COMP_ID)
        .lt("number", currentGw.number)
        .order("number", { ascending: false })) as unknown as {
        data: { id: string }[] | null;
      };

      const prevGwIds = (prevGws ?? []).map((g) => g.id);

      if (prevGwIds.length > 0) {
        const { data: prevSquad } = (await (
          admin.from("fantasy_squads") as unknown as AnyTable
        )
          .select("id, captain_player_id, vice_captain_player_id, gameweek_id")
          .eq("user_id", user.id)
          .in("gameweek_id", prevGwIds)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()) as {
          data: { id: string; captain_player_id: string | null; vice_captain_player_id: string | null; gameweek_id: string } | null;
        };

        if (prevSquad) {
          const { data: prevPicks } = (await (
            admin.from("fantasy_squad_picks") as unknown as AnyTable
          )
            .select("slot_number, player_id")
            .eq("squad_id", prevSquad.id)) as {
            data: SavedSquadPick[] | null;
          };

          savedSquad = {
            id: "",
            gameweekId: currentGw.id,
            gameweekLabel: currentGw.label,
            captainId: prevSquad.captain_player_id,
            viceCaptainId: prevSquad.vice_captain_player_id,
            isLocked: false,
            picks: prevPicks ?? [],
          };
        }
      }
    }
  }

  return (
    <SquadPicker
      players={players}
      teams={pickerTeams}
      gameweekId={currentGw?.id ?? null}
      gameweekLabel={currentGw?.label ?? null}
      gameweekDeadline={currentGw?.deadline ?? null}
      savedSquad={savedSquad}
      isSignedIn={!!user}
    />
  );
}

function mostCommonPosition(counts: Record<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [pos, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = pos;
      bestCount = count;
    }
  }
  return best;
}
