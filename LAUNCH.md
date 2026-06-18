# Lancer CLAIRE Studio (données réelles)

Visualiser et annoter les vraies données : corpus **CLAUDETTE** (50 ToS) + pré-annotations
**Claude/Codex** + labels d'injustice + traductions FR.

## Option A — une commande

```bash
bash scripts/run_real.sh                # 12 documents (défaut)
bash scripts/run_real.sh --all          # les 50 documents
bash scripts/run_real.sh --max-docs 6   # 6 documents
```

Puis ouvrir **http://localhost:3000** et se connecter : **alice / claire-demo**
(comptes : `admin`, `alice`, `bob` annotateurs, `rita` reviewer — tous mdp `claire-demo`).

## Option B — deux terminaux (plus lisible)

**Terminal 1 — backend (API + données) :**
```bash
cd backend
make setup          # 1re fois : installe les dépendances Python
make feed           # migrate + charge les vraies données (idempotent ; relançable)
make run            # API sur http://localhost:8000
```
Variante volume : `python manage.py feed_db --all` (50 docs) ou `--max-docs N`.

**Terminal 2 — frontend (UI) :**
```bash
cd frontend
cp .env.local.example .env.local   # 1re fois : active le MODE DONNÉES RÉELLES
npm install                        # 1re fois
npm run dev                        # UI sur http://localhost:3000
```

## Ce que tu peux faire dans l'app

- **Projets** → `CLAUDETTE Gold v1` : avancement + accord inter-annotateurs (κ par thème).
- **Documents** : chaque ToS, avec surlignage des clauses injustes CLAUDETTE (overlay F12).
- **Workspace d'annotation** (`/annotate/...`) : annoter au clavier, pré-remplir depuis
  Claude/Codex, fantômes de comparaison, certitude, commentaires.
- **Historique/diff**, **revue/notation**, **export** (JSONL/CSV + manifeste), **traductions** (FR).

## Modes

| Mode | Réglage | Usage |
|---|---|---|
| **Données réelles** | `.env.local` : `NEXT_PUBLIC_ENABLE_MOCKS=false` + `NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1` | utilisation normale (backend requis) |
| **Démo / mock** | `NEXT_PUBLIC_ENABLE_MOCKS=true` | UI autonome sans backend (MSW) |

## Données & rechargement

- Corpus, pré-annotations et traductions sont sous `claire-studio/data/`.
- `make feed` (ou `feed_db`) est **idempotent** (upsert) : relançable sans doublon.
- `python manage.py feed_db --reset` vide les tables de données avant de recharger.

## Vérifications

- Backend : `cd backend && make test` (pytest — 62 tests, dont formes d'API ↔ contrat frontend).
- Frontend : `cd frontend && npm test` (Vitest+MSW) puis `npm run e2e` (Playwright, 26 tests).
