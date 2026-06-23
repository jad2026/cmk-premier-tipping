"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { triggerWelcomeEmail } from "./actions";
import { autoEnrollCurrentCompetition } from "@/app/competition-actions";

export default function SignupPage() {
  const supabase = createClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file.");
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedTeamName = teamName.trim();

    // Case-insensitive duplicate team name check
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("display_name", trimmedTeamName)
      .limit(1);

    if (existing && existing.length > 0) {
      setError("That team name is already taken. Please choose another.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: trimmedTeamName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    if (data.user) {
      const userId = data.user.id;

      // Upload avatar if selected
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() ?? "jpg";
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
          avatarUrl = `${publicUrl}?t=${Date.now()}`;
        }
      }

      await supabase.from("profiles").upsert(
        {
          id: userId,
          display_name: trimmedTeamName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        },
        { onConflict: "id" }
      );

      // Auto-enroll in current competition + fire welcome email in background
      autoEnrollCurrentCompetition(userId).catch(
        (err) => console.error("[signup] auto-enroll failed:", err)
      );
      triggerWelcomeEmail(email, firstName.trim(), trimmedTeamName).catch(
        (err) => console.error("[signup] welcome email failed:", err)
      );
    }

    setLoading(false);
    window.location.href = "/tips";
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16">
      <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
        <span className="text-3xl block mb-2 select-none">🏉</span>
        <h1 className="text-xl font-bold text-white tracking-tight">Club Rugby Tipping</h1>
        <p className="text-blue-200/70 text-xs mt-1 tracking-wide uppercase font-medium">Create your account</p>
      </div>

      <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-7">
        {/* ── Avatar picker ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center mb-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group focus:outline-none"
            aria-label="Upload profile photo"
          >
            {/* Circle */}
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300 group-hover:border-brand transition-colors bg-gray-50 flex items-center justify-center">
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Your photo"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-10 h-10 text-gray-300 group-hover:text-brand/50 transition-colors" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="16" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M6 34c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>

            {/* Camera badge */}
            <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand group-hover:bg-brand-light transition-colors border-2 border-white flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H10L11.5 4H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5L6 2Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
                <circle cx="8" cy="8.5" r="2.25" stroke="currentColor" strokeWidth="1.25" />
              </svg>
            </span>
          </button>

          <p className="text-[11px] text-gray-400 mt-2">
            {avatarPreview ? "Tap to change photo" : "Add a profile photo (optional)"}
          </p>
          {avatarError && <p className="text-xs text-red-500 mt-1">{avatarError}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarPick}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                First Name
              </label>
              <input
                type="text"
                required
                minLength={1}
                maxLength={50}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                required
                minLength={1}
                maxLength={50}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="input"
              />
            </div>
          </div>
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
              Team Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={40}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Your team name on the leaderboard"
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
