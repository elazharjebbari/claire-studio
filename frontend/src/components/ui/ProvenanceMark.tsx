"use client";

/**
 * ProvenanceMark — marque de validation & provenance (3 types) réutilisable.
 * Forme = provenance (⚡ moteur / ★ pré-annotation / ✎ manuel) ; couleur = état (validé/à
 * valider). Jamais la couleur seule : glyphe + title/aria-label textuels (WCAG AA).
 * Source de vérité : lib/validationDisplay (pur).
 */

import { cn } from "@/lib/cn";
import { TRIAGE_LEVEL_META } from "@/lib/triage";
import { validationDisplay, type ValidationInput } from "@/lib/validationDisplay";

export interface ProvenanceMarkProps {
  clause: ValidationInput;
  /** Affiche le code Cx (couleur du niveau) à côté de ⚡ pour la provenance « moteur ». */
  showLevel?: boolean;
  className?: string;
}

export function ProvenanceMark({ clause, showLevel = true, className }: ProvenanceMarkProps) {
  const d = validationDisplay(clause);
  return (
    <span
      data-testid="provenance-mark"
      data-provenance={d.validated ? d.provenance : "pending"}
      data-state={d.state}
      title={d.label}
      aria-label={d.label}
      className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold leading-none", d.colorClass, className)}
    >
      <span aria-hidden>{d.glyph}</span>
      {showLevel && d.validated && d.provenance === "moteur" && d.level && (
        <span aria-hidden className="font-semibold" style={{ color: TRIAGE_LEVEL_META[d.level].color }}>
          {d.level}
        </span>
      )}
    </span>
  );
}
