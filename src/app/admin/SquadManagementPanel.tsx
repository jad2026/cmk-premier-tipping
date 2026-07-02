"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  fetchPlayers,
  upsertPlayer,
  deletePlayer,
  uploadPlayerPhoto,
  removePlayerPhoto,
  fetchCoachingStaff,
  upsertCoach,
  deleteCoach,
  uploadCoachPhoto,
} from "./squadActions";
import type { Team, Player, CoachingStaff } from "@/lib/supabase/types";

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
  is_captain: false,
  apps: 0,
  pts: 0,
};

const emptyCoachForm = {
  name: "",
  role: "",
  display_order: 0,
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
  const [coaches, setCoaches] = useState<CoachingStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<"players" | "coaching">("players");

  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editingCoach, setEditingCoach] = useState<CoachingStaff | null>(null);
  const [coachForm, setCoachForm] = useState(emptyCoachForm);
  const [coachPhotoFile, setCoachPhotoFile] = useState<File | null>(null);
  const [coachPhotoPreview, setCoachPhotoPreview] = useState<string | null>(null);
  const coachFileRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteCoach, setConfirmDeleteCoach] = useState<string | null>(null);

  function load(teamId: string) {
    setLoading(true);
    Promise.all([fetchPlayers(teamId), fetchCoachingStaff(teamId)]).then(
      ([playerData, coachData]) => {
        setPlayers(playerData);
        setCoaches(coachData);
        setLoading(false);
      },
    );
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
      is_captain: p.is_captain,
      apps: p.apps,
      pts: p.pts,
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

  function startEditCoach(c: CoachingStaff) {
    setEditingCoach(c);
    setCoachForm({ name: c.name, role: c.role, display_order: c.display_order });
    setCoachPhotoPreview(c.photo_url);
    setCoachPhotoFile(null);
    setFeedback("");
    setFormError("");
  }

  function startNewCoach() {
    setEditingCoach(null);
    setCoachForm(emptyCoachForm);
    setCoachPhotoPreview(null);
    setCoachPhotoFile(null);
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

  function handleCoachPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFormError("Photo must be under 2 MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFormError("Only JPG, PNG, and WebP photos are accepted.");
      return;
    }
    setCoachPhotoFile(file);
    setCoachPhotoPreview(URL.createObjectURL(file));
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
        is_captain: form.is_captain,
        apps: form.apps,
        pts: form.pts,
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

  async function handleCoachSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coachForm.name.trim() || !coachForm.role.trim()) {
      setFormError("Name and role are required.");
      return;
    }
    setFormError("");
    startTransition(async () => {
      const result = await upsertCoach({
        ...(editingCoach ? { id: editingCoach.id } : {}),
        team_id: selectedTeam,
        name: coachForm.name.trim(),
        role: coachForm.role.trim(),
        display_order: coachForm.display_order,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }

      if (coachPhotoFile && result.coachId) {
        setPhotoUploading(true);
        const fd = new FormData();
        fd.append("file", coachPhotoFile);
        const uploadResult = await uploadCoachPhoto(result.coachId, fd);
        setPhotoUploading(false);
        if (uploadResult.error) {
          setFormError(`Coach saved but photo upload failed: ${uploadResult.error}`);
          startNewCoach();
          load(selectedTeam);
          return;
        }
      }

      setFeedback(editingCoach ? "Coach updated." : "Coach added.");
      startNewCoach();
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

  async function handleDeleteCoach(id: string) {
    startTransition(async () => {
      const result = await deleteCoach(id);
      if (result.error) {
        setFormError(result.error);
      } else {
        setFeedback("Coach deleted.");
        setConfirmDeleteCoach(null);
        load(selectedTeam);
      }
    });
  }

  const teamObj = teams.find((t) => t.id === selectedTeam);

  const inputStyle = {
    padding: "10px 14px",
    borderRadius: 9,
    border: "1px solid #E4E1D8",
    fontSize: 14,
  } as const;

  const smallBtnStyle = {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #E4E1D8",
    background: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Team selector */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 14, padding: "20px 24px" }}>
        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8B8676", display: "block", marginBottom: 8 }}>
          Select team
        </label>
        <select
          value={selectedTeam}
          onChange={(e) => { setSelectedTeam(e.target.value); startNew(); startNewCoach(); }}
          style={{
            width: "100%",
            ...inputStyle,
            fontWeight: 600,
            background: "#FAFAF8",
          }}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["players", "coaching"] as const).map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            style={{
              padding: "10px 20px",
              borderRadius: 9,
              border: "1px solid #E4E1D8",
              background: activeSection === sec ? "var(--accent)" : "#fff",
              color: activeSection === sec ? "var(--accent-text, #11151C)" : "#8B8676",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".04em",
              cursor: "pointer",
            }}
          >
            {sec === "players" ? "Players" : "Coaching Staff"}
          </button>
        ))}
      </div>

      {activeSection === "players" ? (
        <>
          {/* Add/edit player form */}
          <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 14, padding: "20px 24px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#11151C", margin: "0 0 16px" }}>
              {editing ? "Edit Player" : "Add Player"}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                <input placeholder="First name" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
                <input placeholder="Last name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                <select value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} style={inputStyle}>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="number" min={1} max={99} placeholder="Jersey #" value={form.jersey_number} onChange={(e) => setForm((f) => ({ ...f, jersey_number: parseInt(e.target.value) || 1 }))} style={inputStyle} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
                <input type="number" min={0} placeholder="Apps" value={form.apps} onChange={(e) => setForm((f) => ({ ...f, apps: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                <input type="number" min={0} placeholder="Points" value={form.pts} onChange={(e) => setForm((f) => ({ ...f, pts: parseInt(e.target.value) || 0 }))} style={inputStyle} />
              </div>

              {/* Photo upload */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {photoPreview ? (
                  <Image src={photoPreview} alt="Preview" width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", width: 48, height: 48 }} />
                ) : (
                  <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: "50%", background: "#E4E1D8", fontSize: 14, fontWeight: 700, color: "#8B8676" }}>
                    {(form.first_name[0] ?? "").toUpperCase()}{(form.last_name[0] ?? "").toUpperCase()}
                  </span>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: "none" }} />
                  <button type="button" onClick={() => fileRef.current?.click()} style={{ ...smallBtnStyle, color: "#5A6371" }}>
                    {photoPreview ? "Change photo" : "Upload photo"}
                  </button>
                  {photoPreview && (
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ ...smallBtnStyle, border: "none", background: "transparent", fontSize: 11, fontWeight: 600, color: "#B23A48", textAlign: "left" as const, padding: "4px 14px" }}>
                      Remove
                    </button>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#A39E8C" }}>JPG, PNG, WebP &middot; max 2 MB</span>
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5A6371" }}>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                  Active
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5A6371" }}>
                  <input type="checkbox" checked={form.is_captain} onChange={(e) => setForm((f) => ({ ...f, is_captain: e.target.checked }))} />
                  Captain
                </label>
              </div>

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
                  <button type="button" onClick={startNew} style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid #E4E1D8", background: "#fff", fontSize: 13, fontWeight: 700, color: "#8B8676", cursor: "pointer" }}>
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
            <div style={{ padding: "14px 22px", borderBottom: "1px solid #EFEDE6", background: "#FAF9F5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#11151C" }}>
                {teamObj?.name ?? "Team"} Roster
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#8B8676" }}>
                {players.length} player{players.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div style={{ padding: "32px 22px", textAlign: "center", color: "#8B8676", fontSize: 14 }}>Loading…</div>
            ) : players.length === 0 ? (
              <div style={{ padding: "32px 22px", textAlign: "center", color: "#8B8676", fontSize: 14, fontStyle: "italic" }}>No players added yet.</div>
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
                            {p.is_captain && <span style={{ fontSize: 10, color: teamObj?.colour || "var(--accent)", marginLeft: 6, fontWeight: 800 }}>(C)</span>}
                            {!p.is_active && <span style={{ fontSize: 10, color: "#B4B0A2", marginLeft: 6 }}>(inactive)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#8B8676", textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {p.position}
                      </td>
                      <td style={{ padding: "10px 22px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button onClick={() => startEdit(p)} style={{ ...smallBtnStyle, color: "#5A6371" }}>Edit</button>
                          {p.photo_url && (
                            <button onClick={() => handleRemovePhoto(p.id)} disabled={isPending} style={{ ...smallBtnStyle, fontSize: 11, color: "#8B8676" }}>
                              Remove photo
                            </button>
                          )}
                          {confirmDelete === p.id ? (
                            <button onClick={() => handleDelete(p.id)} disabled={isPending} style={{ ...smallBtnStyle, border: "none", background: "#B23A48", color: "#fff" }}>
                              Confirm
                            </button>
                          ) : (
                            <button onClick={() => setConfirmDelete(p.id)} style={{ ...smallBtnStyle, color: "#B23A48" }}>
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
        </>
      ) : (
        <>
          {/* Add/edit coach form */}
          <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 14, padding: "20px 24px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#11151C", margin: "0 0 16px" }}>
              {editingCoach ? "Edit Coach" : "Add Coach"}
            </h3>
            <form onSubmit={handleCoachSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                <input placeholder="Name" value={coachForm.name} onChange={(e) => setCoachForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
                <input placeholder="Role (e.g. Head Coach)" value={coachForm.role} onChange={(e) => setCoachForm((f) => ({ ...f, role: e.target.value }))} style={inputStyle} />
              </div>
              <input type="number" min={0} placeholder="Display order" value={coachForm.display_order} onChange={(e) => setCoachForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} style={{ ...inputStyle, maxWidth: 200 }} />

              {/* Coach photo upload */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {coachPhotoPreview ? (
                  <Image src={coachPhotoPreview} alt="Preview" width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", width: 48, height: 48 }} />
                ) : (
                  <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: "50%", background: "#E4E1D8", fontSize: 14, fontWeight: 700, color: "#8B8676" }}>
                    {coachForm.name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2)}
                  </span>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input ref={coachFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoachPhotoChange} style={{ display: "none" }} />
                  <button type="button" onClick={() => coachFileRef.current?.click()} style={{ ...smallBtnStyle, color: "#5A6371" }}>
                    {coachPhotoPreview ? "Change photo" : "Upload photo"}
                  </button>
                  {coachPhotoPreview && (
                    <button type="button" onClick={() => { setCoachPhotoFile(null); setCoachPhotoPreview(null); if (coachFileRef.current) coachFileRef.current.value = ""; }} style={{ ...smallBtnStyle, border: "none", background: "transparent", fontSize: 11, fontWeight: 600, color: "#B23A48", textAlign: "left" as const, padding: "4px 14px" }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

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
                  {photoUploading ? "Uploading…" : isPending ? "Saving…" : editingCoach ? "Update" : "Add Coach"}
                </button>
                {editingCoach && (
                  <button type="button" onClick={startNewCoach} style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid #E4E1D8", background: "#fff", fontSize: 13, fontWeight: 700, color: "#8B8676", cursor: "pointer" }}>
                    Cancel
                  </button>
                )}
              </div>
              {formError && <p style={{ color: "#B23A48", fontSize: 13, margin: 0 }}>{formError}</p>}
              {feedback && <p style={{ color: "#1F9E5A", fontSize: 13, margin: 0 }}>{feedback}</p>}
            </form>
          </div>

          {/* Coaching staff list */}
          <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid #EFEDE6", background: "#FAF9F5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#11151C" }}>
                {teamObj?.name ?? "Team"} Coaching Staff
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#8B8676" }}>
                {coaches.length} coach{coaches.length !== 1 ? "es" : ""}
              </span>
            </div>

            {loading ? (
              <div style={{ padding: "32px 22px", textAlign: "center", color: "#8B8676", fontSize: 14 }}>Loading…</div>
            ) : coaches.length === 0 ? (
              <div style={{ padding: "32px 22px", textAlign: "center", color: "#8B8676", fontSize: 14, fontStyle: "italic" }}>No coaching staff added yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {coaches.map((c, idx) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderBottom: idx < coaches.length - 1 ? "1px solid #F0EDE5" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {c.photo_url ? (
                        <Image src={c.photo_url} alt={c.name} width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover", width: 36, height: 36 }} />
                      ) : (
                        <span className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: "50%", background: "#E4E1D8", fontSize: 12, fontWeight: 700, color: "#8B8676" }}>
                          {c.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      )}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#11151C" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "#8B8676" }}>{c.role}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEditCoach(c)} style={{ ...smallBtnStyle, color: "#5A6371" }}>Edit</button>
                      {confirmDeleteCoach === c.id ? (
                        <button onClick={() => handleDeleteCoach(c.id)} disabled={isPending} style={{ ...smallBtnStyle, border: "none", background: "#B23A48", color: "#fff" }}>
                          Confirm
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDeleteCoach(c.id)} style={{ ...smallBtnStyle, color: "#B23A48" }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
