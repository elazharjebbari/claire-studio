"use client";

/**
 * Hooks react-query construits sur les fonctions d'endpoint typées.
 * Clés de cache stables ; invalidations ciblées après mutations.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./endpoints";
import type {
  Annotation,
  Certainty,
  Clause,
  PreAnnotation,
  Review,
} from "@/types/contract";
import { agreement, type JudgeClause } from "@/lib/llmAgreement";

export const qk = {
  health: ["health"] as const,
  me: ["me"] as const,
  corpora: ["corpora"] as const,
  corpusDocs: (slug: string) => ["corpora", slug, "documents"] as const,
  document: (id: string) => ["documents", id] as const,
  documentTranslations: (id: string, lang: string) =>
    ["documents", id, "translations", lang] as const,
  schemes: ["schemes"] as const,
  scheme: (slug: string) => ["schemes", slug] as const,
  projects: ["projects"] as const,
  project: (slug: string) => ["projects", slug] as const,
  assignments: (slug: string) => ["projects", slug, "assignments"] as const,
  progress: (slug: string) => ["projects", slug, "progress"] as const,
  annotation: (id: string) => ["annotations", id] as const,
  versions: (id: string) => ["annotations", id, "versions"] as const,
  versionDiff: (id: string, to: number, against?: number) =>
    ["annotations", id, "versions", to, "diff", against ?? "prev"] as const,
  comments: (id: string) => ["annotations", id, "comments"] as const,
  reviews: (id: string) => ["annotations", id, "reviews"] as const,
  preannotations: (project: string, doc: string) =>
    ["preannotations", project, doc] as const,
  activity: (project?: string) => ["activity", project ?? "all"] as const,
  translationSets: ["translations", "sets"] as const,
};

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: api.getMe });
}

/** Sonde /health (sans auth) — utilisée par la DebugBar. Rafraîchissable. */
export function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: api.getHealth,
    retry: 0,
    staleTime: 10_000,
  });
}

export function useCorpora() {
  return useQuery({ queryKey: qk.corpora, queryFn: api.listCorpora });
}

export function useCorpusDocuments(slug: string) {
  return useQuery({
    queryKey: qk.corpusDocs(slug),
    queryFn: () => api.listCorpusDocuments(slug),
    enabled: Boolean(slug),
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: qk.document(id ?? ""),
    queryFn: () => api.getDocument(id!),
    enabled: Boolean(id),
  });
}

/**
 * Traductions FR du document (P5). Expose la requête brute + une Map index→texte
 * mémoïsée, prête à l'affichage sous chaque phrase.
 */
export function useDocumentTranslations(documentId: string | undefined, lang = "fr") {
  const query = useQuery({
    queryKey: qk.documentTranslations(documentId ?? "", lang),
    queryFn: () => api.getDocumentTranslations(documentId!, lang),
    enabled: Boolean(documentId),
  });

  const byIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of query.data?.results ?? []) map.set(r.sentenceIndex, r.text);
    return map;
  }, [query.data]);

  return { ...query, byIndex };
}

export function useScheme(slug: string | undefined) {
  return useQuery({
    queryKey: qk.scheme(slug ?? ""),
    queryFn: () => api.getScheme(slug!),
    enabled: Boolean(slug),
  });
}

export function useProjects() {
  return useQuery({ queryKey: qk.projects, queryFn: api.listProjects });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: qk.project(slug ?? ""),
    queryFn: () => api.getProject(slug!),
    enabled: Boolean(slug),
  });
}

export function useAssignments(slug: string | undefined) {
  return useQuery({
    queryKey: qk.assignments(slug ?? ""),
    queryFn: () => api.listAssignments(slug!),
    enabled: Boolean(slug),
  });
}

export function useProjectProgress(slug: string | undefined) {
  return useQuery({
    queryKey: qk.progress(slug ?? ""),
    queryFn: () => api.getProjectProgress(slug!),
    enabled: Boolean(slug),
  });
}

export function useAnnotation(id: string | undefined) {
  return useQuery({
    queryKey: qk.annotation(id ?? ""),
    queryFn: () => api.getAnnotation(id!),
    enabled: Boolean(id),
  });
}

export function useVersions(id: string | undefined) {
  return useQuery({
    queryKey: qk.versions(id ?? ""),
    queryFn: () => api.listVersions(id!),
    enabled: Boolean(id),
  });
}

export function useVersionDiff(
  id: string | undefined,
  to: number | undefined,
  against?: number,
) {
  return useQuery({
    queryKey: qk.versionDiff(id ?? "", to ?? -1, against),
    queryFn: () => api.getVersionDiff(id!, to!, against),
    enabled: Boolean(id) && typeof to === "number" && to >= 1,
  });
}

export function useTranslationSets() {
  return useQuery({ queryKey: qk.translationSets, queryFn: api.listTranslationSets });
}

export function useComments(id: string | undefined) {
  return useQuery({
    queryKey: qk.comments(id ?? ""),
    queryFn: () => api.listComments(id!),
    enabled: Boolean(id),
  });
}

export function useReviews(id: string | undefined) {
  return useQuery({
    queryKey: qk.reviews(id ?? ""),
    queryFn: () => api.listReviews(id!),
    enabled: Boolean(id),
  });
}

export function usePreAnnotations(project: string | undefined, document: string | undefined) {
  return useQuery({
    queryKey: qk.preannotations(project ?? "", document ?? ""),
    queryFn: () => api.listPreAnnotations({ project, document }),
    enabled: Boolean(project && document),
  });
}

/** Toutes les pré-annotations d'un projet (tous documents) — vue admin. */
export function useProjectPreAnnotations(project: string | undefined) {
  return useQuery({
    queryKey: qk.preannotations(project ?? "", "all"),
    queryFn: () => api.listPreAnnotations({ project }),
    enabled: Boolean(project),
  });
}

/**
 * Accord inter-juges Claude/Codex pour un document (Q3). Récupère les 2 pré-annotations
 * + le document (pour nSentences), projette le thème par phrase de chaque juge et
 * calcule l'accord (% + κ de Cohen). Renvoie aussi les deux pré-annotations brutes
 * (rationaleGlobal, etc.). Mémoïsé sur les données.
 */
export function useLlmAgreement(
  documentId: string | undefined,
  projectSlug: string | undefined,
) {
  const pre = usePreAnnotations(projectSlug, documentId);
  const doc = useDocument(documentId);

  return useMemo(() => {
    const results = pre.data?.results ?? [];
    const claudePre: PreAnnotation | undefined = results.find((p) => p.judge === "claude");
    const codexPre: PreAnnotation | undefined = results.find((p) => p.judge === "codex");
    const n = doc.data?.nSentences ?? 0;

    const toJudge = (p: PreAnnotation | undefined): JudgeClause[] =>
      (p?.clauses ?? []).map((c) => ({ anchorIndex: c.anchorIndex, theme: c.themeCode }));

    const res = agreement(toJudge(claudePre), toJudge(codexPre), n);

    return {
      claudePre,
      codexPre,
      claudeByIndex: res.claudeByIndex,
      codexByIndex: res.codexByIndex,
      agreementPct: res.agreementPct,
      kappa: res.kappa,
      support: res.support,
      nSentences: n,
      isLoading: pre.isLoading || doc.isLoading,
    };
  }, [pre.data, pre.isLoading, doc.data, doc.isLoading]);
}

export function useActivity(project?: string) {
  return useQuery({
    queryKey: qk.activity(project),
    queryFn: () => api.listActivity({ project }),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAddClause(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clause: Partial<Clause> & { anchorIndex: number; theme: string }) =>
      api.addClause(annotationId, clause),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotation(annotationId) }),
  });
}

export function usePatchClause(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Clause> }) =>
      api.patchClause(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotation(annotationId) }),
  });
}

export function useDeleteClause(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteClause(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotation(annotationId) }),
  });
}

export function usePatchAnnotation(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { status?: Annotation["status"]; global_certainty?: Certainty | null }) =>
      api.patchAnnotation(annotationId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotation(annotationId) }),
  });
}

export function useAddComment(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; clauseId?: string; sentenceIndex?: number }) =>
      api.addComment(annotationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.comments(annotationId) }),
  });
}

export function useResolveComment(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resolveComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.comments(annotationId) }),
  });
}

export function useAddReview(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { score: number; decision: Review["decision"]; body?: string }) =>
      api.addReview(annotationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reviews(annotationId) }),
  });
}

export function useCreateVersion(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label?: string) => api.createVersion(annotationId, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.versions(annotationId) }),
  });
}

export function useCreateTranslationSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTranslationSet,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.translationSets }),
  });
}

export function useSyncTranslationSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.syncTranslationSet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.translationSets }),
  });
}
