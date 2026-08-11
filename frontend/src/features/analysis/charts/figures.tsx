"use client";

/**
 * Les figures de l'article — F1 à F4, produites depuis les métriques du Lab.
 *
 * Aucune figure ne calcule ses propres chiffres : elle reçoit exactement ce que le
 * tableau associé affiche. C'est la seule façon de garantir qu'une figure et un tableau
 * ne racontent jamais deux histoires différentes.
 */

import { Figure } from "./Figure";
import { VIZ_VARS, seriesColor, sequentialOpacity } from "./palette";
import {
  extent,
  formatPercent,
  formatTick,
  logTicks,
  scaleBand,
  scaleLinear,
  scaleLog,
  ticks,
} from "./scales";

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

function YLabels({ values, scale, format = formatTick }: {
  values: number[]; scale: (v: number) => number; format?: (v: number) => string;
}) {
  return (
    <g aria-hidden>
      {values.map((value) => (
        <text
          key={value}
          x={PAD.left - 6}
          y={scale(value) + 3}
          textAnchor="end"
          fontSize={10}
          fill={VIZ_VARS.inkMuted}
        >
          {format(value)}
        </text>
      ))}
    </g>
  );
}

// --------------------------------------------------------------------------- //
// F3 — le coût du multi-label (la figure la plus importante de l'article)
// --------------------------------------------------------------------------- //

export interface AlphaReport {
  alphaMasi: number | null;
  alphaNominal: number | null;
  multiLabelCost: number | null;
  thresholds: { acceptable: number; reliable: number };
  perTheme: Array<{ code: string; alpha: number | null; support: number }>;
  units: number;
}

/**
 * F3 — α-MASI face à α nominal, avec la ligne de seuil.
 *
 * La ligne de seuil FAIT le message : elle montre que le passage au multi-label fait
 * franchir la barre d'acceptabilité vers le bas. Sans elle, deux barres proches ne
 * disent rien.
 */
export function AlphaComparisonFigure({ report }: { report: AlphaReport | null }) {
  const width = 640;
  const height = 260;

  const bars = report
    ? [
        { label: "α nominal (mono-label)", value: report.alphaNominal, slot: 0 },
        { label: "α-MASI (multi-label)", value: report.alphaMasi, slot: 1 },
      ].filter((b) => b.value != null)
    : [];

  const y = scaleLinear({ min: 0, max: 1 }, { max: PAD.top, min: height - PAD.bottom });
  const band = scaleBand(Math.max(1, bars.length), { min: PAD.left, max: width - PAD.right }, 0.45);
  const gridValues = ticks({ min: 0, max: 1 }, 5);

  return (
    <Figure
      testId="figure-alpha"
      title="Ce que coûte le multi-label"
      subtitle="Accord inter-annotateurs sur le même matériau, en distance MASI et en distance nominale"
      caption={
        report
          ? `n = ${report.units} phrases multi-annotées · seuil d'acceptabilité ${report.thresholds.acceptable}`
          : undefined
      }
      width={width}
      height={height}
      columns={[
        { key: "mesure", label: "Mesure" },
        { key: "valeur", label: "α" },
        { key: "bande", label: "Interprétation" },
      ]}
      rows={
        report
          ? [
              {
                mesure: "α nominal (mono-label)",
                valeur: report.alphaNominal ?? "—",
                bande: seuilLabel(report.alphaNominal, report.thresholds),
              },
              {
                mesure: "α-MASI (multi-label)",
                valeur: report.alphaMasi ?? "—",
                bande: seuilLabel(report.alphaMasi, report.thresholds),
              },
              {
                mesure: "Coût du multi-label",
                valeur: report.multiLabelCost ?? "—",
                bande: "écart entre les deux",
              },
            ]
          : []
      }
      emptyMessage="Aucun document multi-annoté : l'accord n'est pas calculable. Faites soumettre au moins deux annotations du même document."
      legend={[
        { label: "mono-label", color: seriesColor(0) },
        { label: "multi-label", color: seriesColor(1) },
        { label: "seuil d'acceptabilité", color: VIZ_VARS.threshold, shape: "line" },
      ]}
    >
      <Grid width={width} height={height} values={gridValues} scale={y} />
      <YLabels values={gridValues} scale={y} />

      {bars.map((bar, index) => {
        const value = bar.value as number;
        const top = y(value);
        const bottom = y(0);
        return (
          <g key={bar.label}>
            {/* Extrémité arrondie côté donnée, ancrée à la ligne de base. */}
            <rect
              x={band.position(index)}
              y={top}
              width={band.bandwidth}
              height={Math.max(1, bottom - top)}
              rx={4}
              fill={seriesColor(bar.slot)}
            />
            <text
              x={band.position(index) + band.bandwidth / 2}
              y={top - 6}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill={VIZ_VARS.ink}
            >
              {value.toFixed(3)}
            </text>
            <text
              x={band.position(index) + band.bandwidth / 2}
              y={height - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill={VIZ_VARS.inkMuted}
            >
              {bar.label}
            </text>
          </g>
        );
      })}

      {report && (
        <g>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(report.thresholds.acceptable)}
            y2={y(report.thresholds.acceptable)}
            stroke={VIZ_VARS.threshold}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <text
            x={width - PAD.right}
            y={y(report.thresholds.acceptable) - 5}
            textAnchor="end"
            fontSize={10}
            fill={VIZ_VARS.inkMuted}
          >
            seuil acceptable {report.thresholds.acceptable}
          </text>
        </g>
      )}
    </Figure>
  );
}

function seuilLabel(value: number | null, thresholds: { acceptable: number; reliable: number }) {
  if (value == null) return "—";
  if (value >= thresholds.reliable) return "fiable";
  if (value >= thresholds.acceptable) return "acceptable";
  return "sous le seuil";
}

// --------------------------------------------------------------------------- //
// F2 — la longue traîne
// --------------------------------------------------------------------------- //

export interface ThemeRow {
  code: string;
  primary: number;
  secondary: number;
  total: number;
}

/**
 * F2 — distribution des thèmes en échelle logarithmique.
 *
 * Le log n'est pas un ornement : de `PREAMBLE_SCOPE` (1 163) à `FEEDBACK` (31), une
 * échelle linéaire écraserait toute la traîne sur l'axe et rendrait la figure muette
 * — or c'est précisément la traîne qui explique l'écart micro/macro-F1.
 */
export function LongTailFigure({ themes, rareThreshold = 50 }: {
  themes: ThemeRow[]; rareThreshold?: number;
}) {
  const width = 720;
  const height = 300;
  const sorted = [...themes].sort((a, b) => b.primary - a.primary);
  const domain = extent([1, ...sorted.map((t) => Math.max(1, t.primary))]);
  const y = scaleLog(domain, { max: PAD.top, min: height - PAD.bottom });
  const band = scaleBand(Math.max(1, sorted.length), { min: PAD.left, max: width - PAD.right }, 0.25);
  const gridValues = logTicks(domain);

  return (
    <Figure
      testId="figure-longtail"
      title="Distribution des thèmes (longue traîne)"
      subtitle="Occurrences en thème primaire, échelle logarithmique"
      caption={`${sorted.length} thèmes · les thèmes sous ${rareThreshold} occurrences sont signalés`}
      width={width}
      height={height}
      columns={[
        { key: "code", label: "Thème" },
        { key: "primary", label: "Primaire" },
        { key: "secondary", label: "Secondaire" },
        { key: "rare", label: "Rare ?" },
      ]}
      rows={sorted.map((t) => ({
        code: t.code,
        primary: t.primary,
        secondary: t.secondary,
        rare: t.total < rareThreshold ? "oui" : "",
      }))}
      emptyMessage="Aucune clause annotée : construisez d'abord un jeu de données."
      legend={[
        { label: "thème courant", color: seriesColor(0) },
        { label: `sous ${rareThreshold} occurrences`, color: seriesColor(3) },
      ]}
    >
      <Grid width={width} height={height} values={gridValues} scale={y} />
      <YLabels values={gridValues} scale={y} />

      {sorted.map((theme, index) => {
        const top = y(Math.max(1, theme.primary));
        const bottom = height - PAD.bottom;
        const isRare = theme.total < rareThreshold;
        return (
          <g key={theme.code}>
            <rect
              x={band.position(index)}
              y={top}
              width={band.bandwidth}
              height={Math.max(1, bottom - top)}
              rx={4}
              fill={isRare ? seriesColor(3) : seriesColor(0)}
            />
            {/* Étiquette directe seulement sur les rares : c'est ce qu'on veut faire
                remarquer. Une valeur sur chaque barre serait du bruit. */}
            {isRare && (
              <text
                x={band.position(index) + band.bandwidth / 2}
                y={top - 5}
                textAnchor="middle"
                fontSize={9}
                fill={VIZ_VARS.ink}
              >
                {theme.primary}
              </text>
            )}
            <text
              x={band.position(index) + band.bandwidth / 2}
              y={height - PAD.bottom + 12}
              textAnchor="end"
              fontSize={8}
              fill={VIZ_VARS.inkMuted}
              transform={`rotate(-45 ${band.position(index) + band.bandwidth / 2} ${height - PAD.bottom + 12})`}
            >
              {theme.code}
            </text>
          </g>
        );
      })}
    </Figure>
  );
}

// --------------------------------------------------------------------------- //
// F4 — thème contre frontière
// --------------------------------------------------------------------------- //

export interface BoundaryRow {
  documentId: number;
  jaccard: number;
  nSentences: number;
  annotators: number;
}

/**
 * F4 — accord de segmentation par document.
 *
 * Cette figure porte le correctif de l'artefact : l'ancien `boundaryKappa` valait 1,000
 * partout. Ici on voit la dispersion réelle (0,39–0,63 sur la production), et la ligne
 * de référence de l'accord thématique rend visible que la frontière est le point dur.
 */
export function BoundaryAgreementFigure({ rows, themeAgreement }: {
  rows: BoundaryRow[]; themeAgreement?: number | null;
}) {
  const width = 640;
  const height = 280;
  const y = scaleLinear({ min: 0, max: 1 }, { max: PAD.top, min: height - PAD.bottom });
  const xDomain = extent([0, ...rows.map((r) => r.nSentences)]);
  const x = scaleLinear(xDomain, { min: PAD.left, max: width - PAD.right });
  const gridValues = ticks({ min: 0, max: 1 }, 5);

  return (
    <Figure
      testId="figure-boundary"
      title="Accord de segmentation par document"
      subtitle="Jaccard des frontières reconstruites (plages de thèmes identiques)"
      caption={`${rows.length} document(s) multi-annoté(s)`}
      width={width}
      height={height}
      columns={[
        { key: "document", label: "Document" },
        { key: "jaccard", label: "Jaccard frontières" },
        { key: "phrases", label: "Phrases" },
        { key: "annotateurs", label: "Annotateurs" },
      ]}
      rows={rows.map((r) => ({
        document: r.documentId,
        jaccard: r.jaccard,
        phrases: r.nSentences,
        annotateurs: r.annotators,
      }))}
      emptyMessage="Aucun document couvert par au moins deux annotateurs : l'accord de segmentation n'est pas calculable."
      legend={[
        { label: "un document", color: seriesColor(0) },
        ...(themeAgreement != null
          ? [{ label: "accord thématique (κ)", color: VIZ_VARS.threshold, shape: "line" as const }]
          : []),
      ]}
    >
      <Grid width={width} height={height} values={gridValues} scale={y} />
      <YLabels values={gridValues} scale={y} format={(v) => formatPercent(v)} />

      {themeAgreement != null && (
        <g>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(themeAgreement)}
            y2={y(themeAgreement)}
            stroke={VIZ_VARS.threshold}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <text
            x={width - PAD.right}
            y={y(themeAgreement) - 5}
            textAnchor="end"
            fontSize={10}
            fill={VIZ_VARS.inkMuted}
          >
            accord thématique {formatPercent(themeAgreement)}
          </text>
        </g>
      )}

      {rows.map((row) => (
        <circle
          key={row.documentId}
          cx={x(row.nSentences)}
          cy={y(row.jaccard)}
          r={5}
          fill={seriesColor(0)}
          stroke={VIZ_VARS.surface}
          strokeWidth={2}
        >
          <title>
            {`document ${row.documentId} — Jaccard ${formatPercent(row.jaccard)}, ${row.nSentences} phrases, ${row.annotators} annotateurs`}
          </title>
        </circle>
      ))}

      <text
        x={(PAD.left + width - PAD.right) / 2}
        y={height - 6}
        textAnchor="middle"
        fontSize={10}
        fill={VIZ_VARS.inkMuted}
      >
        phrases par document
      </text>
    </Figure>
  );
}

// --------------------------------------------------------------------------- //
// F1 — matrice d'accord humains × LLM
// --------------------------------------------------------------------------- //

export interface MatrixCell {
  a: string;
  b: string;
  agreement: number;
  n: number;
  kind: string;
}

/**
 * F1 — carte de chaleur des accords par paire.
 *
 * Séquentielle (une seule teinte, du clair au foncé) : l'accord est une magnitude, pas
 * une identité. Un arc-en-ciel ferait lire un ordre là où il n'y en a pas.
 */
export function AgreementMatrixFigure({ actors, cells, humanMean, crossMean }: {
  actors: Array<{ key: string; kind: string }>;
  cells: MatrixCell[];
  humanMean?: number | null;
  crossMean?: number | null;
}) {
  const size = 44;
  const labelSpace = 96;
  const width = labelSpace + actors.length * size + 16;
  const height = labelSpace + actors.length * size + 16;
  const index = new Map(actors.map((a, i) => [a.key, i]));
  const lookup = new Map<string, MatrixCell>();
  for (const cell of cells) {
    lookup.set(`${cell.a}|${cell.b}`, cell);
    lookup.set(`${cell.b}|${cell.a}`, cell);
  }
  const label = (key: string) => key.replace("human:", "A").replace("llm:", "");

  return (
    <Figure
      testId="figure-matrix"
      title="Accord entre annotateurs et juges LLM"
      subtitle="Taux d'accord brut sur le thème primaire, par paire"
      caption={
        humanMean != null && crossMean != null
          ? `humain↔humain ${formatPercent(humanMean)} · humain↔LLM ${formatPercent(crossMean)}`
          : undefined
      }
      width={width}
      height={height}
      columns={[
        { key: "a", label: "Acteur A" },
        { key: "b", label: "Acteur B" },
        { key: "accord", label: "Accord" },
        { key: "n", label: "n phrases" },
        { key: "type", label: "Type" },
      ]}
      rows={cells.map((c) => ({
        a: label(c.a),
        b: label(c.b),
        accord: formatPercent(c.agreement),
        n: c.n,
        type: c.kind,
      }))}
      emptyMessage="Aucune paire comparable : il faut au moins deux acteurs sur un même document."
    >
      {actors.map((actor, i) => (
        <g key={actor.key}>
          <text
            x={labelSpace - 6}
            y={labelSpace + i * size + size / 2 + 3}
            textAnchor="end"
            fontSize={10}
            fill={VIZ_VARS.inkMuted}
          >
            {label(actor.key)}
          </text>
          <text
            x={labelSpace + i * size + size / 2}
            y={labelSpace - 8}
            textAnchor="start"
            fontSize={10}
            fill={VIZ_VARS.inkMuted}
            transform={`rotate(-45 ${labelSpace + i * size + size / 2} ${labelSpace - 8})`}
          >
            {label(actor.key)}
          </text>
        </g>
      ))}

      {actors.map((rowActor, i) =>
        actors.map((colActor, j) => {
          if (i === j) {
            return (
              <rect
                key={`${i}-${j}`}
                x={labelSpace + j * size + 1}
                y={labelSpace + i * size + 1}
                width={size - 2}
                height={size - 2}
                rx={4}
                fill={VIZ_VARS.grid}
              />
            );
          }
          const cell = lookup.get(`${rowActor.key}|${colActor.key}`);
          if (!cell) return null;
          return (
            <g key={`${i}-${j}`}>
              {/* Espacement de 2 px entre cellules : la surface les sépare, pas un trait. */}
              <rect
                x={labelSpace + j * size + 1}
                y={labelSpace + i * size + 1}
                width={size - 2}
                height={size - 2}
                rx={4}
                fill={seriesColor(0)}
                fillOpacity={sequentialOpacity(cell.agreement)}
              >
                <title>
                  {`${label(cell.a)} ↔ ${label(cell.b)} : ${formatPercent(cell.agreement)} (n=${cell.n})`}
                </title>
              </rect>
              <text
                x={labelSpace + j * size + size / 2}
                y={labelSpace + i * size + size / 2 + 3}
                textAnchor="middle"
                fontSize={9}
                fill={VIZ_VARS.ink}
              >
                {Math.round(cell.agreement * 100)}
              </text>
            </g>
          );
        }),
      )}
    </Figure>
  );
}
