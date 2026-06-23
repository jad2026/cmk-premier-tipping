import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Club Rugby Tipping",
    short_name: "CRT Tipping",
    description: "Pick winners and climb the leaderboard",
    start_url: "/",
    display: "standalone",
    background_color: "#FFB000",
    theme_color: "#FFB000",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
