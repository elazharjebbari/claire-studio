# Stratégie de tests — Annotation avancée (Features A & B + dette autosave)

> Document **niveau agence**, à valider avant exécution (`07-plan-action-runbook/`).
> Il définit la **pyramide de tests**, le **périmètre par feature**, les **critères
> de sortie**, la **non-régression** (bug 403, autosave no-retry 401/403), la **perf**
> (~300 phrases) et l'**accessibilité**. Les cas détaillés sont dans `cas-de-tests.csv`,
> les fixtures/handlers dans `fixtures-msw.md`.

## 0. Principes directeurs

1. **La donnée est par phrase, le bloc est dérivé.** On teste donc la **dérivation**
   (`lib/blocks.ts`) et l'**équivalence** « bloc == suite de phrases » (invariant
   B-IAA-1), jamais un objet `Block` persistant — il n'en existe aucun (cf.
   `03-feature-B-.../B-specification.md` §1, §7).
2. **A est une couche de visualisation pure** (lecture seule des `PreClause` LLM) :
   pas de mutation, pas de nouvel endpoint, pas de migration. Les tests A portent sur
   le **rendu**, les **toggles**, l'**alignement** et l'**a11y** (cf. `A-specification.md`).
3. **Tester au plus bas niveau possible.** Toute logique extractible (runs, blocs,
   plan de synchro, mapping run→segment) est testée en **vitest pur**, sans React ni
   réseau, à l'image de `frontend/tests/runs.test.ts` et `autosave.test.ts` existants.
4. **Réutiliser l'existant.** MSW (`frontend/src/mocks/handlers.ts`), fixtures
   (`fixtures.ts`), helpers de tests (`frontend/tests/setup.ts`) sont étendus, pas
   réécrits. Les nouveaux tests suivent le style FR des suites en place.

## 1. Pyramide de tests

```
            ╱╲          e2e Playwright (frontend/e2e/*.spec.ts)
           ╱  ╲         parcours critiques A & B, a11y axe   ── peu, lents, haute valeur
          ╱────╲
         ╱      ╲       Intégration MSW + vitest (composant + handlers)
        ╱        ╲      DocumentPanel/SelectionToolbar/ModelBoundaryRail + autosave réseau
       ╱──────────╲
      ╱            ╲    Unitaire vitest (lib/* purs, store Zustand)  ── nombreux, rapides
     ╱──────────────╲
    ╱                ╲  Backend pytest (DRF) — permissions, IAA par phrase (non-régression)
   ╱──────────────────╲
```

### 1.1 Unitaire — vitest (logique pure + store)
- **Cible** : `lib/runs.ts` (déjà couvert ; on étend `segmentsFromRuns` pour A),
  `lib/blocks.ts` (**nouveau** : `deriveBlocks`, `blockAt`), `store/workspace.ts`
  (**nouveau** : `applyBlockOp` + intégration undo/redo), `lib/autosave.ts`
  (déjà couvert ; inchangé), `lib/tokens.ts` (abréviation `themeCode → abbr` pour A).
- **Localisation** : `frontend/tests/*.test.ts(x)`.
- **Commande** : `cd frontend && node_modules/.bin/vitest run` (ou `npm test`).
- **Caractéristiques** : déterministe, sans MSW, < 50 ms/test. C'est le **socle** :
  on prouve ici la sémantique split/merge/extend, l'atomicité d'undo d'un lot, et
  l'équivalence bloc↔phrases.

### 1.2 Intégration — MSW + vitest (composant) / réseau
- **Cible** : comportements qui traversent React + le client API mais **sans
  navigateur réel** : autosave réseau (la routine `useAutosave` + handlers MSW qui
  renvoient 401/403/500), rendu de `ModelBoundaryRail` (marqueurs au seul début de segment,
  toggle catégorie), `SelectionToolbar` en mode bloc (déclenche `applyBlockOp`).
- **Localisation** : `frontend/tests/*.test.tsx`, mocks via `frontend/src/mocks/server.ts`.
- **Caractéristiques** : valide les **contrats API** (forme des payloads `clauses`,
  codes d'erreur) et l'orchestration store↔réseau. C'est le niveau qui **prouve le
  durcissement autosave** (arrêt des réessais sur 401/403).

### 1.3 e2e — Playwright (parcours utilisateur)
- **Cible** : parcours de bout en bout dans le navigateur, MSW activé
  (`frontend/src/mocks/browser.ts`) : poser un bloc à la souris (glisser → thème),
  override d'une phrase (split visible), undo unique, afficher la réglette A, masquer
  un modèle, activer Catégories, survol tooltip, clic = phrase centrée.
- **Localisation** : `frontend/e2e/*.spec.ts` (existant : `annotate.spec.ts`,
  `llm-compare.spec.ts`, `a11y.spec.ts`…). On ajoute `block-annotation.spec.ts` et
  `model-gutter.spec.ts` ; on étend `a11y.spec.ts`.
- **Commande** : `cd frontend && node_modules/.bin/playwright test` (ou `npm run e2e`).
- **Caractéristiques** : peu nombreux (coût/lenteur), réservés aux **parcours
  critiques** et aux vérifications **a11y avec axe** (`@axe-core/playwright`).

### 1.4 Backend — pytest (DRF)
- **Cible** : **non-régression** du bug 403 (propriétaire PATCH/DELETE sa clause →
  200/204 ; tiers, admin inclus → 403/404) et **innocuité IAA** (le vecteur reste par
  phrase quel que soit le découpage en blocs côté front — A & B n'écrivent que des
  `Clause(anchor_sentence, theme)`).
- **Localisation** : `backend/tests/test_permissions.py`, `test_iaa.py`,
  `test_correctifs.py` (existants ; on ajoute des cas, pas de nouveau fichier sauf
  besoin).
- **Commande** : `cd backend && .venv/bin/python -m pytest -p no:warnings -q`.

## 2. Périmètre par feature

### 2.1 Feature A — Réglette multi-pistes (frontières par modèle)
| Aspect | Niveau | Ce qui est prouvé |
|--------|--------|-------------------|
| `segmentsFromRuns(runs)` (helper pur) | unit | run `theme!=null` → segment `{startSentence,endSentence,themeCode}` ; runs neutres ignorés |
| Marqueur ⟦◷⟧ au **seul** début de segment | intégration (composant) | une frontière = `run.start===i` ; corps de segment = teinte continue, pas de marqueur |
| Toggle global (`showBoundaries`) | unit (store) + e2e | OFF ⇒ gutter non monté |
| Toggle par modèle (`gutterModels[id]`) | unit (store) + e2e | masquer un modèle retire sa piste ; recomposition largeur |
| Toggle catégorie (`gutterShowCategory`) | unit (store) + intégration + e2e | OFF par défaut ; ON ⇒ teinte + abréviation, contraste AA |
| Tooltip (modèle, catégorie, plage) | intégration + e2e | contenu « Claude — <label> — phrases i–j » ; ouvrable au focus clavier |
| Clic = centrer la phrase | intégration + e2e | `focusSentence(startSentence)` appelé ; phrase focalisée |
| N modèles (Mistral simulé) | intégration + e2e | 3e piste via MSW, **aucune** modif de layout |
| Abréviation `themeCode → abbr` | unit | `MODIFICATION_OF_TERMS → MOD` (table déterministe) |
| Piste sans données = désactivée | intégration | `hasData=false` ⇒ piste grisée `aria-disabled`, pas supprimée |
| a11y (forme+couleur, clavier, SR) | e2e (axe) | grille `role=grid`, roving tabindex, `aria-label` complet |

### 2.2 Feature B — Annotation bloc/phrase (hybride dérivé)
| Aspect | Niveau | Ce qui est prouvé |
|--------|--------|-------------------|
| `deriveBlocks(runs)` | unit | contiguïté stricte (trou neutre = 2 blocs) ; homogénéité (changement de thème coupe) ; `size`, `localIds` corrects |
| `blockAt(blocks, i)` | unit | index → bloc couvrant ; hors bloc → `undefined` |
| `applyBlockOp(annotateRange)` | unit (store) | plage `[i..j]` → `j-i+1` clauses ; **un seul** snapshot undo ; 1 entrée `actionLog` `block.*` |
| `applyBlockOp(extend)` + collision | unit (store) | étend au thème du bloc ; cible d'un autre thème écrasée (politique §3.3) ; borné à `nSentences-1` |
| `applyBlockOp(shrink)` | unit (store) | phrases de queue → neutres ; autres blocs intacts |
| `applyBlockOp(clearBlock)` | unit (store) | bloc effacé ; voisins inchangés ; un undo |
| Override → split | unit (store) + e2e | `setBoundary(k, t')` interne → 3 blocs dérivés ; **1** clause modifiée |
| Merge automatique | unit | combler le trou / ramener au thème ⇒ `deriveBlocks` rend **un** bloc, zéro écriture propre |
| Toggle off (phrase / bloc) | unit (store) + e2e | même thème = retire (C3) ; bloc = lot `clearBlock` |
| Undo/redo d'un lot | unit (store) + e2e | un geste plage/extend/clear = **une** annulation |
| Équivalence bloc↔phrases (B-IAA-1) | unit (store) | « plage de 5 via bloc » == « 5 clics phrase » (même `draftClauses` à `localId` près, même vecteur thème) |
| `readOnly` neutralise les lots | unit (store) | `applyBlockOp` no-op si `readOnly` (R1) |

### 2.3 Dette transverse — Autosave terminal 401/403
| Aspect | Niveau | Ce qui est prouvé |
|--------|--------|-------------------|
| Arrêt des réessais sur 401/403 | intégration (réseau MSW) | après un 401/403, **aucune** nouvelle requête clause n'est émise (pas de tempête) |
| État UI terminal | unit (store) + intégration | `saveState` passe à un état terminal explicite (ex. `unauthorized`) ≠ `error` réessayable |
| Erreur transitoire reste réessayée | intégration | 500 ⇒ planification d'un nouvel essai (comportement actuel conservé) |
| Reprise online inchangée | intégration | `offline` + event `online` ⇒ une synchro reprise |

## 3. Critères de sortie (Definition of Done qualité)

Le lot est « testé » quand **tous** les points ci-dessous sont verts :

- **Couverture ciblée** : `lib/blocks.ts` ≥ 95 % (lignes + branches) ;
  `applyBlockOp` 100 % des branches (annotateRange/extend/shrink/clearBlock + readOnly +
  collision + bornes) ; helper A `segmentsFromRuns`/abréviation 100 %.
- **Aucune régression** : la suite vitest existante (`runs`, `workspaceStore`,
  `autosave`, `blockSelect`, `divergence`, `tokens`…) reste **100 % verte** ; pytest
  backend **100 % vert** (dont permissions + IAA).
- **Bug 403** : test de non-régression présent et vert (propriétaire 200/204 ; tiers
  403/404).
- **Autosave no-retry** : test d'intégration prouvant **0 réessai** après 401/403,
  vert.
- **Perf** : bench `deriveBlocks` + dérivation sur 300 phrases **< 5 ms/frappe** (hors
  peinture), assertion automatisée (cf. §5).
- **a11y** : e2e axe **sans violation critique/sérieuse** sur la réglette A et sur la
  vue d'annotation B ; parcours clavier complet vert.
- **Type-check** : `tsc --noEmit` vert (porte du déploiement, cf. `deploy-claire.sh`).
- **Gate CI/déploiement** : `deploy/deploy-claire.sh` (gate `pytest` + `tsc` + `vitest`)
  passe localement avant tout `push`.

## 4. Non-régression (focus)

### 4.1 Bug 403 — permission propriétaire (déjà corrigé, à verrouiller)
- **Origine** : `IsAnnotationOwner.has_object_permission` testait `annotator_id` sur la
  **Clause** (qui ne l'a pas) → 403 pour le propriétaire (cf. `00-audit/bug-403-clauses.md`).
- **Garde-fou test** (backend) : pour une `Clause` appartenant à l'annotation du
  propriétaire — `PATCH /api/v1/clauses/{id}` → **200**, `DELETE` → **204** ; pour un
  tiers (y compris `admin`/`reviewer`) → **403** ou **404**. Couvre l'objet **Clause**
  ET **Annotation** (remontée au propriétaire via `obj.annotation.annotator_id`).
- **Garde-fou front** : `isMine` **sûr par défaut** (lecture seule tant que `me`/
  annotation non confirmés) — couvert par les tests `readOnly` du store
  (`workspaceStore.test.ts`, suite « lecture seule (R1) »), à conserver verts.

### 4.2 Autosave — pas de réessai sur erreurs terminales (401/403)
- **Symptôme observé** : tempête réseau (~1 req/1,3 s) car la routine `useAutosave`
  passe en `error` puis **re-planifie une convergence** tant que le plan n'est pas
  vide ; un 401/403 ne vide jamais le plan ⇒ boucle infinie.
- **Contrat attendu après durcissement** :
  - une op refusée par **401/403** (`ApiError.status`) est **terminale** : on **stoppe**
    (pas de `setTimeout` de convergence), on passe `saveState` à un état terminal
    explicite (ex. `unauthorized`) affichant « non autorisé / session expirée » ;
  - une **500/erreur réseau** reste **transitoire** : convergence/débounce inchangés ;
  - **idempotence** préservée : un `clientOpId` déjà créé ne duplique pas au retour.
- **Vérification** : test d'intégration MSW comptant les requêtes `clauses` émises
  après un premier 401/403 ⇒ **0**.

### 4.3 IAA par phrase — innocuité de A & B
- A & B n'introduisent **aucune** écriture span/bloc : le backend ne reçoit que des
  `Clause(anchor_sentence, theme)`. `projects/iaa.py::_theme_vector` reste par phrase.
- **Garde-fou test** : (back) κ inchangé pour un même état stocké ; (front, unit)
  équivalence « bloc == phrases » sur `draftClauses` ⇒ même vecteur thème (B-IAA-1).

## 5. Performance (~300 phrases)

Cible : document **≤ 300 phrases**, 2–3 modèles, interactions fluides (60 fps perçu).

- **Bench unitaire `deriveBlocks`** : générer `drafts` de 300 phrases (mélange de blocs
  et de phrases isolées), mesurer `computeRuns(perSentence)` + `deriveBlocks` sur K
  itérations ; **assertion** : moyenne **< 5 ms/itération** (budget spec §8). Implémenté
  en vitest avec `performance.now()` ; tolérance machine via seuil large mais borné.
- **Pose de plage = un seul rendu/snapshot** : test store prouvant que `applyBlockOp`
  sur 300 ancres fait **un** `set()` (un seul incrément d'undo, pas 300) — garantit
  B-PERF-2.
- **Réglette A** : test composant prouvant que le corps d'un segment est **un** nœud
  (pas une cellule par phrase) ⇒ ~(#segments·m) nœuds, pas n·m (spec §6). Vérification
  par comptage de nœuds rendus pour un document à segments connus.
- **e2e (smoke perf)** : sur un document large (fixture ~300 phrases, cf.
  `fixtures-msw.md`), poser une plage et vérifier l'absence de gel (timeout d'action
  Playwright par défaut respecté).

## 6. Accessibilité (axe + clavier)

- **Outils** : `@axe-core/playwright` (déjà présent) dans `frontend/e2e/a11y.spec.ts`
  étendu ; vérifications clavier scriptées (Tab/flèches/Entrée/Échap).
- **Réglette A** : `role="grid"`, pistes `role="row"`, cellules de début focusables
  (roving tabindex) ; Entrée/Espace = centrer ; ↑/↓ = segment ±1 même piste ; ←/→ =
  changer de piste ; Échap ferme le tooltip ; `aria-label` complet par cellule et
  en-tête ; **forme + couleur** (jamais couleur seule) ; contraste ≥ 4.5:1 via
  `readableTextColor`; `prefers-reduced-motion` respecté ; cibles ≥ 24×24 px.
- **Annotation B** : tous les gestes souris ont un équivalent clavier (table
  `B-interactions.md` K1–K13) ; poignées de bloc focusables ; distinction bloc/phrase
  non uniquement chromatique (forme + contour) pour le daltonisme.
- **Critère** : **zéro** violation axe critique/sérieuse ; parcours clavier complet
  sans piège.

## 7. Matrice niveau × feature (synthèse)

| | Unitaire vitest | Intégration MSW | e2e Playwright | Backend pytest |
|---|:---:|:---:|:---:|:---:|
| **A** réglette | ✅ helpers/abbr/store toggles | ✅ rendu/tooltip/Mistral | ✅ parcours + axe | — (lecture seule) |
| **B** bloc/phrase | ✅ blocks/applyBlockOp/équiv. | ✅ toolbar mode bloc | ✅ glisser/override/undo | ✅ IAA par phrase |
| **Régression 403** | ✅ readOnly store | — | — | ✅ owner 200/204, tiers 403/404 |
| **Autosave 401/403** | ✅ état terminal | ✅ 0 réessai | (smoke) | — |
| **Perf 300** | ✅ bench deriveBlocks | ✅ comptage nœuds | (smoke) | — |
| **a11y** | — | ✅ contraste/aria | ✅ axe + clavier | — |
