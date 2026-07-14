import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { type TzLocale, DEFAULT_TZ_LOCALE } from "@/lib/datetime";

export const CMK_COMPETITION_ID = "b3dbe30d-91ef-40c3-9680-3586c6d17ef8";
export const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

// Reads the competition ID injected by src/middleware.ts via the
// "x-competition-id" request header. Falls back to CMK if the header is
// absent (e.g. direct server action calls without a middleware hop).
export async function getCurrentCompetitionId(): Promise<string> {
  const headersList = await headers();
  return headersList.get("x-competition-id") ?? NPC_COMPETITION_ID;
}

export async function getCompetitionTimezone(competitionId: string): Promise<TzLocale> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("competitions")
    .select("timezone, locale")
    .eq("id", competitionId)
    .maybeSingle() as { data: { timezone?: string; locale?: string } | null };
  return {
    timezone: data?.timezone ?? DEFAULT_TZ_LOCALE.timezone,
    locale: data?.locale ?? DEFAULT_TZ_LOCALE.locale,
  };
}
