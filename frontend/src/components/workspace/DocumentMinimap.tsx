"use client";

/**
 * DocumentMinimap (axe 5) — petit cadre indiquant OÙ on lit dans le document.
 *
 * Rail vertical fin (à droite, écrans larges seulement → zéro impact sur petit
 * écran), une bande par phrase teintée par son thème + un INDICATEUR DE VIEWPORT
 * (cadre translucide) montrant la portion actuellement visible au scroll, et un
 * repère de la phrase focalisée. Cliquer saute à la position correspondante.
 *
 * ROBUSTE : `useScrollViewport` détecte le conteneur scrollable en remontant le DOM
 * (aucune dépendance à ResizablePanels) et DÉGRADE proprement s'il est introuvable
 * (rail cliquable sans cadre de viewport, jamais d'erreur).
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export interface ScrollViewport {
  /** Position de défilement [0,1] (0 = haut). */
  scrollPct: number;
  /** Fraction visible [0,1] (hauteur visible / hauteur totale). */
  viewportPct: number;
  /** Faux si aucun conteneur scrollable détecté (dégradation gracieuse). */
  hasScroll: boolean;
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Suit le défilement du conteneur scrollable ancêtre de `ref`. Défensif. */
export function useScrollViewport(ref: RefObject<HTMLElement>): ScrollViewport {
  const [vp, setVp] = useState<ScrollViewport>({ scrollPct: 0, viewportPct: 1, hasScroll: false });
  useEffect(() => {
    const root = findScrollParent(ref.current);
    if (!root) {
      setVp({ scrollPct: 0, viewportPct: 1, hasScroll: false });
      return;
    }
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = root.scrollHeight - root.clientHeight;
        setVp({
          scrollPct: max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0,
          viewportPct: root.scrollHeight > 0 ? Math.min(1, root.clientHeight / root.scrollHeight) : 1,
          hasScroll: max > 0,
        });
      });
    };
    update();
    root.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [ref]);
  return vp;
}

export interface DocumentMinimapProps {
  /** Couleur de thème par phrase (index 0..n-1) ; undefined = non annotée. */
  sentenceColors: (string | undefined)[];
  scrollPct: number;
  viewportPct: number;
  hasScroll: boolean;
  focused: number;
  /** Saut à une fraction [0,1] du document (clic sur le rail). */
  onJumpFraction: (f: number) => void;
}

export function DocumentMinimap({
  sentenceColors,
  scrollPct,
  viewportPct,
  hasScroll,
  focused,
  onJumpFraction,
}: DocumentMinimapProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const n = sentenceColors.length;
  if (n === 0) return null;

  const viewportTopPct = scrollPct * (1 - viewportPct) * 100;
  const focusTopPct = n > 1 ? (focused / (n - 1)) * 100 : 0;

  return (
    <div
      className="pointer-events-none fixed right-1 top-24 bottom-6 z-30 hidden w-3 xl:block"
      aria-hidden
      data-testid="document-minimap"
    >
      <div
        ref={railRef}
        className="pointer-events-auto relative h-full w-full overflow-hidden rounded-full border border-line bg-panel-muted/40"
        role="slider"
        aria-label="Position de lecture dans le document"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={focused}
        title="Minimap — cliquer pour aller à une position du document"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onJumpFraction(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
        }}
      >
        {/* Bandes de thème (une par phrase). */}
        <div className="flex h-full w-full flex-col">
          {sentenceColors.map((c, i) => (
            <div
              key={i}
              className="w-full flex-1"
              style={{ backgroundColor: c ? `${c}99` : "transparent" }}
            />
          ))}
        </div>
        {/* Indicateur de viewport (cadre translucide) — seulement si ça défile. */}
        {hasScroll && (
          <div
            data-testid="minimap-viewport"
            className="absolute inset-x-0 rounded-sm border border-accent/70 bg-accent/15"
            style={{ top: `${viewportTopPct}%`, height: `${Math.max(4, viewportPct * 100)}%` }}
          />
        )}
        {/* Repère de la phrase focalisée. */}
        <div
          className="absolute inset-x-0 h-[2px] bg-accent"
          style={{ top: `${focusTopPct}%` }}
        />
      </div>
    </div>
  );
}
