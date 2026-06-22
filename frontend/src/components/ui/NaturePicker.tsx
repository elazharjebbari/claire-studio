"use client";

/**
 * NaturePicker — sélecteur compact de NATURE JURIDIQUE d'une clause (axe 2).
 *
 * Remplace le `<select>` natif de l'inspecteur par des pastilles cohérentes avec
 * ThemePalette : toutes les natures visibles d'un coup, sélection effaçable, et
 * info-bulle explicative au survol prolongé (la `definition` du schéma) — pour
 * comprendre « pourquoi cette nature » sans quitter le geste d'annotation.
 *
 * Accessible : `role="radiogroup"` + `role="radio"`, navigable au clavier.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { LegalNature } from "@/types/contract";

export interface NaturePickerProps {
  value: string | null | undefined;
  legalNatures: LegalNature[];
  onChange: (code: string | null) => void;
  /** Info-bulle (libellé + définition) au survol prolongé. */
  describeOnHover?: boolean;
}

export function NaturePicker({
  value,
  legalNatures,
  onChange,
  describeOnHover = false,
}: NaturePickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function armTooltip(code: string) {
    if (!describeOnHover) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(code), 400);
  }
  function disarmTooltip() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(null);
  }
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  const hoveredNature = hovered ? legalNatures.find((n) => n.code === hovered) : null;

  if (legalNatures.length === 0) {
    return <p className="text-xs text-ink-muted">Aucune nature dans le schéma.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5" data-testid="nature-picker">
      <div
        role="radiogroup"
        aria-label="Nature juridique"
        className="flex flex-wrap items-center gap-1"
      >
        {/* Option « aucune » — efface la nature. */}
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          data-testid="nature-option-none"
          onClick={() => onChange(null)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
            !value
              ? "border-accent/50 bg-accent/15 text-ink ring-1 ring-accent/40"
              : "border-line text-ink-muted hover:bg-panel-muted",
          )}
        >
          — aucune —
        </button>
        {legalNatures.map((n) => {
          const selected = value === n.code;
          return (
            <button
              key={n.code}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`nature-option-${n.code}`}
              title={n.definition ? `${n.label} — ${n.definition}` : n.label}
              aria-describedby={describeOnHover ? "nature-tooltip" : undefined}
              onMouseEnter={() => armTooltip(n.code)}
              onMouseLeave={disarmTooltip}
              onFocus={() => armTooltip(n.code)}
              onBlur={disarmTooltip}
              onClick={() => onChange(selected ? null : n.code)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                selected
                  ? "border-accent/50 bg-accent/15 text-ink ring-1 ring-accent/40"
                  : "border-line text-ink-muted hover:bg-panel-muted",
              )}
            >
              {n.label}
            </button>
          );
        })}
      </div>
      {/* Info-bulle d'intention : libellé + définition (doc annotateur). */}
      {describeOnHover && hoveredNature && (
        <div
          id="nature-tooltip"
          role="tooltip"
          data-testid="nature-tooltip"
          className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-xs"
        >
          <div className="font-semibold text-ink">{hoveredNature.label}</div>
          {hoveredNature.definition && (
            <p className="mt-0.5 text-ink-muted">{hoveredNature.definition}</p>
          )}
        </div>
      )}
    </div>
  );
}
