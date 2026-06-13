"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileData = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, display_name")
        .eq("id", user.id)
        .single();

      setProfile(data ?? { first_name: null, last_name: null, display_name: null });
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleSaveTeamName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const trimmed = teamName.trim();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("display_name", trimmed)
      .limit(1);

    if (existing && existing.length > 0) {
      setError("That team name is already taken. Please choose another.");
      setSaving(false);
      return;
    }

    const { error: saveErr } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: trimmed }, { onConflict: "id" });

    if (saveErr) {
      setError(saveErr.message);
    } else {
      setProfile((p) => p ? { ...p, display_name: trimmed } : p);
      setSuccess(true);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-16">
        <div className="card px-8 py-10 text-center text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16">
      <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
        <span className="text-3xl block mb-2 select-none">🏉</span>
        <h1 className="text-xl font-bold text-white tracking-tight">My Profile</h1>
        <p className="text-blue-200/70 text-xs mt-1 tracking-wide uppercase font-medium">Account details</p>
      </div>

      <div className="bg-white rounded-b-2xl shadow-card-md px-8 py-7 space-y-5">

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">First Name</p>
            <div className="input bg-gray-50 text-gray-700 cursor-default">
              {profile?.first_name || <span className="text-gray-400">—</span>}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Last Name</p>
            <div className="input bg-gray-50 text-gray-700 cursor-default">
              {profile?.last_name || <span className="text-gray-400">—</span>}
            </div>
          </div>
        </div>

        {/* Email */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Email</p>
          <div className="input bg-gray-50 text-gray-700 cursor-default">{email}</div>
        </div>

        {/* Team Name */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Team Name</p>
          {profile?.display_name ? (
            <>
              <div className="input bg-gray-50 text-gray-700 cursor-default">{profile.display_name}</div>
              <p className="mt-1.5 text-xs text-gray-400">Your team name cannot be changed. Contact an admin if needed.</p>
            </>
          ) : (
            <form onSubmit={handleSaveTeamName} className="space-y-3">
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
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {success && (
                <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                  <p className="text-sm text-green-700">Team name saved!</p>
                </div>
              )}
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : "Save Team Name"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
