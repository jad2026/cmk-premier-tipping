import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buildSponsoredLeagueEmail } from "@/lib/email/sponsoredLeagueEmail";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: league } = await admin
    .from("leagues")
    .select("id, name")
    .eq("id", "985e1a00-87ad-41f7-a1ae-d73fb3d84813")
    .single();

  if (!league) {
    return NextResponse.json({ error: "No sponsored league found" }, { status: 404 });
  }

  const [{ data: logos }, { data: prizes }] = await Promise.all([
    admin
      .from("league_sponsor_logos")
      .select("name, logo_url")
      .eq("league_id", league.id)
      .order("display_order"),
    admin
      .from("league_prizes")
      .select("prize_description, gameweek_id, gameweeks(label)")
      .eq("league_id", league.id)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const { html } = buildSponsoredLeagueEmail({
    recipientName: "John D",
    leagueName: league.name,
    roundLabel: "Round 3",
    sponsorLogos: (logos ?? []) as { name: string; logo_url: string }[],
    prize: prizes?.[0] ? { description: prizes[0].prize_description as string } : null,
    lastWinner: { name: "Sarah M", score: "6/7 correct", prize: "$50 cafe voucher" },
    standings: [
      { rank: 1, name: "Sarah M", total: 18, isRecipient: false },
      { rank: 2, name: "John D", total: 16, isRecipient: true },
      { rank: 3, name: "Mike T", total: 15, isRecipient: false },
      { rank: 4, name: "Dave R", total: 14, isRecipient: false },
      { rank: 5, name: "Lisa K", total: 12, isRecipient: false },
    ],
    siteUrl: "https://clubrugbytipping.com",
  });

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
