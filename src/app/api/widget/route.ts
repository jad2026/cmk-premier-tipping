import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const FALLBACK_URL = "https://clubrugbytipping.com";


function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

type CompRow = {
  id: string;
  name: string;
  accent_color: string | null;
  surface_color: string | null;
  logo_url: string | null;
  site_url: string | null;
  short_label: string | null;
  is_main_comp: boolean;
  display_name: string | null;
};

type WidgetComp = {
  id: string;
  name: string;
  shortLabel: string | null;
  accentColor: string;
  surfaceColor: string | null;
  logoUrl: string | null;
  roundLabel: string | null;
  deadline: string | null;
  comingSoon: boolean;
  tipsComplete: boolean;
  picked: number;
  total: number;
  rank: number | null;
  totalPlayers: number | null;
  siteUrl: string;
};

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const raw = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!raw) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const hash = hashToken(raw);
  const admin = createAdminClient();

  const { data: tokenRow } = await (admin
    .from("widget_tokens") as any)
    .select("id, user_id")
    .eq("token_hash", hash)
    .single() as { data: { id: string; user_id: string } | null };

  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  (admin.from("widget_tokens") as any)
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .then();

  const userId = tokenRow.user_id;

  const { data: participations } = await admin
    .from("competition_participants")
    .select("competition_id")
    .eq("user_id", userId);

  const joinedIds = (participations ?? []).map((p) => p.competition_id);
  if (joinedIds.length === 0) {
    return NextResponse.json({ comps: [] });
  }

  const { data: allComps } = await admin
    .from("competitions")
    .select("id, name, accent_color, surface_color, logo_url, site_url, short_label, is_main_comp, display_name")
    .eq("is_active", true)
    .in("id", joinedIds) as unknown as { data: CompRow[] | null };

  const comps = (allComps ?? []).filter((c) => c.site_url);

  const siteGroups = new Map<string, CompRow[]>();
  for (const c of comps) {
    const url = c.site_url!;
    const group = siteGroups.get(url) ?? [];
    group.push(c);
    siteGroups.set(url, group);
  }

  function mainCompForSite(group: CompRow[]): CompRow {
    return group.find((c) => c.is_main_comp) ?? group[0];
  }

  const sites = Array.from(siteGroups.entries());
  const mainCompIds = sites.map(([, g]) => mainCompForSite(g).id);

  const now = new Date().toISOString();
  const { data: relevantGws } = mainCompIds.length > 0
    ? await admin
        .from("gameweeks")
        .select("id, competition_id, deadline, label, is_open")
        .in("competition_id", mainCompIds)
        .or(`is_open.eq.true,deadline.gt.${now}`)
        .order("number")
    : { data: [] };

  const gwIds = (relevantGws ?? []).map((g: { id: string }) => g.id);
  const { data: gwFixtures } = gwIds.length > 0
    ? await admin.from("fixtures").select("id, gameweek_id").in("gameweek_id", gwIds)
    : { data: [] };

  const fixtureIdsByGw = new Map<string, string[]>();
  for (const f of gwFixtures ?? []) {
    const ids = fixtureIdsByGw.get(f.gameweek_id) ?? [];
    ids.push(f.id);
    fixtureIdsByGw.set(f.gameweek_id, ids);
  }

  const allFixtureIds = (gwFixtures ?? []).map((f) => f.id);
  const { data: userPicks } = allFixtureIds.length > 0
    ? await admin.from("picks").select("fixture_id").eq("user_id", userId).in("fixture_id", allFixtureIds)
    : { data: [] };
  const pickedFixtureIds = new Set((userPicks ?? []).map((p) => p.fixture_id));

  const rankByComp = new Map<string, { rank: number; total: number }>();
  for (const compId of mainCompIds) {
    const { data: lb } = await admin
      .rpc("get_leaderboard_scores", { comp_id: compId }) as unknown as {
        data: { user_id: string; total_points: number }[] | null;
      };
    if (lb && lb.length > 0) {
      const sorted = [...lb].sort((a, b) => b.total_points - a.total_points);
      const idx = sorted.findIndex((r) => r.user_id === userId);
      if (idx >= 0) {
        rankByComp.set(compId, { rank: idx + 1, total: sorted.length });
      }
    }
  }

  const result: WidgetComp[] = [];

  for (const [siteUrl, group] of sites) {
    const main = mainCompForSite(group);
    const gws = (relevantGws ?? []).filter((g: { competition_id: string }) => g.competition_id === main.id);
    const nowDate = new Date();

    // Find best round: open with future deadline, or next future, or open past deadline
    const openFuture = gws.find(
      (g: { is_open: boolean; deadline: string; id: string }) =>
        g.is_open && new Date(g.deadline) > nowDate && (fixtureIdsByGw.get(g.id)?.length ?? 0) > 0,
    );

    let roundLabel: string | null = null;
    let deadline: string | null = null;
    let picked = 0;
    let total = 0;
    let tipsComplete = false;
    let comingSoon = false;

    if (openFuture) {
      const fIds = fixtureIdsByGw.get(openFuture.id) ?? [];
      roundLabel = openFuture.label;
      deadline = openFuture.deadline;
      total = fIds.length;
      picked = fIds.filter((fid: string) => pickedFixtureIds.has(fid)).length;
      tipsComplete = total > 0 && picked >= total;
    } else {
      const futureRounds = gws
        .filter((g: { deadline: string; is_open: boolean }) => new Date(g.deadline) > nowDate && !g.is_open)
        .sort((a: { deadline: string }, b: { deadline: string }) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

      if (futureRounds.length > 0) {
        const nextRound = futureRounds[0];
        roundLabel = nextRound.label;
        const fc = fixtureIdsByGw.get(nextRound.id)?.length ?? 0;
        if (fc > 0) {
          deadline = nextRound.deadline;
        } else {
          comingSoon = true;
        }
      } else {
        const openPast = gws.find((g: { is_open: boolean; deadline: string }) => g.is_open && new Date(g.deadline) <= nowDate);
        if (openPast) {
          roundLabel = openPast.label;
        }
      }
    }

    const displayName = main.display_name ?? main.short_label ?? main.name;
    const rankInfo = rankByComp.get(main.id);
    const resolvedSiteUrl = siteUrl || FALLBACK_URL;

    let resolvedLogo = main.logo_url;
    if (resolvedLogo && resolvedLogo.startsWith("/")) {
      resolvedLogo = `${resolvedSiteUrl}${resolvedLogo}`;
    }

    result.push({
      id: main.id,
      name: displayName,
      shortLabel: main.short_label,
      accentColor: main.accent_color || "#D9A521",
      surfaceColor: main.surface_color,
      logoUrl: resolvedLogo,
      roundLabel,
      deadline,
      comingSoon,
      tipsComplete,
      picked,
      total,
      rank: rankInfo?.rank ?? null,
      totalPlayers: rankInfo?.total ?? null,
      siteUrl: resolvedSiteUrl,
    });
  }

  result.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  return NextResponse.json({ comps: result });
}
