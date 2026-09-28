"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentCompetitionId } from "@/lib/competition";
import type { Sponsor, SponsorLocation } from "@/lib/supabase/types";

// Server actions are publicly callable, so every admin action checks the
// caller is signed in and profiles.is_admin before touching data.
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin === true;
}

const NOT_AUTHORIZED = { error: "Not authorized" };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

// Admin panel only (includes inactive sponsors). Returns [] for non-admins
// because callers expect a list.
export async function fetchSponsors(): Promise<Sponsor[]> {
  if (!(await isAdmin())) return [];
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const { data } = await supabase
    .from("sponsors")
    .select("*")
    .eq("competition_id", compId)
    .order("order_position")
    .order("created_at");
  return (data ?? []) as Sponsor[];
}

// Public: used by the sponsor banner/strip and welcome emails for any visitor.
export async function fetchActiveSponsors(location: SponsorLocation): Promise<Sponsor[]> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();
  const { data } = await supabase
    .from("sponsors")
    .select("*")
    .eq("competition_id", compId)
    .eq("is_active", true)
    .or(`display_location.eq.${location},display_location.eq.all`)
    .order("order_position")
    .order("created_at")
    .limit(5);
  return (data ?? []) as Sponsor[];
}

export async function upsertSponsor(
  sponsor: Partial<Sponsor> & { name: string }
): Promise<{ error?: string; sponsor?: Sponsor }> {
  if (!(await isAdmin())) return NOT_AUTHORIZED;
  const admin = serviceClient();
  const { data, error } = await admin
    .from("sponsors")
    .upsert(sponsor, { onConflict: "id" })
    .select()
    .single();
  if (error) return { error: error.message };
  return { sponsor: data as Sponsor };
}

export async function deleteSponsor(id: string): Promise<{ error?: string }> {
  if (!(await isAdmin())) return NOT_AUTHORIZED;
  const admin = serviceClient();
  const { error } = await admin.from("sponsors").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function reorderSponsors(ids: string[]): Promise<{ error?: string }> {
  if (!(await isAdmin())) return NOT_AUTHORIZED;
  const admin = serviceClient();
  const updates = ids.map((id, i) =>
    admin.from("sponsors").update({ order_position: i }).eq("id", id)
  );
  await Promise.all(updates);
  return {};
}

export async function uploadSponsorLogo(
  sponsorId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  if (!(await isAdmin())) return NOT_AUTHORIZED;
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${sponsorId}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = serviceClient();
  const { error } = await admin.storage
    .from("sponsors")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) return { error: error.message };

  const { data: { publicUrl } } = admin.storage.from("sponsors").getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  await admin.from("sponsors").update({ logo_url: url }).eq("id", sponsorId);

  return { url };
}
