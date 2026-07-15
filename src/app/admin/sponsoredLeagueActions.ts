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
    sponsor_logo_url: string | null;
    sponsor_accent_color: string | null;
  }
): Promise<{ error?: string }> {
  const admin = serviceClient();
  const { error } = await admin.from("leagues").update(data).eq("id", leagueId);
  if (error) return { error: error.message };
  return {};
}

export async function uploadSponsorLogo(
  leagueId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${leagueId}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = serviceClient();
  const { error } = await admin.storage
    .from("sponsor-logos")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) return { error: error.message };

  const { data: { publicUrl } } = admin.storage.from("sponsor-logos").getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  await admin.from("leagues").update({ sponsor_logo_url: url }).eq("id", leagueId);

  return { url };
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
