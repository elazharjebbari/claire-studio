# Plan d'exécution — Annotation avancée (Features A & B + dette autosave)

> Découpage en **lots séquencés** (L0 → L6), à exécuter après validation de la
> conception (`02-feature-A-*`, `03-feature-B-*`) et du plan de tests (`06-plan-tests/`).
> Chaque lot : **objectif**, **fichiers touchés**, **dépendances**, **Definition of Done
> (DoD)**, **estimation (jours-homme, j-h)**. Les jalons sont repris dans `jalons.csv`,
> la procédure opérationnelle dans `runbook.md`.

## Principes de séquencement

1. **La dette d'abord (L0).** Le durcissement autosave (no-retry 401/403) ferme un bug
   de production observé et **sécurise** tous les lots suivants qui écrivent des clauses
   (B). On ne construit pas B sur un autosave qui peut tempêter.
2. **Le pur avant le branché.** On livre `lib/blocks.ts` et `applyBlockOp` (testables
   isolément, L1) **avant** de câbler les gestes UI (L2) — la logique est verrouillée par
   des tests vitest rapides avant toute intégration React.
3. **A indépendant de B.** La réglette A (L3/L4) ne dépend ni de `blocks.ts` ni de
   `applyBlockOp` (lecture seule) : elle pourrait être parallélisée, mais on la séquence
   après B pour lisser la charge revue/QA et éviter deux gros chantiers UI simultanés.
4. **Qualité transverse en fin (L5).** a11y, perf et e2e consolident l'ensemble une fois
   les surfaces stabilisées.
5. **Déploiement piloté (L6).** Un seul passage par `deploy/deploy-claire.sh` (gate de
   tests + health 200 + rollback auto).

Total estimé : **~17,5 j-h** (hors aléas), détaillé par lot ci-dessous.

---

## L0 — Durcissement autosave + tests de régression

**Objectif.** Stopper les réessais sur erreurs **terminales** (401/403) ; introduire un
état `saveState` terminal explicite (« non autorisé / session expirée ») distinct de
l'`error` réessayable ; conserver le réessai sur **transitoire** (500/réseau), le
débounce (1200 ms), l'idempotence (`clientOpId`) et la reprise `online`. Verrouiller la
**non-régression du bug 403** côté backend.

**Fichiers touchés.**
- `frontend/src/components/workspace/useAutosave.ts` — dans le `catch` : si
  `ApiError.status ∈ {401,403}` ⇒ état terminal + **ne pas** planifier la convergence
  (`setTimeout`) ; sinon comportement actuel.
- `frontend/src/store/autosave.ts` — étendre `SaveState`
  (`…|"unauthorized"`) + action/marqueur dédié.
- `frontend/src/lib/api/client.ts` — vérifier que `ApiError.status` est exploitable
  (déjà le cas) ; pas de changement attendu.
- `frontend/tests/autosave.test.ts` (+ nouveau test d'intégration réseau, ex.
  `frontend/tests/autosaveNetwork.test.tsx`) — TC-38/39/40/41.
- `backend/tests/test_permissions.py` — verrouiller TC-35/36/37 (owner 200/204 ; tiers
  403/404) si non déjà couverts par `test_correctifs.py`.

**Dépendances.** Aucune (point de départ). S'appuie sur `ApiError` et la
`SaveState` existants.

**DoD.**
- TC-38 (0 réessai après 403) et TC-39 (état terminal sur 401) **verts**.
- TC-40 (réessai sur 500) et TC-41 (idempotence) **verts**.
- Bug 403 : TC-35/36/37 **verts** côté pytest.
- Indicateur UI : un état/visuel « session expirée » est exposé via le store (testé
  unitairement) — l'intégration visuelle fine peut suivre, mais l'état doit exister.
- Suites existantes (`autosave`, `workspaceStore` R1, permissions) **100 % vertes** ;
  `tsc --noEmit` vert.

**Estimation. 1,5 j-h** (logique fine + tests réseau MSW avec faux timers).

---

## L1 — `lib/blocks.ts` + store `applyBlockOp` (+ tests)

**Objectif.** Livrer la **dérivation pure** des blocs (`deriveBlocks`, `blockAt`,
optionnellement `segmentsFromRuns` mutualisable avec A) et la **primitive de lot**
`applyBlockOp` (un seul snapshot undo, une entrée `actionLog` `block.*`), couvrant
annotateRange / extend / shrink / clearBlock, la collision §3.3 et les bornes, no-op en
`readOnly`. **Aucune** modification du contrat API, **aucune** migration.

**Fichiers touchés.**
- `frontend/src/lib/blocks.ts` — **nouveau** : `deriveBlocks(runs)`, `blockAt(blocks,i)`
  (algorithme spec §1.2), types `Block`.
- `frontend/src/lib/runs.ts` — (optionnel) helper pur `segmentsFromRuns(runs)` partagé
  avec A (sinon livré en L3).
- `frontend/src/store/workspace.ts` — **nouveau** : action `applyBlockOp(op)` qui
  `pushUndo` **une** fois, mute le tableau localement, `set()` **une** fois, append **un**
  `actionLog` `block.*` ; gardes `if (s.readOnly) return {}` et bornes `nSentences`.
- `frontend/tests/blocks.test.ts` — **nouveau** : TC-01..05, 14, 15, 43, 44 (bench).
- `frontend/tests/workspaceStore.test.ts` — **étendu** : TC-06..13, 17, 18 (applyBlockOp,
  undo de lot, équivalence B-IAA-1, readOnly).

**Dépendances.** L0 (sécurité de persistance pour les lots) ; réutilise `computeRuns`
(C4, `{perSentence:true}`) et l'infrastructure undo/redo existante (`pushUndo`,
`undoStack`, `UNDO_DEPTH=200`).

**DoD.**
- `deriveBlocks`/`blockAt` : TC-01..05, 14, 15, 43 **verts** ; couverture `blocks.ts`
  ≥ 95 % (lignes+branches).
- `applyBlockOp` : TC-06..13, 18 **verts** ; 100 % des branches (4 kinds + collision +
  bornes + readOnly) ; **un seul** snapshot undo prouvé (TC-07) ; **une** entrée
  `actionLog` (TC-08).
- Équivalence bloc↔phrases (TC-17) **verte** (innocuité IAA, B-IAA-1).
- Bench perf (TC-44) **vert** (< 5 ms/frappe sur 300 phrases).
- `tsc --noEmit` vert ; aucune dépendance ajoutée au contrat/serializers.

**Estimation. 2,5 j-h.**

---

## L2 — Gestes B dans `DocumentPanel` / `SelectionToolbar` / `SentenceMenu`

**Objectif.** Câbler la **table d'interactions** `B-interactions.md` (S1–S17, K1–K13) :
clic = phrase, glisser/Maj-clic = plage, double-clic = sélectionner le bloc + poignées,
clic-droit = override, toggle même thème = retrait, fusion automatique (par re-dérivation),
désannotation de bloc, undo/redo. Tout geste **multi-phrases** passe par `applyBlockOp`.

**Fichiers touchés.**
- `frontend/src/components/workspace/DocumentPanel.tsx` — gestion du glisser
  (press-move-release), double-clic (sélection de bloc via `blockAt`), clic-droit
  (override), rendu des **poignées** de bloc, raccourcis clavier K1–K13.
- `frontend/src/components/workspace/SelectionToolbar.tsx` — en mode bloc : « Annoter les
  blocs » et « Désannoter le bloc » via `applyBlockOp` (remplace la boucle `setBoundary`
  par phrase) ; priorité mode bloc si `selectedClauseIds` non vide.
- `frontend/src/components/workspace/SentenceMenu.tsx` — override (re-thème d'une phrase
  interne) et « Retirer » via `setBoundary`/`removeBoundary` (inchangé, par phrase).
- `frontend/src/store/workspace.ts` — (au besoin) helper de sélection
  `clauseRangeBetween` déjà présent (`lib/runs.ts`) ; pas de nouvelle action attendue
  au-delà de L1.
- `frontend/e2e/block-annotation.spec.ts` — **nouveau** : TC-30..34.

**Dépendances.** L1 (`deriveBlocks`, `blockAt`, `applyBlockOp`).

**DoD.**
- Gestes S1–S17 et K1–K13 opérationnels ; tout geste multi-phrases ⇒ **un** undo
  (vérifié e2e TC-32, TC-34).
- Override → split **visible** (TC-31) ; pose de plage → bloc continu (TC-30) ;
  désannotation de bloc (TC-33) ; fusion automatique observable.
- `readOnly` : ouverture de menu autorisée mais mutations no-op (R1) — non-régression des
  tests store `readOnly`.
- e2e `block-annotation.spec.ts` **vert** ; suites unitaires inchangées vertes ; `tsc`
  vert.

**Estimation. 3,5 j-h** (chantier UI + e2e, interactions souris/clavier nombreuses).

---

## L3 — Réglette A : `ModelBoundaryRail` (structure + données + toggles)

**Objectif.** Livrer le composant **réglette multi-pistes** (1 piste/modèle alignée aux
phrases), togglable global (`showBoundaries`) + par modèle (`gutterModels`), marqueurs de
frontière ⟦◷⟧ au seul début de segment, clic = centrer la phrase, alignement mesuré
(`rowTops/rowHeights`). Données dérivées des `PreClause` LLM (mémos partagés), **sans**
nouvel endpoint.

**Fichiers touchés.**
- `frontend/src/components/workspace/ModelBoundaryRail.tsx` — **nouveau** : grille
  `role="grid"`, pistes `role="row"`, cellules de début focusables, `onJump=focusSentence`.
- `frontend/src/components/workspace/DocumentPanel.tsx` — montage du gutter à droite (3e
  enfant `flex` sticky), mesure `rowMetrics` via **un** `ResizeObserver`.
- `frontend/src/lib/runs.ts` — `segmentsFromRuns(runs)` (si non livré en L1).
- `frontend/src/store/workspace.ts` — `gutterModels: Record<string,boolean>`,
  `toggleGutterModel`, (+ persistance `localStorage` clé `pactiva.gutter.v1`).
- `frontend/tests/runs.test.ts` (segmentsFromRuns), `frontend/tests/workspaceStore.test.ts`
  (toggleGutterModel) — TC-19, 21 ; test composant `ModelBoundaryRail` (TC-23, 25).

**Dépendances.** Indépendant de L1/L2 (lecture seule). Réutilise `computeRuns` +
`judgeAnchors` + les mémos `claudeRuns`/`codexRuns` déjà calculés par `DocumentPanel`.

**DoD.**
- 2 pistes (Claude/Codex) alignées aux phrases ; marqueur au **seul** début de segment
  (TC-23) ; corps de segment = **un** nœud par segment (perf, comptage).
- Toggle global (gutter non monté si OFF) et par modèle (TC-21, TC-26 e2e) opérationnels ;
  préférences persistées.
- Clic = `focusSentence(startSentence)` (TC-28 e2e) ; piste sans données = désactivée
  (TC-25).
- `segmentsFromRuns` (TC-19) **vert** ; `tsc` vert ; aucun nouvel endpoint, aucun
  recompute LLM supplémentaire (mémos partagés).

**Estimation. 3 j-h.**

---

## L4 — Réglette A : catégorie + tooltips + extensibilité N modèles

**Objectif.** Couche optionnelle de **catégorie** (teinte + abréviation, AA), **tooltips**
au survol/focus (modèle + catégorie + plage), et **extensibilité** vérifiée (3e piste
Mistral via MSW), au-dessus de L3.

**Fichiers touchés.**
- `frontend/src/components/workspace/ModelBoundaryRail.tsx` — teinte `getThemeToken().color` +
  abréviation (`readableTextColor` pour l'AA) ; tooltip `role="tooltip"` (hover + focus).
- `frontend/src/lib/tokens.ts` — table d'abréviation `themeCode → abbr` (déterministe).
- `frontend/src/store/workspace.ts` — `gutterShowCategory: boolean` (défaut false),
  `toggleGutterCategory` (+ persistance).
- `frontend/src/mocks/fixtures.ts` / `handlers.ts` — `FIXTURE_PREANNOTATION_MISTRAL`
  (cf. `06-plan-tests/fixtures-msw.md` §1.1).
- `frontend/tests/tokens.test.ts` (abbr, TC-20), test composant (TC-24), e2e tooltip
  (TC-27), e2e Mistral (TC-29).

**Dépendances.** L3 (le composant doit exister).

**DoD.**
- Catégorie OFF par défaut ; ON ⇒ teinte + abréviation **AA** (TC-24) ; abréviation
  déterministe (TC-20).
- Tooltip < 150 ms, contenu modèle/catégorie/plage, ouvrable au **focus** clavier
  (TC-27).
- 3e piste Mistral via MSW **sans** modif de layout (TC-29) ; grille `repeat(N,…)`.
- `tsc` vert ; suites concernées vertes.

**Estimation. 2 j-h.**

---

## L5 — a11y + perf + e2e (consolidation)

**Objectif.** Verrouiller l'**accessibilité** (axe + clavier), la **performance**
(~300 phrases) et compléter les **parcours e2e** sur l'ensemble A + B stabilisé.

**Fichiers touchés.**
- `frontend/e2e/a11y.spec.ts` — étendu : réglette A (grid/roving/aria/contraste) et vue
  B (équivalents clavier, poignées focusables) — TC-45, TC-46.
- `frontend/e2e/model-gutter.spec.ts` — **nouveau** (si non couvert en L3/L4) : parcours
  réglette complets.
- `frontend/tests/blocks.test.ts` — bench perf consolidé (TC-44) ; assertion comptage de
  nœuds réglette (perf A).
- `frontend/src/mocks/fixtures.ts` — `FIXTURE_DOC_LARGE` (~300 phrases) + registre
  `DOCUMENTS_BY_ID` (cf. fixtures-msw §2).

**Dépendances.** L2, L3, L4 (surfaces complètes).

**DoD.**
- e2e axe : **0** violation critique/sérieuse sur réglette A et vue B (TC-45/46) ;
  parcours clavier complets verts.
- Perf : bench `deriveBlocks` < 5 ms/frappe (TC-44) ; réglette = ~(#segments·m) nœuds
  (assertion comptage).
- Tous les e2e A & B verts ; suite vitest 100 % verte ; `tsc` vert.

**Estimation. 2 j-h.**

---

## L6 — Déploiement (gate, prod, rollback)

**Objectif.** Mettre en production via `deploy/deploy-claire.sh` (gate `pytest` + `tsc` +
`vitest` → push → VPS pull/migrate/collectstatic/build → restart → health 200 → rollback
auto si != 200), puis **vérifier les parcours** en prod (pactiva.legal).

**Fichiers touchés.** Aucun code nouveau ; orchestration. (Pas de migration : A & B sans
schéma.)

**Dépendances.** L0–L5 (tout vert). Procédure détaillée dans `runbook.md`.

**DoD.**
- `deploy/deploy-claire.sh` exécuté ; **health 200** ; pas de rollback déclenché.
- Smoke prod : poser un bloc + override + undo (B) ; afficher la réglette, masquer un
  modèle, activer catégories, survol/clic (A) ; vérifier qu'un 401/403 simulé (session
  expirée) **n'entraîne pas** de tempête réseau (DevTools).
- Communication de fin de déploiement (cf. runbook §Communication).

**Estimation. 1 j-h** (déploiement + vérifications prod + comm).

---

## Synthèse des estimations

| Lot | Intitulé | j-h |
|-----|----------|----:|
| L0 | Durcissement autosave + régressions | 1,5 |
| L1 | `lib/blocks.ts` + `applyBlockOp` + tests | 2,5 |
| L2 | Gestes B (DocumentPanel/SelectionToolbar/SentenceMenu) | 3,5 |
| L3 | Réglette A — `ModelBoundaryRail` (structure/données/toggles) | 3,0 |
| L4 | Réglette A — catégorie/tooltips/N modèles | 2,0 |
| L5 | a11y + perf + e2e | 2,0 |
| L6 | Déploiement (gate, prod, rollback) | 1,0 |
| **Total** | | **15,5** |

> Marge recommandée +15 % (revue, allers-retours QA, aléas prod) ⇒ **~17,5 j-h**.
> Chemin critique : L0 → L1 → L2 (B) puis L3 → L4 (A) ; L5 dépend des deux ; L6 clôt.
