"use client";

/**
 * ShortcutsHelp (L9) — cheat-sheet des raccourcis clavier de l'atelier. Modale accessible
 * (role=dialog, aria-modal, focus à l'ouverture, fermeture Échap / clic extérieur / bouton).
 * Ouverte par la touche `?` ou un bouton d'affordance. Contenu = registre unifié lib/shortcuts.
 */

import { useEffect, useRef } from "react";
import { Keyboard, X } from "lucide-react";
import { Kbd } from "@/components/ui/Kbd";
import { WORKSPACE_SHORTCUTS } from "@/lib/shortcuts";

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Raccourcis clavier de l'atelier"
        data-testid="shortcuts-help"
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-line bg-elevated p-4 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Keyboard size={16} aria-hidden /> Raccourcis clavier
          </h2>
          <button
            ref={closeRef}
            type="button"
            data-testid="shortcuts-help-close"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded p-1 text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {WORKSPACE_SHORTCUTS.map((group) => (
            <section key={group.title} data-testid={`shortcuts-group-${group.title}`}>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 text-[12px] text-ink">
                    <span className="min-w-0 flex-1 text-ink-muted">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
