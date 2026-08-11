"use client";

/**
 * Figures F6–F10 — les résultats d'expérience du Lab.
 *
 * Distinctes de `features/analysis/charts/figures.tsx` (F1–F4, F11, F12 : mesures sur
 * un snapshot d'annotations) parce qu'elles portent sur un objet différent — le RÉSULTAT
 * d'un run supervisé — mais réutilisent les mêmes primitives (`Figure`, échelles,
 * palette validée) : un seul système visuel, deux familles de données.
 */

import { Figure } from "@/features/analysis/charts/Figure";
import { VIZ_VARS, seriesColor, sequentialOpacity } from "@/features/analysis/charts/palette";
import {
  extent,
  formatPercent,
  formatTick,
  scaleBand,
  scaleLinear,
  scaleLog,
  ticks,
} from "@/features/analysis/charts/scales";

const PAD = { left: 56, right: 16, top: 12, bottom: 34 };

function Grid({ width, height, values, scale }: {
  width: number; height: number; values: number[]; scale: (v: number) => number;
}) {
  return (
    <g aria-hidden>
      {values.map((value) => (
        <line
          key={value}
          x1={PAD.left}
          x2={width - PAD.right}
          y1={scale(value)}
          y2={scale(value)}
          stroke={VIZ_VARS.grid}
          strokeWidth={1}
        />
      ))}
      <line
        x1={PAD.left}
        x2={PAD.left}
        y1={PAD.top}
        y2={height - PAD.bottom}
        stroke={VIZ_VARS.axis}
        strokeWidth={1}
      />
    </g>
  );
}

// --------------------------------------------------------------------------- //
// F6 — score par étiquette vs support
// --------------------------------------------------------------------------- //

export interface LabelScoreRow {
  label: string;
  f1: number;
  support: number;
}

/**
 * F6 — explique VISUELLEMENT l'écart micro/macro-F1 : les points à gauche (support
 * faible) tombent bas, ceux à droite (support fort) tiennent le score global.
 */
export function LabelScoreFigure({ rows }: { rows: LabelScoreRow[] }) {
  const width = 640;
  const height = 300;
  const supportDomain = extent([1, ...rows.map((r) => Math.max(1, r.support))]);
  const x = scaleLog(supportDomain, { min: PAD.left, max: width - PAD.right });
  const y = scaleLinear({ min: 0, max: 1 }, { max: PAD.top, min: height - PAD.bottom });
  const gridValues = ticks({ min: 0, max: 1 }, 5);

  return (
    <Figure
      testId="figure-label-scores"
      title="Score par étiquette selon le support"
      subtitle="F1 par thème — la longue traîne explique l'écart micro/macro"
      caption={`${rows.length} thèmes`}
      width={width}
      height={height}
      columns={[
        { key: "label", label: "Thème" },
        { key: "f1", label: "F1" },
        { key: "support", label: "Support" },
      ]}
      rows={rows.map((r) => ({ label: r.label, f1: r.f1.toFixed(3), support: r.support }))}
      emptyMessage="Aucun score par étiquette : ce run n'a pas encore de résultats."
      legend={[{ label: "thème", color: seriesColor(0) }]}
    >
      <Grid width={width} height={height} values={gridValues} scale={y} />
      {gridValues.map((value) => (
        <text
          key={value}
          x={PAD.left - 6}
          y={y(value) + 3}
          textAnchor="end"
          fontSize={10}
          fill={VIZ_VARS.inkMuted}
        >
          {formatTick(value)}
        </text>
      ))}
      {rows.map((row) => (
        <circle
          key={row.label}
          cx={x(Math.max(1, row.support))}
          cy={y(row.f1)}
          r={5}
          fill={seriesColor(0)}
          stroke={VIZ_VARS.surface}
          strokeWidth={2}
        >
          <title>{`${row.label} : F1 ${row.f1.toFixed(3)} (support ${row.support})`}</title>
        </circle>
      ))}
      <text
        x={(PAD.left + width - PAD.right) / 2}
        y={height - 6}
        textAnchor="middle"
        fontSize={10}
        fill={VIZ_VARS.inkMuted}
      >
        support (échelle log)
      </text>
    </Figure>
  );
}

// --------------------------------------------------------------------------- //
// F8 — matrice de confusion
// --------------------------------------------------------------------------- //

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

/**
 * F8 — carte de chaleur séquentielle, diagonale mise en évidence.
 *
 * Croiser cette figure avec l'IAA (`figure-matrix` de l'onglet Fiabilité) répond à
 * une question précise : les paires que le modèle confond sont-elles les mêmes que
 * celles où les humains divergent ? Si oui, l'ambiguïté est dans la tâche, pas le modèle.
 */
export function ConfusionMatrixFigure({ matrix }: { matrix: ConfusionMatrix | null }) {
  const size = 34;
  const labelSpace = 100;
  const labels = matrix?.labels ?? [];
  const width = labelSpace + labels.length * size + 16;
  const height = labelSpace + labels.length * size + 16;
  const maxOffDiagonal = Math.max(
    1,
    ...(matrix?.matrix.flatMap((row, i) => row.filter((_, j) => j !== i)) ?? [0]),
  );

  const rows = labels.flatMap((trueLabel, i) =>
    labels.map((predLabel, j) => ({
      trueLabel,
      predLabel,
      count: matrix?.matrix[i]?.[j] ?? 0,
    })),
  ).filter((r) => r.count > 0);

  return (
    <Figure
      testId="figure-confusion"
      title="Matrice de confusion"
      subtitle="Vérité (lignes) contre prédiction (colonnes)"
      width={width}
      height={height}
      columns={[
        { key: "trueLabel", label: "Vérité" },
        { key: "predLabel", label: "Prédit" },
        { key: "count", label: "n" },
      ]}
      rows={rows}
      emptyMessage="Aucune prédiction : ce run n'a pas encore de résultats de test."
    >
      {labels.map((label, i) => (
        <g key={label}>
          <text
            x={labelSpace - 6}
            y={labelSpace + i * size + size / 2 + 3}
            textAnchor="end"
            fontSize={9}
            fill={VIZ_VARS.inkMuted}
          >
            {label}
          </text>
          <text
            x={labelSpace + i * size + size / 2}
            y={labelSpace - 8}
            fontSize={9}
            fill={VIZ_VARS.inkMuted}
            transform={`rotate(-45 ${labelSpace + i * size + size / 2} ${labelSpace - 8})`}
          >
            {label}
          </text>
        </g>
      ))}
      {labels.map((trueLabel, i) =>
        labels.map((predLabel, j) => {
          const count = matrix?.matrix[i]?.[j] ?? 0;
          const isDiagonal = i === j;
          return (
            <g key={`${i}-${j}`}>
              <rect
                x={labelSpace + j * size + 1}
                y={labelSpace + i * size + 1}
                width={size - 2}
                height={size - 2}
                rx={3}
                fill={isDiagonal ? VIZ_VARS.positive : seriesColor(0)}
                fillOpacity={
                  isDiagonal
                    ? sequentialOpacity(count, Math.max(1, matrix?.matrix[i]?.[i] ?? 1))
                    : sequentialOpacity(count, maxOffDiagonal)
                }
              >
                <title>{`${trueLabel} → ${predLabel} : ${count}`}</title>
              </rect>
              {count > 0 && (
                <text
                  x={labelSpace + j * size + size / 2}
                  y={labelSpace + i * size + size / 2 + 3}
                  textAnchor="middle"
                  fontSize={8}
                  fill={VIZ_VARS.ink}
                >
                  {count}
                </text>
              )}
            </g>
          );
        }),
      )}
    </Figure>
  );
}

// --------------------------------------------------------------------------- //
// F9 — humains / modèles / juges LLM
// --------------------------------------------------------------------------- //

export interface ComparisonRow {
  runId: string;
  label: string;
  value: number | null;
  ci?: { low: number | null; high: number | null } | null;
}

/**
 * F9 — la figure de conclusion : où se situe le modèle supervisé entre le plafond
 * humain et les 4 juges LLM ? Barres horizontales, plafond en ligne de référence — un
 * score sans lui est ininterprétable (cf. `docs/pactiva-lab/01_PLAN_SCIENTIFIQUE.md` §3.2).
 */
export function RunComparisonFigure({
  rows,
  humanCeiling,
  metric = "macro-F1",
}: {
  rows: ComparisonRow[];
  humanCeiling?: number | null;
  metric?: string;
}) {
  const width = 640;
  const eligible = rows.filter((r) => r.value != null);
  const height = 56 + eligible.length * 30;
  const domainMax = Math.max(1, humanCeiling ?? 0, ...eligible.map((r) => r.value ?? 0));
  const x = scaleLinear({ min: 0, max: domainMax }, { min: 190, max: width - 40 });

  return (
    <Figure
      testId="figure-run-comparison"
      title={`Comparaison des runs (${metric})`}
      subtitle="Barres à la même échelle que le plafond humain"
      caption={humanCeiling != null ? `plafond humain : ${humanCeiling.toFixed(3)}` : undefined}
      width={width}
      height={Math.max(height, 100)}
      columns={[
        { key: "label", label: "Run" },
        { key: "value", label: metric },
        { key: "low", label: "IC bas" },
        { key: "high", label: "IC haut" },
      ]}
      rows={eligible.map((r) => ({
        label: r.label,
        value: r.value?.toFixed(3) ?? "—",
        low: r.ci?.low?.toFixed(3) ?? "—",
        high: r.ci?.high?.toFixed(3) ?? "—",
      }))}
      emptyMessage="Sélectionnez au moins deux runs comparables pour afficher cette figure."
      legend={[
        { label: "score du run", color: seriesColor(0) },
        ...(humanCeiling != null
          ? [{ label: "plafond humain", color: VIZ_VARS.threshold, shape: "line" as const }]
          : []),
      ]}
    >
      {humanCeiling != null && (
        <g>
          <line
            x1={x(humanCeiling)}
            x2={x(humanCeiling)}
            y1={16}
            y2={height - 16}
            stroke={VIZ_VARS.threshold}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <text
            x={x(humanCeiling)}
            y={14}
            textAnchor="middle"
            fontSize={9}
            fill={VIZ_VARS.inkMuted}
          >
            plafond humain
          </text>
        </g>
      )}
      {eligible.map((row, index) => {
        const y0 = 24 + index * 30;
        const barWidth = Math.max(1, x(row.value ?? 0) - 190);
        return (
          <g key={row.runId}>
            <text x={186} y={y0 + 14} textAnchor="end" fontSize={10} fill={VIZ_VARS.ink}>
              {row.label}
            </text>
            <rect x={190} y={y0} width={barWidth} height={18} rx={4} fill={seriesColor(0)}>
              <title>{`${row.label} : ${row.value?.toFixed(3)}`}</title>
            </rect>
            {row.ci?.low != null && row.ci?.high != null && (
              <line
                x1={x(row.ci.low)}
                x2={x(row.ci.high)}
                y1={y0 + 9}
                y2={y0 + 9}
                stroke={VIZ_VARS.ink}
                strokeWidth={1.5}
              />
            )}
            <text x={x(row.value ?? 0) + 6} y={y0 + 14} fontSize={10} fill={VIZ_VARS.inkMuted}>
              {row.value?.toFixed(3)}
            </text>
          </g>
        );
      })}
    </Figure>
  );
}

// --------------------------------------------------------------------------- //
// F10 — calibration
// --------------------------------------------------------------------------- //

export interface ReliabilityBucket {
  bin: number;
  meanConfidence: number;
  accuracy: number;
  count: number;
}

/**
 * F10 — diagramme de fiabilité, diagonale idéale en référence.
 *
 * Utile si le modèle doit un jour assister l'annotation : une suggestion annoncée à
 * « 95 % » qui n'a raison que 60 % du temps détruit la confiance dans l'outil.
 */
export function CalibrationFigure({ buckets, ece }: {
  buckets: ReliabilityBucket[]; ece?: number | null;
}) {
  const width = 320;
  const height = 320;
  const scale = scaleLinear({ min: 0, max: 1 }, { min: PAD.left, max: width - PAD.right });
  const yScale = scaleLinear({ min: 0, max: 1 }, { max: PAD.top, min: height - PAD.bottom });
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <Figure
      testId="figure-calibration"
      title="Calibration"
      subtitle="Confiance annoncée contre exactitude observée, par tranche"
      caption={ece != null ? `ECE = ${ece.toFixed(3)} (0 = parfaitement calibré)` : undefined}
      width={width}
      height={height}
      columns={[
        { key: "bin", label: "Tranche" },
        { key: "confidence", label: "Confiance moy." },
        { key: "accuracy", label: "Exactitude" },
        { key: "count", label: "n" },
      ]}
      rows={buckets.map((b) => ({
        bin: `bin ${b.bin}`,
        confidence: formatPercent(b.meanConfidence),
        accuracy: formatPercent(b.accuracy),
        count: b.count,
      }))}
      emptyMessage="Aucune prédiction assortie d'une confiance : la calibration n'est pas mesurable."
      legend={[
        { label: "calibration idéale", color: VIZ_VARS.threshold, shape: "line" },
        { label: "observé (taille = n)", color: seriesColor(0) },
      ]}
    >
      <line
        x1={scale(0)}
        y1={yScale(0)}
        x2={scale(1)}
        y2={yScale(1)}
        stroke={VIZ_VARS.threshold}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      <Grid width={width} height={height} values={ticks({ min: 0, max: 1 }, 5)} scale={yScale} />
      {buckets.map((bucket) => (
        <circle
          key={bucket.bin}
          cx={scale(bucket.meanConfidence)}
          cy={yScale(bucket.accuracy)}
          r={3 + 5 * (bucket.count / maxCount)}
          fill={seriesColor(0)}
          fillOpacity={0.85}
          stroke={VIZ_VARS.surface}
          strokeWidth={1.5}
        >
          <title>
            {`confiance ${formatPercent(bucket.meanConfidence)} · exactitude ${formatPercent(bucket.accuracy)} (n=${bucket.count})`}
          </title>
        </circle>
      ))}
    </Figure>
  );
}
