"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createLeague, joinLeague } from "./actions";
import type { League } from "@/lib/supabase/types";

type LeagueWithCount = League & { member_count: number };

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E4E1D8",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 15,
  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
  background: "#fff",
  color: "#11151C",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

const btnAccent: React.CSSProperties = {
  width: "100%",
  background: "var(--accent)",
  color: "var(--accent-text, #11151C)",
  padding: "12px 20px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  border: "none",
  cursor: "pointer",
  transition: "opacity .15s",
};

export default function LeaguesClient({ initialLeagues }: { initialLeagues: LeagueWithCount[] }) {
  const [leagues, setLeagues] = useState(initialLeagues);
  const [isPending, startTransition] = useTransition();

  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [createFeedback, setCreateFeedback] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinFeedback, setJoinFeedback] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreateError("");
    setCreateFeedback("");
    startTransition(async () => {
      const res = await createLeague(createName);
      if (res.error) {
        setCreateError(res.error);
      } else if (res.league) {
        setCreateFeedback(`League "${res.league.name}" created! Invite code: ${res.league.invite_code}`);
        setCreateName("");
        setLeagues((prev) => [...prev, { ...res.league!, member_count: 1 }]);
      }
    });
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinError("");
    setJoinFeedback("");
    startTransition(async () => {
      const res = await joinLeague(joinCode);
      if (res.error) {
        setJoinError(res.error);
      } else if (res.league) {
        setJoinFeedback(`Joined "${res.league.name}"!`);
        setJoinCode("");
        if (!leagues.find((l) => l.id === res.league!.id)) {
          setLeagues((prev) => [...prev, { ...res.league!, member_count: 1 }]);
        }
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* My Leagues */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "24px 28px" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <span className="shrink-0" style={{ width: 4, height: 20, borderRadius: 2, background: "var(--accent)" }} />
          <h2 className="font-display uppercase" style={{ fontSize: 16, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>
            My Leagues
          </h2>
        </div>

        {leagues.length === 0 ? (
          <p style={{ fontSize: 14, color: "#8B8676" }}>You haven&apos;t joined any leagues yet. Create one or enter an invite code below.</p>
        ) : (
          <div>
            {leagues.map((league, i) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderTop: i > 0 ? "1px solid #EFEDE6" : "none",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "#11151C", margin: 0 }}>{league.name}</p>
                  <p style={{ fontSize: 12, color: "#8B8676", marginTop: 2, margin: 0 }}>
                    {league.member_count} member{league.member_count !== 1 ? "s" : ""} · Code: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{league.invite_code}</span>
                  </p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create / Join */}
      <div className="grid sm:grid-cols-2" style={{ gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "24px 28px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <span className="shrink-0" style={{ width: 4, height: 20, borderRadius: 2, background: "var(--accent)" }} />
            <h2 className="font-display uppercase" style={{ fontSize: 16, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>
              Create a League
            </h2>
          </div>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="League name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              maxLength={80}
              required
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <button type="submit" disabled={isPending} style={{ ...btnAccent, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? "Creating…" : "Create League"}
            </button>
            {createError && <p style={{ fontSize: 13, color: "#B23A48", margin: 0 }}>{createError}</p>}
            {createFeedback && <p style={{ fontSize: 13, color: "#1F9E5A", fontWeight: 600, margin: 0 }}>{createFeedback}</p>}
          </form>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "24px 28px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <span className="shrink-0" style={{ width: 4, height: 20, borderRadius: 2, background: "var(--accent)" }} />
            <h2 className="font-display uppercase" style={{ fontSize: 16, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>
              Join a League
            </h2>
          </div>
          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              style={{ ...inputStyle, fontFamily: "monospace", textTransform: "uppercase" }}
              placeholder="6-character invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <button type="submit" disabled={isPending} style={{ ...btnAccent, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? "Joining…" : "Join League"}
            </button>
            {joinError && <p style={{ fontSize: 13, color: "#B23A48", margin: 0 }}>{joinError}</p>}
            {joinFeedback && <p style={{ fontSize: 13, color: "#1F9E5A", fontWeight: 600, margin: 0 }}>{joinFeedback}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
