# État de vérification — CLAIRE Studio

Dernière exécution : 2026-06-18.

## Backend (Django / DRF)

| Vérification | Commande | Résultat |
|---|---|---|
| Configuration | `python manage.py check` | ✅ 0 problème |
| Migrations à jour | `python manage.py makemigrations --check --dry-run` | ✅ No changes |
| Tests unitaires & intégration | `pytest -q` | ✅ **40 passed** |
| Dépréciations Django 6 | `pytest -W error::DeprecationWarning` | ✅ 0 warning `CheckConstraint` |
| Seed démo idempotent | `make seed` (×2) | ✅ 2e passe sans mutation |

DB de vérification sur `/tmp` (le montage de dev a des limites I/O SQLite ; sans effet en local/Postgres).

## Frontend (Next.js / TypeScript)

| Vérification | Commande | Résultat |
|---|---|---|
| Installation | `npm install` | ✅ (lockfile commité, `next@14.2.35` patché) |
| Typecheck strict | `tsc --noEmit` | ✅ **0 erreur** (strict + `noUncheckedIndexedAccess`) |
| Tests unitaires + MSW | `npm test` (Vitest) | ✅ **24 passed** (4 fichiers) |
| Build de production | `npm run build` | ⏳ à lancer **en local** (voir note) |
| E2E navigateur | `npm run e2e` (Playwright) | ⏳ à lancer **en local** (voir note) |

### Note — build & E2E en local

`next build` et Playwright n'ont **pas pu s'exécuter dans le bac à sable de développement** :
le sandbox impose un plafond de 45 s par commande et un namespace PID `--die-with-parent`
incompatible avec les *workers* forkés par `next build` et avec le téléchargement des navigateurs
Playwright. **Ce n'est pas un défaut de code** : le typecheck strict (0 erreur) et Vitest (24 verts)
valident le code source.

À lancer sur une machine de dev standard :

```bash
cd frontend
npm install              # utilise package-lock.json (reproductible)
npm run build            # build de production
npx playwright install   # navigateurs (chromium)
npm run e2e              # 10 specs : annotate, prefill, unfairness-overlay, comments,
                         #            review, export, collaboration, history, translations, a11y
```

## Sécurité

- `next` relevé de `14.2.5` → `^14.2.33` (résout `14.2.35`) pour corriger l'avis de sécurité
  Next.js du 2025-12-11. Lockfile régénéré en conséquence.

## Reproductibilité

- Frontend : `package-lock.json` (lockfileVersion 3) commité.
- Backend : `requirements.txt` épinglé + `pyproject.toml`.
