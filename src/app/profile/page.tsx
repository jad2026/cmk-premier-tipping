"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [existingTeamName, setExistingTeamName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [teamSuccess, setTeamSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setEmail(user.email ?? "");
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, display_name")
        .eq("id", user.id)
        .single();

      setFirstName(profile?.first_name ?? "");
      setLastName(profile?.last_name ?? "");
      setExistingTeamName(profile?.display_name?.trim() || null);
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    const { error } = await supabase
      .from("profiles")
      .upsert(
        { id: userId, first_name: firstName.trim(), last_name: lastName.trim() },
        { onConflict: "id" }
      );

    if (error) {
      setProfileError(error.message);
    } else {
      setProfileSuccess(true);
    }
    setSavingProfile(false);
  }

  async function handleSaveTeamName(e: React.FormEvent) {
    e.preventDefault();
    setSavingTeam(true);
    setTeamError(null);
    setTeamSuccess(false);

    const trimmed = teamName.trim();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("display_name", trimmed)
      .limit(1);

    if (existing && existing.length > 0) {
      setTeamError("That team name is already taken. Please choose another.");
      setSavingTeam(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: trimmed }, { onConflict: "id" });

    if (error) {
      setTeamError(error.message);
    } else {
      setExistingTeamName(trimmed);
      setTeamSuccess(true);
    }
    setSavingTeam(false);
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-10 sm:mt-16">
        <div className="card px-8 py-10 text-center text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-10 sm:mt-16 space-y-6">
      <div className="bg-brand rounded-t-2xl px-8 py-6 text-center">
        <span className="text-3xl block mb-2 select-none">🏉</span>
        <h1 className="text-xl font-bold text-white tracking-tight">My Profile</h1>
        <p className="text-blue-200/70 text-xs mt-1 tracking-wide uppercase font-medium">Account details</p>
      </div>

      {/* ── Personal details ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card-md px-8 py-7">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Personal Details</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                First Name
              </label>
              <input
                type="text"
                minLength={1}
                maxLength={50}
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setProfileSuccess(false); }}
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
                minLength={1}
                maxLength={50}
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setProfileSuccess(false); }}
                placeholder="Smith"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="input bg-gray-50 text-gray-500 cursor-default select-none">{email}</div>
          </div>

          {profileError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{profileError}</p>
            </div>
          )}
          {profileSuccess && (
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-sm text-green-700">Changes saved successfully.</p>
            </div>
          )}

          <button type="submit" disabled={savingProfile} className="btn-primary w-full">
            {savingProfile ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : "Save Changes"}
          </button>
        </form>
      </div>

      {/* ── Team name ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card-md px-8 py-7">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Team Name</h2>
        </div>

        {existingTeamName ? (
          <div className="space-y-2">
            <div className="input bg-gray-50 text-gray-700 cursor-default select-none">{existingTeamName}</div>
            <p className="text-xs text-gray-400">This cannot be changed. Contact an admin if you need to update it.</p>
          </div>
        ) : (
          <form onSubmit={handleSaveTeamName} className="space-y-4">
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
                onChange={(e) => { setTeamName(e.target.value); setTeamSuccess(false); }}
                placeholder="Your team name on the leaderboard"
                className="input"
              />
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-700">⚠ Once saved, your team name cannot be changed.</p>
            </div>
            {teamError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-600">{teamError}</p>
              </div>
            )}
            {teamSuccess && (
              <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                <p className="text-sm text-green-700">Team name saved!</p>
              </div>
            )}
            <button type="submit" disabled={savingTeam} className="btn-primary w-full">
              {savingTeam ? (
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
  );
}
