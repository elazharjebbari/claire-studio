"use client";

/**
 * SelectionTools (axe 4) — groupe d'actions de SÉLECTION MULTIPLE, regroupées et
 * nommées dans la barre d'outils du document (au lieu d'un bouton isolé). Actions :
 *  - Jusqu'à la frontière suivante (tous modèles confondus) ;
 *  - Segment courant (le run qui couvre la phrase focalisée) ;
 *  - Tout le thème courant (toutes les phrases du même thème, même non contiguës) ;
 *  - Tout le document ;
 *  - Effacer (avec compteur de phrases sélectionnées).
 *
 * Présentationnel : les calculs (runs, frontières) restent dans DocumentPanel et
 * sont fournis via callbacks. Cohérent avec les groupes segmentés existants.
 */

import { TextSelect, X } from "lucide-react";

export interface SelectionToolsProps {
  selectedCount: number;
  onToBoundary: () => void;
  onCurrentSegment: () => void;
  onWholeTheme: () => void;
  onAll: () => void;
  onClear: () => void;
}

export function SelectionTools({
  selectedCount,
  onToBoundary,
  onCurrentSegment,
  onWholeTheme,
  onAll,
  onClear,
}: SelectionToolsProps) {
  const btn =
    "rounded px-1.5 py-0.5 text-xs font-medium text-ink-muted transition-colors hover:bg-panel-muted hover:text-ink";
  return (
    <div
      role="group"
      aria-label="Sélections multiples"
      data-testid="selection-tools"
      className="inline-flex items-center gap-0.5 rounded-md border border-line p-0.5"
    >
      <span className="flex items-center gap-1 px-1 text-[10px] uppercase tracking-wide text-ink-muted">
        <TextSelect size={12} aria-hidden /> Sélection
      </span>
      <button
        type="button"
        data-testid="select-to-boundary"
        onClick={onToBoundary}
        title="Sélectionner de la phrase courante jusqu'à la frontière suivante (tous modèles confondus)"
        className={btn}
      >
        Frontière
      </button>
      <button
        type="button"
        data-testid="select-segment"
        onClick={onCurrentSegment}
        title="Sélectionner le segment courant (le bloc de même thème qui couvre la phrase focalisée)"
        className={btn}
      >
        Segment
      </button>
      <button
        type="button"
        data-testid="select-theme"
        onClick={onWholeTheme}
        title="Sélectionner toutes les phrases du thème courant dans le document"
        className={btn}
      >
        Thème
      </button>
      <button
        type="button"
        data-testid="select-all"
        onClick={onAll}
        title="Sélectionner tout le document"
        className={btn}
      >
        Tout
      </button>
      {selectedCount > 0 && (
        <>
          <span
            data-testid="selection-count"
            className="ml-0.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent"
            aria-label={`${selectedCount} phrases sélectionnées`}
          >
            {selectedCount}
          </span>
          <button
            type="button"
            data-testid="selection-clear"
            onClick={onClear}
            title="Effacer la sélection"
            aria-label="Effacer la sélection"
            className="rounded p-0.5 text-ink-muted transition-colors hover:bg-panel-muted hover:text-ink"
          >
            <X size={13} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
