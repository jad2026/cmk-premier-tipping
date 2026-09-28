"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompetitionId } from "@/lib/competition";
import { manualLadderKey, manualTeamId, parseLeagueResults, parseLeagueTable } from "@/lib/manualLadder";

// Untyped service client: ladder_standings and league_results aren't in the
// generated Database types. Only used after requireManualLadderAdmin passes.
function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Server actions are callable directly, so check admin + manual ladder here
// rather than relying on the admin page having been rendered.
async function requireManualLadderAdmin(): Promise<{ compId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { error: "Admins only." };

  const compId = await getCurrentCompetitionId();
  const { data: comp } = await supabase
    .from("competitions")
    .select("ladder_source")
    .eq("id", compId)
    .maybeSingle() as { data: { ladder_source: string | null } | null };
  if (comp?.ladder_source !== "manual") return { error: "This competition doesn't use a manual league table." };

  return { compId };
}

export async function saveManualLadder(text: string): Promise<{ error?: string; saved?: number }> {
  const auth = await requireManualLadderAdmin();
  if ("error" in auth) return { error: auth.error };

  const { rows, errors } = parseLeagueTable(text);
  if (errors.length > 0) return { error: `Fix ${errors.length} problem line(s) before saving.` };
  if (rows.length === 0) return { error: "Nothing to save — paste the league table first." };

  // ladder_standings is written by the feed ingesters with the service role.
  const admin = serviceClient();
  const key = manualLadderKey(auth.compId);
  const updatedAt = new Date().toISOString();

  // team_id is TEXT NOT NULL and updated_at is timestamptz NOT NULL: set both on every row.
  const payload = rows.map((r) => ({
    ...r,
    comp_id: key,
    team_id: manualTeamId(r.team_name),
    updated_at: updatedAt,
  }));
  const { error } = await admin.from("ladder_standings").upsert(payload, { onConflict: "comp_id,team_name" });
  if (error) return { error: error.message };

  // Remove teams that are no longer in the pasted table.
  const { data: existing } = await admin.from("ladder_standings").select("team_name").eq("comp_id", key);
  const keep = new Set(rows.map((r) => r.team_name));
  const stale = (existing ?? []).map((r: { team_name: string }) => r.team_name).filter((n) => !keep.has(n));
  if (stale.length > 0) {
    const { error: pruneError } = await admin.from("ladder_standings").delete().eq("comp_id", key).in("team_name", stale);
    if (pruneError) return { error: pruneError.message };
  }

  revalidatePath("/");
  return { saved: rows.length };
}

export async function saveLeagueResults(gameweekId: string, text: string): Promise<{ error?: string; saved?: number }> {
  const auth = await requireManualLadderAdmin();
  if ("error" in auth) return { error: auth.error };

  const { results, errors } = parseLeagueResults(text);
  if (errors.length > 0) return { error: `Fix ${errors.length} problem line(s) before saving.` };
  if (results.length === 0) return { error: "Nothing to save — paste the round's results first." };

  const admin = serviceClient();
  const { data: gw } = await admin
    .from("gameweeks")
    .select("id")
    .eq("id", gameweekId)
    .eq("competition_id", auth.compId)
    .maybeSingle();
  if (!gw) return { error: "That round doesn't belong to this competition." };

  // Insert the new set first, then remove the old rows, so a failed insert
  // never leaves the round empty.
  const { data: old } = await admin
    .from("league_results")
    .select("id")
    .eq("competition_id", auth.compId)
    .eq("gameweek_id", gameweekId);

  const { error } = await admin
    .from("league_results")
    .insert(results.map((r) => ({ ...r, competition_id: auth.compId, gameweek_id: gameweekId })));
  if (error) return { error: error.message };

  const oldIds = (old ?? []).map((r: { id: string }) => r.id);
  if (oldIds.length > 0) {
    const { error: deleteError } = await admin.from("league_results").delete().in("id", oldIds);
    if (deleteError) return { error: deleteError.message };
  }

  revalidatePath("/results");
  return { saved: results.length };
}
