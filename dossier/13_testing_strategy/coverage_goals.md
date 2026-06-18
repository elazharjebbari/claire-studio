# Objectifs de couverture & garde-fous CI

> La couverture n'est pas une fin en soi : on couvre **prioritairement les briques critiques**
> (loaders, invariants, IAA, permissions, pivot, exports) à un seuil élevé, et on reste
> raisonnable ailleurs. Seuils **bloquants en CI** : un PR qui descend sous le plancher échoue.

## 1. Backend (pytest + pytest-cov)

Mesure : `coverage` ligne+branche sur `backend/src` (ou `backend/<apps>`). Rapport
`coverage.xml` (Cobertura) publié en CI.

| Module / domaine | Plancher couverture | Justification |
|---|---|---|
| `imports` (loaders CLAUDETTE, pivot v9.2/v9.4) | 95 % | Q-ROB-01, Q-MOD-01 — cœur de fiabilité des données |
| `annotations` (invariants, versioning, certitude) | 95 % | Q-ROB-03, Q-FIA-01 — invariants durs |
| `iaa` (Cohen/Fleiss/WindowDiff) | 100 % | Q-FIA-02 — valeurs exactes à 1e-6 |
| `security` (authz, PII, pathsafety) | 95 % | Q-SEC-01/02/03 |
| `exports` (formats, manifest, scope, anonymize) | 90 % | Q-EVO-03, Q-SEC-04 |
| `audit` (ActivityEvent) | 90 % | Q-FIA-03 |
| `translations` (sync, idempotence) | 90 % | Q-ROB-02, Q-SEC-03 |
| `corpora`, `schemes`, `projects`, `collaboration` | 85 % | logique métier standard |
| **Global backend** | **≥ 85 %** | plancher CI bloquant |

Garde-fous additionnels (non-couverture) :
- `import-linter` : 0 dépendance circulaire entre apps (Q-MOD-02), bloquant.
- `assertNumQueries` : pas de régression N+1 sur les vues critiques (Q-OPT-01).
- `ruff` lint+format : 0 erreur, largeur 100 (cf. CLAUDE.md).

## 2. Frontend (Vitest + @vitest/coverage-v8)

Mesure : `c8`/v8 sur `frontend/src` (hors `*.config.*`, `*.stories.*`, `test/`, `fixtures/`,
`mocks`).

| Zone | Plancher | Justification |
|---|---|---|
| `stores/` (Zustand) | 90 % | logique d'état critique (brouillon, rollback) |
| `lib/`, `hooks/` (data, mappers pivot) | 90 % | transformation des données du contrat |
| `components/` cœur annotation (ClauseEditor, Workspace, Overlay) | 85 % | F1/F2/F12 |
| `components/` autres | 75 % | UI secondaire |
| **Global frontend** | **≥ 80 %** | plancher CI bloquant |

Garde-fous :
- `eslint` + `prettier --check` + `tsc --noEmit` : 0 erreur, bloquant.
- `vitest-axe` : 0 violation critique sur surfaces clés (Q-A11Y-01).
- MSW `onUnhandledRequest: 'error'` : aucun appel réseau non mocké.

Config Vitest (extrait, contrat d'orchestration) :

```ts
// vitest.config.ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov', 'cobertura'],
    thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
  },
}
```

## 3. E2E (Playwright)

Pas de seuil de couverture de lignes (test de bout en bout), mais **seuil fonctionnel
bloquant** : les **12 specs F1→F12 doivent passer** (Q-FON-01). Une feature sans E2E vert
bloque la release. Traces+screenshots+vidéo archivés en CI sur échec.

## 4. Application des garde-fous en CI

- `backend-test` : `pytest --cov --cov-fail-under=85` → échec si < 85 %.
- `frontend-test` : `vitest run --coverage` avec `thresholds` → échec si sous le plancher.
- `e2e` : `playwright test` → échec si une spec rouge.
- Les rapports (coverage backend/front, rapport Playwright HTML) sont uploadés comme artefacts
  du run pour revue.

## 5. Évolution des seuils

Politique « cliquet » : les planchers ne baissent jamais. Quand un module dépasse durablement
son plancher de +5 pts, on relève le plancher au prochain cycle. Toute exception
(dérogation temporaire) est documentée dans le PR avec une issue de remédiation.
