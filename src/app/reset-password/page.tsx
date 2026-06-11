"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // The auth callback already exchanged the recovery code for a session.
  // We just need to confirm a session exists before showing the form.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSessionReady(true);
      } else {
        // No session — the link was invalid, expired, or already used
        setError("This reset link is invalid or has expired. Please request a new one.");
      }
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      // Auto-redirect after a short pause
      setTimeout(() => router.push("/tips"), 2500);
    }
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-16">
        <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
          <span className="text-3xl block mb-2 select-none">✅</span>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Password updated!
          </h1>
        </div>
        <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-8 text-center">
          <p className="text-gray-600 text-sm">
            Your password has been changed. Redirecting you to your tips…
          </p>
          <div className="mt-4 flex justify-center">
            <span className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
          </div>
          <Link href="/tips" className="btn-primary mt-6 w-full">
            Go to Tips now
          </Link>
        </div>
      </div>
    );
  }

  // ── Invalid / expired link ────────────────────────────────────────────────
  if (!sessionReady && error) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-16">
        <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
          <span className="text-3xl block mb-2 select-none">⚠️</span>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Link expired
          </h1>
        </div>
        <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-8 text-center">
          <p className="text-gray-600 text-sm">{error}</p>
          <Link href="/forgot-password" className="btn-primary mt-6 w-full">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading state (checking session) ─────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-16 flex justify-center py-16">
        <span className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16">
      {/* Brand bar */}
      <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
        <span className="text-3xl block mb-2 select-none">🔒</span>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Choose a new password
        </h1>
        <p className="text-blue-200/70 text-xs mt-1 tracking-wide uppercase font-medium">
          Make it a strong one
        </p>
      </div>

      <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              New password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              className={`input ${
                confirm && confirm !== password
                  ? "border-red-300 focus:border-red-400 focus:ring-red-200/50"
                  : confirm && confirm === password
                  ? "border-green-300 focus:border-green-400 focus:ring-green-200/50"
                  : ""
              }`}
            />
            {confirm && confirm !== password && (
              <p className="text-xs text-red-500 mt-1.5">Passwords don&apos;t match</p>
            )}
            {confirm && confirm === password && (
              <p className="text-xs text-green-600 mt-1.5">✓ Passwords match</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || password !== confirm}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
