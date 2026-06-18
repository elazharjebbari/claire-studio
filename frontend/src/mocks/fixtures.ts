/**
 * Fixtures de mock (MSW & tests). Un document type « Fitbit » (~30 phrases) avec
 * labels d'injustice CLAUDETTE, pré-annotations claude & codex, projets, scheme.
 *
 * Données plausibles et cohérentes avec le CONTRACT — pas du Lorem ipsum.
 */

import type {
  Annotation,
  Assignment,
  Comment,
  Corpus,
  DocumentDetail,
  LabelScheme,
  PreAnnotation,
  Project,
  ProjectProgress,
  ReferenceLabel,
  Review,
  Sentence,
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
    },
    assigneeId: "u-alice",
    status: "draft",
    annotationId: "ann-1",
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
    authorId: "u-bruno",
    body: "La licence est-elle vraiment perpétuelle ? Vérifier la formulation exacte.",
    resolved: false,
    createdAt: "2026-06-17T10:00:00Z",
  },
];

export const FIXTURE_REVIEWS: Review[] = [];

export const FIXTURE_ACTIVITY: ActivityEvent[] = [
  { id: "ev-1", actorId: "u-alice", actorName: "Alice", verb: "created_annotation", targetType: "annotation", targetId: "ann-1", createdAt: "2026-06-15T09:00:00Z" },
  { id: "ev-2", actorId: "u-alice", actorName: "Alice", verb: "added_clause", targetType: "clause", targetId: "cl-5", createdAt: "2026-06-16T14:20:00Z" },
  { id: "ev-3", actorId: "u-bruno", actorName: "Bruno", verb: "commented", targetType: "comment", targetId: "cm-1", createdAt: "2026-06-17T10:00:00Z" },
];
