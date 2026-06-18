/**
 * Fonctions d'appel typées par endpoint (CONTRACT §3). Une fonction = un endpoint.
 * Les hooks react-query (src/lib/api/hooks.ts) s'appuient dessus.
 */

import { apiFetch, tokenStore } from "./client";
import type {
  Annotation,
  ActivityEvent,
  Assignment,
  AuthTokens,
  Clause,
  Comment,
  Corpus,
  DocumentDetail,
  DocumentSummary,
  ExportJob,
  LabelScheme,
  Paginated,
  PreAnnotation,
  Project,
  ProjectProgress,
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

// ── Corpora & documents ─────────────────────────────────────────────────────

export function listCorpora(): Promise<Paginated<Corpus>> {
  return apiFetch<Paginated<Corpus>>("/corpora");
}

export function listCorpusDocuments(slug: string): Promise<Paginated<DocumentSummary>> {
  return apiFetch<Paginated<DocumentSummary>>(`/corpora/${slug}/documents`);
}

export function getDocument(id: string): Promise<DocumentDetail> {
  return apiFetch<DocumentDetail>(`/documents/${id}?include=reference_labels`);
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

export function listAssignments(slug: string): Promise<Paginated<Assignment>> {
  return apiFetch<Paginated<Assignment>>(`/projects/${slug}/assignments`);
}

export function getProjectProgress(slug: string): Promise<ProjectProgress> {
  return apiFetch<ProjectProgress>(`/projects/${slug}/progress`);
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
  clause: Partial<Clause> & { anchorIndex: number; theme: string },
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
  label?: string,
): Promise<AnnotationVersion> {
  return apiFetch<AnnotationVersion>(`/annotations/${annotationId}/versions`, {
    method: "POST",
    body: { label },
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
  payload: { body: string; clauseId?: string; sentenceIndex?: number; threadRoot?: string },
): Promise<Comment> {
  return apiFetch<Comment>(`/annotations/${annotationId}/comments`, {
    method: "POST",
    body: {
      body: payload.body,
      clause: payload.clauseId ?? null,
      sentence_index: payload.sentenceIndex ?? null,
      thread_root: payload.threadRoot ?? null,
    },
  });
}

export function resolveComment(id: string): Promise<Comment> {
  return apiFetch<Comment>(`/comments/${id}/resolve`, { method: "POST" });
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
}): Promise<Paginated<PreAnnotation>> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  return apiFetch<Paginated<PreAnnotation>>(`/preannotations?${qs}`);
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
