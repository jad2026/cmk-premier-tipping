"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordToggle from "@/components/PasswordToggle";

function useSiteName() {
  const [name, setName] = useState("Club Rugby Tipping");
  useEffect(() => {
    if (document.documentElement.classList.contains("theme-npc")) setName("Club Rugby Tipping");
  }, []);
  return name;
}
import { triggerWelcomeEmail, getSignupConfig, joinLeagueByCode, checkTeamNameAvailable } from "./actions";
import { autoEnrollCurrentCompetition } from "@/app/competition-actions";

const MIN_PASSWORD_LENGTH = 8;

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

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "#B23A48",
  boxShadow: "0 0 0 2px rgba(178,58,72,.15)",
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

/* ── OAuth (Google / Apple) ── */
type OAuthProvider = "google" | "apple";

const oauthButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #E4E1D8",
  background: "#fff",
  color: "#11151C",
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "var(--font-archivo), 'Archivo', sans-serif",
  cursor: "pointer",
  transition: "border-color .15s, background .15s, opacity .15s",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.73c-.02-2.36 1.93-3.5 2.02-3.55-1.1-1.61-2.81-1.83-3.42-1.85-1.45-.15-2.84.86-3.58.86-.74 0-1.88-.84-3.09-.82-1.59.02-3.05.93-3.87 2.35-1.65 2.86-.42 7.1 1.19 9.42.79 1.14 1.72 2.42 2.95 2.37 1.19-.05 1.64-.77 3.07-.77s1.84.77 3.09.75c1.28-.02 2.09-1.16 2.87-2.3.9-1.32 1.28-2.6 1.3-2.66-.03-.01-2.5-.96-2.53-3.8zM14.02 5.8c.65-.79 1.09-1.89.97-2.99-.94.04-2.08.63-2.75 1.42-.6.7-1.13 1.82-.99 2.89 1.05.08 2.12-.53 2.77-1.32z" />
    </svg>
  );
}

/** "Or continue with" divider + Google / Apple sign-in buttons.
 *  Both providers redirect back through /auth/callback, which exchanges the
 *  code for a session and forwards to `next`. */
function OAuthButtons({ next }: { next?: string | null }) {
  const supabase = createClient();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setPending(null);
      setError(error.message);
    }
    // On success the browser navigates away to the provider.
  }

  const hover = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    e.currentTarget.style.borderColor = on ? "#C9C5B8" : "#E4E1D8";
    e.currentTarget.style.background = on ? "#F9F8F5" : "#fff";
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ flex: 1, height: 1, background: "#E4E1D8" }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8B8676" }}>
          Or continue with
        </span>
        <span style={{ flex: 1, height: 1, background: "#E4E1D8" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={() => signInWith("google")}
          disabled={pending !== null}
          style={{ ...oauthButtonStyle, opacity: pending && pending !== "google" ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}
          onMouseEnter={(e) => hover(e, true)}
          onMouseLeave={(e) => hover(e, false)}
        >
          <GoogleIcon />
          {pending === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
        <button
          type="button"
          onClick={() => signInWith("apple")}
          disabled={pending !== null}
          style={{ ...oauthButtonStyle, opacity: pending && pending !== "apple" ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}
          onMouseEnter={(e) => hover(e, true)}
          onMouseLeave={(e) => hover(e, false)}
        >
          <AppleIcon />
          {pending === "apple" ? "Redirecting…" : "Continue with Apple"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
          <p style={{ fontSize: 14, color: "#B23A48", margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  const supabase = createClient();
  const siteName = useSiteName();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const codeParam = searchParams.get("code") ?? "";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState(codeParam);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const teamNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  function scrollToError(ref: React.RefObject<HTMLInputElement | null> | null) {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref?.current?.focus();
  }

  function classifyAuthError(message: string): { field: string; ref: React.RefObject<HTMLInputElement | null> | null; text: string } {
    const lower = message.toLowerCase();
    if (lower.includes("email") || lower.includes("already registered") || lower.includes("already been registered")) {
      return { field: "email", ref: emailRef, text: message };
    }
    if (lower.includes("password") || lower.includes("too short") || lower.includes("at least")) {
      return { field: "password", ref: passwordRef, text: message };
    }
    return { field: "_form", ref: null, text: message };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const trimmedEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      setFieldErrors({ email: "Please enter a valid email address." });
      setLoading(false);
      scrollToError(emailRef);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldErrors({ password: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      setLoading(false);
      scrollToError(passwordRef);
      return;
    }

    const trimmedTeamName = teamName.trim();

    const available = await checkTeamNameAvailable(trimmedTeamName);
    if (!available) {
      setFieldErrors({ teamName: "That team name is already taken. Please choose another." });
      setLoading(false);
      scrollToError(teamNameRef);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
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
      const classified = classifyAuthError(error.message);
      setFieldErrors({ [classified.field]: classified.text });
      setLoading(false);
      scrollToError(classified.ref);
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
      triggerWelcomeEmail(trimmedEmail, firstName.trim(), trimmedTeamName).catch(
        (err) => console.error("[signup] welcome email failed:", err)
      );

      if (inviteCode.trim()) {
        await joinLeagueByCode(inviteCode.trim()).catch(
          (err) => console.error("[signup] league join failed:", err)
        );
      }
    }

    setLoading(false);
    window.location.href = redirectTo || "/thank-you";
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
                <input type="text" name="firstName" autoComplete="given-name" required minLength={1} maxLength={50} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input type="text" name="lastName" autoComplete="family-name" required minLength={1} maxLength={50} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input ref={emailRef} type="email" name="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => { const { email: _, ...rest } = p; return rest; }); }} placeholder="you@example.com"
                aria-invalid={!!fieldErrors.email}
                style={fieldErrors.email ? inputErrorStyle : inputStyle}
                onFocus={(e) => { if (!fieldErrors.email) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; } }}
                onBlur={(e) => { if (!fieldErrors.email) { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; } }}
              />
              {fieldErrors.email && <p style={{ fontSize: 12, color: "#B23A48", margin: "6px 0 0", cursor: "default" }}>{fieldErrors.email}</p>}
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input ref={passwordRef} type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => { const { password: _, ...rest } = p; return rest; }); }} placeholder="Choose a password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby="password-hint"
                  style={{ ...(fieldErrors.password ? inputErrorStyle : inputStyle), paddingRight: 44 }}
                  onFocus={(e) => { if (!fieldErrors.password) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; } }}
                  onBlur={(e) => { if (!fieldErrors.password) { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; } }}
                />
                <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
              {fieldErrors.password ? (
                <p style={{ fontSize: 12, color: "#B23A48", margin: "6px 0 0", cursor: "default" }}>{fieldErrors.password}</p>
              ) : (
                <p id="password-hint" style={{ fontSize: 12, color: "#8B8676", margin: "6px 0 0" }}>At least {MIN_PASSWORD_LENGTH} characters.</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Team Name</label>
              <input ref={teamNameRef} type="text" name="teamName" autoComplete="off" required minLength={2} maxLength={40} value={teamName} onChange={(e) => { setTeamName(e.target.value); setFieldErrors((p) => { const { teamName: _, ...rest } = p; return rest; }); }} placeholder="Your team name on the leaderboard"
                aria-invalid={!!fieldErrors.teamName}
                style={fieldErrors.teamName ? inputErrorStyle : inputStyle}
                onFocus={(e) => { if (!fieldErrors.teamName) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; } }}
                onBlur={(e) => { if (!fieldErrors.teamName) { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; } }}
              />
              {fieldErrors.teamName && <p style={{ fontSize: 12, color: "#B23A48", margin: "6px 0 0", cursor: "default" }}>{fieldErrors.teamName}</p>}
            </div>

            <div>
              <label style={labelStyle}>Invite Code (optional)</label>
              <input
                type="text"
                maxLength={6}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                style={{ ...inputStyle, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: ".1em" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-wash, rgba(217,165,33,.15))"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E4E1D8"; e.currentTarget.style.boxShadow = "none"; }}
                autoComplete="off"
                inputMode="text"
              />
              {inviteCode.trim() && (
                <p style={{ fontSize: 12, color: "#2C9FD4", marginTop: 6, fontWeight: 600 }}>
                  You&apos;ll be added to this league after signing up
                </p>
              )}
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

            {fieldErrors._form && (
              <div style={{ borderRadius: 12, background: "rgba(178,58,72,.06)", border: "1px solid rgba(178,58,72,.15)", padding: "12px 16px" }}>
                <p style={{ fontSize: 14, color: "#B23A48", margin: 0, cursor: "default" }}>{fieldErrors._form}</p>
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

          <OAuthButtons next={redirectTo} />

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
