"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { updateTeamLogoUrl } from "./actions";
import TeamBadge from "@/components/TeamBadge";
import type { Team } from "@/lib/supabase/types";

const BUCKET = "team-logos";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "success" }
  | { status: "error"; message: string };

function TeamCard({ team, onLogoChange }: { team: Team; onLogoChange: (teamId: string, url: string | null) => void }) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setState({ status: "error", message: "File is too large (max 2 MB)." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setState({ status: "error", message: "Only image files are accepted." });
      return;
    }

    setSelectedFile(file);
    setState({ status: "idle" });

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setState({ status: "uploading", progress: 0 });

    const ext = selectedFile.name.split(".").pop() ?? "jpg";
    // Use a fixed path per team so re-uploads overwrite the old file
    const path = `${team.id}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, selectedFile, { upsert: true, contentType: selectedFile.type });

    if (uploadErr) {
      setState({ status: "error", message: uploadErr.message });
      return;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Bust the CDN cache by appending a timestamp query param
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: dbErr } = await updateTeamLogoUrl(team.id, publicUrl);
    if (dbErr) {
      setState({ status: "error", message: dbErr });
      return;
    }

    setState({ status: "success" });
    setSelectedFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    onLogoChange(team.id, publicUrl);
  }

  async function handleRemove() {
    setState({ status: "uploading", progress: 0 });
    // Try to delete the stored object (best-effort — ignore errors)
    const extensions = ["png", "jpg", "jpeg", "webp", "svg"];
    for (const ext of extensions) {
      await supabase.storage.from(BUCKET).remove([`${team.id}.${ext}`]);
    }
    const { error: dbErr } = await updateTeamLogoUrl(team.id, null);
    if (dbErr) {
      setState({ status: "error", message: dbErr });
      return;
    }
    setState({ status: "idle" });
    setPreview(null);
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
    onLogoChange(team.id, null);
  }

  // Current logo to display: local preview > saved url > nothing
  const currentLogo = preview ?? team.logo_url;
  const isUploading = state.status === "uploading";

  return (
    <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-4 py-4 shadow-sm">
      {/* Badge / preview */}
      <div className="shrink-0">
        {currentLogo && currentLogo !== team.logo_url ? (
          // Local preview (data URL) — can't use next/image for data URLs
          <span
            className="relative inline-block w-14 h-14 rounded-full overflow-hidden ring-1 ring-black/10"
          >
            <Image
              src={currentLogo}
              alt="Preview"
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          </span>
        ) : (
          <TeamBadge team={team} size="lg" />
        )}
      </div>

      {/* Name + controls */}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-800 text-sm truncate">{team.name}</p>
        <p className="text-xs text-gray-400 mb-2">{team.short_name}</p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleFileChange}
            id={`logo-input-${team.id}`}
          />
          <label
            htmlFor={`logo-input-${team.id}`}
            className="cursor-pointer px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {team.logo_url ? "Replace logo" : "Choose logo"}
          </label>

          {selectedFile && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs font-semibold bg-brand hover:bg-brand-light text-white rounded-lg transition-colors disabled:opacity-60"
            >
              {isUploading ? "Uploading…" : "Upload"}
            </button>
          )}

          {team.logo_url && !selectedFile && (
            <button
              onClick={handleRemove}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg transition-colors disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>

        {/* Feedback */}
        {state.status === "success" && (
          <p className="text-xs text-green-600 mt-1.5 font-medium">
            ✓ Logo updated
          </p>
        )}
        {state.status === "error" && (
          <p className="text-xs text-red-600 mt-1.5">{state.message}</p>
        )}
        {selectedFile && state.status === "idle" && (
          <p className="text-xs text-gray-400 mt-1.5 truncate">
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </div>
    </div>
  );
}

export default function TeamManagementPanel({ initialTeams }: { initialTeams: Team[] }) {
  // Keep a local copy so logo changes update the card immediately without a full reload
  const [teams, setTeams] = useState<Team[]>(initialTeams);

  function handleLogoChange(teamId: string, url: string | null) {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, logo_url: url } : t))
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload a PNG, JPEG, WebP or SVG logo for each club (max 2 MB). Logos
        are stored publicly and displayed throughout the app.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            onLogoChange={handleLogoChange}
          />
        ))}
      </div>
    </section>
  );
}
