"use client";

/**
 * Raccourcis clavier liés à la comparaison LLM (P1/P4/P5), montés dans le
 * DocumentPanel (là où vivent les données de divergence) :
 *   n / p : divergence suivante / précédente (mode comparaison)
 *   1 / 2 : adopter la proposition Claude / Codex sur la divergence courante
 *   e     : aperçu evidence/rationale de la frontière courante
 *   g     : basculer le panneau comparatif
 *
 * Inactif quand le focus est dans un champ de saisie. `1`/`2` n'interceptent que
 * si un callback d'adoption est fourni ET actif (sinon `0`–`3` gardent la certitude).
 */

import { useEffect } from "react";

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable || tag === "select";
}

export interface DivergenceShortcutCallbacks {
  onNextDivergence?: () => void;
  onPrevDivergence?: () => void;
  onAdoptClaude?: () => void;
  onAdoptCodex?: () => void;
  onPeekBoundary?: () => void;
  onToggleCompare?: () => void;
  /** Si faux, n/p/1/2 sont ignorés (ex. hors mode comparaison). g/e restent actifs. */
  compareActive?: boolean;
}

export function useDivergenceShortcuts(cb: DivergenceShortcutCallbacks = {}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "g":
        case "G":
          e.preventDefault();
          cb.onToggleCompare?.();
          break;
        case "e":
        case "E":
          e.preventDefault();
          cb.onPeekBoundary?.();
          break;
        case "n":
        case "N":
          if (!cb.compareActive) return;
          e.preventDefault();
          cb.onNextDivergence?.();
          break;
        case "p":
        case "P":
          if (!cb.compareActive) return;
          e.preventDefault();
          cb.onPrevDivergence?.();
          break;
        case "1":
          if (!cb.compareActive || !cb.onAdoptClaude) return;
          e.preventDefault();
          cb.onAdoptClaude();
          break;
        case "2":
          if (!cb.compareActive || !cb.onAdoptCodex) return;
          e.preventDefault();
          cb.onAdoptCodex();
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cb]);
}
