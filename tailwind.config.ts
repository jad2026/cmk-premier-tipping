import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        display: ["var(--font-archivo-black)", "var(--font-archivo)", "system-ui", "sans-serif"],
        // Keep legacy aliases so existing code doesn't break
        heading: ["var(--font-archivo-black)", "var(--font-archivo)", "system-ui", "sans-serif"],
      },
      colors: {
        // Accent system (driven by CSS variables)
        accent: {
          DEFAULT: "var(--accent)",
          text: "var(--accent-text)",
          wash: "var(--accent-wash)",
        },
        // Matchday design tokens
        ink: "#0B0E13",
        "panel-dark": "#0D1016",
        "panel-dark-2": "#161B24",
        canvas: "#F2F0EA",
        "card-subtle": "#FAF9F5",
        "card-subtle-2": "#F4F2EC",
        "md-border": "#E4E1D8",
        "md-border-row": "#EFEDE6",
        "md-border-canvas": "#DCD9CF",
        "md-text": "#11151C",
        "md-text-secondary": "#5A6371",
        "md-text-muted": "#8B8676",
        "win-green": "#1F9E5A",
        "live-green": "#2CC36B",
        "loss-red": "#B23A48",
        "relegation": "#D98C8C",
        // Legacy brand tokens (still used by existing page bodies)
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          dark:    "rgb(var(--brand-dark) / <alpha-value>)",
          light:   "rgb(var(--brand-light) / <alpha-value>)",
          muted:   "rgb(var(--brand-muted) / <alpha-value>)",
          gold:    "rgb(var(--brand-gold) / <alpha-value>)",
          "gold-light": "rgb(var(--brand-gold-light) / <alpha-value>)",
          "gold-dark":  "rgb(var(--brand-gold-dark) / <alpha-value>)",
        },
      },
      backgroundImage: {
        "hero-pattern":
          "repeating-linear-gradient(135deg, transparent 0px, transparent 24px, rgba(255,255,255,0.04) 24px, rgba(255,255,255,0.04) 25px), repeating-linear-gradient(45deg, transparent 0px, transparent 24px, rgba(255,255,255,0.04) 24px, rgba(255,255,255,0.04) 25px)",
      },
      boxShadow: {
        card:       "0 1px 2px rgba(17,21,28,.04)",
        "card-md":  "0 3px 10px 0 rgb(0 0 0 / 0.08), 0 1px 3px -1px rgb(0 0 0 / 0.05)",
        "card-lg":  "0 8px 24px 0 rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "card": "18px",
      },
      maxWidth: {
        content: "1200px",
        "content-inner": "1100px",
      },
    },
  },
  plugins: [],
};

export default config;
