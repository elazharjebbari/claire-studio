# Dossier — Refonte du workspace d'annotation (Pactiva)

Dossier d'ingénierie senior pour la refonte UI/UX du workspace d'annotation
(`/annotate/[id]`) : inspecteur, barre d'outils, gutter des catégories, mode
comparer, hover, minimap, nature juridique. Issu d'un **audit UI/UX multi-agents**
des 7 axes (constats + options comparatives + recommandation vérifiée par axe).

## Structure
| Dossier | Contenu |
|---|---|
| `00-audit/` | Synthèse d'audit + `audit-uiux.json` (7 axes structurés) |
| `01-besoins/` | Besoins (8 axes en exigences vérifiables) |
| `02-architecture/` | Architecture des composants impactés / nouveaux |
| `03-inspecteur/` | Refonte inspecteur + chaîne data `legal_nature` LLM |
| `04-toolbar/` | Refonte barre d'outils + section Sélections multiples |
| `05-gutter/` | Gutter en segments continus |
| `06-compare/` | Mode comparer N-way + barre divergences sticky |
| `07-minimap-hover/` | Minimap de position + hover rationale |
| `08-design-system/` | Tokens, cohérence des contrôles, a11y |
| `09-plan-action/` | Plan d'action (lots A/B/C) + runbook |
| `10-tests/` | Stratégie de tests + cas (`test-cases.csv`) |

## Statut d'implémentation — TOUT LIVRÉ EN PROD (https://pactiva.legal)
| Axe | Livrable | Commit |
|---|---|---|
| 1 — Hover rationale | `RationaleHover` (popover passif) | `f3024b5` |
| 2 — Nature juridique | `NaturePicker` (humain) + consultation LLM (Lot C) | `f3024b5` / `ac365d2` |
| 3 — Inspecteur | en-tête Valider + badge nature, thèmes grille+hover, commentaires visibles | `b26686d` |
| 4 — Barre d'outils | `SelectionTools` (sélections multiples + compteur) | `b26686d` |
| 5 — Minimap | `DocumentMinimap` + `useScrollViewport` (robuste) | `b26686d` |
| 6 — Gutter | segments continus + ruptures nettes | `f3024b5` |
| 7 — Comparer | bandeau N-way dynamique + divergences sticky | `f3024b5` |
| 8 — Mistral | session3 importée (22 → 47 docs) | (prod, données) |
| Lot C | chaîne `legal_nature` LLM (loader → PreClause → UI) + ré-import 3 juges | `ac365d2` |

**Qualité** : pytest 128/128 · vitest 202/202 · `tsc` vert ; déploiement avec
rollback automatique armé (`deploy/deploy-claire.sh`).
