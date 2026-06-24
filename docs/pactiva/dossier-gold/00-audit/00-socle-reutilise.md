# Socle réutilisé (anti-duplication)

**Backend** : `iaa.py` (cohen_kappa, `_theme_vector` EXACT per-sentence, `_theme_set_vector`
multi-label, project_iaa, per_theme, boundary kappa, alpha_masi), `concordance.py`
(humain↔LLM & LLM↔LLM, intersection, best_match), `ExportJob` (async, scope JSON, 6 writers,
self-heal/retry/download gated), `ProjectMembership` (annotator/reviewer/lead), `Project.locked`,
`Annotation`/`Clause`/`ClauseTheme`(role/support)/boundary/triage_level, `PreAnnotation`/`PreClause`,
moteur de triage PUR golden-testé (`triage/rules.py`, parité TS/PY), WS de présence
(`collaboration/consumers.py`).

**Frontend** : `ResizablePanels`, `TocPanel`/`DocumentPanel`/`InspectorPanel`, `divergence.ts`
(segments/anchors/next/prev/ordinal), `runs.ts`/`blocks.ts` (deriveBlocks/coalesceRuns),
`concordance.ts`, `QuickActionRail` (validate-advance sous le curseur), `useAnchoredPosition`
(flip/clamp viewport), store `prefs` par compte (sync /me, namespacé), modale de progression,
tokens de design (zéro hex).

**Règle DRY** : le module GOLD *paramètre* ces briques (vecteurs, moteur, export) au lieu de les
réécrire. Ce qu'on crée : app `claire/gold/` (modèles + scoring + lock + WS), routes
`/projects/[slug]/gold[...]`, composants de résolution, couche prefs **par document**.
