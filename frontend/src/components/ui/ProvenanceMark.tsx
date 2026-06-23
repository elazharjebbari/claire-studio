"use client";

/**
 * ProvenanceMark — marque de validation & provenance (3 types) réutilisable.
 * Icônes PREMIUM (lucide) : forme = provenance (⚡ Zap moteur / ✦ Sparkles pré-annotation /
 * ✎ PenLine manuel / ◷ Clock à valider) ; couleur = état (validé emerald / à valider amber).
 * Jamais la couleur seule : icône + title/aria-label textuels (WCAG AA).
 * Source de vérité : lib/validationDisplay (pur).
 */

import { Clock, PenLine, Sparkles, Zap, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { TRIAGE_LEVEL_META } from "@/lib/triage";
import { validationDisplay, type ValidationInput, type ValidationProvenance } from "@/lib/validationDisplay";

const PROVENANCE_ICON: Record<ValidationProvenance, LucideIcon> = {
  moteur: Zap,
  pre_annotation: Sparkles,
  manuel: PenLine,
};

export interface ProvenanceMarkProps {
  clause: ValidationInput;
  /** Affiche le code Cx (couleur du niveau) à côté de ⚡ pour la provenance « moteur ». */
  showLevel?: boolean;
  /** Taille de l'icône (px). */
  size?: number;
  className?: string;
}

export function ProvenanceMark({ clause, showLevel = true, size = 12, className }: ProvenanceMarkProps) {
  const d = validationDisplay(clause);
  const Icon: LucideIcon = d.validated ? PROVENANCE_ICON[d.provenance] : Clock;
  return (
    <span
      data-testid="provenance-mark"
      data-provenance={d.validated ? d.provenance : "pending"}
      data-state={d.state}
      title={d.label}
      aria-label={d.label}
      className={cn("inline-flex items-center gap-0.5 leading-none", d.colorClass, className)}
    >
      <Icon size={size} strokeWidth={2.5} aria-hidden />
      {showLevel && d.validated && d.provenance === "moteur" && d.level && (
        <span aria-hidden className="text-[10px] font-bold" style={{ color: TRIAGE_LEVEL_META[d.level].color }}>
          {d.level}
        </span>
      )}
    </span>
  );
}
