# CLAIRE Studio — Frontend

Atelier d’annotation de clauses juridiques (Next.js 14 App Router · TypeScript strict ·
Tailwind · React Query · Zustand). Thème **sombre anti-fatigue** par défaut, bascule clair/sombre
persistée. Source de vérité : `dossier/00_overview/CONTRACT.md`, `vocabulary.yaml`, `navigation.md`.

## Démarrage

```bash
cd annotation-studio/frontend
npm install
npm run dev            # http://localhost:3000 (MSW activé par défaut → app autonome sans backend)
```

Le frontend fonctionne **sans backend** : MSW (`NEXT_PUBLIC_ENABLE_MOCKS=true`) intercepte
`/api/v1/*` et sert les fixtures (document Fitbit ~31 phrases, pré-annotations claude/codex,
labels d’injustice CLAUDETTE). Pour brancher un vrai backend :

```bash
NEXT_PUBLIC_ENABLE_MOCKS=false NEXT_PUBLIC_API_BASE=https://api.exemple/api/v1 npm run dev
```

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm test` / `test:watch` | Vitest + MSW (unit) |
| `npm run e2e` | Playwright E2E |
| `npm run msw:init` | (Ré)génère `public/mockServiceWorker.js` |

> Avant le premier `npm run dev`/`e2e`, exécuter `npm run msw:init` une fois pour écrire le
> service worker MSW dans `public/`.

## Architecture

- `src/app/` — App Router. Groupe `(app)/` = chrome complet (sidebar + topbar + ⌘K) ;
  `/login` hors chrome.
- `src/components/shell/` — Sidebar, TopBar, CommandPalette, ActivityBell, AppShell.
- `src/components/workspace/` — ★ workspace 3 panneaux (cœur produit).
- `src/components/ui/` — primitives réutilisables (ClauseChip, ThemePalette, CertaintyPicker…).
- `src/lib/api/` — client fetch JWT typé + endpoints + hooks React Query.
- `src/lib/pivot.ts` — parsing/normalisation du format pivot clause (v9.2/v9.4 → pivot, CONTRACT §4).
- `src/store/` — Zustand : `ui` (thème/sidebar persistés), `workspace` (état d’édition).
- `src/mocks/` — handlers MSW + fixtures.
- `src/types/contract.ts` — types dérivés du CONTRACT (source de vérité).
- `design-tokens.json` — couleurs des thèmes/injustice/certitude (dérivées de `vocabulary.yaml`),
  importées par `tailwind.config.ts`.

Voir `dossier/05_frontend/` pour le détail (frontend.md, state_management.md, components.md,
testing_frontend.md).
