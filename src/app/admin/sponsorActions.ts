"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Sponsor, SponsorLocation } from "@/lib/supabase/types";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

export async function fetchSponsors(): Promise<Sponsor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sponsors")
    .select("*")
    .order("order_position")
    .order("created_at");
  return (data ?? []) as Sponsor[];
}

export async function fetchActiveSponsors(location: SponsorLocation): Promise<Sponsor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sponsors")
    .select("*")
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
  const admin = serviceClient();
  const { error } = await admin.from("sponsors").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function reorderSponsors(ids: string[]): Promise<{ error?: string }> {
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
