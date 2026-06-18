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
| `comments.spec.ts` | F9 | Post de commentaire écrit ; résolution `fixme`. |
| `review.spec.ts` | F10 | Notation + décision écrit ; historique `fixme`. |
| `export.spec.ts` | F5 | Export JSONL écrit ; autres formats `fixme`. |
| `collaboration.spec.ts` | F4 | Cloche d’activité écrit ; IAA `fixme`. |
| `history.spec.ts` | F3 | Timeline écrite ; diff `fixme`. |

```bash
npm run msw:init    # une fois : génère public/mockServiceWorker.js
npm run e2e
```

## 3. Accessibilité

Contrats vérifiés dans les composants : rôles ARIA (listbox/radiogroup/dialog/separator),
`:focus-visible` global, navigation clavier complète, contraste AA (tokens sombres dédiés).
Un audit `axe` peut être ajouté en E2E (`@axe-core/playwright`) sur le workspace et l’accueil.

## Note d’environnement

Les fixtures sont partagées entre MSW (navigateur), Vitest (Node) et Playwright, garantissant la
cohérence des données entre les niveaux de test et l’app.
