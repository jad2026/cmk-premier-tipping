"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createLeague, joinLeague } from "./actions";
import type { League } from "@/lib/supabase/types";

type LeagueWithCount = League & { member_count: number };

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
    <div className="space-y-6">
      {/* My Leagues */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-brand mb-4">My Leagues</h2>
        {leagues.length === 0 ? (
          <p className="text-gray-500 text-sm">You haven&apos;t joined any leagues yet. Create one or enter an invite code below.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="flex items-center justify-between py-3 group hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div>
                  <p className="font-semibold text-brand group-hover:text-brand-light">{league.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {league.member_count} member{league.member_count !== 1 ? "s" : ""} · Code: <span className="font-mono font-bold">{league.invite_code}</span>
                  </p>
                </div>
                <span className="text-brand text-sm font-medium">View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create / Join */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Create */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-brand mb-3">Create a League</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              className="input"
              placeholder="League name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              maxLength={80}
              required
            />
            <button className="btn-primary w-full" disabled={isPending}>
              {isPending ? "Creating…" : "Create League"}
            </button>
            {createError && <p className="text-red-600 text-sm">{createError}</p>}
            {createFeedback && <p className="text-green-700 text-sm font-medium">{createFeedback}</p>}
          </form>
        </div>

        {/* Join */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-brand mb-3">Join a League</h2>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              className="input font-mono uppercase"
              placeholder="6-character invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
            <button className="btn-gold w-full" disabled={isPending}>
              {isPending ? "Joining…" : "Join League"}
            </button>
            {joinError && <p className="text-red-600 text-sm">{joinError}</p>}
            {joinFeedback && <p className="text-green-700 text-sm font-medium">{joinFeedback}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
