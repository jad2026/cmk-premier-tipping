"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentCompetitionId } from "@/lib/competition";
import type { Player, CoachingStaff } from "@/lib/supabase/types";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

export async function fetchPlayers(teamId: string): Promise<Player[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", teamId)
    .order("jersey_number");
  return (data ?? []) as Player[];
}

export async function upsertPlayer(
  player: {
    id?: string;
    team_id: string;
    first_name: string;
    last_name: string;
    position: string;
    jersey_number: number;
    is_active: boolean;
    is_captain: boolean;
    apps: number;
    pts: number;
  },
): Promise<{ error?: string; playerId?: string }> {
  const supabase = await createClient();
  const compId = await getCurrentCompetitionId();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", player.team_id)
    .eq("competition_id", compId)
    .single();

  if (!team) return { error: "Team not found in this competition" };

  const fields = {
    first_name: player.first_name,
    last_name: player.last_name,
    position: player.position,
    jersey_number: player.jersey_number,
    is_active: player.is_active,
    is_captain: player.is_captain,
    apps: player.apps,
    pts: player.pts,
  };

  if (player.id) {
    const { error } = await supabase
      .from("players")
      .update(fields)
      .eq("id", player.id);
    if (error) return { error: error.message };
    return { playerId: player.id };
  } else {
    const { data: inserted, error } = await supabase
      .from("players")
      .insert({ team_id: player.team_id, ...fields })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { playerId: (inserted as { id: string })?.id };
  }
}

export async function deletePlayer(playerId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { error: error.message };
  return {};
}

export async function uploadPlayerPhoto(
  playerId: string,
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };
  if (file.size > 2 * 1024 * 1024) return { error: "File must be under 2 MB" };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `players/${playerId}/photo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = serviceClient();
  const { error } = await admin.storage
    .from("avatars")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) return { error: error.message };

  const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  await admin.from("players").update({ photo_url: url }).eq("id", playerId);

  return { url };
}

export async function removePlayerPhoto(playerId: string): Promise<{ error?: string }> {
  const admin = serviceClient();

  const { data: player } = await admin
    .from("players")
    .select("photo_url")
    .eq("id", playerId)
    .single();

  if (player?.photo_url) {
    const urlPath = player.photo_url.split("/avatars/")[1]?.split("?")[0];
    if (urlPath) {
      await admin.storage.from("avatars").remove([urlPath]);
    }
  }

  await admin.from("players").update({ photo_url: null }).eq("id", playerId);
  return {};
}

export async function fetchCoachingStaff(teamId: string): Promise<CoachingStaff[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coaching_staff")
    .select("*")
    .eq("team_id", teamId)
    .order("display_order");
  return (data ?? []) as CoachingStaff[];
}

export async function upsertCoach(
  coach: {
    id?: string;
    team_id: string;
    name: string;
    role: string;
    display_order: number;
  },
): Promise<{ error?: string; coachId?: string }> {
  const supabase = await createClient();

  if (coach.id) {
    const { error } = await supabase
      .from("coaching_staff")
      .update({ name: coach.name, role: coach.role, display_order: coach.display_order })
      .eq("id", coach.id);
    if (error) return { error: error.message };
    return { coachId: coach.id };
  } else {
    const { data: inserted, error } = await supabase
      .from("coaching_staff")
      .insert({ team_id: coach.team_id, name: coach.name, role: coach.role, display_order: coach.display_order })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { coachId: (inserted as { id: string })?.id };
  }
}

export async function deleteCoach(coachId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("coaching_staff").delete().eq("id", coachId);
  if (error) return { error: error.message };
  return {};
}

export async function uploadCoachPhoto(
  coachId: string,
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };
  if (file.size > 2 * 1024 * 1024) return { error: "File must be under 2 MB" };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `coaching/${coachId}/photo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = serviceClient();
  const { error } = await admin.storage
    .from("avatars")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) return { error: error.message };

  const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  await admin.from("coaching_staff").update({ photo_url: url }).eq("id", coachId);

  return { url };
}
