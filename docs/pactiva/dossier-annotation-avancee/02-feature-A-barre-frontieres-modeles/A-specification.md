# Feature A — Réglette multi-pistes verticale (frontières par modèle)

> Spécification détaillée. Décision **arrêtée** (voir `A-choix.md`) : une **piste fine
> par modèle** (Claude, Codex, demain Mistral…), alignée verticalement aux phrases du
> document, dans un **gutter à droite** de la colonne de lecture. Togglable globalement
> ET par modèle ; marqueurs de frontière ⟦◷ début de segment⟧ + teinte/abréviation de
> catégorie optionnelles ; tooltip au survol ; clic = centrer la phrase. Extensible à N
> modèles, accessible AA et sûr daltonisme (forme **+** couleur).

---

## 0. Pourquoi (rappel du constat, audit §3)

Aujourd'hui, pour comparer « qui coupe où », l'annotateur doit **basculer la source** du
document (`LlmSourceSwitch` : human → claude → codex) une à une. Il n'y a **aucune vue
simultanée** des frontières de tous les modèles. La réglette répond à ce manque sans
toucher au modèle de données ni au backend (audit §6 : A = pure couche de visualisation).

La donnée existe déjà : `DocumentPanel.tsx` calcule `claudeRuns` / `codexRuns` via
`computeRuns(judgeAnchors(llm.claudePre?.clauses), n)` (forward-fill). La réglette
**réutilise ces mêmes runs** — c'est une projection visuelle, pas une nouvelle source.

---

## 1. Objectifs (mappés aux besoins A1–A8)

| Besoin | Objectif concret de la réglette |
|--------|---------------------------------|
| **A1** | Afficher **simultanément** 1 piste/modèle, alignée aux phrases (même grille verticale que la colonne de lecture). |
| **A2** | Toggle **global** (réutilise `showBoundaries`) **et** toggle **par modèle** (nouvel état `gutterModels`). |
| **A3** | **Catégorie optionnelle** : teinte de segment + abréviation 2–3 lettres, masquées par défaut (état `gutterShowCategory`). |
| **A4** | **Lecture immédiate** : marqueurs de frontière visibles d'un coup d'œil, alignés à la phrase de début de segment. |
| **A5** | **Non intrusif** : gutter compact (largeur totale ≈ 40–72 px), **n'empiète pas** sur la colonne `max-w-reading`. Repli propre < `xl`. |
| **A6** | **Interactif** : survol = tooltip (modèle, catégorie, plage de phrases) ; clic = `focusSentence(startSentence)` (centre la phrase). |
| **A7** | **Extensible** : `Judge` = `TextChoices` ; ajouter Mistral = **une piste de plus**, zéro refonte (voir §9). |
| **A8** | **Accessible** : contraste AA, navigable clavier (Tab/Entrée/flèches), **forme + couleur** (marqueur ⟦◷⟧ + abréviation), jamais couleur seule. |

**Non-objectifs (hors périmètre A)** : édition des frontières LLM (lecture seule), arbitrage
de divergence (déjà couvert par `BoundaryEvidence` / `resolveDivergence`), comparaison
chiffrée κ (déjà couverte par le mode `compare` et `ComparePanel`). La réglette **complète**
ces outils, elle ne les remplace pas.

---

## 2. Anatomie & vocabulaire

```
Colonne de lecture (max-w-reading)            Gutter réglette (à droite, sticky)
┌───────────────────────────────────┐        ┌──┬──┬──┐
│ 12  The provider may modify these… │        │◷ │  │◷ │   ← piste Claude | Codex | Mistral
│ 13  …terms at any time without …   │        │  │◷ │  │
│ 14  Users are responsible for …    │        │◷ │  │◷ │
└───────────────────────────────────┘        └──┴──┴──┘
                                               ▲ 1 colonne = 1 modèle
                                               ▲ 1 ligne   = 1 phrase (même hauteur)
```

- **Piste (track)** : colonne verticale d'un modèle. Largeur `track.width`. En-tête =
  initiale du modèle (`C`/`Cx`/`M`) avec `aria-label` complet.
- **Cellule (cell)** : intersection piste × phrase. Hauteur = hauteur de la ligne de phrase.
- **Marqueur de frontière (boundary marker)** : glyphe ⟦◷⟧ rendu sur la cellule **où
  commence un segment** (`run.start === sentenceIndex && run.theme != null`). C'est la
  **forme** porteuse d'information (a11y : indépendante de la couleur).
- **Teinte de segment (category fill)** : fond de cellule coloré par `getThemeToken(theme).color`,
  appliqué à **toutes** les cellules du segment (pas seulement le début) — **optionnel**.
- **Abréviation de catégorie** : 2–3 lettres dérivées du `themeCode` (ex. `MODIFICATION_OF_TERMS`
  → `MOD`), affichée sur la cellule de début quand la place le permet — **optionnel**.

---

## 3. Comportements détaillés (A1–A8)

### A1 — Affichage simultané, aligné aux phrases
- La réglette est rendue **dans le même conteneur de scroll** que la colonne de lecture,
  en `position: sticky` à droite (le gutter défile avec le document, ses cellules restent
  alignées car de **même hauteur** que `SentenceRow`).
- Alignement garanti par **mesure** : chaque `SentenceRow` expose déjà `data-sentence-index`.
  La réglette lit la hauteur réelle de chaque ligne via `ResizeObserver` (ou recalcule au
  resize) → tableau `rowTops[]` / `rowHeights[]`. La traduction FR sous une phrase
  (`perSentenceFr`) **augmente** la hauteur de la ligne ; la cellule de réglette s'aligne
  sur la **ligne entière** (phrase + sa traduction), pas seulement le texte VO.
- Source de vérité des segments : `runsByModel[model]` = `computeRuns(judgeAnchors(pre.clauses), n)`
  (forward-fill), **identique** à ce que `DocumentPanel` calcule déjà. Aucune divergence
  possible entre rail, popovers existants et réglette.

### A2 — Toggles (global + par modèle)
- **Global** : la réglette suit `showBoundaries` (case « Frontières » déjà présente dans
  `document-controls`). OFF ⇒ gutter masqué et **non monté** (zéro coût). C'est le toggle
  « maître » : il gouverne aussi les pointillés de frontière dans le texte (cohérence A4).
- **Par modèle** : nouvel état `gutterModels: Record<JudgeId, boolean>` dans le store.
  Un petit panneau de légende (en tête de gutter, repliable) liste les modèles avec une
  case par piste. Masquer un modèle **retire sa piste** ; la largeur du gutter se
  recompose (les pistes restantes se resserrent → A5).
- **Persistance** : `gutterModels`, `gutterShowCategory` persistés en `localStorage`
  (clé `pactiva.gutter.v1`), comme les autres préférences d'affichage. Pas serveur (pref UI).
- **Défauts** : global = ON (aligné sur `showBoundaries: true`) ; toutes les pistes
  disponibles = ON ; catégorie = **OFF** (A5, on ne surcharge pas par défaut).

### A3 — Catégorie optionnelle (teinte + abréviation)
- Toggle `gutterShowCategory` (case « Catégories » dans le panneau de légende du gutter).
- **OFF** (défaut) : cellules neutres (`track.neutralFill`) ; seuls les marqueurs ⟦◷⟧
  signalent les frontières → lecture « structure pure ».
- **ON** : chaque cellule de segment prend `getThemeToken(theme).color` à l'opacité
  `cell.categoryOpacity` ; la cellule de **début** porte l'abréviation (texte avec
  `readableTextColor()` pour garantir AA quelle que soit la teinte). La couleur est
  **redondante** avec le marqueur + l'abréviation (jamais seule → A8 daltonisme).
- Mistral et tout futur modèle réutilisent **le même** `getThemeToken` (schéma fermé
  partagé) → cohérence chromatique automatique avec le rail gauche et les badges.

### A4 — Lecture immédiate (« qui coupe où »)
- Le marqueur ⟦◷⟧ est rendu **uniquement** au début de segment → la densité visuelle = la
  densité de frontières. Comparer deux pistes = comparer deux colonnes de glyphes alignées.
- Quand deux modèles coupent **à la même phrase**, leurs marqueurs sont sur la **même
  ligne** → accord visuel immédiat. Quand ils divergent, le décalage vertical saute aux
  yeux (objectif central du besoin).
- Option « lignes de frontière » (héritée de `showBoundaries`) : un filet horizontal très
  léger traverse le gutter à chaque frontière **de la piste survolée**, pour rattacher le
  marqueur à sa phrase sans bruit permanent.

### A5 — Non intrusif (compacité)
- Largeur d'une piste : `track.width` (24 px) + `track.gap` (4 px). 2 modèles ≈ 52 px,
  3 ≈ 80 px — négligeable à droite d'une colonne `max-w-reading` (~70ch).
- Le gutter vit **hors** de `max-w-reading` (dans le `flex` parent, à droite), donc il
  **ne réduit jamais** la largeur de lecture. Sous `xl`, la réglette se replie en
  **mini-déclencheur** (bouton « pistes ») ou se masque (cf. wireframes, état mobile) :
  la lecture prime.
- Aucune ombre lourde, pas de bordure pleine : séparateur 1 px `track.borderColor` à
  faible opacité.

### A6 — Interactivité (survol + clic)
- **Survol cellule de segment** → tooltip (`role="tooltip"`, délai `motion.tooltipDelay`
  ≈ 120 ms) :
  - Ligne 1 : **modèle** (« Claude »).
  - Ligne 2 : **catégorie** (label complet `getThemeToken(theme).label` + abréviation).
  - Ligne 3 : **plage de phrases** (« phrases 12–17 », soit `startSentence..endSentence`).
- **Clic cellule** → `focusSentence(startSentence)`. Le `focusedRef` + `scrollIntoView`
  existants centrent la phrase ; le focus pose le surlignage `bg-accent/10` déjà en place.
  (Réutilise **exactement** le `onJump` du `ComparePanel`.)
- **Clic marqueur** = clic cellule (même cible, zone de hit ≥ 24×24 pour le tactile).
- Pas d'action destructive depuis la réglette (lecture seule). L'arbitrage reste dans
  `BoundaryEvidence` (icône 👁 dans le texte), inchangé.

### A7 — Extensibilité N modèles
- La réglette itère sur un tableau **ordonné** `models: GutterModel[]` (voir
  `A-contrat-donnees.yaml`). Ajouter Mistral = (1) `Judge.MISTRAL` au backend,
  (2) `mistralPre` exposé par `useLlmAgreement` (même forme que `claudePre`),
  (3) une entrée dans `MODEL_REGISTRY` (id, label, initiale). **Aucun** changement de
  layout : la grille CSS est en `repeat(var(--n-tracks), …)`.
- Couleur d'**identité de piste** (en-tête, pas la catégorie) tirée de `track.identity[]`
  (palette neutre distincte, daltonisme-safe). Au-delà de la palette, repli sur l'initiale
  seule (la **forme**/lettre reste discriminante).

### A8 — Accessibilité (AA + daltonisme)
- **Forme + couleur** : l'information « frontière » = le glyphe ⟦◷⟧ ; l'information
  « catégorie » = l'abréviation **et** la teinte. Jamais la couleur seule.
- **Contraste** : marqueur et texte d'abréviation calculés via `readableTextColor()`
  (déjà dans `tokens.ts`) ⇒ ratio AA garanti sur fond de cellule dynamique.
- **Clavier** : la réglette est un `role="grid"` ; chaque piste `role="row"` ;
  cellules de **début de segment** focusables (`tabindex` roving). Entrée/Espace =
  centrer la phrase ; ↑/↓ = segment précédent/suivant **de la même piste** ; ←/→ =
  changer de piste. `Esc` ferme le tooltip.
- **Lecteur d'écran** : chaque cellule de début expose
  `aria-label="Claude — Modification des conditions — phrases 12 à 17"`. L'en-tête de
  piste a un `aria-label` complet (« Piste Claude »).
- **Mouvement** : transitions ≤ `motion.fast` ; respect de `prefers-reduced-motion`
  (pas d'animation d'apparition de tooltip si réduit).

---

## 4. États (machine d'affichage)

| Dimension | Valeurs | Source d'état |
|-----------|---------|---------------|
| Réglette visible | on / off | `showBoundaries` (store, existant) |
| Piste d'un modèle | visible / masquée | `gutterModels[id]` (store, **nouveau**) |
| Catégorie | on / off | `gutterShowCategory` (store, **nouveau**) |
| Données d'un modèle | présentes / absentes | `llm.*Pre?.clauses?.length > 0` |
| Tooltip | fermé / ouvert(cellule) | état **local** au composant (hover/focus) |
| Cellule | neutre / frontière / corps-de-segment | dérivé des runs (pur) |

- **Aucune donnée pour un modèle** : la piste est rendue **désactivée** (grisée, en-tête
  barré, `aria-disabled`) plutôt que supprimée silencieusement — l'utilisateur comprend
  que « ce modèle n'a pas (encore) annoté ce document ». (Évite la confusion absence vs
  masquage.)
- **Document vide / `n === 0`** : `computeRuns` renvoie `[]` → gutter monté mais vide
  (aucune cellule), pas d'erreur (défensif, cf. `runs.ts`).
- **Mode `compare`** : la réglette **reste affichable** (orthogonale au `llmSource`) ;
  elle montre les frontières brutes par modèle pendant que le texte montre l'accord
  vert/ambre. C'est complémentaire, pas redondant.

---

## 5. Toggles — récapitulatif UI

- **Existant réutilisé** : case « Frontières » de `document-controls` ⇒ `toggleBoundaries`
  (toggle maître de la réglette).
- **Nouveau, dans l'en-tête du gutter (repliable)** :
  - une case par modèle (« Claude », « Codex », « Mistral »…) ⇒ `gutterModels[id]`.
  - une case « Catégories » ⇒ `gutterShowCategory`.
  - un lien « Tout / Aucun » (réglage rapide des pistes).
- Les toggles modèle sont **désactivés** (cochés-grisés) pour un modèle sans données.

---

## 6. Performance

- **Coût de rendu** : pour `n` phrases et `m` modèles, le gutter rend au pire `n·m`
  cellules. À `n=300`, `m=3` ⇒ 900 nœuds. On rend **uniquement** les cellules de
  **frontière** comme éléments interactifs ; le corps de segment (teinte) est dessiné en
  **un seul** bloc par segment (un `<div>` par segment, hauteur = somme des lignes), pas
  une cellule par phrase ⇒ on retombe à ~(#segments · m) nœuds (dizaines, pas centaines).
- **Calcul** : `runsByModel` est mémoïsé (`useMemo`) sur `[llm.*Pre, n]` — **déjà** le cas
  pour `claudeRuns`/`codexRuns`. La réglette **consomme** ces mêmes mémos (les remonter via
  props ou un petit hook `useModelRuns`), donc **zéro recompute** supplémentaire.
- **Alignement** : `rowTops/rowHeights` mesurés via **un** `ResizeObserver` sur le
  conteneur de lecture (pas un par phrase) ; débounce au resize ; recalcul aussi quand
  `displayLang`/`translatedSentences` changent (la hauteur des lignes varie).
- **Scroll** : gutter `sticky`, pas de listener `scroll` JS (le navigateur gère). Pas de
  re-render au scroll.
- **Budget** : interaction tooltip < 16 ms (lecture O(1) des runs du segment) ;
  bascule d'un toggle = un re-render mémoïsé du seul gutter.

---

## 7. Accessibilité (synthèse vérifiable)

- [ ] Toute information de frontière a une **forme** (⟦◷⟧) en plus de la couleur.
- [ ] Toute information de catégorie a une **abréviation/label** en plus de la teinte.
- [ ] Contraste texte/fond ≥ 4.5:1 (via `readableTextColor`).
- [ ] Réglette entièrement pilotable au clavier (roving tabindex, Entrée, flèches, Esc).
- [ ] `aria-label` complet par cellule de début et par en-tête de piste.
- [ ] Tooltip `role="tooltip"`, ouvrable au **focus** clavier (pas seulement au hover).
- [ ] `prefers-reduced-motion` respecté (pas d'animation d'apparition).
- [ ] Cibles tactiles ≥ 24×24 px.
- [ ] Pas de piège au clavier ; ordre de tabulation logique (haut→bas, piste par piste).

---

## 8. Intégration concrète (DocumentPanel / runs / store / tokens)

### 8.1 Nouveau composant `ModelBoundaryRail.tsx`
- Emplacement : `frontend/src/components/workspace/ModelBoundaryRail.tsx`.
- Rendu : à droite de la colonne de lecture, **dans** le `flex justify-center gap-4`
  existant de `DocumentPanel` (où vit déjà `ComparePanel` en sticky). Le gutter prend la
  place d'un 3e enfant `flex` sticky côté droit.
- Props (toutes dérivées de l'existant) :
  ```ts
  interface ModelBoundaryRailProps {
    models: GutterModel[];          // {id, label, initial, runs, hasData}
    n: number;                       // nSentences
    rowMetrics: RowMetrics;          // {tops:number[], heights:number[]} mesurés
    focused: number;
    onJump: (sentenceIndex: number) => void;  // = focusSentence
  }
  ```

### 8.2 Réutilisation de `runs.ts`
- **Aucune** nouvelle fonction de calcul requise. Les segments d'une piste = les `Run`
  de `computeRuns(judgeAnchors(pre.clauses), n)` filtrés sur `theme != null` ; un segment
  réglette = `{ startSentence: run.start, endSentence: run.end, themeCode: run.theme }`.
- `runAt(runs, i)` reste utilisable pour le mapping inverse si besoin (survol → segment).
- (Facultatif, lisibilité) un helper **pur** `segmentsFromRuns(runs): GutterSegment[]`
  pourra vivre dans `runs.ts` (filtre + map trivial), testable isolément.

### 8.3 Données via les hooks existants
- `useLlmAgreement(documentId, projectSlug, llmVersion)` expose déjà `claudePre`/`codexPre`.
  Pour Mistral : ajouter `mistralPre` **même forme** (voir §9). **Pas de nouvel endpoint**
  (audit §6 ; on relit les `PreAnnotation`).
- Construction du tableau `models` (mémoïsé) :
  ```ts
  const models = useMemo<GutterModel[]>(() => ([
    { id:"claude",  label:"Claude",  initial:"C",  runs: claudeRuns,  hasData: !!llm.claudePre?.clauses?.length },
    { id:"codex",   label:"Codex",   initial:"Cx", runs: codexRuns,   hasData: !!llm.codexPre?.clauses?.length },
    // { id:"mistral", label:"Mistral", initial:"M", runs: mistralRuns, hasData: ... }, // A7
  ].filter(m => gutterModels[m.id] !== false)),
  [claudeRuns, codexRuns, llm, gutterModels]);
  ```

### 8.4 Store (`workspace.ts`)
- Ajouts **minimaux** (pattern identique aux toggles existants `showBoundaries`/`showGhost*`) :
  ```ts
  gutterModels: Record<string, boolean>;   // {claude:true, codex:true, mistral:true}
  gutterShowCategory: boolean;             // défaut false
  toggleGutterModel: (id: string) => void;
  toggleGutterCategory: () => void;
  ```
- Pas de couplage avec `draftClauses`/autosave (lecture seule) ⇒ aucun risque côté
  persistance (audit §5).

### 8.5 Tokens (`A-design-tokens.json` → `tokens.ts`)
- Couleurs **de catégorie** : inchangées, via `getThemeToken(code).color` (schéma fermé).
- Couleurs **neutres de piste**, largeurs, opacités, z-index, durées : nouveaux tokens
  `gutter.*` (voir `A-design-tokens.json`). On évite tout hex en dur dans le composant
  (cohérent avec la « chasse aux couleurs en dur », Phase 5 identité Pactiva).

### 8.6 Tests (rappel, détaillés en 06-plan-tests)
- **vitest (pur)** : `segmentsFromRuns`, mapping run→segment, dérivation `models`, calcul
  d'alignement (`rowTops`), abréviation `themeCode → abbr`.
- **vitest (composant)** : rendu d'1 piste, marqueur au seul début de segment, toggle
  catégorie ON/OFF, piste sans données = désactivée.
- **Playwright** : afficher la réglette, masquer un modèle, activer Catégories, survol
  tooltip (modèle + plage), clic = phrase centrée/focalisée.
- **MSW** : `claudePre`/`codexPre` (+ futur `mistralPre`) servis comme aujourd'hui.

---

## 9. Points d'extension Mistral (et N modèles)

1. **Backend** : `imports/models.py::Judge` → ajouter `MISTRAL = "mistral", "Mistral"`.
   `loaders.py` normalise déjà les segments (`start_id` + `theme`) indépendamment du juge ;
   un payload Mistral au même format **passe sans code spécifique**.
2. **API/contrat** : `useLlmAgreement` expose `mistralPre` (forme `PreAnnotation`).
   Aucun nouvel endpoint : la liste des pré-annotations du document inclut Mistral dès
   qu'il est importé.
3. **Frontend** : `mistralRuns = useMemo(() => computeRuns(judgeAnchors(llm.mistralPre?.clauses), n), …)`
   puis une entrée dans `models` (id/label/initiale/runs/hasData). **Fin.** Pas de refonte
   du gutter (grille `repeat(N, …)`), pas de nouveau composant.
4. **Identité de piste** : `gutter.track.identity[2]` fournit une 3e couleur neutre
   daltonisme-safe ; au-delà, repli sur l'initiale seule.
5. **Garde-fous** : si `> N_max` pistes (densité), le gutter active un **mode condensé**
   (largeur de piste réduite à `track.widthDense`, en-têtes en initiale seule, légende
   déportée). Décision N_max ≈ 5 (au-delà, préférer le mode `compare` pairé). Hors
   périmètre d'implémentation immédiate, mais la structure le permet déjà.

---

## 10. Critères d'acceptation (Definition of Done — Feature A)

- [ ] **A1** Les pistes Claude & Codex s'affichent côte à côte, alignées aux phrases,
  sans basculer la source.
- [ ] **A2** Réglette masquable globalement (case Frontières) et par modèle (légende) ;
  préférences persistées par session.
- [ ] **A3** Teinte + abréviation de catégorie togglables, OFF par défaut, AA quand ON.
- [ ] **A4** Une frontière partagée par 2 modèles apparaît sur la même ligne ; une
  divergence est visuellement décalée.
- [ ] **A5** La colonne de lecture conserve `max-w-reading` (gutter hors flux de lecture) ;
  repli propre < `xl`.
- [ ] **A6** Survol = tooltip (modèle, catégorie, plage) < 150 ms ; clic = phrase centrée
  et focalisée.
- [ ] **A7** Ajouter une 3e piste (Mistral simulée en MSW) n'exige **aucune** modif de
  layout.
- [ ] **A8** Audit a11y vert (forme+couleur, clavier, contraste, SR, reduced-motion).
- [ ] Aucun nouvel endpoint backend ; aucune migration de schéma ; aucun recompute LLM
  supplémentaire (mémos partagés).
