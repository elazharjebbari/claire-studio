export interface AnalysisSnapshot {
  id: string;
  label: string;
  visibility: "personal" | "project";
  includesDrafts: boolean;
  fingerprint: string;
  documentCount: number;
  annotationCount: number;
  draftCount: number;
  createdBy: number;
  createdAt: string;
}

export interface AnalysisOverview {
  documents: number;
  humanActors: number;
  llmActors: number;
  annotations: number;
  draftAnnotations: number;
  publishedAnnotations: number;
  statusDistribution: Record<string, number>;
  eligibleSentences: number;
  coveredSentences: number;
  coverageRate: number | null;
  goldDecisions: number;
}

export interface ActorProfile {
  actorKey: string;
  pseudonym: string;
  assignedDocuments: number;
  annotations: number;
  draftAnnotations: number;
  publishedAnnotations: number;
  clauses: number;
  validatedClauses: number;
  eligibleSentences: number;
  coveredSentences: number;
  coverageRate: number | null;
  validationRate: number | null;
  certaintyDistribution: Record<string, number>;
  themeDistribution: { theme: string; count: number }[];
}

// -- Chantier Lab (docs/pactiva-lab/) : 8 métriques additives, toutes optionnelles.
// Un run antérieur à ce chantier ne les porte pas — chaque section de l'UI doit donc
// se garder sur leur présence, jamais supposer qu'elles existent.

export interface AlphaMasiResult {
  alphaMasi: number | null;
  alphaNominal: number | null;
  multiLabelCost: number | null;
  band: "reliable" | "acceptable" | "below_threshold" | "unknown";
  thresholds: { acceptable: number; reliable: number };
  units: number;
  perTheme: Array<{ code: string; alpha: number | null; support: number }>;
  warnings: string[];
}

export interface BoundaryAgreementResult {
  perDocument: Array<{
    documentId: number;
    nSentences: number;
    annotators: number;
    segmentsPerAnnotator: number[];
    jaccard: number;
    windowDiff: number;
    pk: number;
  }>;
  meanJaccard: number | null;
  documentsCompared: number;
  definition: string;
  replaces: string;
  warnings: string[];
}

export interface LabelDistributionResult {
  themes: Array<{ code: string; primary: number; secondary: number; total: number; share: number }>;
  nThemes: number;
  totalPrimary: number;
  normalizedEntropy: number;
  rareThemes: string[];
  rareThreshold: number;
  imbalanceRatio: number | null;
  warnings: string[];
}

export interface CooccurrenceResult {
  pairs: Array<{
    themes: string[];
    count: number;
    unfair: number;
    unfairRate: number;
    lift: number | null;
  }>;
  nPairs: number;
  nCombinations: number;
  nHapaxCombinations: number;
  baseUnfairRate: number;
  monoLabel: { count: number; unfair: number; rate: number };
  multiLabel: { count: number; unfair: number; rate: number };
  cardinalityLift: number | null;
  warnings: string[];
}

export interface HumanLlmMatrixResult {
  actors: Array<{ key: string; kind: "human" | "llm" }>;
  cells: Array<{ a: string; b: string; agreement: number; n: number; kind: string }>;
  humanMean: number | null;
  llmMean: number | null;
  crossMean: number | null;
  humanAdvantage: number | null;
  warnings: string[];
}

export interface AnnotatorAuditResult {
  actors: Array<{
    actorKey: string;
    clauses: number;
    documents: number;
    validated: number;
    validationRate: number | null;
    themeBias: Array<{ code: string; actorShare: number; globalShare: number; ratio: number }>;
  }>;
  totalClauses: number;
  workloadImbalance: number | null;
  documentsCovered: number;
  warnings: string[];
}

export interface GoldProgressResult {
  sentences: number;
  decided: number;
  pctDecided: number | null;
  byAutoLevel: Record<string, number>;
  byAgreementClass: Record<string, number>;
  byRiskBand: Record<string, number>;
  arbitrationBacklog: Array<{ documentId: number; index: number; riskBand: string }>;
  backlogSize: number;
  documents: number;
  warnings: string[];
}

export interface AnalysisResult {
  overview?: AnalysisOverview;
  actorProfiles?: { actors: ActorProfile[] };
  alphaMasi?: AlphaMasiResult;
  boundaryAgreement?: BoundaryAgreementResult;
  labelDistribution?: LabelDistributionResult;
  cooccurrence?: CooccurrenceResult;
  humanLlmMatrix?: HumanLlmMatrixResult;
  annotatorAudit?: AnnotatorAuditResult;
  goldProgress?: GoldProgressResult;
  campaignReadiness?: import("@/features/lab/types").CampaignReadiness;
  quality?: {
    clauses: number;
    multilabelClauses: number;
    multilabelRate: number | null;
    validatedClauses: number;
    validationRate: number | null;
    certaintyDistribution: Record<string, number>;
    warnings: string[];
  };
  pairwiseAgreement?: {
    meanKappa: number | null;
    caseCount: number;
    supportedPairCount: number;
    warnings: string[];
    pairs: Array<{
      documentId: number;
      mode: "inter_human" | "human_llm" | "inter_llm";
      actorA: string;
      actorB: string;
      support: number;
      rawAgreement: number;
      cohenKappa: number;
      jaccardMultilabel: number;
      boundaryF1: number;
    }>;
  };
  intraAnnotator?: {
    meanStability: number | null;
    comparisons: Array<{
      actor: string;
      documentId: number;
      fromVersion: number;
      toVersion: number;
      support: number;
      stability: number;
      cohenKappa: number;
      changedUnits: number;
    }>;
  };
  goldAnalysis?: {
    goldUnits: number;
    decidedUnits: number;
    readinessRate: number | null;
    riskDistribution: Record<string, number>;
    actorScores: Array<{
      actor: string;
      actorType: "human" | "llm";
      support: number;
      proximity: number;
    }>;
  };
  taxonomy?: {
    primaryThemes: Array<{ theme: string; count: number }>;
    secondaryThemes: Array<{ theme: string; count: number }>;
    rareThemes: string[];
    cooccurrences: Array<{ themeA: string; themeB: string; count: number }>;
  };
}

export interface AnalysisRun {
  id: string;
  snapshotId: string;
  metricCodes: string[];
  metricVersions: Record<string, string>;
  status: "queued" | "running" | "succeeded" | "failed" | "stale" | "canceled";
  progress: number;
  result: AnalysisResult;
  fingerprint: string;
  errorCode: string;
  errorDetail: string;
  createdAt: string;
  completedAt: string | null;
}

export interface ReportArtifact {
  id: string;
  reportId: string;
  status: "queued" | "running" | "ready" | "failed" | "expired";
  checksum: string;
  sizeBytes: number;
  errorDetail: string;
}

export interface AnalysisPreset {
  id: string;
  name: string;
  configuration: { includeDrafts?: boolean; mode?: string };
  isShared: boolean;
}

export interface AnalysisReport {
  id: string;
  snapshotId: string;
  runId: string;
  title: string;
  description: string;
  visibility: "personal" | "project";
  status: "ready" | "archived";
  summary: AnalysisOverview;
  payload?: AnalysisResult;
  createdAt: string;
}

export interface ReportComparison {
  current: { id: string; createdAt: string };
  previous: { id: string; createdAt: string };
  delta: Record<string, number | null>;
  metricDelta?: Record<string, number | null>;
}

export interface ListEnvelope<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}
