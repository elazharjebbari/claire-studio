/**
 * Handlers MSW — simulent les endpoints clés du CONTRACT §3. Permettent de faire
 * tourner le frontend MVP sans backend, et servent de mock dans les tests Vitest/E2E.
 *
 * L'état des annotations est mutable en mémoire (création de clause, patch, etc.)
 * pour que les parcours d'annotation soient réellement interactifs.
 */

import { http, HttpResponse } from "msw";
import type {
  Annotation,
  Clause,
  Comment,
  Review,
  TranslationMappingEntry,
  TranslationSet,
} from "@/types/contract";
import { buildVersionDiff } from "@/lib/versionDiff";
import {
  FIXTURE_ACTIVITY,
  FIXTURE_ANNOTATION,
  FIXTURE_ASSIGNMENTS,
  FIXTURE_ATTRIBUTION,
  FIXTURE_COMMENTS,
  FIXTURE_CONTRIBUTORS,
  FIXTURE_CORPUS,
  FIXTURE_CORPUS_INSIGHTS,
  FIXTURE_DOCUMENT_INSIGHTS,
  FIXTURE_FLAGS,
  FIXTURE_PRESENCE,
  FIXTURE_DOCUMENT,
  FIXTURE_PREANNOTATIONS,
  FIXTURE_PROGRESS,
  FIXTURE_SENTENCE_HISTORY,
  FIXTURE_PROJECT,
  FIXTURE_REVIEWS,
  FIXTURE_SCHEME,
  // (FIXTURE_REVIEWS sert d'état initial mutable ci-dessous)
  FIXTURE_TRANSLATION_SETS,
  FIXTURE_USER,
  FIXTURE_VERSIONS,
} from "./fixtures";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

// État mutable en mémoire (réinitialisable dans les tests via resetDb()).
let annotation: Annotation = structuredClone(FIXTURE_ANNOTATION);
let comments: Comment[] = structuredClone(FIXTURE_COMMENTS);
let reviews: Review[] = structuredClone(FIXTURE_REVIEWS);
let translationSets: TranslationSet[] = structuredClone(FIXTURE_TRANSLATION_SETS);
let clauseSeq = 100;
let commentSeq = 100;
let reviewSeq = 100;
let translationSeq = 100;

export function resetDb(): void {
  annotation = structuredClone(FIXTURE_ANNOTATION);
  comments = structuredClone(FIXTURE_COMMENTS);
  reviews = structuredClone(FIXTURE_REVIEWS);
  translationSets = structuredClone(FIXTURE_TRANSLATION_SETS);
  clauseSeq = 100;
  commentSeq = 100;
  reviewSeq = 100;
  translationSeq = 100;
}

function page<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ access: "mock-access-token", refresh: "mock-refresh-token" }),
  ),
  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ access: "mock-access-token-refreshed" }),
  ),
  http.get(`${BASE}/me`, () => HttpResponse.json(FIXTURE_USER)),
  // Sonde de santé (sans auth) — utilisée par la DebugBar / useHealth.
  http.get(`${BASE}/health`, () =>
    HttpResponse.json({ status: "ok", documents: 1, annotations: 1 }),
  ),

  // Corpora & documents
  http.get(`${BASE}/corpora`, () => HttpResponse.json(page([FIXTURE_CORPUS]))),
  http.get(`${BASE}/corpora/:slug/documents`, () =>
    HttpResponse.json(
      page([
        {
          id: FIXTURE_DOCUMENT.id,
          corpusId: FIXTURE_DOCUMENT.corpusId,
          externalId: FIXTURE_DOCUMENT.externalId,
          title: FIXTURE_DOCUMENT.title,
          language: FIXTURE_DOCUMENT.language,
          nSentences: FIXTURE_DOCUMENT.nSentences,
        },
      ]),
    ),
  ),
  http.get(`${BASE}/documents/:id`, () => HttpResponse.json(FIXTURE_DOCUMENT)),
  http.get(`${BASE}/documents/:id/sentences`, () =>
    HttpResponse.json(page(FIXTURE_DOCUMENT.sentences)),
  ),
  // Traductions phrase par phrase (P5). Renvoie un mapping index→texte FR.
  http.get(`${BASE}/documents/:id/translations`, ({ request }) => {
    const url = new URL(request.url);
    const language = url.searchParams.get("lang") ?? "fr";
    const results = [
      { sentenceIndex: 0, text: "[FR] Phrase 0 traduite." },
      { sentenceIndex: 2, text: "[FR] Phrase 2 traduite." },
      { sentenceIndex: 8, text: "[FR] Phrase 8 traduite." },
    ];
    return HttpResponse.json({ language, count: results.length, results });
  }),

  // Schemes
  http.get(`${BASE}/schemes`, () => HttpResponse.json(page([FIXTURE_SCHEME]))),
  http.get(`${BASE}/schemes/:slug`, () => HttpResponse.json(FIXTURE_SCHEME)),

  // Projects
  http.get(`${BASE}/projects`, () => HttpResponse.json(page([FIXTURE_PROJECT]))),
  http.get(`${BASE}/projects/:slug`, () => HttpResponse.json(FIXTURE_PROJECT)),
  http.get(`${BASE}/projects/:slug/assignments`, () =>
    HttpResponse.json(page(FIXTURE_ASSIGNMENTS)),
  ),
  http.get(`${BASE}/projects/:slug/progress`, () => HttpResponse.json(FIXTURE_PROGRESS)),

  // Publication publique (chantier F) — lecture seule.
  http.get(`${BASE}/public/projects`, () =>
    HttpResponse.json(
      page([
        {
          slug: FIXTURE_PROJECT.slug,
          name: FIXTURE_PROJECT.name,
          corpusSlug: FIXTURE_PROJECT.corpusSlug,
        },
      ]),
    ),
  ),
  http.get(`${BASE}/public/projects/:slug`, ({ params }) =>
    HttpResponse.json({
      slug: params.slug,
      name: FIXTURE_PROJECT.name,
      corpusSlug: FIXTURE_PROJECT.corpusSlug,
      kpi: {
        documentsTotal: 12,
        documentsAnnotated: 8,
        annotators: 2,
        meanCertainty: 2.1,
        kappa: 0.42,
      },
      themeDistribution: [
        { theme: "TERMINATION", count: 9 },
        { theme: "PRIVACY_DATA", count: 7 },
        { theme: "LIMITATION_LIABILITY", count: 5 },
      ],
    }),
  ),

  // Annotations
  http.get(`${BASE}/annotations`, () => HttpResponse.json(page([annotation]))),
  http.get(`${BASE}/annotations/:id`, () => HttpResponse.json(annotation)),
  http.post(`${BASE}/annotations`, async ({ request }) => {
    const body = (await request.json()) as { project: string; document: string; seed?: string };
    annotation = {
      ...structuredClone(FIXTURE_ANNOTATION),
      id: "ann-new",
      projectSlug: body.project,
      documentId: body.document,
      status: "draft",
      clauses: body.seed ? annotation.clauses : [],
      source: body.seed ? "preannotation_seed" : "human",
    };
    return HttpResponse.json(annotation, { status: 201 });
  }),
  http.patch(`${BASE}/annotations/:id`, async ({ request }) => {
    const patch = (await request.json()) as Partial<Annotation> & {
      global_certainty?: number;
    };
    annotation = {
      ...annotation,
      status: (patch.status as Annotation["status"]) ?? annotation.status,
      globalCertainty:
        patch.global_certainty !== undefined
          ? (patch.global_certainty as Annotation["globalCertainty"])
          : annotation.globalCertainty,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(annotation);
  }),
  http.post(`${BASE}/annotations/:id/submit`, () => {
    annotation = { ...annotation, status: "submitted" };
    return HttpResponse.json(annotation);
  }),
  http.post(`${BASE}/annotations/:id/clauses`, async ({ request }) => {
    const body = (await request.json()) as {
      anchor_index: number;
      theme: string;
      legal_nature?: string | null;
      evidence_span?: string;
      rationale?: string;
      certainty?: number | null;
    };
    const clause: Clause = {
      id: `cl-${(clauseSeq += 1)}`,
      annotationId: annotation.id,
      anchorIndex: body.anchor_index,
      theme: body.theme,
      legalNature: body.legal_nature ?? null,
      evidenceSpan: body.evidence_span ?? "",
      rationale: body.rationale ?? "",
      certainty: (body.certainty as Clause["certainty"]) ?? null,
      order: annotation.clauses.length,
    };
    annotation = {
      ...annotation,
      clauses: [...annotation.clauses, clause].sort((a, b) => a.anchorIndex - b.anchorIndex),
    };
    return HttpResponse.json(clause, { status: 201 });
  }),
  http.patch(`${BASE}/clauses/:id`, async ({ params, request }) => {
    const patch = (await request.json()) as Record<string, unknown>;
    annotation = {
      ...annotation,
      clauses: annotation.clauses.map((c) =>
        c.id === params.id
          ? {
              ...c,
              theme: (patch.theme as string) ?? c.theme,
              legalNature: (patch.legal_nature as string | null) ?? c.legalNature,
              evidenceSpan: (patch.evidence_span as string) ?? c.evidenceSpan,
              rationale: (patch.rationale as string) ?? c.rationale,
              certainty: (patch.certainty as Clause["certainty"]) ?? c.certainty,
            }
          : c,
      ),
    };
    const updated = annotation.clauses.find((c) => c.id === params.id);
    return HttpResponse.json(updated);
  }),
  http.delete(`${BASE}/clauses/:id`, ({ params }) => {
    annotation = {
      ...annotation,
      clauses: annotation.clauses.filter((c) => c.id !== params.id),
    };
    return new HttpResponse(null, { status: 204 });
  }),

  // Versions (F3)
  http.get(`${BASE}/annotations/:id/versions`, ({ params }) =>
    HttpResponse.json(
      page(
        FIXTURE_VERSIONS.map((v) => ({ ...v, annotationId: String(params.id) })),
      ),
    ),
  ),
  http.post(`${BASE}/annotations/:id/versions`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      name?: string;
      description?: string;
      kind?: string;
    };
    const next = FIXTURE_VERSIONS.length + 1;
    return HttpResponse.json(
      {
        id: `v-${Date.now()}`,
        annotationId: String(params.id),
        number: next,
        authorId: "u-alice",
        label: body.name ?? body.label ?? `Snapshot v${next}`,
        name: body.name ?? body.label ?? `Snapshot v${next}`,
        description: body.description ?? null,
        kind: body.kind ?? "snapshot_manuel",
        createdAt: new Date().toISOString(),
        snapshot: {
          doc: "Fitbit",
          project: "claudette-gold-v1",
          annotator: "alice",
          schema: "claire-themes-v1",
          status: annotation.status,
          global_certainty: annotation.globalCertainty ?? 0,
          clauses: annotation.clauses
            .slice()
            .sort((a, b) => a.anchorIndex - b.anchorIndex)
            .map((c) => ({
              anchor_index: c.anchorIndex,
              theme: c.theme,
              legal_nature: c.legalNature ?? null,
              evidence_span: c.evidenceSpan ?? "",
              rationale: c.rationale ?? "",
              certainty: (c.certainty ?? 0) as 0 | 1 | 2 | 3,
            })),
        },
      },
      { status: 201 },
    );
  }),
  // Diff entre deux versions : {n} = version cible, ?against= version base (sinon n-1).
  http.get(`${BASE}/annotations/:id/versions/:n/diff`, ({ params, request }) => {
    const url = new URL(request.url);
    const toNumber = Number(params.n);
    const against = url.searchParams.get("against");
    const fromNumber = against != null ? Number(against) : toNumber - 1;

    const to = FIXTURE_VERSIONS.find((v) => v.number === toNumber);
    const from = FIXTURE_VERSIONS.find((v) => v.number === fromNumber);
    if (!to) return new HttpResponse(null, { status: 404 });

    // Si pas de version base (première version), diffe contre un snapshot vide.
    const fromVersion = from ?? {
      number: Math.max(0, fromNumber),
      label: "∅ (vide)",
      snapshot: { ...to.snapshot, clauses: [] },
    };

    return HttpResponse.json(
      buildVersionDiff(
        String(params.id),
        { number: fromVersion.number, label: fromVersion.label, snapshot: fromVersion.snapshot },
        { number: to.number, label: to.label, snapshot: to.snapshot },
      ),
    );
  }),

  // Commentaires
  http.get(`${BASE}/annotations/:id/comments`, () => HttpResponse.json(page(comments))),
  http.post(`${BASE}/annotations/:id/comments`, async ({ params, request }) => {
    const body = (await request.json()) as {
      body: string;
      scope?: "sentence" | "clause" | "range" | "document";
      clause?: string | null;
      sentence_index?: number | null;
      range_start?: number | null;
      range_end?: number | null;
    };
    const c: Comment = {
      id: `cm-${(commentSeq += 1)}`,
      annotationId: String(params.id),
      clauseId: body.clause ?? null,
      sentenceIndex: body.sentence_index ?? null,
      scope: body.scope ?? (body.clause ? "clause" : "document"),
      rangeStart: body.range_start ?? null,
      rangeEnd: body.range_end ?? null,
      authorId: FIXTURE_USER.id,
      body: body.body,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    comments = [...comments, c];
    return HttpResponse.json(c, { status: 201 });
  }),
  http.post(`${BASE}/comments/:id/resolve`, ({ params }) => {
    comments = comments.map((c) => (c.id === params.id ? { ...c, resolved: true } : c));
    return HttpResponse.json(comments.find((c) => c.id === params.id));
  }),

  // Collaboration temps réel & partage (points 4b/7)
  http.get(`${BASE}/config/flags`, () => HttpResponse.json(FIXTURE_FLAGS)),
  http.get(`${BASE}/annotations/:id/presence`, () => HttpResponse.json(FIXTURE_PRESENCE)),
  http.post(`${BASE}/projects/:slug/share-links`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      role_granted?: string;
      expires_at?: string;
      max_uses?: number | null;
    };
    const token = `shr_${Math.random().toString(36).slice(2, 10)}`;
    return HttpResponse.json(
      {
        token,
        url: `http://localhost:3001/join/${token}`,
        roleGranted: body.role_granted ?? "annotator",
        expiresAt: body.expires_at ?? new Date(Date.now() + 7 * 864e5).toISOString(),
        maxUses: body.max_uses ?? null,
        usedCount: 0,
        revoked: false,
        usable: true,
        projectSlug: String(params.slug),
      },
      { status: 201 },
    );
  }),
  http.post(`${BASE}/share-links/:token/join`, () =>
    HttpResponse.json({
      projectSlug: FIXTURE_PROJECT.slug,
      role: "annotator",
      joined: true,
    }),
  ),

  // Insights — exploration des annotations humaines (point 5)
  http.get(`${BASE}/projects/:slug/insights/:documentId`, ({ params }) =>
    HttpResponse.json({ ...FIXTURE_DOCUMENT_INSIGHTS, documentId: String(params.documentId) }),
  ),
  http.get(`${BASE}/projects/:slug/insights`, () =>
    HttpResponse.json(FIXTURE_CORPUS_INSIGHTS),
  ),

  // Timeline d'annotation d'une phrase (point 6)
  http.get(`${BASE}/documents/:id/sentence-history`, ({ request }) => {
    const index = Number(new URL(request.url).searchParams.get("index") ?? "-1");
    const results = FIXTURE_SENTENCE_HISTORY[index] ?? [];
    return HttpResponse.json({ index, count: results.length, results });
  }),

  // Attribution & contributeurs (point 3)
  http.get(`${BASE}/documents/:id/contributors`, () =>
    HttpResponse.json({ count: FIXTURE_CONTRIBUTORS.length, results: FIXTURE_CONTRIBUTORS }),
  ),
  http.get(`${BASE}/annotations/:id/attribution`, ({ request }) => {
    const by = new URL(request.url).searchParams.get("by") === "sentence" ? "sentence" : "clause";
    return HttpResponse.json({ by, results: FIXTURE_ATTRIBUTION });
  }),

  // Reviews (état mutable en mémoire pour refléter les soumissions)
  http.get(`${BASE}/annotations/:id/reviews`, () => HttpResponse.json(page(reviews))),
  http.post(`${BASE}/annotations/:id/reviews`, async ({ params, request }) => {
    const body = (await request.json()) as {
      score: number;
      decision: string;
      body?: string;
    };
    const review: Review = {
      id: `rev-${(reviewSeq += 1)}`,
      annotationId: String(params.id),
      reviewerId: "u-bruno",
      score: body.score as Review["score"],
      decision: body.decision as Review["decision"],
      body: body.body,
      createdAt: new Date().toISOString(),
    };
    reviews = [...reviews, review];
    return HttpResponse.json(review, { status: 201 });
  }),

  // Pré-annotations (F2)
  http.get(`${BASE}/preannotations`, ({ request }) => {
    const url = new URL(request.url);
    const judge = url.searchParams.get("judge");
    const results = judge
      ? FIXTURE_PREANNOTATIONS.filter((p) => p.judge === judge)
      : FIXTURE_PREANNOTATIONS;
    return HttpResponse.json(page(results));
  }),
  http.post(`${BASE}/projects/:slug/preannotations/import`, async ({ request }) => {
    const body = (await request.json()) as { judge: string };
    const existing = FIXTURE_PREANNOTATIONS.find((p) => p.judge === body.judge);
    return HttpResponse.json(existing ?? FIXTURE_PREANNOTATIONS[0], { status: 201 });
  }),

  // Versions LLM disponibles pour un document (multi-versions).
  http.get(`${BASE}/documents/:id/annotation-versions`, () => {
    const results = FIXTURE_PREANNOTATIONS.map((p) => ({
      version: p.schemaVersion,
      judge: p.judge,
      nClauses: p.clauses?.length ?? 0,
    }));
    const versions = [...new Set(results.map((r) => r.version))].sort();
    return HttpResponse.json({ versions, count: results.length, results });
  }),

  // Exports (F5)
  http.post(`${BASE}/projects/:slug/exports`, async ({ params, request }) => {
    const body = (await request.json()) as { format: string };
    return HttpResponse.json(
      {
        id: "exp-1",
        projectSlug: String(params.slug),
        format: body.format,
        status: "done",
        artifactPath: `/exports/exp-1.${body.format}`,
        requestedById: FIXTURE_USER.id,
        createdAt: new Date().toISOString(),
        manifest: { documents: 12, clauses: 134 },
      },
      { status: 201 },
    );
  }),
  http.get(`${BASE}/exports/:id`, ({ params }) =>
    HttpResponse.json({
      id: String(params.id),
      projectSlug: "claudette-gold-v1",
      format: "jsonl",
      status: "done",
      artifactPath: `/exports/${params.id}.jsonl`,
      requestedById: FIXTURE_USER.id,
      createdAt: new Date().toISOString(),
    }),
  ),

  // Activité (F4)
  http.get(`${BASE}/activity`, () => HttpResponse.json(page(FIXTURE_ACTIVITY))),

  // Traductions file-based (F8)
  http.get(`${BASE}/projects/:slug/translations`, () =>
    HttpResponse.json(
      page(translationSets.filter((t) => t.corpusSlug === FIXTURE_PROJECT.corpusSlug)),
    ),
  ),
  http.get(`${BASE}/translations/sets`, () =>
    HttpResponse.json(page(translationSets)),
  ),
  http.post(`${BASE}/translations/sets`, async ({ request }) => {
    const body = (await request.json()) as {
      corpus?: string;
      name: string;
      target_language: string;
      folder_path: string;
      mapping_strategy?: TranslationSet["mappingStrategy"];
    };
    const set: TranslationSet = {
      id: `ts-${(translationSeq += 1)}`,
      corpusSlug: body.corpus ?? FIXTURE_CORPUS.slug,
      name: body.name,
      targetLanguage: body.target_language,
      folderPath: body.folder_path,
      mappingStrategy: body.mapping_strategy ?? "external_id",
      status: "declared",
      createdAt: new Date().toISOString(),
    };
    translationSets = [...translationSets, set];
    return HttpResponse.json(set, { status: 201 });
  }),
  http.post(`${BASE}/translations/sets/:id/sync`, ({ params }) => {
    const set = translationSets.find((t) => t.id === params.id);
    if (!set) return new HttpResponse(null, { status: 404 });

    // Mapping simulé : 3 docs du corpus, dont un non résolu (démonstration file-based).
    const mapping: TranslationMappingEntry[] = [
      {
        documentId: "doc-fitbit",
        documentTitle: "Fitbit",
        filePath: `${set.folderPath}/fitbit.${set.targetLanguage}.txt`,
        matched: true,
        nSentences: FIXTURE_DOCUMENT.nSentences,
      },
      {
        documentId: "doc-spotify",
        documentTitle: "Spotify",
        filePath: `${set.folderPath}/spotify.${set.targetLanguage}.txt`,
        matched: true,
        nSentences: 42,
      },
      {
        documentId: "doc-netflix",
        documentTitle: "Netflix",
        filePath: null,
        matched: false,
      },
    ];
    const matched = mapping.filter((m) => m.matched).length;
    translationSets = translationSets.map((t) =>
      t.id === set.id ? { ...t, status: "synced", mappedDocuments: matched } : t,
    );
    return HttpResponse.json({
      setId: set.id,
      status: "synced" as const,
      mapping,
      summary: { matched, unmatched: mapping.length - matched },
    });
  }),
];
