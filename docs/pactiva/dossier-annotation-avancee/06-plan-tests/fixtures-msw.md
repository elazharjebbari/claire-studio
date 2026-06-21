# Fixtures & handlers MSW — Annotation avancée

> Inventaire des **handlers MSW** et **fixtures** nécessaires aux tests des Features
> A & B et de la non-régression autosave. On **réutilise** l'existant
> (`frontend/src/mocks/handlers.ts`, `fixtures.ts`, `server.ts`, `browser.ts`,
> `frontend/tests/setup.ts`) et on n'ajoute que le strict nécessaire : un **3e juge
> Mistral** (Feature A — N modèles), des **fixtures de tailles variées**, et des
> **handlers d'erreur paramétrables** (401/403/500) pour prouver l'arrêt des réessais
> de l'autosave.

## 0. Existant à réutiliser (ne pas réécrire)

- **Handlers en place** (`handlers.ts`) : `GET/POST /annotations`, `GET /annotations/:id`,
  `POST /annotations/:id/clauses`, `PATCH /clauses/:id`, `DELETE /clauses/:id`,
  `GET /preannotations?judge=`, `GET /documents/:id/sentences`,
  `GET /documents/:id/annotation-versions`, `GET /me`, `GET /health`… L'état des
  annotations est **mutable en mémoire** et **réinitialisable** via `resetDb()`.
- **Fixtures en place** (`fixtures.ts`) : `FIXTURE_DOCUMENT` (Fitbit, ~31 phrases),
  `FIXTURE_ANNOTATION` (5 clauses humaines), `FIXTURE_PREANNOTATIONS`
  (**claude** v9.4 / **codex** v9.2, span-based), `FIXTURE_SCHEME`, `FIXTURE_USER`.
- **Bootstrap tests** (`setup.ts`) : `server.listen()` / `server.resetHandlers()` /
  `server.close()` autour de chaque suite. **Règle** : appeler `resetDb()` en
  `beforeEach` des tests qui mutent l'annotation, pour l'isolation.

> Conséquence : la **majorité** des cas A/B passe **sans nouveau handler** — les
> pré-annotations claude/codex et le CRUD clauses existent déjà. Les ajouts ci-dessous
> couvrent uniquement (1) le 3e juge, (2) les tailles de documents, (3) la simulation
> d'erreurs terminales.

## 1. Handlers à prévoir / ajouter

### 1.1 Pré-annotations multi-juges (claude / codex / mistral)
- **claude / codex** : déjà servis par `GET /preannotations?judge=claude|codex` et
  `GET /documents/:id/annotation-versions`. **Rien à faire** pour A à 2 pistes.
- **mistral (NOUVEAU, Feature A — N modèles, US-A6)** : ajouter une 3e entrée
  `FIXTURE_PREANNOTATION_MISTRAL` (même forme `PreAnnotation`, span-based, `judge:"mistral"`,
  `schemaVersion:"v9.4"`) et l'inclure dans `FIXTURE_PREANNOTATIONS`. Le handler
  `GET /preannotations` filtre déjà par `judge` ⇒ il renverra Mistral **sans code
  spécifique** (cf. `A-specification.md` §9 : Mistral = « une piste de plus »).
- **Frontières divergentes voulues** : les ancres Mistral doivent **différer** par
  endroits de claude/codex (ex. coupe en 13 et 17 là où Codex coupe en 14 et 16) pour
  tester l'alignement « même ligne = accord / décalage = divergence » (A4, TC-29).

### 1.2 CRUD clauses (annotations / clauses) — déjà présent, à exercer
- `POST /annotations/:id/clauses` : crée une clause (séquence `cl-<n>`), trie par
  `anchorIndex`. **Pour B (plage)** : utilisé tel quel ; le test compte les **POST**
  émis par `applyBlockOp` (un POST par phrase de la plage, séquencés par `useAutosave`).
- `PATCH /clauses/:id` / `DELETE /clauses/:id` : déjà mutables. **Pour l'autosave**,
  on les remplace ponctuellement par des variantes d'erreur (cf. §1.4).
- **Idempotence (`clientOpId`)** : prévoir une variante de `POST .../clauses` qui, si
  le `client_op_id` du body a **déjà** été vu, **renvoie la clause existante** (200/201)
  au lieu d'en créer une nouvelle — nécessaire pour TC-41 (un retry ne duplique pas).
  À implémenter via un `Set<clientOpId>` dans l'état mutable + `resetDb()` qui le vide.

### 1.3 Annotation modifiable vs lecture seule
- **Modifiable** (cas nominal B) : `FIXTURE_ANNOTATION.annotatorId === FIXTURE_USER.id`
  (déjà `u-alice` pour les deux) ⇒ `isMine=true`, le store n'est pas `readOnly`.
- **Lecture seule** (R1, TC-18 e2e éventuel) : prévoir une fixture
  `FIXTURE_ANNOTATION_OTHER` avec `annotatorId:"u-bruno"` et un handler
  `GET /annotations/:id` la renvoyant pour un id donné ⇒ `readOnly=true`, mutateurs
  no-op. (En unitaire, le store est initialisé directement avec `readOnly:true`, sans
  MSW.)

### 1.4 Simulation 401 / 403 / 500 (arrêt des réessais autosave)
But : prouver que l'autosave **stoppe** sur 401/403 (terminal) et **réessaie** sur 500
(transitoire), sans tempête réseau. Trois leviers, du plus simple au plus fin :

1. **Override ponctuel par test** (recommandé, isolé) — `server.use(...)` dans le test :
   ```ts
   import { http, HttpResponse } from "msw";
   import { server } from "@/mocks/server";

   // Compteur d'appels pour prouver l'absence de réessai.
   let calls = 0;
   server.use(
     http.patch(`${BASE}/clauses/:id`, () => {
       calls += 1;
       return new HttpResponse(JSON.stringify({ detail: "Forbidden" }), { status: 403 });
     }),
     http.delete(`${BASE}/clauses/:id`, () => {
       calls += 1;
       return new HttpResponse(null, { status: 403 });
     }),
     http.post(`${BASE}/annotations/:id/clauses`, () => {
       calls += 1;
       return new HttpResponse(JSON.stringify({ detail: "Unauthorized" }), { status: 401 });
     }),
   );
   // … déclencher la synchro, avancer les timers, puis : expect(calls).toBe(1);
   ```
   `server.resetHandlers()` (déjà dans `setup.ts`) restaure les handlers nominaux après
   chaque test ⇒ pas de fuite d'état.

2. **500 transitoire « une fois puis OK »** (TC-40) — handler à état :
   ```ts
   let failed = false;
   server.use(
     http.post(`${BASE}/annotations/:id/clauses`, async ({ request }) => {
       if (!failed) { failed = true; return new HttpResponse(null, { status: 500 }); }
       /* 2e appel : succès nominal (créer la clause) */
       return HttpResponse.json(/* clause */, { status: 201 });
     }),
   );
   ```
   On vérifie qu'une **2e** tentative est émise (réessai) et que `saveState` finit à
   `saved`.

3. **Pilotage des faux temporisateurs** : utiliser `vi.useFakeTimers()` +
   `vi.advanceTimersByTimeAsync(DEBOUNCE_MS * k)` pour franchir le débounce (1200 ms) et
   **plusieurs** cycles de convergence, afin de **prouver** qu'aucun nouvel appel n'est
   planifié après un 401/403 (le compteur reste à 1). C'est l'oracle central de TC-38.

> Détail d'implémentation côté code (rappel pour la revue) : la routine `useAutosave`
> doit, dans son `catch`, distinguer `ApiError.status ∈ {401,403}` (⇒ état terminal,
> **pas** de `setTimeout` de convergence) du reste (⇒ comportement actuel). Sans cette
> distinction, TC-38/TC-39 échouent (c'est précisément la dette à corriger en L0).

### 1.5 Health (déploiement / smoke)
- `GET /health` existant (`{status:"ok",…}`) suffit pour les tests ; en prod, le
  runbook vérifie `https://pactiva.legal/api/v1/health` (200) — hors MSW.

## 2. Fixtures de documents (tailles variées)

| Fixture | Taille | Usage | Notes |
|---------|-------:|-------|-------|
| `FIXTURE_DOCUMENT` (Fitbit) | ~31 phrases | cas nominaux A & B, e2e | **existant** ; pré-annotations claude/codex déjà alignées dessus |
| `FIXTURE_DOC_SMALL` | 3–5 phrases | bords : doc minuscule, blocs de taille 1, trous | **nouveau** (léger) ; couvre TC-05, défensif |
| `FIXTURE_DOC_EMPTY` | 0 phrase (`nSentences:0`) | défensif : `computeRuns`/`deriveBlocks` → `[]` | **nouveau** ; TC-43, A « document vide » |
| `FIXTURE_DOC_LARGE` | ~300 phrases | **perf** (bench deriveBlocks) + e2e smoke perf | **nouveau** ; texte généré déterministe, pré-annotations parsemées (ne pas annoter les 300 à la main) |

Règles pour `FIXTURE_DOC_LARGE` :
- Générer 300 phrases plausibles (réutiliser/boucler le style ToS, pas de Lorem ipsum
  pur — cohérent avec la convention `fixtures.ts`).
- Pré-annotations claude/codex/mistral **parsemées** (ex. ~40–60 segments) pour exercer
  la réglette à densité réaliste **et** le bench (mélange blocs/phrases isolées).
- Exposer la **même forme** de payload que Fitbit (le handler `GET /documents/:id` doit
  router sur l'id demandé : prévoir un petit registre `DOCUMENTS_BY_ID` au lieu d'un seul
  `FIXTURE_DOCUMENT` codé en dur dans le handler).

## 3. Réinitialisation & isolation (rappel d'hygiène)

- `beforeEach(() => resetDb())` dans toute suite qui **mute** (création/patch/suppression
  de clause, autosave). Réinitialise l'annotation, les séquences, le `Set<clientOpId>` et
  le compteur de doublons.
- `afterEach(() => server.resetHandlers())` (déjà global via `setup.ts`) pour purger les
  `server.use(...)` d'erreur d'un test à l'autre — **indispensable** pour ne pas
  « contaminer » les tests nominaux avec un handler 403.
- Pour les tests **store purs** (B `applyBlockOp`, équivalence), pas de MSW : initialiser
  via `useWorkspaceStore.getState().init({...})` puis `reset()` en `beforeEach` (style
  `workspaceStore.test.ts`).

## 4. Récapitulatif des ajouts MSW (minimal)

1. `FIXTURE_PREANNOTATION_MISTRAL` + inclusion dans `FIXTURE_PREANNOTATIONS` (A — N modèles).
2. Variante idempotente de `POST /annotations/:id/clauses` (Set de `clientOpId`).
3. Helpers de test (non-handlers) : overrides `server.use()` 401/403/500 par cas, avec
   **compteur d'appels** exporté (oracle « 0 réessai »).
4. `FIXTURE_DOC_SMALL`, `FIXTURE_DOC_EMPTY`, `FIXTURE_DOC_LARGE` + registre
   `DOCUMENTS_BY_ID` pour router `GET /documents/:id`, `…/sentences`, `…/annotation-versions`.
5. (Optionnel) `FIXTURE_ANNOTATION_OTHER` (lecture seule) pour un e2e R1.

Tout le reste (CRUD clauses, claude/codex, scheme, me, health) est **déjà fourni** et
réutilisé tel quel.
