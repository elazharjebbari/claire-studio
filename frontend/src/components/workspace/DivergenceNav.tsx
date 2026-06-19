"use client";

/**
 * DivergenceNav (P1) — barre compacte de navigation des divergences Claude/Codex.
 * Flèches ◂ ▸ + compteur « k / N ». Affichée en mode comparaison quand il existe
 * au moins une divergence. Les sauts déplacent le focus du document (centré) ;
 * la logique d'index est pure (lib/divergence.ts), ce composant n'est que l'UI.
 *
 * Raccourcis miroir : n (suivant) / p (précédent), gérés par useDivergenceShortcuts.
 */

interface DivergenceNavProps {
  /** Nombre total de segments de divergence. */
  count: number;
  /** Position 1-based du curseur sur une divergence, 0 si hors divergence. */
  ordinal: number;
  onPrev: () => void;
  onNext: () => void;
}

export function DivergenceNav({ count, ordinal, onPrev, onNext }: DivergenceNavProps) {
  if (count === 0) return null;
  return (
    <div
      data-testid="divergence-nav"
      role="navigation"
      aria-label="Navigation des divergences"
      className="mb-4 flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/5 px-3 py-1.5 text-sm"
    >
      <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400" />
      <span className="font-medium text-ink">Divergences</span>
      <span data-testid="divergence-counter" className="font-mono text-ink-muted">
        {ordinal > 0 ? `${ordinal} / ${count}` : `– / ${count}`}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          data-testid="divergence-prev"
          aria-label="Divergence précédente (p)"
          title="Divergence précédente — p"
          onClick={onPrev}
          className="rounded-md border border-line px-2 py-0.5 text-ink hover:bg-panel-muted"
        >
          ◂
        </button>
        <button
          type="button"
          data-testid="divergence-next"
          aria-label="Divergence suivante (n)"
          title="Divergence suivante — n"
          onClick={onNext}
          className="rounded-md border border-line px-2 py-0.5 text-ink hover:bg-panel-muted"
        >
          ▸
        </button>
      </div>
    </div>
  );
}
