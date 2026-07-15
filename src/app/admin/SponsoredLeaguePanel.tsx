"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getSponsoredLeagueData,
  createSponsoredLeague,
  updateLeagueSponsor,
  uploadSponsorLogo,
  upsertPrizes,
} from "./sponsoredLeagueActions";

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      style={{
        background: copied ? "#16a34a" : "var(--accent)",
        color: copied ? "#fff" : "var(--accent-text, #11151C)",
      }}
    >
      {copied ? "Copied!" : "Copy Code"}
    </button>
  );
}

export default function SponsoredLeaguePanel({ compId }: { compId: string }) {
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [gameweeks, setGameweeks] = useState<GameweekRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Create form
  const [createName, setCreateName] = useState("");
  const [createSponsor, setCreateSponsor] = useState("");
  const [createColor, setCreateColor] = useState("#D9A521");
  const [createFeedback, setCreateFeedback] = useState<{ code: string } | null>(null);
  const [createError, setCreateError] = useState("");

  // Edit form
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorAccentColor, setSponsorAccentColor] = useState("#D9A521");
  const [sponsorFeedback, setSponsorFeedback] = useState("");
  const [sponsorError, setSponsorError] = useState("");

  // Logo upload
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prizes
  const [prizeDescs, setPrizeDescs] = useState<Record<string, string>>({});
  const [existingPrizes, setExistingPrizes] = useState<PrizeRow[]>([]);
  const [prizeFeedback, setPrizeFeedback] = useState("");
  const [prizeError, setPrizeError] = useState("");

  const sponsoredLeagues = leagues.filter((l) => l.is_sponsored);
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
    if (!selected) {
      setExistingPrizes([]);
      setPrizeDescs({});
      return;
    }
    setSponsorName(selected.sponsor_name ?? "");
    setSponsorAccentColor(selected.sponsor_accent_color ?? "#D9A521");
    setLogoUrl(selected.sponsor_logo_url ?? null);
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
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: prizes } = await sb
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

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateFeedback(null);
    startTransition(async () => {
      const { error, league } = await createSponsoredLeague({
        name: createName.trim(),
        competition_id: compId,
        sponsor_name: createSponsor.trim(),
        sponsor_accent_color: createColor.trim() || null,
      });
      if (error || !league) { setCreateError(error ?? "Failed to create league."); return; }
      const code = league.invite_code as string;
      const id = league.id as string;
      setCreateFeedback({ code });
      setCreateName("");
      setCreateSponsor("");
      setCreateColor("#D9A521");
      load();
      setTimeout(() => setSelectedId(id), 300);
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
        sponsor_logo_url: logoUrl,
        sponsor_accent_color: sponsorAccentColor.trim() || null,
      });
      if (error) { setSponsorError(error); return; }
      setSponsorFeedback("Sponsor details saved.");
      load();
    });
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    if (file.size > 2 * 1024 * 1024) { setSponsorError("Logo must be under 2 MB."); return; }

    setLogoUploading(true);
    setSponsorError("");
    const fd = new FormData();
    fd.append("file", file);
    const { error, url } = await uploadSponsorLogo(selected.id, fd);
    setLogoUploading(false);

    if (error) { setSponsorError(error); return; }
    if (url) setLogoUrl(url);
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
      {/* ── Section A: Create New Sponsored League ────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">
          Create New Sponsored League
        </h2>

        {createFeedback && (
          <div className="mb-4 p-4 rounded-xl border-2 border-green-200 bg-green-50">
            <p className="text-sm font-semibold text-green-800 mb-2">League created!</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tracking-[.15em] text-green-900">
                {createFeedback.code}
              </span>
              <CopyButton text={createFeedback.code} />
            </div>
            <p className="text-xs text-green-700 mt-2">Share this invite code with league members.</p>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              League Name *
            </label>
            <input
              className="input"
              required
              maxLength={100}
              placeholder="Premier League Tips"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Sponsor Name *
            </label>
            <input
              className="input"
              required
              maxLength={100}
              placeholder="Acme Corp"
              value={createSponsor}
              onChange={(e) => setCreateSponsor(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={createColor}
                onChange={(e) => setCreateColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                className="input flex-1"
                maxLength={7}
                placeholder="#D9A521"
                value={createColor}
                onChange={(e) => setCreateColor(e.target.value)}
              />
            </div>
          </div>

          {createError && <p className="text-sm text-red-600">{createError}</p>}

          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? "Creating…" : "Create Sponsored League"}
          </button>
        </form>
      </div>

      {/* ── Section B: Manage Existing Sponsored Leagues ─────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">
          Manage Sponsored Leagues
        </h2>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Select League
          </label>
          <select
            className="input"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— Choose a sponsored league —</option>
            {sponsoredLeagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.member_count} member{l.member_count === 1 ? "" : "s"}) — {l.invite_code}
              </option>
            ))}
          </select>
        </div>

        {selected && selected.is_sponsored && (
          <>
            {/* Invite code + member count */}
            <div className="mb-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Invite Code</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-2xl font-bold tracking-[.15em] text-gray-900">
                      {selected.invite_code}
                    </span>
                    <CopyButton text={selected.invite_code} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Members</p>
                  <p className="text-2xl font-bold text-gray-900">{selected.member_count}</p>
                </div>
              </div>
            </div>

            {/* Edit form */}
            <form onSubmit={handleSaveSponsor} className="space-y-4">
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

              {/* Logo upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Sponsor Logo
                </label>
                {logoUrl && (
                  <div className="mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Sponsor logo"
                      style={{ maxWidth: 200 }}
                      className="object-contain"
                    />
                  </div>
                )}
                <div
                  className="flex items-center gap-4 p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand/40 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <div>
                    <p className="text-xs font-medium text-brand">
                      {logoUploading ? "Uploading…" : "Click to upload logo"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, SVG · max 2 MB</p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Accent Color
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

              <button type="submit" className="btn-primary" disabled={isPending || logoUploading}>
                {isPending ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </>
        )}
      </div>

      {/* ── Section C: Prize Setup ────────────────────────────────────── */}
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
