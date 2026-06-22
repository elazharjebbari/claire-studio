# Plan de tests — Sessions vs Collaboration (ADR-001)

> Stratégie de tests par niveau pour la refonte « 1 document = 1 ligne ; chacun
> annote SA session ; l'admin supervise ; la collaboration aide, ne fait jamais
> référence ». Le vocabulaire suit [`01-besoins/glossaire.md`](../01-besoins/glossaire.md)
> (Campagne / Document / Assignation / Session / Collaboration / Référence) et les
> invariants d'[ADR-001](../02-architecture/decision-record.md) (INV-4, INV-ISO,
> INV-DOC-UNIQUE, INV-COLLAB).
>
> Chemins **vérifiés** dans le code au 2026-06-22. Les fichiers cités existent et,
> pour les fichiers nouveaux/clés, ont été exécutés (voir « Statut » par niveau).

## 1. Vue d'ensemble — pyramide & responsabilités

| Niveau | Outil | Où | Cible | Périmètre |
|---|---|---|---|---|
| Unitaire / logique back | **pytest + factory-boy** | `backend/tests/*` | invariants modèle, permissions, IAA, exports | rapide, sans corpus réel (fixtures factory) |
| Intégration front | **Vitest + MSW** | `frontend/tests/*` + `frontend/src/mocks/*` | hooks, composants, rendu, dédup | jsdom, API mockée par MSW |
| Bout-en-bout | **Playwright** | `frontend/e2e/*` | parcours navigateur, non-régression UI | `npm run dev` + `NEXT_PUBLIC_ENABLE_MOCKS=true` |

Règle de fond (audit `findings.csv` ligne `tests-skip-silently-no-data`) : les
assertions de **forme/cardinalité** s'exécutent **sans** `@requires_data` (mini-corpus
factory-boy), `@requires_data` étant réservé aux vérifs spécifiques au vrai dataset
CLAUDETTE. Un test vert ne doit jamais être un skip silencieux.

---

## 2. pytest (backend) — l'EXISTANT et l'AJOUTÉ

Config : `backend/pytest.ini` (`DJANGO_SETTINGS_MODULE = config.settings.test`,
`testpaths = tests`). Fixtures & factories : `backend/tests/conftest.py`
(`UserFactory` idempotent sur `username`, `project`, `annotation`,
`scheme_with_themes`, `document_with_sentences`, `auth`).

### 2.1 Endpoint document-centré + sessions (AJOUTÉ) — `tests/test_sessions_documents.py`

Cœur de la refonte. `_setup_campaign()` crée 3 annotateurs membres × 2 documents
avec assignations croisées : une liste **dérivée des assignations** rendrait 6 lignes ;
l'endpoint doit en rendre **2**.

| Test | Vérifie | INV / Finding |
|---|---|---|
| `test_documents_endpoint_no_duplication` | `count == 2` (= nb documents), `document.id` tous distincts | INV-DOC-UNIQUE ; `no-distinct-documents-endpoint`, `dup-assignments-source-of-truth` |
| `test_documents_admin_sees_sessions_matrix` | admin → `sessions[]` (len 3) + `sessionsSummary{assigned:3, submitted:1}` ; la session soumise porte le bon `annotatorId`/`annotationId`/`status` | `missing-doc-annotator-matrix-entity`, `assignments-admin-returns-all` |
| `test_documents_annotator_no_session_leak` | annotateur → **pas** de `sessions`/`sessionsSummary` ; voit **uniquement** `mySession` rattachée à `annotatorId == me` | INV-ISO, INV-COLLAB ; `annotator-sees-others-sessions` |
| `test_documents_admin_mine_flag_hides_sessions` | `?mine=1` force la vue annotateur même pour un admin (aucune matrice) | C1/C3 (ADR §3) |

Exports (mêmes fichiers de test) :

| Test | Vérifie | Finding |
|---|---|---|
| `test_export_scope_annotators` | `scope.annotators=[u0]` → `manifest.n_annotations == 1`, `manifest.annotators == [u0]` (isole une session parmi 2 soumises) | `no-export-per-annotator`, `manifest-and-scope-traceability` |
| `test_export_format_fallback_traced` | format `conll` → `format_requested=conll`, `format_effective=jsonl`, `warnings` non vide. **Repli tracé, jamais silencieux.** | `silent-format-fallback` |
| `test_export_iaa_matrix` | format `iaa_matrix` → `status DONE`, artefact `.csv` avec colonne `annotator_a` (matrice de concordance) | `no-iaa-export-artifact` |

IAA N≥3 (anti double-comptage) :

| Test | Vérifie | Finding |
|---|---|---|
| `test_iaa_detail_no_double_count_n3` | 3 annotateurs en accord parfait → `annotator_pairs == 3` (= C(3,2)) ; `global_kappa`, `boundary_kappa` et tous les `per_theme[].kappa` == 1.0 (moyenne par paire, pas concaténation des observations) | `no-iaa-frontend-and-thin-backend` ; ADR §5 |

**Statut : 9/9 PASS** (exécuté via `.venv/bin/python -m pytest tests/test_sessions_documents.py`).

### 2.2 Isolation des sessions / pair (AJOUTÉ+DURCI) — `tests/test_security_m9.py`

`test_authz_isolation` (M9, durci ADR-001) :
- lecture/écriture cross-projet refusées (403/404, deny-by-default, non-divulgation) ;
- la liste `/annotations` ne fuit jamais l'annotation étrangère ;
- **clé ADR-001** : même **devenu membre** du projet, un annotateur **ne peut PAS lire**
  le contenu de la session d'un PAIR (403/404 — anti-contamination IAA) ;
- un **admin** (rôle qualité transverse) **peut LIRE** (200) la session d'autrui — supervision.

Couvre : `annotator-sees-others-sessions`, `session-isolation-only-at-api`, INV-ISO.
Le reste du fichier couvre M9 (rate-limit login, rotation/blacklist JWT, scrub PII,
path-safety traductions, en-têtes sécurité, garde N+1 sur `/annotations`).

**Statut : `test_authz_isolation` PASS** (exécuté).

### 2.3 Lecture seule stricte (EXISTANT) — `tests/test_refinements.py`

R1 — aucune dérogation de rôle en écriture sur la session d'autrui :
`test_admin_cannot_add_clause_to_others_annotation`,
`test_admin_cannot_patch_others_annotation`,
`test_reviewer_cannot_edit_others_annotation_content`,
`test_admin_cannot_patch_others_clause` → tous **403**.
`test_owner_still_edits_own_annotation` / `test_owner_can_patch_and_delete_own_clause`
garantissent que le propriétaire édite bien la sienne.
Synchro statut : `test_assignment_status_syncs_with_annotation_lifecycle`,
`test_assignment_returns_to_pending_when_last_clause_removed` (finding
`assignment-status-not-synced`). Endpoint IAA : `test_project_iaa_endpoint_returns_pairs`.

### 2.4 Permissions de base & flux (EXISTANT) — `tests/test_permissions.py`

`test_annotator_cannot_edit_others_annotation` (403/404),
`test_owner_can_add_clause_and_submit` (création + 409 sur ancre dupliquée INV-2 + submit),
`test_reviewer_can_review_and_drive_state`, `test_annotator_cannot_review` (403),
gardes de rôle scheme.

### 2.5 Exports — formats & scope (EXISTANT) — `tests/test_export.py`

`test_jsonl_export` (1 ligne/annotation, `manifest.n_annotations/n_clauses`),
`test_csv_export` (en-tête `anchor_index`), `test_export_scope_filters_statuses`
(un brouillon est exclu du scope `gold` par défaut → `n_annotations == 0`).

### 2.6 IAA cœur (EXISTANT) — `tests/test_iaa.py`

`cohen_kappa` : accord parfait (1.0), désaccord total (0.0), partiel (0<κ<1),
`ValueError` sur longueurs différentes ; `test_project_iaa_with_two_annotators`
(N=2, `mean_kappa == 1.0`, 1 paire).

### 2.7 Isolation collaboration (IMPLÉMENTÉE, test à ajouter)

`CommentViewSet.get_queryset` (`backend/claire/collaboration/views.py:19-30`) filtre
par appartenance projet (`Q(annotation__project__memberships__user) | Q(author=user)`),
admin/reviewer transverses. `ActivityEventViewSet.get_queryset`
(`backend/claire/audit/views.py:18-51`) borne aux projets membres. **Implémenté mais
non couvert par un test dédié** (findings `comments-no-project-isolation`,
`activity-no-project-isolation`) → voir §6.

---

## 3. Vitest + MSW (front) — l'EXISTANT et l'AJOUTÉ

Config : `frontend/vitest.config.ts` (env `jsdom`, `include: tests/**/*.test.{ts,tsx}`).
Mocks : `frontend/src/mocks/{server,handlers,fixtures}.ts`.

### 3.1 Anti-duplication & ouverture de MA session (AJOUTÉ) — `tests/documentList.test.tsx`

Garde-fou direct du bug prod. Un handler MSW renvoie volontairement l'**union** non
dédupliquée (le document `doc-9gag` répété 3×, 1 par annotateur) + `doc-airbnb`.

| Test | Vérifie | INV / Finding |
|---|---|---|
| `useProjectDocuments — déduplique par document.id` | 4 lignes en entrée → `['doc-9gag','doc-airbnb']` (défense en profondeur dans le hook `src/lib/api/hooks.ts:166-173`) | INV-DOC-UNIQUE ; `frontend-pages-untested` |
| `DocumentSwitcher — 1 entrée/document + ouverture via createAnnotation` | `document-option-doc-9gag` apparaît **1×** (pas 3×) ; clic → `POST /annotations` (MA session) → `router.push('/annotate/ann-mine')` | `switcher-duplicate-rows-admin`, `switcher-wrong-session-on-nav`, `switcher-duplicate-testid` |

**Statut : 2/2 PASS** (exécuté via `vitest run tests/documentList.test.tsx`).

### 3.2 Autres tests front pertinents (EXISTANT)

- `tests/validation.test.ts` (7) + `tests/autosave.test.ts` : workflow validation
  humaine + gate de soumission (référence = clauses validées de MA session).
- `tests/compareNway.test.ts` (4), `tests/divergence.test.ts`, `tests/judgeAgreement.test.ts`,
  `tests/llmJudges.test.ts`, `tests/mistralUi.test.tsx` : comparaison N-way / divergence /
  juges LLM **en lecture** (collaboration, jamais référence — INV-COLLAB).
- `tests/adminGuard.test.tsx`, `tests/apiErrors.test.tsx`, `tests/auth.test.ts` : gardes
  d'accès, gestion d'erreurs API, auth.
- `tests/collabWs.test.ts`, `tests/collabClient.test.ts` : présence/WS collaboration.
- `tests/workspaceStore.test.ts` (store), `tests/uiFixes.test.ts`,
  `tests/themePalette.test.tsx`, `tests/tokens.test.ts`, `tests/modelBoundaryRail.test.tsx` :
  store/UX/tokens (findings design-a11y).

### 3.3 Fixtures MSW (AJOUTÉ partiel)

Le handler d'union de `documentList.test.tsx` est local au test (auto-suffisant).
Reste à généraliser une `FIXTURE_ASSIGNMENTS_ADMIN` partagée
(`src/mocks/fixtures.ts`) — finding `msw-fixture-single-annotator` (voir §6).

---

## 4. Playwright (e2e) — l'EXISTANT et l'AJOUTÉ

Config : `frontend/playwright.config.ts` (`testDir: ./e2e`, `webServer: npm run dev`,
`url: http://localhost:3001`, `env.NEXT_PUBLIC_ENABLE_MOCKS=true`, projet chromium).

### 4.1 Non-régression anti-duplication (AJOUTÉ) — `e2e/no-duplicate-documents.spec.ts`

| Test | Vérifie | INV / Finding |
|---|---|---|
| `le sélecteur n'affiche qu'une entrée par document` | tous les `data-testid^="document-option-"` distincts (`Set.size == length`) → zéro doublon | INV-DOC-UNIQUE ; `no-regression-test-duplication` |
| `le document courant (Fitbit) reste une option unique après recherche` | recherche « fit » → `document-option-doc-fitbit` `toHaveCount(1)` | idem |

### 4.2 Autres parcours (EXISTANT)

`annotate.spec.ts`, `document-ux.spec.ts` (sélecteur/navigation), `admin.spec.ts`,
`llm-compare.spec.ts` + `prefill.spec.ts` (comparaison & pré-remplissage = aide),
`collab-versioning.spec.ts`, `comments.spec.ts`, `collaboration.spec.ts`,
`export.spec.ts`, `insights.spec.ts`, `review.spec.ts`, `history.spec.ts`,
`a11y.spec.ts`, `help.spec.ts`, `tour.spec.ts`, `welcome.spec.ts`, `public.spec.ts`,
`translations.spec.ts`, `version-explorer.spec.ts`, `unfairness-overlay.spec.ts`.

---

## 5. Traçabilité Tests ↔ Features (F1–F12) ↔ INV

Features d'après [`03-plan-action.md`](../03-plan-action.md).

| Feature | Intitulé | Tests | INV |
|---|---|---|---|
| F1/F2/F3 | Listes filtrées par utilisateur courant, 1 doc/ligne | `documentList.test.tsx`, `no-duplicate-documents.spec.ts`, `test_documents_endpoint_no_duplication` | INV-DOC-UNIQUE |
| F4 | Ouvrir TOUJOURS MA session (`createAnnotation`) | `documentList.test.tsx` (push `/annotate/ann-mine`) | INV-4 |
| F5 | Suppression « Bruno » codé en dur | `adminGuard.test.tsx` (couverture partielle) | — |
| F6 | Mocks OFF en production | `env.ts` (garde) — *test direct à ajouter* | — |
| F7 | IAA `per_theme`/`boundary` N≥3 (moyenne par paire) | `test_iaa_detail_no_double_count_n3` | ADR §5 |
| F8 | Export `scope.annotators` | `test_export_scope_annotators` | INV-COLLAB |
| F9 | Formats d'export (repli tracé) | `test_export_format_fallback_traced`, `test_export_iaa_matrix` | — |
| F10 | Hygiène prod (comptes démo) | manuel / runbook | — |
| F11 | Vérifs prod (login 3 comptes) | smoke prod (200) — hors CI | — |
| F12 | Vue « sessions par annotateur » (matrice admin) | `test_documents_admin_sees_sessions_matrix`, `test_documents_annotator_no_session_leak` | INV-ISO |
| Sécurité | Isolation pair / supervision admin | `test_authz_isolation`, `test_refinements.py::R1` (×4) | INV-ISO |

---

## 6. Manques restants — priorisés

| Prio | Manque | Test cible | Finding |
|---|---|---|---|
| **P0** | `assignments/bulk` (produit cartésien + overlap round-robin) sans aucun test — base des concordances/IAA | `test_assignments_bulk` : (a) `assignees` → n_docs×n_assignees, 2ᵉ appel idempotent (created==0) ; (b) `overlap=k` → exactement k/doc, distribution équilibrée ; (c) 403 non-admin | `bulk-assign-untested` |
| **P0** | IAA **désaccord partiel** N≥3 (seul l'accord parfait est testé pour N≥3) | étendre `test_iaa.py` : 3 annotateurs partiellement en désaccord → `0 < mean_kappa < 1`, `len(pairs)==3`, `per_theme` mélangé | `no-iaa-frontend-and-thin-backend` |
| **P1** | Export **multi-annotateur bout-en-bout** : 2 sessions soumises sur le même doc → artefact à 2 enregistrements attribués (`annotatorId`), `manifest.n_annotations==2` | `test_export_multi_annotateurs` | `no-export-per-annotator` |
| **P1** | Isolation **collaboration** non testée (code en place) : `CommentViewSet`/`ActivityEventViewSet` filtrés par appartenance projet | `test_comment_project_isolation`, `test_activity_project_isolation` | `comments-no-project-isolation`, `activity-no-project-isolation` |
| **P1** | **e2e multi-rôle** : ouvrir le switcher en contexte admin (même doc 3 assignés) → unicité ; un annotateur n'accède pas à la matrice | étendre `no-duplicate-documents.spec.ts` + fixture `FIXTURE_ASSIGNMENTS_ADMIN` | `msw-fixture-single-annotator`, `no-regression-test-duplication` |
| **P2** | Garde **mocks OFF en prod** (F6) sans test automatisé | test unit sur `env.ts` (NODE_ENV=production → mocks désactivés) | — |
| **P2** | Présence/collaboration **multi-utilisateur** : 2 présents sur 1 doc, présence/commentaires n'altèrent pas les `draftClauses` de l'autre | test front simulé ou back WS | `no-ws-presence-multiuser-test-front` |
| **P2** | **Périmètre de couverture** Vitest trop étroit (`src/lib`, `src/store`, `src/components/ui`) — exclut `src/app/**` et `src/components/**` | élargir `coverage.include` + seuils sur pages assignments / DocumentSwitcher | `coverage-scope-too-narrow`, `frontend-pages-untested` |
| **P2** | Skips silencieux `@requires_data` (faux vert) | mini-corpus factory pour les shapes ; xfail visibles ou seuil de skip en CI | `tests-skip-silently-no-data` |

---

## 7. Comment exécuter

```bash
# Backend (depuis backend/, venv projet)
.venv/bin/python -m pytest tests/test_sessions_documents.py tests/test_security_m9.py -q

# Front unit/intégration (depuis frontend/)
npx vitest run tests/documentList.test.tsx

# E2E (depuis frontend/ ; lance npm run dev avec mocks)
npx playwright test e2e/no-duplicate-documents.spec.ts
```
