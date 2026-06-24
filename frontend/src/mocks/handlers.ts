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
  FIXTURE_GOLD_DOCUMENTS,
  FIXTURE_GOLD_DETAIL,
  FIXTURE_GOLD_STATS,
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
let projectLocked = false; // verrou NIVEAU PROJET (mutable, mock)
// Préférences UI par compte (mock) : blob camelCase fusionné partiellement, comme le serveur.
let meUiPreferences: Record<string, unknown> = {};
function mergeDeep(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    const cur = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) {
      out[k] = mergeDeep(cur as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function resetDb(): void {
  annotation = structuredClone(FIXTURE_ANNOTATION);
  comments = structuredClone(FIXTURE_COMMENTS);
  reviews = structuredClone(FIXTURE_REVIEWS);
  translationSets = structuredClone(FIXTURE_TRANSLATION_SETS);
  clauseSeq = 100;
  commentSeq = 100;
  reviewSeq = 100;
  translationSeq = 100;
  projectLocked = false;
  meUiPreferences = {};
}

function page<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

/** Construit une Clause mock depuis un body d'écriture (mono ou multi-label / triage). */
function buildMockClause(body: Record<string, unknown>): Clause {
  const theme = (body.theme as string) ?? "";
  const themes = (body.themes as Clause["themes"]) ?? [{ label: theme, role: "primary" as const }];
  const boundary = body.boundary as Clause["boundary"];
  return {
    id: `cl-${(clauseSeq += 1)}`,
    annotationId: annotation.id,
    anchorIndex: (body.anchor_index ?? body.anchorIndex) as number,
    theme: themes.find((t) => t.role === "primary")?.label ?? theme,
    themes,
    boundary: boundary ?? { type: "hard", support: 1 },
    triageLevel: ((body.triage_level ?? body.triageLevel) as Clause["triageLevel"]) ?? null,
    legalNature: (body.legal_nature as string | null) ?? null,
    evidenceSpan: (body.evidence_span as string) ?? "",
    rationale: (body.rationale as string) ?? "",
    certainty: (body.certainty as Clause["certainty"]) ?? null,
    order: annotation.clauses.length,
    validated: (body.validated as boolean) ?? false,
  };
}

/** Upsert FIDÈLE au backend : MERGE — ne met à jour QUE les champs présents dans le corps,
 *  conserve les autres (rationale, evidenceSpan, certainty, legalNature…) de l'existant.
 *  (Le backend add_clause/batch n'écrit que les champs fournis ; un remplacement effacerait
 *  à tort des champs absents et ferait diverger les tests MSW du serveur réel.) */
function mergeMockClause(existing: Clause, body: Record<string, unknown>): Clause {
  const themes = (body.themes as Clause["themes"]) ?? existing.themes;
  const primary = themes?.find((t) => t.role === "primary")?.label;
  return {
    ...existing,
    theme: primary ?? (body.theme as string) ?? existing.theme,
    themes,
    boundary: (body.boundary as Clause["boundary"]) ?? existing.boundary,
    triageLevel:
      ((body.triage_level ?? body.triageLevel) as Clause["triageLevel"]) ?? existing.triageLevel,
    legalNature:
      body.legal_nature !== undefined ? (body.legal_nature as string | null) : existing.legalNature,
    evidenceSpan: (body.evidence_span as string) ?? existing.evidenceSpan,
    rationale: (body.rationale as string) ?? existing.rationale,
    certainty: body.certainty !== undefined ? (body.certainty as Clause["certainty"]) : existing.certainty,
    validated: body.validated !== undefined ? (body.validated as boolean) : existing.validated,
  };
}

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ access: "mock-access-token", refresh: "mock-refresh-token" }),
  ),
  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ access: "mock-access-token-refreshed" }),
  ),
  // /me — état mutable des préférences UI par compte (persistance simulée pour les tests).
  http.get(`${BASE}/me`, () =>
    HttpResponse.json({ ...FIXTURE_USER, uiPreferences: meUiPreferences }),
  ),
  http.patch(`${BASE}/me`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body && typeof body === "object" && "uiPreferences" in body) {
      // Fusion partielle (miroir du merge serveur) sur l'état en mémoire.
      meUiPreferences = mergeDeep(meUiPreferences, body.uiPreferences as Record<string, unknown>);
    }
    const profile: Record<string, unknown> = {};
    for (const k of ["displayName", "locale"]) if (k in body) profile[k] = body[k];
    return HttpResponse.json({ ...FIXTURE_USER, ...profile, uiPreferences: meUiPreferences });
  }),
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
  http.get(`${BASE}/projects/:slug`, () =>
    HttpResponse.json({ ...FIXTURE_PROJECT, locked: projectLocked }),
  ),
  http.post(`${BASE}/projects/:slug/lock`, () => {
    projectLocked = true;
    return HttpResponse.json({ ...FIXTURE_PROJECT, locked: true });
  }),
  http.post(`${BASE}/projects/:slug/unlock`, () => {
    projectLocked = false;
    return HttpResponse.json({ ...FIXTURE_PROJECT, locked: false });
  }),
  http.get(`${BASE}/projects/:slug/assignments`, () =>
    HttpResponse.json(page(FIXTURE_ASSIGNMENTS)),
  ),
  // ADR-001 : ressource document-centrée (1 entrée PAR document, jamais dupliquée).
  // Dérivée des assignations de l'utilisateur démo (FIXTURE_USER), dédupliquée par doc.
  // `?mine=1` → vue annotateur (mySession seul) ; sinon → matrice admin (sessions[]).
  http.get(`${BASE}/projects/:slug/documents`, ({ request }) => {
    const mine = new URL(request.url).searchParams.get("mine");
    const seen = new Set<string>();
    const results = FIXTURE_ASSIGNMENTS.filter((a) => {
      if (seen.has(a.document.id)) return false;
      seen.add(a.document.id);
      return true;
    }).map((a) => {
      const mySession = {
        annotatorId: FIXTURE_USER.id,
        username: FIXTURE_USER.username,
        displayName: FIXTURE_USER.displayName ?? FIXTURE_USER.username,
        color: "#06B6D4",
        assigned: true,
        status: a.status,
        annotationId: a.annotationId ?? null,
        nClauses: 0,
        // Miroir backend : une session soumise est auto-verrouillée.
        locked: ["submitted", "in_review", "approved"].includes(a.status),
      };
      if (mine === "1") return { document: a.document, mySession };
      // Matrice admin : la session de l'utilisateur démo + 2 annotateurs simulés.
      const sessions = [
        mySession,
        { annotatorId: "u-bruno", username: "bruno", displayName: "Bruno", color: "#F59E0B", assigned: true, status: "unstarted", annotationId: null, nClauses: 0 },
        { annotatorId: "u-zahra", username: "zahra", displayName: "Zahra", color: "#A78BFA", assigned: true, status: "submitted", annotationId: "ann-z", nClauses: 4 },
      ];
      return {
        document: a.document,
        mySession,
        sessions,
        sessionsSummary: {
          assigned: 3,
          started: sessions.filter((s) => s.status !== "unstarted").length,
          submitted: sessions.filter((s) => ["submitted", "in_review", "approved"].includes(s.status)).length,
        },
      };
    });
    return HttpResponse.json(page(results));
  }),
  http.get(`${BASE}/projects/:slug/progress`, () => HttpResponse.json(FIXTURE_PROGRESS)),

  // ── Résolution GOLD ──
  http.get(`${BASE}/projects/:slug/gold/documents`, () =>
    HttpResponse.json(page(FIXTURE_GOLD_DOCUMENTS)),
  ),
  http.get(`${BASE}/projects/:slug/gold/stats`, () => HttpResponse.json(FIXTURE_GOLD_STATS)),
  http.get(`${BASE}/projects/:slug/gold/:externalId`, ({ params }) =>
    HttpResponse.json({
      ...FIXTURE_GOLD_DETAIL,
      document: { ...FIXTURE_GOLD_DETAIL.document, externalId: String(params.externalId) },
    }),
  ),
  http.post(`${BASE}/projects/:slug/gold/:externalId/decide`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json({
      index: Number(body.index ?? 0),
      decided: true,
      autoResolved: false,
      primary: String(body.primary ?? ""),
      secondaries: (body.secondaries as string[]) ?? [],
      status: "in_progress",
      pctResolved: 0.5,
    });
  }),
  http.post(`${BASE}/projects/:slug/gold/:externalId/auto-resolve`, () =>
    HttpResponse.json({ n: 3, decided: 1, autoResolved: 1, status: "in_progress", pctResolved: 0.3333 }),
  ),
  http.post(`${BASE}/projects/:slug/gold/:externalId/lock`, () =>
    HttpResponse.json({
      locked: true, lockedBy: FIXTURE_USER.username, lockedByName: FIXTURE_USER.username,
      lockedById: 1, heldByMe: true, expiresAt: "2026-06-24T12:00:00Z", leaseSeconds: 90,
    }),
  ),
  http.post(`${BASE}/projects/:slug/gold/:externalId/lock/heartbeat`, () =>
    HttpResponse.json({
      locked: true, lockedBy: FIXTURE_USER.username, lockedByName: FIXTURE_USER.username,
      lockedById: 1, heldByMe: true, expiresAt: "2026-06-24T12:01:00Z", leaseSeconds: 90,
    }),
  ),
  http.post(`${BASE}/projects/:slug/gold/:externalId/lock/release`, () =>
    HttpResponse.json({ locked: false, lockedBy: null, heldByMe: false, expiresAt: null, leaseSeconds: 90 }),
  ),
  http.post(`${BASE}/projects/:slug/gold/:externalId/lock/steal`, () =>
    HttpResponse.json({
      locked: true, lockedBy: FIXTURE_USER.username, lockedByName: FIXTURE_USER.username,
      lockedById: 1, heldByMe: true, expiresAt: "2026-06-24T12:02:00Z", leaseSeconds: 90,
    }),
  ),

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
    const nextStatus = (patch.status as Annotation["status"]) ?? annotation.status;
    annotation = {
      ...annotation,
      status: nextStatus,
      // Verrouillage en fonction de l'état (miroir du backend) : submitted → locked ;
      // retour draft → unlocked.
      locked:
        nextStatus === "submitted" ? true : nextStatus === "draft" ? false : annotation.locked,
      globalCertainty:
        patch.global_certainty !== undefined
          ? (patch.global_certainty as Annotation["globalCertainty"])
          : annotation.globalCertainty,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(annotation);
  }),
  http.post(`${BASE}/annotations/:id/submit`, () => {
    annotation = { ...annotation, status: "submitted", locked: true };
    return HttpResponse.json(annotation);
  }),
  http.post(`${BASE}/annotations/:id/lock`, () => {
    annotation = { ...annotation, locked: true, lockedAt: new Date().toISOString() };
    return HttpResponse.json(annotation);
  }),
  http.post(`${BASE}/annotations/:id/unlock`, () => {
    // Un document soumis est rouvert en brouillon (miroir du backend).
    annotation = {
      ...annotation,
      locked: false,
      lockedAt: null,
      status: annotation.status === "submitted" ? "draft" : annotation.status,
    };
    return HttpResponse.json(annotation);
  }),
  http.post(`${BASE}/annotations/:id/clauses`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const ai = (body.anchor_index ?? body.anchorIndex) as number;
    const existing = annotation.clauses.find((c) => c.anchorIndex === ai);
    // Upsert par ancre (cf. backend) : si la phrase est déjà annotée et `upsert`, on MET
    // À JOUR la clause existante (200) au lieu de dupliquer / 409 (INV-2).
    if (existing && body.upsert) {
      const merged = mergeMockClause(existing, body);
      annotation = {
        ...annotation,
        clauses: annotation.clauses.map((c) => (c.id === existing.id ? merged : c)),
      };
      return HttpResponse.json(merged, { status: 200 });
    }
    if (existing) {
      return HttpResponse.json({ detail: "A clause already starts on this sentence (INV-2)." }, { status: 409 });
    }
    const clause = buildMockClause(body);
    annotation = {
      ...annotation,
      clauses: [...annotation.clauses, clause].sort((a, b) => a.anchorIndex - b.anchorIndex),
    };
    return HttpResponse.json(clause, { status: 201 });
  }),
  // Triage : acceptation par lot (C1) — transactionnelle + conflits INV-2 rapportés.
  http.post(`${BASE}/annotations/:id/clauses/batch`, async ({ request }) => {
    const body = (await request.json()) as { clauses: Record<string, unknown>[]; upsert?: boolean };
    const created: Clause[] = [];
    const conflicts: { anchorIndex: number; reason: string }[] = [];
    for (const item of body.clauses ?? []) {
      const ai = (item.anchor_index ?? item.anchorIndex) as number;
      const existing = annotation.clauses.find((c) => c.anchorIndex === ai);
      if (existing && !body.upsert) {
        conflicts.push({ anchorIndex: ai, reason: "déjà annotée (INV-2)" });
        continue;
      }
      if (existing) {
        const merged = mergeMockClause(existing, item);
        annotation = { ...annotation, clauses: annotation.clauses.map((c) => (c.id === existing.id ? merged : c)) };
        created.push(merged);
        continue;
      }
      const clause = buildMockClause(item);
      annotation = { ...annotation, clauses: [...annotation.clauses, clause] };
      created.push(clause);
    }
    annotation = { ...annotation, clauses: [...annotation.clauses].sort((a, b) => a.anchorIndex - b.anchorIndex) };
    return HttpResponse.json({ created, conflicts }, { status: created.length ? 201 : 409 });
  }),
  http.post(`${BASE}/clauses/:id/swap-primary`, async ({ params, request }) => {
    const { label } = (await request.json()) as { label: string };
    annotation = {
      ...annotation,
      clauses: annotation.clauses.map((c) => {
        if (c.id !== params.id) return c;
        const themes = (c.themes ?? [{ label: c.theme, role: "primary" as const }]).map((t) => ({
          ...t, role: t.label === label ? ("primary" as const) : t.role === "primary" ? ("secondary" as const) : t.role,
        }));
        return { ...c, theme: label, themes };
      }),
    };
    return HttpResponse.json(annotation.clauses.find((c) => c.id === params.id));
  }),
  http.post(`${BASE}/clauses/:id/boundary`, async ({ params, request }) => {
    const { op } = (await request.json()) as { op: "set_hard" | "set_soft" };
    annotation = {
      ...annotation,
      clauses: annotation.clauses.map((c) =>
        c.id === params.id
          ? { ...c, boundary: { type: op === "set_hard" ? "hard" : "soft", support: c.boundary?.support ?? 1 } }
          : c,
      ),
    };
    return HttpResponse.json(annotation.clauses.find((c) => c.id === params.id));
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
              // Multi-label / frontière / niveau / validation (triage) : propagés s'ils sont fournis.
              themes: (patch.themes as Clause["themes"]) ?? c.themes,
              boundary: (patch.boundary as Clause["boundary"]) ?? c.boundary,
              triageLevel: ((patch.triage_level ?? patch.triageLevel) as Clause["triageLevel"]) ?? c.triageLevel,
              validated: patch.validated !== undefined ? (patch.validated as boolean) : c.validated,
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

  // Exports (F5) — EN TÂCHE DE FOND. POST → 202 (pending) ; GET liste = historique.
  http.get(`${BASE}/projects/:slug/exports`, ({ params }) =>
    HttpResponse.json(
      page([
        {
          id: "exp-1",
          projectSlug: String(params.slug),
          format: "jsonl",
          status: "done",
          requestedById: FIXTURE_USER.id,
          createdAt: new Date().toISOString(),
          manifest: { n_annotations: 12 },
        },
        {
          id: "exp-2",
          projectSlug: String(params.slug),
          format: "csv",
          status: "failed",
          error: "Aucune annotation ne correspond au filtre.",
          requestedById: FIXTURE_USER.id,
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
  ),
  http.post(`${BASE}/projects/:slug/exports`, async ({ params, request }) => {
    const body = (await request.json()) as { format: string };
    return HttpResponse.json(
      {
        id: "exp-new",
        projectSlug: String(params.slug),
        format: body.format,
        status: "pending",
        requestedById: FIXTURE_USER.id,
        createdAt: new Date().toISOString(),
      },
      { status: 202 },
    );
  }),
  http.post(`${BASE}/exports/:id/retry`, ({ params }) =>
    HttpResponse.json(
      {
        id: String(params.id),
        projectSlug: "claudette-gold-v1",
        format: "csv",
        status: "pending",
        requestedById: FIXTURE_USER.id,
        createdAt: new Date().toISOString(),
      },
      { status: 202 },
    ),
  ),
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
