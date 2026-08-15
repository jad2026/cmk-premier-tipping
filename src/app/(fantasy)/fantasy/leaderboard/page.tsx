import { createAdminClient } from "@/lib/supabase/server";
import LeaderboardView from "./LeaderboardView";

export const revalidate = 60;

export const metadata = {
  title: "Fantasy Leaderboard — Club Rugby Tipping",
};

const FANTASY_COMP_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

type SquadRow = {
  user_id: string;
  gameweek_id: string;
  points: number | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type GameweekRow = {
  id: string;
  number: number;
  label: string;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  totalPoints: number;
  rounds: Record<string, number>;
};

export type GameweekInfo = {
  id: string;
  number: number;
  label: string;
};

export default async function FantasyLeaderboardPage() {
  const admin = createAdminClient();

  const { data: squads } = (await (
    admin.from("fantasy_squads") as unknown as AnyTable
  )
    .select("user_id, gameweek_id, points")
    .eq("competition_id", FANTASY_COMP_ID)
    .eq("is_complete", true)
    .not("points", "is", null)) as { data: SquadRow[] | null };

  if (!squads?.length) {
    return <LeaderboardView entries={[]} gameweeks={[]} />;
  }

  const userIds = Array.from(new Set(squads.map((s) => s.user_id)));
  const gwIds = Array.from(new Set(squads.map((s) => s.gameweek_id)));

  const [{ data: profiles }, { data: gameweeks }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds) as unknown as Promise<{
      data: ProfileRow[] | null;
    }>,
    admin
      .from("gameweeks")
      .select("id, number, label")
      .in("id", gwIds)
      .order("number") as unknown as Promise<{
      data: GameweekRow[] | null;
    }>,
  ]);

  const profileMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p.display_name ?? "Anonymous");
  }

  const byUser = new Map<
    string,
    { totalPoints: number; rounds: Record<string, number> }
  >();
  for (const sq of squads) {
    if (!byUser.has(sq.user_id)) {
      byUser.set(sq.user_id, { totalPoints: 0, rounds: {} });
    }
    const entry = byUser.get(sq.user_id)!;
    const pts = sq.points ?? 0;
    entry.totalPoints += pts;
    entry.rounds[sq.gameweek_id] = pts;
  }

  const entries: LeaderboardEntry[] = Array.from(byUser.entries()).map(
    ([userId, data]) => ({
      userId,
      displayName: profileMap.get(userId) ?? "Anonymous",
      totalPoints: Math.round(data.totalPoints * 100) / 100,
      rounds: data.rounds,
    })
  );

  const gwInfo: GameweekInfo[] = (gameweeks ?? []).map((g) => ({
    id: g.id,
    number: g.number,
    label: g.label,
  }));

  return <LeaderboardView entries={entries} gameweeks={gwInfo} />;
}
