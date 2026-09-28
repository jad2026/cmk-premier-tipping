import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { joinLeague } from "@/app/leagues/actions";
import { joinCompetition } from "@/app/competition-actions";

export const dynamic = "force-dynamic";

// Link-preview crawlers (WhatsApp, iMessage, Slack…) are never logged in; they get
// a plain page carrying the invite metadata instead of the redirect to /signup.
const PREVIEW_BOT = /bot|facebookexternalhit|whatsapp|slack|telegram|discord|linkedin|embedly|skype|preview/i;

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const [{ data: league }, { data: comp }] = await Promise.all([
    supabase
      .from("leagues")
      .select("name")
      .eq("invite_code", code.trim().toUpperCase())
      .eq("competition_id", compId)
      .maybeSingle(),
    supabase
      .from("competitions")
      .select("name, short_label, hero_image")
      .eq("id", compId)
      .maybeSingle() as unknown as Promise<{ data: { name: string | null; short_label: string | null; hero_image: string | null } | null }>,
  ]);
  // Invalid code: fall back to the site's default metadata from the layout.
  if (!league) return {};

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const heroPath = comp?.hero_image || "/hero.jpg";
  const image = /^https?:\/\//.test(heroPath) || !host ? heroPath : `${proto}://${host}${heroPath}`;

  const title = `You're invited to ${league.name} – ${comp?.short_label ?? comp?.name ?? "Club Rugby"} Tipping`;
  const description = "Pick the winners, beat your mates. Free to play.";
  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const signupHref = `/signup?code=${encodeURIComponent(code)}`;
    const userAgent = (await headers()).get("user-agent") ?? "";
    if (!PREVIEW_BOT.test(userAgent)) redirect(signupHref);
    return (
      <div className="text-center" style={{ padding: "64px 16px" }}>
        <h1 className="font-display uppercase" style={{ fontSize: 32, margin: 0 }}>You&apos;re invited</h1>
        <p style={{ marginTop: 16 }}>
          <Link href={signupHref} style={{ color: "var(--accent)", fontWeight: 700 }}>Join the league →</Link>
        </p>
      </div>
    );
  }

  // Only accept leagues belonging to the competition whose site we're on.
  const inviteCode = code.trim().toUpperCase();
  const compId = await getCurrentCompetitionId();
  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("invite_code", inviteCode)
    .eq("competition_id", compId)
    .maybeSingle();
  if (!league) redirect("/leagues?error=invalid-code");

  // Make sure they're in the competition itself, then the league.
  await joinCompetition();

  const { data: membership } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    const res = await joinLeague(inviteCode);
    if (res.error) redirect("/leagues?error=invalid-code");
  }

  redirect(`/leagues/${league.id}`);
}
