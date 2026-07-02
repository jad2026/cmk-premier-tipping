"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchPlayers, upsertPlayer, deletePlayer } from "./squadActions";
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
    setFeedback("");
    setFormError("");
  }

  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setFeedback("");
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
      } else {
        setFeedback(editing ? "Player updated." : "Player added.");
        startNew();
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
              disabled={isPending}
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
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Saving…" : editing ? "Update" : "Add Player"}
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
                <th style={{ padding: "10px 22px", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C", textAlign: "left" }}>#</th>
                <th style={{ padding: "10px 12px", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#A39E8C", textAlign: "left" }}>Name</th>
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
                  <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600, color: p.is_active ? "#11151C" : "#B4B0A2" }}>
                    {p.first_name} {p.last_name}
                    {!p.is_active && <span style={{ fontSize: 10, color: "#B4B0A2", marginLeft: 6 }}>(inactive)</span>}
                  </td>
                  <td className="hidden sm:table-cell" style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#8B8676", textTransform: "uppercase", letterSpacing: ".04em" }}>
                    {p.position}
                  </td>
                  <td style={{ padding: "10px 22px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
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
