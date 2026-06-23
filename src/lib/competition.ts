import { headers } from "next/headers";

export const CMK_COMPETITION_ID = "b3dbe30d-91ef-40c3-9680-3586c6d17ef8";
export const NPC_COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

// Reads the competition ID injected by src/middleware.ts via the
// "x-competition-id" request header. Falls back to CMK if the header is
// absent (e.g. direct server action calls without a middleware hop).
export async function getCurrentCompetitionId(): Promise<string> {
  const headersList = await headers();
  return headersList.get("x-competition-id") ?? CMK_COMPETITION_ID;
}
