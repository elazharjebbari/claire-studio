"use client";

/**
 * ResizablePanels — disposition 3 colonnes redimensionnables du workspace
 * (navigation.md §3). Poignées au clavier (flèches gauche/droite) + souris,
 * largeurs persistées en localStorage. Accessible (role="separator").
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
}: {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}) {
  const [layout, setLayout] = useState<Layout>(DEFAULT);
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
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionner le panneau ${side === "left" ? "gauche" : "droit"}`}
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
      <aside
        style={{ width: layout.left }}
        className="h-full shrink-0 overflow-y-auto border-r border-line bg-elevated"
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
      <Handle side="right" />
      <aside
        style={{ width: layout.right }}
        className="h-full shrink-0 overflow-y-auto border-l border-line bg-elevated"
        aria-label="Inspecteur"
      >
        {right}
      </aside>
    </div>
  );
}
