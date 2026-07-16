"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  let code = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) {
    code += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return code;
}

export async function getSponsoredLeagueData(compId: string) {
  const admin = serviceClient();

  const [{ data: leagues }, { data: gameweeks }] = await Promise.all([
    admin
      .from("leagues")
      .select("*, league_members(count)")
      .eq("competition_id", compId)
      .order("name"),
    admin
      .from("gameweeks")
      .select("id, number, label, deadline")
      .eq("competition_id", compId)
      .order("deadline"),
  ]);

  const mapped = (leagues ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    member_count:
      Array.isArray(l.league_members) && l.league_members.length > 0
        ? (l.league_members[0] as { count: number }).count
        : 0,
    league_members: undefined,
  }));

  return { leagues: mapped, gameweeks: gameweeks ?? [] };
}

export async function createSponsoredLeague(data: {
  name: string;
  competition_id: string;
  sponsor_name: string;
  sponsor_accent_color: string | null;
}): Promise<{ error?: string; league?: Record<string, unknown> }> {
  const admin = serviceClient();

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1 });
  const adminUserId = users?.[0]?.id;
  if (!adminUserId) return { error: "No admin user found" };

  const invite_code = generateInviteCode();

  const { data: league, error } = await admin
    .from("leagues")
    .insert({
      name: data.name,
      competition_id: data.competition_id,
      invite_code,
      is_sponsored: true,
      sponsor_name: data.sponsor_name,
      sponsor_accent_color: data.sponsor_accent_color,
      created_by: adminUserId,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { league: league as Record<string, unknown> };
}

export async function updateLeagueSponsor(
  leagueId: string,
  data: {
    is_sponsored: boolean;
    sponsor_name: string | null;
    sponsor_accent_color: string | null;
  }
): Promise<{ error?: string }> {
  const admin = serviceClient();
  const { error } = await admin.from("leagues").update(data).eq("id", leagueId);
  if (error) return { error: error.message };
  return {};
}

export async function getSponsorLogos(leagueId: string) {
  const admin = serviceClient();
  const { data, error } = await admin
    .from("league_sponsor_logos")
    .select("id, name, logo_url, display_order")
    .eq("league_id", leagueId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; logo_url: string; display_order: number }[];
}

export async function addSponsorLogo(
  leagueId: string,
  name: string,
  formData: FormData
): Promise<{ error?: string; logo?: { id: string; name: string; logo_url: string; display_order: number } }> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${leagueId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = serviceClient();
  const { error: uploadError } = await admin.storage
    .from("sponsor-logos")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = admin.storage.from("sponsor-logos").getPublicUrl(path);
  const logoUrl = `${publicUrl}?t=${Date.now()}`;

  // Get next display_order
  const { data: maxRow } = await admin
    .from("league_sponsor_logos")
    .select("display_order")
    .eq("league_id", leagueId)
    .order("display_order", { ascending: false })
    .limit(1)
    .single();
  const nextOrder = (maxRow?.display_order ?? -1) + 1;

  const { data: row, error: insertError } = await admin
    .from("league_sponsor_logos")
    .insert({ league_id: leagueId, name, logo_url: logoUrl, display_order: nextOrder })
    .select("id, name, logo_url, display_order")
    .single();

  if (insertError) return { error: insertError.message };
  return { logo: row as { id: string; name: string; logo_url: string; display_order: number } };
}

export async function removeSponsorLogo(logoId: string): Promise<{ error?: string }> {
  const admin = serviceClient();

  const { data: row } = await admin
    .from("league_sponsor_logos")
    .select("logo_url")
    .eq("id", logoId)
    .single();

  const { error } = await admin.from("league_sponsor_logos").delete().eq("id", logoId);
  if (error) return { error: error.message };

  // Best-effort storage cleanup
  if (row?.logo_url) {
    try {
      const url = new URL(row.logo_url);
      const match = url.pathname.match(/\/sponsor-logos\/(.+)$/);
      if (match) {
        await admin.storage.from("sponsor-logos").remove([decodeURIComponent(match[1])]);
      }
    } catch { /* ignore cleanup errors */ }
  }

  return {};
}

export async function reorderSponsorLogos(
  logos: { id: string; display_order: number }[]
): Promise<{ error?: string }> {
  const admin = serviceClient();
  await Promise.all(
    logos.map((l) =>
      admin.from("league_sponsor_logos").update({ display_order: l.display_order }).eq("id", l.id)
    )
  );
  return {};
}

export async function upsertPrizes(
  prizes: { league_id: string; gameweek_id: string; prize_description: string }[]
): Promise<{ error?: string }> {
  if (prizes.length === 0) return {};
  const admin = serviceClient();
  const { error } = await admin
    .from("league_prizes")
    .upsert(prizes, { onConflict: "league_id,gameweek_id" });
  if (error) return { error: error.message };
  return {};
}

export async function awardPrize(
  prizeId: string,
  winnerUserId: string
): Promise<{ error?: string }> {
  const admin = serviceClient();
  const { error } = await admin
    .from("league_prizes")
    .update({ winner_user_id: winnerUserId, awarded_at: new Date().toISOString() })
    .eq("id", prizeId);
  if (error) return { error: error.message };
  return {};
}
