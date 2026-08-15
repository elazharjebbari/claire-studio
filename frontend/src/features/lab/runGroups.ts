/**
 * Regroupement des runs par expérience — fonction PURE (dossier 04 §5) : un criblage
 * de 48 runs reste illisible en liste plate, quelle que soit la vue de détail.
 */

import { ACTIVE } from "./runStatus";
import type { RunSummary } from "./types";

export interface RunGroup {
  experimentId: string;
  experimentName: string;
  preset: string;
  runs: RunSummary[];
  /** Meilleure macro-F1 des runs terminés — l'agrégat que la ligne de groupe affiche. */
  bestMacroF1: number | null;
  activeCount: number;
  failedCount: number;
}

/** Groupes dans l'ordre d'apparition (les runs arrivent déjà triés du plus récent). */
export function groupRuns(runs: RunSummary[]): RunGroup[] {
  const groups = new Map<string, RunGroup>();
  for (const run of runs) {
    const key = run.experiment || run.id;
    if (!groups.has(key)) {
      groups.set(key, {
        experimentId: key,
        experimentName: run.experimentName,
        preset: run.preset,
        runs: [],
        bestMacroF1: null,
        activeCount: 0,
        failedCount: 0,
      });
    }
    const group = groups.get(key)!;
    group.runs.push(run);
    if (run.macroF1 != null && (group.bestMacroF1 == null || run.macroF1 > group.bestMacroF1)) {
      group.bestMacroF1 = run.macroF1;
    }
    if (ACTIVE.includes(run.status)) group.activeCount += 1;
    if (run.status === "failed") group.failedCount += 1;
  }
  return [...groups.values()];
}
