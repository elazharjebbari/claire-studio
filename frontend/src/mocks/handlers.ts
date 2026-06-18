/**
 * Handlers MSW — simulent les endpoints clés du CONTRACT §3. Permettent de faire
 * tourner le frontend MVP sans backend, et servent de mock dans les tests Vitest/E2E.
 *
 * L'état des annotations est mutable en mémoire (création de clause, patch, etc.)
 * pour que les parcours d'annotation soient réellement interactifs.
 */

import { http, HttpResponse } from "msw";
import type { Annotation, Clause, Comment } from "@/types/contract";
import {
  FIXTURE_ACTIVITY,
  FIXTURE_ANNOTATION,
  FIXTURE_ASSIGNMENTS,
  FIXTURE_COMMENTS,
  FIXTURE_CORPUS,
  FIXTURE_DOCUMENT,
  FIXTURE_PREANNOTATIONS,
  FIXTURE_PROGRESS,
  FIXTURE_PROJECT,
  FIXTURE_REVIEWS,
  FIXTURE_SCHEME,
  FIXTURE_USER,
} from "./fixtures";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

// État mutable en mémoire (réinitialisable dans les tests via resetDb()).
let annotation: Annotation = structuredClone(FIXTURE_ANNOTATION);
let comments: Comment[] = structuredClone(FIXTURE_COMMENTS);
let clauseSeq = 100;
let commentSeq = 100;

export function resetDb(): void {
  annotation = structuredClone(FIXTURE_ANNOTATION);
  comments = structuredClone(FIXTURE_COMMENTS);
  clauseSeq = 100;
  commentSeq = 100;
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

  // Versions
  http.get(`${BASE}/annotations/:id/versions`, ({ params }) =>
    HttpResponse.json(
      page([
        {
          id: "v-1",
          annotationId: String(params.id),
          number: 1,
          authorId: "u-alice",
          label: "Premier jet",
          createdAt: "2026-06-15T09:30:00Z",
          snapshot: {
            doc: "Fitbit",
            project: "claudette-gold-v1",
            annotator: "alice",
            schema: "claire-themes-v1",
            status: "draft",
            global_certainty: 1,
            clauses: [],
          },
        },
      ]),
    ),
  ),
  http.post(`${BASE}/annotations/:id/versions`, ({ params }) =>
    HttpResponse.json(
      {
        id: `v-${Date.now()}`,
        annotationId: String(params.id),
        number: 2,
        authorId: "u-alice",
        createdAt: new Date().toISOString(),
        snapshot: {
          doc: "Fitbit",
          project: "claudette-gold-v1",
          annotator: "alice",
          schema: "claire-themes-v1",
          status: annotation.status,
          global_certainty: annotation.globalCertainty ?? 0,
          clauses: [],
        },
      },
      { status: 201 },
    ),
  ),

  // Commentaires
  http.get(`${BASE}/annotations/:id/comments`, () => HttpResponse.json(page(comments))),
  http.post(`${BASE}/annotations/:id/comments`, async ({ params, request }) => {
    const body = (await request.json()) as {
      body: string;
      clause?: string | null;
      sentence_index?: number | null;
    };
    const c: Comment = {
      id: `cm-${(commentSeq += 1)}`,
      annotationId: String(params.id),
      clauseId: body.clause ?? null,
      sentenceIndex: body.sentence_index ?? null,
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

  // Reviews
  http.get(`${BASE}/annotations/:id/reviews`, () => HttpResponse.json(page(FIXTURE_REVIEWS))),
  http.post(`${BASE}/annotations/:id/reviews`, async ({ params, request }) => {
    const body = (await request.json()) as {
      score: number;
      decision: string;
      body?: string;
    };
    return HttpResponse.json(
      {
        id: `rev-${Date.now()}`,
        annotationId: String(params.id),
        reviewerId: "u-bruno",
        score: body.score,
        decision: body.decision,
        body: body.body,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
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
];
