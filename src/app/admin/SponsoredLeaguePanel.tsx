"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getSponsoredLeagueData,
  updateLeagueSponsor,
  upsertPrizes,
} from "./sponsoredLeagueActions";

type LeagueRow = {
  id: string;
  name: string;
  member_count: number;
  is_sponsored?: boolean;
  sponsor_name?: string | null;
  sponsor_logo_url?: string | null;
  sponsor_accent_color?: string | null;
};

type GameweekRow = {
  id: string;
  number: number;
  label: string;
  deadline: string;
};

type PrizeRow = {
  id: string;
  league_id: string;
  gameweek_id: string;
  prize_description: string;
  winner_user_id: string | null;
  awarded_at: string | null;
  winner_display_name?: string | null;
};

export default function SponsoredLeaguePanel({ compId }: { compId: string }) {
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [gameweeks, setGameweeks] = useState<GameweekRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Sponsor form
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState("");
  const [sponsorAccentColor, setSponsorAccentColor] = useState("#D9A521");
  const [sponsorFeedback, setSponsorFeedback] = useState("");
  const [sponsorError, setSponsorError] = useState("");

  // Prizes
  const [prizeDescs, setPrizeDescs] = useState<Record<string, string>>({});
  const [existingPrizes, setExistingPrizes] = useState<PrizeRow[]>([]);
  const [prizeFeedback, setPrizeFeedback] = useState("");
  const [prizeError, setPrizeError] = useState("");

  const selected = leagues.find((l) => l.id === selectedId);

  function load() {
    setLoading(true);
    getSponsoredLeagueData(compId).then(({ leagues: l, gameweeks: g }) => {
      setLeagues(l as unknown as LeagueRow[]);
      setGameweeks(g as GameweekRow[]);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, [compId]);

  useEffect(() => {
    if (!selected) return;
    setSponsorName(selected.sponsor_name ?? "");
    setSponsorLogoUrl(selected.sponsor_logo_url ?? "");
    setSponsorAccentColor(selected.sponsor_accent_color ?? "#D9A521");
    setSponsorFeedback("");
    setSponsorError("");
    setPrizeFeedback("");
    setPrizeError("");

    if (selected.is_sponsored) {
      loadPrizes(selected.id);
    } else {
      setExistingPrizes([]);
      setPrizeDescs({});
    }
  }, [selectedId]);

  async function loadPrizes(leagueId: string) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: prizes } = await admin
      .from("league_prizes")
      .select("*, profiles:winner_user_id(display_name)")
      .eq("league_id", leagueId);

    const mapped = (prizes ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      winner_display_name:
        p.profiles && typeof p.profiles === "object"
          ? (p.profiles as { display_name: string | null }).display_name
          : null,
      profiles: undefined,
    })) as unknown as PrizeRow[];

    setExistingPrizes(mapped);
    const descs: Record<string, string> = {};
    for (const p of mapped) {
      descs[p.gameweek_id] = p.prize_description;
    }
    setPrizeDescs(descs);
  }

  function handleMakeSponsored() {
    if (!selected) return;
    startTransition(async () => {
      const { error } = await updateLeagueSponsor(selected.id, {
        is_sponsored: true,
        sponsor_name: null,
        sponsor_logo_url: null,
        sponsor_accent_color: null,
      });
      if (error) { setSponsorError(error); return; }
      load();
      setSponsorFeedback("League marked as sponsored.");
    });
  }

  function handleSaveSponsor(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSponsorError("");
    setSponsorFeedback("");
    startTransition(async () => {
      const { error } = await updateLeagueSponsor(selected.id, {
        is_sponsored: true,
        sponsor_name: sponsorName.trim() || null,
        sponsor_logo_url: sponsorLogoUrl.trim() || null,
        sponsor_accent_color: sponsorAccentColor.trim() || null,
      });
      if (error) { setSponsorError(error); return; }
      setSponsorFeedback("Sponsor details saved.");
      load();
    });
  }

  function handleSavePrizes() {
    if (!selected) return;
    setPrizeError("");
    setPrizeFeedback("");
    const rows = gameweeks
      .filter((gw) => (prizeDescs[gw.id] ?? "").trim())
      .map((gw) => ({
        league_id: selected.id,
        gameweek_id: gw.id,
        prize_description: prizeDescs[gw.id].trim(),
      }));

    startTransition(async () => {
      const { error } = await upsertPrizes(rows);
      if (error) { setPrizeError(error); return; }
      setPrizeFeedback(`Saved ${rows.length} prize${rows.length === 1 ? "" : "s"}.`);
      loadPrizes(selected.id);
    });
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      {/* ── Section A: League Selection & Sponsor Config ──────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">
          Sponsored League Setup
        </h2>

        {/* League selector */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Select League
          </label>
          <select
            className="input"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— Choose a league —</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.member_count} member{l.member_count === 1 ? "" : "s"})
              </option>
            ))}
          </select>
        </div>

        {selected && !selected.is_sponsored && (
          <div className="pt-2">
            <button
              className="btn-primary text-sm"
              onClick={handleMakeSponsored}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Make Sponsored"}
            </button>
            {sponsorFeedback && <p className="text-sm text-green-700 mt-2">{sponsorFeedback}</p>}
            {sponsorError && <p className="text-sm text-red-600 mt-2">{sponsorError}</p>}
          </div>
        )}

        {selected && selected.is_sponsored && (
          <form onSubmit={handleSaveSponsor} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Sponsor Name
              </label>
              <input
                className="input"
                maxLength={100}
                placeholder="Acme Corp"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Sponsor Logo URL
              </label>
              <input
                className="input"
                type="url"
                placeholder="https://example.com/logo.png"
                value={sponsorLogoUrl}
                onChange={(e) => setSponsorLogoUrl(e.target.value)}
              />
              {sponsorLogoUrl.trim() && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sponsorLogoUrl}
                    alt="Sponsor logo preview"
                    className="max-h-12 object-contain"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Sponsor Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={sponsorAccentColor}
                  onChange={(e) => setSponsorAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <input
                  className="input flex-1"
                  maxLength={7}
                  placeholder="#D9A521"
                  value={sponsorAccentColor}
                  onChange={(e) => setSponsorAccentColor(e.target.value)}
                />
              </div>
            </div>

            {sponsorError && <p className="text-sm text-red-600">{sponsorError}</p>}
            {sponsorFeedback && <p className="text-sm text-green-700">{sponsorFeedback}</p>}

            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? "Saving…" : "Save Sponsor Details"}
            </button>
          </form>
        )}
      </div>

      {/* ── Section B: Prize Setup ────────────────────────────────────── */}
      {selected && selected.is_sponsored && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-brand uppercase tracking-wide">
              Prizes by Round
            </h2>
            <button
              className="btn-primary text-xs px-3 py-1.5"
              onClick={handleSavePrizes}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save All Prizes"}
            </button>
          </div>

          {prizeError && <p className="text-sm text-red-600 mb-3">{prizeError}</p>}
          {prizeFeedback && <p className="text-sm text-green-700 mb-3">{prizeFeedback}</p>}

          <div className="divide-y divide-gray-100">
            {gameweeks.map((gw) => {
              const existing = existingPrizes.find((p) => p.gameweek_id === gw.id);
              return (
                <div key={gw.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="sm:w-48 shrink-0">
                    <p className="text-sm font-semibold text-gray-800">{gw.label}</p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(gw.deadline).toLocaleDateString()}
                    </p>
                  </div>

                  <input
                    className="input flex-1"
                    placeholder="Prize description…"
                    value={prizeDescs[gw.id] ?? ""}
                    onChange={(e) =>
                      setPrizeDescs((prev) => ({ ...prev, [gw.id]: e.target.value }))
                    }
                  />

                  <div className="sm:w-44 shrink-0 text-right">
                    {existing?.winner_user_id ? (
                      <span className="text-xs font-medium text-green-700">
                        🏆 {existing.winner_display_name ?? "Winner set"}
                      </span>
                    ) : existing ? (
                      <span className="text-xs text-gray-400">Not yet awarded</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
