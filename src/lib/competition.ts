import { headers } from "next/headers";

export const CMK_COMPETITION_ID = "b3dbe30d-91ef-40c3-9680-3586c6d17ef8";

// Map of hostname → competition UUID.
// Add new subdomains here when additional competitions are onboarded.
const HOST_TO_COMPETITION_ID: Record<string, string> = {
  // "newclub.clubrugbytipping.com": "another-uuid-here",
};

export async function getCurrentCompetitionId(): Promise<string> {
  const headersList = await headers();
  const host = (headersList.get("host") ?? "").replace(/:\d+$/, ""); // strip port
  return HOST_TO_COMPETITION_ID[host] ?? CMK_COMPETITION_ID;
}
