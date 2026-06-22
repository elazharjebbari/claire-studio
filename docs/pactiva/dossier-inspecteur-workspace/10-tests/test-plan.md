# Plan de tests — Refonte workspace Pactiva

> Stratégie de vérification de la refonte (7 axes). Trois niveaux :
> **unitaire/composant** (Vitest + Testing Library + MSW), **e2e** (Playwright, mode mock sur `/annotate/ann-1`), **manuel/post-déploiement** (cf. `09-plan-action/runbook.md`).
> Conventions du dépôt : alias `@/` (`vitest.config.ts`), setup `tests/setup.ts`, store `useWorkspaceStore` réinitialisé par `reset()`, MSW dans `src/mocks/*`, fixtures Playwright sur la route mock `/annotate/ann-1`. Le mapping cas → axe est dans `test-cases.csv`.

---

## 1. Cadre et outillage

| Niveau | Outils | Emplacement | Lancement |
|--------|--------|-------------|-----------|
| Unitaire / composant | Vitest, `@testing-library/react`, `@testing-library/user-event`, MSW (`src/mocks/server.ts`) | `frontend/tests/*.test.{ts,tsx}` | `vitest run` (gate déploiement) |
| E2E | `@playwright/test`, `@axe-core/playwright` | `frontend/e2e/*.spec.ts` | `playwright test` (manuel pré-lot) |
| Manuel | navigateur prod | — | `runbook.md` §5 |

Principes : (a) **conserver tous les `data-testid` existants** (les e2e en dépendent) ; (b) tester d'abord la **logique pure** (lib/store) en Vitest, l'**intégration interactive** en Playwright ; (c) MSW pour les flux réseau (autosave, préannotations) ; (d) `vi.useFakeTimers()` pour les délais (hover ~300 ms, tooltips ~450 ms) comme dans `themePalette.test.tsx`.

---

## 2. Couverture par axe

### Axe 1 — Hover rationale (`RationaleHover`) — Lot A
- **Vitest (composant)** : rendu du popover passif — affiche thème + rationale humain ; troncature ~160 car. ; ligne par juge présent + evidence en italique ; `pointer-events-none` présent ; rien si aucune matière.
- **Vitest (logique d'ouverture)** : garde « matière » (rationale humain non vide OU ≥1 detail LLM) ; ouverture après ~300 ms (fake timers), fermeture après le tampon ~120 ms.
- **Playwright** : survol prolongé d'une phrase annotée → `rationale-hover` visible ; clic / clic-droit (`sentence-menu`) restent opérants pendant le hover (le popover n'intercepte pas le pointeur) ; survol d'une phrase nue → pas de popover.
- **MSW** : non requis (données déjà en store/fixtures).

### Axe 2 — Nature juridique (`NaturePicker`) — Lot A (UI) / Lot C (LLM)
- **Vitest (composant)** : 6 pastilles rendues ; `value`/`onChange` (sélection → callback avec le code) ; toggle ARIA radiogroup ; tooltip `describeOnHover` après ~450 ms avec label + définition ; pas de tooltip sans `describeOnHover` (parité `ThemePalette`).
- **Vitest (token)** : `legalNatureToken(code)` renvoie une couleur stable par code et un fallback neutre pour code inconnu.
- **Vitest (intégration inspecteur)** : sélection dans `NaturePicker` → `updateDraft(localId,{legalNature})` sur le store.
- **Lot C (Vitest)** : `JudgeDetail.legalNature` propagé ; comparateur affiche `—` quand absent, la nature du juge quand présente.

### Axe 3 — Inspecteur — Lot B
- **Vitest (composant)** : `ThemePalette` rendue en `layout="grid"` + `describeOnHover` ; bouton Valider présent et bascule `validated` (store) ; comparateur `InspectorJudgeCompare` itère sur les juges présents (onglet Mistral si données) ; `CommentCard` affiche compteur + composer inline.
- **Playwright** : ouverture inspecteur → grille de thèmes + tooltip ; clic Valider → état validé reflété ; onglets de juges présents ; commentaire visible sans scroll.

### Axe 4 — Toolbar + Sélection — Lot B
- **Vitest (lib `runs.ts`)** : `prevBoundaryFrom(starts, from)` symétrique de `nextBoundaryFrom` (bornes, début/fin de document).
- **Vitest (store)** : `selectMany(indices)` — sélection (potentiellement non contiguë), clamp `[0, n-1]`, dédoublonnage.
- **Vitest (composant `SelectionToolGroup`)** : rendu **uniquement** si `selectedSentences.length>0` ; `selection-count` ; actions câblées (`select-segment`, `select-extend-next`, `select-reduce`, `select-theme`, `select-clear`).
- **Playwright** : Shift+clic → `SelectionToolGroup` + compteur ; « Tout le thème courant » étend la sélection ; « Vider » remet à zéro ; Versions/Insights/Tour sous « Plus ». Préservation des testid (`document-controls`, `boundary-toggle`, etc.).

### Axe 5 — Minimap — Lot B
- **Vitest (composant `DocumentMinimap`)** : N bandes rendues ; couleur par thème (`sentenceColors`) ; ticks frontières ; cadre viewport positionné depuis `{scrollTop,scrollHeight,clientHeight}` ; clic sur bande → `onJump(index)`.
- **Vitest (store `ui.ts`)** : `showMinimap` + `toggleMinimap` persistés (pattern `readingWide`).
- **Playwright** : minimap visible ; clic = saut + focus ; toggle dans Overlays montre/masque et persiste après reload ; **non-régression** : toolbar sticky + `scrollIntoView` au focus toujours OK après remontée du conteneur de scroll.

### Axe 6 — Gutter segments continus — Lot A
- **Vitest (composant `ModelBoundaryRail`)** : cellules d'un run jointives (pas de `gap-px`/arrondi interne), arrondis seulement aux extrémités ; teinte de thème appliquée **toggle OFF** ; séparateur de rupture présent à un changement de thème, absent en continuité ; `gutter-conflict-*`/`gutter-boundary-*` conservés ; liseré conflit sur les colonnes des modèles divergents (`conflictModelIds`).
- **Vitest (lib)** : helper `isEnd`/segments via `segmentsFromRuns` cohérent (un run = un bloc de thème contigu).
- **Playwright** : toggle « Catégories » change l'intensité/étiquette sans faire disparaître la teinte ; cliquer une zone conflit → `onJump`.

### Axe 7 — Compare N-way + sticky — Lot A
- **Vitest (lib `llmAgreement.ts`)** : `agreementNway(byIndexList, n)` —
  - 3 juges tous d'accord → `fullAgreementPct=100`, `fleissKappa≈1`, `support` = phrases couvertes ;
  - divergence totale → `fleissKappa≤0` ;
  - couverture partielle → `support` exclut les phrases non couvertes ;
  - cas dégénérés (n=1, tout `null`, support 0) gérés sans crash.
- **Vitest (`agreementSegments`)** : non-régression du comportement N-way existant (déjà couvert par `compareNway.test.ts`).
- **Playwright** : comparer Claude + Mistral → banner liste les bons modèles + score ; au scroll, banner + `divergence-nav` restent visibles (sticky d'un seul tenant) ; `divergence-prev`/`divergence-next` naviguent.

---

## 3. Données de test (MSW / fixtures)

- **MSW** (`src/mocks/handlers.ts`, `fixtures.ts`) : étendre les fixtures de préannotations pour exposer **≥ 3 juges** (claude/codex/mistral) avec des `themeCode` divergents sur certains index (alimente compare N-way et gutter conflits) et des `rationale`/`evidenceSpan` non vides (alimente le hover). Pour le Lot C, ajouter `legalNature` à des `PreClause` mockées.
- **Store** : initialisation via `useWorkspaceStore.getState().init({ annotationId, nSentences, clauses })` puis `reset()` en `beforeEach` (pattern `selectionToolbar.test.tsx`/`workspaceStore.test.ts`).
- **Playwright** : la route mock `/annotate/ann-1` (déjà utilisée par `document-ux.spec.ts`) doit fournir un document ≥ 5 phrases avec ≥ 2 juges présents dont Mistral, et au moins une phrase portant un rationale humain.

---

## 4. Critères de sortie (definition of done par lot)

- **Lot A** : `tsc --noEmit` + `vitest run` verts ; e2e `document-ux.spec.ts`, `llm-compare.spec.ts`, `a11y.spec.ts` verts ; tous les `data-testid` historiques répondent ; vérifs `runbook.md` §5 Lot A OK.
- **Lot B** : idem + non-régression scroll (toolbar/`ComparePanel` sticky, `scrollIntoView`) prouvée en e2e ; bench perf minimap sur 139+ phrases sans jank.
- **Lot C** : `pytest` backend vert (loader jointure + serializer) ; taux de match jointure acceptable ; non-régression chaîne humaine `legalNature`.

---

## 5. Risques de test connus

- **Timers** : hover (~300 ms) et tooltips (~450 ms) testés avec `vi.useFakeTimers()`/`act()` ; ne pas mélanger fake timers et `await` réseau dans un même cas.
- **`agreementSegments` vit dans `ComparePanel.tsx`** (importé par `compareNway.test.ts`). Si `agreementNway` doit réutiliser cette logique, préférer l'extraire vers `lib/` pour éviter d'importer un composant dans un test de lib (sinon dupliquer la logique de support dans `lib/llmAgreement.ts`).
- **`conflictStartByIndex` est une `Map`** : l'adaptation `Set` (`new Set(map.keys())`) doit être testée côté minimap/gutter pour éviter un faux négatif.
- **Playwright hover** : utiliser `page.hover()` + attente du délai d'ouverture ; vérifier l'absence d'interception en chaînant un `click` immédiatement après pour prouver `pointer-events-none`.
