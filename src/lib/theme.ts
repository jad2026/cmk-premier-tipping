import { CMK_COMPETITION_ID, NPC_COMPETITION_ID } from "./competition";

export type AccentName = "Amber" | "Magenta" | "Light Blue" | "Green" | "Chocolate";

type AccentConfig = {
  hex: string;
  text: string;
  wash: string;
};

const ACCENTS: Record<AccentName, AccentConfig> = {
  Amber:        { hex: "#D9A521", text: "#11151C", wash: "rgba(217,165,33,.12)" },
  Magenta:      { hex: "#E6007E", text: "#FFFFFF", wash: "rgba(230,0,126,.06)" },
  "Light Blue": { hex: "#2C9FD4", text: "#FFFFFF", wash: "rgba(44,159,212,.12)" },
  Green:        { hex: "#12A150", text: "#FFFFFF", wash: "rgba(18,161,80,.06)" },
  Chocolate:    { hex: "#7A4B36", text: "#FFFFFF", wash: "rgba(122,75,54,.06)" },
};

export function getAccent(name: AccentName = "Amber"): AccentConfig {
  return ACCENTS[name];
}

// TODO: When competitions carry their own accent preference (e.g. in the
// `competitions` table), look it up here instead of hardcoding.
export function getAccentForCompetition(compId: string): AccentName {
  switch (compId) {
    case CMK_COMPETITION_ID:
      return "Amber";
    case NPC_COMPETITION_ID:
      return "Light Blue";
    default:
      return "Amber";
  }
}

export function getAccentCSSVars(name: AccentName = "Amber"): Record<string, string> {
  const a = getAccent(name);
  return {
    "--accent": a.hex,
    "--accent-text": a.text,
    "--accent-wash": a.wash,
  };
}

function hexToRgba(hex: string, alpha: number): string | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// NPC and CMK keep their hardcoded accents. Any other competition uses its
// own accent_color / accent_text_color from the competitions table when set.
export function getCompetitionAccentCSSVars(
  compId: string,
  accentColor: string | null | undefined,
  accentTextColor: string | null | undefined,
): Record<string, string> {
  const isBuiltIn = compId === NPC_COMPETITION_ID || compId === CMK_COMPETITION_ID;
  const wash = accentColor ? hexToRgba(accentColor, 0.12) : null;
  if (isBuiltIn || !accentColor || !wash) {
    return getAccentCSSVars(getAccentForCompetition(compId));
  }
  return {
    "--accent": accentColor,
    "--accent-text": accentTextColor ?? "#11151C",
    "--accent-wash": wash,
  };
}
