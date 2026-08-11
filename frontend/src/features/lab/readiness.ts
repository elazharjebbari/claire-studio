/**
 * Logique PURE du panneau « Prêt pour la science ».
 *
 * Séparée du rendu pour être testable, et parce que ces règles décident de ce qui est
 * affiché comme bloquant — donc de ce sur quoi le porteur va agir. Une erreur ici enverrait
 * l'effort au mauvais endroit.
 */

import type { Blocker, CampaignReadiness } from "./types";

export type Level = "ok" | "warn" | "blocked";

export interface ReadinessLine {
  key: string;
  label: string;
  value: number;
  target: number | null;
  level: Level;
  hint?: string;
}

/** Niveau d'une ligne : atteint / en approche / bloquant. */
export function levelFor(value: number, target: number | null): Level {
  if (target == null) return "ok";
  if (value >= target) return "ok";
  // La moitié de la cible sépare « en approche » de « bloquant » : en dessous, ce n'est
  // pas un ajustement mais un manque de matériau.
  return value >= target / 2 ? "warn" : "blocked";
}

export function buildLines(readiness: CampaignReadiness | null): ReadinessLine[] {
  if (!readiness) return [];
  const t = readiness.targets;
  const lines: ReadinessLine[] = [
    {
      key: "annotated",
      label: "Documents annotés",
      value: readiness.documentsAnnotated,
      target: readiness.documentsTotal,
      level: levelFor(readiness.documentsAnnotated, readiness.documentsTotal),
    },
    {
      key: "multi",
      label: "Documents à ≥2 annotateurs",
      value: readiness.documentsMultiAnnotatedComplete,
      target: t.multiAnnotated,
      level: levelFor(readiness.documentsMultiAnnotatedComplete, t.multiAnnotated),
      hint: "détermine l'accord inter-annotateurs et le plafond humain",
    },
    {
      key: "triple",
      label: "Documents à ≥3 annotateurs",
      value: readiness.documentsTripleAnnotated,
      target: t.tripleAnnotated,
      level: levelFor(readiness.documentsTripleAnnotated, t.tripleAnnotated),
      hint: "nécessaire à l'audit d'annotateurs",
    },
    {
      key: "gold",
      label: "Documents avec gold décidé",
      value: readiness.documentsWithGold,
      target: t.goldFinalized,
      level: levelFor(readiness.documentsWithGold, t.goldFinalized),
    },
  ];
  return lines;
}

/**
 * Le gain récupérable immédiatement : les annotations terminées mais non soumises.
 *
 * C'est la ligne la plus actionnable du panneau, parce que le travail est déjà fait —
 * il suffit de le soumettre pour qu'il entre dans les calculs.
 */
export function recoverableWork(readiness: CampaignReadiness | null): {
  count: number;
  sentences: number;
  annotators: string[];
} {
  const rows = readiness?.completeButNotSubmitted ?? [];
  return {
    count: rows.length,
    sentences: rows.reduce((sum, row) => sum + row.nSentences, 0),
    annotators: [...new Set(rows.map((row) => row.actorKey))].sort(),
  };
}

/** Les bloquants, sévérité haute d'abord — c'est l'ordre dans lequel agir. */
export function sortBlockers(blockers: Blocker[]): Blocker[] {
  const weight = { high: 0, medium: 1 } as const;
  return [...blockers].sort((a, b) => weight[a.severity] - weight[b.severity]);
}

/** Une ligne bloque-t-elle réellement l'écriture de l'article ? */
export function isArticleBlocked(lines: ReadinessLine[]): boolean {
  return lines.some((line) => line.key !== "annotated" && line.level === "blocked");
}
