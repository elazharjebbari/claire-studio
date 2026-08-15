/**
 * Routage des vues de résultats ad-hoc — fonction PURE, testée exhaustivement.
 *
 * Chaque preset a un objectif décisionnel propre (docs/pactiva-lab-resultats/02) : la
 * vue doit ouvrir sur la réponse à CETTE décision, pas sur des KPIs génériques. Le
 * repli reste la vue générique enrichie : une expérience libre (mode expert) n'est
 * jamais bloquée par l'absence de famille dédiée.
 */

import type { LabTask } from "./types";

export type ViewFamily =
  | "floor"          // A — planchers (baseline-fast, position-only)
  | "flagship"       // B — résultat principal T1 (legal-bert-finetune, knn)
  | "paired"         // C — comparaison appariée (sweeps à variantes discrètes)
  | "screening"      // D — criblage multi-axes
  | "curve"          // E — courbe (taille d'entraînement ou bruit)
  | "judges"         // F — juges LLM
  | "multilabel"     // G — T2
  | "boundary"       // H — T3
  | "generic";       // repli : vue générique enrichie

const PRESET_FAMILIES: Record<string, ViewFamily> = {
  "baseline-fast": "floor",
  "position-only": "floor",
  "llm-judges-baseline": "judges",
  "screening-preprocess": "screening",
  "embeddings-frozen": "paired",
  "learning-curve": "curve",
  "legal-bert-finetune": "flagship",
  "ablation-context": "paired",
  "multilabel-finetune": "multilabel",
  "sequence-boundary": "boundary",
  "knn-explainable": "flagship",
  "encoders-comparison": "paired",
  "ablation-gold-quality": "paired",
  "ablation-label-noise": "curve",
};

export function resultViewFor(run: {
  preset?: string | null;
  task: LabTask;
  config?: Record<string, unknown>;
}): ViewFamily {
  const preset = (run.preset ?? "").trim();
  if (preset && PRESET_FAMILIES[preset]) return PRESET_FAMILIES[preset];
  // Sans preset : la tâche reste un routage sûr (les vues G/H ne montrent que des
  // métriques propres à T2/T3, présentes dans tout résultat de ces tâches).
  if (run.task === "T2_multilabel") return "multilabel";
  if (run.task === "T3_boundary") return "boundary";
  return "generic";
}

/** Les familles dont la vue porte sur L'EXPÉRIENCE agrégée (sweep), pas sur un run. */
export const AGGREGATED_FAMILIES: ViewFamily[] = ["paired", "screening", "curve", "judges"];
