"use client";

import { useEffect, useState } from "react";

type SendResult = { sent: number; failed: number; total: number; removed?: number };

export default function NotificationsPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/tips");

  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");

  async function loadCount() {
    try {
      const res = await fetch("/api/admin/push-send");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load subscriber count");
      setSubscribers(data.subscribers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscriber count");
    }
  }

  useEffect(() => {
    loadCount();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    const audience =
      subscribers === null
        ? "all subscribers"
        : `${subscribers} subscriber${subscribers === 1 ? "" : "s"}`;
    if (!confirm(`Send to ${audience}?`)) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/push-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send notification");
      setResult(data);
      // Stale endpoints get pruned during a send, so the count may have moved.
      loadCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      {/* ── Compose ──────────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">
          Send Push Notification
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              className="input"
              required
              maxLength={80}
              placeholder="Round 1 is live"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Body
            </label>
            <textarea
              className="input"
              rows={3}
              maxLength={200}
              placeholder="Make your picks for Round 1 now"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Opens
            </label>
            <input
              className="input"
              placeholder="/tips"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Path opened when the notification is tapped.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && (
            <p className="text-sm text-green-700">
              Sent to {result.sent} of {result.total}.
              {result.failed > 0 && ` ${result.failed} failed.`}
              {result.removed ? ` ${result.removed} stale subscription${result.removed === 1 ? "" : "s"} removed.` : ""}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={sending || !title.trim() || subscribers === 0}
          >
            {sending ? "Sending…" : "Send Push Notification"}
          </button>
        </form>
      </div>

      {/* ── Audience ─────────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-brand uppercase tracking-wide mb-4">Audience</h2>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-800">
            {subscribers === null ? "—" : subscribers}
          </span>
          <span className="text-sm text-gray-500">
            subscriber{subscribers === 1 ? "" : "s"}
          </span>
        </div>

        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          Everyone who has enabled notifications for this competition. Sends go out
          immediately — there is no undo.
        </p>
      </div>
    </div>
  );
}
