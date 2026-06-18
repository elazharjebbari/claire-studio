# Stratégie de tests — CLAIRE Studio

> Source de vérité pour l'assurance qualité. S'aligne sur `dossier/00_overview/CONTRACT.md`
> (modèle de données, invariants §2, contrat API §3, pivot clause §4) et
> `dossier/14_plans/quality_requirements.csv`. Le backend (`/backend`) et le frontend
> (`/frontend`) sont produits par d'autres agents : ce document **orchestre** leur QA depuis
> la racine, il ne prescrit pas leur arborescence interne ligne à ligne.

## 0. Principes directeurs

1. **DB-centrique → tester les invariants au plus bas niveau.** Les invariants durs du
   CONTRACT §2 sont garantis par contrainte DB et testés un par un (Q-ROB-03). Aucun test ne
   doit pouvoir laisser passer une donnée corrompue.
2. **Pas de fuite train/test silencieuse** (cf. CLAUDE.md). Les fixtures gold humain, les
   pré-annotations LLM et les `ReferenceLabel` CLAUDETTE vivent dans des namespaces distincts ;
   un test vérifie qu'ils ne se mélangent jamais.
3. **Contract testing des deux côtés du `/api/v1/`.** Le backend valide ses sérialiseurs avec
   pytest+DRF ; le frontend valide ses consommateurs contre les **mêmes fixtures** via MSW. Une
   fixture partagée unique (`fixtures/api/`) empêche la dérive de contrat.
4. **Chaque feature 1→12 a un E2E vert** (Q-FON-01). C'est la condition de sortie de release.
5. **Déséquilibre 9:1 du corpus** → métriques par classe, jamais d'accuracy globale (cf.
   CLAUDE.md). Les tests IAA tabulent des valeurs de référence à 1e-6 près (Q-FIA-02).

## 1. Pyramide de tests

```
                ┌───────────────────────────────┐
                │   E2E — Playwright (12 specs)   │   lent, peu nombreux, haute valeur
                │   1 spec / feature F1..F12      │   ~12 scénarios, navigateur réel
                ├───────────────────────────────┤
                │   Intégration                   │   API DRF (pytest + Postgres),
                │   + Contract (MSW vs DRF)        │   handlers MSW vs sérialiseurs
                ├───────────────────────────────┤
                │   Composants / stores            │   Vitest + Testing Library
                │   (frontend)                     │   + jsdom, MSW pour le réseau
                ├───────────────────────────────┤
                │   Unitaire (backend)             │   modèles, invariants, loaders,
                │   pytest, base SQLite/PG rapide  │   IAA, permissions, pivot clause
                └───────────────────────────────┘
                 base large, rapide, déterministe
```

Répartition cible (volume) : ~70 % unitaire, ~20 % intégration/composant, ~10 % E2E.

## 2. Backend — pytest

Lanceur : `cd backend && make test` (≡ `pytest`). Base Postgres en CI (service docker), SQLite
ou Postgres local en dev. Marqueurs : `@pytest.mark.unit`, `@pytest.mark.integration`,
`@pytest.mark.slow`. `pytest-django`, `factory_boy` pour les fixtures, `pytest-cov` pour la
couverture.

### 2.1 Unitaire — modèles & invariants (CONTRACT §2)

Un test **par invariant dur** (Q-ROB-03) :

| Invariant CONTRACT §2 | Test attendu | Critère |
|---|---|---|
| `Sentence.index` unique & contigu 0..n-1 | `test_sentence_index_contiguous` | insertion d'un trou ou doublon → `IntegrityError` |
| `Clause.anchor_sentence` ∈ doc de l'annotation | `test_clause_anchor_same_document` | ancre hors doc → ValidationError, 0 écriture |
| **un seul clause start par phrase** / annotation | `test_one_clause_start_per_sentence` | 2e clause même ancre → 409/IntegrityError |
| `Clause.theme` ∈ themes du LabelScheme projet | `test_clause_theme_in_scheme` | thème hors vocab fermé → rejet (pas de `OTHER_`) |
| `Annotation` unique `(project, document, annotator)` | `test_annotation_uniqueness` | doublon → IntegrityError |
| transition statut → 1 `ActivityEvent` (+ version) | `test_status_transition_emits_event` | 100 % transitions = exactement 1 event (Q-FIA-03) |
| `certainty ∈ {0,1,2,3}` | `test_certainty_range` | valeur hors borne → rejet |

### 2.2 Unitaire — loaders & pivot (F2, F12, Q-MOD-01)

- **CLAUDETTE loader** (`test_claudette_loader.py`) : alignement ligne-à-ligne
  `Sentences/` ↔ `Labels/`. Tout mismatch de longueur → rejet **sans état partiel**
  (Q-ROB-01). Vérifie `n_sentences`, contiguïté des index, parsing catégorie+niveau.
- **Pivot clause** (`test_pivot.py`) : import v9.2 (`document_plan.segments[].start_id`) et
  v9.4 (`plan.clauses[].anchor_id`/`open_span`) → **même pivot** (CONTRACT §4). Round-trip
  import→export→import idempotent (Q-MOD-01).
- **Idempotence** (`test_idempotency.py`) : ré-import d'un fichier inchangé (checksum) = 0
  mutation (Q-ROB-02), pour pré-annotations et translation sync.

### 2.3 Intégration — API DRF

Un test par endpoint du CONTRACT §3, par statut HTTP attendu (200/201/204/400/401/403/404/409).
`APIClient` DRF + JWT. Vérifie : pagination `?page=&page_size=`, filtres
`?project=&document=&status=`, tri `?ordering=`, codes d'erreur.

- `test_api_auth.py` : login/refresh/me, 401 sans token.
- `test_api_annotations.py` : CRUD annotation, `POST submit`, `POST clauses`, seed
  `seed=preannotation:claude`.
- `test_api_versioning.py` : `versions`, `versions/{n}/diff`, restauration = diff vide
  (Q-FIA-01), conflit 409.
- `test_api_exports.py` : `POST exports` → job, `GET exports/{id}` statut+manifest ;
  formats jsonl/csv/conll/xml/md/huggingface (Q-EVO-03) ; manifest trace version de schéma
  (Q-EVO-02) ; anonymize=true par défaut sur compare/IAA (Q-SEC-04).
- `test_api_comments_reviews.py` : threads, resolve, reviews score 1..5.

### 2.4 Permissions & sécurité (Q-SEC)

- `test_authz_isolation.py` : deny-by-default ; un annotateur ne lit/édite jamais hors de son
  périmètre projet (Q-SEC-01). Matrice rôle×route de `navigation.md §4`.
- `test_pathsafety.py` : chemins file-based (translations F8, imports F2) confinés —
  path-traversal / symlink / absolu hors racine rejetés à 100 % (Q-SEC-03).
- `test_logging_pii.py` : `PIIScrubber` retire email/nom/token/contenu des logs/metrics/traces
  (Q-SEC-02).

### 2.5 IAA & qualité

- `test_iaa.py` : Cohen κ, Fleiss κ, WindowDiff tabulés à 1e-6 près sur cas de référence
  (Q-FIA-02). Cas dégénérés (annotateur unique, accord parfait, désaccord total).

### 2.6 Performance (garde-fous)

- `test_n_plus_one.py` : `assertNumQueries` sur `GET /documents/{id}` (+sentences+labels)
  borné (Q-OPT-01).

## 3. Frontend — Vitest + Testing Library + MSW

Lanceur : `cd frontend && pnpm test` (≡ `vitest run`). Environnement `jsdom`. Réseau **toujours
mocké par MSW** (jamais d'appel réel en unit/composant). Détails MSW : `msw_strategy.md`.

### 3.1 Composants

- `ClauseEditor` (F1) : pose de frontière, attribution thème palette, édition certitude/rationale.
- `WorkspacePanels` (F6) : 3 panneaux redimensionnables, navigation clavier (j/k/B/T/C/0-3/⌘S).
- `UnfairnessOverlay` (F12) : toggle surlignage, info-bulle catégorie+niveau.
- `PreannotationGhost` (F2) : overlay fantôme, application en brouillon éditable, provenance.
- `VersionTimeline` / `DiffView` (F3), `CommentThread` (F9), `CertaintyControl` + `ReviewPanel`
  (F10), `ActivityBell` (F4).
- `ThemeToggle` + tokens (F6) : thème clair/sombre depuis les design tokens.

### 3.2 Stores (Zustand) & data (React Query)

- `annotationStore` : sélection clause, état brouillon, optimistic update + rollback sur erreur.
- `useAnnotation`/`useDocument` (React Query) : cache, invalidation après mutation, gestion 409.

### 3.3 Contract testing (MSW ↔ DRF)

Les handlers MSW servent les **fixtures partagées** `fixtures/api/`. Un test
(`contract.test.ts`) vérifie que chaque fixture est conforme au shape attendu par le client ; le
backend valide les mêmes fixtures côté sérialiseur (`test_contract_fixtures.py`). Divergence de
forme = échec des deux côtés.

### 3.4 Accessibilité (F6, Q-A11Y-01)

`axe-core` via `vitest-axe` sur le workspace, l'inspecteur, la palette ⌘K : 0 violation
critique, contraste AA des couleurs de thèmes du vocabulaire.

## 4. E2E — Playwright (1 spec par feature)

Lanceur : `cd frontend && pnpm e2e`, ou `make e2e` (orchestre back+front via
`scripts/e2e.sh`). Cible : pile réelle (Postgres seedé + backend :8000 + frontend :3000).
Détails des parcours : `e2e_scenarios.md`.

| Feature | Spec Playwright | Couvre |
|---|---|---|
| F1 | `annotate.spec.ts` | poser clause, thème, certitude, **tout au clavier** (Q-FON-03) |
| F2 | `prefill.spec.ts` | pré-remplir depuis Claude/Codex, fantôme, provenance |
| F3 | `history.spec.ts` | timeline, diff, restaurer = diff vide |
| F4 | `collaboration.spec.ts` | cloche activité, tableau de bord, IAA, progression |
| F5 | `export.spec.ts` | lancer export, statut job, télécharger artefact, manifest |
| F6 | `ergonomics.spec.ts` | thème sombre, panneaux redimensionnables, anti-fatigue, axe |
| F7 | `palette.spec.ts` | ⌘K, navigation ≤ 3 clics (Q-FON-02), suite transverse |
| F8 | `translations.spec.ts` | déclarer dossier, sync, overlay langue |
| F9 | `comments.spec.ts` | fil sur clause, resolve |
| F10 | `review.spec.ts` | mode revue, notation, certitude, archivage |
| F11 | `new-corpus.spec.ts` | créer corpus+schéma via admin, **0 ligne de code** (Q-EVO-01) |
| F12 | `unfairness-overlay.spec.ts` | overlay injustice CLAUDETTE par défaut |

Condition de release : les 12 specs vertes (Q-FON-01).

## 5. Données de test — seeders & fixtures

- **Seeders backend** (contrat d'orchestration, cf. `seeding.md`) : `make seed` peuple un état
  déterministe (corpus CLAUDETTE-ToS réduit, LabelScheme `claire-themes-v1`, un projet
  `claudette-gold-v1`, users alice/bob/reviewer/admin, quelques pré-annotations claude/codex).
  Idempotent (Q-ROB-02), re-exécutable.
- **Fixtures pytest** : `factory_boy` pour les entités du CONTRACT §2 ; fixtures de fichiers
  bruts CLAUDETTE (mini-corpus 2-3 docs) et pré-annotations v9.2/v9.4 dans
  `backend/tests/fixtures/`.
- **Fixtures partagées API** : `fixtures/api/*.json` (réponses canoniques) consommées par MSW
  **et** validées par le backend → contrat unique.
- **Données E2E** : Playwright `globalSetup` appelle le seed (DB de test dédiée), puis se
  connecte via JWT par rôle.

## 6. Stratégie de mocks

| Couche | Quoi mocker | Comment |
|---|---|---|
| Unit FE composant | tout le réseau `/api/v1/` | MSW (handlers + fixtures partagées) |
| Unit FE store | mutations réseau | MSW + flush React Query |
| Intégration BE | LLM externe (claude/codex pull) | stub `responses`/`respx`, **jamais d'appel réseau réel** |
| Intégration BE | horloge, uuid, checksum | `freezegun`, seed déterministe |
| E2E | LLM externe & système de fichiers traduction | fixtures locales seedées (pas de réseau sortant) |

Règle absolue : **aucun test ne sort sur le réseau** (déterminisme + CI hermétique).

## 7. CI (résumé — détail `coverage_goals.md` + `.github/workflows/ci.yml`)

Jobs : `lint` (ruff+import-linter / eslint+prettier+tsc) → `backend-test` (pytest + service
Postgres) → `frontend-test` (vitest + couverture) → `e2e` (Playwright sur pile docker) →
`build` (images backend+frontend). Garde-fous de couverture bloquants (`coverage_goals.md`).
Workflow optionnel `seed-check.yml` : vérifie l'idempotence du seed (2 runs = 0 mutation).

## 8. Matrice & traçabilité

Le mapping exhaustif `feature_id → niveau → fichier → critère` est dans `test_matrix.csv`
(dérivé de `feature_traceability.csv` + `quality_requirements.csv`).
