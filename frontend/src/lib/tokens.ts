/**
 * Accès typé aux design tokens (couleurs des thèmes, certitude, injustice).
 * Importe design-tokens.json (dérivé de vocabulary.yaml).
 */
import tokens from "../../design-tokens.json";

export interface ThemeToken {
  code: string;
  label: string;
  color: string;
  order: number;
}

export interface CertaintyToken {
  value: number;
  label: string;
  emoji: string;
  shortcut: string;
  color: string;
}

export interface UnfairnessCategoryToken {
  code: string;
  label: string;
  color: string;
}

export interface UnfairnessLevelToken {
  value: number;
  label: string;
  intensity: number;
}

export const THEMES = tokens.themes as ThemeToken[];
export const CERTAINTY_SCALE = tokens.certaintyScale as CertaintyToken[];
export const UNFAIRNESS_CATEGORIES = tokens.unfairnessCategories as UnfairnessCategoryToken[];
export const UNFAIRNESS_LEVELS = tokens.unfairnessLevels as UnfairnessLevelToken[];

const themeByCode = new Map(THEMES.map((t) => [t.code, t]));
const certaintyByValue = new Map(CERTAINTY_SCALE.map((c) => [c.value, c]));
const unfairByCode = new Map(UNFAIRNESS_CATEGORIES.map((u) => [u.code, u]));
const unfairLevelByValue = new Map(UNFAIRNESS_LEVELS.map((l) => [l.value, l]));

const FALLBACK_THEME: ThemeToken = {
  code: "MISC_BOILERPLATE",
  label: "Boilerplate divers",
  color: "#94A3B8",
  order: 999,
};

export function getThemeToken(code: string | null | undefined): ThemeToken {
  if (!code) return FALLBACK_THEME;
  return themeByCode.get(code) ?? { ...FALLBACK_THEME, code, label: code };
}

export function getCertaintyToken(value: number | null | undefined): CertaintyToken {
  return certaintyByValue.get(value ?? 0) ?? CERTAINTY_SCALE[0]!;
}

export function getUnfairnessToken(code: string): UnfairnessCategoryToken | undefined {
  return unfairByCode.get(code);
}

export function getUnfairnessLevel(value: number): UnfairnessLevelToken | undefined {
  return unfairLevelByValue.get(value);
}

/** Convertit un hex (#RRGGBB) en "r g b" pour les CSS variables Tailwind. */
export function hexToRgbChannels(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Luminance relative WCAG d'un canal 0–255 (sRGB linéarisé). */
function relChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Couleur de texte lisible (quasi-noir ou blanc) sur un fond hex donné, en
 * maximisant le ratio de contraste WCAG. Garantit l'accessibilité AA des pastilles
 * dont la couleur de fond est dynamique (avatars de présence, puces de thème) quelle
 * que soit la teinte choisie. Repli blanc si la couleur n'est pas un #RRGGBB.
 */
export function readableTextColor(bgHex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((bgHex ?? "").trim());
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1]!, 16);
  const L =
    0.2126 * relChannel((n >> 16) & 255) +
    0.7152 * relChannel((n >> 8) & 255) +
    0.0722 * relChannel(n & 255);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#FFFFFF" : "#0B0F14";
}
