"use client";

/**
 * Indexe les labels d'injustice CLAUDETTE par index de phrase (F12). Fournit le
 * style de surlignage selon la catégorie (couleur token) et le niveau (intensité).
 *
 * Deux vues :
 *  - `useUnfairnessMarks` : TOUTES les marques d'une phrase (triées par sévérité ↓) —
 *    pour la fiche « loupe d'injustice » qui doit tout lister (multi-catégories).
 *  - `useUnfairnessIndex` : la marque DOMINANTE (plus sévère) par phrase — pour
 *    l'overlay permanent (style de surlignage de la phrase). Rétro-compatible.
 */

import { useMemo } from "react";
import type { ReferenceLabel } from "@/types/contract";
import { getUnfairnessLevel, getUnfairnessToken } from "@/lib/tokens";
import { unfairnessMeta } from "@/lib/unfairnessMeta";

export interface UnfairnessMark {
  category: string;
  level: number;
  label: string;
  color: string;
  intensity: number;
  /** Sens « Clause qui… » (meta) — pour la fiche. */
  sense: string;
  /** Thèmes de segmentation associés (indicatif). */
  relatedThemes: string[];
}

function toMark(l: ReferenceLabel): UnfairnessMark {
  const token = getUnfairnessToken(l.category);
  const level = getUnfairnessLevel(l.level);
  const meta = unfairnessMeta(l.category);
  return {
    category: l.category,
    level: l.level,
    // Libellé FR (meta) prioritaire pour l'UI ; repli sur le token (EN) puis le code.
    label: meta?.label ?? token?.label ?? l.category,
    color: token?.color ?? "#EC4899",
    intensity: level?.intensity ?? 0.5,
    sense: meta?.sense ?? "",
    relatedThemes: meta?.relatedThemes ?? [],
  };
}

/** Tri déterministe : niveau décroissant, puis catégorie alphabétique. */
function bySeverityDesc(a: UnfairnessMark, b: UnfairnessMark): number {
  return b.level - a.level || a.category.localeCompare(b.category);
}

/** TOUTES les marques par phrase (triées par sévérité ↓). */
export function useUnfairnessMarks(
  labels: ReferenceLabel[],
): Map<number, UnfairnessMark[]> {
  return useMemo(() => {
    const map = new Map<number, UnfairnessMark[]>();
    for (const l of labels) {
      const arr = map.get(l.sentenceIndex);
      if (arr) arr.push(toMark(l));
      else map.set(l.sentenceIndex, [toMark(l)]);
    }
    for (const arr of map.values()) arr.sort(bySeverityDesc);
    return map;
  }, [labels]);
}

/** Marque DOMINANTE (plus sévère) par phrase — overlay permanent. */
export function useUnfairnessIndex(labels: ReferenceLabel[]): Map<number, UnfairnessMark> {
  const marks = useUnfairnessMarks(labels);
  return useMemo(() => {
    const map = new Map<number, UnfairnessMark>();
    for (const [idx, arr] of marks) {
      if (arr[0]) map.set(idx, arr[0]); // déjà trié par sévérité ↓
    }
    return map;
  }, [marks]);
}

export function unfairnessStyle(mark: UnfairnessMark): React.CSSProperties {
  return {
    backgroundColor: `${mark.color}${Math.round(mark.intensity * 64)
      .toString(16)
      .padStart(2, "0")}`,
    boxShadow: `inset 0 -2px 0 ${mark.color}`,
  };
}
