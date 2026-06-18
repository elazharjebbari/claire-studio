/**
 * Types TypeScript dérivés directement de dossier/00_overview/CONTRACT.md (§2 modèle de
 * données, §3 API, §4 format pivot clause). Source de vérité unique côté frontend.
 *
 * Toute divergence avec le CONTRACT est un bug : ce module doit être tenu synchronisé.
 */

// ── Énumérations ────────────────────────────────────────────────────────────

export type UserRole = "annotator" | "reviewer" | "admin" | "owner";

export type AnnotationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "archived";

export type AnnotationSource = "human" | "preannotation_seed";

/** Échelle de certitude intuitive (CONTRACT §2, vocabulary.yaml). */
export type Certainty = 0 | 1 | 2 | 3;

export type Judge = "claude" | "codex" | "other";

export type ReviewDecision = "approve" | "request_changes" | "reject";

export type ExportFormat = "jsonl" | "csv" | "conll" | "xml" | "md" | "huggingface";

/** Catégories d'injustice CLAUDETTE (ReferenceLabel). */
export type UnfairnessCategory =
  | "A"
  | "CH"
  | "CR"
  | "J"
  | "LAW"
  | "LTD"
  | "TER"
  | "USE";

export type UnfairnessLevel = 1 | 2 | 3;

// ── Entités ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  displayName?: string;
  locale?: string;
}

export interface Corpus {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sourceUrl?: string;
  license?: string;
  defaultLanguage?: string;
  documentCount?: number;
}

export interface Sentence {
  id: string;
  documentId: string;
  index: number;
  rawText: string;
  cleanText?: string;
  charStart?: number;
  charEnd?: number;
}

export interface ReferenceLabel {
  id: string;
  sentenceId: string;
  sentenceIndex: number;
  category: UnfairnessCategory;
  level: UnfairnessLevel;
  source?: string;
}

export interface DocumentSummary {
  id: string;
  corpusId: string;
  externalId: string;
  title: string;
  language?: string;
  nSentences: number;
  checksum?: string;
}

export interface DocumentDetail extends DocumentSummary {
  sentences: Sentence[];
  referenceLabels: ReferenceLabel[];
  sourceMeta?: Record<string, unknown>;
}

export interface Theme {
  id: string;
  schemeId: string;
  code: string;
  label: string;
  color: string;
  definition?: string;
  examples?: string[];
  order: number;
}

export interface LegalNature {
  id: string;
  schemeId: string;
  code: string;
  label: string;
  definition?: string;
  order: number;
}

export interface LabelScheme {
  id: string;
  slug: string;
  name: string;
  version: string;
  isActive: boolean;
  themes: Theme[];
  legalNatures: LegalNature[];
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  corpusSlug: string;
  schemeSlug: string;
  guidelines?: string;
  status: string;
  myRole?: "annotator" | "reviewer" | "lead";
  progress?: ProjectProgress;
}

export interface ProjectProgress {
  totalDocuments: number;
  annotatedDocuments: number;
  submittedDocuments: number;
  approvedDocuments: number;
  myAssigned: number;
  myDone: number;
  /** Inter-annotator agreement (peut être null tant que < 2 annotateurs). */
  iaa?: number | null;
}

export interface Assignment {
  id: string;
  projectSlug: string;
  document: DocumentSummary;
  assigneeId: string;
  status: AnnotationStatus | "unstarted";
  annotationId?: string;
  dueAt?: string;
}

export interface Clause {
  id: string;
  annotationId: string;
  /** Index de la phrase ancre (CONTRACT §4 : anchor_index). */
  anchorIndex: number;
  theme: string;
  legalNature?: string | null;
  evidenceSpan?: string;
  rationale?: string;
  certainty?: Certainty | null;
  order: number;
  /** Provenance optionnelle si la clause vient d'une pré-annotation. */
  seededFrom?: string | null;
}

export interface Annotation {
  id: string;
  projectSlug: string;
  documentId: string;
  annotatorId: string;
  status: AnnotationStatus;
  globalCertainty?: Certainty | null;
  source: AnnotationSource;
  clauses: Clause[];
  createdAt: string;
  updatedAt: string;
}

export interface PreClause {
  anchorIndex: number;
  themeCode: string;
  evidenceSpan?: string;
  rationale?: string;
}

export interface PreAnnotation {
  id: string;
  projectSlug: string;
  documentId: string;
  judge: Judge;
  schemaVersion: string;
  clauses: PreClause[];
  importedAt: string;
  mapped: boolean;
}

export interface AnnotationVersion {
  id: string;
  annotationId: string;
  number: number;
  authorId: string;
  label?: string;
  createdAt: string;
  snapshot: PivotClauseDocument;
}

export interface Comment {
  id: string;
  annotationId: string;
  clauseId?: string | null;
  sentenceIndex?: number | null;
  authorId: string;
  body: string;
  threadRoot?: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  annotationId: string;
  reviewerId: string;
  score: 1 | 2 | 3 | 4 | 5;
  decision: ReviewDecision;
  rubric?: Record<string, unknown>;
  body?: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  actorId: string;
  actorName?: string;
  verb: string;
  targetType: string;
  targetId: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface ExportJob {
  id: string;
  projectSlug: string;
  format: ExportFormat;
  status: "pending" | "running" | "done" | "failed";
  artifactPath?: string;
  manifest?: Record<string, unknown>;
  requestedById: string;
  createdAt: string;
}

// ── Format pivot « clause » (CONTRACT §4, export & snapshot) ──────────────────

export interface PivotClause {
  anchor_index: number;
  theme: string;
  legal_nature: string | null;
  evidence_span: string;
  rationale: string;
  certainty: Certainty;
}

export interface PivotClauseDocument {
  doc: string;
  project: string;
  annotator: string;
  schema: string;
  status: AnnotationStatus;
  global_certainty: Certainty;
  clauses: PivotClause[];
  provenance?: {
    seeded_from?: string;
    edited?: boolean;
  };
}

// ── Réponses paginées ─────────────────────────────────────────────────────────

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AuthTokens {
  access: string;
  refresh: string;
}
