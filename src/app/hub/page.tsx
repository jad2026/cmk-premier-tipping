import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import JoinButton from "./JoinButton";

export const revalidate = 60;

const FALLBACK_URL = "https://clubrugbytipping.com";

const MAIN_COMP_IDS = new Set([
  "bf6bb916-86c7-4cb1-8268-ba887a973c1f",
  "b3dbe30d-91ef-40c3-9680-3586c6d17ef8",
  "7a27f36c-aab6-4ba8-86e3-2bd9b182361e",
  "24d98bce-ce4b-4411-be28-8af22f4663a7",
]);

const SITE_DISPLAY: Record<string, { name: string; subtitle?: string }> = {
  "https://clubrugbytipping.com": { name: "Provincial Rugby" },
  "https://taranaki.clubrugbytipping.com": {
    name: "Taranaki Club Rugby",
    subtitle: "Proudly sponsored by CMK",
  },
};

type CompRow = {
  id: string;
  name: string;
  logo_url: string | null;
  accent_color: string | null;
  surface_color: string | null;
  region_label: string | null;
  hero_image: string | null;
  site_url: string | null;
  short_label: string | null;
};

type GwRow = {
  id: string;
  competition_id: string;
  deadline: string;
  label: string;
  is_open: boolean;
  fixture_count: number;
};

type RoundState =
  | { mode: "open"; label: string; deadline: string; totalFixtures: number; userPicks: number }
  | { mode: "closed"; label: string }
  | { mode: "upcoming"; label: string; deadline: string }
  | { mode: "coming-soon"; label: string }
  | { mode: "none" };

type HubSite = {
  siteUrl: string;
  displayName: string;
  subtitle: string | null;
  mainComp: CompRow;
  compIds: string[];
  round: RoundState;
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
    .select("id, name, logo_url, accent_color, surface_color, region_label, hero_image, site_url, short_label")
    .eq("is_active", true) as unknown as { data: CompRow[] | null };

  const comps = (allComps ?? []).filter((c) => c.site_url);

  const siteGroups = new Map<string, CompRow[]>();
  for (const c of comps) {
    const url = c.site_url!;
    const group = siteGroups.get(url) ?? [];
    group.push(c);
    siteGroups.set(url, group);
  }

  function mainCompForSite(group: CompRow[]): CompRow {
    return group.find((c) => MAIN_COMP_IDS.has(c.id)) ?? group[0];
  }

  function userInSite(group: CompRow[]): boolean {
    return group.some((c) => joinedIds.has(c.id));
  }

  const mainCompIds = Array.from(siteGroups.values()).map((g) => mainCompForSite(g).id);

  // Fetch open rounds AND future rounds (for "coming soon" / "upcoming")
  const { data: relevantGws } = mainCompIds.length > 0
    ? await supabase
        .from("gameweeks")
        .select("id, competition_id, deadline, label, is_open")
        .in("competition_id", mainCompIds)
        .or(`is_open.eq.true,deadline.gt.${new Date().toISOString()}`)
        .order("number") as unknown as { data: Omit<GwRow, "fixture_count">[] | null }
    : { data: [] as Omit<GwRow, "fixture_count">[] };

  // Get fixture counts for these gameweeks
  const gwIds = (relevantGws ?? []).map((g) => g.id);
  const { data: gwFixtures } = gwIds.length > 0
    ? await supabase.from("fixtures").select("id, gameweek_id").in("gameweek_id", gwIds)
    : { data: [] };

  const fixtureCountByGw = new Map<string, number>();
  const fixtureIdsByGw = new Map<string, string[]>();
  for (const f of gwFixtures ?? []) {
    fixtureCountByGw.set(f.gameweek_id, (fixtureCountByGw.get(f.gameweek_id) ?? 0) + 1);
    const ids = fixtureIdsByGw.get(f.gameweek_id) ?? [];
    ids.push(f.id);
    fixtureIdsByGw.set(f.gameweek_id, ids);
  }

  // Get user's picks for these fixtures
  const allFixtureIds = (gwFixtures ?? []).map((f) => f.id);
  const { data: userPicks } = allFixtureIds.length > 0
    ? await supabase
        .from("picks")
        .select("fixture_id")
        .eq("user_id", user.id)
        .in("fixture_id", allFixtureIds)
    : { data: [] };
  const pickedFixtureIds = new Set((userPicks ?? []).map((p) => p.fixture_id));

  function resolveRound(compId: string): RoundState {
    const gws = (relevantGws ?? []).filter((g) => g.competition_id === compId);
    const now = new Date();

    // Open round with future deadline = tips still open
    const openFuture = gws.find((g) => g.is_open && new Date(g.deadline) > now && (fixtureCountByGw.get(g.id) ?? 0) > 0);
    if (openFuture) {
      const fIds = fixtureIdsByGw.get(openFuture.id) ?? [];
      return {
        mode: "open",
        label: openFuture.label,
        deadline: openFuture.deadline,
        totalFixtures: fIds.length,
        userPicks: fIds.filter((fid) => pickedFixtureIds.has(fid)).length,
      };
    }

    // Next future round (not open yet, or open but past deadline)
    const futureRounds = gws
      .filter((g) => new Date(g.deadline) > now && !g.is_open)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    if (futureRounds.length > 0) {
      const next = futureRounds[0];
      const fc = fixtureCountByGw.get(next.id) ?? 0;
      if (fc > 0) {
        return { mode: "upcoming", label: next.label, deadline: next.deadline };
      }
      return { mode: "coming-soon", label: next.label };
    }

    // Open round with past deadline (tips closed, nothing upcoming)
    const openPast = gws.find((g) => g.is_open && new Date(g.deadline) <= now);
    if (openPast) {
      return { mode: "closed", label: openPast.label };
    }

    return { mode: "none" };
  }

  function buildHubSite(siteUrl: string, group: CompRow[]): HubSite {
    const main = mainCompForSite(group);
    const display = SITE_DISPLAY[siteUrl];
    return {
      siteUrl,
      displayName: display?.name ?? main.short_label ?? main.name,
      subtitle: display?.subtitle ?? main.region_label,
      mainComp: main,
      compIds: group.map((c) => c.id),
      round: resolveRound(main.id),
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
    <div className="space-y-8" data-hub-page="">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-[.04em]" style={{ color: "var(--accent)" }}>
          Your Competitions
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8C93A0" }}>
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
        <p style={{ color: "#8C93A0" }}>You haven&apos;t joined any competitions yet.</p>
      )}

      {unjoinedSites.length > 0 && (
        <div>
          <h2 className="font-display text-lg uppercase tracking-[.04em] mb-3" style={{ color: "var(--accent)" }}>
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

function RoundBadge({ round }: { round: RoundState }) {
  if (round.mode === "none") return <p className="text-sm" style={{ color: "#8C93A0" }}>No open round</p>;

  if (round.mode === "coming-soon") {
    return (
      <div className="text-sm space-y-1">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        <p className="text-xs" style={{ color: "#8C93A0" }}>Next round coming soon</p>
      </div>
    );
  }

  if (round.mode === "closed") {
    return (
      <div className="text-sm space-y-1">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        <p className="text-xs" style={{ color: "#8C93A0" }}>Tips closed — results pending</p>
      </div>
    );
  }

  if (round.mode === "upcoming") {
    return (
      <div className="text-sm space-y-1">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        <p className="text-xs" style={{ color: "#8C93A0" }}>
          Opens {new Date(round.deadline).toLocaleDateString("en-NZ", {
            weekday: "short", day: "numeric", month: "short",
          })}
        </p>
      </div>
    );
  }

  // mode === "open"
  const allPicked = round.totalFixtures > 0 && round.userPicks >= round.totalFixtures;
  return (
    <div className="text-sm space-y-1">
      <div className="flex items-center justify-between">
        <span style={{ color: "#8C93A0" }}>{round.label}</span>
        {allPicked ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,.15)", color: "#34d399" }}>
            Tips in
          </span>
        ) : round.totalFixtures > 0 ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,.15)", color: "#fbbf24" }}>
            {round.userPicks}/{round.totalFixtures} picked
          </span>
        ) : null}
      </div>
      <p className="text-xs" style={{ color: "#8C93A0" }}>
        Deadline: {new Date(round.deadline).toLocaleDateString("en-NZ", {
          weekday: "short", day: "numeric", month: "short",
          hour: "numeric", minute: "2-digit",
        })}
      </p>
    </div>
  );
}

function SiteCard({ site, joined }: { site: HubSite; joined: boolean }) {
  const comp = site.mainComp;
  const accent = comp.accent_color || "#D9A521";
  const surface = comp.surface_color || "#161A22";
  const switchUrl = `/api/hub/switch?comp=${comp.id}`;

  const inner = (
    <>
      {comp.hero_image ? (
        <div className="relative h-32 overflow-hidden">
          <Image
            src={comp.hero_image}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${surface} 10%, transparent 70%)` }} />
        </div>
      ) : (
        <div className="h-2 rounded-t-xl" style={{ background: accent }} />
      )}

      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          {comp.logo_url && (
            <Image
              src={comp.logo_url}
              alt=""
              width={44}
              height={44}
              className="rounded-lg shrink-0"
            />
          )}
          <div className="min-w-0">
            <h3 className="font-display text-white text-[15px] uppercase tracking-[.04em] leading-tight truncate">
              {site.displayName}
            </h3>
            {site.subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "#8C93A0" }}>{site.subtitle}</p>
            )}
          </div>
        </div>

        {joined && <RoundBadge round={site.round} />}

        {joined ? (
          <div
            className="rounded-lg px-3 py-2.5 text-center text-sm font-bold uppercase tracking-wide transition-opacity hover:opacity-90"
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
        className="block rounded-xl overflow-hidden transition-transform hover:scale-[1.01]"
        style={{ background: surface, border: `1px solid rgba(255,255,255,.08)` }}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: surface, border: `1px solid rgba(255,255,255,.08)` }}
    >
      {inner}
    </div>
  );
}
