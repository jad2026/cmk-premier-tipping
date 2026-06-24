export type VideoInfo = {
  type: "youtube" | "facebook" | "instagram" | "other";
  embedUrl: string;
  videoId?: string;
};

export function parseVideoUrl(url: string): VideoInfo {
  try {
    const u = new URL(url);

    // YouTube: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
    if (
      u.hostname.includes("youtube.com") ||
      u.hostname.includes("youtu.be")
    ) {
      let videoId: string | null = null;

      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1).split("/")[0];
      } else if (u.pathname.startsWith("/shorts/")) {
        videoId = u.pathname.split("/shorts/")[1]?.split("/")[0] ?? null;
      } else {
        videoId = u.searchParams.get("v");
      }

      if (videoId) {
        return {
          type: "youtube",
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          videoId,
        };
      }
    }

    // Facebook
    if (
      u.hostname.includes("facebook.com") ||
      u.hostname.includes("fb.watch")
    ) {
      return { type: "facebook", embedUrl: url };
    }

    // Instagram
    if (u.hostname.includes("instagram.com")) {
      return { type: "instagram", embedUrl: url };
    }
  } catch {
    // invalid URL — fall through
  }

  return { type: "other", embedUrl: url };
}
