"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import type { PickerPlayer, PickerTeam, SavedSquad } from "./page";
import { saveSquad } from "./actions";

/* ───────── Fantasy slot config (mirrors future fantasy_slots table) ───────── */

type SlotDef = {
  jersey: number;
  label: string;
  positionGroup: string;
};

const SLOTS: SlotDef[] = [
  { jersey: 1,  label: "Loosehead Prop", positionGroup: "Prop" },
  { jersey: 2,  label: "Hooker",         positionGroup: "Hooker" },
  { jersey: 3,  label: "Tighthead Prop", positionGroup: "Prop" },
  { jersey: 4,  label: "Lock",           positionGroup: "Lock" },
  { jersey: 5,  label: "Lock",           positionGroup: "Lock" },
  { jersey: 6,  label: "Blindside",      positionGroup: "Loose Forward" },
  { jersey: 7,  label: "Openside",       positionGroup: "Loose Forward" },
  { jersey: 8,  label: "Number 8",       positionGroup: "Loose Forward" },
  { jersey: 9,  label: "Halfback",       positionGroup: "Halfback" },
  { jersey: 10, label: "First Five",     positionGroup: "First Five" },
  { jersey: 11, label: "Left Wing",      positionGroup: "Outside Back" },
  { jersey: 12, label: "Inside Centre",  positionGroup: "Centre" },
  { jersey: 13, label: "Outside Centre", positionGroup: "Centre" },
  { jersey: 14, label: "Right Wing",     positionGroup: "Outside Back" },
  { jersey: 15, label: "Fullback",       positionGroup: "Outside Back" },
];

const SQUAD_SIZE = 15;
const MAX_PER_TEAM = 3;
const TOTAL_BUDGET = 100.0;

/* ───────── Position filter chips ───────── */

type PosFilter = {
  label: string;
  jerseys: string;
  groups: string[];
};

const POS_FILTERS: PosFilter[] = [
  { label: "All",            jerseys: "",           groups: [] },
  { label: "Prop",           jerseys: "1,3",        groups: ["Prop"] },
  { label: "Hooker",         jerseys: "2",          groups: ["Hooker"] },
  { label: "Lock",           jerseys: "4-5",        groups: ["Lock"] },
  { label: "Loose Fwd",      jerseys: "6-8",        groups: ["Loose Forward"] },
  { label: "Halfback",       jerseys: "9",          groups: ["Halfback"] },
  { label: "First Five",     jerseys: "10",         groups: ["First Five"] },
  { label: "Centres",        jerseys: "12-13",      groups: ["Centre"] },
  { label: "Outside Back",   jerseys: "11,14,15",   groups: ["Outside Back"] },
];

/* ───────── Sort options ───────── */

type SortKey = "price" | "avg" | "name";

function sortPlayers(list: PickerPlayer[], key: SortKey): PickerPlayer[] {
  const copy = [...list];
  switch (key) {
    case "price":
      return copy.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    case "avg":
      return copy.sort((a, b) => b.avgPoints - a.avgPoints || a.name.localeCompare(b.name));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/* ───────── Small components ───────── */

function TeamBadgeMini({ player, size = 24 }: { player: PickerPlayer; size?: number }) {
  if (player.teamLogoUrl) {
    return (
      <span
        className="relative inline-block shrink-0 rounded-full overflow-hidden ring-1 ring-white/10"
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
      className="inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-white/10 text-white select-none"
      style={{ width: size, height: size, backgroundColor: player.teamColour, fontSize: size * 0.38, fontWeight: 700 }}
    >
      {player.teamShortName}
    </span>
  );
}

/* ───────── Toast ───────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(onDone, 2400);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#161B24",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "10px 20px",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        zIndex: 100,
        pointerEvents: "none",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
      }}
    >
      {message}
    </div>
  );
}

/* ───────── Main component ───────── */

export default function SquadPicker({
  players,
  teams,
  gameweekId,
  gameweekLabel,
  savedSquad,
  isSignedIn,
}: {
  players: PickerPlayer[];
  teams: PickerTeam[];
  gameweekId: string | null;
  gameweekLabel: string | null;
  savedSquad: SavedSquad | null;
  isSignedIn: boolean;
}) {
  const [squad, setSquad] = useState<Record<number, string>>(() => {
    if (!savedSquad) return {};
    const s: Record<number, string> = {};
    for (const pick of savedSquad.picks) s[pick.slot_number] = pick.player_id;
    return s;
  });
  const [captain, setCaptain] = useState<string | null>(savedSquad?.captainId ?? null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(savedSquad?.viceCaptainId ?? null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [posFilter, setPosFilter] = useState(0);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"browse" | "squad">("browse");
  const [toast, setToast] = useState<string | null>(null);
  const toastKey = useRef(0);
  const [saving, setSaving] = useState(false);
  const isLocked = savedSquad?.isLocked ?? false;

  const playerById = useMemo(() => {
    const map: Record<string, PickerPlayer> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const jersey of Object.keys(squad)) {
      const pid = squad[Number(jersey)];
      if (pid) ids.add(pid);
    }
    return ids;
  }, [squad]);

  const filledCount = assignedIds.size;

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const jersey of Object.keys(squad)) {
      const pid = squad[Number(jersey)];
      if (!pid) continue;
      const p = playerById[pid];
      if (p) counts[p.teamId] = (counts[p.teamId] ?? 0) + 1;
    }
    return counts;
  }, [squad, playerById]);

  const budgetUsed = useMemo(() => {
    let sum = 0;
    for (const jersey of Object.keys(squad)) {
      const pid = squad[Number(jersey)];
      if (pid && playerById[pid]) sum += playerById[pid].price;
    }
    return Math.round(sum * 10) / 10;
  }, [squad, playerById]);

  const budgetRemaining = Math.round((TOTAL_BUDGET - budgetUsed) * 10) / 10;

  function showToast(msg: string) {
    toastKey.current += 1;
    setToast(msg);
  }

  const hasOpenSlotForPosition = useCallback(
    (position: string): boolean => {
      return SLOTS.some((s) => s.positionGroup === position && !squad[s.jersey]);
    },
    [squad],
  );

  const eligibleGroups = useMemo(() => {
    if (activeSlot === null) return null;
    const slot = SLOTS.find((s) => s.jersey === activeSlot);
    return slot ? [slot.positionGroup] : null;
  }, [activeSlot]);

  const filtered = useMemo(() => {
    let list = players;

    if (eligibleGroups) {
      list = list.filter((p) => eligibleGroups.includes(p.position));
    } else if (posFilter > 0) {
      const groups = POS_FILTERS[posFilter].groups;
      list = list.filter((p) => groups.includes(p.position));
    }

    if (teamFilter) {
      list = list.filter((p) => p.teamId === teamFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q),
      );
    }

    return sortPlayers(list, sortKey);
  }, [players, posFilter, teamFilter, search, sortKey, eligibleGroups]);

  const isPlayerDisabled = useCallback(
    (player: PickerPlayer): boolean => {
      if (assignedIds.has(player.id)) return true;
      if (filledCount >= SQUAD_SIZE) return true;
      if ((teamCounts[player.teamId] ?? 0) >= MAX_PER_TEAM) return true;
      if (player.price > budgetRemaining) return true;
      if (!hasOpenSlotForPosition(player.position)) return true;
      return false;
    },
    [assignedIds, filledCount, teamCounts, budgetRemaining, hasOpenSlotForPosition],
  );

  function addPlayer(playerId: string) {
    const player = playerById[playerId];
    if (!player) return;

    if (assignedIds.has(playerId)) return;

    if ((teamCounts[player.teamId] ?? 0) >= MAX_PER_TEAM) {
      showToast(`Max ${MAX_PER_TEAM} per team reached`);
      return;
    }

    if (filledCount >= SQUAD_SIZE) {
      showToast("Squad is full");
      return;
    }

    if (player.price > budgetRemaining) {
      showToast("Not enough budget");
      return;
    }

    if (activeSlot !== null) {
      const slotDef = SLOTS.find((s) => s.jersey === activeSlot);
      if (slotDef && slotDef.positionGroup !== player.position) {
        showToast(`#${activeSlot} needs a ${slotDef.positionGroup}`);
        return;
      }
      setSquad((prev) => {
        const next = { ...prev, [activeSlot]: playerId };
        console.log("[fantasy] add", player.name, "→ #" + activeSlot, next);
        return next;
      });
      const currentIdx = SLOTS.findIndex((s) => s.jersey === activeSlot);
      const nextEmpty = SLOTS.find(
        (s, i) => i > currentIdx && !squad[s.jersey] && s.jersey !== activeSlot,
      );
      setActiveSlot(nextEmpty ? nextEmpty.jersey : null);
      return;
    }

    const slot = SLOTS.find(
      (s) => !squad[s.jersey] && s.positionGroup === player.position,
    );

    if (!slot) {
      showToast(`All ${player.position} slots are filled`);
      return;
    }

    setSquad((prev) => {
      const next = { ...prev, [slot.jersey]: playerId };
      console.log("[fantasy] add", player.name, "→ #" + slot.jersey, next);
      return next;
    });
  }

  function removePlayer(jersey: number) {
    const pid = squad[jersey];
    const player = pid ? playerById[pid] : null;
    setSquad((prev) => {
      const next = { ...prev };
      delete next[jersey];
      console.log("[fantasy] remove", player?.name ?? pid, "from #" + jersey, next);
      return next;
    });
    if (pid === captain) setCaptain(null);
    if (pid === viceCaptain) setViceCaptain(null);
  }

  function toggleCaptain(pid: string) {
    if (captain === pid) {
      setCaptain(null);
    } else {
      if (viceCaptain === pid) setViceCaptain(null);
      setCaptain(pid);
    }
  }

  function toggleVice(pid: string) {
    if (viceCaptain === pid) {
      setViceCaptain(null);
    } else {
      if (captain === pid) setCaptain(null);
      setViceCaptain(pid);
    }
  }

  const canSave = filledCount === SQUAD_SIZE && captain !== null && viceCaptain !== null && !isLocked && !saving;

  async function handleSave() {
    if (!canSave) return;
    if (!isSignedIn) {
      window.location.href = "/login";
      return;
    }
    if (!gameweekId) {
      showToast("No open round available");
      return;
    }
    setSaving(true);
    const prices: Record<string, number> = {};
    for (const jersey of Object.keys(squad)) {
      const pid = squad[Number(jersey)];
      if (pid && playerById[pid]) prices[pid] = playerById[pid].price;
    }
    const result = await saveSquad({
      gameweekId,
      squad,
      captainId: captain!,
      viceCaptainId: viceCaptain!,
      totalSpent: budgetUsed,
      prices,
    });
    setSaving(false);
    if (result.error) {
      showToast(result.error);
    } else {
      showToast("Squad saved!");
    }
  }

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", paddingBottom: 160 }}
    >
      {/* ── Hero ── */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "36px 24px 20px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "#2C9FD4" }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Fantasy Rugby
            </span>
          </div>
          <h1 className="font-display uppercase" style={{ fontSize: 40, lineHeight: 0.9, margin: 0 }}>
            Pick your XV<span style={{ color: "#2C9FD4" }}>.</span>
          </h1>
          <p style={{ color: "#8C93A0", fontSize: 13, marginTop: 10, maxWidth: 480, lineHeight: 1.5 }}>
            Fill 15 jersey slots. Max {MAX_PER_TEAM} per team. Budget: ${TOTAL_BUDGET}m.
            Choose a captain (2&times; pts) and vice-captain (1.5&times; pts).
          </p>
          <div className="flex items-center gap-4" style={{ marginTop: 8 }}>
            <a
              href="/fantasy/how-to-play"
              style={{ color: "#2C9FD4", fontSize: 12, fontWeight: 600, display: "inline-block", textDecoration: "none" }}
            >
              How to play &rarr;
            </a>
            <a
              href="/fantasy/leaderboard"
              style={{ color: "#2C9FD4", fontSize: 12, fontWeight: 600, display: "inline-block", textDecoration: "none" }}
            >
              Leaderboard &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ── Locked / gameweek banner ── */}
      {(isLocked || gameweekLabel) && (
        <div style={{ background: isLocked ? "#1a1008" : "#0D1016", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="mx-auto" style={{ maxWidth: 1100, padding: "10px 24px", display: "flex", alignItems: "center", gap: 10 }}>
            {gameweekLabel && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#8C93A0" }}>{gameweekLabel}</span>
            )}
            {isLocked && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "#D9A521" }}>
                This round is locked. You can edit your squad for the next round.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Tab toggle ── */}
      <section style={{ background: "#0D1016", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto flex" style={{ maxWidth: 1100, padding: "0 24px" }}>
          {(["browse", "squad"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="font-display uppercase"
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 12,
                letterSpacing: ".08em",
                color: tab === t ? "#fff" : "#5A6371",
                background: "transparent",
                border: "none",
                borderBottom: tab === t ? "2px solid #2C9FD4" : "2px solid transparent",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {t === "browse" ? "Browse Players" : `My Squad (${filledCount}/${SQUAD_SIZE})`}
            </button>
          ))}
        </div>
      </section>

      {/* ── Content area ── */}
      <section style={{ background: "#0B0E13", minHeight: "50vh" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "16px 24px 0" }}>
          {tab === "browse" ? (
            <>
              {/* Search */}
              <input
                type="text"
                placeholder="Search player or team…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "#161B24",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "9px 14px",
                  color: "#fff",
                  fontSize: 13,
                  outline: "none",
                  marginBottom: 12,
                }}
              />

              {/* Position filter chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ marginBottom: 8 }}>
                {POS_FILTERS.map((pf, i) => (
                  <button
                    key={pf.label}
                    onClick={() => { setPosFilter(i); setActiveSlot(null); }}
                    className="font-display uppercase shrink-0"
                    style={{
                      fontSize: 10,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: (activeSlot === null && posFilter === i) ? "#2C9FD4" : "#161B24",
                      color: (activeSlot === null && posFilter === i) ? "#0B0E13" : "#8C93A0",
                      border: "none",
                      cursor: "pointer",
                      letterSpacing: ".04em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pf.label}{pf.jerseys ? ` ${pf.jerseys}` : ""}
                  </button>
                ))}
              </div>

              {/* Team filter chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ marginBottom: 8 }}>
                <button
                  onClick={() => setTeamFilter(null)}
                  className="shrink-0"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "5px 10px",
                    borderRadius: 6,
                    background: teamFilter === null ? "#2C9FD4" : "#161B24",
                    color: teamFilter === null ? "#0B0E13" : "#8C93A0",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  All
                </button>
                {teams.map((t) => {
                  const cnt = teamCounts[t.id] ?? 0;
                  const full = cnt >= MAX_PER_TEAM;
                  const active = teamFilter === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTeamFilter(active ? null : t.id)}
                      className="shrink-0"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "5px 10px",
                        borderRadius: 6,
                        background: active ? "#2C9FD4" : "#161B24",
                        color: active ? "#0B0E13" : full ? "#B23A48" : "#8C93A0",
                        border: "none",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name} {cnt}/{MAX_PER_TEAM}
                    </button>
                  );
                })}
              </div>

              {/* Sort buttons */}
              <div className="flex gap-1.5" style={{ marginBottom: 14 }}>
                {([["price", "$"], ["avg", "Avg"], ["name", "Name"]] as [SortKey, string][]).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSortKey(key)}
                      className="font-display uppercase"
                      style={{
                        fontSize: 10,
                        padding: "4px 10px",
                        borderRadius: 5,
                        background: sortKey === key ? "rgba(44,159,212,0.15)" : "transparent",
                        color: sortKey === key ? "#2C9FD4" : "#5A6371",
                        border: sortKey === key ? "1px solid rgba(44,159,212,0.3)" : "1px solid rgba(255,255,255,0.06)",
                        cursor: "pointer",
                        letterSpacing: ".06em",
                      }}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>

              {/* Active slot indicator */}
              {activeSlot !== null && (
                <div
                  style={{
                    background: "rgba(44,159,212,0.1)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    marginBottom: 12,
                    fontSize: 12,
                    color: "#2C9FD4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    Picking for <strong>#{activeSlot} {SLOTS[activeSlot - 1].label}</strong>
                    {" — "}showing {SLOTS[activeSlot - 1].positionGroup}s only
                  </span>
                  <button
                    onClick={() => setActiveSlot(null)}
                    style={{ background: "none", border: "none", color: "#2C9FD4", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Player list */}
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 24px", color: "#5A6371", fontSize: 13 }}>
                  No players match your filters.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filtered.map((player) => {
                    const inSquad = assignedIds.has(player.id);
                    const disabled = isPlayerDisabled(player);
                    const dimmed = inSquad || (disabled && !inSquad);

                    return (
                      <div
                        key={player.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0,
                          background: inSquad ? "rgba(44,159,212,0.06)" : "#161B24",
                          borderRadius: 10,
                          overflow: "hidden",
                          opacity: dimmed ? 0.45 : 1,
                        }}
                      >
                        {/* Team colour bar */}
                        <div style={{ width: 4, alignSelf: "stretch", background: player.teamColour, flexShrink: 0 }} />

                        <div style={{ flex: 1, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <TeamBadgeMini player={player} size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="font-display uppercase truncate" style={{ fontSize: 13, color: inSquad ? "#2C9FD4" : "#fff", lineHeight: 1.3 }}>
                              {player.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#5A6371", marginTop: 1 }}>
                              {player.teamName} &middot; {player.position}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0, minWidth: 52 }}>
                            <div className="font-display" style={{ fontSize: 13, color: inSquad ? "#5A6371" : "#fff" }}>
                              ${player.price}m
                            </div>
                            <div style={{ fontSize: 10, color: "#8C93A0", marginTop: 1 }}>
                              {player.avgPoints} avg
                            </div>
                          </div>
                          {inSquad ? (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "rgba(44,159,212,0.15)",
                                color: "#2C9FD4",
                                fontSize: 16,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              ✓
                            </div>
                          ) : (
                            <button
                              disabled={disabled}
                              onClick={() => addPlayer(player.id)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                border: "none",
                                background: disabled ? "#1a1f28" : "#2C9FD4",
                                color: disabled ? "#3a3f48" : "#0B0E13",
                                fontSize: 18,
                                fontWeight: 700,
                                cursor: disabled ? "not-allowed" : "pointer",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                lineHeight: 1,
                              }}
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ── My Squad tab ── */
            <div className="flex flex-col gap-1.5">
              {SLOTS.map((slot) => {
                const pid = squad[slot.jersey];
                const player = pid ? playerById[pid] : null;
                const isCap = pid === captain;
                const isVice = pid === viceCaptain;

                return (
                  <div
                    key={slot.jersey}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0,
                      background: player ? "#161B24" : "rgba(255,255,255,0.02)",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: player ? "none" : "1px dashed rgba(255,255,255,0.08)",
                    }}
                  >
                    {/* Jersey number */}
                    <div
                      className="font-display"
                      style={{
                        width: 36,
                        textAlign: "center",
                        fontSize: 14,
                        color: player ? "#2C9FD4" : "#3a3f48",
                        flexShrink: 0,
                        padding: "10px 0",
                      }}
                    >
                      {slot.jersey}
                    </div>

                    {player ? (
                      <>
                        {/* Colour bar */}
                        <div style={{ width: 3, alignSelf: "stretch", background: player.teamColour, flexShrink: 0 }} />

                        <div style={{ flex: 1, padding: "10px 12px 10px 10px", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="font-display uppercase truncate" style={{ fontSize: 13, color: "#fff", lineHeight: 1.3 }}>
                              {player.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#5A6371", marginTop: 1 }}>
                              {player.teamName} &middot; ${player.price}m
                            </div>
                          </div>

                          {/* C / V pills */}
                          <button
                            onClick={() => toggleCaptain(pid)}
                            className="font-display"
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              border: isCap ? "none" : "1px solid rgba(255,255,255,0.12)",
                              background: isCap ? "#2C9FD4" : "transparent",
                              color: isCap ? "#0B0E13" : "#5A6371",
                              fontSize: 11,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            C
                          </button>
                          <button
                            onClick={() => toggleVice(pid)}
                            className="font-display"
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              border: isVice ? "none" : "1px solid rgba(255,255,255,0.12)",
                              background: isVice ? "#2C9FD4" : "transparent",
                              color: isVice ? "#0B0E13" : "#5A6371",
                              fontSize: 11,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            V
                          </button>

                          {/* Remove */}
                          <button
                            onClick={() => removePlayer(slot.jersey)}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              border: "1px solid rgba(255,255,255,0.08)",
                              background: "transparent",
                              color: "#B23A48",
                              fontSize: 14,
                              cursor: "pointer",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              lineHeight: 1,
                            }}
                          >
                            &times;
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, padding: "10px 12px" }}>
                        <div style={{ fontSize: 12, color: "#3a3f48" }}>
                          {slot.label}
                        </div>
                        <button
                          onClick={() => { setActiveSlot(slot.jersey); setTab("browse"); }}
                          style={{
                            fontSize: 11,
                            color: "#2C9FD4",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            marginTop: 2,
                          }}
                        >
                          + Pick player
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Sticky footer ── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0D1016",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          zIndex: 50,
        }}
      >
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "12px 24px 14px" }}>
          {/* Slot circles */}
          <div className="flex justify-center gap-1.5" style={{ marginBottom: 10 }}>
            {SLOTS.map((slot) => {
              const filled = !!squad[slot.jersey];
              const active = activeSlot === slot.jersey;
              return (
                <button
                  key={slot.jersey}
                  onClick={() => {
                    if (filled) {
                      removePlayer(slot.jersey);
                    } else if (active) {
                      setActiveSlot(null);
                    } else {
                      setActiveSlot(slot.jersey);
                      setTab("browse");
                    }
                  }}
                  className="font-display"
                  title={filled ? `Remove ${playerById[squad[slot.jersey]]?.name ?? "player"}` : slot.label}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: active ? "2px solid #fff" : filled ? "2px solid #2C9FD4" : "1px solid rgba(255,255,255,0.12)",
                    background: filled ? "#2C9FD4" : "transparent",
                    color: filled ? "#0B0E13" : active ? "#fff" : "#5A6371",
                    fontSize: 10,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  {slot.jersey}
                </button>
              );
            })}
          </div>

          {/* Budget bar + captain pills + save */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Budget bar */}
            <div style={{ flex: 1, minWidth: 140 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: "#5A6371", textTransform: "uppercase", letterSpacing: ".1em" }}>
                  Budget
                </span>
                <span className="font-display" style={{ fontSize: 12, color: budgetRemaining < 0 ? "#B23A48" : "#2C9FD4" }}>
                  ${budgetRemaining}m / ${TOTAL_BUDGET}m
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: budgetRemaining < 0 ? "#B23A48" : "#2C9FD4",
                    width: `${Math.max(0, Math.min(100, (budgetUsed / TOTAL_BUDGET) * 100))}%`,
                    transition: "width .2s",
                  }}
                />
              </div>
            </div>

            {/* Captain pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="font-display"
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  background: captain ? "rgba(44,159,212,0.15)" : "rgba(255,255,255,0.04)",
                  color: captain ? "#2C9FD4" : "#5A6371",
                  border: captain ? "1px solid rgba(44,159,212,0.3)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                C {captain ? (playerById[captain]?.name.split(" ").pop() ?? "") : "—"}
              </div>
              <div
                className="font-display"
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  background: viceCaptain ? "rgba(44,159,212,0.15)" : "rgba(255,255,255,0.04)",
                  color: viceCaptain ? "#2C9FD4" : "#5A6371",
                  border: viceCaptain ? "1px solid rgba(44,159,212,0.3)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                VC {viceCaptain ? (playerById[viceCaptain]?.name.split(" ").pop() ?? "") : "—"}
              </div>
            </div>

            {/* Save button */}
            <button
              disabled={!canSave}
              onClick={handleSave}
              className="font-display uppercase shrink-0"
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                fontSize: 12,
                letterSpacing: ".06em",
                background: canSave ? "#2C9FD4" : "#1a1f28",
                color: canSave ? "#0B0E13" : "#3a3f48",
                border: "none",
                cursor: canSave ? "pointer" : "not-allowed",
                fontWeight: 900,
              }}
            >
              {saving ? "Saving…" : isLocked ? "Locked" : "Save Squad"}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          key={toastKey.current}
          message={toast}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
