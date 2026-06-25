"use client";

/**
 * Disclosure — primitive de RÉVÉLATION PROGRESSIVE accessible (principe directeur n°1 de la
 * refonte atelier). Un en-tête bouton (aria-expanded/aria-controls) dévoile/replie un panneau.
 * Replié par défaut → ne consomme pas d'espace tant qu'on ne le sollicite pas ; un badge
 * optionnel signale un état actif sous le pli (« N actifs »).
 *
 * Réutilisée par : Overlays « Affichage » (plan), sections de l'inspecteur, tiroir de la barre
 * d'outils, carte d'arbitrage « Pourquoi ? ». Le contenu reste MONTÉ quand replié (présent dans
 * le DOM, simplement masqué) pour préserver les états et l'accessibilité ; `unmountOnClose`
 * permet l'inverse si besoin.
 */

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DisclosureProps {
  /** Libellé de l'en-tête (résumé). */
  summary: ReactNode;
  /** Icône Lucide optionnelle à gauche du résumé. */
  icon?: ReactNode;
  /** Badge optionnel (ex. nombre d'éléments actifs sous le pli). Masqué si null/0. */
  badge?: number | string | null;
  defaultOpen?: boolean;
  /** Démonte le contenu quand replié (par défaut : monté mais masqué). */
  unmountOnClose?: boolean;
  /** data-testid de la racine ; le bouton reçoit `${testId}-summary`, le panneau `${testId}-panel`. */
  testId?: string;
  className?: string;
  children: ReactNode;
}

export function Disclosure({
  summary,
  icon,
  badge,
  defaultOpen = false,
  unmountOnClose = false,
  testId,
  className,
  children,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const showBadge = badge != null && badge !== 0 && badge !== "";

  return (
    <div
      data-testid={testId}
      data-open={open || undefined}
      className={cn("rounded-md border border-line", className)}
    >
      <button
        type="button"
        data-testid={testId ? `${testId}-summary` : undefined}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted transition-colors hover:bg-panel-muted hover:text-ink"
      >
        <ChevronRight
          size={13}
          aria-hidden
          className={cn("shrink-0 transition-transform", open && "rotate-90")}
        />
        {icon && (
          <span aria-hidden className="shrink-0">
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">{summary}</span>
        {showBadge && (
          <span
            data-testid={testId ? `${testId}-badge` : undefined}
            className="shrink-0 rounded-full bg-accent/15 px-1.5 text-[10px] font-bold leading-relaxed text-accent"
          >
            {badge}
          </span>
        )}
      </button>
      {(open || !unmountOnClose) && (
        <div id={panelId} hidden={!open} className="px-2 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
