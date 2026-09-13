"use client";

/**
 * Sélecteur de TAXONOMIE (T20 / T14 / T11 / T10) — change la grille de lecture d'un
 * contrat sans jamais toucher aux données.
 *
 * T20 est la taxonomie annotée et stockée ; les trois autres sont des projections
 * calculées à l'affichage. Basculer est instantané et réversible : aucune écriture, aucune
 * duplication. Le libellé porte le nombre de classes, et l'info-bulle la raison d'être du
 * schéma — c'est ce qui évite de choisir une taxonomie au hasard.
 *
 * Contrôle segmenté accessible (radiogroup + roving tabindex), même patron que la bascule
 * de langue, pour que les deux réglages de lecture se manipulent de la même façon.
 */

import { useRef } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { TAXONOMIES, type TaxonomyId } from "@/lib/taxonomy";

export interface TaxonomySwitchProps {
  value: TaxonomyId;
  onChange: (value: TaxonomyId) => void;
  testIdPrefix?: string;
  /** Affiche l'icône de rappel (grille de lecture) à gauche du groupe. */
  withIcon?: boolean;
}

export function TaxonomySwitch({
  value,
  onChange,
  testIdPrefix = "taxonomy",
  withIcon = true,
}: TaxonomySwitchProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + dir + TAXONOMIES.length) % TAXONOMIES.length;
    onChange(TAXONOMIES[next]!.id);
    refs.current[next]?.focus();
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {withIcon && <Layers size={14} className="text-ink-muted" aria-hidden />}
      <div
        role="radiogroup"
        aria-label="Taxonomie de lecture"
        data-testid={`${testIdPrefix}-switch`}
        className="inline-flex items-center rounded-md border border-line bg-panel-muted/40 p-0.5"
      >
        {TAXONOMIES.map((taxonomy, idx) => {
          const active = value === taxonomy.id;
          return (
            <button
              key={taxonomy.id}
              ref={(el) => {
                refs.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-testid={`${testIdPrefix}-${taxonomy.id}`}
              title={`${taxonomy.label} (${taxonomy.short}) — ${taxonomy.rationale}`}
              onClick={() => onChange(taxonomy.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={cn(
                "rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors",
                active
                  ? "bg-accent/15 text-ink shadow-sm ring-1 ring-accent/40"
                  : "text-ink-muted hover:bg-panel-muted",
              )}
            >
              {taxonomy.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
