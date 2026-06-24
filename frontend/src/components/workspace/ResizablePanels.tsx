"use client";

/**
 * ResizablePanels — disposition 3 colonnes redimensionnables du workspace
 * (navigation.md §3). Poignées au clavier (flèches gauche/droite) + souris,
 * largeurs persistées en localStorage. Accessible (role="separator").
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "claire.workspace.layout";
const MIN = 180;

interface Layout {
  left: number;
  right: number;
}

const DEFAULT: Layout = { left: 280, right: 360 };

export function ResizablePanels({
  left,
  center,
  right,
  rightCollapsed = false,
  onExpandRight,
  onCollapseRight,
}: {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  /** Point f : replie le panneau droit (inspecteur) en un rail fin pour gagner de l'espace. */
  rightCollapsed?: boolean;
  onExpandRight?: () => void;
  /** Replie l'inspecteur depuis l'aside lui-même (bouton d'en-tête). */
  onCollapseRight?: () => void;
}) {
  const [layout, setLayout] = useState<Layout>(DEFAULT);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"left" | "right" | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLayout(JSON.parse(raw) as Layout);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const persist = useCallback((next: Layout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (dragging.current === "left") {
        const w = Math.max(MIN, Math.min(e.clientX - rect.left, rect.width - 2 * MIN));
        setLayout((l) => ({ ...l, left: w }));
      } else {
        const w = Math.max(MIN, Math.min(rect.right - e.clientX, rect.width - 2 * MIN));
        setLayout((l) => ({ ...l, right: w }));
      }
    }
    function onUp() {
      if (dragging.current) {
        dragging.current = null;
        document.body.style.cursor = "";
        setLayout((l) => {
          persist(l);
          return l;
        });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [persist]);

  function handleKey(side: "left" | "right", e: React.KeyboardEvent) {
    const step = e.shiftKey ? 40 : 12;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    persist({
      ...layout,
      [side]: Math.max(MIN, layout[side] + (side === "left" ? dir : -dir) * step),
    });
  }

  function Handle({ side }: { side: "left" | "right" }) {
    const value = Math.round(layout[side]);
    // Borne supérieure raisonnable : largeur conteneur moins l'espace réservé
    // aux deux autres colonnes (mêmes bornes que le drag), sinon repli sur 1200px.
    const max = containerWidth > 3 * MIN ? Math.round(containerWidth - 2 * MIN) : 1200;
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionner le panneau ${side === "left" ? "gauche" : "droit"}`}
        aria-valuenow={value}
        aria-valuemin={MIN}
        aria-valuemax={Math.max(max, value)}
        tabIndex={0}
        data-testid={`resize-${side}`}
        onMouseDown={() => {
          dragging.current = side;
          document.body.style.cursor = "col-resize";
        }}
        onKeyDown={(e) => handleKey(side, e)}
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-line/40 transition-colors hover:bg-accent/60 focus-visible:bg-accent"
      />
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* overflow-hidden (et non -y-auto) : le panneau gauche (TocPanel) gère son PROPRE
          défilement interne — en-tête + overlays épinglés, liste de clauses défilante —
          de sorte qu'aucune bande vide n'apparaisse sous le contenu (parité inspecteur). */}
      <aside
        style={{ width: layout.left }}
        className="h-full shrink-0 overflow-hidden border-r border-line bg-elevated"
        aria-label="Plan du document"
      >
        {left}
      </aside>
      <Handle side="left" />
      <section
        role="region"
        className="h-full flex-1 overflow-y-auto bg-reading"
        aria-label="Document"
      >
        {center}
      </section>
      {rightCollapsed ? (
        // Rail fin : l'inspecteur est replié (point f). Bouton vertical pour le déplier.
        <aside
          className="flex h-full w-8 shrink-0 flex-col items-center border-l border-line bg-elevated"
          aria-label="Inspecteur (replié)"
        >
          <button
            type="button"
            data-testid="inspector-expand"
            onClick={onExpandRight}
            title="Déplier l'inspecteur"
            aria-label="Déplier l'inspecteur"
            className="flex w-full flex-1 flex-col items-center gap-2 py-3 text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            <ChevronLeft size={16} aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl]">
              Inspecteur
            </span>
          </button>
        </aside>
      ) : (
        <>
          <Handle side="right" />
          {/* Colonne flex : en-tête figé (shrink-0) + zone de contenu défilante (flex-1).
              Le panneau remplit toute la hauteur ; le contenu (inspecteur) peut donc
              s'étirer pour occuper l'espace, sans bande vide en bas (la barre de
              défilement n'apparaît que si le contenu dépasse réellement). */}
          <aside
            style={{ width: layout.right }}
            className="flex h-full shrink-0 flex-col overflow-hidden border-l border-line bg-elevated"
            aria-label="Inspecteur"
          >
            {onCollapseRight && (
              <div className="z-10 flex shrink-0 justify-end border-b border-line/40 bg-elevated/85 px-1 py-1 backdrop-blur">
                <button
                  type="button"
                  data-testid="inspector-collapse"
                  onClick={onCollapseRight}
                  title="Replier l'inspecteur"
                  aria-label="Replier l'inspecteur"
                  className="inline-flex items-center rounded px-1 text-ink-muted hover:bg-panel-muted hover:text-ink"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto" data-testid="inspector-scroll">
              {right}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
