"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinSpecificCompetition } from "./actions";

export default function JoinButton({ competitionId, accent }: { competitionId: string; accent: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleJoin() {
    startTransition(async () => {
      const result = await joinSpecificCompetition(competitionId);
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleJoin}
      disabled={isPending}
      className="w-full rounded-lg px-3 py-2 text-center text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{
        background: "transparent",
        color: accent,
        border: `1.5px solid ${accent}`,
      }}
    >
      {isPending ? "Joining..." : "Join competition"}
    </button>
  );
}
