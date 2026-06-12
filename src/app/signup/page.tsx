"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Save display name to profiles immediately (no email confirmation step)
    if (data.user) {
      await supabase.from("profiles").upsert(
        { id: data.user.id, display_name: displayName.trim() },
        { onConflict: "id" }
      );
    }
    setLoading(false);
    window.location.href = "/tips";
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-16">
        <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
          <span className="text-3xl block mb-2 select-none">✉️</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Check your email</h1>
        </div>
        <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-8 text-center">
          <p className="text-gray-600 text-sm leading-relaxed">
            We sent a confirmation link to{" "}
            <strong className="text-gray-800">{email}</strong>.<br />
            Click it to activate your account and start tipping!
          </p>
          <Link href="/login" className="btn-primary mt-6 w-full">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16">
      {/* Brand bar */}
      <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
        <span className="text-3xl block mb-2 select-none">🏉</span>
        <h1 className="text-xl font-bold text-white tracking-tight">Club Rugby Tipping</h1>
        <p className="text-blue-200/70 text-xs mt-1 tracking-wide uppercase font-medium">Create your account</p>
      </div>

      <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Name shown on the leaderboard"
              className="input"
            />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-brand font-semibold hover:text-brand-light transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
