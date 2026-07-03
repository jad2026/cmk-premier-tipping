"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

function useSiteName() {
  const [name, setName] = useState("Club Rugby Tipping");
  useEffect(() => {
    if (document.documentElement.classList.contains("theme-npc")) setName("NPC Tipping");
  }, []);
  return name;
}
import { triggerWelcomeEmail, getSignupConfig } from "./actions";
import { autoEnrollCurrentCompetition } from "@/app/competition-actions";

type CompTeam = { id: string; name: string; short_name: string; colour: string; logo_url: string | null };

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

export default function SignupPage() {
  const supabase = createClient();
  const siteName = useSiteName();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [supportedTeamId, setSupportedTeamId] = useState<string | null>(null);
  const [showSupportedTeam, setShowSupportedTeam] = useState(false);
  const [compTeams, setCompTeams] = useState<CompTeam[]>([]);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSignupConfig().then(({ showSupportedTeam: show, teams }) => {
      setShowSupportedTeam(show);
      setCompTeams(teams);
    });
  }, []);

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
          ...(showSupportedTeam ? { supported_team_id: supportedTeamId } : {}),
        },
        { onConflict: "id" }
      );

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
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", background: "#F2F0EA", minHeight: "100vh" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: "40px 36px" }}>
          {/* Wordmark */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="9" fill="var(--accent)" />
                <path d="M7 9.5L8.5 11L11.5 7.5" stroke="var(--accent-text, #11151C)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-display" style={{ fontSize: 15, letterSpacing: ".06em", textTransform: "uppercase", color: "#11151C" }}>
                {siteName}
              </span>
            </div>
            <h1
              className="font-display uppercase"
              style={{ fontSize: 32, lineHeight: 0.9, margin: 0, color: "#11151C" }}
            >
              Sign Up<span style={{ color: "var(--accent)" }}>.</span>
            </h1>
          </div>

          {/* Avatar picker */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <div style={{
                width: 96, height: 96, borderRadius: "50%", overflow: "hidden",
                border: "2px dashed #E4E1D8", background: "#F9F8F5",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="Your photo" width={96} height={96} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="16" r="7" stroke="#C9C5B8" strokeWidth="2" />
                    <path d="M6 34c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#C9C5B8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span style={{
                position: "absolute", bottom: 0, right: 0,
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--accent)", border: "2px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,.12)",
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 2H10L11.5 4H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5L6 2Z" stroke="var(--accent-text, #11151C)" strokeWidth="1.25" strokeLinejoin="round" />
                  <circle cx="8" cy="8.5" r="2.25" stroke="var(--accent-text, #11151C)" strokeWidth="1.25" />
                </svg>
              </span>
            </button>
            <p style={{ fontSize: 11, color: "#8B8676", marginTop: 8 }}>
              {avatarPreview ? "Tap to change photo" : "Add a profile photo (optional)"}
            </p>
            {avatarError && <p style={{ fontSize: 12, color: "#B23A48", marginTop: 4 }}>{avatarError}</p>}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid grid-cols-2" style={{ gap: 12 }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input type="text" required minLength={1} maxLength={50} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input type="text" required minLength={1} maxLength={50} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              <label style={labelStyle}>Team Name</label>
              <input type="text" required minLength={2} maxLength={40} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Your team name on the leaderboard" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {showSupportedTeam && compTeams.length > 0 && (
              <div>
                <label style={labelStyle}>Which team do you support? (optional)</label>
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  {compTeams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSupportedTeamId(supportedTeamId === t.id ? null : t.id)}
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
                  <button
                    type="button"
                    onClick={() => setSupportedTeamId(null)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: supportedTeamId === null ? "2px solid var(--accent)" : "1px solid #E4E1D8",
                      background: supportedTeamId === null ? "var(--accent-wash, rgba(217,165,33,.10))" : "#fff",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: supportedTeamId === null ? 700 : 500,
                      color: "#8B8676",
                      transition: "all .15s",
                    }}
                  >
                    No team
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div style={{ borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
                <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
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
                cursor: loading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loading ? 0.7 : 1,
                transition: "opacity .15s",
                marginTop: 4,
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  Creating account…
                </>
              ) : "Create Account"}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "#8B8676" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
