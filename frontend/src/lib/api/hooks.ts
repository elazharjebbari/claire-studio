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
  projectDocuments: (slug: string, mine: boolean) =>
    ["projects", slug, "documents", mine ? "mine" : "all"] as const,
  progress: (slug: string) => ["projects", slug, "progress"] as const,
  iaa: (slug: string) => ["projects", slug, "iaa"] as const,
  members: (slug: string) => ["projects", slug, "members"] as const,
  annotatorsProgress: (slug: string) =>
    ["projects", slug, "annotators-progress"] as const,
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
  goldDocuments: (slug: string) => ["projects", slug, "gold", "documents"] as const,
  goldDocument: (slug: string, ext: string) => ["projects", slug, "gold", ext] as const,
  goldStats: (slug: string) => ["projects", slug, "gold", "stats"] as const,
  goldConfig: (slug: string) => ["projects", slug, "gold", "config"] as const,
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

export function useCorpusDocuments(slug: string, pageSize?: number) {
  return useQuery({
    queryKey: pageSize
      ? [...qk.corpusDocs(slug), "ps", pageSize]
      : qk.corpusDocs(slug),
    queryFn: () => api.listCorpusDocuments(slug, pageSize),
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

export function useLockProject(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.lockProject(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.project(slug) }),
  });
}

export function useUnlockProject(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.unlockProject(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.project(slug) }),
  });
}

// Publication publique (chantier F) — lecture seule, sans auth.
export function usePublicProjects() {
  return useQuery({
    queryKey: ["public-projects"],
    queryFn: api.listPublicProjects,
  });
}

export function usePublicProject(slug: string | undefined) {
  return useQuery({
    queryKey: ["public-project", slug ?? ""],
    queryFn: () => api.getPublicProject(slug!),
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

/**
 * Documents du projet — **une entrée par document** (ADR-001). Remplace l'usage de
 * `useAssignments` pour bâtir les listes : supprime la duplication ×N par construction.
 * Dédup défensive (au cas où une couche héritée renverrait des doublons).
 */
export function useProjectDocuments(
  slug: string | undefined,
  opts?: { mine?: boolean },
) {
  const mine = !!opts?.mine;
  return useQuery({
    queryKey: qk.projectDocuments(slug ?? "", mine),
    queryFn: async () => {
      const res = await api.listProjectDocuments(slug!, { mine });
      const seen = new Set<string>();
      const results = (res.results ?? []).filter((row) => {
        const id = String(row.document.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return { ...res, results };
    },
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

/** IAA détaillé (R3) : moyenne + matrice paire-à-paire par document + détail. */
export function useProjectIaa(slug: string | undefined) {
  return useQuery({
    queryKey: qk.iaa(slug ?? ""),
    queryFn: () => api.getProjectIaa(slug!),
    enabled: Boolean(slug),
  });
}

export function useMembers(slug: string | undefined) {
  return useQuery({
    queryKey: qk.members(slug ?? ""),
    queryFn: () => api.listMembers(slug!),
    enabled: Boolean(slug),
  });
}

export function useAnnotatorsProgress(slug: string | undefined) {
  return useQuery({
    queryKey: qk.annotatorsProgress(slug ?? ""),
    queryFn: () => api.getAnnotatorsProgress(slug!),
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

export function usePreAnnotations(
  project: string | undefined,
  document: string | undefined,
  version?: string | null,
) {
  return useQuery({
    queryKey: [...qk.preannotations(project ?? "", document ?? ""), version ?? "default"],
    queryFn: () =>
      api.listPreAnnotations({ project, document, version: version ?? undefined }),
    enabled: Boolean(project && document),
  });
}

/** Versions LLM disponibles pour un document (multi-versions). */
export function useAnnotationVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["documents", documentId ?? "", "annotation-versions"],
    queryFn: () => api.getAnnotationVersions(documentId!),
    enabled: Boolean(documentId),
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
  version?: string | null,
) {
  const pre = usePreAnnotations(projectSlug, documentId, version);
  const doc = useDocument(documentId);

  return useMemo(() => {
    const results = pre.data?.results ?? [];
    const claudePre: PreAnnotation | undefined = results.find((p) => p.judge === "claude");
    const codexPre: PreAnnotation | undefined = results.find((p) => p.judge === "codex");
    // Tous les juges présents indexés par id (claude/codex/mistral/…) — source N-modèles
    // pour la réglette, le pré-remplissage et les fantômes.
    const preByJudge: Record<string, PreAnnotation> = {};
    for (const p of results) preByJudge[p.judge] = p;
    const n = doc.data?.nSentences ?? 0;

    const toJudge = (p: PreAnnotation | undefined): JudgeClause[] =>
      (p?.clauses ?? []).map((c) => ({ anchorIndex: c.anchorIndex, theme: c.themeCode }));

    const res = agreement(toJudge(claudePre), toJudge(codexPre), n);

    return {
      claudePre,
      codexPre,
      preByJudge,
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
    mutationFn: (
      clause: Partial<Clause> & {
        anchorIndex: number;
        theme: string;
        clientOpId?: string;
        upsert?: boolean;
      },
    ) => api.addClause(annotationId, clause),
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

// ── Triage (annotation assistée multi-label) ──────────────────────────────────
export function useBatchAcceptClauses(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clauses, upsert }: { clauses: api.BatchClauseInput[]; upsert?: boolean }) =>
      api.batchAcceptClauses(annotationId, clauses, { upsert }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotation(annotationId) }),
  });
}

export function useSwapClausePrimary(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => api.swapClausePrimary(id, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotation(annotationId) }),
  });
}

export function useSetClauseBoundary(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, op, validatedBy }: { id: string; op: "set_hard" | "set_soft"; validatedBy?: string }) =>
      api.setClauseBoundary(id, op, validatedBy),
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

export function useLockAnnotation(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.lockAnnotation(annotationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotation(annotationId) }),
  });
}

export function useUnlockAnnotation(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Réouverture possible (submitted → draft) : on rafraîchit aussi les versions.
    mutationFn: () => api.unlockAnnotation(annotationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.annotation(annotationId) });
      qc.invalidateQueries({ queryKey: qk.versions(annotationId) });
    },
  });
}

export function useAddComment(annotationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      body: string;
      scope?: import("@/types/contract").CommentScope;
      clauseId?: string;
      sentenceIndex?: number;
      rangeStart?: number;
      rangeEnd?: number;
    }) => api.addComment(annotationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.comments(annotationId) }),
  });
}

/** Contributeurs d'un document (membres + couleurs) — attribution (point 3). */
export function useContributors(documentId: string | undefined) {
  return useQuery({
    queryKey: ["documents", documentId ?? "", "contributors"],
    queryFn: () => api.getDocumentContributors(documentId!),
    enabled: Boolean(documentId),
  });
}

/** Dernière modification attribuée par cible (phrase/clause) — point 3. */
export function useAttribution(
  annotationId: string | undefined,
  by: "sentence" | "clause" = "clause",
) {
  return useQuery({
    queryKey: ["annotations", annotationId ?? "", "attribution", by],
    queryFn: () => api.getAttribution(annotationId!, by),
    enabled: Boolean(annotationId),
  });
}

/** Timeline d'annotation d'une phrase (tous annotateurs/versions) — point 6. */
export function useSentenceHistory(
  documentId: string | undefined,
  index: number | null,
) {
  return useQuery({
    queryKey: ["documents", documentId ?? "", "sentence-history", index ?? -1],
    queryFn: () => api.getSentenceHistory(documentId!, index!),
    enabled: Boolean(documentId) && index != null && index >= 0,
  });
}

/** Insights corpus — exploration des annotations humaines (point 5). */
export function useProjectInsights(slug: string | undefined) {
  return useQuery({
    queryKey: ["projects", slug ?? "", "insights"],
    queryFn: () => api.getProjectInsights(slug!),
    enabled: Boolean(slug),
  });
}

/** Insights d'un document (point 5). */
export function useDocumentInsights(slug: string | undefined, documentId: string | undefined) {
  return useQuery({
    queryKey: ["projects", slug ?? "", "insights", documentId ?? ""],
    queryFn: () => api.getDocumentInsights(slug!, documentId!),
    enabled: Boolean(slug && documentId),
  });
}

/** Feature flags effectifs (points 4b/7 + admin). */
export function useFeatureFlags() {
  return useQuery({
    queryKey: ["config", "flags"],
    queryFn: api.getFeatureFlags,
    staleTime: 60_000,
  });
}

/** Présence collaborative d'une annotation (points 4b/7). Poll léger. */
export function usePresence(annotationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["annotations", annotationId ?? "", "presence"],
    queryFn: () => api.getPresence(annotationId!),
    enabled: Boolean(annotationId) && enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useCreateShareLink(slug: string) {
  return useMutation({
    mutationFn: (payload: {
      roleGranted: "annotator" | "reviewer";
      expiresAt: string;
      maxUses?: number;
    }) => api.createShareLink(slug, payload),
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
    mutationFn: (opts?: { name?: string; label?: string; description?: string; kind?: string }) =>
      api.createVersion(annotationId, opts),
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

// ── Exports en tâche de fond (F5) ──────────────────────────────────────────────

/** Historique des jobs d'export d'un projet (récents d'abord). */
export function useProjectExports(slug: string | undefined) {
  return useQuery({
    queryKey: ["projects", slug ?? "", "exports"],
    queryFn: () => api.listProjectExports(slug!),
    enabled: Boolean(slug),
  });
}

/**
 * Suit UN job d'export avec POLLING ADAPTATIF : on interroge toutes les 1,5 s tant
 * que le job est `pending`/`running`, puis on STOPPE net dès `done`/`failed` (zéro
 * polling superflu).
 */
export function useExportJob(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["exports", id ?? ""],
    queryFn: () => api.getExport(id!),
    enabled: Boolean(id) && enabled,
    refetchInterval: (query) => {
      const s = (query.state.data as import("@/types/contract").ExportJob | undefined)?.status;
      return s === "done" || s === "failed" ? false : 1500;
    },
  });
}

/** Relance un job d'export (réinitialise + re-exécute en tâche de fond). */
export function useRetryExport(slug?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryExport(id),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["exports", job.id] });
      if (slug) qc.invalidateQueries({ queryKey: ["projects", slug, "exports"] });
    },
  });
}

// ── Résolution GOLD ────────────────────────────────────────────────────────────
/** Cockpit : liste des documents du projet avec statut/avancement/verrou. */
export function useGoldDocuments(slug?: string) {
  return useQuery({
    queryKey: qk.goldDocuments(slug ?? ""),
    queryFn: () => api.listGoldDocuments(slug!),
    enabled: Boolean(slug),
  });
}

/** Atelier : recompute + payload de résolution d'un document (par external_id). */
export function useGoldDocument(slug?: string, externalId?: string) {
  return useQuery({
    queryKey: qk.goldDocument(slug ?? "", externalId ?? ""),
    queryFn: () => api.getGoldDocument(slug!, externalId!),
    enabled: Boolean(slug) && Boolean(externalId),
  });
}

function useGoldInvalidate(slug: string, externalId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.goldDocument(slug, externalId) });
    qc.invalidateQueries({ queryKey: qk.goldDocuments(slug) });
  };
}

export function useDecideGold(slug: string, externalId: string) {
  const invalidate = useGoldInvalidate(slug, externalId);
  return useMutation({
    mutationFn: (payload: import("@/lib/gold/types").GoldDecidePayload) =>
      api.decideGold(slug, externalId, payload),
    onSuccess: invalidate,
  });
}

export function useAutoResolveGold(slug: string, externalId: string) {
  const invalidate = useGoldInvalidate(slug, externalId);
  return useMutation({
    mutationFn: () => api.autoResolveGold(slug, externalId),
    onSuccess: invalidate,
  });
}

export function useAcquireGoldLock(slug: string, externalId: string) {
  const invalidate = useGoldInvalidate(slug, externalId);
  return useMutation({
    mutationFn: () => api.acquireGoldLock(slug, externalId),
    onSuccess: invalidate,
  });
}

export function useReleaseGoldLock(slug: string, externalId: string) {
  const invalidate = useGoldInvalidate(slug, externalId);
  return useMutation({
    mutationFn: () => api.releaseGoldLock(slug, externalId),
    onSuccess: invalidate,
  });
}

export function useStealGoldLock(slug: string, externalId: string) {
  const invalidate = useGoldInvalidate(slug, externalId);
  return useMutation({
    mutationFn: () => api.stealGoldLock(slug, externalId),
    onSuccess: invalidate,
  });
}

/** Stats de concordance GOLD (A↔GOLD, LLM↔GOLD, A↔A). */
export function useGoldStats(slug?: string) {
  return useQuery({
    queryKey: qk.goldStats(slug ?? ""),
    queryFn: () => api.getGoldStats(slug!),
    enabled: Boolean(slug),
  });
}

/** Config de campagne de résolution (studio V7). */
export function useGoldConfig(slug?: string) {
  return useQuery({
    queryKey: qk.goldConfig(slug ?? ""),
    queryFn: () => api.getGoldConfig(slug!),
    enabled: Boolean(slug),
  });
}

export function useSaveGoldConfig(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<import("@/lib/gold/types").ResolutionConfig>) =>
      api.patchGoldConfig(slug, config),
    onSuccess: (cfg) => {
      qc.setQueryData(qk.goldConfig(slug), cfg);
      qc.invalidateQueries({ queryKey: qk.goldConfig(slug) });
    },
  });
}
