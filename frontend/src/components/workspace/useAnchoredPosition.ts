"use client";

/**
 * useAnchoredPosition (P2) — positionne un popover `fixed` aux coordonnées d'un
 * déclencheur en garantissant qu'il reste ENTIÈREMENT dans le viewport.
 *
 * Stratégie « menu natif » : on rend l'élément, on mesure son rect réel
 * (useLayoutEffect, avant peinture → pas de saut visible), puis :
 *   - flip horizontal si débordement à droite (ancrage à gauche du curseur) ;
 *   - flip vertical si débordement en bas (ancrage au-dessus du curseur) ;
 *   - clamp dur aux bords avec une marge.
 * Recalcule si la taille de l'élément change (ResizeObserver) ou au resize fenêtre,
 * ce qui couvre le cas d'un contenu dépliable (rationale, onglets) qui s'agrandit.
 */

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Calcul PUR du placement d'un popover de taille (w,h) déclenché en (x,y) dans un
 * viewport (vw,vh) avec une marge. Flip de l'autre côté du curseur en cas de
 * débordement, puis clamp dur aux bords. Testable isolément (sans DOM).
 */
export function placeWithinViewport(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin = 8,
): { left: number; top: number } {
  let left = x;
  let top = y;
  if (left + w + margin > vw) left = x - w;
  if (top + h + margin > vh) top = y - h;
  left = Math.min(Math.max(margin, left), Math.max(margin, vw - w - margin));
  top = Math.min(Math.max(margin, top), Math.max(margin, vh - h - margin));
  return { left, top };
}

export interface AnchoredPositionResult {
  ref: React.RefObject<HTMLDivElement>;
  style: { left: number; top: number; visibility: "hidden" | "visible" };
}

export function useAnchoredPosition(
  x: number,
  y: number,
  margin = 8,
): AnchoredPositionResult {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; ready: boolean }>({
    left: x,
    top: y,
    ready: false,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      const vh = typeof window !== "undefined" ? window.innerHeight : 768;
      const rect = el.getBoundingClientRect();
      const w = rect.width || el.offsetWidth || 0;
      const h = rect.height || el.offsetHeight || 0;
      const { left, top } = placeWithinViewport(x, y, w, h, vw, vh, margin);
      setPos({ left, top, ready: true });
    };

    compute();

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => compute()) : null;
    ro?.observe(el);
    if (typeof window !== "undefined") window.addEventListener("resize", compute);
    return () => {
      ro?.disconnect();
      if (typeof window !== "undefined") window.removeEventListener("resize", compute);
    };
  }, [x, y, margin]);

  return {
    ref,
    style: { left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" },
  };
}
