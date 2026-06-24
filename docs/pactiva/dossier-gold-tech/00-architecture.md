# Architecture

## Backend (Django REST)
- Nouvelle app `claire/gold/` : modèles, scoring (orchestration), lock, WS, serializers, views.
- Moteur PUR `claire/projects/gold_scoring.py` (à côté d'iaa.py/concordance.py) — sans Django, testable en pur + property-based. (Phase 1.)
- Réutilise : `iaa._theme_vector` (humain EXACT) / `_theme_set_vector` (multi-label), `concordance` (vecteurs LLM forward-fill), `triage/rules.py` (clusters/precedence/reliability), `ExportJob`, `ProjectMembership`, WS de présence.

## Frontend (Next.js App Router + Zustand + React Query)
- Routes `/(app)/projects/[slug]/gold/(page|stats)` et `/gold/[documentId]`.
- Miroir PUR `frontend/src/lib/goldScoring.ts` (parité exacte avec le backend, golden partagé).
- `goldStore` (bus d'interaction : sélection + survol bidirectionnels) ; couche prefs **par document**.
- Réutilise : `ResizablePanels`, panneaux, `divergence.ts`, `blocks.ts`, `QuickActionRail`, `useAnchoredPosition`, `concordance.ts`, store `prefs`.

## Data
- `GoldSentence` matérialisé (1 par phrase) recalculé à chaque (re)soumission d'annotation du doc, snapshot `GoldRun` par lot (audit), via l'infra ExportJob async (thread daemon, EXPORTS_RUN_INLINE en test).
