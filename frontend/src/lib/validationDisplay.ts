/**
 * validationDisplay — SOURCE UNIQUE de l'affichage « validation & provenance » (dossier
 * docs/pactiva/dossier-ux-decision-multilabel). PUR (sans React) → testable isolément et
 * réutilisable partout (ClauseChip, inspecteur, piste de validation).
 *
 * Modèle 3 canaux : la FORME encode la PROVENANCE (qui a validé), la COULEUR encode l'ÉTAT
 * (validé = emerald, à valider = amber). Les 3 types de validation demandés :
 *   - moteur (triage)      : le niveau Cx est renseigné → glyphe ⚡ (+ code Cx).
 *   - pré-annotation       : issu d'un seed LLM, confirmé → glyphe ★.
 *   - manuel               : décision humaine sans assistance → glyphe ✎.
 * Tant que non validé, on garde le glyphe d'« à valider » ◷ (familier) ; la provenance reste
 * dérivable pour l'info-bulle.
 *
 * Données : tout est DÉRIVÉ des champs existants (validated / seededFrom / triageLevel) — pas
 * de champ stocké ni de migration.
 */

import type { ThemeTag, TriageLevel } from "@/types/contract";
import { TRIAGE_LEVEL_META } from "@/lib/triage";

export type ValidationProvenance = "moteur" | "pre_annotation" | "manuel";

export interface ValidationInput {
  validated?: boolean;
  seededFrom?: string | null;
  /** Juge dont la proposition a été ADOPTÉE (arbitrage de divergence) — décision assistée. */
  resolvedFrom?: string | null;
  triageLevel?: TriageLevel | null;
}

export interface ValidationDisplay {
  validated: boolean;
  state: "valide" | "a_valider";
  /** Provenance dérivée (toujours définie, même à l'état « à valider »). */
  provenance: ValidationProvenance;
  level: TriageLevel | null;
  /** Glyphe à afficher : ⚡ / ★ / ✎ si validé ; ◷ sinon. */
  glyph: string;
  /** Classe Tailwind de couleur (état). */
  colorClass: string;
  accentHex: string;
  /** Libellé humain (title + aria-label). */
  label: string;
}

const PROVENANCE_META: Record<ValidationProvenance, { glyph: string; accentHex: string }> = {
  moteur: { glyph: "⚡", accentHex: "#3B82F6" },
  pre_annotation: { glyph: "★", accentHex: "#F59E0B" },
  manuel: { glyph: "✎", accentHex: "#22C55E" },
};

/** Provenance de la décision (priorité : moteur > assistée(seed/arbitrage) > manuel).
 *  `resolvedFrom` (adoption d'un juge) compte comme assistée → ★, comme `seededFrom`. */
export function provenanceOf(c: ValidationInput): ValidationProvenance {
  if (c.triageLevel) return "moteur";
  if (c.seededFrom || c.resolvedFrom) return "pre_annotation";
  return "manuel";
}

export function validationDisplay(c: ValidationInput): ValidationDisplay {
  const validated = Boolean(c.validated);
  const provenance = provenanceOf(c);
  const level = c.triageLevel ?? null;

  if (!validated) {
    return {
      validated: false,
      state: "a_valider",
      provenance,
      level,
      glyph: "◷",
      colorClass: "text-amber-400",
      accentHex: "#FBBF24",
      label: "À valider",
    };
  }

  const lvl = level ? ` · ${level} ${TRIAGE_LEVEL_META[level].label}` : "";
  const label =
    provenance === "moteur"
      ? `Validé par le moteur${lvl}`
      : provenance === "pre_annotation"
        ? "Validé (pré-annotation)"
        : "Validé manuellement";

  return {
    validated: true,
    state: "valide",
    provenance,
    level,
    glyph: PROVENANCE_META[provenance].glyph,
    colorClass: "text-emerald-400",
    accentHex: PROVENANCE_META[provenance].accentHex,
    label,
  };
}

/** Nombre de thèmes secondaires (multi-label) d'une clause. */
export function secondaryCount(themes?: ThemeTag[] | null): number {
  if (!themes) return 0;
  return themes.filter((t) => t.role === "secondary").length;
}
