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
