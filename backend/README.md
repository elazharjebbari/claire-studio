# CLAIRE Studio — Backend

Django 5 + Django REST Framework + JWT (SimpleJWT). DB-centrique (SQLite en dev,
Postgres-ready via `DATABASE_URL`). Source de vérité : `../dossier/00_overview/CONTRACT.md`.

## Démarrage

```bash
cd annotation-studio/backend
cp .env.example .env            # ajuster DJANGO_SECRET_KEY
make setup                      # pip install -r requirements.txt
make seed                       # migrate + seed_demo (idempotent)
make run                        # http://localhost:8000
```

- API : `http://localhost:8000/api/v1/`
- Docs OpenAPI (Swagger) : `http://localhost:8000/api/docs`
- Schéma : `http://localhost:8000/api/schema`
- Admin Django : `http://localhost:8000/admin/`

Comptes de démo (mot de passe `claire-demo`) : `admin` (owner), `alice`/`bob` (annotateurs),
`rita` (reviewer).

## Commandes Make

| Cible | Effet |
|---|---|
| `make setup` | installe les dépendances |
| `make makemigrations` / `make migrate` | migrations |
| `make seed` | migrate + `seed_demo` |
| `make run` | serveur de dev sur :8000 |
| `make test` | pytest |
| `make lint` | ruff |
| `make check` | `manage.py check` |
| `make openapi` | écrit `openapi.yaml` |

## Données

Le seeder utilise les données réelles si présentes :
- CLAUDETTE : `../../data/raw/claudette_tos/` (Sentences + Labels_<CAT>)
- Pré-annotations : `../../annotations/v9_4_session1_claude/` et `v9_4_session2_codex/`

Chemins surchargés par env (`CLAIRE_CLAUDETTE_DIR`, `CLAIRE_ANNOTATIONS_DIR`). À défaut,
des **fixtures de secours** dans `fixtures/` (2 documents + pré-annotations) prennent le relais.

## Structure

Une app Django par domaine sous `claire/` : `accounts`, `corpora`, `schemes`, `projects`,
`annotations`, `collaboration`, `imports`, `translations`, `exports`, `audit`, `common`.
Détails : `../dossier/04_backend/backend.md`.

## Tests

`pytest` (settings `config.settings.test`, SQLite en mémoire). Un test par invariant dur
(CONTRACT §2), plus loaders v9.2/v9.4, export, IAA (κ), versioning, permissions, import API.

## Configuration

Variables d'environnement (voir `.env.example`) : `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`,
`DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`.
Aucun secret n'est codé en dur.
