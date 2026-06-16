"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [existingTeamName, setExistingTeamName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [teamSuccess, setTeamSuccess] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setEmail(user.email ?? "");
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, display_name, avatar_url")
        .eq("id", user.id)
        .single();

      setFirstName(profile?.first_name ?? "");
      setLastName(profile?.last_name ?? "");
      setExistingTeamName(profile?.display_name?.trim() || null);
      setAvatarUrl(profile?.avatar_url ?? null);
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

    if (error) setProfileError(error.message);
    else setProfileSuccess(true);
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

    if (error) setTeamError(error.message);
    else { setExistingTeamName(trimmed); setTeamSuccess(true); }
    setSavingTeam(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file.");
      return;
    }

    setUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(false);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setAvatarError(uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    // Bust cache with a timestamp param
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, avatar_url: urlWithBust }, { onConflict: "id" });

    if (profileError) {
      setAvatarError(profileError.message);
    } else {
      setAvatarUrl(urlWithBust);
      setAvatarSuccess(true);
    }
    setUploadingAvatar(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      {/* ── Header with avatar ───────────────────────────────────────────────── */}
      <div className="bg-brand rounded-t-2xl px-8 py-8 text-center">
        <div className="flex justify-center mb-3">
          <Avatar url={avatarUrl} name={displayName} size={72} />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">My Profile</h1>
        <p className="text-blue-200/70 text-xs mt-1 tracking-wide uppercase font-medium">Account details</p>
      </div>

      {/* ── Photo upload ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card-md px-8 py-7">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-1 h-5 rounded-full bg-brand-gold shrink-0" />
          <h2 className="text-sm font-bold text-brand uppercase tracking-wide">Profile Photo</h2>
        </div>

        <div className="flex items-center gap-5">
          <Avatar url={avatarUrl} name={displayName} size={64} />
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingAvatar ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                  Uploading…
                </>
              ) : avatarUrl ? "Change Photo" : "Upload Photo"}
            </button>
            <p className="text-xs text-gray-400 mt-2">JPG, PNG or GIF · max 2 MB</p>
          </div>
        </div>

        {avatarError && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{avatarError}</p>
          </div>
        )}
        {avatarSuccess && (
          <div className="mt-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
            <p className="text-sm text-green-700">Photo updated!</p>
          </div>
        )}
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
