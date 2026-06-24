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
  autoResolve: { absoluteAgreement: boolean; lowRiskLevels: string[]; manualLevels: string[] };
  arbiters: string[]; // usernames autorisés à arbitrer (allow-list nominative)
  autoShare: boolean;
  secondaryPolicy: "optional" | "required" | "advisory";
  statuses: string[];
  configChanges?: { at: string; by: string | null }[];
}

export type GoldStatus = "unresolved" | "in_progress" | "resolved";

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
  lock: GoldLockState;
  sentences: GoldSentenceRow[];
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
