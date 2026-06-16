"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  fetchSponsors,
  upsertSponsor,
  deleteSponsor,
  reorderSponsors,
  uploadSponsorLogo,
} from "./sponsorActions";
import type { Sponsor, SponsorLocation } from "@/lib/supabase/types";

const LOCATIONS: { value: SponsorLocation; label: string }[] = [
  { value: "all", label: "All pages" },
  { value: "home", label: "Home page" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "email", label: "Results email" },
];

const emptyForm = {
  name: "",
  website_url: "",
  display_location: "all" as SponsorLocation,
  is_active: true,
};

export default function SponsorsPanel() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");

  // Logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    fetchSponsors().then((data) => { setSponsors(data); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  function startEdit(s: Sponsor) {
    setEditing(s);
    setForm({
      name: s.name,
      website_url: s.website_url ?? "",
      display_location: s.display_location,
      is_active: s.is_active,
    });
    setLogoPreview(s.logo_url);
    setLogoFile(null);
    setFeedback("");
    setFormError("");
  }

  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setLogoPreview(null);
    setLogoFile(null);
    setFeedback("");
    setFormError("");
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFormError("Logo must be under 2 MB."); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFeedback("");

    startTransition(async () => {
      const payload: Parameters<typeof upsertSponsor>[0] = {
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        website_url: form.website_url.trim() || null,
        display_location: form.display_location,
        is_active: form.is_active,
        order_position: editing?.order_position ?? sponsors.length,
        logo_url: editing?.logo_url ?? null,
      };

      const { error, sponsor } = await upsertSponsor(payload);
      if (error || !sponsor) { setFormError(error ?? "Failed to save."); return; }

      // Upload logo if a new file was chosen
      if (logoFile) {
        setLogoUploading(true);
        const fd = new FormData();
        fd.append("file", logoFile);
        const { error: uploadErr, url } = await uploadSponsorLogo(sponsor.id, fd);
        setLogoUploading(false);
        if (uploadErr) { setFormError(uploadErr); load(); return; }
        sponsor.logo_url = url ?? null;
      }

      setFeedback(editing ? "Sponsor updated." : "Sponsor added.");
      setEditing(sponsor);
      setLogoFile(null);
      load();
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sponsor?")) return;
    startTransition(async () => {
      await deleteSponsor(id);
      startNew();
      load();
    });
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...sponsors];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSponsors(next);
    await reorderSponsors(next.map((s) => s.id));
    load();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      {/* ── Sponsor list ─────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Sponsors</h2>
          <button className="btn-primary text-xs px-3 py-1.5" onClick={startNew}>+ Add Sponsor</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : sponsors.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No sponsors yet. Add one →</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {sponsors.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-3 py-3 ${editing?.id === s.id ? "bg-brand/5 -mx-2 px-2 rounded-lg" : ""}`}>
                {/* Logo / name */}
                <div className="w-20 h-10 flex items-center justify-center shrink-0 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                  {s.logo_url ? (
                    <Image src={s.logo_url} alt={s.name} width={72} height={36} className="object-contain max-h-9" />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-400 text-center px-1 leading-tight">{s.name}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {LOCATIONS.find((l) => l.value === s.display_location)?.label}
                    {" · "}
                    <span className={s.is_active ? "text-green-600" : "text-gray-400"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>

                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 text-xs leading-none px-1">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === sponsors.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 text-xs leading-none px-1">▼</button>
                </div>

                <button
                  onClick={() => startEdit(s)}
                  className="text-xs text-brand/70 hover:text-brand font-medium shrink-0"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">
          {editing ? "Edit Sponsor" : "New Sponsor"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Logo</label>
            <div
              className="flex items-center gap-4 p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {logoPreview ? (
                <Image src={logoPreview} alt="Preview" width={80} height={40} className="object-contain max-h-10 rounded" />
              ) : (
                <div className="w-20 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">No logo</div>
              )}
              <div>
                <p className="text-xs font-medium text-brand">Click to upload</p>
                <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, SVG · max 2 MB</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Sponsor Name *</label>
            <input
              className="input"
              required
              maxLength={80}
              placeholder="Acme Corp"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Website URL</label>
            <input
              className="input"
              type="url"
              placeholder="https://example.com"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            />
          </div>

          {/* Display location */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Display Location</label>
            <select
              className="input"
              value={form.display_location}
              onChange={(e) => setForm((f) => ({ ...f, display_location: e.target.value as SponsorLocation }))}
            >
              {LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`relative w-10 h-5.5 rounded-full transition-colors ${form.is_active ? "bg-green-500" : "bg-gray-300"}`}
              style={{ height: 22 }}
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-[18px]" : ""}`}
              />
            </div>
            <span className="text-sm text-gray-700">Active</span>
          </label>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {feedback && <p className="text-sm text-green-700">{feedback}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isPending || logoUploading}
            >
              {isPending || logoUploading ? "Saving…" : editing ? "Save Changes" : "Add Sponsor"}
            </button>
            {editing && (
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                onClick={() => handleDelete(editing.id)}
                disabled={isPending}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
