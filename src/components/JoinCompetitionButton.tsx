"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinCompetition } from "@/app/competition-actions";

export default function JoinCompetitionButton({ label }: { label?: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleJoin() {
    startTransition(async () => {
      const result = await joinCompetition();
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <button onClick={handleJoin} disabled={isPending} className="btn-gold shadow-lg">
      {isPending ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Joining…
        </>
      ) : (
        label ?? "Join Competition"
      )}
    </button>
  );
}
