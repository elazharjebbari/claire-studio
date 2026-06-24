/**
 * Fixtures de mock (MSW & tests). Un document type « Fitbit » (~30 phrases) avec
 * labels d'injustice CLAUDETTE, pré-annotations claude & codex, projets, scheme.
 *
 * Données plausibles et cohérentes avec le CONTRACT — pas du Lorem ipsum.
 */

import type {
  Annotation,
  AnnotationVersion,
  Assignment,
  Comment,
  Corpus,
  DocumentDetail,
  LabelScheme,
  PreAnnotation,
  PivotClause,
  Project,
  ProjectProgress,
  ReferenceLabel,
  Review,
  Sentence,
  TranslationSet,
  User,
  ActivityEvent,
} from "@/types/contract";
import { THEMES } from "@/lib/tokens";

export const FIXTURE_USER: User = {
  id: "u-alice",
  username: "alice",
  email: "alice@loria.fr",
  role: "admin",
  displayName: "Alice (annotatrice)",
  locale: "fr",
};

export const FIXTURE_REVIEWER: User = {
  id: "u-bruno",
  username: "bruno",
  email: "bruno@loria.fr",
  role: "reviewer",
  displayName: "Bruno (reviewer)",
  locale: "fr",
};

// ── Document Fitbit (~30 phrases) ─────────────────────────────────────────────

const RAW_SENTENCES: string[] = [
  "Fitbit Terms of Service.",
  "We recently revised these terms, effective as of the date posted above.",
  "These Terms of Service apply to your use of the Fitbit service and any Fitbit device.",
  "By creating a Fitbit account, you agree to be bound by these terms.",
  "You must be at least 13 years old to create an account and use the service.",
  "If you are under 18, you represent that your legal guardian has reviewed these terms.",
  "Fitbit designs products and services to help you reach your health and fitness goals.",
  "We may collect data about your activity, sleep, heart rate and location.",
  "Your data is processed in accordance with the Fitbit Privacy Policy.",
  "You retain ownership of the content you submit, post or display on the service.",
  "By submitting content, you grant Fitbit a worldwide, royalty-free license to use it.",
  "You agree not to misuse the service or interfere with its normal operation.",
  "You may not reverse engineer or attempt to extract the source code of our software.",
  "Fitbit may modify or discontinue the service at any time without prior notice.",
  "We reserve the right to change these terms at our sole discretion at any time.",
  "Your continued use of the service after changes constitutes acceptance of the new terms.",
  "We may terminate or suspend your account immediately, without prior notice, for any reason.",
  "Upon termination, your right to use the service will immediately cease.",
  "The service is provided on an \"as is\" and \"as available\" basis without warranties.",
  "Fitbit disclaims all warranties, express or implied, including fitness for a purpose.",
  "To the maximum extent permitted by law, Fitbit shall not be liable for any damages.",
  "In no event shall Fitbit's total liability exceed the amount you paid in the prior year.",
  "Any dispute arising under these terms shall be resolved by binding arbitration.",
  "You waive your right to a trial by jury and to participate in a class action.",
  "These terms are governed by the laws of the State of California.",
  "You consent to the exclusive jurisdiction of the courts located in San Francisco.",
  "The service may contain links to third-party websites not owned by Fitbit.",
  "Fitbit is not responsible for the content or practices of third-party services.",
  "Subscription fees, if any, are billed in advance on a recurring basis.",
  "We may send you administrative communications about your account and the service.",
  "If any provision of these terms is held invalid, the remaining provisions remain in effect.",
];

const FITBIT_SENTENCES: Sentence[] = RAW_SENTENCES.map((text, index) => ({
  id: `s-fitbit-${index}`,
  documentId: "doc-fitbit",
  index,
  rawText: text,
  cleanText: text,
}));

// Labels d'injustice CLAUDETTE (catégorie + niveau) sur les phrases sensibles.
const FITBIT_REFERENCE_LABELS: ReferenceLabel[] = [
  { id: "rl-1", sentenceId: "s-fitbit-14", sentenceIndex: 14, category: "CH", level: 3, source: "claudette" },
  { id: "rl-2", sentenceId: "s-fitbit-15", sentenceIndex: 15, category: "CH", level: 2, source: "claudette" },
  { id: "rl-3", sentenceId: "s-fitbit-16", sentenceIndex: 16, category: "TER", level: 3, source: "claudette" },
  { id: "rl-4", sentenceId: "s-fitbit-19", sentenceIndex: 19, category: "LTD", level: 2, source: "claudette" },
  { id: "rl-5", sentenceId: "s-fitbit-20", sentenceIndex: 20, category: "LTD", level: 3, source: "claudette" },
  { id: "rl-6", sentenceId: "s-fitbit-21", sentenceIndex: 21, category: "LTD", level: 3, source: "claudette" },
  { id: "rl-7", sentenceId: "s-fitbit-22", sentenceIndex: 22, category: "A", level: 3, source: "claudette" },
  { id: "rl-8", sentenceId: "s-fitbit-23", sentenceIndex: 23, category: "A", level: 3, source: "claudette" },
  { id: "rl-9", sentenceId: "s-fitbit-24", sentenceIndex: 24, category: "LAW", level: 1, source: "claudette" },
  { id: "rl-10", sentenceId: "s-fitbit-25", sentenceIndex: 25, category: "J", level: 2, source: "claudette" },
  { id: "rl-11", sentenceId: "s-fitbit-3", sentenceIndex: 3, category: "USE", level: 2, source: "claudette" },
  // Phrase MULTI-catégories (test de la loupe) : la phrase 20 cumule LTD (N3, dominante)
  // + A (N2) → la fiche doit lister DEUX cartes ; l'overlay garde la dominante LTD N3.
  { id: "rl-12", sentenceId: "s-fitbit-20", sentenceIndex: 20, category: "A", level: 2, source: "claudette" },
];

export const FIXTURE_DOCUMENT: DocumentDetail = {
  id: "doc-fitbit",
  corpusId: "c-claudette",
  externalId: "fitbit",
  title: "Fitbit",
  language: "en",
  nSentences: FITBIT_SENTENCES.length,
  sentences: FITBIT_SENTENCES,
  referenceLabels: FITBIT_REFERENCE_LABELS,
  sourceMeta: { source: "CLAUDETTE-ToS", company: "Fitbit" },
};

export const FIXTURE_CORPUS: Corpus = {
  id: "c-claudette",
  slug: "claudette-tos",
  name: "CLAUDETTE ToS",
  description: "50 Terms of Service annotés pour l'injustice (Lippi 2019).",
  sourceUrl: "http://claudette.eui.eu/ToS.zip",
  license: "Research",
  defaultLanguage: "en",
  documentCount: 50,
};

// ── LabelScheme (dérivé de vocabulary.yaml) ──────────────────────────────────

export const FIXTURE_SCHEME: LabelScheme = {
  id: "scheme-1",
  slug: "claire-themes-v1",
  name: "CLAIRE Themes v1 (CLAUDETTE ToS)",
  version: "1.0.0",
  isActive: true,
  themes: THEMES.map((t, i) => ({
    id: `theme-${i}`,
    schemeId: "scheme-1",
    code: t.code,
    label: t.label,
    color: t.color,
    order: t.order,
  })),
  legalNatures: [
    { id: "ln-0", schemeId: "scheme-1", code: "OBLIGATION", label: "Obligation", order: 0 },
    { id: "ln-1", schemeId: "scheme-1", code: "PROHIBITION", label: "Interdiction", order: 1 },
    { id: "ln-2", schemeId: "scheme-1", code: "PERMISSION", label: "Permission", order: 2 },
    { id: "ln-3", schemeId: "scheme-1", code: "DEFINITION", label: "Définition", order: 3 },
    { id: "ln-4", schemeId: "scheme-1", code: "DECLARATION", label: "Déclaration", order: 4 },
    { id: "ln-5", schemeId: "scheme-1", code: "PROCEDURE", label: "Procédure / mécanisme", order: 5 },
  ],
};

// ── Project & progression ─────────────────────────────────────────────────────

export const FIXTURE_PROGRESS: ProjectProgress = {
  totalDocuments: 50,
  annotatedDocuments: 18,
  submittedDocuments: 12,
  approvedDocuments: 7,
  myAssigned: 10,
  myDone: 4,
  iaa: 0.78,
  iaaDetail: {
    globalKappa: 0.78,
    annotatorPairs: 3,
    boundaryKappa: 0.71,
    // κ par thème (échantillon représentatif : certains thèmes plus consensuels que d'autres).
    perTheme: [
      { code: "META", label: "Méta / dates / adresses", kappa: 0.94, support: 48 },
      { code: "PREAMBLE_SCOPE", label: "Préambule & périmètre", kappa: 0.82, support: 51 },
      { code: "PRIVACY_DATA", label: "Données & vie privée", kappa: 0.79, support: 63 },
      { code: "ELIGIBILITY_ACCOUNT", label: "Éligibilité & compte", kappa: 0.88, support: 40 },
      { code: "LICENSE_IP", label: "Licence & propriété intel.", kappa: 0.66, support: 35 },
      { code: "MODIFICATION_OF_TERMS", label: "Modification des conditions", kappa: 0.58, support: 29 },
      { code: "TERMINATION", label: "Résiliation", kappa: 0.84, support: 44 },
      { code: "LIMITATION_LIABILITY", label: "Limitation de responsabilité", kappa: 0.75, support: 52 },
      { code: "ARBITRATION_DISPUTES", label: "Arbitrage & litiges", kappa: 0.91, support: 33 },
      { code: "GOVERNING_LAW", label: "Loi applicable", kappa: 0.89, support: 31 },
      { code: "MISC_BOILERPLATE", label: "Boilerplate divers", kappa: 0.41, support: 27 },
    ],
  },
  // Concordance de MA session avec les modèles (point 4).
  concordance: {
    perJudge: [
      { judge: "claude", pct: 82.0, n: 120, matches: 98 },
      { judge: "codex", pct: 64.0, n: 120, matches: 77 },
      { judge: "mistral", pct: 58.0, n: 120, matches: 70 },
    ],
    bestMatch: { judge: "claude", pct: 82.0 },
    llmPairs: [
      { a: "claude", b: "codex", pct: 71.0, n: 120 },
      { a: "claude", b: "mistral", pct: 66.0, n: 120 },
      { a: "codex", b: "mistral", pct: 69.0, n: 120 },
    ],
    llmMeanPct: 68.7,
    documentsCompared: 4,
    humanCovered: 120,
  },
};

export const FIXTURE_PROJECT: Project = {
  id: "p-gold",
  slug: "claudette-gold-v1",
  name: "CLAUDETTE Gold v1",
  corpusSlug: "claudette-tos",
  schemeSlug: "claire-themes-v1",
  guidelines:
    "## Consignes\nAnnoter chaque clause par son thème. Utiliser l'overlay injustice comme aide, sans le recopier.",
  status: "active",
  myRole: "annotator",
  progress: FIXTURE_PROGRESS,
};

export const FIXTURE_ASSIGNMENTS: Assignment[] = [
  {
    id: "as-1",
    projectSlug: "claudette-gold-v1",
    document: {
      id: "doc-fitbit",
      corpusId: "c-claudette",
      externalId: "fitbit",
      title: "Fitbit",
      language: "en",
      nSentences: FITBIT_SENTENCES.length,
      hasTranslation: true,
    },
    assigneeId: "u-alice",
    status: "draft",
    annotationId: "ann-1",
  },
  {
    id: "as-2",
    projectSlug: "claudette-gold-v1",
    document: {
      id: "doc-instagram",
      corpusId: "c-claudette",
      externalId: "instagram",
      title: "Instagram Terms of Use",
      language: "en",
      nSentences: 40,
      hasTranslation: true,
    },
    assigneeId: "u-alice",
    status: "unstarted",
    annotationId: "ann-2",
  },
  {
    id: "as-3",
    projectSlug: "claudette-gold-v1",
    document: {
      id: "doc-booking",
      corpusId: "c-claudette",
      externalId: "booking",
      title: "Booking.com Terms",
      language: "en",
      nSentences: 52,
      hasTranslation: false,
    },
    assigneeId: "u-alice",
    status: "unstarted",
  },
];

// ── Annotation gold (humaine) en cours ────────────────────────────────────────

export const FIXTURE_ANNOTATION: Annotation = {
  id: "ann-1",
  projectSlug: "claudette-gold-v1",
  documentId: "doc-fitbit",
  annotatorId: "u-alice",
  status: "draft",
  globalCertainty: 2,
  source: "human",
  createdAt: "2026-06-15T09:00:00Z",
  updatedAt: "2026-06-17T11:30:00Z",
  clauses: [
    { id: "cl-1", annotationId: "ann-1", anchorIndex: 0, theme: "META", legalNature: "DECLARATION", evidenceSpan: "Fitbit Terms of Service", rationale: "Titre du document", certainty: 3, order: 0 },
    { id: "cl-2", annotationId: "ann-1", anchorIndex: 2, theme: "PREAMBLE_SCOPE", legalNature: "DEFINITION", evidenceSpan: "apply to your use of the Fitbit service", rationale: "Périmètre des CGU", certainty: 2, order: 1 },
    { id: "cl-3", annotationId: "ann-1", anchorIndex: 4, theme: "ELIGIBILITY_ACCOUNT", legalNature: "OBLIGATION", evidenceSpan: "at least 13 years old", rationale: "Condition d'âge", certainty: 3, order: 2 },
    { id: "cl-4", annotationId: "ann-1", anchorIndex: 7, theme: "PRIVACY_DATA", legalNature: "DECLARATION", evidenceSpan: "collect data about your activity", rationale: "Collecte de données", certainty: 2, order: 3 },
    { id: "cl-5", annotationId: "ann-1", anchorIndex: 10, theme: "LICENSE_IP", legalNature: "PERMISSION", evidenceSpan: "grant Fitbit a worldwide, royalty-free license", rationale: "Licence de contenu", certainty: 2, order: 4 },
  ],
};

// ── Pré-annotations LLM (F2) ──────────────────────────────────────────────────

export const FIXTURE_PREANNOTATIONS: PreAnnotation[] = [
  {
    id: "pre-claude",
    projectSlug: "claudette-gold-v1",
    documentId: "doc-fitbit",
    judge: "claude",
    schemaVersion: "v9.4",
    mapped: true,
    importedAt: "2026-06-16T08:00:00Z",
    clauses: [
      { anchorIndex: 0, themeCode: "META", evidenceSpan: "Fitbit Terms of Service", rationale: "Titre" },
      { anchorIndex: 1, themeCode: "MODIFICATION_OF_TERMS", evidenceSpan: "we recently revised these terms", rationale: "Notice de révision" },
      { anchorIndex: 2, themeCode: "PREAMBLE_SCOPE", evidenceSpan: "apply to your use", rationale: "Périmètre" },
      { anchorIndex: 4, themeCode: "ELIGIBILITY_ACCOUNT", evidenceSpan: "at least 13 years old", rationale: "Âge minimum" },
      { anchorIndex: 7, themeCode: "PRIVACY_DATA", evidenceSpan: "collect data", rationale: "Collecte" },
      { anchorIndex: 10, themeCode: "LICENSE_IP", evidenceSpan: "grant Fitbit a worldwide license", rationale: "Licence" },
      { anchorIndex: 11, themeCode: "ACCEPTABLE_USE", evidenceSpan: "not to misuse the service", rationale: "Usage acceptable" },
      { anchorIndex: 13, themeCode: "MODIFICATION_OF_TERMS", evidenceSpan: "modify or discontinue the service", rationale: "Modification du service" },
      { anchorIndex: 16, themeCode: "TERMINATION", evidenceSpan: "terminate or suspend your account", rationale: "Résiliation" },
      { anchorIndex: 18, themeCode: "WARRANTY_DISCLAIMER", evidenceSpan: "as is and as available", rationale: "Exclusion garantie" },
      { anchorIndex: 20, themeCode: "LIMITATION_LIABILITY", evidenceSpan: "shall not be liable", rationale: "Limitation responsabilité" },
      { anchorIndex: 22, themeCode: "ARBITRATION_DISPUTES", evidenceSpan: "binding arbitration", rationale: "Arbitrage" },
      { anchorIndex: 24, themeCode: "GOVERNING_LAW", evidenceSpan: "laws of the State of California", rationale: "Loi applicable" },
      { anchorIndex: 26, themeCode: "THIRD_PARTY_SERVICES", evidenceSpan: "links to third-party websites", rationale: "Services tiers" },
      { anchorIndex: 28, themeCode: "FEES_PAYMENT", evidenceSpan: "Subscription fees", rationale: "Frais" },
      { anchorIndex: 29, themeCode: "COMMUNICATIONS", evidenceSpan: "administrative communications", rationale: "Communications" },
      { anchorIndex: 30, themeCode: "MISC_BOILERPLATE", evidenceSpan: "remaining provisions remain in effect", rationale: "Clause de divisibilité" },
    ],
  },
  {
    id: "pre-codex",
    projectSlug: "claudette-gold-v1",
    documentId: "doc-fitbit",
    judge: "codex",
    schemaVersion: "v9.2",
    mapped: true,
    importedAt: "2026-06-16T08:05:00Z",
    clauses: [
      { anchorIndex: 0, themeCode: "META", evidenceSpan: "Fitbit Terms of Service" },
      { anchorIndex: 2, themeCode: "PREAMBLE_SCOPE", evidenceSpan: "apply to your use" },
      { anchorIndex: 4, themeCode: "ELIGIBILITY_ACCOUNT", evidenceSpan: "13 years old" },
      { anchorIndex: 9, themeCode: "USER_CONTENT", evidenceSpan: "ownership of the content" },
      { anchorIndex: 14, themeCode: "MODIFICATION_OF_TERMS", evidenceSpan: "change these terms" },
      { anchorIndex: 16, themeCode: "TERMINATION", evidenceSpan: "terminate or suspend" },
      { anchorIndex: 19, themeCode: "WARRANTY_DISCLAIMER", evidenceSpan: "disclaims all warranties" },
      { anchorIndex: 21, themeCode: "LIMITATION_LIABILITY", evidenceSpan: "total liability" },
      { anchorIndex: 23, themeCode: "ARBITRATION_DISPUTES", evidenceSpan: "class action" },
      { anchorIndex: 25, themeCode: "GOVERNING_LAW", evidenceSpan: "jurisdiction of the courts" },
    ],
  },
];

// ── Commentaires / Reviews / Activité ─────────────────────────────────────────

export const FIXTURE_COMMENTS: Comment[] = [
  {
    id: "cm-1",
    annotationId: "ann-1",
    clauseId: "cl-5",
    scope: "clause",
    authorId: "u-bruno",
    body: "La licence est-elle vraiment perpétuelle ? Vérifier la formulation exacte.",
    resolved: false,
    createdAt: "2026-06-17T10:00:00Z",
  },
  {
    id: "cm-2",
    annotationId: "ann-1",
    scope: "document",
    authorId: "u-alice",
    body: "Document globalement cohérent ; attention aux clauses de résiliation (16-17).",
    resolved: false,
    createdAt: "2026-06-17T11:30:00Z",
  },
  {
    id: "cm-3",
    annotationId: "ann-1",
    scope: "range",
    rangeStart: 16,
    rangeEnd: 17,
    authorId: "u-bruno",
    body: "Ce bloc mélange résiliation et suspension : à séparer ?",
    resolved: false,
    createdAt: "2026-06-17T12:00:00Z",
  },
  {
    id: "cm-4",
    annotationId: "ann-1",
    scope: "sentence",
    sentenceIndex: 9,
    authorId: "u-alice",
    body: "Phrase ambiguë sur la propriété du contenu utilisateur.",
    resolved: true,
    createdAt: "2026-06-17T12:10:00Z",
  },
];

/** Contributeurs (membres + couleurs d'identité) — attribution (point 3). */
export const FIXTURE_CONTRIBUTORS = [
  { userId: "u-alice", name: "Alice", color: "#06B6D4", role: "annotator" as const },
  { userId: "u-bruno", name: "Bruno", color: "#F59E0B", role: "annotator" as const },
  { userId: "u-camille", name: "Camille", color: "#A78BFA", role: "reviewer" as const },
];

/** Dernière modification attribuée par clause (anchorIndex) — point 3. */
export const FIXTURE_ATTRIBUTION = [
  { index: 0, actorId: "u-alice", actorName: "Alice", actorColor: "#06B6D4", verb: "clause.create", at: "2026-06-17T09:00:00Z" },
  { index: 16, actorId: "u-bruno", actorName: "Bruno", actorColor: "#F59E0B", verb: "clause.retheme", at: "2026-06-17T10:20:00Z" },
  { index: 22, actorId: "u-alice", actorName: "Alice", actorColor: "#06B6D4", verb: "clause.set_certainty", at: "2026-06-17T10:40:00Z" },
];

/** Présence collaborative (points 4b/7). */
export const FIXTURE_PRESENCE = {
  count: 2,
  results: [
    { userId: "u-alice", name: "Alice", color: "#06B6D4", focusSentence: 4, active: true },
    { userId: "u-bruno", name: "Bruno", color: "#F59E0B", focusSentence: 16, active: true },
  ],
};

/** Feature flags effectifs (mock : collaboratif activé pour la démo/e2e). */
export const FIXTURE_FLAGS = {
  realtimeCollaboration: true,
  presence: true,
  attributionOverlay: true,
  commentsMultilevel: true,
  undoRedo: true,
  analyticsScreen: true,
  versionExplorer: true,
};

/** Insights corpus (point 5) — KPI + distribution + documents. */
export const FIXTURE_CORPUS_INSIGHTS = {
  projectSlug: "claudette-gold-v1",
  kpi: {
    documentsAnnotated: 2,
    documentsTotal: 3,
    annotators: 3,
    versions: 5,
    meanCertainty: 2.1,
    kappa: 0.74,
  },
  themeDistribution: [
    { theme: "META", count: 4 },
    { theme: "TERMINATION", count: 6 },
    { theme: "LIMITATION_LIABILITY", count: 5 },
    { theme: "ARBITRATION_DISPUTES", count: 3 },
    { theme: "PRIVACY_DATA", count: 4 },
    { theme: "MISC_BOILERPLATE", count: 8 },
  ],
  documents: [
    { documentId: "doc-fitbit", title: "Fitbit Terms of Service", status: "submitted", clauses: 17, comments: 4, annotationId: "ann-1", approxPages: 2, hasTranslation: true },
    { documentId: "doc-instagram", title: "Instagram Terms of Use", status: "draft", clauses: 9, comments: 1, annotationId: "ann-2", approxPages: 4, hasTranslation: true },
    { documentId: "doc-booking", title: "Booking.com Terms", status: "unstarted", clauses: 0, comments: 0, approxPages: 6, hasTranslation: false },
  ],
};

/** Insights d'un document (point 5). */
export const FIXTURE_DOCUMENT_INSIGHTS = {
  documentId: "doc-fitbit",
  title: "Fitbit Terms of Service",
  annotationId: "ann-1",
  approxPages: 2,
  nSentences: 33,
  kpi: { clauses: 17, meanCertainty: 2.1, comments: 4, contributors: 3, agreementWithLlm: 0.68, approxPages: 2 },
  themeDistribution: [
    { theme: "META", count: 2 },
    { theme: "TERMINATION", count: 2 },
    { theme: "LIMITATION_LIABILITY", count: 2 },
    { theme: "PRIVACY_DATA", count: 1 },
    { theme: "MISC_BOILERPLATE", count: 3 },
  ],
  clauseCertainty: [
    { anchorIndex: 0, certainty: 3, theme: "META" },
    { anchorIndex: 4, certainty: 2, theme: "ELIGIBILITY_ACCOUNT" },
    { anchorIndex: 16, certainty: 3, theme: "TERMINATION" },
    { anchorIndex: 20, certainty: 1, theme: "LIMITATION_LIABILITY" },
    { anchorIndex: 22, certainty: 2, theme: "ARBITRATION_DISPUTES" },
  ],
};

/**
 * Timelines d'annotation par phrase (point 6) — comment l'annotation d'UNE phrase a
 * évolué à travers annotateurs et versions. Indexé par numéro de phrase.
 */
export const FIXTURE_SENTENCE_HISTORY: Record<number, import("@/types/contract").SentenceHistoryEntry[]> = {
  16: [
    { version: 1, actorId: "u-alice", actorName: "Alice", actorColor: "#06B6D4", verb: "clause.create", before: null, after: "TERMINATION", rationale: "Clause de résiliation", createdAt: "2026-06-15T09:35:00Z" },
    { version: 2, actorId: "u-bruno", actorName: "Bruno", actorColor: "#F59E0B", verb: "clause.retheme", before: "TERMINATION", after: "TERMINATION", rationale: "Confirmé après relecture", createdAt: "2026-06-16T14:50:00Z" },
    { version: 2, actorId: "u-alice", actorName: "Alice", actorColor: "#06B6D4", verb: "clause.set_certainty", before: "2", after: "3", rationale: null, createdAt: "2026-06-16T15:00:00Z" },
  ],
  0: [
    { version: 1, actorId: "u-alice", actorName: "Alice", actorColor: "#06B6D4", verb: "clause.create", before: null, after: "META", rationale: "Titre", createdAt: "2026-06-15T09:30:00Z" },
  ],
};

export const FIXTURE_REVIEWS: Review[] = [];

export const FIXTURE_ACTIVITY: ActivityEvent[] = [
  { id: "ev-1", actorId: "u-alice", actorName: "Alice", verb: "created_annotation", targetType: "annotation", targetId: "ann-1", createdAt: "2026-06-15T09:00:00Z" },
  { id: "ev-2", actorId: "u-alice", actorName: "Alice", verb: "added_clause", targetType: "clause", targetId: "cl-5", createdAt: "2026-06-16T14:20:00Z" },
  { id: "ev-3", actorId: "u-bruno", actorName: "Bruno", verb: "commented", targetType: "comment", targetId: "cm-1", createdAt: "2026-06-17T10:00:00Z" },
];

// ── Versions & snapshots (F3 — historique / diff) ─────────────────────────────

function pivotClause(
  anchorIndex: number,
  theme: string,
  evidenceSpan: string,
  rationale: string,
  certainty: 0 | 1 | 2 | 3,
  legalNature: string | null = null,
): PivotClause {
  return {
    anchor_index: anchorIndex,
    theme,
    legal_nature: legalNature,
    evidence_span: evidenceSpan,
    rationale,
    certainty,
  };
}

/**
 * Trois versions du document Fitbit montrant une vraie évolution :
 *  v1 — premier jet (3 clauses, certitudes basses).
 *  v2 — ajout de clauses + relèvement de certitudes + reclassement d'un thème.
 *  v3 — suppression d'une clause + ajout de la licence + nature juridique.
 */
export const FIXTURE_VERSIONS: AnnotationVersion[] = [
  {
    id: "v-1",
    annotationId: "ann-1",
    number: 1,
    authorId: "u-alice",
    label: "Premier jet",
    name: "Premier jet",
    description: "Première passe : en-tête, périmètre, éligibilité.",
    kind: "snapshot_manuel",
    stats: { clauses: 3, meanCertainty: 1.7 },
    createdAt: "2026-06-15T09:30:00Z",
    snapshot: {
      doc: "Fitbit",
      project: "claudette-gold-v1",
      annotator: "alice",
      schema: "claire-themes-v1",
      status: "draft",
      global_certainty: 1,
      clauses: [
        pivotClause(0, "META", "Fitbit Terms of Service", "Titre du document", 2),
        pivotClause(2, "PREAMBLE_SCOPE", "apply to your use", "Périmètre", 1),
        pivotClause(4, "ELIGIBILITY_ACCOUNT", "at least 13 years old", "Âge minimum", 2),
      ],
    },
  },
  {
    id: "v-2",
    annotationId: "ann-1",
    number: 2,
    authorId: "u-alice",
    label: "Ajout données & résiliation",
    name: "v2 — données & résiliation",
    description: "Ajout des clauses de données et de résiliation après relecture de Bruno.",
    kind: "soumission",
    stats: { clauses: 6, meanCertainty: 2.1 },
    createdAt: "2026-06-16T15:00:00Z",
    snapshot: {
      doc: "Fitbit",
      project: "claudette-gold-v1",
      annotator: "alice",
      schema: "claire-themes-v1",
      status: "draft",
      global_certainty: 2,
      clauses: [
        pivotClause(0, "META", "Fitbit Terms of Service", "Titre du document", 3),
        // PREAMBLE_SCOPE reclassé en MODIFICATION_OF_TERMS (modifié).
        pivotClause(2, "MODIFICATION_OF_TERMS", "apply to your use", "Reclassé", 2),
        pivotClause(4, "ELIGIBILITY_ACCOUNT", "at least 13 years old", "Âge minimum", 3),
        // Ajouts v2.
        pivotClause(7, "PRIVACY_DATA", "collect data about your activity", "Collecte de données", 2),
        pivotClause(16, "TERMINATION", "terminate or suspend your account", "Résiliation unilatérale", 2),
      ],
    },
  },
  {
    id: "v-3",
    annotationId: "ann-1",
    number: 3,
    authorId: "u-alice",
    label: "Licence + natures juridiques",
    createdAt: "2026-06-17T11:30:00Z",
    snapshot: {
      doc: "Fitbit",
      project: "claudette-gold-v1",
      annotator: "alice",
      schema: "claire-themes-v1",
      status: "submitted",
      global_certainty: 2,
      clauses: [
        pivotClause(0, "META", "Fitbit Terms of Service", "Titre du document", 3, "DECLARATION"),
        pivotClause(2, "PREAMBLE_SCOPE", "apply to your use of the Fitbit service", "Périmètre des CGU", 2, "DEFINITION"),
        pivotClause(4, "ELIGIBILITY_ACCOUNT", "at least 13 years old", "Condition d'âge", 3, "OBLIGATION"),
        pivotClause(7, "PRIVACY_DATA", "collect data about your activity", "Collecte de données", 2, "DECLARATION"),
        // anchor 16 (TERMINATION) supprimé en v3.
        // Ajout de la licence.
        pivotClause(10, "LICENSE_IP", "grant Fitbit a worldwide, royalty-free license", "Licence de contenu", 2, "PERMISSION"),
      ],
    },
  },
];

// ── Translation sets (F8 — sync file-based) ───────────────────────────────────

export const FIXTURE_TRANSLATION_SETS: TranslationSet[] = [
  {
    id: "ts-fr",
    corpusSlug: "claudette-tos",
    name: "CLAUDETTE FR",
    targetLanguage: "fr",
    folderPath: "/data/translations/claudette_fr",
    mappingStrategy: "external_id",
    status: "synced",
    mappedDocuments: 48,
    createdAt: "2026-06-10T08:00:00Z",
  },
  {
    id: "ts-de",
    corpusSlug: "claudette-tos",
    name: "CLAUDETTE DE",
    targetLanguage: "de",
    folderPath: "/data/translations/claudette_de",
    mappingStrategy: "filename",
    status: "declared",
    createdAt: "2026-06-17T09:00:00Z",
  },
];
