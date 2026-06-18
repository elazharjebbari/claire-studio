"use client";

/**
 * Indexe les labels d'injustice CLAUDETTE par index de phrase (F12). Fournit le
 * style de surlignage selon la catégorie (couleur token) et le niveau (intensité).
 */

import { useMemo } from "react";
import type { ReferenceLabel } from "@/types/contract";
import { getUnfairnessLevel, getUnfairnessToken } from "@/lib/tokens";

export interface UnfairnessMark {
  category: string;
  level: number;
  label: string;
  color: string;
  intensity: number;
}

export function useUnfairnessIndex(labels: ReferenceLabel[]): Map<number, UnfairnessMark> {
  return useMemo(() => {
    const map = new Map<number, UnfairnessMark>();
    for (const l of labels) {
      const token = getUnfairnessToken(l.category);
      const level = getUnfairnessLevel(l.level);
      // Conserver le label le plus sévère par phrase.
      const existing = map.get(l.sentenceIndex);
      if (existing && existing.level >= l.level) continue;
      map.set(l.sentenceIndex, {
        category: l.category,
        level: l.level,
        label: token?.label ?? l.category,
        color: token?.color ?? "#EC4899",
        intensity: level?.intensity ?? 0.5,
      });
    }
    return map;
  }, [labels]);
}

export function unfairnessStyle(mark: UnfairnessMark): React.CSSProperties {
  return {
    backgroundColor: `${mark.color}${Math.round(mark.intensity * 64)
      .toString(16)
      .padStart(2, "0")}`,
    boxShadow: `inset 0 -2px 0 ${mark.color}`,
  };
}
