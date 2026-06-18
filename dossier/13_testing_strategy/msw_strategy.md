# Stratégie MSW — mock de `/api/v1/` côté frontend

> MSW (Mock Service Worker, déjà dans `frontend/package.json`) intercepte les requêtes réseau
> au niveau du Service Worker (navigateur, pour Playwright optionnel) et du `setupServer`
> (Node, pour Vitest). Objectif : tests frontend **déterministes, hermétiques, alignés sur le
> contrat** du CONTRACT §3, sans backend en marche.

## 1. Rôles de MSW

1. **Unit / composant (Vitest)** : tout le réseau est mocké. Le composant ne sait pas qu'il
   parle à un mock. On teste le rendu, les états loading/error/success, l'optimistic update.
2. **Contract testing** : les handlers servent les **fixtures partagées** `fixtures/api/`, les
   mêmes que le backend valide. Toute dérive de forme casse les deux suites.
3. **Scénarios d'erreur** : on injecte 400/401/403/404/409/500 et latence pour vérifier la
   robustesse UI (retry, toasts, rollback, 409 versioning).

> MSW **ne remplace pas** l'E2E : Playwright tourne contre la vraie pile (backend + Postgres
> seedé). MSW = isolation du frontend ; E2E = intégration de bout en bout.

## 2. Organisation des fichiers (contrat d'orchestration côté frontend)

```
frontend/
  test/
    msw/
      server.ts        # setupServer(...handlers) pour Vitest (Node)
      browser.ts       # setupWorker(...handlers) si MSW utilisé en dev/Storybook
      handlers/
        auth.ts        # POST /auth/login, /auth/refresh, GET /me
        corpora.ts     # GET /corpora, /corpora/{slug}/documents
        documents.ts   # GET /documents/{id}, /documents/{id}/sentences
        schemes.ts     # GET /schemes, /schemes/{slug}, POST /schemes
        projects.ts    # GET /projects, /projects/{slug}/{assignments,progress}
        annotations.ts # CRUD annotations, clauses, submit, seed
        versions.ts    # versions + diff (incl. 409)
        comments.ts    # comments + resolve
        reviews.ts     # reviews
        preann.ts      # preannotations import + list
        translations.ts# translations sets + sync
        exports.ts     # exports + statut job
        activity.ts    # activity feed
        index.ts       # agrège tous les handlers
  fixtures/
    api/               # FIXTURES PARTAGEES (validées aussi par le backend)
      me.json
      corpora.list.json
      document.fitbit.json          # doc + sentences + reference_labels (F12)
      scheme.claire-themes-v1.json
      project.claudette-gold-v1.json
      annotation.draft.json
      annotation.submitted.json
      preannotation.claude.v94.json
      preannotation.codex.v92.json
      versions.list.json
      version.diff.json
      export.job.json
```

Base URL pilotée par `NEXT_PUBLIC_API_URL` (défaut `http://localhost:8000/api/v1`).

## 3. Handlers — conventions

- Un handler par couple (méthode, route) du CONTRACT §3, renvoyant une fixture partagée.
- Pagination respectée : réponse `{count, next, previous, results}` (style DRF) quand la route
  est paginée.
- Les **mutations** (POST/PATCH/DELETE) renvoient l'objet muté + émettent (en mémoire) un
  effet observable (ex. la liste d'activité s'enrichit) pour tester les invalidations React
  Query.
- Codes d'erreur déclenchables par en-tête de test `x-msw-scenario` ou par body spécifique
  (ex. créer une 2e annotation `(project, document, annotator)` → 409).

Exemple (illustratif, MSW v2) :

```ts
// handlers/annotations.ts
import { http, HttpResponse } from 'msw';
import draft from '../../fixtures/api/annotation.draft.json';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export const annotationHandlers = [
  http.get(`${API}/annotations/:id`, ({ params }) =>
    HttpResponse.json({ ...draft, id: params.id })),

  http.post(`${API}/annotations`, async ({ request }) => {
    const body = await request.json();
    if (body.__scenario === 'duplicate') {
      return HttpResponse.json(
        { detail: 'Annotation already exists for (project, document, annotator).' },
        { status: 409 },
      );
    }
    return HttpResponse.json({ ...draft, ...body }, { status: 201 });
  }),

  http.post(`${API}/annotations/:id/clauses`, async ({ request }) => {
    const clause = await request.json();
    if (clause.theme === 'OTHER_FREE') {
      // invariant CONTRACT 2 : vocab fermé
      return HttpResponse.json({ theme: ['Not in label scheme'] }, { status: 400 });
    }
    return HttpResponse.json({ id: 'cl_new', ...clause }, { status: 201 });
  }),
];
```

## 4. Scénarios d'erreur couverts

| Scénario | Route(s) | Statut | Ce que l'UI doit faire |
|---|---|---|---|
| Non authentifié | toutes | 401 | redirige `/login`, efface token |
| Token expiré | toutes | 401 puis refresh | tente `/auth/refresh`, rejoue la requête |
| Interdit (rôle/projet) | `/admin/*`, annotations hors périmètre | 403 | message "accès refusé", pas de fuite de données |
| Introuvable | `/documents/{id}` inconnu | 404 | état vide explicite |
| Conflit versioning | `PATCH /annotations/{id}`, `POST versions` | 409 | propose merge/rechargement, pas d'écrasement silencieux |
| Vocab fermé violé | `POST clauses` thème hors scheme | 400 | refuse, surligne le champ |
| Erreur serveur | n'importe | 500 | toast + bouton retry, état préservé |
| Latence | n'importe | 200 + délai | skeleton/loading visible |

## 5. Setup Vitest

`frontend/vitest.setup.ts` :

```ts
import { server } from './test/msw/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' })); // toute requête non mockée = échec
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` garantit qu'**aucun appel réseau réel** ne passe : tout doit être
explicitement mocké (principe d'hermétisme de `testing_strategy.md §6`).

## 6. Synchronisation avec le backend (anti-dérive)

- Les fixtures `fixtures/api/*.json` sont la **source unique** : MSW les sert, le backend les
  charge dans `test_contract_fixtures.py` et les passe dans ses sérialiseurs DRF
  (round-trip serialize→compare). Un changement de schéma casse les deux suites en CI → la
  dérive est impossible à merger silencieusement.
- Toute évolution du CONTRACT §3 doit : (1) mettre à jour la fixture, (2) faire passer le test
  backend, (3) faire passer les handlers MSW. Trois feux verts = contrat tenu.
