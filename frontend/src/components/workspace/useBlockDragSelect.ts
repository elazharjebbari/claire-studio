"use client";

/**
 * useBlockDragSelect (P8) — sélection multi-BLOCS (clauses) au bouton DROIT maintenu.
 *
 * Geste : `pointerdown` bouton droit (button === 2) sur une phrase → on mémorise le
 * bloc de départ. En glissant sur d'autres phrases (`pointermove` capturé au niveau
 * document), on calcule la PLAGE de clauses couvrant du bloc de départ au bloc survolé
 * et on la pousse dans le store (`setSelectedClauses`). Un tooltip flottant « N bloc(s)
 * sélectionné(s) » suit le curseur.
 *
 * À `pointerup` : on finalise. Si un glissement a réellement eu lieu (drag), on arme
 * la suppression du `contextmenu` qui suit immédiatement (sinon le menu phrase
 * s'ouvrirait). Un clic-droit IMMOBILE n'est pas un drag → `SentenceMenu` s'ouvre
 * comme avant (le hook ne touche pas à ce cas).
 *
 * Robustesse : `user-select: none` temporaire sur <body> pendant le drag (neutralise
 * la sélection de texte native), gestion de `pointercancel`, no-op si une seule clause
 * dans la plage (rien à annoter en masse).
 *
 * Le mapping phrase→clause utilise `runAt(runs, index)` : seule la clause (run non
 * neutre, localId != null) est retenue. Les phrases du préfixe neutre sont ignorées.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Run } from "@/lib/runs";
import { clauseRangeBetween } from "@/lib/runs";
import { useWorkspaceStore } from "@/store/workspace";

const DRAG_TOLERANCE_PX = 6;

export interface BlockDragTip {
  x: number;
  y: number;
  count: number;
}

export interface UseBlockDragSelectResult {
  /** Handler `onPointerDown` à étaler sur chaque phrase (avec son index). */
  onSentencePointerDown: (e: React.PointerEvent, index: number) => void;
  /**
   * Renvoie `true` si le `contextmenu` doit être SUPPRIMÉ (un drag vient d'avoir lieu).
   * Consomme l'état one-shot. À appeler depuis `onContextMenu` de la phrase.
   */
  shouldSuppressContextMenu: () => boolean;
  /** État du tooltip flottant (ou null si pas de drag en cours). */
  tip: BlockDragTip | null;
}

/** Indices des phrases qui sont des ancres (début de clause), pour mapper l'index. */
export function useBlockDragSelect(runs: Run[]): UseBlockDragSelectResult {
  const setSelectedClauses = useWorkspaceStore((s) => s.setSelectedClauses);

  const [tip, setTip] = useState<BlockDragTip | null>(null);

  // État du drag en cours (refs : pas de re-render à chaque move).
  const active = useRef(false);
  const startIndex = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const suppressNext = useRef(false);
  const runsRef = useRef(runs);
  runsRef.current = runs;

  /** Plage ordonnée de localId entre deux index (clauses couvertes incluses). */
  const clauseRange = useCallback((fromIdx: number, toIdx: number): string[] => {
    return clauseRangeBetween(runsRef.current, fromIdx, toIdx);
  }, []);

  const cleanup = useCallback(() => {
    active.current = false;
    startIndex.current = null;
    startPos.current = null;
    moved.current = false;
    setTip(null);
    if (typeof document !== "undefined") {
      document.body.style.userSelect = "";
    }
  }, []);

  const onSentencePointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      // Bouton droit uniquement.
      if (e.button !== 2) return;
      // Démarre un drag de blocs ; le bloc de départ est la clause sous le curseur.
      active.current = true;
      startIndex.current = index;
      startPos.current = { x: e.clientX, y: e.clientY };
      moved.current = false;
      // Neutralise la sélection de texte native pendant le drag droit.
      if (typeof document !== "undefined") {
        document.body.style.userSelect = "none";
      }
    },
    [],
  );

  // Écoute globale du drag (move/up/cancel) tant qu'un drag de blocs est armé.
  useEffect(() => {
    function findSentenceIndex(target: EventTarget | null): number | null {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        const raw = el.getAttribute?.("data-sentence-index");
        if (raw != null) {
          const n = Number(raw);
          return Number.isInteger(n) ? n : null;
        }
        el = el.parentElement;
      }
      return null;
    }

    function onMove(e: PointerEvent) {
      if (!active.current || startIndex.current == null || !startPos.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (!moved.current && Math.hypot(dx, dy) < DRAG_TOLERANCE_PX) return;
      moved.current = true;

      const hovered = findSentenceIndex(
        document.elementFromPoint(e.clientX, e.clientY),
      );
      const toIdx = hovered ?? startIndex.current;
      const ids = clauseRange(startIndex.current, toIdx);
      setSelectedClauses(ids);
      setTip({ x: e.clientX, y: e.clientY, count: ids.length });
    }

    function finalize(e: PointerEvent) {
      if (!active.current) return;
      if (moved.current && startIndex.current != null) {
        const hovered = findSentenceIndex(
          document.elementFromPoint(e.clientX, e.clientY),
        );
        const toIdx = hovered ?? startIndex.current;
        const ids = clauseRange(startIndex.current, toIdx);
        if (ids.length >= 2) {
          setSelectedClauses(ids);
          // Un drag a eu lieu → supprime le contextmenu qui suit.
          suppressNext.current = true;
        } else {
          // Plage trop courte (une seule clause) : on ne sélectionne pas en masse.
          setSelectedClauses([]);
          if (ids.length >= 1) suppressNext.current = true;
        }
      }
      cleanup();
    }

    function onCancel() {
      if (!active.current) return;
      cleanup();
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", finalize);
    document.addEventListener("pointercancel", onCancel);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", finalize);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, [clauseRange, setSelectedClauses, cleanup]);

  const shouldSuppressContextMenu = useCallback(() => {
    if (suppressNext.current) {
      suppressNext.current = false;
      return true;
    }
    return false;
  }, []);

  return { onSentencePointerDown, shouldSuppressContextMenu, tip };
}
