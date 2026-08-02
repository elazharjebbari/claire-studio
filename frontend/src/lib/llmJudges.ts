/**
 * Source UNIQUE de vérité des juges LLM (Claude, Codex, Mistral, Fable, …).
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

/**
 * ORDRE D'AFFICHAGE : par TAILLE DE MODÈLE décroissante (Fable → Claude → Codex → Mistral),
 * pas par ordre d'ajout. Cet ordre gouverne toutes les surfaces N-modèles (réglette,
 * comparaison, menus, pré-remplissage) et doit rester en parité avec `JUDGE_DISPLAY_ORDER`
 * côté serveur (`claire/imports/models.py`) — parité testée des deux côtés.
 */
export const LLM_JUDGES: LlmJudge[] = [
  { id: "fable", label: "Fable", initial: "F", identityColor: "#FDBA74" },
  { id: "claude", label: "Claude", initial: "C", identityColor: "#94A3B8" },
  { id: "codex", label: "Codex", initial: "Cx", identityColor: "#A78BFA" },
  { id: "mistral", label: "Mistral", initial: "M", identityColor: "#5EEAD4" },
];

export const LLM_JUDGE_IDS: string[] = LLM_JUDGES.map((j) => j.id);

/**
 * Modèle proposé PAR DÉFAUT (pré-remplissage / auto-pré-annotation) : **Fable**, seul juge
 * de la session 4 à couvrir les 50 documents du corpus au format v9.2 avec une segmentation
 * complète. Doit rester en parité avec `DEFAULTS["prefill"]["judge"]` côté serveur
 * (`claire/accounts/ui_prefs.py`) — parité testée. Le défaut ne fait que PRÉ-SÉLECTIONNER :
 * l'auto-exécution reste opt-in (`prefill.enabled = false`).
 */
export const DEFAULT_LLM_JUDGE = "fable";

/** Libellé lisible d'un juge (repli sur l'id si inconnu). */
export function llmJudgeLabel(id: string): string {
  return LLM_JUDGES.find((j) => j.id === id)?.label ?? id;
}

/** Couleur d'identité d'un juge (repli accent si inconnu). */
export function llmJudgeColor(id: string): string {
  return LLM_JUDGES.find((j) => j.id === id)?.identityColor ?? "rgb(var(--surface-accent))";
}
