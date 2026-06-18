"use client";

/**
 * useLongPress (P3) — déclenche `onTrigger(x, y)` après un appui maintenu (~450 ms)
 * OU sur clic-droit. L'appui est annulé si le pointeur bouge de plus de 8 px ou se
 * relâche avant le délai. Le clic SIMPLE rapide n'est PAS intercepté : le composant
 * conserve son `onClick` existant (focus + pose/sélection d'ancre).
 *
 * Couvre souris ET tactile (pointer events). Renvoie des handlers à étaler sur
 * l'élément cible.
 */

import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 8;

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useLongPress(
  onTrigger: (x: number, y: number) => void,
  ms: number = LONG_PRESS_MS,
): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore les clics secondaires (bouton droit gérés par onContextMenu).
      if (e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      const { clientX, clientY } = e;
      timer.current = setTimeout(() => {
        timer.current = null;
        onTrigger(clientX, clientY);
      }, ms);
    },
    [onTrigger, ms],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) clear();
    },
    [clear],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      onTrigger(e.clientX, e.clientY);
    },
    [onTrigger, clear],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onContextMenu,
  };
}
