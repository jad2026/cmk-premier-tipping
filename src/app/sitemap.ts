import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "clubrugbytipping.com";
  const baseUrl = `https://${host}`;

  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/tips`, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/leaderboard`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/stats`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/squads`, changeFrequency: "weekly", priority: 0.6 },
  ];
}
