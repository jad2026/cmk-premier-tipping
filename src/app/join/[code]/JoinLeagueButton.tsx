"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinLeagueById } from "./actions";

export default function JoinLeagueButton({ leagueId }: { leagueId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const res = await joinLeagueById(leagueId);
      if (res.error) {
        setError(res.error);
      } else {
        router.push("/leaderboard");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleJoin}
        disabled={isPending}
        style={{
          width: "100%",
          background: "#2C9FD4",
          color: "#FFFFFF",
          padding: "14px 28px",
          borderRadius: 12,
          fontWeight: 800,
          fontSize: 16,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          border: "none",
          cursor: isPending ? "wait" : "pointer",
          opacity: isPending ? 0.7 : 1,
          transition: "opacity .15s",
          fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
        }}
      >
        {isPending ? "Joining…" : "Join League"}
      </button>
      {error && (
        <p style={{ fontSize: 13, color: "#B23A48", marginTop: 8, textAlign: "center" }}>{error}</p>
      )}
    </>
  );
}
