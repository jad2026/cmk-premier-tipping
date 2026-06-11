"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // After the user clicks the email link, Supabase hits /auth/callback
      // which exchanges the code for a session, then redirects to /reset-password.
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-16">
        <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
          <span className="text-3xl block mb-2 select-none">✉️</span>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Check your email
          </h1>
        </div>
        <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-8 text-center">
          <p className="text-gray-600 text-sm leading-relaxed">
            We sent a password reset link to{" "}
            <strong className="text-gray-800">{email}</strong>.<br />
            Click the link in that email to choose a new password.
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Didn&apos;t receive it? Check your spam folder or{" "}
            <button
              onClick={() => setDone(false)}
              className="text-brand font-semibold hover:text-brand-light transition-colors"
            >
              try again
            </button>
            .
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
        <span className="text-3xl block mb-2 select-none">🔑</span>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Reset your password
        </h1>
        <p className="text-blue-200/70 text-xs mt-1 tracking-wide uppercase font-medium">
          We&apos;ll send you a reset link
        </p>
      </div>

      <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-7">
        <p className="text-sm text-gray-500 mb-5">
          Enter the email address you signed up with and we&apos;ll send you a
          link to reset your password.
        </p>

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
              autoFocus
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
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          Remember it?{" "}
          <Link
            href="/login"
            className="text-brand font-semibold hover:text-brand-light transition-colors"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
