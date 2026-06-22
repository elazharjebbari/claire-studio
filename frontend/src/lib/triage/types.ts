/**
 * Types du moteur de triage (protocole « confiance graduée + multi-label »).
 * Voir docs/pactiva/dossier-annotation-assistee/ (01-comprehension, moteur/07-*).
 *
 * Le moteur est PUR : aucune dépendance React/DOM/réseau. Il opère sur les codes de
 * thème CANONIQUES de l'app (ceux que produit `normalize_theme_code` côté backend, donc
 * ceux exposés par `preByJudge`), pas sur les codes "logiques" du protocole.
 */

export type TriageLevel = "C1" | "C2" | "C3" | "C4" | "C5";

export type HumanAction =
  | "batch_accept" // C1
  | "confirm" // C2
  | "validate_set" // C3
  | "verify" // C4
  | "arbitrate"; // C5

export type LabelMode = "mono" | "multi" | "open";

export type DisagreementType =
  | "accord"
  | "majorite_autre"
  | "cluster_multilabel"
  | "eclate";

export type ClauseRole = "primary" | "secondary";

export type BoundaryKind = "hard" | "soft";

/** Une étiquette de thème portée par une proposition (mono = 1 ; multi = ≥2). */
export interface ProposedLabel {
  label: string;
  role: ClauseRole;
  /** Nombre de juges ayant proposé ce thème. */
  support: number;
}

/** Frontière proposée (dérivée de l'accord N-way sur is_block_start). */
export interface ProposedBoundary {
  type: BoundaryKind;
  /** Nombre de juges concordants (is_block_start = true). */
  support: number;
}

/** Trace d'une pré-résolution automatique (réversible + journalisée). */
export interface TriageOverride {
  kind: "refuge_to_precis";
  from: string; // thème refuge écarté (valeur d'origine conservée pour audit)
  to: string; // thème précis imposé
}

/** Explication déterministe (dérivée de la règle appliquée, jamais d'un LLM). */
export interface TriageExplanation {
  /** Ce que les juges ont dit (transparence). */
  context: string;
  /** Le set recommandé + frontière (actionnable). */
  decision: string;
  /** La règle qui s'applique + sa justification mesurée (confiance/traçabilité). */
  logic: string;
}

/** Résultat du triage d'une phrase. `null` si < min_judges (carte masquée). */
export interface TriageResult {
  level: TriageLevel;
  action: HumanAction;
  labelMode: LabelMode;
  disagreementType: DisagreementType;
  labels: ProposedLabel[];
  /** Candidats à trancher (toujours présents ; seul recours en `open`/C5). */
  candidates: string[];
  boundary: ProposedBoundary;
  override?: TriageOverride;
  explanation: TriageExplanation;
  /** Faux uniquement pour C1 (acceptation par lot). */
  needsHuman: boolean;
  /** Version des règles ayant produit ce résultat (audit / re-triage). */
  rulesVersion: string;
}

/** Direction de préséance : `over` devient primaire face à `under`. */
export interface Precedence {
  over: string;
  under: string;
}

/** Spec de règles (source unique : moteur/07-regles-routage.yaml, codes APP). */
export interface Rules {
  version: string;
  /** Thèmes-refuges (catch-all les moins fiables ; override anti-refuge ; jamais secondaires). */
  refuges: string[];
  /** Couples de cluster éligibles au multi-label (codes APP). */
  clusters: [string, string][];
  /** Préséances directionnelles documentées (choix du primaire). */
  precedence: Precedence[];
  /** Liste de priorité de repli (du + spécifique au + générique ; refuges en queue). */
  priority: string[];
  /** κ binaire mesuré par thème (utilisé DANS l'explication, pas le routage). */
  reliabilityKappa: Record<string, number>;
  /** Codes protocole/juges bruts → codes canoniques app (idempotent sur canonique). */
  themeAliases: Record<string, string>;
  thresholds: { minJudges: number };
}

/** Entrées du moteur. */
export type ThemeVotes = Record<string, string>; // judgeId -> theme code
export type BoundaryVotes = Record<string, boolean>; // judgeId -> is_block_start
