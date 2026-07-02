"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { fetchPlayers, upsertPlayer, deletePlayer, uploadPlayerPhoto, removePlayerPhoto } from "./squadActions";
import type { Team, Player } from "@/lib/supabase/types";

const POSITIONS = [
  "Loosehead Prop",
  "Hooker",
  "Tighthead Prop",
  "Lock",
  "Flanker",
  "No. 8",
  "Halfback",
  "First Five",
  "Second Five",
  "Centre",
  "Wing",
  "Fullback",
];

const emptyForm = {
  first_name: "",
  last_name: "",
  position: POSITIONS[0],
  jersey_number: 1,
  is_active: true,
};

function PlayerAvatar({ player, size = 32 }: { player: Player; size?: number }) {
  const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();
  if (player.photo_url) {
    return (
      <Image
        src={player.photo_url}
        alt={`${player.first_name} ${player.last_name}`}
        width={size}
        height={size}
        className="shrink-0"
        style={{ borderRadius: "50%", objectFit: "cover", width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="shrink-0 flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#E4E1D8",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "#8B8676",
        textTransform: "uppercase",
      }}
    >
      {initials}
    </span>
  );
}

export default function SquadManagementPanel({ teams }: { teams: Team[] }) {
  const [selectedTeam, setSelectedTeam] = useState(teams[0]?.id ?? "");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function load(teamId: string) {
    setLoading(true);
    fetchPlayers(teamId).then((data) => {
      setPlayers(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (selectedTeam) load(selectedTeam);
  }, [selectedTeam]);

  function startEdit(p: Player) {
    setEditing(p);
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position,
      jersey_number: p.jersey_number,
      is_active: p.is_active,
    });
    setPhotoPreview(p.photo_url);
    setPhotoFile(null);
    setFeedback("");
    setFormError("");
  }

  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setPhotoPreview(null);
    setPhotoFile(null);
    setFeedback("");
    setFormError("");
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFormError("Photo must be under 2 MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFormError("Only JPG, PNG, and WebP photos are accepted.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError("First and last name are required.");
      return;
    }
    setFormError("");
    startTransition(async () => {
      const result = await upsertPlayer({
        ...(editing ? { id: editing.id } : {}),
        team_id: selectedTeam,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        position: form.position,
        jersey_number: form.jersey_number,
        is_active: form.is_active,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }

      if (photoFile && result.playerId) {
        setPhotoUploading(true);
        const fd = new FormData();
        fd.append("file", photoFile);
        const uploadResult = await uploadPlayerPhoto(result.playerId, fd);
        setPhotoUploading(false);
        if (uploadResult.error) {
          setFormError(`Player saved but photo upload failed: ${uploadResult.error}`);
          startNew();
          load(selectedTeam);
          return;
        }
      }

      setFeedback(editing ? "Player updated." : "Player added.");
      startNew();
      load(selectedTeam);
    });
  }

  async function handleRemovePhoto(playerId: string) {
    startTransition(async () => {
      const result = await removePlayerPhoto(playerId);
      if (result.error) {
        setFormError(result.error);
      } else {
        setFeedback("Photo removed.");
        load(selectedTeam);
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deletePlayer(id);
      if (result.error) {
        setFormError(result.error);
      } else {
        setFeedback("Player deleted.");
        setConfirmDelete(null);
        load(selectedTeam);
      }
    });
  }

  const teamObj = teams.find((t) => t.id === selectedTeam);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Team selector */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 14, padding: "20px 24px" }}>
        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8B8676", display: "block", marginBottom: 8 }}>
          Select team
        </label>
        <select
          value={selectedTeam}
          onChange={(e) => { setSelectedTeam(e.target.value); startNew(); }}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 9,
            border: "1px solid #E4E1D8",
            fontSize: 14,
            fontWeight: 600,
            background: "#FAFAF8",
          }}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Add/edit form */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 14, padding: "20px 24px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#11151C", margin: "0 0 16px" }}>
          {editing ? "Edit Player" : "Add Player"}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            <input
              placeholder="First name"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid #E4E1D8", fontSize: 14 }}
            />
            <input
              placeholder="Last name"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid #E4E1D8", fontSize: 14 }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            <select
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid #E4E1D8", fontSize: 14 }}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={99}
              placeholder="Jersey #"
              value={form.jersey_number}
              onChange={(e) => setForm((f) => ({ ...f, jersey_number: parseInt(e.target.value) || 1 }))}
              style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid #E4E1D8", fontSize: 14 }}
            />
          </div>

          {/* Photo upload */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {photoPreview ? (
              <Image
                src={photoPreview}
                alt="Preview"
                width={48}
                height={48}
                style={{ borderRadius: "50%", objectFit: "cover", width: 48, height: 48 }}
              />
            ) : (
              <span
                className="flex items-center justify-center"
                style={{ width: 48, height: 48, borderRadius: "50%", background: "#E4E1D8", fontSize: 14, fontWeight: 700, color: "#8B8676" }}
              >
                {(form.first_name[0] ?? "").toUpperCase()}{(form.last_name[0] ?? "").toUpperCase()}
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "1px solid #E4E1D8",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#5A6371",
                  cursor: "pointer",
                }}
              >
                {photoPreview ? "Change photo" : "Upload photo"}
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  style={{
                    padding: "4px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: "transparent",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#B23A48",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            <span style={{ fontSize: 11, color: "#A39E8C" }}>JPG, PNG, WebP &middot; max 2 MB</span>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5A6371" }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={isPending || photoUploading}
              style={{
                padding: "10px 24px",
                borderRadius: 9,
                border: "none",
                background: "var(--accent)",
                color: "var(--accent-text, #11151C)",
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".04em",
                cursor: isPending || photoUploading ? "not-allowed" : "pointer",
                opacity: isPending || photoUploading ? 0.6 : 1,
              }}
            >
              {photoUploading ? "Uploading…" : isPending ? "Saving…" : editing ? "Update" : "Add Player"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={startNew}
                style={{
                  padding: "10px 18px",
                  borderRadius: 9,
                  border: "1px solid #E4E1D8",
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#8B8676",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </div>
          {formError && <p style={{ color: "#B23A48", fontSize: 13, margin: 0 }}>{formError}</p>}
          {feedback && <p style={{ color: "#1F9E5A", fontSize: 13, margin: 0 }}>{feedback}</p>}
        </form>
      </div>

      {/* Player list */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid #EFEDE6",
            background: "#FAF9F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#11151C" }}>
            {teamObj?.name ?? "Team"} Roster
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8B8676" }}>
            {players.length} player{players.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "32px 22px", textAlign: "center", color: "#8B8676", fontSize: 14 }}>
            Loading…
          </div>
        ) : players.length === 0 ? (
          <div style={{ padding: "32px 22px", textAlign: "center", color: "#8B8676", fontSize: 14, fontStyle: "italic" }}>
            No players added yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EFEDE6" }}>
                <th style={{ padding: "10px 22px", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C", textAlign: "left", width: 60 }}>#</th>
                <th style={{ padding: "10px 12px", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C", textAlign: "left" }}>Player</th>
                <th className="hidden sm:table-cell" style={{ padding: "10px 12px", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C", textAlign: "left" }}>Position</th>
                <th style={{ padding: "10px 22px", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #F0EDE5" }}>
                  <td style={{ padding: "10px 22px", fontSize: 14, fontWeight: 700, color: teamObj?.colour || "var(--accent)" }}>
                    {p.jersey_number}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <PlayerAvatar player={p} size={32} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: p.is_active ? "#11151C" : "#B4B0A2" }}>
                        {p.first_name} {p.last_name}
                        {!p.is_active && <span style={{ fontSize: 10, color: "#B4B0A2", marginLeft: 6 }}>(inactive)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell" style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#8B8676", textTransform: "uppercase", letterSpacing: ".04em" }}>
                    {p.position}
                  </td>
                  <td style={{ padding: "10px 22px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        onClick={() => startEdit(p)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 6,
                          border: "1px solid #E4E1D8",
                          background: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#5A6371",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      {p.photo_url && (
                        <button
                          onClick={() => handleRemovePhoto(p.id)}
                          disabled={isPending}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid #E4E1D8",
                            background: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#8B8676",
                            cursor: "pointer",
                          }}
                        >
                          Remove photo
                        </button>
                      )}
                      {confirmDelete === p.id ? (
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={isPending}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "#B23A48",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Confirm
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(p.id)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid #E4E1D8",
                            background: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#B23A48",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
