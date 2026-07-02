"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { createTeam, updateTeam, updateTeamLogoUrl, deleteTeam } from "./actions";
import TeamBadge from "@/components/TeamBadge";
import type { Team } from "@/lib/supabase/types";

const BUCKET = "team-logos";
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

// ── Logo picker (reused in Add and Edit forms) ────────────────────────────────

function LogoPicker({
  currentUrl,
  teamId,
  onCommit,
}: {
  currentUrl: string | null;
  teamId: string | null; // null = new team not yet saved
  onCommit: (url: string | null) => void;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) { setErr("Max 2 MB."); return; }
    if (!f.type.startsWith("image/")) { setErr("Images only."); return; }
    setErr(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function upload(idForPath: string) {
    if (!file) return currentUrl;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${idForPath}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setErr(upErr.message); setUploading(false); return null; }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setUploading(false);
    return `${publicUrl}?t=${Date.now()}`;
  }

  async function remove() {
    setUploading(true);
    for (const ext of ["png", "jpg", "jpeg", "webp", "svg"]) {
      await supabase.storage.from(BUCKET).remove([`${teamId}.${ext}`]);
    }
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
    onCommit(null);
  }

  const displayUrl = preview ?? currentUrl;

  return (
    <div className="flex items-center gap-3">
      {/* Preview circle */}
      <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
        {displayUrl ? (
          <Image src={displayUrl} alt="Logo" width={48} height={48} className="object-cover w-full h-full" unoptimized={!!preview} />
        ) : (
          <svg className="w-5 h-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={pick} id={`logo-pick-${teamId ?? "new"}`} />
        <label htmlFor={`logo-pick-${teamId ?? "new"}`} className="cursor-pointer px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
          {displayUrl ? "Change logo" : "Choose logo"}
        </label>
        {currentUrl && !file && (
          <button type="button" onClick={remove} disabled={uploading} className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 hover:border-red-400 rounded-lg transition-colors">
            Remove
          </button>
        )}
        {file && <span className="text-xs text-gray-400">{file.name}</span>}
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>

      {/* Expose upload fn via imperative handle pattern via prop */}
      <input type="hidden" data-pending-upload={file ? "true" : "false"} />
    </div>
  );
}

// ── Team form (shared by Add + Edit) ─────────────────────────────────────────

type FormMode = { kind: "add" } | { kind: "edit"; team: Team };

function TeamForm({
  mode,
  onDone,
  onCancel,
  compId,
}: {
  mode: FormMode;
  onDone: (team: Team) => void;
  onCancel: () => void;
  compId: string;
}) {
  const supabase = createClient();
  const isEdit = mode.kind === "edit";
  const existing = isEdit ? mode.team : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [shortName, setShortName] = useState(existing?.short_name ?? "");
  const [colour, setColour] = useState(existing?.colour ?? "#1e3a5f");
  const [logoUrl, setLogoUrl] = useState<string | null>(existing?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) { setErr("Max 2 MB."); return; }
    if (!f.type.startsWith("image/")) { setErr("Images only."); return; }
    setErr(null);
    setLogoFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function uploadLogo(idForPath: string): Promise<string | null> {
    if (!logoFile) return logoUrl;
    const ext = logoFile.name.split(".").pop() ?? "jpg";
    const path = `${idForPath}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
    if (upErr) { setErr(upErr.message); return null; }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return `${publicUrl}?t=${Date.now()}`;
  }

  async function removeLogo() {
    if (!existing) return;
    for (const ext of ["png", "jpg", "jpeg", "webp", "svg"]) {
      await supabase.storage.from(BUCKET).remove([`${existing.id}.${ext}`]);
    }
    setLogoUrl(null);
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Team name is required."); return; }
    setSaving(true);
    setErr(null);

    if (isEdit && existing) {
      const finalUrl = await uploadLogo(existing.id);
      if (logoFile && finalUrl === null) { setSaving(false); return; }
      const { error } = await updateTeam(existing.id, name, shortName || name.slice(0, 3).toUpperCase(), colour, finalUrl);
      if (error) { setErr(error); setSaving(false); return; }
      // Also persist logo url via updateTeamLogoUrl if changed
      onDone({ ...existing, name: name.trim(), short_name: shortName.trim() || name.slice(0, 3).toUpperCase(), colour, logo_url: finalUrl });
    } else {
      // Create team first (need the ID for the logo path)
      const { data: newTeam, error: createErr } = await createTeam(name, shortName || name.slice(0, 3).toUpperCase(), colour, null);
      if (createErr || !newTeam) { setErr(createErr ?? "Failed to create team."); setSaving(false); return; }

      let finalUrl: string | null = null;
      if (logoFile) {
        finalUrl = await uploadLogo(newTeam.id);
        if (finalUrl) {
          await updateTeamLogoUrl(newTeam.id, finalUrl);
        }
      }

      onDone({
        id: newTeam.id,
        name: name.trim(),
        short_name: shortName.trim() || name.slice(0, 3).toUpperCase(),
        colour,
        logo_url: finalUrl,
        competition_id: compId,
        home_ground: null,
      });
    }
    setSaving(false);
  }

  const displayLogo = logoPreview ?? logoUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-blue-50 border border-blue-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-brand">{isEdit ? `Edit — ${existing?.name}` : "Add new team"}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Team name *</label>
          <input
            type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Auckland Blues" className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Short name</label>
          <input
            type="text" maxLength={6} value={shortName} onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. BLU (auto if blank)" className="input text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Colour</label>
          <input type="color" value={colour} onChange={(e) => setColour(e.target.value)}
            className="h-9 w-16 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Logo</label>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
              {displayLogo
                ? <Image src={displayLogo} alt="Logo" width={40} height={40} className="object-cover w-full h-full" unoptimized={!!logoPreview} />
                : <svg className="w-4 h-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
              }
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={pickLogo} id={`logo-input-form-${existing?.id ?? "new"}`} />
              <label htmlFor={`logo-input-form-${existing?.id ?? "new"}`}
                className="cursor-pointer px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                {displayLogo ? "Change" : "Choose"}
              </label>
              {logoUrl && !logoFile && (
                <button type="button" onClick={removeLogo}
                  className="px-3 py-1.5 text-xs text-red-500 border border-red-200 hover:border-red-400 rounded-lg transition-colors">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary text-sm py-2">
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add team"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function TeamManagementPanel({ initialTeams, compId }: { initialTeams: Team[]; compId: string }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [mode, setMode] = useState<"list" | "add" | { kind: "edit"; team: Team }>("list");
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDone(team: Team) {
    setTeams((prev) => {
      const idx = prev.findIndex((t) => t.id === team.id);
      return idx >= 0 ? prev.map((t) => (t.id === team.id ? team : t)) : [...prev, team];
    });
    setMode("list");
  }

  function confirmDelete(team: Team) {
    setDeleteTarget(team);
    setDeleteErr(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const { error } = await deleteTeam(deleteTarget.id);
      if (error) {
        setDeleteErr(error);
      } else {
        setTeams((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    });
  }

  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="space-y-5">

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-gray-900">Delete {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-500">This cannot be undone. Teams with fixtures cannot be deleted.</p>
            {deleteErr && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{deleteErr}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setDeleteTarget(null); setDeleteErr(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit form ───────────────────────────────────────────── */}
      {mode === "add" && (
        <TeamForm mode={{ kind: "add" }} onDone={handleDone} onCancel={() => setMode("list")} compId={compId} />
      )}
      {typeof mode === "object" && mode.kind === "edit" && (
        <TeamForm mode={mode} onDone={handleDone} onCancel={() => setMode("list")} compId={compId} />
      )}

      {/* ── Team list ─────────────────────────────────────────────────── */}
      {mode === "list" && (
        <div className="flex justify-end">
          <button onClick={() => setMode("add")} className="btn-primary text-sm py-2">
            + Add team
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No teams yet — add one above.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Team</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hidden sm:table-cell">Short</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hidden sm:table-cell">Colour</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TeamBadge team={team} size="sm" />
                      <span className="font-medium text-gray-800">{team.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{team.short_name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full border border-black/10 shrink-0" style={{ background: team.colour }} />
                      <span className="text-xs text-gray-400 font-mono">{team.colour}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setMode({ kind: "edit", team })}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirmDelete(team)}
                        className="px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
