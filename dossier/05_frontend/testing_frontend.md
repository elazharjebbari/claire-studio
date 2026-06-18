# Tests frontend

Trois niveaux, tous branchés sur les mocks MSW (mêmes fixtures que l’app).

## 1. Unit — Vitest + Testing Library + MSW (`tests/`)

- `setup.ts` : jest-dom, démarre le serveur MSW Node, `resetHandlers` + `resetDb` entre tests.
- `pivot.test.ts` : normalisation v9.2 / v9.4 / pivot natif, tri monotone, déduplication d’ancres,
  sérialisation `annotationToPivot`, segmentation `segmentByAnchors`. **Brique critique.**
- `workspaceStore.test.ts` : init, navigation focus bornée, pose de frontière (refus double ancre),
  certitude, seed pré-annotation sans écrasement, toggles overlays.
- `components.test.tsx` : `ClauseChip`, `ThemePalette` (filtrage + vocab fermé restreint),
  `CertaintyPicker` (radiogroup), `useUnfairnessIndex` (niveau le plus sévère par phrase).
- `versionDiff.test.ts` : `diffSnapshots` (ajout / suppression / modification par `anchor_index`,
  tri monotone, champs modifiés précis) et `buildVersionDiff` (résumé agrégé). **Brique critique** (F3).

```bash
npm test            # run unique
npm run test:watch  # mode watch
```

## 2. E2E — Playwright (`e2e/`)

`playwright.config.ts` lance `next dev` avec `NEXT_PUBLIC_ENABLE_MOCKS=true` (app autonome).

| Spec | Feature | État |
|---|---|---|
| `annotate.spec.ts` | F1 | **Complet** — 3 panneaux, frontière clic+clavier, palette thème, certitude, snapshot. |
| `prefill.spec.ts` | F2 | **Complet** — seed Claude + provenance + fantômes. |
| `unfairness-overlay.spec.ts` | F12 | **Complet** — toggle surlignage + info-bulle catégorie/niveau. |
| `comments.spec.ts` | F9 | **Complet** — post de commentaire + résolution de fil. |
| `review.spec.ts` | F10 | **Complet** — lecture doc + clauses, notation + décision (approve / request_changes). |
| `export.spec.ts` | F5 | **Complet** — export JSONL (artefact + manifeste) + itération multi-formats. |
| `collaboration.spec.ts` | F4 | **Complet** — cloche d’activité + tableau de bord IAA (global, frontières, κ par thème). |
| `history.spec.ts` | F3 | **Complet** — timeline + diff réel par défaut (v2→v3) et entre versions choisies (v1→v2). |
| `translations.spec.ts` | F8 | **Complet** — liste, déclaration d’un set, sync + mapping document↔fichier. |
| `a11y.spec.ts` | F6 | **Complet** — audit axe-core (WCAG 2 A & AA) sur l’accueil et le workspace. |

```bash
npm run msw:init    # une fois : génère public/mockServiceWorker.js
npm run e2e
```

## 3. Accessibilité

Contrats vérifiés dans les composants : rôles ARIA (listbox/radiogroup/dialog/separator/region),
`:focus-visible` global, navigation clavier complète, contraste AA (tokens sombres dédiés).
L’audit `axe` est **implémenté** en E2E (`@axe-core/playwright`, `e2e/a11y.spec.ts`) sur l’accueil
et le workspace ; il échoue sur toute violation sérieuse/critique (WCAG 2 A & AA). Le shell expose
un unique landmark `<main id="main-content">` (le panneau central du workspace est une `region`
labellisée « Document » pour éviter un second `main`).

## Note d’environnement

Les fixtures sont partagées entre MSW (navigateur), Vitest (Node) et Playwright, garantissant la
cohérence des données entre les niveaux de test et l’app.
