"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { PickerPlayer } from "./page";

const SQUAD_SIZE = 15;
const MAX_PER_TEAM = 4;
const POSITION_SLOTS = { Forward: 8, Back: 7 } as const;

type PositionKey = keyof typeof POSITION_SLOTS;

function Badge({ player, size = 28 }: { player: PickerPlayer; size?: number }) {
  if (player.teamLogoUrl) {
    return (
      <span
        className="relative inline-block shrink-0 rounded-full overflow-hidden ring-1 ring-white/20"
        style={{ width: size, height: size }}
      >
        <Image
          src={player.teamLogoUrl}
          alt={player.teamName}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized={false}
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-white/20 text-white select-none"
      style={{ width: size, height: size, backgroundColor: player.teamColour, fontSize: size * 0.35 }}
    >
      {player.teamShortName}
    </span>
  );
}

function PlayerCard({
  player,
  selected,
  disabled,
  onToggle,
}: {
  player: PickerPlayer;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled && !selected}
      className="w-full text-left transition-all duration-150 group/card"
      style={{
        background: selected ? "#2C9FD4" : "#161B24",
        borderRadius: 12,
        padding: "12px 14px",
        border: selected ? "1px solid #2C9FD4" : "1px solid rgba(255,255,255,0.06)",
        opacity: disabled && !selected ? 0.4 : 1,
        cursor: disabled && !selected ? "not-allowed" : "pointer",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Badge player={player} />
          {selected && (
            <span
              className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center text-white"
              style={{ fontSize: 10, lineHeight: 1 }}
            >
              <span className="group-hover/card:hidden" style={{ background: "#0B0E13", width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>&#10003;</span>
              <span className="hidden group-hover/card:flex" style={{ background: "#B23A48", width: 18, height: 18, borderRadius: "50%", alignItems: "center", justifyContent: "center" }}>&times;</span>
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-display uppercase truncate"
            style={{ fontSize: 14, color: selected ? "#0B0E13" : "#fff", lineHeight: 1.3 }}
          >
            {player.name}
          </div>
          <div style={{ fontSize: 11, color: selected ? "rgba(11,14,19,0.6)" : "#8C93A0", marginTop: 1 }}>
            {player.position} &middot; {player.teamName}
          </div>
        </div>
        {selected ? (
          <div
            className="shrink-0 font-display uppercase hidden group-hover/card:block"
            style={{ fontSize: 11, color: "#0B0E13", opacity: 0.7 }}
          >
            Remove
          </div>
        ) : null}
        <div className="text-right shrink-0" style={{ minWidth: 44 }}>
          <div
            className="font-display"
            style={{ fontSize: 18, color: selected ? "#0B0E13" : "#2C9FD4", lineHeight: 1 }}
          >
            {player.points}
          </div>
          <div style={{ fontSize: 10, color: selected ? "rgba(11,14,19,0.5)" : "#5A6371", marginTop: 2 }}>
            PTS
          </div>
        </div>
      </div>
      <div
        className="flex gap-3 mt-2"
        style={{ fontSize: 11, color: selected ? "rgba(11,14,19,0.6)" : "#5A6371" }}
      >
        <span>{player.games}G</span>
        <span>{player.tries}T</span>
        <span>{player.tackles}TK</span>
        <span>{player.metres}M</span>
      </div>
    </button>
  );
}

function SquadSlot({ player, onRemove }: { player: PickerPlayer | null; onRemove?: () => void }) {
  if (!player) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          width: 60,
          height: 72,
          borderRadius: 10,
          border: "1px dashed rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <span style={{ fontSize: 20, color: "rgba(255,255,255,0.12)" }}>+</span>
      </div>
    );
  }

  return (
    <button
      onClick={onRemove}
      className="flex flex-col items-center text-center group"
      style={{ width: 60 }}
    >
      <div className="relative">
        <Badge player={player} size={40} />
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "#B23A48", fontSize: 10, color: "#fff" }}
        >
          &times;
        </span>
      </div>
      <div
        className="font-display uppercase truncate w-full mt-1"
        style={{ fontSize: 9, color: "#fff", lineHeight: 1.2 }}
      >
        {player.name.split(" ").pop()}
      </div>
      <div style={{ fontSize: 9, color: "#5A6371" }}>{player.points}pts</div>
    </button>
  );
}

export default function SquadPicker({ players }: { players: PickerPlayer[] }) {
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [posFilter, setPosFilter] = useState<"All" | PositionKey>("All");
  const [teamFilter, setTeamFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  const selectedIds = Object.keys(selected);
  const selectedCount = selectedIds.length;

  const teamCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of selectedIds) {
      const p = players.find((pl) => pl.id === id);
      if (p) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
    }
    return counts;
  }, [selected, players]);

  const posCountMap = useMemo(() => {
    const counts: Record<PositionKey, number> = { Forward: 0, Back: 0 };
    for (const id of selectedIds) {
      const p = players.find((pl) => pl.id === id);
      if (p && (p.position === "Forward" || p.position === "Back")) {
        counts[p.position]++;
      }
    }
    return counts;
  }, [selected, players]);

  const teams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of players) {
      if (!seen.has(p.teamId)) seen.set(p.teamId, p.teamName);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const filtered = useMemo(() => {
    let list = players;
    if (posFilter !== "All") list = list.filter((p) => p.position === posFilter);
    if (teamFilter !== "All") list = list.filter((p) => p.teamId === teamFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [players, posFilter, teamFilter, search]);

  function isDisabled(player: PickerPlayer): boolean {
    if (selected[player.id]) return false;
    if (selectedCount >= SQUAD_SIZE) return true;
    if ((teamCountMap.get(player.teamId) ?? 0) >= MAX_PER_TEAM) return true;
    const pos = player.position as PositionKey;
    if (pos in POSITION_SLOTS && posCountMap[pos] >= POSITION_SLOTS[pos]) return true;
    return false;
  }

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev[id]) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: true as const };
    });
  }

  const selectedPlayers = players.filter((p) => selected[p.id]);
  const forwards = selectedPlayers.filter((p) => p.position === "Forward");
  const backs = selectedPlayers.filter((p) => p.position === "Back");
  const totalPoints = selectedPlayers.reduce((s, p) => s + p.points, 0);

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Hero */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 28px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div
              className="shrink-0"
              style={{ width: 24, height: 3, borderRadius: 2, background: "#2C9FD4" }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: "#C7CCD4",
              }}
            >
              Fantasy Rugby
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 48, lineHeight: 0.9, margin: 0 }}
          >
            Pick your squad<span style={{ color: "#2C9FD4" }}>.</span>
          </h1>
          <p style={{ color: "#8C93A0", fontSize: 14, marginTop: 12, maxWidth: 520 }}>
            Select {SQUAD_SIZE} players — {POSITION_SLOTS.Forward} forwards and{" "}
            {POSITION_SLOTS.Back} backs. Max {MAX_PER_TEAM} from any one team.
          </p>
        </div>
      </section>

      {/* Squad tray */}
      <section style={{ background: "#0D1016", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "20px 32px" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-display uppercase" style={{ fontSize: 13, color: "#fff", letterSpacing: ".06em" }}>
                Your squad
              </span>
              <span
                className="font-display"
                style={{
                  fontSize: 12,
                  color: selectedCount === SQUAD_SIZE ? "#2C9FD4" : "#5A6371",
                }}
              >
                {selectedCount}/{SQUAD_SIZE}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: "#5A6371" }}>Total pts</span>
              <span className="font-display" style={{ fontSize: 20, color: "#2C9FD4" }}>
                {totalPoints}
              </span>
            </div>
          </div>

          {/* Forwards row */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#5A6371", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".12em" }}>
              Forwards ({forwards.length}/{POSITION_SLOTS.Forward})
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: POSITION_SLOTS.Forward }).map((_, i) => (
                <SquadSlot
                  key={`f-${i}`}
                  player={forwards[i] ?? null}
                  onRemove={forwards[i] ? () => toggle(forwards[i].id) : undefined}
                />
              ))}
            </div>
          </div>

          {/* Backs row */}
          <div>
            <div style={{ fontSize: 10, color: "#5A6371", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".12em" }}>
              Backs ({backs.length}/{POSITION_SLOTS.Back})
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: POSITION_SLOTS.Back }).map((_, i) => (
                <SquadSlot
                  key={`b-${i}`}
                  player={backs[i] ?? null}
                  onRemove={backs[i] ? () => toggle(backs[i].id) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Filters + Player list */}
      <section style={{ background: "#0B0E13", minHeight: "60vh" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "24px 32px 70px" }}>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 mb-5">
            <input
              type="text"
              placeholder="Search players…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[180px]"
              style={{
                background: "#161B24",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "8px 14px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
            <div className="flex gap-1.5">
              {(["All", "Forward", "Back"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className="font-display uppercase"
                  style={{
                    fontSize: 11,
                    padding: "7px 14px",
                    borderRadius: 8,
                    background: posFilter === pos ? "#2C9FD4" : "#161B24",
                    color: posFilter === pos ? "#0B0E13" : "#8C93A0",
                    border: "none",
                    cursor: "pointer",
                    letterSpacing: ".04em",
                  }}
                >
                  {pos === "All" ? "All" : pos + "s"}
                </button>
              ))}
            </div>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={{
                background: "#161B24",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "7px 14px",
                color: teamFilter === "All" ? "#8C93A0" : "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <option value="All">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Player grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#5A6371", fontSize: 14 }}>
              No players match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  selected={!!selected[player.id]}
                  disabled={isDisabled(player)}
                  onToggle={() => toggle(player.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
