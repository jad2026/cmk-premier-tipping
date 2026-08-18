import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId");
  const gameweekId = searchParams.get("gameweekId");

  if (!leagueId || !gameweekId) {
    return NextResponse.json({ error: "leagueId and gameweekId are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("league_members")
    .select("league_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  const { data: league } = await admin
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league || (league as Record<string, unknown>).is_sponsored === true) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { data: gameweek } = await admin
    .from("gameweeks")
    .select("id, number, label, deadline, is_open")
    .eq("id", gameweekId)
    .maybeSingle();

  if (!gameweek) {
    return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });
  }

  if (new Date(gameweek.deadline) > new Date()) {
    return NextResponse.json({ error: "Round deadline has not passed" }, { status: 403 });
  }

  const { data: members } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);

  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) {
    return NextResponse.json({ fixtures: [], members: [] });
  }

  const { data: fixtureRows } = await admin
    .from("fixtures")
    .select("id, home_team_id, away_team_id, home_score, away_score, result_team_id, is_draw, match_date")
    .eq("gameweek_id", gameweekId)
    .order("match_date");

  if (!fixtureRows || fixtureRows.length === 0) {
    return NextResponse.json({ fixtures: [], members: [] });
  }

  const fixtureTeamIds = new Set<string>();
  for (const f of fixtureRows) {
    fixtureTeamIds.add(f.home_team_id);
    fixtureTeamIds.add(f.away_team_id);
  }
  const { data: fixtureTeams } = await admin
    .from("teams")
    .select("id, name, short_name, colour, logo_url")
    .in("id", Array.from(fixtureTeamIds));
  const fixtureTeamMap = new Map((fixtureTeams ?? []).map((t) => [t.id, t]));

  const fixtureIds = fixtureRows.map((f) => f.id);

  const allPicks: { user_id: string; fixture_id: string; picked_team_id: string | null; picked_draw: boolean; predicted_margin: number | null; is_correct: boolean | null; margin_correct: boolean | null; margin_bonus: number; points: number; auto_picked: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("picks")
      .select("user_id, fixture_id, picked_team_id, picked_draw, predicted_margin, is_correct, margin_correct, margin_bonus, points, auto_picked")
      .in("fixture_id", fixtureIds)
      .in("user_id", memberIds)
      .order("id")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    allPicks.push(...data);
    if (data.length < 1000) break;
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", memberIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const picksByUser = new Map<string, typeof allPicks>();
  for (const pick of allPicks) {
    const list = picksByUser.get(pick.user_id) ?? [];
    list.push(pick);
    picksByUser.set(pick.user_id, list);
  }

  const teamIds = new Set<string>();
  for (const pick of allPicks) {
    if (pick.picked_team_id) teamIds.add(pick.picked_team_id);
  }

  const { data: pickedTeams } = teamIds.size > 0
    ? await admin
        .from("teams")
        .select("id, name, short_name, colour, logo_url")
        .in("id", Array.from(teamIds))
    : { data: [] };

  const pickedTeamMap = new Map((pickedTeams ?? []).map((t) => [t.id, t]));

  const membersResult = memberIds.map((userId) => {
    const profile = profileMap.get(userId);
    const userPicks = picksByUser.get(userId) ?? [];
    const roundCorrect = userPicks.filter((p) => p.is_correct === true).length;
    const roundScore = userPicks.reduce((sum, p) => sum + p.points, 0);

    const picksByFixture = fixtureIds.map((fId) => {
      const pick = userPicks.find((p) => p.fixture_id === fId);
      if (!pick) return { fixture_id: fId, picked_team: null, picked_draw: false, predicted_margin: null, is_correct: null, margin_correct: null, margin_bonus: 0, points: 0, auto_picked: true };

      const pickedTeam = pick.picked_team_id ? pickedTeamMap.get(pick.picked_team_id) ?? null : null;
      return {
        fixture_id: fId,
        picked_team: pickedTeam ? { id: pickedTeam.id, short_name: pickedTeam.short_name, colour: pickedTeam.colour } : null,
        picked_draw: pick.picked_draw,
        predicted_margin: pick.predicted_margin,
        is_correct: pick.is_correct,
        margin_correct: pick.margin_correct,
        margin_bonus: pick.margin_bonus,
        points: pick.points,
        auto_picked: pick.auto_picked,
      };
    });

    return {
      user_id: userId,
      display_name: profile?.display_name ?? "Unknown",
      avatar_url: profile?.avatar_url ?? null,
      round_correct: roundCorrect,
      round_score: roundScore,
      picks: picksByFixture,
    };
  });

  membersResult.sort((a, b) => b.round_score - a.round_score || b.round_correct - a.round_correct || a.display_name.localeCompare(b.display_name));

  const defaultTeam = { id: "", name: "TBD", short_name: "TBD", colour: "#888", logo_url: null };
  const fixturesResult = fixtureRows.map((f) => ({
    id: f.id,
    home_team: fixtureTeamMap.get(f.home_team_id) ?? defaultTeam,
    away_team: fixtureTeamMap.get(f.away_team_id) ?? defaultTeam,
    home_score: f.home_score,
    away_score: f.away_score,
    result_team_id: f.result_team_id,
    is_draw: f.is_draw,
  }));

  return NextResponse.json({ fixtures: fixturesResult, members: membersResult });
}
