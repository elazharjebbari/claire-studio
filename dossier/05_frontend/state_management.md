# Gestion de l'état

Deux familles d’état, volontairement séparées.

## 1. État serveur — React Query

Tout ce qui vient de l’API (`/api/v1/*`) est géré par React Query (`src/lib/api/hooks.ts`).
Clés de cache centralisées dans `qk`. Les mutations (`useAddClause`, `usePatchAnnotation`,
`useAddComment`, `useAddReview`, `useCreateVersion`…) invalident la requête concernée pour
re-fetch. `staleTime` 30 s, `refetchOnWindowFocus` désactivé (workspace de travail prolongé).

## 2. État UI global — Zustand `store/ui`

Persisté (localStorage `claire.ui`) : `theme` (dark/light), `sidebarCollapsed`,
`currentProjectSlug`, `density`. Non persisté : `commandPaletteOpen`.
La classe de thème est appliquée sur `<html>` par `providers.tsx` (`useApplyTheme`).

## 3. État d'édition du workspace — Zustand `store/workspace`

Cœur de l’interaction temps réel (non persisté, réinitialisé à la sortie). Contient :

- `focusedSentence`, `selectedClauseId` ;
- `draftClauses: DraftClause[]` — brouillon local des clauses (ancre, thème, nature, certitude,
  evidence, rationale, provenance) ;
- `ghostClauses` — frontières LLM non retenues, affichées en fantôme (F2) ;
- overlays : `showUnfairness`, `showGhostClaude`, `showGhostCodex`, `showTranslation` ;
- `dirty` — modifications non snapshotées.

Actions clés : `init` (depuis l’annotation serveur), `moveFocus`/`focusSentence` (j/k),
`setBoundary` (clic / B, refuse une 2e ancre sur la même phrase), `setCertainty` (0–3),
`seedFromPreAnnotation` (F2 : ajoute les clauses LLM sans écraser les ancres humaines existantes),
`toggle*` (overlays). Sélecteur `selectSelectedDraft` pour l’inspecteur.

Ce store est **testable isolément** (`tests/workspaceStore.test.ts`) sans rendu React, ce qui
sécurise la logique d’annotation indépendamment de l’UI.

## 4. Flux d'une frappe « B » (poser une frontière)

1. `useWorkspaceShortcuts` capte `b` (hors champ de saisie) → `store.setBoundary(focused)`.
2. Le store ajoute un `DraftClause`, le sélectionne, passe `dirty=true`.
3. `DocumentPanel` et `TocPanel` rerendent (souscription au store).
4. La persistance serveur se fait via `useAddClause`/`usePatchClause` (déclenchable au snapshot ⌘S
   ou à la soumission), gardant le brouillon réactif et le réseau découplé.
