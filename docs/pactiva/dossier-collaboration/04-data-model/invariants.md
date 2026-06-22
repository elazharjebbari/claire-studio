# Invariants du modèle de données — Pactiva

Cette table consolide les invariants **durs** (garantis par la base ou le code)
et les invariants **métier** (garantis par les permissions / les requêtes).
Pour chacun : l'énoncé, le lieu de garantie (`fichier:ligne`) et le test qui le
couvre. Sources : docstrings `annotations/models.py:1`, `corpora/models.py:1`,
ADR‑001 (`02-architecture/decision-record.md`), glossaire
(`01-besoins/glossaire.md`).

> Convention : INV‑1..INV‑6 sont les invariants historiques du CONTRACT §2 ;
> INV‑ISO, INV‑DOC‑UNIQUE et INV‑COLLAB sont les invariants formalisés par
> ADR‑001 (séparation session / collaboration).

## Tableau de synthèse

| # | Énoncé | Type | Garanti par (`fichier:ligne`) | Test |
|---|---|---|---|---|
| **INV‑1** | `Sentence.index` unique par document (phrases 0..n‑1). | Dur (DB) | `corpora/models.py:72` `uniq_sentence_document_index` | `tests/test_invariants.py:15` `test_inv1_sentence_index_unique` |
| **INV‑2** | Un seul début de clause par phrase par session. | Dur (DB) | `annotations/models.py:112` `uniq_clause_annotation_anchor` | `tests/test_invariants.py:23` `test_inv2_one_clause_start_per_sentence` |
| **INV‑3** | `Clause.theme` appartient au schéma du projet. | Validation (API) | serializer + FK `Theme→scheme` (`schemes/models.py:26`) | `tests/test_invariants.py:32` `test_inv3_theme_must_be_in_scheme` ; `:45` `test_inv3_scheme_isolation` |
| **INV‑4** | `Annotation` unique par `(project, document, annotator)` — **fonde la session**. | Dur (DB) | `annotations/models.py:62` `uniq_annotation_project_doc_annotator` | `tests/test_invariants.py:61` `test_inv4_annotation_unique_triplet` |
| **INV‑5** | Toute transition de statut passe par `transition_status` (état légal + `ActivityEvent` + snapshot). | Code (service) | `annotations/services.py:22` `ALLOWED_TRANSITIONS` | `tests/test_invariants.py:74` `test_inv5_transition_emits_event_and_version` ; `:86` `test_inv5_illegal_transition_rejected` |
| **INV‑6** | Certitude (annotation & clause) ∈ {0,1,2,3}. | Dur (DB) | `annotations/models.py:67` & `:124` (`ck_*_certainty_range`) | `tests/test_invariants.py:95` `test_inv6_certainty_range` |
| **INV‑ISO** | Écriture du **contenu** d'une session **owner‑only** ; un pair ne **lit** pas la session d'autrui (indépendance IAA). | Code (permissions + queryset) | `common/permissions.py:60` `IsAnnotationOwner` ; `annotations/views.py:86-91` (filtre `annotator=user`) | `tests/test_permissions.py:34` `test_annotator_cannot_edit_others_annotation` ; `tests/test_security_m9.py:72` `test_authz_isolation` |
| **INV‑DOC‑UNIQUE** | Toute liste de documents d'un projet expose **au plus une ligne par document**. | Code (endpoint) | `projects/views.py:228` action `documents` (1 ligne/doc) ; ancrage DB `corpora/models.py:41` | `tests/test_sessions_documents.py:55` `test_documents_endpoint_no_duplication` |
| **INV‑COLLAB** | Aucune donnée de collaboration (commentaire, comparaison, pré‑annotation, session d'autrui) ne compte comme **référence** pour MA soumission ni MON export. | Code (modèle + requêtes) | `imports/models.py:1` (seed append‑only) ; `annotations/models.py:103` `validated` ; `exports/services.py:26-37` `_selected_annotations` | `tests/test_clause_validation.py:19` `test_clause_validated_defaults_false` ; `tests/test_sessions_documents.py:87` `test_documents_annotator_no_session_leak` |

---

## Détail par invariant

### INV‑1 — index de phrase contigu et unique
- **Énoncé** : pour un document, `Sentence.index` est unique (et la convention
  est une suite contiguë `0..n_sentences-1`).
- **Garanti par** : `UniqueConstraint(document, index)` —
  `corpora/models.py:72`. Contrainte de base : un doublon lève `IntegrityError`.
- **Test** : `tests/test_invariants.py:15` insère un `index=0` en double et
  attend `IntegrityError`.

### INV‑2 — un début de clause par phrase par session
- **Énoncé** : dans une session, deux clauses ne peuvent pas ancrer la **même**
  phrase (`anchor_sentence`).
- **Garanti par** : `UniqueConstraint(annotation, anchor_sentence)` —
  `annotations/models.py:112`.
- **Test** : `tests/test_invariants.py:23` crée deux clauses sur `s0` →
  `IntegrityError`.

### INV‑3 — thème dans le schéma du projet
- **Énoncé** : une `Clause` ne peut porter qu'un `Theme` appartenant au
  `LabelScheme` du projet (vocabulaire fermé). L'unicité `(scheme, code)`
  (`schemes/models.py:38`) empêche les collisions ; la résolution du thème par
  code se fait dans le périmètre du schéma du projet.
- **Garanti par** : FK `Theme → scheme` (`schemes/models.py:26`) + validation
  au serializer (résolution `code → Theme` limitée au schéma du projet ; un code
  inconnu **ou** d'un autre schéma est rejeté en 400).
- **Tests** : `tests/test_invariants.py:32` (code inexistant → 400) ; `:45`
  `test_inv3_scheme_isolation` (code existant mais d'un **autre** schéma → 400).

### INV‑4 — unicité de la session (fondement de la notion de session)
- **Énoncé** : il existe **au plus une** `Annotation` par
  `(project, document, annotator)`. C'est l'invariant qui **est** la session
  (ADR‑001 §1 : pas de table `Session` redondante).
- **Garanti par** : `UniqueConstraint(project, document, annotator)` —
  `annotations/models.py:62`. L'ouverture passe toujours par `createAnnotation`
  (`annotations/views.py:111` `create`), idempotent sur ce triplet.
- **Test** : `tests/test_invariants.py:61` recrée le triplet → `IntegrityError`.

### INV‑5 — machine d'états des transitions
- **Énoncé** : tout changement de `status` passe par `transition_status`, qui
  (a) vérifie la légalité de la transition, (b) émet un `ActivityEvent`,
  (c) crée un `AnnotationVersion` immuable pour les transitions à snapshot.
- **Garanti par** : `ALLOWED_TRANSITIONS` (`annotations/services.py:22`) +
  `SNAPSHOTTING_TRANSITIONS` (`annotations/services.py:40`) ; une transition
  illégale lève `Conflict`.
- **Tests** : `tests/test_invariants.py:74` (submit → event + version) ; `:86`
  (`draft→approved` interdit → `Conflict`).

### INV‑6 — certitude bornée
- **Énoncé** : `Annotation.global_certainty` et `Clause.certainty` ∈ {0,1,2,3}
  (ou null).
- **Garanti par** : `CheckConstraint` `ck_annotation_global_certainty_range`
  (`annotations/models.py:67`) et `ck_clause_certainty_range`
  (`annotations/models.py:124`), doublés par `MaxValueValidator(3)`.
- **Test** : `tests/test_invariants.py:95` crée une clause `certainty=5` →
  `IntegrityError`.

### INV‑ISO — isolation d'écriture (et de lecture) de la session
- **Énoncé** : seul le **propriétaire** (`Annotation.annotator`) écrit le
  contenu de sa session ; **aucune dérogation de rôle** (même admin/reviewer ne
  peut éditer clauses/statut/certitude d'un tiers, sous peine de fausser l'IAA).
  En **lecture**, un annotateur non privilégié ne voit que **ses** sessions ;
  admin/reviewer supervisent en lecture seule.
- **Garanti par** :
  - Écriture owner‑only : `IsAnnotationOwner` (`common/permissions.py:60`),
    appliqué aux actions de contenu (`_OWNER_ONLY_ACTIONS`,
    `annotations/views.py:55` ; `ClauseViewSet.permission_classes`,
    `annotations/views.py:392`).
  - Lecture isolée : `AnnotationViewSet.get_queryset` filtre `annotator=user`
    pour les non‑privilégiés (`annotations/views.py:86-91`) ;
    `ClauseViewSet.get_queryset` idem (`annotations/views.py:395-402`).
- **Tests** : `tests/test_permissions.py:34` (un annotateur ne peut PATCH la
  session d'un autre) ; `tests/test_security_m9.py:72` `test_authz_isolation`
  (un pair, **même membre**, ne lit pas la session d'autrui → 403/404 ; un admin
  la **lit** en 200).

### INV‑DOC‑UNIQUE — un document = une ligne
- **Énoncé** : toute liste de documents d'un projet expose **au plus une ligne
  par document**, quelle que soit le nombre d'assignations/sessions (anti‑
  duplication ×N annotateurs).
- **Garanti par** : l'action document‑centrée
  `GET /projects/{slug}/documents` (`projects/views.py:228`) groupe **par
  document** (jamais par assignation) et enrichit chaque ligne de `mySession`
  et, pour l'admin/lead, `sessions[]`/`sessionsSummary`. Ancrage physique :
  `UniqueConstraint(corpus, external_id)` (`corpora/models.py:41`). Défense en
  profondeur côté front : dédup dans `useProjectDocuments` (ADR‑001 §A1).
- **Test** : `tests/test_sessions_documents.py:55`
  `test_documents_endpoint_no_duplication` (2 docs × 3 annotateurs → `count==2`,
  ids distincts).

### INV‑COLLAB — la collaboration aide, ne fait jamais référence
- **Énoncé** : pré‑annotations LLM, comparaison N‑way, commentaires, revues et
  sessions d'autrui sont des **aides** ; elles n'entrent **jamais** dans MA
  soumission ni dans MON export en tant que donnée de référence. Seule une
  `Clause.validated == True` de **ma** session fait foi.
- **Garanti par** :
  - Séparation structurelle : `PreAnnotation`/`PreClause` sont append‑only et
    distincts de `Clause` (`imports/models.py:1`, `:45`).
  - Validation explicite : `Clause.validated` défaut `False`
    (`annotations/models.py:103`) ; tracée dans le snapshot/export
    (`annotations/services.py:76`, `exports/services.py:66`).
  - Export : `_selected_annotations` ne lit que des `Annotation` gold‑grade
    (`exports/services.py:26-37`) — aucune entité de collaboration n'est
    exportée ; un seed reste `source=preannotation_seed` et n'est pas du gold
    tant qu'il n'est pas validé.
  - Non‑fuite : un annotateur ne voit pas les sessions des autres dans la
    matrice (`projects/views.py:256` `expose_sessions`).
- **Tests** : `tests/test_clause_validation.py:19` (validated défaut `False`,
  aller‑retour POST/PATCH) ; `tests/test_sessions_documents.py:87`
  `test_documents_annotator_no_session_leak` (pas de `sessions`/`sessionsSummary`
  pour un annotateur, seulement `mySession`).

---

## Invariants connexes (renforts, non numérotés)

| Garde | Énoncé | Garanti par | Test |
|---|---|---|---|
| Idempotence d'écriture | Un `client_op_id` non vide est unique par session → un retry ne duplique pas la clause. | `annotations/models.py:118` `uniq_clause_client_op` (contrainte partielle) | `tests/test_clause_idempotency.py:18` `test_add_clause_idempotent_on_client_op_id` |
| Isolation collaboration | Un utilisateur ne voit que les commentaires / l'activité de ses projets. | `collaboration/views.py:19` ; `audit/views.py:18` | `tests/test_security_m9.py` (suite M9) |
| IAA sans double‑comptage | Pour N≥3 annotateurs, `per_theme`/`boundary` = moyenne des κ **par paire** (pas de concaténation). | `projects/iaa.py:117-159` | `tests/test_sessions_documents.py:171` `test_iaa_detail_no_double_count_n3` |
