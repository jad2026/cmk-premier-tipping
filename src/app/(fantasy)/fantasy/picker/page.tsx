import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import SquadPicker from "./SquadPicker";

export const revalidate = 300;

export const metadata = {
  title: "Fantasy Squad Picker — Club Rugby Tipping",
};

type PlayerRow = {
  opta_player_id: string;
  player_name: string;
  opta_team_id: number;
  position: string;
  season: string;
  games: number;
  tries: number;
  tackles: number;
  metres: number;
  clean_breaks: number;
  points: number;
};

type MappingRow = {
  opta_team_id: string;
  team_id: string;
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
};

export default async function FantasyPickerPage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const [{ data: mappings }, { data: teams }] = await Promise.all([
    supabase
      .from("opta_team_mapping")
      .select("opta_team_id, team_id") as unknown as Promise<{
      data: MappingRow[] | null;
    }>,
    supabase
      .from("teams")
      .select("id, name, short_name, colour, logo_url")
      .eq("competition_id", compId) as unknown as Promise<{
      data: TeamRow[] | null;
    }>,
  ]);

  const optaToTeamId = new Map<string, string>();
  for (const m of mappings ?? []) optaToTeamId.set(String(m.opta_team_id), m.team_id);

  const teamById = new Map<string, TeamRow>();
  for (const t of teams ?? []) teamById.set(t.id, t);

  const compTeamIds = new Set((teams ?? []).map((t) => t.id));

  const { data: playerRows } = (await supabase
    .from("player_season_stats" as "fixtures")
    .select("*")
    .in("season", ["2026"])) as unknown as { data: PlayerRow[] | null };

  const players: PickerPlayer[] = [];
  for (const row of playerRows ?? []) {
    const teamId = optaToTeamId.get(String(row.opta_team_id));
    if (!teamId || !compTeamIds.has(teamId)) continue;
    const team = teamById.get(teamId);
    if (!team) continue;

    players.push({
      id: row.opta_player_id,
      name: row.player_name,
      position: normalisePosition(row.position),
      teamId,
      teamName: team.name,
      teamShortName: team.short_name,
      teamColour: team.colour,
      teamLogoUrl: team.logo_url,
      games: row.games,
      tries: row.tries,
      tackles: row.tackles,
      metres: row.metres,
      cleanBreaks: row.clean_breaks,
      points: row.points,
    });
  }

  players.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  return <SquadPicker players={players} />;
}

function normalisePosition(raw: string | null): string {
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("prop") || lower.includes("hooker") || lower.includes("lock") || lower.includes("flanker") || lower.includes("number 8") || lower.includes("no.8"))
    return "Forward";
  if (lower.includes("scrum") || lower.includes("halfback") || lower.includes("half") || lower.includes("fly") || lower.includes("first five") || lower.includes("second five") || lower.includes("centre") || lower.includes("wing") || lower.includes("fullback") || lower.includes("back"))
    return "Back";
  if (lower === "forward" || lower === "forwards") return "Forward";
  if (lower === "back" || lower === "backs") return "Back";
  return "Forward";
}
