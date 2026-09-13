/**
 * Export des résultats pour l'article — CSV, JSON et LaTeX, PURS et testables.
 *
 * Règle absolue : tout chiffre exporté porte sa PROVENANCE. Un tableau LaTeX généré ici
 * contient, en commentaire, l'identifiant de l'expérience, l'empreinte du dataset et la
 * version du code qui l'a produit — de sorte qu'un chiffre collé dans l'article reste
 * remontable à son run des mois plus tard.
 */

import type { PaperExperiment, PaperMetric } from "./types";

function fmt(value: number | string | null, digits = 4): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "number" ? value.toFixed(digits) : String(value);
}

function ci(metric: PaperMetric, digits = 4): string {
  return metric.ci ? `[${metric.ci[0].toFixed(digits)} ; ${metric.ci[1].toFixed(digits)}]` : "";
}

/** Échappe les caractères actifs de LaTeX (un libellé contient « & » ou « % »). */
export function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

export function metricsToCsv(experiments: PaperExperiment[]): string {
  const header = [
    "experiment", "rq", "title", "status", "metric", "label", "value",
    "ci_low", "ci_high", "unit", "taxonomy", "population", "label_source",
    "dataset_fingerprint", "code_version", "executed_at",
  ];
  const rows = experiments.flatMap((e) =>
    e.metrics.map((m) => [
      e.id, e.rq, e.title, e.status, m.key, m.label,
      m.value === null ? "" : String(m.value),
      m.ci ? String(m.ci[0]) : "", m.ci ? String(m.ci[1]) : "",
      m.unit, e.data.taxonomy ?? "", (e.data.populations ?? []).join("+"),
      e.data.labelSource ?? "", (e.data.datasetFingerprint ?? "").slice(0, 16),
      e.provenance.codeVersion.slice(0, 12), e.provenance.executedAt,
    ]),
  );
  const escape = (cell: string) =>
    /[",;\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}

export function experimentsToJson(experiments: PaperExperiment[]): string {
  return JSON.stringify(experiments, null, 2);
}

/** Un tableau LaTeX par expérience : métriques, intervalles, et provenance en commentaire. */
export function experimentToLatex(experiment: PaperExperiment): string {
  const label = `tab:${experiment.id.toLowerCase().replace(/\./g, "-")}`;
  const lines = [
    `% ${experiment.id} — ${experiment.title}`,
    `% statut : ${experiment.status}`,
    `% dataset : ${(experiment.data.datasetFingerprint ?? "").slice(0, 16)} · taxonomie : ${experiment.data.taxonomy ?? "—"}`,
    `% source d'étiquettes : ${experiment.data.labelSource ?? "—"}`,
    `% code : ${experiment.provenance.codeVersion.slice(0, 12)} · exécuté le ${experiment.provenance.executedAt}`,
    "\\begin{table}[t]",
    "\\centering",
    "\\begin{tabular}{lrr}",
    "\\toprule",
    "Métrique & Valeur & IC 95\\,\\% \\\\",
    "\\midrule",
    ...experiment.metrics.map(
      (m) => `${escapeLatex(m.label)} & ${fmt(m.value)} & ${m.ci ? `[${m.ci[0].toFixed(4)}, ${m.ci[1].toFixed(4)}]` : "--"} \\\\`,
    ),
    "\\bottomrule",
    "\\end{tabular}",
    `\\caption{${escapeLatex(experiment.title)}. ${escapeLatex(experiment.summary)}}`,
    `\\label{${label}}`,
    "\\end{table}",
  ];
  return lines.join("\n");
}

/** Le tableau de synthèse d'une question de recherche (une ligne par expérience). */
export function rqToLatex(rq: string, rqLabel: string, experiments: PaperExperiment[]): string {
  const rows = experiments.map((e) => {
    const head = e.metrics[0];
    return `${e.id} & ${escapeLatex(e.title)} & ${head ? fmt(head.value) : "--"} & ${
      head?.ci ? `[${head.ci[0].toFixed(3)}, ${head.ci[1].toFixed(3)}]` : "--"
    } \\\\`;
  });
  return [
    `% ${rq} — ${rqLabel}`,
    `% ${experiments.length} expérience(s) ; statuts : ${experiments.map((e) => `${e.id}=${e.status}`).join(", ")}`,
    "\\begin{table}[t]",
    "\\centering",
    "\\begin{tabular}{llrr}",
    "\\toprule",
    "Exp. & Intitulé & Métrique principale & IC 95\\,\\% \\\\",
    "\\midrule",
    ...rows,
    "\\bottomrule",
    "\\end{tabular}",
    `\\caption{${escapeLatex(rqLabel)}.}`,
    `\\label{tab:${rq.toLowerCase()}}`,
    "\\end{table}",
  ].join("\n");
}

/** Les valeurs citables en ligne dans le texte : `\newcommand` par métrique. */
export function inlineValuesToLatex(experiments: PaperExperiment[]): string {
  const macro = (id: string, key: string) =>
    `\\${id.replace(/[^A-Za-z]/g, "")}${key.replace(/[^A-Za-z]/g, "")}`;
  return [
    "% Valeurs citables en ligne — régénérées par la campagne, à ne jamais éditer à la main.",
    ...experiments.flatMap((e) =>
      e.metrics
        .filter((m) => typeof m.value === "number")
        .map((m) => `\\newcommand{${macro(e.id, m.key)}}{${fmt(m.value)}}% ${e.id} · ${m.label}`),
    ),
  ].join("\n");
}

/** Déclenche un téléchargement côté navigateur (aucun aller-retour serveur). */
export function download(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { fmt as formatValue, ci as formatCi };
