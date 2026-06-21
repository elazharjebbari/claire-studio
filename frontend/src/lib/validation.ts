/**
 * Validation humaine par phrase (point d) — logique PURE, testable isolément.
 *
 * Modèle d'annotation PAR PHRASE (C4) : chaque phrase couverte porte sa propre clause
 * (anchorIndex = index de la phrase). Une phrase est :
 *  - "validated" : une clause l'ancre ET elle est validée (référence confirmée) ;
 *  - "pending"   : une clause l'ancre mais n'est PAS validée (ex. pré-remplissage non
 *                  confirmé — aide seulement, jamais la référence) ;
 *  - "uncovered" : aucune clause ne l'ancre.
 *
 * La soumission n'est COMPLÈTE que si toute phrase est "validated" (ni pending, ni
 * uncovered) : les pré-annotations ne comptent jamais tant qu'elles ne sont pas validées.
 */

import type { DraftClause } from "@/store/workspace";

export type ValidationStatus = "validated" | "pending" | "uncovered";

export function validationByIndex(drafts: DraftClause[], n: number): ValidationStatus[] {
  const byAnchor = new Map<number, DraftClause>();
  for (const d of drafts) byAnchor.set(d.anchorIndex, d);
  const out: ValidationStatus[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = byAnchor.get(i);
    if (!d) out.push("uncovered");
    else out.push((d.validated ?? false) ? "validated" : "pending");
  }
  return out;
}

export interface ValidationSummary {
  validated: number;
  pending: number;
  uncovered: number;
  total: number;
  /** true ⇔ toutes les phrases sont validées (soumission autorisée). */
  complete: boolean;
}

export function validationSummary(statuses: ValidationStatus[]): ValidationSummary {
  let validated = 0;
  let pending = 0;
  let uncovered = 0;
  for (const s of statuses) {
    if (s === "validated") validated += 1;
    else if (s === "pending") pending += 1;
    else uncovered += 1;
  }
  return {
    validated,
    pending,
    uncovered,
    total: statuses.length,
    complete: pending === 0 && uncovered === 0,
  };
}
