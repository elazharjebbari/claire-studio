# Backend — Architecture (CLAIRE Studio)

> Implémentation MVP fonctionnelle. Source de vérité : `dossier/00_overview/CONTRACT.md`.
> Stack : Django 5 + Django REST Framework + SimpleJWT, SQLite en dev (Postgres-ready
> via `DATABASE_URL`), exports fichiers. Code dans `annotation-studio/backend/`.

## 1. Organisation

```
backend/
├── manage.py
├── requirements.txt / pyproject.toml / pytest.ini / Makefile / .env.example
├── config/                     # projet Django
│   ├── settings/{base,dev,prod,test}.py
│   ├── urls.py                 # admin + /api/v1/ + /api/schema + /api/docs
│   ├── api_urls.py             # router DRF + endpoints auth/me
│   └── wsgi.py / asgi.py
├── claire/                     # une app Django par domaine (CONTRACT §6)
│   ├── common/                 # pagination, exceptions (409), permissions, modèles abstraits
│   ├── accounts/               # User custom (role), /me
│   ├── corpora/                # Corpus, Document, Sentence, ReferenceLabel + loader CLAUDETTE + seed_demo
│   ├── schemes/                # LabelScheme, Theme, LegalNature + loader vocabulary.yaml
│   ├── projects/               # Project, ProjectMembership, Assignment + IAA (κ)
│   ├── annotations/            # Annotation, Clause, AnnotationVersion + state machine + diff + signals
│   ├── collaboration/          # Comment, Review
│   ├── imports/                # PreAnnotation, PreClause + loaders v9.2/v9.4 + seed depuis pré-annotation
│   ├── translations/           # TranslationSet, Translation + sync file-based
│   ├── exports/                # ExportJob + service jsonl/csv + manifest
│   └── audit/                  # ActivityEvent + service record_event
├── fixtures/                   # données de secours (CLAUDETTE + pré-annotations) si data/raw absent
└── tests/                      # pytest + conftest (factory-boy)
```

Chaque app expose `models.py`, `serializers.py`, `views.py` ; les services métier sont
isolés (`services.py`, `loaders.py`, `iaa.py`) pour rester testables hors HTTP.

## 2. Configuration & sécurité

- **Settings par environnement** (`config.settings.{dev,prod,test}`) pilotés par
  `django-environ`. Aucun secret en dur : `DJANGO_SECRET_KEY`, `DATABASE_URL`,
  `CORS_ALLOWED_ORIGINS`, durées JWT viennent de l'environnement (`.env` non versionné,
  `.env.example` fourni).
- **prod.py** durcit : `SECURE_SSL_REDIRECT`, HSTS, cookies sécurisés, `X_FRAME_OPTIONS=DENY`,
  `SECRET_KEY` obligatoire depuis l'env.
- **AUTH_USER_MODEL = accounts.User** (email unique + `role`).
- **JWT** (SimpleJWT) : `POST /auth/login`, `POST /auth/refresh`. Auth par défaut JWT + session.
- **CORS** ouvert sur `localhost:3000` pour le front Next.js.
- **Logging structuré** : formatter `asctime level= logger= msg=`, logger `claire.*` en DEBUG.

## 3. Couche services (logique métier)

| Service | Module | Rôle |
|---|---|---|
| Loader CLAUDETTE | `corpora/loaders.py` | `Sentences/*.txt` + `Labels_<CAT>/*.txt` → Document/Sentence/ReferenceLabel ; détokenisation PTB ; **INV-1** (indices contigus) en transaction ; idempotent (skip si déjà chargé, refus si clauses présentes). |
| Loader scheme | `schemes/loaders.py` | `vocabulary.yaml` → LabelScheme + Theme + LegalNature (update_or_create). |
| Loaders pré-annotations | `imports/loaders.py` | Détection auto v9.4 (`plan.clauses[].anchor_id/open_span`) et v9.2 (`document_plan.segments[].start_id/evidence_span`) → pivot CONTRACT §4. |
| Normalisation thèmes | `imports/theme_mapping.py` | Réconcilie la nomenclature v9.x (THIRD_PARTY, PAYMENT_BILLING…) avec le vocabulaire fermé (THIRD_PARTY_SERVICES, FEES_PAYMENT…) ; fallback `MISC_BOILERPLATE`. Garantit **INV-3** au seed. |
| Ingestion + seed | `imports/services.py` | Persiste PreAnnotation/PreClause (idempotent) ; crée une Annotation humaine pré-remplie (respecte INV-2 dédup d'ancre, INV-3 thème, INV-4 triplet unique). |
| State machine | `annotations/services.py` | `transition_status` = **unique autorité** des changements de statut (INV-5) : transition validée, `ActivityEvent` émis, `AnnotationVersion` snapshot pour submitted/approved/rejected, le tout en une transaction. Transitions illégales → 409. |
| Versioning / diff | `annotations/services.py` | `build_snapshot` (format pivot), `create_version`, `diff_versions` (added/removed/changed par `anchor_index`). |
| IAA | `projects/iaa.py` | Cohen's κ sur vecteurs de thèmes par phrase (forward-fill depuis les ancres) ; κ par paire d'annotateurs + moyenne projet. |
| Traductions | `translations/services.py` | Sync file-based : `<external_id>.txt` aligné phrase à phrase ou document-level. |
| Exports | `exports/services.py` | jsonl (pivot CONTRACT §4) + csv (aplati par clause) + **manifest** explicatif ; lecture transactionnelle cohérente. |
| Audit | `audit/services.py` | `record_event` append-only ; signal `post_save` Annotation → événement `annotation.created`. |

## 4. Invariants (CONTRACT §2) — application en 3 couches

DB (contraintes), service/API (validation + 400/409), test pytest dédié.

| Inv | Mécanisme DB | Test |
|---|---|---|
| INV-1 index contigu | `unique(document,index)` + vérif loader | `test_loaders`, `test_invariants` |
| INV-2 1 ancre/phrase | `unique(annotation,anchor_sentence)` | `test_invariants`, `test_permissions` (409) |
| INV-3 thème ∈ scheme | FK Theme + validation serializer | `test_invariants` (scheme_isolation) |
| INV-4 annotation unique | `unique(project,document,annotator)` + get_or_create | `test_invariants` |
| INV-5 transition tracée | service unique + tx | `test_invariants`, `test_versioning` |
| INV-6 certitude bornée | `CHECK in (0,1,2,3)` | `test_invariants` |

## 5. Permissions

`claire/common/permissions.py` :
- `IsAdminRole` : écriture réservée admin/owner (corpora, schemes, projects mut., exports, imports).
- `IsReviewerOrAdmin` : POST review réservé reviewer/admin.
- `IsAnnotationOwnerOrReviewer` : objet-level — l'auteur édite son annotation/clause ; reviewers/admins agissent en revue.

## 6. Démarrage

```bash
cd annotation-studio/backend
make setup          # pip install -r requirements.txt
make migrate        # applique les migrations
make seed           # migrate + seed_demo (idempotent)
make run            # http://localhost:8000  (API sous /api/v1/, docs /api/docs)
make test           # pytest
make openapi        # écrit openapi.yaml (drf-spectacular)
```

Le seed charge 5 documents CLAUDETTE réels (`data/raw/claudette_tos/`), le LabelScheme
depuis `vocabulary.yaml`, les pré-annotations claude+codex, et 2 annotations exemples
(une par annotateur) soumises pour alimenter progression et IAA.

## 7. Import de données réelles (optionnel)

La commande `import_claudette` ingère un corpus réel au **format CLAUDETTE** sans
dépendre du seed de démo (qui crée aussi projet/membres/annotations). Elle ne
fait qu'alimenter Corpus/Document/Sentence/ReferenceLabel via le loader
`corpora/loaders.py`.

```bash
# format attendu : <source>/Sentences/<Doc>.txt + <source>/Labels_<CAT>/<Doc>.txt
python manage.py import_claudette --source /chemin/vers/ToS
python manage.py import_claudette                       # défaut : settings.CLAUDETTE_DIR
python manage.py import_claudette --source ToS --docs Dropbox Netflix
python manage.py import_claudette --source ToS --max-docs 10 --corpus-slug claudette-tos
```

Options : `--source` (dossier, défaut `CLAUDETTE_DIR`), `--corpus-slug` /
`--corpus-name` (corpus cible, créé si absent), `--docs` (liste explicite),
`--max-docs` (plafond).

Propriétés :
- **Idempotente** : documents appariés par `(corpus, external_id)` ; un document
  inchangé est *skippé* par le loader (comparaison des index de phrases) ; le
  corpus est `get_or_create`.
- **Robuste** : si `--source` n'existe pas, ou si le sous-dossier `Sentences/`
  est absent, la commande **lève un `CommandError` explicite** (avec le lien
  http://claudette.eui.eu/ToS.zip) au lieu de planter. Un document dont les
  phrases sont déjà référencées par des clauses (PROTECT) est *skippé* avec un
  avertissement, sans interrompre l'import des autres.
- **Sûre vis-à-vis des invariants** : chaque document est chargé en transaction
  atomique, **INV-1** (indices contigus) vérifié par le loader.

Robustesse des loaders de pré-annotations (`imports/loaders.py`) : les payloads
malformés (ni `plan` ni `document_plan`, JSON non-objet, `clauses`/`segments`
non-liste, `anchor_id`/`start_id` manquant ou non entier) lèvent désormais une
`PreAnnotationFormatError` claire au lieu d'un `KeyError`/`TypeError` opaque.
Couvert par `tests/test_loaders.py`.

## 8. Alimenter la base (`feed_db` — données réelles, idempotent)

`feed_db` est le **chargeur canonique** des données réelles désormais embarquées
dans le projet. Contrairement à `seed_demo` (qui bascule sur des fixtures de
secours), `feed_db` lit exclusivement les vraies sources :

- Corpus CLAUDETTE : `settings.CLAUDETTE_DIR` (`Sentences/` + `Labels_<CAT>/`).
- Pré-annotations LLM v9.4 : `settings.PREANNOTATIONS_DIR/{claude,codex}/<Doc>_<judge>.json`.
- Traductions : `settings.TRANSLATIONS_ROOT/claudette_fr/<Doc>.txt`.

```bash
make feed                       # migrate + feed_db (12 docs par défaut)
python manage.py feed_db                 # 12 documents
python manage.py feed_db --all           # les 50 documents
python manage.py feed_db --max-docs 4
python manage.py feed_db --reset --all   # vide les tables de données puis recharge
```

Ce que la commande crée / met à jour (tout via `get_or_create` /
`update_or_create`, donc une 2ᵉ exécution → **zéro doublon**, compteurs stables) :

1. `LabelScheme claire-themes-v1` depuis `vocabulary.yaml`.
2. Utilisateurs démo : `admin`, `alice` (annotator), `bob` (annotator),
   `rita` (reviewer) ; mot de passe `claire-demo` (toujours (re)posé).
3. N documents CLAUDETTE (`--max-docs`, défaut 12 ; `--all` pour les 50) via le
   loader `corpora/loaders.py`.
4. Pré-annotations `claude` **et** `codex` de ces documents (PreAnnotation / PreClause).
5. Projet démo `claudette-gold-v1` (corpus + scheme + membres alice/bob/rita/admin
   + assignments).
6. Pour rendre le travail **visible immédiatement** : par document, une Annotation
   humaine d'`alice` seedée depuis `claude` et une de `bob` seedée depuis `codex`,
   toutes deux **submitted** (un submit crée un `AnnotationVersion` snapshot). Plus
   1-2 commentaires et 1 review d'exemple sur le premier document → alimente la
   visualisation, l'historique et l'IAA.
7. Un `TranslationSet claudette_fr` (langue fr, stratégie `by_external_id`) +
   lancement de la sync.

Options : `--max-docs`, `--all`, `--reset` (vide annotations/clauses/versions,
pré-annotations, documents/phrases/labels, traductions, projet/membres — conserve
users & scheme). Logs clairs avec compteurs. Couvert par `tests/test_feed_db.py`
(création complète **+ idempotence** : 2ᵉ run → compteurs identiques, ≥ 2 docs
réels importés depuis `data/`).

## 9. Casing API ↔ frontend (CONTRACT) — `djangorestframework-camel-case`

Le frontend (`frontend/src/types/contract.ts`, `mocks/fixtures.ts`) consomme du
**camelCase** et **ne transforme pas** les réponses. Le backend reste idiomatique
`snake_case` (CONTRACT §6) : la conversion est automatique aux deux extrémités via
`djangorestframework-camel-case`, câblé dans `REST_FRAMEWORK` :

- `DEFAULT_RENDERER_CLASSES` = `CamelCaseJSONRenderer` (+ `CamelCaseBrowsableAPIRenderer`)
  → sortie `snake_case` → `camelCase`.
- `DEFAULT_PARSER_CLASSES` = `CamelCaseJSON/Form/MultiPartParser` → entrée
  `camelCase` → `snake_case` (les clés déjà en snake passent telles quelles, donc
  les payloads `endpoints.ts` qui envoient `anchor_index`/`legal_nature` restent
  acceptés).

Au-delà de la casse, les **noms et structures** des sérialiseurs ont été alignés
sur les interfaces frontend (renvoient des IDs/slug attendus, pas les objets liés) :

| Entité | Forme renvoyée (après camelCase) |
|---|---|
| User | `{id, username, email, role, displayName, locale}` |
| Project | `{id, slug, name, corpusSlug, schemeSlug, guidelines, status, settings, myRole}` |
| ProjectProgress | `{totalDocuments, annotatedDocuments, submittedDocuments, approvedDocuments, myAssigned, myDone, iaa, iaaDetail}` |
| IaaDetail | `{globalKappa, annotatorPairs, boundaryKappa, perTheme:[{code,label,kappa,support}]}` |
| Assignment | `{id, projectSlug, document(DocumentSummary), assigneeId, status, annotationId, dueAt}` |
| DocumentDetail | `{id, corpusId, externalId, title, language, nSentences, checksum, sentences[], referenceLabels[], sourceMeta}` |
| Sentence | `{id, documentId, index, rawText, cleanText, charStart, charEnd}` |
| ReferenceLabel | `{id, sentenceId, sentenceIndex, category, level, source}` (remontés au niveau document) |
| LabelScheme | `{id, slug, name, version, isActive, definition, themes[], legalNatures[]}` |
| Theme / LegalNature | `{id, schemeId, code, label, …, order}` |
| Annotation | `{id, projectSlug, documentId, annotatorId, status, globalCertainty, source, clauses[], createdAt, updatedAt}` |
| Clause | `{id, annotationId, anchorIndex, theme(code), legalNature(code\|null), evidenceSpan, rationale, certainty, order}` |
| PreAnnotation | `{id, projectSlug, documentId, judge, schemaVersion, mapped, importedAt, clauses:[{anchorIndex, themeCode, evidenceSpan, rationale}]}` |
| AnnotationVersion | `{id, annotationId, number, label, authorId, createdAt, snapshot}` |
| Comment | `{id, annotationId, clauseId, sentenceIndex, authorId, body, threadRoot, resolved, createdAt}` |
| Review | `{id, annotationId, reviewerId, score, decision, rubric, body, createdAt}` |
| TranslationSet | `{id, corpusSlug, name, targetLanguage, folderPath, mappingStrategy, status, mappedDocuments, createdAt}` |
| ActivityEvent | `{id, actorId, actorName, verb, targetType, targetId, payload, createdAt}` |

**Écriture (payloads entrants)** : la création de clause accepte `anchorIndex` +
`theme`(code) + `legalNature`(code) ; commentaires `clause`/`sentenceIndex`/`threadRoot` ;
TranslationSet `corpus`(slug)/`targetLanguage`/`folderPath`/`mappingStrategy`.

> **Filtres `?project=&document=&annotator=`** sur `/annotations` : gérés
> manuellement dans `get_queryset` pour accepter **à la fois** une PK numérique et
> la clé humaine du frontend (slug projet, `external_id` document, username) — le
> `DjangoFilterBackend` ne valide plus ces champs comme des PK.

Garantie de visualisation : `tests/test_api_contract_shapes.py` authentifie via
JWT et vérifie, pour chaque endpoint GET clé, que les **clés JSON correspondent
exactement** aux types frontend (y compris des champs imbriqués :
`annotation.clauses[0].anchorIndex/evidenceSpan`,
`document.referenceLabels[0].sentenceIndex`, etc.).

**Tests existants migrés snake→camel** (le camelCase est désormais le format de
fil contractuel) : `test_import_api.py` (`schemaVersion`, `clauses[].anchorIndex`),
`test_permissions.py` / `test_invariants.py` (écriture clause `anchorIndex`/`theme`,
clé d'erreur `theme`), `test_security_m9.py` (TranslationSet `corpus`/`targetLanguage`/
`folderPath`/`mappingStrategy`).

## 10. Compatibilité Django 6

Les `CheckConstraint` des modèles utilisent l'argument `condition=` (et non
l'ancien `check=`, déprécié `RemovedInDjango60Warning`). Concernés :
`annotations.Annotation` (certitude globale), `annotations.Clause` (certitude),
`collaboration.Review` (score 1..5). Le changement est purement cosmétique sur
l'API de contrainte : `check`/`condition` se *déconstruisent* à l'identique, donc
**aucune migration nouvelle** n'est générée (`makemigrations --check --dry-run`
→ *No changes detected*). La suite pytest tourne **sans aucun warning de
dépréciation** lié à `CheckConstraint`.
