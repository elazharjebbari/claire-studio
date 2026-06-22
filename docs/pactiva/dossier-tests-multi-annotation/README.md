# Dossier de tests — validation multi-annotation (avant campagne)

Dossier de qualification (niveau agence senior) pour **valider** que Pactiva est prêt
à l'annotation en équipe : **zéro perte de données**, **sessions étanches**, **aucune
corruption par la collaboration**, **analytics exacts**, sur tout le cycle de campagne.

## Sommaire
- [`00-strategy.md`](00-strategy.md) — stratégie, pyramide, comment on atteint des centaines/milliers de cas.
- [`01-invariants.md`](01-invariants.md) — invariants d'intégrité qui ne doivent JAMAIS casser (+ où c'est garanti + test).
- [`02-scenarios.csv`](02-scenarios.csv) — matrice de scénarios (setup → annotation → collab → soumission → IAA → export → clôture + cas agressifs/chaos), tracés vers les tests.
- [`06-plan-action.md`](06-plan-action.md) — suites livrées, couverture, critères GO/NO‑GO, gestion des échecs.
- [`07-runbook.md`](07-runbook.md) — commandes exactes, interprétation, reporting, CI.

## Résultats (état actuel — GO)
| Suite | Volume | Statut |
|---|---|---|
| Backend (invariants + simulation + property + export + reste) | **158 tests** (dont ≈1700 ops simulées + 700 ex. property) | ✅ |
| Frontend (`vitest`) | **208 tests** | ✅ |
| Typecheck `tsc` | — | ✅ |
| E2E Playwright (multi‑utilisateur, anti‑doublon) | 4 specs | écrits (à exécuter sur navigateur) |

**Fichiers de tests clés** : `backend/tests/{test_multi_annotation_battery,test_campaign_simulation,test_export_async}.py`,
`frontend/tests/{multiSessionStore,documentList,uiuxWorkspace}.test.*`, `frontend/e2e/{multi-annotation,no-duplicate-documents}.spec.ts`.

> Verdict : **GO campagne** — tous les invariants couverts et verts. La batterie est
> intégrée au gate de déploiement (`deploy/deploy-claire.sh`) : un invariant cassé
> bloque toute mise en prod.
