# Synthèse d'audit — Pactiva (collaboration & sessions d'annotation)

> **Périmètre** : audit du socle « campagnes d'annotation multi-annotateurs » de Pactiva
> (ex-CLAIRE Studio), à partir du symptôme rapporté en production (documents dupliqués ×3
> sur la campagne `campagne-pactiva`, 3 comptes, 50 ToS CLAUDETTE).
> **Méthode** : revue de code adversariale, fichier par fichier, ligne par ligne.
> **Corpus de findings** : 55 findings (`findings.csv`, `audit-findings.json`),
> dont 37 majeurs/blockers confirmés et **1 réfuté** par lecture du code.
> **Vocabulaire** : strictement aligné sur `../01-besoins/glossaire.md`
> (Campagne / Document / Assignation / Session / Collaboration / Référence).
> **Décisions** : voir `../02-architecture/decision-record.md` (ADR-001).

---

## 1. Verdict express

**Le socle backend est solide ; le bug central n'est pas un bug de modèle, c'est un bug de
couche de présentation.**

- Le **modèle de données est correct** : `Annotation` est déjà *par construction* la session
  d'un seul annotateur (contrainte d'unicité `(project, document, annotator)`, INV-4,
  `backend/claire/annotations/models.py:62-65`). `Assignment` est *par construction* unique
  par `(project, document, assignee)` (`backend/claire/projects/models.py:107-110`). L'isolation
  d'écriture *owner-only* (`IsAnnotationOwner`) tenait déjà côté API.
- La **duplication ×3** vient d'un seul anti-pattern : `Assignment` (1 ligne par
  `document × annotateur`) était utilisé comme **source d'une liste de DOCUMENTS**. Pour un
  admin, `GET /projects/{slug}/assignments` ne filtrait pas par `assignee`
  (`backend/claire/projects/views.py:73-74`) → `n_docs × n_annotateurs` lignes → chaque document
  affiché 3 fois sur la campagne, le dashboard, le `DocumentSwitcher`, etc.
- Les **trous réels** étaient ailleurs et plus graves que le symptôme visuel :
  (a) **fuite inter-annotateurs** — un membre pouvait lire le contenu (clauses, rationale,
  certitude) de la session d'un pair, contaminant l'indépendance IAA ;
  (b) **`CommentViewSet` / `ActivityEventViewSet` non isolés par projet** (IDOR) ;
  (c) **exports cosmétiques** — 4 formats sur 6 retombaient silencieusement en JSONL, aucun
  endpoint de téléchargement, pas d'export de concordance IAA.

**Conséquence de la stratégie retenue (ADR-001)** : on supprime la duplication *par
construction* (endpoint document-centré `GET /projects/{slug}/documents`, 1 ligne par
document) plutôt que par une rustine de filtrage client, et on durcit l'isolation/les exports.
La majorité des **blockers (duplication, sécurité, exports)** sont **CORRIGÉS** dans cette
itération ; l'essentiel du **PLANIFIÉ** restant relève de l'UX/design/a11y et de la performance
(export asynchrone).

---

## 2. Synthèse par domaine

| Domaine | Blocker | Major | Minor | Info | Total | Statut global |
|---|---:|---:|---:|---:|---:|---|
| **data-model** (modélisation) | 1 | 3 | 3 | 2 | 9 | Cause racine corrigée par construction ; 1 finding réfuté ; reliquats planifiés |
| **api-perms** (sécurité/API) | 0 | 4 | 3 | 1 | 8 | Fuite inter-annotateurs + isolation comments/activity **corrigées** |
| **exports** | 2 | 4 | 2 | — | 8 | 2 blockers + format effectif/IAA **corrigés** ; async **planifié** |
| **frontend-workspace** | 2 | 1 | — | — | 3 | **Corrigés** (DocumentSwitcher document-centré) |
| **frontend-campaign** | 2 | 3 | — | — | 5 | **Corrigés** (dashboard/docs/home filtrés sur MA session) |
| **frontend-collab-ux** | 0 | 3 | 3 | 3 | 9 | Séparation A/B + lecture seule **corrigées** ; détails UX **planifiés** |
| **design-a11y** | 0 | 5 | — | — | 5 | Var CSS / FOUC / live-region traités ; chasse couleurs en dur **planifiée** |
| **tests** | 2 | 7 | 2 | — | 11 | Tests anti-duplication & isolation **ajoutés** ; couverture élargie **planifiée** |
| **Total** | **9** | **29** | **11** | **6**¹ | **55** |  |

¹ `audit-findings.json` agrège les 6 `info` dans le décompte `minor` du résumé machine
(`counts.minor = 11`) ; la ventilation ci-dessus les distingue. Total = 55 dans les deux cas.
Le résumé machine compte par ailleurs `confirmedMajors = 37` (blockers + majors confirmés) et
`refuted = 1`.

---

## 3. Les 9 BLOCKERS

| # | ID | Constat | Cause racine | Statut | Correctif appliqué |
|---|---|---|---|---|---|
| B1 | `dup-assignments-source-of-truth` | `Assignment` (1 ligne/`doc×annotateur`) sert de source à une **liste de DOCUMENTS** → chaque doc affiché ×3 | Le modèle est correct ; c'est **l'usage** d'`Assignment` comme liste de documents qui est faux (`projects/views.py:70-76`) | **CORRIGÉ** | Nouvel endpoint document-centré `GET /projects/{slug}/documents` (1 ligne/document, `my_session` + `sessions[]`/`sessions_summary` pour admin) — `projects/views.py:228+` ; front bascule sur `useProjectDocuments` (`frontend/src/lib/api/hooks.ts:157`) |
| B2 | `silent-format-fallback` | 4 formats sur 6 (conll/xml/md/huggingface) retombaient **silencieusement** en JSONL, avec extension trompeuse | Une seule branche `if CSV … else _write_jsonl` (`exports/services.py:84-89`) + nom de fichier = format demandé | **CORRIGÉ** | Format `md` implémenté ; manifeste trace `format_requested`/`format_effective`/`warnings` (plus de repli silencieux) — `exports/services.py:146-174` |
| B3 | `no-download-endpoint` | `artifact_path` = chemin filesystem serveur, **aucun endpoint** de téléchargement → export accessible seulement par SSH | `ExportJobViewSet` était `ReadOnly` sans action `download` ; `EXPORTS_DIR` hors static/media | **CORRIGÉ** | Action `download` (`FileResponse`, `Content-Disposition`) **confinée à `EXPORTS_DIR`** (anti path-traversal via `os.path.realpath`) — `exports/views.py:22-32` |
| B4 | `switcher-duplicate-rows-admin` | `DocumentSwitcher` listait `n_docs × n_annotateurs` entrées pour un admin | Conso brute de `assignments.results`, sans dédup ni filtre par `me.id` | **CORRIGÉ** | `DocumentSwitcher` consomme `useProjectDocuments({mine:true})` (1 ligne/document) ; test de non-régression `documentList.test.tsx` |
| B5 | `switcher-wrong-session-on-nav` | Cliquer une entrée ouvrait la **session d'un autre annotateur** (résolue par `document+assignee`) | `annotation_id` résolu par `annotator=obj.assignee`, pas par l'utilisateur courant | **CORRIGÉ** | Ouverture **toujours via `createAnnotation`** (MA session, `mySession.annotationId`) ; ADR-001 §3 |
| B6 | `admin-assignments-overfetch-duplication` | Backend renvoyait tout pour l'admin, consommé 1:1 par 5 écrans | `if not request.user.is_admin_role: qs.filter(assignee=…)` exempte l'admin (`views.py:73-74`) | **CORRIGÉ** (contourné) | Endpoint `assignments` conservé pour la **matrice d'affectation admin** ; les listes de documents passent désormais par `documents` (séparation des deux besoins, B1) |
| B7 | `dashboard-home-duplique` | « Mes assignations » (campagne + home) affichait les assignations **de tous** pour un admin, et « Annoter » ouvrait la session d'autrui | Mêmes deux causes que B1/B6, côté pages | **CORRIGÉ** | `projects/[slug]/page.tsx`, `home/page.tsx` filtrent sur MA session et ouvrent via `createAnnotation` |
| B8 | `no-test-assignments-dedup-cardinality` | **Aucun test** sur la cardinalité de l'endpoint (bug de duplication non couvert) | Trou de couverture backend | **CORRIGÉ** | `backend/tests/test_sessions_documents.py` (cardinalité 1 ligne/document, `my_session` par utilisateur) |
| B9 | `frontend-pages-untested` | Les pages consommant `assignments` (home, docs, `DocumentSwitcher`) n'étaient testées par **rien** | Périmètre de couverture excluant `src/app` et `src/components` | **CORRIGÉ** | `frontend/tests/documentList.test.tsx` (unicité des documents, `annotationId` = utilisateur courant) + e2e `frontend/e2e/no-duplicate-documents.spec.ts` |

> **Note d'honnêteté** : B2 est corrigé au sens « plus de repli silencieux + format `md` réel +
> manifeste véridique ». Les formats `conll`/`xml`/`huggingface` ne sont pas tous matérialisés ;
> le contrat est désormais explicite (`format_effective` + `warnings`) au lieu de mentir, ce qui
> lève le caractère **bloquant** (donnée trompeuse) du finding.

---

## 4. MAJORS regroupés par thème

### 4.1 Sécurité / isolation (api-perms) — **CORRIGÉ**

| ID | Constat | Statut | Correctif |
|---|---|---|---|
| `annotator-sees-others-sessions` | Un membre lisait le **contenu** (clauses/rationale/certitude) de la session d'un pair → contamination IAA. Pire : `ClauseViewSet` n'avait **aucun** `get_queryset` (lecture de toute clause par id) | **CORRIGÉ** | `AnnotationViewSet.get_queryset` filtre `annotator=user` hors admin/reviewer (`annotations/views.py:88-91`) ; `ClauseViewSet.get_queryset` filtre `annotation__annotator=user` (`annotations/views.py:395-402`) |
| `comments-no-project-isolation` | `CommentViewSet` exposait **tous** les commentaires de la plateforme (IDOR sur patch/delete/resolve) | **CORRIGÉ** | `get_queryset` filtre `Q(annotation__project__memberships__user) | Q(author=user)` (`collaboration/views.py:19-29`) |
| `assignments-admin-returns-all` | Endpoint `assignments` = source du bug de duplication | **CORRIGÉ** | Séparation `documents` (workspace) / `assignments` (matrice admin) — cf. B1/B6 |
| `no-distinct-documents-endpoint` | Pas d'endpoint « documents distincts » orienté workspace | **CORRIGÉ** | `GET /projects/{slug}/documents` ajouté (B1) |

### 4.2 Modèle de données (data-model)

| ID | Constat | Statut | Note |
|---|---|---|---|
| `no-session-vs-collab-distinction` | Aucun champ ne distingue session (A) de collaboration (B) | **CORRIGÉ (formalisé)** | ADR-001 fixe les invariants **INV-COLLAB** (B n'est jamais référence) et la frontière A/B portée par serializers/permissions, sans table redondante (alternative `AnnotationSession` écartée) |
| `missing-doc-annotator-matrix-entity` | Pas de vue « matrice doc×annotateur » ; recalculs ad hoc + N+1 | **CORRIGÉ** | `documents` expose `sessions[]`/`sessions_summary` (matrice) pour admin/lead |
| `assignment-status-not-synced` | *(prétendu)* `Assignment.status` et `Annotation.status` non synchronisés | **RÉFUTÉ** | `backend/claire/projects/signals.py` dérive et synchronise `Assignment.status` depuis `Annotation`/`Clause` (post_save/post_delete) ; le scénario d'incohérence allégué est impossible |

### 4.3 Exports

| ID | Constat | Statut | Correctif / Plan |
|---|---|---|---|
| `snapshot-drops-validated-source` | `build_snapshot` omettait `validated`/`source`/`order` → seed LLM indistinguable d'une session humaine | **CORRIGÉ** | `build_snapshot` enrichi (`source`, `validated`, `order`, `updated_at`) |
| `no-iaa-export-artifact` | IAA = simple endpoint de lecture, aucun artefact archivable | **CORRIGÉ** | Format `iaa_matrix` (CSV de concordance) produit par `run_export` — `exports/services.py:107,127,165-166` ; `ExportFormat.IAA_MATRIX` (`exports/models.py:16`) |
| `export-synchronous-in-request` | Export 100 % synchrone dans la requête HTTP (timeout gros volumes) | **PLANIFIÉ** | Déport vers tâche async (Celery/RQ) + `prefetch` clauses + écriture streamée |
| `manifest-and-scope-traceability` *(info)* | `scope.statuses` non validé, manifeste sans ventilation | **PARTIEL** | `scope.annotators` ajouté + warnings ; ventilation fine **planifiée** |

### 4.4 Collaboration & UX (frontend-collab-ux)

| ID | Constat | Statut | Note |
|---|---|---|---|
| `judge-view-no-readonly` | Vue juge sans signal lecture seule ; le menu écrivait dans MA session | **CORRIGÉ** | Bandeau/lecture seule pour source non humaine (ADR-001 §4) |
| `collab-not-grouped` | Collaboration non regroupée comme espace distinct | **CORRIGÉ** | Espace « Collaboration » nommé, distinct de « Ma session » |
| `shared-grammar` | Même grammaire `radiogroup` pour voir/écraser/comparer/commenter (action destructive `prefill` visuellement identique) | **PLANIFIÉ** | Différenciation visuelle écriture-sur-session vs visualisation |

### 4.5 Design & accessibilité (design-a11y)

| ID | Constat | Statut |
|---|---|---|
| `surface-line-css-var-typo` | Var CSS inexistante `--surface-line` (token : `--surface-border`) | **CORRIGÉ** |
| `theme-fouc-no-blocking-script` | FOUC du thème (appliqué en `useEffect`) | **CORRIGÉ** (script inline bloquant) |
| `no-prefers-reduced-motion` | `prefers-reduced-motion` ignoré partout | **CORRIGÉ** (media query globale) |
| `save-indicator-no-live-region` | Autosave sans `role=status`/`aria-live` (échec silencieux pour lecteurs d'écran) | **CORRIGÉ** |
| `hardcoded-tailwind-state-colors` | ~86 (réel ≈135) couleurs Tailwind en dur contournent les tokens sémantiques, perte AA en clair | **PLANIFIÉ** (chasse couleurs en dur, Phase 5 identité) |

### 4.6 Tests

Au-delà de B8/B9, les majors de couverture restants sont **CORRIGÉS** (fixtures multi-annotateur,
IAA N=3 désaccord partiel, export par-annotateur, bulk-assign, anti-skip silencieux,
non-régression duplication) ou **PLANIFIÉS** (élargissement `coverage.include` à `src/app`/`src/components`,
WS multi-utilisateur). Voir `findings.csv` (`msw-fixture-single-annotator`,
`no-iaa-frontend-and-thin-backend`, `no-export-per-annotator`, `session-isolation-only-at-api`,
`bulk-assign-untested`, `tests-skip-silently-no-data`, `no-regression-test-duplication`).

---

## 5. CORRIGÉ dans cette itération vs PLANIFIÉ

### CORRIGÉ (vérifié dans le code)

- **Cause racine de la duplication** : `GET /projects/{slug}/documents` (1 ligne/document,
  `my_session` + `sessions[]`/`sessions_summary`) — `projects/views.py:228+` ;
  front sur `useProjectDocuments` (`hooks.ts:157`, `DocumentSwitcher`, `projects/[slug]/page.tsx`,
  `docs/page.tsx`, `home/page.tsx`) ; ouverture **toujours** via `createAnnotation`.
- **Sécurité/indépendance IAA** : isolation lecture annotateur (`annotations/views.py:88-91`,
  `395-402`), isolation projet `CommentViewSet` (`collaboration/views.py:19-29`) et
  `ActivityEventViewSet` (`audit/views.py:18,51`).
- **Exports** : endpoint `download` confiné à `EXPORTS_DIR` (`exports/views.py:22-32`) ;
  manifeste `format_requested`/`format_effective`/`warnings` (`exports/services.py:146-174`) ;
  format `md` ; format `iaa_matrix` (`exports/services.py:107` ; `exports/models.py:16`) ;
  `build_snapshot` enrichi (`source`/`validated`/`order`/`updated_at`) ; `scope.annotators`.
- **IAA** : correction du double-comptage `per_theme`/`boundary` pour N≥3 (moyenne des κ par paire,
  `projects/iaa.py:118-122,165-176`).
- **UX/design** : séparation A/B (Ma session / Lecture seule / Collaboration), lecture seule pour
  source juge, FOUC, `prefers-reduced-motion`, `aria-live` autosave, typo var CSS.
- **Tests** : `backend/tests/test_sessions_documents.py`, `frontend/tests/documentList.test.tsx`,
  `frontend/e2e/no-duplicate-documents.spec.ts` + fixtures/cas IAA/exports/bulk.
- **Hygiène** : `admin/users` sans « Bruno » codé en dur ; `env.ts` force les mocks OFF en prod.

### PLANIFIÉ (non bloquant — backlog explicite)

- **Perf export** : déport asynchrone (Celery/RQ) + `prefetch` clauses + écriture streamée
  (`export-synchronous-in-request`) ; sortir l'I/O disque du `@transaction.atomic`
  (`atomic-wraps-disk-io`).
- **Perf supervision** : agrégation SQL unique pour `annotators_progress` + préchargement de
  `annotation_id` (N+1 `annotation-id-derived-per-row`, `assignment-status-not-derived`).
- **Design/a11y** : chasse aux couleurs Tailwind en dur → tokens sémantiques
  (`hardcoded-tailwind-state-colors`, Phase 5 identité).
- **UX de collaboration** : différenciation visuelle de la grammaire `radiogroup`
  (`shared-grammar`), confirmation des actions destructives (`adopt-no-confirm`), légende
  persistante des pastilles (`help-vs-session-naming`), unification affichage auteur
  (`comment-author-raw`), point d'entrée Collaboration dégradé sans présence
  (`presence-flag-silent`), clarification des deux comparaisons (`compare-redundancy`).
- **Modèle (durcissements optionnels)** : validation `theme_code → Theme` au seed
  (`preclause-theme-code-not-fk`), règle d'allocation Annotation/Assignment
  (`annotation-without-assignment-allowed`), liste fermée de juges
  (`preannotation-import-no-judge-validation`), durcissement des lectures « admin only »
  réellement ouvertes (`admin-only-reads-actually-open`).
- **Tests** : élargir `coverage.include` (`coverage-scope-too-narrow`), WS présence multi-utilisateur
  front (`no-ws-presence-multiuser-test-front`).

---

*Source de vérité des findings : `findings.csv` / `audit-findings.json` (ce dossier). Décisions et
invariants : ADR-001 (`../02-architecture/decision-record.md`). Vocabulaire : `../01-besoins/glossaire.md`.*
