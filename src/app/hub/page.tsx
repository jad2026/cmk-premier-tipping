import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { NPC_COMPETITION_ID } from "@/lib/competition";
import JoinButton from "./JoinButton";

export const revalidate = 60;

const FALLBACK_URL = "https://clubrugbytipping.com";
const NPC_SITE_URL = "https://clubrugbytipping.com";

// The competition IDs that HOST_TO_COMPETITION_ID in middleware resolves to.
// These are the "tenant" comps whose deadline and tips status represent the site.
const MAIN_COMP_IDS = new Set([
  "bf6bb916-86c7-4cb1-8268-ba887a973c1f", // Provincial (NPC)
  "b3dbe30d-91ef-40c3-9680-3586c6d17ef8", // CMK Premier Men
  "7a27f36c-aab6-4ba8-86e3-2bd9b182361e", // Bridlington RUFC
  "24d98bce-ce4b-4411-be28-8af22f4663a7", // Waikato Premier A Championship
]);

type CompRow = {
  id: string;
  name: string;
  logo_url: string | null;
  accent_color: string | null;
  surface_color: string | null;
  region_label: string | null;
  hero_image: string | null;
  site_url: string | null;
};

type HubSite = {
  siteUrl: string;
  mainComp: CompRow;
  compIds: string[];
  deadline: string | null;
  roundLabel: string | null;
  tipsIn: boolean;
  totalFixtures: number;
  userPicks: number;
};

export default async function HubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: participations } = await supabase
    .from("competition_participants")
    .select("competition_id")
    .eq("user_id", user.id);

  const joinedIds = new Set((participations ?? []).map((p) => p.competition_id));

  const { data: allComps } = await supabase
    .from("competitions")
    .select("id, name, logo_url, accent_color, surface_color, region_label, hero_image, site_url")
    .eq("is_active", true) as unknown as { data: CompRow[] | null };

  const comps = (allComps ?? []).filter((c) => c.site_url);

  // Group by site_url
  const siteGroups = new Map<string, CompRow[]>();
  for (const c of comps) {
    const url = c.site_url!;
    const group = siteGroups.get(url) ?? [];
    group.push(c);
    siteGroups.set(url, group);
  }

  // For each site, pick the main comp (the one in HOST_TO_COMPETITION_ID)
  function mainCompForSite(group: CompRow[]): CompRow {
    return group.find((c) => MAIN_COMP_IDS.has(c.id)) ?? group[0];
  }

  // A user is "in" a site if they're in ANY comp on that site
  function userInSite(group: CompRow[]): boolean {
    return group.some((c) => joinedIds.has(c.id));
  }

  // Fetch gameweek data for main comps only
  const mainCompIds = Array.from(siteGroups.values()).map((g) => mainCompForSite(g).id);

  type GwRow = { id: string; competition_id: string; deadline: string; label: string };
  const { data: openGameweeks } = mainCompIds.length > 0
    ? await supabase
        .from("gameweeks")
        .select("id, competition_id, deadline, label")
        .in("competition_id", mainCompIds)
        .eq("is_open", true)
        .order("deadline") as unknown as { data: GwRow[] | null }
    : { data: [] as GwRow[] };

  const gwByComp = new Map<string, GwRow>();
  for (const gw of openGameweeks ?? []) {
    const existing = gwByComp.get(gw.competition_id);
    if (!existing || new Date(gw.deadline) < new Date(existing.deadline)) {
      gwByComp.set(gw.competition_id, gw);
    }
  }

  const gwIds = Array.from(gwByComp.values()).map((g) => g.id);
  const { data: fixtures } = gwIds.length > 0
    ? await supabase.from("fixtures").select("id, gameweek_id").in("gameweek_id", gwIds)
    : { data: [] };

  const fixturesByGw = new Map<string, string[]>();
  for (const f of fixtures ?? []) {
    const list = fixturesByGw.get(f.gameweek_id) ?? [];
    list.push(f.id);
    fixturesByGw.set(f.gameweek_id, list);
  }

  const allFixtureIds = (fixtures ?? []).map((f) => f.id);
  const { data: userPicks } = allFixtureIds.length > 0
    ? await supabase
        .from("picks")
        .select("fixture_id")
        .eq("user_id", user.id)
        .in("fixture_id", allFixtureIds)
    : { data: [] };

  const pickedFixtureIds = new Set((userPicks ?? []).map((p) => p.fixture_id));

  function buildHubSite(siteUrl: string, group: CompRow[]): HubSite {
    const main = mainCompForSite(group);
    const gw = gwByComp.get(main.id);
    const gwFixtureIds = gw ? (fixturesByGw.get(gw.id) ?? []) : [];
    const userPickCount = gwFixtureIds.filter((fid) => pickedFixtureIds.has(fid)).length;
    return {
      siteUrl,
      mainComp: main,
      compIds: group.map((c) => c.id),
      deadline: gw?.deadline ?? null,
      roundLabel: gw?.label ?? null,
      tipsIn: gwFixtureIds.length > 0 && userPickCount >= gwFixtureIds.length,
      totalFixtures: gwFixtureIds.length,
      userPicks: userPickCount,
    };
  }

  const joinedSites: HubSite[] = [];
  const unjoinedSites: HubSite[] = [];

  for (const [siteUrl, group] of Array.from(siteGroups.entries())) {
    const site = buildHubSite(siteUrl, group);
    if (userInSite(group)) {
      joinedSites.push(site);
    } else {
      unjoinedSites.push(site);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-white">
          Your Competitions
        </h1>
        <p className="text-[#8C93A0] text-sm mt-1">
          Pick a competition to start tipping
        </p>
      </div>

      {joinedSites.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {joinedSites.map((site) => (
            <SiteCard key={site.siteUrl} site={site} joined />
          ))}
        </div>
      ) : (
        <p className="text-[#8C93A0]">You haven&apos;t joined any competitions yet.</p>
      )}

      {unjoinedSites.length > 0 && (
        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-white mb-3">
            Available Competitions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {unjoinedSites.map((site) => (
              <SiteCard key={site.siteUrl} site={site} joined={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SiteCard({ site, joined }: { site: HubSite; joined: boolean }) {
  const comp = site.mainComp;
  const accent = comp.accent_color || "#D9A521";
  const surface = comp.surface_color || "#161A22";
  const switchUrl = `/api/hub/switch?comp=${comp.id}`;
  const deadlinePast = site.deadline ? new Date(site.deadline) < new Date() : false;

  const inner = (
    <>
      {comp.hero_image && (
        <div className="relative h-28 overflow-hidden">
          <Image
            src={comp.hero_image}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${surface}, transparent)` }} />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          {comp.logo_url && (
            <Image
              src={comp.logo_url}
              alt=""
              width={40}
              height={40}
              className="rounded-md shrink-0"
            />
          )}
          <div className="min-w-0">
            <h3 className="font-display text-white text-base uppercase tracking-wide truncate">
              {comp.name}
            </h3>
            {comp.region_label && (
              <p className="text-xs text-[#8C93A0]">{comp.region_label}</p>
            )}
          </div>
        </div>

        {joined && site.roundLabel && (
          <div className="text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[#8C93A0]">{site.roundLabel}</span>
              {site.tipsIn ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  Tips in
                </span>
              ) : site.totalFixtures > 0 ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                  {site.userPicks}/{site.totalFixtures} picked
                </span>
              ) : null}
            </div>
            {site.deadline && !deadlinePast && (
              <p className="text-xs text-[#8C93A0]">
                Deadline: {new Date(site.deadline).toLocaleDateString("en-NZ", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
            {deadlinePast && (
              <p className="text-xs text-[#8C93A0]">Tips closed for this round</p>
            )}
          </div>
        )}

        {joined && !site.roundLabel && (
          <p className="text-sm text-[#8C93A0]">No open round</p>
        )}

        {joined ? (
          <div
            className="rounded-lg px-3 py-2 text-center text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: accent, color: "#11151C" }}
          >
            Go to tips
          </div>
        ) : (
          <JoinButton competitionId={comp.id} accent={accent} />
        )}
      </div>
    </>
  );

  if (joined) {
    return (
      <a
        href={switchUrl}
        className="block rounded-xl border border-white/[.08] overflow-hidden transition-transform hover:scale-[1.01] hover:border-white/[.15]"
        style={{ background: surface }}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      className="rounded-xl border border-white/[.08] overflow-hidden"
      style={{ background: surface }}
    >
      {inner}
    </div>
  );
}
