/**
 * Types « wire » du module GOLD (réponses camelCase via drf-camel-case).
 * Réutilise les unions du moteur pur (goldScoring.ts) pour rester cohérent.
 */
import type { AgreementClass, AutoLevel, RiskBand, LlmRole } from "@/lib/goldScoring";

export interface ResolutionConfig {
  v: number;
  llm: { role: LlmRole; weight: number; perJudge?: Record<string, number> };
  annotatorWeights: Record<string, number>;
  signalBonus: number;
  autoResolve: {
    absoluteAgreement: boolean;
    majority: boolean;
    lowRiskLevels?: string[];
    manualLevels?: string[];
  };
  arbiters: string[]; // usernames autorisés à arbitrer (allow-list nominative)
  /** Participants ATTENDUS (vide = déduction par assignation). Garde-fou de complétude
   *  conservé : ces usernames doivent tous avoir soumis pour que la résolution s'ouvre. */
  expectedAnnotators: string[];
  autoShare: boolean;
  secondaryPolicy: "optional" | "required" | "advisory";
  statuses: string[];
  configChanges?: { at: string; by: string | null }[];
  /** Ce que la politique des secondaires change CONCRÈTEMENT sur ce projet (lecture seule). */
  secondaryImpact?: GoldSecondaryImpact;
}

export interface GoldSecondaryImpact {
  policy: ResolutionConfig["secondaryPolicy"];
  /** Phrases dont le moteur PROPOSE des secondaires consensuels. */
  sentencesWithProposed: number;
  /** Phrases qui les portent RÉELLEMENT dans le gold. */
  sentencesCarrying: number;
  proposedLabels: number;
  documentsTotal: number;
  /** Documents déjà figés : un changement de politique n'y aura plus aucun effet. */
  documentsFinalized: number;
}

export interface GoldRecomputeSummary {
  documents: number;
  recomputed: number;
  autoResolved: number;
  todo: number;
  skippedFinalized: number;
  skippedNotReady: number;
  skippedLocked: number;
}

export type GoldStatus = "awaiting" | "ready" | "in_progress" | "resolved";

export interface GoldReadiness {
  expected: number;
  submitted: number;
  missing: number;
  ready: boolean;
  /** Diagnostic NOMMÉ : sans les noms, un blocage de campagne est introuvable depuis l'UI. */
  expectedUsernames?: string[];
  missingUsernames?: string[];
  /** D'où vient la liste des attendus : déclarée en config, ou déduite. */
  source?: "config" | "assignment" | "annotation";
}

export interface GoldCounts {
  decided?: number;
  auto?: number;
  strict?: number;
  majority?: number;
  divergence?: number;
  highRisk?: number;
}

export interface GoldDocumentSummary {
  id: number;
  externalId: string;
  title: string;
  nSentences: number;
}

export interface GoldDocumentRow {
  document: GoldDocumentSummary;
  status: GoldStatus;
  pctResolved: number;
  readiness?: GoldReadiness;
  finalized?: boolean;
  locked: boolean;
  lockedBy: string | null;
  counts: GoldCounts;
  arbiters: string[];
}

export interface GoldLockState {
  locked: boolean;
  lockedBy: string | null;
  lockedByName?: string;
  lockedById?: number | null;
  heldByMe?: boolean;
  expiresAt?: string | null;
  leaseSeconds?: number;
}

export interface GoldAnnotatorVote {
  voterId: string;
  userId: number;
  displayName: string;
  color: string;
  primary: string;
  secondaries: string[];
}

export interface GoldLlmVote {
  judge: string;
  primary: string;
}

export interface GoldSentenceRow {
  index: number;
  text: string;
  annotators: GoldAnnotatorVote[];
  llms: GoldLlmVote[];
  agreementClass: AgreementClass;
  riskBand: RiskBand;
  autoLevel: AutoLevel;
  confidence: number;
  humanDissent: boolean;
  proposedPrimary: string;
  proposedSecondaries: string[];
  /** Égalité en tête du décompte : la « proposition » n'est qu'un départage alphabétique,
   *  jamais un consensus — aucune validation en 1 clic ne doit être proposée. */
  tie?: boolean;
  /** Nombre d'annotateurs ayant réellement couvert la phrase (1 ⇒ aucun accord constatable). */
  nCovering?: number;
  decided: boolean;
  autoResolved: boolean;
  primary: string;
  secondaries: string[];
  decidedBy: number | null;
  decidedByName: string;
  comment: string;
}

export interface GoldDocumentDetail {
  document: GoldDocumentSummary;
  status: GoldStatus;
  pctResolved: number;
  readiness: GoldReadiness;
  finalized: boolean;
  canFinalize: boolean;
  lock: GoldLockState;
  sentences: GoldSentenceRow[];
}

export interface GoldLlmAnnotator {
  judge: string;
  added: boolean;
  documents: number;
}

export interface GoldDecidePayload {
  index: number;
  primary: string;
  secondaries?: string[];
  comment?: string;
}

export interface GoldDecideResponse {
  index: number;
  decided: boolean;
  autoResolved: boolean;
  primary: string;
  secondaries: string[];
  status: GoldStatus;
  pctResolved: number;
}

export interface GoldAutoResolveResponse {
  n: number;
  decided: number;
  autoResolved: number;
  status: GoldStatus;
  pctResolved: number;
}

export interface GoldStatRow {
  username: string;
  displayName: string;
  color: string;
  pct: number | null;
  n: number;
  matches: number;
}

export interface GoldJudgeRow {
  judge: string;
  pct: number | null;
  n: number;
  matches: number;
}

export interface GoldStats {
  annotators: GoldStatRow[];
  judges: GoldJudgeRow[];
  closestToGold: { username: string; displayName: string; pct: number } | null;
  documentsCompared: number;
  goldCovered: number;
  iaa: { meanKappa: number | null; pairs?: unknown[] } | null;
}
