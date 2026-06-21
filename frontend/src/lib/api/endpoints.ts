/**
 * Fonctions d'appel typées par endpoint (CONTRACT §3). Une fonction = un endpoint.
 * Les hooks react-query (src/lib/api/hooks.ts) s'appuient dessus.
 */

import { apiFetch, tokenStore } from "./client";
import type {
  Annotation,
  ActivityEvent,
  AnnotatorProgress,
  Assignment,
  AuthTokens,
  ProjectMember,
  Clause,
  Comment,
  Corpus,
  DocumentDetail,
  DocumentSummary,
  DocumentTranslations,
  ExportJob,
  HealthStatus,
  LabelScheme,
  Paginated,
  PreAnnotation,
  Project,
  ProjectIaa,
  ProjectProgress,
  ProjectVisibility,
  PublicProject,
  PublicProjectDetail,
  Review,
  AnnotationVersion,
  TranslationSet,
  TranslationSyncResult,
  VersionDiff,
  User,
  Certainty,
} from "@/types/contract";

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthTokens> {
  const tokens = await apiFetch<AuthTokens>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  tokenStore.set(tokens.access, tokens.refresh);
  return tokens;
}

export function logout(): void {
  tokenStore.clear();
}

export function getMe(): Promise<User> {
  return apiFetch<User>("/me");
}

// ── Onboarding (chantier E) — endpoints publics ────────────────────────────────

export function register(payload: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<User> {
  return apiFetch<User>("/auth/register", { method: "POST", body: payload });
}

export function verifyEmail(token: string): Promise<{ detail: string }> {
  return apiFetch("/auth/verify-email", { method: "POST", body: { token } });
}

export function requestPasswordReset(email: string): Promise<{ detail: string }> {
  return apiFetch("/auth/password-reset", { method: "POST", body: { email } });
}

export function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string,
): Promise<{ detail: string }> {
  return apiFetch("/auth/password-reset/confirm", {
    method: "POST",
    body: { uid, token, newPassword },
  });
}

/** Met à jour le profil de l'utilisateur courant (display_name, locale). */
export function updateProfile(payload: {
  displayName?: string;
  locale?: string;
}): Promise<User> {
  return apiFetch<User>("/me", { method: "PATCH", body: payload });
}

/** GET /health (sans auth) — état du backend (status + compteurs). */
export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}

// ── Corpora & documents ─────────────────────────────────────────────────────

export function listCorpora(): Promise<Paginated<Corpus>> {
  return apiFetch<Paginated<Corpus>>("/corpora");
}

export function listCorpusDocuments(
  slug: string,
  pageSize?: number,
): Promise<Paginated<DocumentSummary>> {
  const qs = pageSize ? `?page_size=${pageSize}` : "";
  return apiFetch<Paginated<DocumentSummary>>(`/corpora/${slug}/documents${qs}`);
}

export function getDocument(id: string): Promise<DocumentDetail> {
  return apiFetch<DocumentDetail>(`/documents/${id}?include=reference_labels`);
}

/**
 * Traductions phrase par phrase d'un document (P0/P5).
 * GET /documents/{id}/translations?lang= → {language, count, results:[{sentenceIndex,text}]}.
 */
export function getDocumentTranslations(
  id: string,
  lang = "fr",
): Promise<DocumentTranslations> {
  return apiFetch<DocumentTranslations>(`/documents/${id}/translations?lang=${lang}`);
}

// ── Schemes ─────────────────────────────────────────────────────────────────

export function listSchemes(): Promise<Paginated<LabelScheme>> {
  return apiFetch<Paginated<LabelScheme>>("/schemes");
}

export function getScheme(slug: string): Promise<LabelScheme> {
  return apiFetch<LabelScheme>(`/schemes/${slug}`);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function listProjects(): Promise<Paginated<Project>> {
  return apiFetch<Paginated<Project>>("/projects");
}

export function getProject(slug: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${slug}`);
}

// ── Publication (chantier F) ───────────────────────────────────────────────────

export function listPublicProjects(): Promise<Paginated<PublicProject>> {
  return apiFetch<Paginated<PublicProject>>("/public/projects");
}

export function getPublicProject(slug: string): Promise<PublicProjectDetail> {
  return apiFetch<PublicProjectDetail>(`/public/projects/${slug}`);
}

/** Admin : publie / dépublie un projet (PATCH visibility). */
export function setProjectVisibility(
  slug: string,
  visibility: ProjectVisibility,
): Promise<Project> {
  return apiFetch<Project>(`/projects/${slug}`, {
    method: "PATCH",
    body: { visibility },
  });
}

export function listAssignments(slug: string): Promise<Paginated<Assignment>> {
  return apiFetch<Paginated<Assignment>>(`/projects/${slug}/assignments`);
}

export function getProjectProgress(slug: string): Promise<ProjectProgress> {
  return apiFetch<ProjectProgress>(`/projects/${slug}/progress`);
}

/** IAA détaillé (R3) : moyenne + matrice paire-à-paire par document + détail. */
export function getProjectIaa(slug: string): Promise<ProjectIaa> {
  return apiFetch<ProjectIaa>(`/projects/${slug}/iaa`);
}

// ── Gestion de campagne (admin) : assignations & membres ───────────────────────

export function createAssignment(
  slug: string,
  document: string,
  assignee: string,
): Promise<Assignment> {
  return apiFetch<Assignment>(`/projects/${slug}/assignments`, {
    method: "POST",
    body: { document, assignee },
  });
}

export function deleteAssignment(slug: string, assignmentId: string): Promise<void> {
  return apiFetch<void>(`/projects/${slug}/assignments/${assignmentId}`, {
    method: "DELETE",
  });
}

export function bulkAssign(
  slug: string,
  payload: { documents?: string[] | "all"; assignees?: string[]; overlap?: number },
): Promise<{ created: number; requested: number }> {
  return apiFetch(`/projects/${slug}/assignments/bulk`, {
    method: "POST",
    body: payload,
  });
}

export function listMembers(slug: string): Promise<Paginated<ProjectMember>> {
  return apiFetch<Paginated<ProjectMember>>(`/projects/${slug}/members`);
}

export function addMember(
  slug: string,
  user: string,
  role?: string,
): Promise<ProjectMember> {
  return apiFetch<ProjectMember>(`/projects/${slug}/members`, {
    method: "POST",
    body: { user, role },
  });
}

export function removeMember(slug: string, userId: string): Promise<void> {
  return apiFetch<void>(`/projects/${slug}/members/${userId}`, { method: "DELETE" });
}

export function getAnnotatorsProgress(
  slug: string,
): Promise<Paginated<AnnotatorProgress>> {
  return apiFetch<Paginated<AnnotatorProgress>>(
    `/projects/${slug}/annotators-progress`,
  );
}

// ── Annotations & clauses ─────────────────────────────────────────────────────

export function getAnnotation(id: string): Promise<Annotation> {
  return apiFetch<Annotation>(`/annotations/${id}`);
}

export function listAnnotations(params: {
  project?: string;
  document?: string;
  annotator?: string;
}): Promise<Paginated<Annotation>> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  return apiFetch<Paginated<Annotation>>(`/annotations?${qs}`);
}

export function createAnnotation(payload: {
  project: string;
  document: string;
  seed?: string;
}): Promise<Annotation> {
  return apiFetch<Annotation>("/annotations", { method: "POST", body: payload });
}

export function patchAnnotation(
  id: string,
  patch: { status?: Annotation["status"]; global_certainty?: Certainty | null },
): Promise<Annotation> {
  return apiFetch<Annotation>(`/annotations/${id}`, { method: "PATCH", body: patch });
}

export function submitAnnotation(id: string): Promise<Annotation> {
  return apiFetch<Annotation>(`/annotations/${id}/submit`, { method: "POST" });
}

export function addClause(
  annotationId: string,
  clause: Partial<Clause> & { anchorIndex: number; theme: string; clientOpId?: string },
): Promise<Clause> {
  return apiFetch<Clause>(`/annotations/${annotationId}/clauses`, {
    method: "POST",
    body: {
      anchor_index: clause.anchorIndex,
      theme: clause.theme,
      legal_nature: clause.legalNature ?? null,
      evidence_span: clause.evidenceSpan ?? "",
      rationale: clause.rationale ?? "",
      certainty: clause.certainty ?? null,
      // Idempotence (chantier C) : un retry portant le même op ne duplique pas.
      client_op_id: clause.clientOpId,
    },
  });
}

export function patchClause(id: string, patch: Partial<Clause>): Promise<Clause> {
  return apiFetch<Clause>(`/clauses/${id}`, {
    method: "PATCH",
    body: {
      theme: patch.theme,
      legal_nature: patch.legalNature,
      evidence_span: patch.evidenceSpan,
      rationale: patch.rationale,
      certainty: patch.certainty,
    },
  });
}

export function deleteClause(id: string): Promise<void> {
  return apiFetch<void>(`/clauses/${id}`, { method: "DELETE" });
}

// ── Versioning / historique ───────────────────────────────────────────────────

export function listVersions(annotationId: string): Promise<Paginated<AnnotationVersion>> {
  return apiFetch<Paginated<AnnotationVersion>>(`/annotations/${annotationId}/versions`);
}

export function createVersion(
  annotationId: string,
  opts?: { name?: string; label?: string; description?: string; kind?: string },
): Promise<AnnotationVersion> {
  return apiFetch<AnnotationVersion>(`/annotations/${annotationId}/versions`, {
    method: "POST",
    body: {
      name: opts?.name,
      label: opts?.label ?? opts?.name,
      description: opts?.description,
      kind: opts?.kind,
    },
  });
}

/**
 * Diff de la version `to` contre `against` (par défaut la version précédente).
 * CONTRACT §3 : GET /annotations/{id}/versions/{n}/diff.
 */
export function getVersionDiff(
  annotationId: string,
  to: number,
  against?: number,
): Promise<VersionDiff> {
  const qs = against != null ? `?against=${against}` : "";
  return apiFetch<VersionDiff>(`/annotations/${annotationId}/versions/${to}/diff${qs}`);
}

// ── Commentaires (F9) ─────────────────────────────────────────────────────────

export function listComments(annotationId: string): Promise<Paginated<Comment>> {
  return apiFetch<Paginated<Comment>>(`/annotations/${annotationId}/comments`);
}

export function addComment(
  annotationId: string,
  payload: {
    body: string;
    scope?: import("@/types/contract").CommentScope;
    clauseId?: string;
    sentenceIndex?: number;
    rangeStart?: number;
    rangeEnd?: number;
    threadRoot?: string;
  },
): Promise<Comment> {
  return apiFetch<Comment>(`/annotations/${annotationId}/comments`, {
    method: "POST",
    body: {
      body: payload.body,
      scope: payload.scope ?? (payload.clauseId ? "clause" : "document"),
      clause: payload.clauseId ?? null,
      sentence_index: payload.sentenceIndex ?? null,
      range_start: payload.rangeStart ?? null,
      range_end: payload.rangeEnd ?? null,
      thread_root: payload.threadRoot ?? null,
    },
  });
}

export function resolveComment(id: string): Promise<Comment> {
  return apiFetch<Comment>(`/comments/${id}/resolve`, { method: "POST" });
}

// ── Attribution & contributeurs (point 3) ─────────────────────────────────────

export function getDocumentContributors(
  documentId: string,
): Promise<import("@/types/contract").ContributorsResponse> {
  return apiFetch(`/documents/${documentId}/contributors`);
}

export function getAttribution(
  annotationId: string,
  by: "sentence" | "clause" = "clause",
): Promise<import("@/types/contract").AttributionResponse> {
  return apiFetch(`/annotations/${annotationId}/attribution?by=${by}`);
}

/** Timeline d'annotation d'une phrase (tous annotateurs/versions) — point 6. */
export function getSentenceHistory(
  documentId: string,
  index: number,
): Promise<import("@/types/contract").SentenceHistoryResponse> {
  return apiFetch(`/documents/${documentId}/sentence-history?index=${index}`);
}

// ── Exploration des annotations humaines (point 5) ────────────────────────────

export function getProjectInsights(
  slug: string,
): Promise<import("@/types/contract").CorpusInsightsResponse> {
  return apiFetch(`/projects/${slug}/insights`);
}

export function getDocumentInsights(
  slug: string,
  documentId: string,
): Promise<import("@/types/contract").DocumentInsightsResponse> {
  return apiFetch(`/projects/${slug}/insights/${documentId}`);
}

// ── Collaboration temps réel & partage (points 4b/7) ─────────────────────────

export function getFeatureFlags(): Promise<import("@/types/contract").FeatureFlags> {
  return apiFetch(`/config/flags`);
}

export function getPresence(
  annotationId: string,
): Promise<import("@/types/contract").PresenceResponse> {
  return apiFetch(`/annotations/${annotationId}/presence`);
}

export function createShareLink(
  slug: string,
  payload: { roleGranted: "annotator" | "reviewer"; expiresAt: string; maxUses?: number },
): Promise<import("@/types/contract").ShareLink> {
  return apiFetch(`/projects/${slug}/share-links`, {
    method: "POST",
    body: {
      role_granted: payload.roleGranted,
      expires_at: payload.expiresAt,
      max_uses: payload.maxUses ?? null,
    },
  });
}

/** Rejoint un projet via un lien de partage (utilisateur authentifié, chantier D). */
export function joinShareLink(
  token: string,
): Promise<{ projectSlug: string; role: string; joined: boolean }> {
  return apiFetch(`/share-links/${token}/join`, { method: "POST", body: {} });
}

// ── Reviews (F10) ─────────────────────────────────────────────────────────────

export function listReviews(annotationId: string): Promise<Paginated<Review>> {
  return apiFetch<Paginated<Review>>(`/annotations/${annotationId}/reviews`);
}

export function addReview(
  annotationId: string,
  payload: { score: number; decision: Review["decision"]; body?: string },
): Promise<Review> {
  return apiFetch<Review>(`/annotations/${annotationId}/reviews`, {
    method: "POST",
    body: payload,
  });
}

// ── Pré-annotations (F2) ──────────────────────────────────────────────────────

export function listPreAnnotations(params: {
  project?: string;
  document?: string;
  judge?: string;
  /** Version d'annotation à charger (multi-versions). Défaut backend si absent. */
  version?: string;
}): Promise<Paginated<PreAnnotation>> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  return apiFetch<Paginated<PreAnnotation>>(`/preannotations?${qs}`);
}

export interface AnnotationVersionRow {
  version: string;
  judge: string;
  nClauses: number;
}
export interface AnnotationVersionsResponse {
  versions: string[];
  count: number;
  results: AnnotationVersionRow[];
}

/** Versions LLM disponibles pour un document (multi-versions). */
export function getAnnotationVersions(
  documentId: string,
): Promise<AnnotationVersionsResponse> {
  return apiFetch<AnnotationVersionsResponse>(
    `/documents/${documentId}/annotation-versions`,
  );
}

export function importPreAnnotations(
  slug: string,
  payload: { judge: string; raw: unknown },
): Promise<PreAnnotation> {
  return apiFetch<PreAnnotation>(`/projects/${slug}/preannotations/import`, {
    method: "POST",
    body: payload,
  });
}

// ── Exports (F5) ──────────────────────────────────────────────────────────────

export function createExport(
  slug: string,
  payload: { format: ExportJob["format"]; scope?: Record<string, unknown> },
): Promise<ExportJob> {
  return apiFetch<ExportJob>(`/projects/${slug}/exports`, { method: "POST", body: payload });
}

export function getExport(id: string): Promise<ExportJob> {
  return apiFetch<ExportJob>(`/exports/${id}`);
}

// ── Activité / audit (F4) ──────────────────────────────────────────────────────

export function listActivity(params: {
  project?: string;
  actor?: string;
  verb?: string;
}): Promise<Paginated<ActivityEvent>> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  return apiFetch<Paginated<ActivityEvent>>(`/activity?${qs}`);
}

// ── Traductions file-based (F8) ───────────────────────────────────────────────

export function listTranslationSets(): Promise<Paginated<TranslationSet>> {
  return apiFetch<Paginated<TranslationSet>>("/translations/sets");
}

export function listProjectTranslations(slug: string): Promise<Paginated<TranslationSet>> {
  return apiFetch<Paginated<TranslationSet>>(`/projects/${slug}/translations`);
}

export function createTranslationSet(payload: {
  corpus?: string;
  name: string;
  targetLanguage: string;
  folderPath: string;
  mappingStrategy?: TranslationSet["mappingStrategy"];
}): Promise<TranslationSet> {
  return apiFetch<TranslationSet>("/translations/sets", {
    method: "POST",
    body: {
      corpus: payload.corpus,
      name: payload.name,
      target_language: payload.targetLanguage,
      folder_path: payload.folderPath,
      mapping_strategy: payload.mappingStrategy,
    },
  });
}

export function syncTranslationSet(id: string): Promise<TranslationSyncResult> {
  return apiFetch<TranslationSyncResult>(`/translations/sets/${id}/sync`, { method: "POST" });
}
