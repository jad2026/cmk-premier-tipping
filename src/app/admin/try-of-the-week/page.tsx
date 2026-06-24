"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { fetchTries, saveTry, deleteTry } from "./actions";
import type { TryOfTheWeek } from "./actions";
import type { Gameweek } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

export default function TryOfTheWeekAdmin() {
  const [tries, setTries] = useState<TryOfTheWeek[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [compId, setCompId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [gameweekId, setGameweekId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [caption, setCaption] = useState("");
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");

  // Gameweek label lookup
  const gwMap = new Map(gameweeks.map((gw) => [gw.id, gw]));

  useEffect(() => {
    async function init() {
      // Read competition ID from the middleware-injected header via a fetch
      const res = await fetch("/api/competition-id");
      const { compId: cid } = await res.json().catch(() => ({ compId: "" }));
      const resolvedCompId = cid || "b3dbe30d-91ef-40c3-9680-3586c6d17ef8";
      setCompId(resolvedCompId);

      const supabase = createClient();
      const { data: gws } = await supabase
        .from("gameweeks")
        .select("*")
        .eq("competition_id", resolvedCompId)
        .order("number");
      setGameweeks((gws ?? []) as Gameweek[]);

      const data = await fetchTries(resolvedCompId);
      setTries(data);
      setLoading(false);
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFeedback("");

    if (!gameweekId) { setFormError("Please select a round."); return; }
    if (!videoUrl.trim()) { setFormError("Please enter a video URL."); return; }

    startTransition(async () => {
      const result = await saveTry({
        gameweek_id: gameweekId,
        video_url: videoUrl,
        player_name: playerName,
        team_name: teamName,
        caption,
        compId,
      });

      if (result.error) {
        setFormError(result.error);
      } else {
        setFeedback("Try of the Week saved! It is now the active entry.");
        setVideoUrl("");
        setPlayerName("");
        setTeamName("");
        setCaption("");
        setGameweekId("");
        const data = await fetchTries(compId);
        setTries(data);
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    startTransition(async () => {
      await deleteTry(id);
      const data = await fetchTries(compId);
      setTries(data);
    });
  }

  function truncate(s: string, len: number) {
    return s.length > len ? s.slice(0, len) + "…" : s;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand">Try of the Week</h1>
          <p className="text-sm text-gray-500 mt-1">Manage featured tries for the home page.</p>
        </div>
        <Link href="/admin" className="btn-ghost text-sm">← Back to Admin</Link>
      </div>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">Add New Entry</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Round *</label>
            <select
              className="input"
              value={gameweekId}
              onChange={(e) => setGameweekId(e.target.value)}
              required
            >
              <option value="">Select a round…</option>
              {gameweeks.map((gw) => (
                <option key={gw.id} value={gw.id}>{gw.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Video URL *</label>
            <input
              className="input"
              required
              placeholder="https://youtube.com/watch?v=... or any video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Player Name</label>
              <input
                className="input"
                placeholder="e.g. Richie Mo'unga"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Team Name</label>
              <input
                className="input"
                placeholder="e.g. Canterbury"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Caption</label>
            <input
              className="input"
              placeholder="Amazing solo effort from the halfway line"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
            />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {feedback && <p className="text-sm text-green-700 font-medium">{feedback}</p>}

          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save Try of the Week"}
          </button>
        </form>
      </div>

      {/* ── Existing entries ──────────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">All Entries</h2>
        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : tries.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No entries yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {tries.map((t) => {
              const gw = gwMap.get(t.gameweek_id);
              return (
                <div key={t.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">
                        {gw?.label ?? "Unknown Round"}
                      </span>
                      {t.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[t.player_name, t.team_name].filter(Boolean).join(" · ") || "No player info"}
                    </p>
                    {t.caption && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">{t.caption}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{truncate(t.video_url, 50)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors shrink-0"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
