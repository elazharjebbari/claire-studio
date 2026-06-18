# RUNBOOK — CLAIRE Studio (de zéro à « tout fonctionne »)

> Runbook d'exécution end-to-end. Permet à quelqu'un qui clone le dépôt de **tout lancer de
> zéro** : setup, seed, dev (back :8000 + front :3000), tests (pytest, Vitest, Playwright),
> build prod, dépannage. Toutes les commandes passent par le `Makefile` racine et les scripts
> `scripts/*.sh` (cf. `seeding.md`, `operations.md`).
>
> **Contrat d'orchestration** : ce runbook suppose que `backend/` expose
> `make setup|migrate|seed|run|test` et que `frontend/` expose `pnpm install|dev|test|e2e|build`.
> Le `Makefile` racine ne fait que **déléguer** à ces sous-projets.

## 0. Prérequis

| Outil | Version min. | Vérifier |
|---|---|---|
| Docker + Docker Compose v2 | 24+ / v2 | `docker --version && docker compose version` |
| Python | 3.11+ | `python3 --version` |
| uv (gestion deps Python) | récent | `uv --version` |
| Node.js | 20 LTS | `node --version` |
| pnpm | 9+ | `pnpm --version` |
| Make, bash, git | — | `make --version` |

Deux modes au choix :
- **Mode Docker (recommandé pour démarrer)** : tout via `docker compose`, aucune install locale
  de Python/Node requise hors Docker.
- **Mode local (recommandé pour développer)** : Postgres en Docker, backend et frontend en local.

## 1. Cloner & configurer

```bash
git clone <repo> claire-studio && cd claire-studio/annotation-studio
cp .env.example .env            # renseigner les secrets (voir commentaires du fichier)
```

Variables minimales à vérifier dans `.env` : `DJANGO_SECRET_KEY`, `DATABASE_URL`,
`POSTGRES_*`, `JWT_*`, `DJANGO_CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_URL`.

## 2. Setup complet (une commande)

```bash
make setup
```

Effet : installe les dépendances backend (`backend/ make setup`, via uv) et frontend
(`frontend/ pnpm install`), prépare l'environnement Playwright (`pnpm exec playwright install`).

### Mode Docker équivalent

```bash
docker compose build
```

## 3. Base de données & migrations

```bash
# Mode local : démarrer uniquement Postgres
docker compose up -d postgres
make migrate                    # délègue à backend/ make migrate
```

## 4. Seed (données de démonstration déterministes)

```bash
make seed                       # ≡ scripts/seed_all.sh (cf. seeding.md)
```

Peuple : corpus `CLAUDETTE-ToS` (mini), `LabelScheme claire-themes-v1`, projet
`claudette-gold-v1`, utilisateurs `alice/bob` (annotator), `carol` (reviewer), `admin` (owner),
quelques pré-annotations `claude@v9.4` / `codex@v9.2`, et des `ReferenceLabel` d'injustice.
**Idempotent** : ré-exécutable sans effet de bord (cf. `seeding.md`).

## 5. Lancer en développement

### Mode local (deux terminaux ou `make dev`)

```bash
make dev                        # ≡ scripts/dev_up.sh : Postgres + backend :8000 + frontend :3000
```

- Backend (Django/DRF)  → http://localhost:8000  (API sous `/api/v1/`)
- Frontend (Next.js)    → http://localhost:3000
- Adminer (optionnel)   → http://localhost:8080  (`docker compose up -d adminer`)

Connexion : utilisez les comptes seedés (mot de passe par défaut documenté dans la sortie du
seed / `.env`).

### Mode Docker (toute la pile)

```bash
docker compose up
# postgres + backend + frontend (+ adminer), avec healthchecks
```

## 6. Lancer les tests

```bash
make test        # lint + pytest (backend) + vitest (frontend)  — rapide, pas de navigateur
make e2e         # Playwright contre la pile réelle (seed + back + front) via scripts/e2e.sh
make lint        # ruff + import-linter (back) ; eslint + prettier + tsc (front)
```

Granulaire :

```bash
cd backend  && make test                 # pytest seul
cd frontend && pnpm test                  # Vitest + MSW
cd frontend && pnpm test:coverage         # avec couverture (seuils coverage_goals.md)
cd frontend && pnpm e2e                    # Playwright seul (suppose back+front déjà up)
cd frontend && pnpm e2e:ui                 # mode interactif
```

## 7. Build production

```bash
make build       # backend (collectstatic + image) + frontend (next build + image)
```

Mode Docker :

```bash
docker compose -f docker-compose.yml build
```

Le frontend `pnpm build` produit le bundle Next.js optimisé ; le backend prépare l'image et les
fichiers statiques. Voir `operations.md` pour le déploiement et l'exploitation.

## 8. Nettoyage

```bash
make clean       # arrête les conteneurs, supprime caches/node_modules/.venv/artefacts de test
docker compose down -v   # + supprime le volume Postgres (RESET TOTAL des données)
```

## 9. Dépannage (FAQ)

| Symptôme | Cause probable | Remède |
|---|---|---|
| `make dev` : backend ne démarre pas, `connection refused` Postgres | Postgres pas prêt | attendre le healthcheck ; `docker compose up -d postgres` puis `make migrate` |
| `psql: FATAL: password authentication failed` | `.env` désynchronisé du volume | `docker compose down -v` puis recréer (perte de données) |
| Frontend : appels API en 404/CORS | `NEXT_PUBLIC_API_URL` ou CORS mal réglés | aligner `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` et `DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:3000` |
| `401` systématique sur l'app | JWT expiré / secret changé | re-login ; vérifier `JWT_SIGNING_KEY` stable |
| Vitest : `Unhandled request` | un appel réseau non mocké | ajouter le handler MSW (cf. `msw_strategy.md`) |
| Playwright : `net::ERR_CONNECTION_REFUSED` | back/front pas up | utiliser `make e2e` (orchestre la pile) plutôt que `pnpm e2e` seul |
| Playwright : timeouts sur seed vide | seed non lancé sur la DB de test | `scripts/e2e.sh` re-seed ; vérifier `DATABASE_URL` de test |
| `pytest` : `relation does not exist` | migrations non appliquées | `make migrate` |
| Loader CLAUDETTE rejette tout | mismatch d'alignement `Sentences/`↔`Labels/` (Q-ROB-01, attendu) | corpus source mal aligné ; corriger la source, pas le loader |
| `make seed` deux fois change des lignes | seed non idempotent (bug, Q-ROB-02) | signaler ; le seed doit être no-op au 2e passage |
| Couverture sous le plancher en CI | régression | voir `coverage_goals.md`, ajouter des tests |

Logs & diagnostic : voir `operations.md §logs` (`docker compose logs -f backend`,
`request_id`/`trace_id` corrélés — Q-DEB-01).

## 10. Check-list de validation finale « tout fonctionne »

Cocher dans l'ordre :

- [ ] `cp .env.example .env` fait, secrets renseignés.
- [ ] `make setup` terminé sans erreur (deps back+front, Playwright installé).
- [ ] `docker compose up -d postgres` + `make migrate` OK (tables créées).
- [ ] `make seed` OK ; **relancé une 2e fois → 0 mutation** (idempotence, Q-ROB-02).
- [ ] `make dev` : http://localhost:8000/api/v1/ répond, http://localhost:3000 charge.
- [ ] Login avec `alice` → workspace `/annotate/...` accessible.
- [ ] Overlay injustice CLAUDETTE visible par défaut (F12).
- [ ] Pré-remplissage depuis Claude fonctionne, provenance tracée (F2).
- [ ] `make lint` vert (ruff/import-linter + eslint/prettier/tsc).
- [ ] `make test` vert (pytest + vitest), couverture ≥ planchers (`coverage_goals.md`).
- [ ] `make e2e` vert : **les 12 specs F1→F12 passent** (Q-FON-01).
- [ ] `make build` produit les artefacts/images sans erreur.
- [ ] CI GitHub Actions verte sur les jobs `lint`, `backend-test`, `frontend-test`, `e2e`,
      `build`.

Quand toutes les cases sont cochées : la plateforme est opérationnelle de bout en bout.
