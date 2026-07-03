"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

type CompTeam = { id: string; name: string; short_name: string; colour: string; logo_url: string | null };

type Props = {
  userId: string;
  email: string;
  initialFirstName: string;
  initialLastName: string;
  initialDisplayName: string | null;
  initialAvatarUrl: string | null;
  showSupportedTeam: boolean;
  initialSupportedTeamId: string | null;
  teams: CompTeam[];
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E4E1D8",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 15,
  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
  background: "#fff",
  color: "#11151C",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "#8B8676",
  marginBottom: 6,
};

export default function ProfileForm({
  userId,
  email,
  initialFirstName,
  initialLastName,
  initialDisplayName,
  initialAvatarUrl,
  showSupportedTeam,
  initialSupportedTeamId,
  teams,
}: Props) {
  const supabase = createClient();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [teamName, setTeamName] = useState("");
  const [existingTeamName, setExistingTeamName] = useState<string | null>(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);

  const [supportedTeamId, setSupportedTeamId] = useState<string | null>(initialSupportedTeamId);
  const [savingSupportedTeam, setSavingSupportedTeam] = useState(false);
  const [supportedTeamSuccess, setSupportedTeamSuccess] = useState(false);
  const [supportedTeamError, setSupportedTeamError] = useState<string | null>(null);

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
    if (!file) return;

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
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;

    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, avatar_url: urlWithBust }, { onConflict: "id" });

    if (profErr) {
      setAvatarError(profErr.message);
    } else {
      setAvatarUrl(urlWithBust);
      setAvatarSuccess(true);
    }
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSaveSupportedTeam(teamId: string | null) {
    setSupportedTeamId(teamId);
    setSavingSupportedTeam(true);
    setSupportedTeamError(null);
    setSupportedTeamSuccess(false);

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, supported_team_id: teamId }, { onConflict: "id" });

    if (error) setSupportedTeamError(error.message);
    else setSupportedTeamSuccess(true);
    setSavingSupportedTeam(false);
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 700, padding: "30px 32px 70px" }}>

      {/* ── Profile Photo ──────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "28px 32px", marginBottom: 20 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <span className="shrink-0" style={{ width: 4, height: 20, borderRadius: 2, background: "var(--accent)" }} />
          <h2 className="font-display uppercase" style={{ fontSize: 16, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>
            Profile Photo
          </h2>
        </div>

        <div className="flex items-center" style={{ gap: 20 }}>
          <Avatar url={avatarUrl} name={displayName} size={64} />
          <div style={{ flex: 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "1px solid #E4E1D8",
                borderRadius: 10,
                padding: "10px 20px",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: ".04em",
                background: "transparent",
                color: "#11151C",
                cursor: uploadingAvatar ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "border-color .15s",
              }}
            >
              {uploadingAvatar ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid #E4E1D8",
                      borderTopColor: "var(--accent)",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Uploading…
                </>
              ) : avatarUrl ? "Change Photo" : "Upload Photo"}
            </button>
            <p style={{ fontSize: 12, color: "#8B8676", marginTop: 8 }}>JPG, PNG or GIF · max 2 MB</p>
          </div>
        </div>

        {avatarError && (
          <div style={{ marginTop: 16, borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
            <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{avatarError}</p>
          </div>
        )}
        {avatarSuccess && (
          <div style={{ marginTop: 16, borderRadius: 12, background: "rgba(31,158,90,.06)", border: "1px solid rgba(31,158,90,.15)", padding: "12px 16px" }}>
            <p style={{ fontSize: 14, color: "#1F9E5A", margin: 0 }}>Photo updated!</p>
          </div>
        )}
      </div>

      {/* ── Personal Details ───────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "28px 32px", marginBottom: 20 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <span className="shrink-0" style={{ width: 4, height: 20, borderRadius: 2, background: "var(--accent)" }} />
          <h2 className="font-display uppercase" style={{ fontSize: 16, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>
            Personal Details
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid grid-cols-2" style={{ gap: 12 }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input
                type="text"
                minLength={1}
                maxLength={50}
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setProfileSuccess(false); }}
                placeholder="Jane"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                minLength={1}
                maxLength={50}
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setProfileSuccess(false); }}
                placeholder="Smith"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <div style={{ ...inputStyle, background: "#F9F8F5", color: "#8B8676", cursor: "default", userSelect: "none" }}>{email}</div>
          </div>

          {profileError && (
            <div style={{ borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
              <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{profileError}</p>
            </div>
          )}
          {profileSuccess && (
            <div style={{ borderRadius: 12, background: "rgba(31,158,90,.06)", border: "1px solid rgba(31,158,90,.15)", padding: "12px 16px" }}>
              <p style={{ fontSize: 14, color: "#1F9E5A", margin: 0 }}>Changes saved successfully.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            style={{
              width: "100%",
              background: "var(--accent)",
              color: "var(--accent-text, #11151C)",
              padding: "14px 28px",
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: ".04em",
              border: "none",
              cursor: savingProfile ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: savingProfile ? 0.7 : 1,
              transition: "opacity .15s",
            }}
          >
            {savingProfile ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Saving…
              </>
            ) : "Save Changes"}
          </button>
        </form>
      </div>

      {/* ── Team Name ──────────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "28px 32px" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <span className="shrink-0" style={{ width: 4, height: 20, borderRadius: 2, background: "var(--accent)" }} />
          <h2 className="font-display uppercase" style={{ fontSize: 16, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>
            Team Name
          </h2>
        </div>

        {existingTeamName ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...inputStyle, background: "#F9F8F5", color: "#5A6371", cursor: "default", userSelect: "none" }}>{existingTeamName}</div>
            <p style={{ fontSize: 12, color: "#8B8676" }}>This cannot be changed. Contact an admin if you need to update it.</p>
          </div>
        ) : (
          <form onSubmit={handleSaveTeamName} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Team Name</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={40}
                value={teamName}
                onChange={(e) => { setTeamName(e.target.value); setTeamSuccess(false); }}
                placeholder="Your team name on the leaderboard"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div style={{ borderRadius: 12, background: "rgba(217,165,33,.06)", border: "1px solid rgba(217,165,33,.2)", padding: "12px 16px" }}>
              <p style={{ fontSize: 14, color: "#8B6F1A", margin: 0 }}>⚠ Once saved, your team name cannot be changed.</p>
            </div>

            {teamError && (
              <div style={{ borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
                <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{teamError}</p>
              </div>
            )}
            {teamSuccess && (
              <div style={{ borderRadius: 12, background: "rgba(31,158,90,.06)", border: "1px solid rgba(31,158,90,.15)", padding: "12px 16px" }}>
                <p style={{ fontSize: 14, color: "#1F9E5A", margin: 0 }}>Team name saved!</p>
              </div>
            )}

            <button
              type="submit"
              disabled={savingTeam}
              style={{
                width: "100%",
                background: "var(--accent)",
                color: "var(--accent-text, #11151C)",
                padding: "14px 28px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: ".04em",
                border: "none",
                cursor: savingTeam ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: savingTeam ? 0.7 : 1,
                transition: "opacity .15s",
              }}
            >
              {savingTeam ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Saving…
                </>
              ) : "Save Team Name"}
            </button>
          </form>
        )}
      </div>

      {/* ── Supported Team ────────────────────────────────────────── */}
      {showSupportedTeam && teams.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "28px 32px", marginTop: 20 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
            <span className="shrink-0" style={{ width: 4, height: 20, borderRadius: 2, background: "var(--accent)" }} />
            <h2 className="font-display uppercase" style={{ fontSize: 16, letterSpacing: ".02em", color: "#11151C", margin: 0 }}>
              Supported Team
            </h2>
          </div>

          <p style={{ fontSize: 13, color: "#8B8676", marginBottom: 16 }}>
            {supportedTeamId ? "Tap a different team to change, or clear your selection." : "Which team do you support?"}
          </p>

          <div className="flex flex-wrap" style={{ gap: 8, opacity: savingSupportedTeam ? 0.6 : 1, pointerEvents: savingSupportedTeam ? "none" : "auto" }}>
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSaveSupportedTeam(supportedTeamId === t.id ? null : t.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: supportedTeamId === t.id ? "2px solid var(--accent)" : "1px solid #E4E1D8",
                  background: supportedTeamId === t.id ? "var(--accent-wash, rgba(217,165,33,.10))" : "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: supportedTeamId === t.id ? 700 : 500,
                  color: "#11151C",
                  transition: "all .15s",
                }}
              >
                {t.logo_url ? (
                  <Image src={t.logo_url} alt={t.name} width={20} height={20} style={{ borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: t.colour, display: "inline-block", flexShrink: 0 }} />
                )}
                {t.name}
              </button>
            ))}
            {supportedTeamId !== null && (
              <button
                type="button"
                onClick={() => handleSaveSupportedTeam(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid #E4E1D8",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#8B8676",
                  transition: "all .15s",
                }}
              >
                Clear selection
              </button>
            )}
          </div>

          {supportedTeamError && (
            <div style={{ marginTop: 16, borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
              <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{supportedTeamError}</p>
            </div>
          )}
          {supportedTeamSuccess && (
            <div style={{ marginTop: 16, borderRadius: 12, background: "rgba(31,158,90,.06)", border: "1px solid rgba(31,158,90,.15)", padding: "12px 16px" }}>
              <p style={{ fontSize: 14, color: "#1F9E5A", margin: 0 }}>Supported team updated!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
