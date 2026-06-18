import type { Config } from "tailwindcss";
import tokens from "./design-tokens.json";

/**
 * Tailwind config — importe les design tokens (couleurs des thèmes + surfaces)
 * depuis design-tokens.json (dérivé de vocabulary.yaml). Source de vérité couleurs.
 */

// Map { THEME_CODE: color } pour exposer p.ex. `bg-theme-PRIVACY_DATA` via CSS var.
const themeColorVars = Object.fromEntries(
  tokens.themes.map((t) => [t.code, t.color]),
);

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces pilotées par CSS variables (bascule clair/sombre via classe `.dark`).
        bg: "rgb(var(--surface-bg) / <alpha-value>)",
        elevated: "rgb(var(--surface-bg-elevated) / <alpha-value>)",
        panel: "rgb(var(--surface-panel) / <alpha-value>)",
        "panel-muted": "rgb(var(--surface-panel-muted) / <alpha-value>)",
        line: "rgb(var(--surface-border) / <alpha-value>)",
        ink: "rgb(var(--surface-text) / <alpha-value>)",
        "ink-muted": "rgb(var(--surface-text-muted) / <alpha-value>)",
        accent: "rgb(var(--surface-accent) / <alpha-value>)",
        "accent-fg": "rgb(var(--surface-on-accent) / <alpha-value>)",
        reading: "rgb(var(--surface-reading) / <alpha-value>)",
        // Couleurs de thème de clause, accessibles en `text-theme-META`, etc.
        theme: themeColorVars,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        reading: ["var(--font-reading)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        // Colonne de lecture ~70ch (navigation.md, F6 anti-fatigue).
        reading: "70ch",
      },
      lineHeight: {
        reading: "1.7",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
