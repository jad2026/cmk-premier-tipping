"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { joinSelectedComps } from "./actions";

export type SiteCard = {
  id: string;
  slug: string;
  display_name: string;
  name: string;
  short_label: string | null;
  logo_url: string | null;
  site_url: string | null;
  accent_color: string | null;
  surface_color: string | null;
};

export default function CompPicker({
  sites,
  preselectedSlug,
}: {
  sites: SiteCard[];
  preselectedSlug?: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (preselectedSlug) {
      const match = sites.find((s) => s.slug === preselectedSlug);
      if (match) initial.add(match.id);
    }
    return initial;
  });
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleContinue() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);

    startTransition(async () => {
      await joinSelectedComps(ids);

      if (ids.length >= 2) {
        window.location.href = "/hub";
      } else {
        window.location.href = `/api/hub/switch?comp=${ids[0]}`;
      }
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0E13",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            style={{
              fontFamily: "var(--font-display, 'Archivo', sans-serif)",
              fontSize: 26,
              fontWeight: 800,
              color: "#FFFFFF",
              margin: "0 0 8px",
              lineHeight: 1.2,
              textTransform: "uppercase",
              letterSpacing: ".02em",
            }}
          >
            Which competitions do you want to tip on?
          </h1>
          <p style={{ fontSize: 14, color: "#8B8E94", margin: 0 }}>
            You can change this later.
          </p>
        </div>

        {/* Cards */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {sites.map((site) => {
            const isSelected = selected.has(site.id);
            const accent = site.accent_color || "#D9A521";
            const surface = site.surface_color || "#161A22";
            const initial = (site.display_name || site.name).charAt(0).toUpperCase();

            return (
              <button
                key={site.id}
                type="button"
                onClick={() => toggle(site.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  padding: "16px 18px",
                  background: surface,
                  border: isSelected
                    ? `2px solid ${accent}`
                    : "2px solid transparent",
                  borderLeft: `4px solid ${accent}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "border-color .15s, background .15s",
                  textAlign: "left",
                }}
              >
                {/* Logo or letter fallback */}
                {site.logo_url ? (
                  <Image
                    src={site.logo_url}
                    alt={site.display_name || site.name}
                    width={40}
                    height={40}
                    unoptimized
                    style={{
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontWeight: 800,
                      fontSize: 18,
                      color: "#0B0E13",
                    }}
                  >
                    {initial}
                  </div>
                )}

                {/* Name */}
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#FFFFFF",
                  }}
                >
                  {site.display_name || site.name}
                </span>

                {/* Checkbox */}
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: isSelected
                      ? `2px solid ${accent}`
                      : "2px solid #4A4D55",
                    background: isSelected ? accent : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all .15s",
                  }}
                >
                  {isSelected && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M3 7.5L5.5 10L11 4"
                        stroke="#0B0E13"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={selected.size === 0 || isPending}
          style={{
            width: "100%",
            marginTop: 28,
            padding: "16px 28px",
            borderRadius: 12,
            border: "none",
            background:
              selected.size === 0 ? "#2A2D35" : "var(--accent, #D9A521)",
            color:
              selected.size === 0
                ? "#6B6E76"
                : "var(--accent-text, #11151C)",
            fontSize: 16,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: ".04em",
            cursor:
              selected.size === 0 || isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
            transition: "background .15s, color .15s, opacity .15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {isPending ? (
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
              Joining...
            </>
          ) : (
            "Continue"
          )}
        </button>
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
