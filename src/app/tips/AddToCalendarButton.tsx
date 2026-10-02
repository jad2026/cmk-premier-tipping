"use client";

import { useState, useEffect } from "react";
import { isCalendarAvailable, addDeadlinesToCalendar, type DeadlineEvent } from "@/lib/native/calendar";

type Props = {
  deadlines: { gameweekId: string; label: string; deadline: string }[];
  compLabel: string;
  timezone: string;
};

export default function AddToCalendarButton({ deadlines, compLabel, timezone }: Props) {
  const [available, setAvailable] = useState(false);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    isCalendarAvailable().then(setAvailable);
  }, []);

  if (!available) return null;

  const upcoming = deadlines.filter((d) => new Date(d.deadline).getTime() > Date.now());
  if (upcoming.length === 0) return null;

  async function handleAdd() {
    setAdding(true);
    setResult(null);

    const events: DeadlineEvent[] = upcoming.map((d) => ({
      gameweekId: d.gameweekId,
      title: `Tips close – ${d.label} (${compLabel})`,
      startDate: new Date(d.deadline).getTime(),
      alertMinutesBefore: 60,
    }));

    const count = await addDeadlinesToCalendar(events);
    setAdding(false);

    if (count > 0) {
      setResult(`Added ${count} deadline${count > 1 ? "s" : ""} to your calendar`);
    } else {
      setResult("All deadlines already in your calendar");
    }

    setTimeout(() => setResult(null), 4000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        onClick={handleAdd}
        disabled={adding}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.15)",
          background: "rgba(255,255,255,.06)",
          color: "#E6E8EC",
          fontSize: 13,
          fontWeight: 700,
          cursor: adding ? "wait" : "pointer",
          opacity: adding ? 0.6 : 1,
          transition: "opacity .15s, background .15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M5 1.5v3M11 1.5v3M2 7h12" />
        </svg>
        {adding ? "Adding…" : "Add deadlines to calendar"}
      </button>
      {result && (
        <span style={{ fontSize: 12, color: "#1F9E5A", fontWeight: 600 }}>{result}</span>
      )}
    </div>
  );
}
