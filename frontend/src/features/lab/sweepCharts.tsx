"use client";

/**
 * Figure F5 — courbe d'apprentissage (et sa cousine : dégradation au bruit).
 *
 * Honnêteté visuelle imposée par le dossier 03 §c : la zone d'EXTRAPOLATION est
 * distinguée par un motif ET un attribut (jamais la couleur seule), bornée à ~2,5×
 * la plus grande taille observée, et la courbe ajustée est en pointillés — c'est un
 * ajustement, pas une donnée.
 */

import { Figure } from "@/features/analysis/charts/Figure";
import { TEXTURE_ID, VIZ_VARS, seriesColor } from "@/features/analysis/charts/palette";
import { extent, scaleLinear, ticks } from "@/features/analysis/charts/scales";

import {
  extrapolationLimit,
  fitPowerLaw,
  powerLawValue,
  type SweepPoint,
} from "./sweepAnalysis";

export interface CurveGroup {
  x: number;
  values: number[];
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function LearningCurveFigure({
  groups,
  points,
  humanCeiling,
  xLabel,
  fitCurve = true,
  title,
  subtitle,
}: {
  /** Un groupe par taille (x) avec ses répétitions. */
  groups: CurveGroup[];
  /** Tous les points bruts (taille × répétition). */
  points: SweepPoint[];
  humanCeiling?: number | null;
  xLabel: string;
  /** Loi de puissance + extrapolation — pertinent pour la taille d'entraînement,
   * pas pour le bruit (où la “courbe” n'a aucune asymptote à estimer). */
  fitCurve?: boolean;
  title: string;
  subtitle?: string;
}) {
  const width = 640;
  const height = 320;
  const margin = { top: 16, right: 24, bottom: 40, left: 48 };

  const fit = fitCurve ? fitPowerLaw(points) : null;
  const observedMaxX = Math.max(...groups.map((g) => g.x), 0);
  const domainMaxX = fit ? extrapolationLimit(points) : observedMaxX;

  const ys = [
    ...points.map((p) => p.y),
    ...(humanCeiling != null ? [humanCeiling] : []),
    ...(fit ? [powerLawValue(fit, domainMaxX)] : []),
  ];
  const yDomain = extent(ys);
  const x = scaleLinear({ min: 0, max: domainMaxX }, { min: margin.left, max: width - margin.right });
  const y = scaleLinear(yDomain, { min: height - margin.bottom, max: margin.top });

  const sorted = [...groups].sort((a, b) => a.x - b.x);
  const meanPath = sorted
    .map((g, i) => `${i === 0 ? "M" : "L"}${x(g.x)},${y(mean(g.values))}`)
    .join(" ");

  const fitSamples: SweepPoint[] = [];
  if (fit) {
    for (let i = 0; i <= 40; i += 1) {
      const px = (domainMaxX * i) / 40;
      if (px >= Math.min(...sorted.map((g) => g.x))) {
        fitSamples.push({ x: px, y: powerLawValue(fit, px) });
      }
    }
  }

  const columns = [
    { key: "x", label: xLabel },
    { key: "mean", label: "moyenne" },
    { key: "min", label: "min" },
    { key: "max", label: "max" },
    { key: "n", label: "répétitions" },
  ];
  const rows = sorted.map((g) => ({
    x: g.x,
    mean: mean(g.values).toFixed(3),
    min: Math.min(...g.values).toFixed(3),
    max: Math.max(...g.values).toFixed(3),
    n: g.values.length,
  }));

  return (
    <Figure
      title={title}
      subtitle={subtitle}
      caption={
        fit
          ? `Ajustement F1(n) = a − b·n^(−c) (a=${fit.a.toFixed(3)}, c=${fit.c.toFixed(2)}) — ` +
            `au-delà de ${observedMaxX}, la zone hachurée est une extrapolation, bornée à ${domainMaxX}.`
          : `${points.length} runs, ${sorted.length} valeurs de ${xLabel}.`
      }
      width={width}
      height={height}
      columns={columns}
      rows={rows}
      emptyMessage="Aucun run terminé dans ce sweep — lancez l'expérience, la courbe se construira ici."
      legend={[
        { label: "runs individuels", color: seriesColor(0), shape: "square" },
        { label: "moyenne par taille", color: seriesColor(0), shape: "line" },
        ...(fit ? [{ label: "ajustement (pointillés)", color: seriesColor(1), shape: "line" as const }] : []),
        ...(humanCeiling != null
          ? [{ label: "plafond humain approximé", color: VIZ_VARS.threshold, shape: "line" as const }]
          : []),
      ]}
      testId="figure-learning-curve"
    >
      {rows.length > 0 && (
        <>
          {/* Zone d'extrapolation : motif + attribut, jamais la couleur seule. */}
          {fit && domainMaxX > observedMaxX && (
            <rect
              x={x(observedMaxX)}
              y={margin.top}
              width={x(domainMaxX) - x(observedMaxX)}
              height={height - margin.top - margin.bottom}
              fill={`url(#${TEXTURE_ID})`}
              opacity={0.35}
              data-extrapolated="true"
              data-testid="curve-extrapolation-zone"
            />
          )}
          {ticks(yDomain, 5).map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={VIZ_VARS.grid}
              />
              <text
                x={margin.left - 6}
                y={y(tick) + 3}
                textAnchor="end"
                fontSize={10}
                fill={VIZ_VARS.inkMuted}
              >
                {tick.toFixed(2)}
              </text>
            </g>
          ))}
          {sorted.map((g) => (
            <text
              key={`x-${g.x}`}
              x={x(g.x)}
              y={height - margin.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill={VIZ_VARS.inkMuted}
            >
              {g.x}
            </text>
          ))}
          <text
            x={(margin.left + width - margin.right) / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize={10}
            fill={VIZ_VARS.inkMuted}
          >
            {xLabel}
          </text>

          {humanCeiling != null && (
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(humanCeiling)}
              y2={y(humanCeiling)}
              stroke={VIZ_VARS.threshold}
              strokeDasharray="2 3"
              data-testid="curve-ceiling"
            />
          )}

          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(p.x)}
              cy={y(p.y)}
              r={2.5}
              fill={seriesColor(0)}
              fillOpacity={0.45}
            />
          ))}
          <path d={meanPath} fill="none" stroke={seriesColor(0)} strokeWidth={1.5} />
          {fit && fitSamples.length > 1 && (
            <path
              d={fitSamples.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.x)},${y(p.y)}`).join(" ")}
              fill="none"
              stroke={seriesColor(1)}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              data-testid="curve-fit"
            />
          )}
        </>
      )}
    </Figure>
  );
}
