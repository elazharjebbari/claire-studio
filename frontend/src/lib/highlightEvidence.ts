/**
 * Repérage INDICATIF d'évidence intra-phrase (cf. dossier design 02 §3).
 *
 * CLAUDETTE ne fournit AUCUN span d'évidence : la donnée est par phrase. Ce module
 * découpe une phrase en segments et marque (indicatif, NON vérité terrain) les fragments
 * qui matchent les tournures typiques des catégories présentes — pour « pointer » un
 * passage sans prétendre à une vérité vérifiée. Pur, sans React, testable isolément.
 */

import type { UnfairnessCategory } from "@/types/contract";
import { unfairnessMeta } from "@/lib/unfairnessMeta";

export interface EvidenceSegment {
  text: string;
  /** Repère INDICATIF (mot-clé de catégorie) — à rendre en pointillé étiqueté. */
  mark: boolean;
}

/** Échappe les métacaractères regex d'une source littérale. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Découpe `text` en segments ; `mark:true` sur les fragments matchant les lexiques des
 * `categories` présentes. Insensible à la casse, non destructif (concat(segments)===text),
 * sûr (combine les sources des regex meta sans réutiliser leur état global).
 * Sans match → un unique segment `{text, mark:false}`.
 */
export function highlightEvidence(
  text: string,
  categories: UnfairnessCategory[],
): EvidenceSegment[] {
  if (!text) return [{ text: "", mark: false }];

  const sources = categories
    .map((c) => unfairnessMeta(c)?.keywords?.source)
    .filter((s): s is string => !!s);
  if (sources.length === 0) return [{ text, mark: false }];

  // Une seule passe : alternance des sources, drapeau global pour itérer.
  const combined = new RegExp(`(?:${sources.join("|")})`, "gi");

  const segments: EvidenceSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(combined)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (m[0].length === 0) continue; // garde-fou anti-boucle
    if (start > last) segments.push({ text: text.slice(last, start), mark: false });
    segments.push({ text: m[0], mark: true });
    last = end;
  }
  if (last < text.length) segments.push({ text: text.slice(last), mark: false });
  if (segments.length === 0) return [{ text, mark: false }];
  return segments;
}

/** True si au moins un repère indicatif est trouvé (pour étiqueter la fiche). */
export function hasEvidenceHint(text: string, categories: UnfairnessCategory[]): boolean {
  return highlightEvidence(text, categories).some((s) => s.mark);
}

// `escapeRegExp` exporté pour réutilisation/tests éventuels.
export { escapeRegExp };
