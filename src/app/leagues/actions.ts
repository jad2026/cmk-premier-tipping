"use server";

import { createClient } from "@/lib/supabase/server";
import type { League, LeagueMember, Profile, Pick } from "@/lib/supabase/types";

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createLeague(name: string): Promise<{ error?: string; league?: League }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const invite_code = randomCode();

  const { data: league, error } = await supabase
    .from("leagues")
    .insert({ name: name.trim(), invite_code, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  // Auto-join the creator
  await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id, joined_at: new Date().toISOString() });

  return { league };
}

export async function joinLeague(invite_code: string): Promise<{ error?: string; league?: League }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: league, error: findErr } = await supabase
    .from("leagues")
    .select()
    .eq("invite_code", invite_code.trim().toUpperCase())
    .single();

  if (findErr || !league) return { error: "League not found — check your invite code." };

  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id, joined_at: new Date().toISOString() });

  if (error) {
    if (error.code === "23505") return { error: "You're already a member of this league." };
    return { error: error.message };
  }

  return { league };
}

export async function fetchMyLeagues(): Promise<{ leagues: (League & { member_count: number })[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { leagues: [] };

  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id);

  if (!memberships?.length) return { leagues: [] };

  const leagueIds = memberships.map((m) => m.league_id);

  const { data: leagues } = await supabase
    .from("leagues")
    .select("*")
    .in("id", leagueIds)
    .order("created_at");

  const { data: allMembers } = await supabase
    .from("league_members")
    .select("league_id")
    .in("league_id", leagueIds);

  const countMap = new Map<string, number>();
  for (const m of allMembers ?? []) {
    countMap.set(m.league_id, (countMap.get(m.league_id) ?? 0) + 1);
  }

  return {
    leagues: (leagues ?? []).map((l) => ({ ...l, member_count: countMap.get(l.id) ?? 0 })),
  };
}

export type LeaderboardEntry = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  correct: number;
  total: number;
};

export async function fetchLeagueLeaderboard(
  leagueId: string
): Promise<{ league: League | null; entries: LeaderboardEntry[] }> {
  const supabase = await createClient();

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (!league) return { league: null, entries: [] };

  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);

  if (!members?.length) return { league, entries: [] };

  const userIds = members.map((m) => m.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name")
    .in("id", userIds);

  const { data: picks } = await supabase
    .from("picks")
    .select("user_id, is_correct")
    .in("user_id", userIds)
    .not("is_correct", "is", null);

  const scoreMap = new Map<string, { correct: number; total: number }>(
    (profiles as Profile[] ?? []).map((p) => [p.id, { correct: 0, total: 0 }])
  );

  for (const pick of picks as Pick[] ?? []) {
    const entry = scoreMap.get(pick.user_id);
    if (!entry) continue;
    entry.total++;
    if (pick.is_correct) entry.correct++;
  }

  const entries: LeaderboardEntry[] = (profiles as Profile[] ?? []).map((p) => ({
    user_id: p.id,
    display_name: p.display_name,
    first_name: p.first_name,
    last_name: p.last_name,
    ...(scoreMap.get(p.id) ?? { correct: 0, total: 0 }),
  }));

  entries.sort((a, b) => b.correct - a.correct || b.total - a.total);

  return { league, entries };
}
