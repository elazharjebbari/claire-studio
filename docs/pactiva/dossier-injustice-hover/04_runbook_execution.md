# Runbook d'exécution — InjusticeLens

> Pilotage de la mise en œuvre de `03_dossier_technique.md`. Frontend only.

## Étapes (ordre)
| # | Action | Vérif |
|---|---|---|
| 1 | `src/lib/unfairnessMeta.ts` (meta 8 cat + sévérité + lexique) | `tests/unfairnessMeta.test.ts` vert |
| 2 | `src/lib/highlightEvidence.ts` (segments + repères) | `tests/highlightEvidence.test.ts` vert |
| 3 | Refactor `useUnfairness` → `useUnfairnessMarks` (toutes marques, tri ↓) | `tests/useUnfairness.test.ts` + non-régression overlay |
| 4 | `InjusticeLens.tsx` (aperçu tooltip + fiche dialog) | `tests/injusticeLens.test.tsx` |
| 5 | Intégration `DocumentPanel` (déclencheur marque + état + rendu + priorité hover) | tsc |
| 6 | Fixtures/MSW multi-catégories | — |
| 7 | e2e `injustice-lens.spec.ts` + adapter `unfairness-overlay.spec.ts` | e2e vert |
| 8 | Gate : `tsc --noEmit` + `vitest run` + e2e ciblés | tout vert |
| 9 | Revue adversariale (a11y, charte/hex, honnêteté du repère, non-régression) | findings corrigés |
| 10 | Commit (chemins explicites) + `deploy/deploy-claire.sh` + healthcheck | prod=local, health 200 |

## Critères d'acceptation
- Survol d'une marque → aperçu (sévérité max + catégories) ; clic/clavier → fiche complète
  (cartes triées, badges glyphe+libellé+jauge, sens, thèmes, évidence surlignée + repère
  étiqueté, rappel pédagogique).
- Multi-catégories listées ; overlay OFF → pas de loupe ; Échap/clic-extérieur ferment.
- Zéro hex en dur ; couleur toujours doublée glyphe+libellé ; `prefers-reduced-motion` ok.
- Suites vertes (vitest, tsc, e2e) ; gate de déploiement vert.

## Rollback
Feature additive (lecture seule, frontend) ; rollback = revert du commit (le gate +
healthcheck du script de déploiement gèrent l'échec automatiquement).
