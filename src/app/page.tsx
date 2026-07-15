import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId, getCompetitionTimezone, NPC_COMPETITION_ID, CMK_COMPETITION_ID } from "@/lib/competition";
import { fmtDeadline as fmtDeadlineTz } from "@/lib/datetime";
import Avatar from "@/components/Avatar";
import JoinCompetitionButton from "@/components/JoinCompetitionButton";
import TeamBadge from "@/components/TeamBadge";
import ClubsMarquee from "@/components/ClubsMarquee";
import type { Gameweek, Fixture, Team } from "@/lib/supabase/types";
import { HomeCountdown, FeaturedCountdown } from "./HomeCountdown";
import { getCachedTeams, getCachedSeasonConfig } from "@/lib/cached-queries";

export const revalidate = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

type RoundStatus = "open" | "completed" | "upcoming";

type RoundInfo = {
  gameweek: Gameweek;
  status: RoundStatus;
  total: number;
  resultsIn: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// fmtDeadline is created per-request inside HomePage() with the competition's timezone

function roundStatus(gw: Gameweek, fixtures: Fixture[]): RoundStatus {
  if (fixtures.length > 0 && fixtures.every((f) => f.result_team_id !== null || f.is_draw)) return "completed";
  if (gw.is_open) return "open";
  return "upcoming";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const tzLocale = await getCompetitionTimezone(compId);
  const fmtDeadline = (iso: string) => fmtDeadlineTz(iso, tzLocale);

  const { data: { user } } = await supabase.auth.getUser();

  let isEnrolled = false;
  if (user) {
    const { data: participant } = await supabase
      .from("competition_participants")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("competition_id", compId)
      .maybeSingle();
    isEnrolled = !!participant;
  }

  const CMK_WOMEN_COMPETITION_ID = "952743a7-9e79-4c5b-b15c-7fe07c4ca420";

  const [{ data: compGwRows }, seasonConfig, teams, womenTeams] =
    await Promise.all([
      supabase.from("gameweeks").select("*").eq("competition_id", compId).order("number"),
      getCachedSeasonConfig(compId),
      getCachedTeams(compId),
      getCachedTeams(CMK_WOMEN_COMPETITION_ID),
    ]);

  const gameweeks = compGwRows ?? [];
  const compGwIds = gameweeks.map((g) => g.id);

  const { data: allFixtures } = compGwIds.length > 0
    ? await supabase.from("fixtures").select("id, gameweek_id, result_team_id, is_draw").in("gameweek_id", compGwIds)
    : { data: [] };

  const fixturesByGw = new Map<string, Fixture[]>();
  for (const f of allFixtures ?? []) {
    const list = fixturesByGw.get(f.gameweek_id) ?? [];
    list.push(f as Fixture);
    fixturesByGw.set(f.gameweek_id, list);
  }

  const rounds: RoundInfo[] = gameweeks.map((gw) => {
    const fixtures = fixturesByGw.get(gw.id) ?? [];
    return {
      gameweek: gw,
      status: roundStatus(gw, fixtures),
      total: fixtures.length,
      resultsIn: fixtures.filter((f) => f.result_team_id !== null || f.is_draw).length,
    };
  });

  const seasonComplete = seasonConfig?.season_complete ?? false;
  const seasonName = seasonConfig?.season_name ?? `${new Date().getFullYear()} Season`;

  const openRoundsWithResults = rounds
    .filter((r) => r.status === "open" && r.total > 0 && r.resultsIn < r.total)
    .sort((a, b) => new Date(a.gameweek.deadline).getTime() - new Date(b.gameweek.deadline).getTime());
  const activeOpenRound = openRoundsWithResults[0] ?? null;
  const nextUpcoming = rounds.find((r) => r.status === "upcoming" && r.total > 0);

  const hasAnyFixtures = (allFixtures ?? []).length > 0;

  let activeRound: RoundInfo | null = null;
  let activeMode: "open" | "picks-closed" | "coming-soon" | "season-complete" | "no-fixtures" | "none" = "none";

  if (seasonComplete) {
    activeMode = "season-complete";
  } else if (!hasAnyFixtures) {
    activeMode = "no-fixtures";
  } else if (activeOpenRound) {
    activeRound = activeOpenRound;
    activeMode = new Date(activeOpenRound.gameweek.deadline) > new Date() ? "open" : "picks-closed";
  } else if (nextUpcoming) {
    activeRound = nextUpcoming;
    activeMode = "coming-soon";
  }

  // ── User pick counts for featured round ───────────────────────────────────
  let userPickCount = 0;
  if (user && activeRound) {
    const roundFixtures = fixturesByGw.get(activeRound.gameweek.id) ?? [];
    const fixtureIds = roundFixtures.map((f) => f.id);
    if (fixtureIds.length > 0) {
      const { count } = await supabase
        .from("picks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("fixture_id", fixtureIds);
      userPickCount = count ?? 0;
    }
  }

  // ── Ladder data (top 5) ────────────────────────────────────────────────────
  type LadderRow = {
    comp_id: string;
    team_id: string;
    team_name: string;
    position: number | null;
    matches_played: number | null;
    matches_won: number | null;
    matches_drawn: number | null;
    matches_lost: number | null;
    points_for: number | null;
    points_against: number | null;
    points_diff: number | null;
    bonus_points: number | null;
    match_points: number | null;
    crest: string | null;
  };

  let ladderRows: LadderRow[] = [];
  let womenLadderRows: LadderRow[] = [];
  let scoringConfig: Record<string, number> | null = null;
  {
    const { data: scoringRow } = await supabase
      .from("competitions")
      .select("scoring")
      .eq("id", compId)
      .single() as { data: { scoring: Record<string, number> | null } | null };
    scoringConfig = scoringRow?.scoring ?? null;
  }
  {
    const tenantIds = compId === CMK_COMPETITION_ID
      ? [CMK_COMPETITION_ID, CMK_WOMEN_COMPETITION_ID]
      : [compId];

    const { data: activeComps } = await supabase
      .from("competitions")
      .select("id, comp_id")
      .in("id", tenantIds)
      .eq("is_active", true);

    const comps = (activeComps ?? []) as { id: string; comp_id: string }[];
    const menXplorerId = comps.find((c) => c.id === CMK_COMPETITION_ID)?.comp_id;
    const womenXplorerId = comps.find((c) => c.id === CMK_WOMEN_COMPETITION_ID)?.comp_id;

    if (menXplorerId) {
      const { data } = await supabase
        .from("ladder_standings")
        .select(
          "comp_id, team_id, team_name, position, matches_played, matches_won, matches_drawn, matches_lost, points_for, points_against, points_diff, bonus_points, match_points, crest"
        )
        .eq("comp_id", menXplorerId)
        .order("position", { ascending: true });
      ladderRows = (data ?? []) as LadderRow[];
    }

    if (womenXplorerId) {
      const { data } = await supabase
        .from("ladder_standings")
        .select(
          "comp_id, team_id, team_name, position, matches_played, matches_won, matches_drawn, matches_lost, points_for, points_against, points_diff, bonus_points, match_points, crest"
        )
        .eq("comp_id", womenXplorerId)
        .order("position", { ascending: true });
      womenLadderRows = (data ?? []) as LadderRow[];
    }

  }

  // Build a map of team colours from the teams table (Men's + Women's)
  const teamColorMap = new Map<string, { colour: string; short_name: string; logo_url: string | null; name: string }>();
  for (const t of [...(teams ?? []), ...(womenTeams ?? [])] as Team[]) {
    teamColorMap.set(t.name, { colour: t.colour, short_name: t.short_name, logo_url: t.logo_url, name: t.name });
  }

  // ── Winner (season complete) ──────────────────────────────────────────────
  let winner: string | null = null;
  let winnerAvatarUrl: string | null = null;
  if (seasonComplete) {
    const compFixtureIds = (allFixtures ?? []).map((f) => f.id);
    const [{ data: correctPicks }, { data: profiles }] = await Promise.all([
      compFixtureIds.length > 0
        ? supabase.from("picks").select("user_id").eq("is_correct", true).in("fixture_id", compFixtureIds)
        : Promise.resolve({ data: [] }),
      supabase.from("profiles").select("id, display_name, avatar_url"),
    ]);

    if (correctPicks && correctPicks.length > 0) {
      const tally = new Map<string, number>();
      for (const p of correctPicks) {
        tally.set(p.user_id, (tally.get(p.user_id) ?? 0) + 1);
      }
      const topUserId = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const profile = profiles?.find((p) => p.id === topUserId);
      winner = profile?.display_name?.trim() || `Player ${topUserId.slice(0, 5).toUpperCase()}`;
      winnerAvatarUrl = profile?.avatar_url ?? null;
    }
  }

  const isNpc = compId === NPC_COMPETITION_ID;
  const compLabel = isNpc ? "Provincial" : "CMK Premier";
  const regionLabel = isNpc ? "New Zealand" : "Taranaki";

  // Filter out women's teams and deduplicate by name
  const dedupedTeams: Team[] = [];
  const seenTeamNames = new Set<string>();
  for (const t of (teams ?? []) as Team[]) {
    if (t.name.includes("Women")) continue;
    if (!seenTeamNames.has(t.name)) {
      seenTeamNames.add(t.name);
      dedupedTeams.push(t);
    }
  }
  const teamCount = dedupedTeams.length;

  const openCount = rounds.filter((r) => r.status === "open").length;
  const completedRound = rounds.filter((r) => r.status === "completed").length;

  function val(n: number | null): string {
    return n != null ? String(n) : "—";
  }

  function signed(n: number | null): string {
    if (n == null) return "—";
    return n > 0 ? `+${n}` : String(n);
  }

  return (
    <div className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8" style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}>

      {/* ── 1. Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden text-white" style={{ background: "#0B0E13" }}>
        <Image
          src={isNpc ? "/hero-provincial.jpg" : "/hero.jpg"}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover pointer-events-none"
          style={{ objectFit: "cover", objectPosition: "center 0%" }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(98deg, rgba(11,14,19,.97) 0%, rgba(11,14,19,.86) 40%, rgba(11,14,19,.45) 78%, rgba(11,14,19,.25) 100%)",
          }}
        />
        <div className="relative z-[2] max-w-content mx-auto" style={{ padding: "88px 32px 96px" }}>
          {activeRound && (
            <div className="flex items-center gap-3 mb-[26px]">
              <span className="block w-[26px] h-[3px] rounded-full" style={{ background: "var(--accent)" }} />
              <span className="text-[13px] font-extrabold tracking-[.22em] uppercase text-[#C7CCD4]">
                {activeRound.gameweek.label} · {compLabel} · {regionLabel}
              </span>
            </div>
          )}

          <h1 className="font-display text-[92px] leading-[.86] tracking-[-.01em] uppercase max-w-[760px] mb-[22px]">
            {isNpc ? <>Back your<br />province</> : <>Make your<br />call</>}<span style={{ color: "var(--accent)" }}>.</span>
          </h1>

          {activeRound && activeMode === "open" && (
            <p className="text-[19px] leading-[1.5] text-[#C2C7D0] max-w-[480px] mb-[38px]">
              {isNpc
                ? "Pick the winners, back your province, and climb the national leaderboard."
                : `${activeRound.gameweek.label} is open. Lock your tips before kickoff, back your clubs and climb the leaderboard.`}
            </p>
          )}
          {activeMode === "picks-closed" && activeRound && (
            <p className="text-[19px] leading-[1.5] text-[#C2C7D0] max-w-[480px] mb-[38px]">
              {activeRound.gameweek.label} — picks are closed. Results are on the way.
            </p>
          )}
          {activeMode === "coming-soon" && activeRound && (
            <p className="text-[19px] leading-[1.5] text-[#C2C7D0] max-w-[480px] mb-[38px]">
              Next round opens soon — check back to start tipping.
            </p>
          )}
          {activeMode === "season-complete" && (
            <p className="text-[19px] leading-[1.5] text-[#C2C7D0] max-w-[480px] mb-[38px]">
              {seasonName} — the season is complete. Thanks for tipping!
            </p>
          )}
          {(activeMode === "no-fixtures" || activeMode === "none") && (
            <p className="text-[19px] leading-[1.5] text-[#C2C7D0] max-w-[480px] mb-[38px]">
              The season is being set up — check back soon to start tipping!
            </p>
          )}

          {activeRound && activeMode === "open" && (
            <div className="flex items-end gap-[14px] flex-wrap mb-[42px]">
              <HomeCountdown deadline={activeRound.gameweek.deadline} />
              <div className="flex flex-col justify-center pl-1.5">
                <div className="text-[12px] font-bold tracking-[.1em] uppercase text-[#8C93A0]">Tips close</div>
                <div className="text-[15px] font-bold text-[#E6E8EC]">{fmtDeadline(activeRound.gameweek.deadline)}</div>
              </div>
            </div>
          )}

          <div className="flex gap-[14px] flex-wrap">
            <Link
              href="/tips"
              className="inline-flex items-center gap-2.5 px-[30px] py-[17px] rounded-[12px] text-[16px] font-extrabold tracking-[.02em] uppercase no-underline active:scale-[0.98] transition-transform"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Make your tips →
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2.5 px-[28px] py-[17px] rounded-[12px] text-[16px] font-bold text-white no-underline transition-colors hover:bg-white/[.08]"
              style={{ border: "1.5px solid rgba(255,255,255,.28)" }}
            >
              View leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Clubs rail ────────────────────────────────────────────────────── */}
      {teamCount > 0 && (
        <section style={{ background: "#0D1016", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <div className="max-w-content mx-auto flex items-center gap-[30px]" style={{ padding: "20px 32px" }}>
            <div className="shrink-0">
              <div className="text-[12px] font-extrabold tracking-[.16em] uppercase" style={{ color: "var(--accent)" }}>{isNpc ? "The provinces" : "The clubs"}</div>
              <div className="text-[13px] text-[#8C93A0] mt-[3px]">{compLabel} · {teamCount} {isNpc ? "unions" : "sides"}</div>
            </div>
            <ClubsMarquee>
              {dedupedTeams.map((t) => (
                <div key={t.id} className="flex flex-col items-center gap-[9px]" style={{ flexShrink: 0 }}>
                  <TeamBadge team={t} size="rail" />
                  <span className="text-[12px] text-[#9AA1AD] text-center whitespace-nowrap">
                    {t.name}
                  </span>
                </div>
              ))}
            </ClubsMarquee>
          </div>
        </section>
      )}

      {/* ── 3. Featured round card ───────────────────────────────────────────── */}
      <section style={{ background: "#F2F0EA" }}>
        <div className="max-w-content mx-auto" style={{ padding: "60px 32px 40px" }}>

          {/* Join banner */}
          {user && !isEnrolled && !seasonComplete && (
            <div className="card px-6 py-6 text-center space-y-3 mb-8">
              <h2 className="text-lg font-display uppercase text-md-text">Join This Competition</h2>
              <p className="text-sm text-md-text-secondary max-w-sm mx-auto">
                You haven&apos;t joined this competition yet. Join now to start tipping and appear on the leaderboard!
              </p>
              <JoinCompetitionButton />
            </div>
          )}

          {/* Season complete */}
          {activeMode === "season-complete" && (
            <div className="relative overflow-hidden rounded-[22px] text-white text-center" style={{ background: "#0D1016", padding: "48px 40px" }}>
              <div className="text-7xl mb-6 select-none">🏆</div>
              <p className="text-xs font-extrabold uppercase tracking-[.3em] mb-3" style={{ color: "var(--accent)" }}>Season Complete</p>
              <h2 className="font-display text-[28px] uppercase mb-4">{seasonName}</h2>
              {winner ? (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full ring-4 ring-accent">
                      <Avatar url={winnerAvatarUrl} name={winner} size={100} goldFallback />
                    </div>
                  </div>
                  <p className="font-display text-[36px] uppercase mb-3" style={{ color: "var(--accent)" }}>{winner}</p>
                  <p className="text-[#AEB4BE] text-[15px] mb-6">Congratulations! Thanks to everyone who played this season.</p>
                </>
              ) : (
                <p className="text-[#AEB4BE] text-[15px] mb-6">The tipping competition has finished. Thanks to everyone who played!</p>
              )}
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-[12px] font-extrabold text-[16px] uppercase tracking-[.02em] active:scale-[0.98] transition-transform"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                View Final Standings →
              </Link>
            </div>
          )}

          {/* Active featured card */}
          {activeRound && (activeMode === "open" || activeMode === "picks-closed" || activeMode === "coming-soon") && (
            <div
              className="relative overflow-hidden rounded-[22px] text-white flex items-center justify-between gap-[30px] flex-wrap"
              style={{ background: "#0D1016", padding: "36px 40px" }}
            >
              <div className="relative z-[2]">
                <div className="flex items-center gap-[9px] mb-[14px]">
                  {activeMode === "open" && (
                    <>
                      <span className="w-[9px] h-[9px] rounded-full" style={{ background: "#2CC36B", animation: "pulseDot 1.6s ease-in-out infinite" }} />
                      <span className="text-[12px] font-extrabold tracking-[.16em] uppercase text-[#2CC36B]">
                        Open now · {compLabel}
                      </span>
                    </>
                  )}
                  {activeMode === "picks-closed" && (
                    <span className="text-[12px] font-extrabold tracking-[.16em] uppercase text-[#8C93A0]">
                      Picks closed · {compLabel}
                    </span>
                  )}
                  {activeMode === "coming-soon" && (
                    <span className="text-[12px] font-extrabold tracking-[.16em] uppercase text-[#8C93A0]">
                      Coming soon · {compLabel}
                    </span>
                  )}
                </div>
                <div className="font-display text-[44px] leading-[.95] uppercase">
                  {activeRound.gameweek.label}
                </div>
                <div className="text-[15px] text-[#B6BCC6] mt-[10px]">
                  {activeMode === "open" && `Tips close ${fmtDeadline(activeRound.gameweek.deadline)}`}
                  {activeMode === "picks-closed" && "Picks are closed — results pending"}
                  {activeMode === "coming-soon" && `Opens before ${fmtDeadline(activeRound.gameweek.deadline)}`}
                </div>
                <div className="flex gap-[10px] mt-[18px]">
                  <span
                    className="px-[14px] py-[7px] rounded-full text-[13px] font-bold"
                    style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                  >
                    {activeRound.total} matches
                  </span>
                  {user && (
                    <span
                      className="px-[14px] py-[7px] rounded-full text-[13px] font-bold text-[#8C93A0]"
                      style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                    >
                      {userPickCount} / {activeRound.total} tipped
                    </span>
                  )}
                </div>
              </div>
              {activeMode === "open" && (
                <Link
                  href="/tips"
                  className="relative z-[2] inline-flex items-center gap-2.5 px-[32px] py-[18px] rounded-[13px] text-[16px] font-extrabold tracking-[.02em] uppercase no-underline whitespace-nowrap active:scale-[0.98] transition-transform"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  Submit tips →
                </Link>
              )}
              {activeMode !== "open" && (
                <Link
                  href="/leaderboard"
                  className="relative z-[2] inline-flex items-center gap-2.5 px-[28px] py-[15px] rounded-[11px] text-[15px] font-bold text-white no-underline whitespace-nowrap transition-colors hover:bg-white/[.08]"
                  style={{ border: "1.5px solid rgba(255,255,255,.3)" }}
                >
                  View leaderboard →
                </Link>
              )}
            </div>
          )}

          {/* ── 4. All rounds grid ──────────────────────────────────────────────── */}
          {rounds.length > 0 && (
            <>
              <div className="flex items-center gap-[13px] mt-[54px] mb-[22px]">
                <span className="block w-[26px] h-[3px] rounded-sm" style={{ background: "var(--accent)" }} />
                <h2 className="font-display text-[23px] uppercase tracking-[.02em]">All rounds</h2>
                <div className="flex-1 h-px" style={{ background: "#DCD9CF" }} />
                <span className="text-[13px] font-bold text-[#8B8676] tracking-[.04em]">
                  {rounds.length} rounds · {openCount} open
                </span>
              </div>

              <div className="grid gap-[14px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(126px, 1fr))" }}>
                {rounds.map(({ gameweek: gw, status, total, resultsIn }) => {
                  const isDone = status === "completed";
                  const isOpen = status === "open";
                  const metaText = isDone
                    ? `${resultsIn}/${total} ✓`
                    : isOpen
                      ? "Tip now"
                      : "Upcoming";

                  let bg: string, border: string, numColor: string, tagColor: string, metaColor: string;
                  if (isDone) {
                    bg = "#FFFFFF";
                    border = "#E4E1D8";
                    numColor = "#11151C";
                    tagColor = "#A9A593";
                    metaColor = "#1F9E5A";
                  } else if (isOpen) {
                    bg = "var(--accent)";
                    border = "var(--accent)";
                    numColor = "var(--accent-text)";
                    tagColor = "rgba(17,21,28,.55)";
                    metaColor = "var(--accent-text)";
                  } else {
                    bg = "#EAE8E0";
                    border = "#DEDBD1";
                    numColor = "#B4B0A2";
                    tagColor = "#BBB7A8";
                    metaColor = "#B4B0A2";
                  }

                  return (
                    <div
                      key={gw.id}
                      className="relative flex flex-col justify-between rounded-[15px]"
                      style={{
                        aspectRatio: "1.05",
                        padding: "15px 16px",
                        background: bg,
                        border: `1px solid ${border}`,
                      }}
                    >
                      <div className="text-[11px] font-bold tracking-[.12em] uppercase" style={{ color: tagColor }}>
                        Round
                      </div>
                      <div className="font-display text-[42px] leading-[.9]" style={{ color: numColor }}>
                        {gw.number}
                      </div>
                      <div className="text-[11.5px] font-extrabold tracking-[.04em] uppercase" style={{ color: metaColor }}>
                        {metaText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── 5. NPC banner ────────────────────────────────────────────────────── */}
      {compId !== NPC_COMPETITION_ID && (
        <section style={{ background: "#F2F0EA" }}>
          <div className="max-w-content mx-auto" style={{ padding: "10px 32px 40px" }}>
            <div
              className="relative overflow-hidden rounded-[20px] text-white flex items-center justify-between gap-[26px] flex-wrap"
              style={{ background: "#161B24", border: "1px solid rgba(255,255,255,.08)", padding: "32px 38px" }}
            >
              <div className="relative z-[2]">
                <div className="text-[12px] font-extrabold tracking-[.16em] uppercase mb-[10px]" style={{ color: "var(--accent)" }}>
                  Tip the Provincials
                </div>
                <div className="font-display text-[26px] uppercase leading-none mb-2">
                  Think you know provincial rugby?
                </div>
                <div className="text-[15px] text-[#AEB4BE] max-w-[520px]">
                  Join the tipping competition and go head-to-head with the country.
                </div>
              </div>
              <a
                href="https://clubrugbytipping.com"
                className="relative z-[2] inline-flex items-center gap-[9px] px-[26px] py-[15px] rounded-[11px] text-[15px] font-bold text-white no-underline whitespace-nowrap transition-colors hover:bg-white/[.08]"
                style={{ border: "1.5px solid rgba(255,255,255,.3)" }}
              >
                Join tipping →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. NPC SEO content ─────────────────────────────────────────────── */}
      {isNpc && (
        <section style={{ background: "#0D1016" }}>
          <div className="max-w-content mx-auto" style={{ padding: "56px 32px 60px" }}>
            <h2 className="font-display text-[23px] uppercase tracking-[.02em] text-white mb-[20px]">
              The rugby tipping competition<span style={{ color: "var(--accent)" }}>.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#C2C7D0", maxWidth: 640, marginBottom: 18 }}>
              Club Rugby Tipping runs a free tipping competition for New Zealand&apos;s premier provincial rugby competition. Pick the winning team and predict the margin for every match across all 14 unions — from Auckland to Southland.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#C2C7D0", maxWidth: 640 }}>
              Whether you&apos;re backing Canterbury to dominate or tipping Taranaki for an upset, compete against rugby fans across the country on a single national leaderboard. No sign-up fee, no app to download — just pick your winners each round before kickoff.
            </p>
          </div>
        </section>
      )}

      {/* ── 7. How Scoring Works ────────────────────────────────────────────── */}
      {scoringConfig && (
        <section style={{ background: "#F2F0EA" }}>
          <div className="max-w-content mx-auto" style={{ padding: "10px 32px 40px" }}>
            <div className="flex items-center gap-[13px] mb-[22px]">
              <span className="block w-[26px] h-[3px] rounded-sm" style={{ background: "var(--accent)" }} />
              <h2 className="font-display text-[23px] uppercase tracking-[.02em]">How Scoring Works</h2>
              <div className="flex-1 h-px" style={{ background: "#DCD9CF" }} />
            </div>

            <div className="rounded-[18px] overflow-hidden" style={{ background: "#fff", border: "1px solid #E4E1D8" }}>
              <div style={{ padding: "24px 28px" }} className="space-y-[16px]">
                {(scoringConfig.correct_winner ?? 0) > 0 && (
                  <div className="flex items-start gap-[14px]">
                    <span className="shrink-0 flex items-center justify-center rounded-full font-display text-[14px]" style={{ width: 36, height: 36, background: "var(--accent-wash)", color: "var(--accent)" }}>
                      {scoringConfig.correct_winner}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#11151C" }}>Pick the winning team</div>
                      <div style={{ fontSize: 13, color: "#5A6371", marginTop: 2 }}>
                        {scoringConfig.correct_winner === 1 ? "1 point" : `${scoringConfig.correct_winner} points`} for correctly picking the winner
                      </div>
                    </div>
                  </div>
                )}

                {(scoringConfig.correct_draw ?? 0) > 0 && (
                  <div className="flex items-start gap-[14px]" style={{ borderTop: "1px solid #EFEDE6", paddingTop: 16 }}>
                    <span className="shrink-0 flex items-center justify-center rounded-full font-display text-[14px]" style={{ width: 36, height: 36, background: "var(--accent-wash)", color: "var(--accent)" }}>
                      {scoringConfig.correct_draw}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#11151C" }}>Correctly pick a draw</div>
                      <div style={{ fontSize: 13, color: "#5A6371", marginTop: 2 }}>
                        {scoringConfig.correct_draw === 1 ? "1 point" : `${scoringConfig.correct_draw} points`} for predicting a drawn match
                      </div>
                    </div>
                  </div>
                )}

                {(scoringConfig.exact_margin ?? 0) > 0 && (
                  <div className="flex items-start gap-[14px]" style={{ borderTop: "1px solid #EFEDE6", paddingTop: 16 }}>
                    <span className="shrink-0 flex items-center justify-center rounded-full font-display text-[14px]" style={{ width: 36, height: 36, background: "var(--accent-wash)", color: "var(--accent)" }}>
                      +{scoringConfig.exact_margin}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#11151C" }}>Nail the exact margin</div>
                      <div style={{ fontSize: 13, color: "#5A6371", marginTop: 2 }}>
                        {scoringConfig.exact_margin === 1 ? "1 bonus point" : `${scoringConfig.exact_margin} bonus points`} for predicting the exact winning margin
                      </div>
                    </div>
                  </div>
                )}

                {(scoringConfig.within_margin ?? 0) > 0 && (
                  <div className="flex items-start gap-[14px]" style={{ borderTop: "1px solid #EFEDE6", paddingTop: 16 }}>
                    <span className="shrink-0 flex items-center justify-center rounded-full font-display text-[14px]" style={{ width: 36, height: 36, background: "var(--accent-wash)", color: "var(--accent)" }}>
                      +{scoringConfig.within_margin}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#11151C" }}>Get within {scoringConfig.within_margin_range ?? 5} of the margin</div>
                      <div style={{ fontSize: 13, color: "#5A6371", marginTop: 2 }}>
                        {scoringConfig.within_margin === 1 ? "1 bonus point" : `${scoringConfig.within_margin} bonus points`} if your margin prediction is within {scoringConfig.within_margin_range ?? 5} points
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 8. Ladder snapshots ───────────────────────────────────────────────── */}
      {(ladderRows.length > 0 || womenLadderRows.length > 0) && (
        <section style={{ background: "#F2F0EA" }}>
          <div className="max-w-content mx-auto" style={{ padding: "14px 32px 70px" }}>

            {/* Men's ladder */}
            {ladderRows.length > 0 && (
              <>
                <div className="flex items-center gap-[13px] mb-[22px]">
                  <span className="block w-[26px] h-[3px] rounded-sm" style={{ background: "var(--accent)" }} />
                  <h2 className="font-display text-[23px] uppercase tracking-[.02em]">{isNpc ? compLabel : `${compLabel} Men`}</h2>
                  <div className="flex-1 h-px" style={{ background: "#DCD9CF" }} />
                  <Link
                    href="/stats"
                    className="text-[14px] font-extrabold tracking-[.02em] no-underline hover:opacity-75 transition-opacity"
                    style={{ color: "var(--accent)" }}
                  >
                    Full standings →
                  </Link>
                </div>

                <div className="rounded-[18px] overflow-hidden" style={{ background: "#fff", border: "1px solid #E4E1D8", fontFeatureSettings: "'tnum'" }}>
                  <div className="overflow-x-auto">
                    {/* Desktop header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "46px 1fr 42px 42px 42px 58px 58px 58px 56px",
                        padding: "15px 20px",
                        background: "#0D1016",
                        color: "#9AA1AD",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        textTransform: "uppercase" as const,
                        minWidth: 540,
                      }}
                    >
                      <span>#</span>
                      <span>Club</span>
                      <span style={{ textAlign: "center" }}>P</span>
                      <span style={{ textAlign: "center" }}>W</span>
                      <span style={{ textAlign: "center" }}>L</span>
                      <span style={{ textAlign: "center" }}>PF</span>
                      <span style={{ textAlign: "center" }}>PA</span>
                      <span style={{ textAlign: "center" }}>PD</span>
                      <span style={{ textAlign: "right" }}>Pts</span>
                    </div>

                    {ladderRows.map((row, i) => {
                      const pd = row.points_diff;
                      const pdColor = pd != null && pd > 0 ? "#1F9E5A" : pd != null && pd < 0 ? "#B23A48" : "#5A6371";
                      const barColor = i === 0 ? "var(--accent)" : "transparent";
                      const teamInfo = teamColorMap.get(row.team_name);
                      const teamColour = teamInfo?.colour ?? "#2B3A52";

                      return (
                        <div
                          key={row.team_id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "46px 1fr 42px 42px 42px 58px 58px 58px 56px",
                            alignItems: "center",
                            padding: "15px 20px",
                            borderTop: "1px solid #EFEDE6",
                            borderLeft: `3px solid ${barColor}`,
                            minWidth: 540,
                          }}
                        >
                          <span className="font-display" style={{ fontSize: 16, color: "#11151C" }}>{row.position ?? i + 1}</span>
                          <span className="flex items-center" style={{ gap: 12, minWidth: 0 }}>
                            {row.crest ? (
                              <Image src={row.crest} alt={row.team_name} width={32} height={32} className="rounded-full object-contain shrink-0" style={{ width: 32, height: 32 }} unoptimized />
                            ) : (
                              <span className="flex items-center justify-center rounded-full shrink-0 font-display text-[11px] text-white" style={{ width: 32, height: 32, background: teamColour }}>
                                {row.team_name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).length >= 2
                                  ? (row.team_name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/)[0][0] + row.team_name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/)[1][0]).toUpperCase()
                                  : row.team_name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#11151C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {row.team_name}
                            </span>
                          </span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.matches_played)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#169B63" }}>{val(row.matches_won)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#B23A48" }}>{val(row.matches_lost)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.points_for)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.points_against)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: pdColor }}>{signed(row.points_diff)}</span>
                          <span className="font-display" style={{ textAlign: "right", fontSize: 18, color: "#11151C" }}>{val(row.match_points)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Women's ladder (CMK only — NPC has no women's comp) */}
            {!isNpc && womenLadderRows.length > 0 && (
              <>
                <div className="flex items-center gap-[13px] mb-[22px]" style={{ marginTop: ladderRows.length > 0 ? 44 : 0 }}>
                  <span className="block w-[26px] h-[3px] rounded-sm" style={{ background: "var(--accent)" }} />
                  <h2 className="font-display text-[23px] uppercase tracking-[.02em]">{compLabel} Women</h2>
                  <div className="flex-1 h-px" style={{ background: "#DCD9CF" }} />
                  <Link
                    href="/stats"
                    className="text-[14px] font-extrabold tracking-[.02em] no-underline hover:opacity-75 transition-opacity"
                    style={{ color: "var(--accent)" }}
                  >
                    Full standings →
                  </Link>
                </div>

                <div className="rounded-[18px] overflow-hidden" style={{ background: "#fff", border: "1px solid #E4E1D8", fontFeatureSettings: "'tnum'" }}>
                  <div className="overflow-x-auto">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "46px 1fr 42px 42px 42px 58px 58px 58px 56px",
                        padding: "15px 20px",
                        background: "#0D1016",
                        color: "#9AA1AD",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        textTransform: "uppercase" as const,
                        minWidth: 540,
                      }}
                    >
                      <span>#</span>
                      <span>Club</span>
                      <span style={{ textAlign: "center" }}>P</span>
                      <span style={{ textAlign: "center" }}>W</span>
                      <span style={{ textAlign: "center" }}>L</span>
                      <span style={{ textAlign: "center" }}>PF</span>
                      <span style={{ textAlign: "center" }}>PA</span>
                      <span style={{ textAlign: "center" }}>PD</span>
                      <span style={{ textAlign: "right" }}>Pts</span>
                    </div>

                    {womenLadderRows.map((row, i) => {
                      const pd = row.points_diff;
                      const pdColor = pd != null && pd > 0 ? "#1F9E5A" : pd != null && pd < 0 ? "#B23A48" : "#5A6371";
                      const barColor = i === 0 ? "var(--accent)" : "transparent";
                      const teamInfo = teamColorMap.get(row.team_name);
                      const teamColour = teamInfo?.colour ?? "#2B3A52";

                      return (
                        <div
                          key={row.team_id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "46px 1fr 42px 42px 42px 58px 58px 58px 56px",
                            alignItems: "center",
                            padding: "15px 20px",
                            borderTop: "1px solid #EFEDE6",
                            borderLeft: `3px solid ${barColor}`,
                            minWidth: 540,
                          }}
                        >
                          <span className="font-display" style={{ fontSize: 16, color: "#11151C" }}>{row.position ?? i + 1}</span>
                          <span className="flex items-center" style={{ gap: 12, minWidth: 0 }}>
                            {row.crest ? (
                              <Image src={row.crest} alt={row.team_name} width={32} height={32} className="rounded-full object-contain shrink-0" style={{ width: 32, height: 32 }} unoptimized />
                            ) : (
                              <span className="flex items-center justify-center rounded-full shrink-0 font-display text-[11px] text-white" style={{ width: 32, height: 32, background: teamColour }}>
                                {row.team_name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).length >= 2
                                  ? (row.team_name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/)[0][0] + row.team_name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/)[1][0]).toUpperCase()
                                  : row.team_name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#11151C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {row.team_name}
                            </span>
                          </span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.matches_played)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#169B63" }}>{val(row.matches_won)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#B23A48" }}>{val(row.matches_lost)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.points_for)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.points_against)}</span>
                          <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: pdColor }}>{signed(row.points_diff)}</span>
                          <span className="font-display" style={{ textAlign: "right", fontSize: 18, color: "#11151C" }}>{val(row.match_points)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

          </div>
        </section>
      )}
    </div>
  );
}
