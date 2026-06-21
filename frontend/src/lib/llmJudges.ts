/**
 * Source UNIQUE de vérité des juges LLM (Claude, Codex, Mistral, …).
 *
 * Toutes les surfaces N-modèles (réglette des frontières, pré-remplissage, fantômes,
 * sélecteur de source) lisent cette liste — ajouter un juge = une entrée ici (+ le
 * `Judge` backend + l'import des données). `identityColor` est une couleur d'IDENTITÉ
 * de piste, DISTINCTE des couleurs de thème (lisible en daltonisme : associée aussi à
 * une initiale).
 */

export interface LlmJudge {
  /** Identifiant backend (Judge.choices) : "claude" | "codex" | "mistral" | … */
  id: string;
  label: string;
  /** En-tête compact de piste (réglette). */
  initial: string;
  /** Couleur d'identité de piste (≠ couleur de thème). */
  identityColor: string;
}

export const LLM_JUDGES: LlmJudge[] = [
  { id: "claude", label: "Claude", initial: "C", identityColor: "#94A3B8" },
  { id: "codex", label: "Codex", initial: "Cx", identityColor: "#A78BFA" },
  { id: "mistral", label: "Mistral", initial: "M", identityColor: "#5EEAD4" },
];

export const LLM_JUDGE_IDS: string[] = LLM_JUDGES.map((j) => j.id);

/** Libellé lisible d'un juge (repli sur l'id si inconnu). */
export function llmJudgeLabel(id: string): string {
  return LLM_JUDGES.find((j) => j.id === id)?.label ?? id;
}

/** Couleur d'identité d'un juge (repli accent si inconnu). */
export function llmJudgeColor(id: string): string {
  return LLM_JUDGES.find((j) => j.id === id)?.identityColor ?? "rgb(var(--surface-accent))";
}
