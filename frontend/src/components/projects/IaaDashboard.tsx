"use client";

/**
 * Tableau de bord IAA (feature 10) — κ de Cohen par thème + accord sur les
 * frontières + accord global, à partir de /projects/{slug}/progress. Graphe à
 * barres « maison » (SVG/CSS, sans dépendance lourde), barres colorées par le
 * thème (tokens vocabulaire) et interprétation Landis & Koch en légende.
 */

import type { IaaDetail } from "@/types/contract";
import { Panel } from "@/components/ui/primitives";
import { getThemeToken } from "@/lib/tokens";

/** Interprétation Landis & Koch du κ de Cohen. */
function kappaStrength(kappa: number): { label: string; tone: string } {
  if (kappa < 0.2) return { label: "faible", tone: "text-red-400" };
  if (kappa < 0.4) return { label: "passable", tone: "text-orange-400" };
  if (kappa < 0.6) return { label: "modéré", tone: "text-amber-400" };
  if (kappa < 0.8) return { label: "substantiel", tone: "text-lime-400" };
  return { label: "quasi-parfait", tone: "text-emerald-400" };
}

function KappaBar({
  label,
  kappa,
  support,
  color,
  testId,
}: {
  label: string;
  kappa: number;
  support: number;
  color: string;
  testId?: string;
}) {
  // κ peut être négatif ; on clampe l'affichage de la barre à [0, 1].
  const pct = Math.max(0, Math.min(1, kappa)) * 100;
  const strength = kappaStrength(kappa);

  return (
    <li className="flex items-center gap-3 text-sm" data-testid={testId}>
      <span className="w-44 shrink-0 truncate text-ink" title={label}>
        {label}
      </span>
      <div
        className="relative h-3 flex-1 overflow-hidden rounded-full bg-panel-muted"
        role="meter"
        aria-valuenow={Number(kappa.toFixed(2))}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-label={`κ ${label}`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-ink">{kappa.toFixed(2)}</span>
      <span className={`w-24 shrink-0 text-right text-xs ${strength.tone}`}>
        {strength.label}
      </span>
      <span className="w-12 shrink-0 text-right text-[11px] text-ink-muted">n={support}</span>
    </li>
  );
}

export function IaaDashboard({ detail }: { detail: IaaDetail }) {
  const sorted = detail.perTheme.slice().sort((a, b) => b.kappa - a.kappa);

  return (
    <Panel className="p-4" data-testid="iaa-dashboard">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-ink">Accord inter-annotateurs (κ de Cohen)</h2>
        <span className="text-xs text-ink-muted">{detail.annotatorPairs} paire(s) comparée(s)</span>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-panel-muted p-3 text-center" data-testid="iaa-global">
          <div className="text-2xl font-semibold text-ink">{detail.globalKappa.toFixed(2)}</div>
          <div className="text-xs uppercase text-ink-muted">accord global</div>
          <div className={`text-xs ${kappaStrength(detail.globalKappa).tone}`}>
            {kappaStrength(detail.globalKappa).label}
          </div>
        </div>
        <div className="rounded-md border border-line bg-panel-muted p-3 text-center" data-testid="iaa-boundaries">
          <div className="text-2xl font-semibold text-ink">{detail.boundaryKappa.toFixed(2)}</div>
          <div className="text-xs uppercase text-ink-muted">frontières de clause</div>
          <div className={`text-xs ${kappaStrength(detail.boundaryKappa).tone}`}>
            {kappaStrength(detail.boundaryKappa).label}
          </div>
        </div>
      </div>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        κ par thème
      </h3>
      <ul className="flex flex-col gap-2">
        {sorted.map((t) => (
          <KappaBar
            key={t.code}
            label={t.label}
            kappa={t.kappa}
            support={t.support}
            color={getThemeToken(t.code).color}
            testId={`iaa-theme-${t.code}`}
          />
        ))}
      </ul>
    </Panel>
  );
}
