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

type GameweekWithFixtures = {
  id: string;
  number: number;
  label: string;
  fixtures: { match_date: string | null }[] | null;
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

  const [squadRes, gwRes] = await Promise.all([
    (admin.from("fantasy_squads") as unknown as AnyTable)
      .select("user_id, gameweek_id, points")
      .eq("competition_id", FANTASY_COMP_ID)
      .eq("is_complete", true)
      .not("points", "is", null),
    (admin.from("gameweeks") as unknown as AnyTable)
      .select("id, number, label, fixtures(match_date)")
      .eq("competition_id", FANTASY_COMP_ID)
      .order("number"),
  ]);

  const squads = (squadRes as { data: SquadRow[] | null }).data;
  const gwRows = (gwRes as { data: GameweekWithFixtures[] | null }).data;

  // A round is available as soon as it kicks off — i.e. its earliest fixture is
  // in the past — so the pills don't wait on the scoring cron to run.
  const now = Date.now();
  const startedGameweeks: GameweekInfo[] = (gwRows ?? [])
    .filter((gw) => {
      const kickoffs = (gw.fixtures ?? [])
        .map((f) => (f.match_date ? new Date(f.match_date).getTime() : NaN))
        .filter((t) => !Number.isNaN(t));
      return kickoffs.length > 0 && Math.min(...kickoffs) <= now;
    })
    .map((gw) => ({ id: gw.id, number: gw.number, label: gw.label }));

  if (!squads?.length) {
    return <LeaderboardView entries={[]} gameweeks={startedGameweeks} />;
  }

  const userIds = Array.from(new Set(squads.map((s) => s.user_id)));

  const { data: profiles } = (await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds)) as unknown as { data: ProfileRow[] | null };

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

  return <LeaderboardView entries={entries} gameweeks={startedGameweeks} />;
}
