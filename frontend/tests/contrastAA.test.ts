import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readableTextColor, THEMES } from "@/lib/tokens";
import { TRIAGE_LEVEL_META } from "@/lib/triage";

/**
 * Harnais d'accessibilité (Lot 0) — prouve le CONTRASTE WCAG des paires de couleurs du
 * design system dans les DEUX thèmes (sombre = :root, clair = .theme-light), en parsant
 * directement globals.css (source autoritative). Tout token qu'on baisserait sous le seuil
 * AA casserait ce test : fin des régressions de contraste (cf. l'ancien badge gold « split »).
 */

const CSS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../src/app/globals.css"),
  "utf8",
);

/** Extrait un bloc `selector { ... }` et parse ses déclarations `--name: r g b;`. */
function parseTokens(selectorMarker: string): Record<string, [number, number, number]> {
  const start = CSS.indexOf(selectorMarker);
  const open = CSS.indexOf("{", start);
  const close = CSS.indexOf("}", open);
  const body = CSS.slice(open + 1, close);
  const out: Record<string, [number, number, number]> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    out[m[1]!] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

const DARK = parseTokens(":root {");
const LIGHT = parseTokens(".theme-light {");

function relLum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = relLum(a);
  const lb = relLum(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const AA = 4.5; // texte normal
const AA_LARGE = 3; // texte large / éléments non textuels (1.4.11)

describe("Contraste WCAG du design system (sombre + clair)", () => {
  for (const [name, T] of [["sombre", DARK], ["clair", LIGHT]] as const) {
    describe(`thème ${name}`, () => {
      it("texte principal (ink) lisible sur toutes les surfaces (AA)", () => {
        for (const surf of ["surface-bg", "surface-panel", "surface-panel-muted", "surface-bg-elevated"]) {
          expect(contrast(T["surface-text"]!, T[surf]!), `ink/${surf}`).toBeGreaterThanOrEqual(AA);
        }
      });

      it("texte sur accent (accent-fg/accent) AA", () => {
        expect(contrast(T["surface-on-accent"]!, T["surface-accent"]!)).toBeGreaterThanOrEqual(AA);
      });

      it("tokens sémantiques en TEXTE sur panel (success/warning/danger/info) AA", () => {
        for (const sem of ["sem-success", "sem-warning", "sem-danger", "sem-info"]) {
          expect(contrast(T[sem]!, T["surface-panel"]!), `${sem}/panel`).toBeGreaterThanOrEqual(AA);
        }
      });

      it("texte atténué (ink-muted) sur panel ≥ AA large", () => {
        // Secondaire/atténué : seuil AA-large toléré (jamais porteur d'info critique seule).
        expect(contrast(T["surface-text-muted"]!, T["surface-panel"]!)).toBeGreaterThanOrEqual(AA_LARGE);
      });
    });
  }

  it("readableTextColor garantit AA sur CHAQUE couleur de thème (pastilles dynamiques)", () => {
    for (const t of THEMES) {
      const fg = hexToRgb(readableTextColor(t.color));
      expect(contrast(fg, hexToRgb(t.color)), `texte/${t.code}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("readableTextColor garantit AA sur CHAQUE niveau de triage C1→C5 (badges)", () => {
    for (const lvl of Object.values(TRIAGE_LEVEL_META)) {
      const fg = hexToRgb(readableTextColor(lvl.color));
      expect(contrast(fg, hexToRgb(lvl.color)), `texte/${lvl.label}`).toBeGreaterThanOrEqual(AA);
    }
  });
});
