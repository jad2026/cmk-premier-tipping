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
        sans: ["var(--font-barlow)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-barlow-condensed)", "var(--font-barlow)", "ui-sans-serif", "sans-serif"],
      },
      colors: {
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
        card:       "0 1px 4px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-md":  "0 3px 10px 0 rgb(0 0 0 / 0.08), 0 1px 3px -1px rgb(0 0 0 / 0.05)",
        "card-lg":  "0 8px 24px 0 rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
