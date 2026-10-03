import type { SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://clubrugbytipping.com";

export async function getCompetitionSiteUrls(
  supabase: SupabaseClient,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("competitions")
    .select("id, site_url");
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.site_url || FALLBACK_URL;
  }
  return map;
}

export function getSiteUrl(
  urls: Record<string, string>,
  competitionId: string,
): string {
  return urls[competitionId] ?? FALLBACK_URL;
}
