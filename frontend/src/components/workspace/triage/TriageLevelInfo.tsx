"use client";

/**
 * TriageLevelInfo — RÉVÉLATION À LA DEMANDE du barème C1→C5 (refonte atelier, Lot 6).
 *
 * Un déclencheur « ? » discret ; au clic, dévoile un mini-barème des 5 niveaux (icône + code +
 * libellé + sens en une ligne), le niveau COURANT mis en avant. Replié par défaut → aucune
 * pollution permanente de l'écran ; l'explication n'apparaît que lorsqu'on la sollicite.
 * Réutilisable partout où un niveau de triage s'affiche (carte de suggestion, inspecteur).
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  ShieldCheck, Check, Layers, AlertTriangle, Scale, HelpCircle, type LucideIcon,
} from "lucide-react";
import { readableTextColor } from "@/lib/tokens";
import type { TriageLevel } from "@/lib/triage";
import { TRIAGE_LEVEL_META as LEVEL_META } from "@/lib/triage";

/** Icône par niveau — source unique partagée (carte + inspecteur). */
export const LEVEL_ICON: Record<TriageLevel, LucideIcon> = {
  C1: ShieldCheck,
  C2: Check,
  C3: Layers,
  C4: AlertTriangle,
  C5: Scale,
};

const ORDER: TriageLevel[] = ["C1", "C2", "C3", "C4", "C5"];

/** Pastille de niveau (icône + code · libellé), fond PLEIN + texte lisible → AA garanti.
 * Source unique partagée (carte de suggestion + inspecteur). */
export function TriageLevelBadge({ level, testId }: { level: TriageLevel; testId?: string }) {
  const m = LEVEL_META[level];
  const Icon = LEVEL_ICON[level];
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: m.color, color: readableTextColor(m.color) }}
    >
      <Icon size={12} aria-hidden /> {level} · {m.label}
    </span>
  );
}

export function TriageLevelInfo({ current }: { current: TriageLevel }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur + Échap (popover non modal).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        data-testid="triage-level-info-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Que signifient les niveaux C1 à C5 ?"
        title="Que signifient C1 à C5 ?"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-panel-muted hover:text-ink"
      >
        <HelpCircle size={13} aria-hidden />
      </button>
      {open && (
        <div
          id={panelId}
          data-testid="triage-level-info-panel"
          role="dialog"
          aria-label="Barème des niveaux de triage C1 à C5"
          className="absolute right-0 top-6 z-50 w-72 rounded-lg border border-line bg-elevated p-2 text-sm shadow-xl"
        >
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Niveaux d'accord inter-juges
          </p>
          <ul className="flex flex-col gap-1">
            {ORDER.map((lvl) => {
              const m = LEVEL_META[lvl];
              const Icon = LEVEL_ICON[lvl];
              const isCurrent = lvl === current;
              return (
                <li
                  key={lvl}
                  data-testid={`triage-level-row-${lvl}`}
                  data-current={isCurrent || undefined}
                  className={
                    "flex gap-2 rounded-md px-1.5 py-1 " +
                    (isCurrent ? "bg-accent/10 ring-1 ring-accent/40" : "")
                  }
                >
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: m.color, color: readableTextColor(m.color) }}
                  >
                    <Icon size={10} />
                  </span>
                  <span className="min-w-0">
                    <span className="text-[11px] font-semibold text-ink">
                      {lvl} · {m.label}
                    </span>
                    <span className="block text-[11px] leading-snug text-ink-muted">{m.meaning}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
