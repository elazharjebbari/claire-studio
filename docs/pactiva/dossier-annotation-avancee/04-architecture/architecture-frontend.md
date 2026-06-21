# Architecture frontend — Features A & B

> Next.js 14 (App Router) · TypeScript · Tailwind · Zustand · React Query · MSW.
> Principe directeur : **maximiser la réutilisation** du socle existant
> (`lib/runs.ts::computeRuns`, `store/workspace.ts`, `useAutosave`, `lib/tokens.ts`) et
> n'introduire que **deux** nouveaux éléments structurants : le composant de réglette
> **`ModelBoundaryRail`** (A) et le **module pur `lib/blocks.ts`** + l'action store
> **`applyBlockOp`** (B). Aucune nouvelle source de données, aucun nouveau endpoint.

Cibles de perf : documents **≤ ~300 phrases**, plusieurs modèles, 60 fps perçu, dérivation
< 5 ms/frappe (à valider par bench vitest).

---

## 1. Vue d'ensemble du découpage

```
DocumentPanel.tsx  (orchestrateur — déjà en place)
├── document-controls (sticky)  ── case « Frontières » (showBoundaries, maître réglette)
│                                ── LlmSourceSwitch, LangSwitch, Comparer, Attribution
├── colonne de lecture (max-w-reading)
│   └── SentenceRow × n         ── rail thème gauche (P2) + poignées de bloc (B, nouveau)
├── ModelBoundaryRail   (A, NOUVEAU)   ── gutter sticky à droite, hors max-w-reading
├── ComparePanel        (existant, sticky droite, mode compare)
├── SentenceMenu        (existant)     ── override phrase (B3), propositions LLM
├── SelectionToolbar    (existant)     ── annoter plage (B2) / annoter blocs / désannoter
└── BlockHandlesLayer   (B, optionnel) ── couche poignées du bloc sélectionné

Données / logique pure :
  lib/runs.ts    (existant)  computeRuns(perSentence|forward-fill), runAt, clauseRangeBetween
  lib/blocks.ts  (NOUVEAU)   deriveBlocks(runs), blockAt(blocks, i)  ← PUR, testable
  store/workspace.ts (étendu) selection bloc, gutterModels/gutterShowCategory, applyBlockOp
```

`ModelBoundaryRail` est la **réalisation canonique** de la « réglette multi-pistes » de la
Feature A (la spec A la désigne aussi par `ModelBoundaryRail` ; le nom retenu pour ce dossier est
`ModelBoundaryRail`, plus parlant car « rail des frontières par modèle »). Les tokens
géométriques associés vivent déjà dans `02-feature-A-.../A-design-tokens.json` (clé
`gutter.*`).

---

## 2. Feature A — `ModelBoundaryRail` (réglette de frontières par modèle)

### 2.1 Donnée : dérivée des PreClause LLM, **pas de nouvel endpoint**

`DocumentPanel` calcule **déjà** les runs par juge (forward-fill, car la donnée LLM est
span-based) :

```ts
const claudeRuns = useMemo(() => computeRuns(judgeAnchors(llm.claudePre?.clauses), n), [llm.claudePre, n]);
const codexRuns  = useMemo(() => computeRuns(judgeAnchors(llm.codexPre?.clauses),  n), [llm.codexPre,  n]);
```

La réglette **consomme ces mêmes mémos** — zéro recompute. Un segment de piste =
`Run{ start, end, theme }` filtré sur `theme != null`. Helper pur **optionnel** à ajouter
dans `runs.ts` (filtre + map trivial, testable) :

```ts
export interface RailSegment { startSentence: number; endSentence: number; themeCode: string; }
export function segmentsFromRuns(runs: Run[]): RailSegment[] {
  return runs.filter(r => r.theme != null && r.localId != null)
             .map(r => ({ startSentence: r.start, endSentence: r.end, themeCode: r.theme! }));
}
```

### 2.2 Contrat du composant (props dérivées de l'existant)

```ts
interface RailModel { id: string; label: string; initial: string; runs: Run[]; hasData: boolean; }
interface ModelBoundaryRailProps {
  models: RailModel[];                 // tableau ORDONNÉ → grille CSS repeat(N, …)
  n: number;                           // nSentences
  rowMetrics: { tops: number[]; heights: number[] };  // alignement mesuré
  focused: number;
  showCategory: boolean;               // store.gutterShowCategory
  onJump: (sentenceIndex: number) => void;            // = focusSentence (cf. ComparePanel.onJump)
}
```

Construction (mémoïsée) dans `DocumentPanel`, filtrée par les toggles par modèle :

```ts
const railModels = useMemo<RailModel[]>(() => [
  { id:"claude", label:"Claude", initial:"C",  runs: claudeRuns, hasData: !!llm.claudePre?.clauses?.length },
  { id:"codex",  label:"Codex",  initial:"Cx", runs: codexRuns,  hasData: !!llm.codexPre?.clauses?.length },
  // { id:"mistral", label:"Mistral", initial:"M", runs: mistralRuns, hasData: … }, // A7 : 1 entrée de plus
].filter(m => gutterModels[m.id] !== false), [claudeRuns, codexRuns, llm, gutterModels]);
```

### 2.3 Alignement aux phrases (le point délicat)

Le gutter est dans le **même conteneur de scroll** que la lecture, en `position: sticky`.
Les cellules doivent suivre la hauteur **réelle** des lignes — qui **varie** (traduction FR
sous la phrase via `perSentenceFr`, retours à la ligne). Solution :

- **Un seul** `ResizeObserver` sur le conteneur de lecture (pas un par phrase) → relit les
  `data-sentence-index` et construit `rowMetrics = { tops[], heights[] }`.
- Recalcul aussi quand `displayLang` / `translatedSentences` changent (la hauteur bouge).
- Le corps d'un segment est dessiné en **un `<div>` par segment** (hauteur = somme des
  lignes couvertes), pas une cellule par phrase → on retombe à `O(#segments · m)` nœuds.
- Seules les **cellules de début de segment** sont interactives/focusables (marqueur ◷,
  tooltip, clic). À `n=300`, `m=3`, on rend des **dizaines** de nœuds interactifs, pas 900.

### 2.4 Extension store (pattern identique aux toggles existants)

```ts
gutterModels: Record<string, boolean>;   // {claude:true, codex:true, mistral:true}
gutterShowCategory: boolean;             // défaut false
toggleGutterModel: (id: string) => void;
toggleGutterCategory: () => void;
```

Persistés en `localStorage` (clé `pactiva.gutter.v1`) comme préférence UI. **Découplés de
`draftClauses`/autosave** (lecture seule) → aucun risque côté persistance. Le toggle
**maître** reste `showBoundaries` (déjà présent) : OFF ⇒ rail non monté (coût nul).

### 2.5 Réutilisations clés (A)
- `computeRuns` / `runAt` (`lib/runs.ts`) : segments + mapping inverse survol→segment.
- `getThemeToken(code).color` (`lib/tokens.ts`) : teinte de catégorie (schéma fermé partagé
  → cohérence avec le rail gauche et les badges).
- `readableTextColor(hex)` (`lib/tokens.ts`) : contraste AA de l'abréviation sur teinte
  dynamique.
- `onJump` identique au `ComparePanel` (centrage via `focusedRef` + `scrollIntoView` déjà
  en place).

---

## 3. Feature B — module pur `lib/blocks.ts` + action `applyBlockOp`

### 3.1 `lib/blocks.ts` (PUR — sœur de `lib/runs.ts`)

Le « bloc » est une **dérivation** des runs C4 (`perSentence`), jamais persistée. On
**ne réimplémente pas** le découpage : on lit `computeRuns(drafts, n, {perSentence:true})`.

```ts
export interface Block { start: number; end: number; theme: string; localIds: string[]; size: number; }

/** Suite contiguë maximale de phrases de même thème. O(R), R ≤ 2n+1. */
export function deriveBlocks(runs: Run[]): Block[] {
  const blocks: Block[] = []; let cur: Block | null = null;
  for (const r of runs) {
    if (r.theme == null || r.localId == null) { cur = null; continue; }   // run neutre = rupture
    const contiguous = cur && r.start === cur.end + 1 && r.theme === cur.theme;
    if (contiguous) { cur!.end = r.end; cur!.localIds.push(r.localId); cur!.size += 1; }
    else { cur = { start: r.start, end: r.end, theme: r.theme, localIds: [r.localId], size: 1 }; blocks.push(cur); }
  }
  return blocks;
}

export function blockAt(blocks: Block[], index: number): Block | undefined {
  return blocks.find(b => index >= b.start && index <= b.end);
}
```

Propriétés (spec B §1) : couverture totale (une phrase isolée = `size===1`, pas un cas
spécial), **contiguïté stricte** (un trou neutre coupe le bloc même à thème égal),
homogénéité (changement de thème coupe), **dérivation pure** (recalculée, mémoïsée).

### 3.2 Action store `applyBlockOp` (le **seul** ajout requis au store par B)

Les lots (annoter plage, étendre, réduire, désannoter bloc) doivent former **une seule**
transaction d'undo. Le store snapshote `draftClauses` **avant chaque** mutation
(`pushUndo`) ; appeler N fois `setBoundary` produirait N snapshots (undo phrase par phrase,
mauvaise UX) et N rendus. `applyBlockOp` mute un tableau local puis fait **un** `set()`,
avec **un** `pushUndo` et **une** entrée `actionLog` :

```ts
applyBlockOp(op: { kind: "annotateRange" | "extend" | "shrink" | "clearBlock";
                   anchors: number[]; theme?: string }): void
```

Sémantique (réutilise la logique unitaire déjà éprouvée, appliquée en lot) :
- `annotateRange` / `extend` : pour chaque ancre → créer si absente (thème `op.theme`),
  re-thématiser si autre thème (politique « écraser sur extension explicite », spec B §3.3),
  no-op si déjà au thème.
- `shrink` / `clearBlock` : retirer la clause de chaque ancre.
- Gardes existantes conservées : `if (s.readOnly) return {}` (R1 opposable côté front),
  bornes `[0, nSentences)`.
- `undo()`/`redo()` **inchangés** : ils restaurent le snapshot complet → un bloc
  posé/retiré s'annule d'un coup.

Les gestes **unitaires** (clic phrase B1, override clic-droit B3) continuent d'utiliser
`toggleBoundary` / `setBoundary` (un snapshot chacun) — **rien à changer**.

### 3.3 Gestes (mapping geste → action store)

| Geste | Détection (existant ou nouveau) | Action store |
|---|---|---|
| Clic = 1 phrase (B1) | `SentenceRow.onActivate` (existant) | `selectClause` / via menu `toggleBoundary` |
| Glisser / Maj-clic = plage (B2) | `selectRange` (existant) + nouveau hook glisser gauche `useBlockDragSelect`-like | sélection → `SelectionToolbar` → `applyBlockOp("annotateRange")` |
| Double-clic = sélectionner le bloc | nouveau handler (utilise `blockAt`) | `setSelectedSentences(block.start..block.end)` (sélection plage) |
| Poignées de bord = étendre/réduire (B4) | nouvelle couche `BlockHandlesLayer` (pointer drag) | `applyBlockOp("extend"/"shrink")` |
| Clic-droit = override phrase (B3) | `SentenceMenu` (existant) | `toggleBoundary(k, t')` |
| Toggle même thème = retirer (B6) | `SentenceMenu` / palette (existant) | `toggleBoundary` → `removeBoundary` |
| Fusion auto contigus (B5) | **émergente** (re-dérivation) | aucune action, aucune écriture |
| Désannoter le bloc (B6) | `SelectionToolbar` mode bloc | `applyBlockOp("clearBlock")` |
| Undo / Redo | `useShortcuts` (existant) | `undo` / `redo` |

> Note d'implémentation : un `useBlockDragSelect` (bouton **droit**) existe déjà pour la
> sélection multi-blocs en lecture (P8). Le **glisser gauche** d'annotation de plage (B2)
> est un geste distinct (bouton 0) à ajouter ; il alimente `selectedSentences` (pas
> `selectedClauseIds`) puis la `SelectionToolbar`. Ne pas confondre les deux chemins.

### 3.4 Flux de données runs / blocks (lecture)

```
draftClauses (store)
  └─ computeRuns(drafts, n, {perSentence:true})   → humanRuns   [mémo sur (drafts, n)]
       ├─ rendu rail gauche par phrase (DocumentPanel, existant)
       └─ deriveBlocks(humanRuns)                  → blocks      [mémo sur humanRuns]
            ├─ blockAt(blocks, i) → unification visuelle du rail (bloc vs phrase)
            ├─ double-clic → sélection du bloc
            └─ BlockHandlesLayer → poignées du bloc sélectionné

PreClause LLM (react-query, /preannotations)
  └─ computeRuns(judgeAnchors(pre.clauses), n)     → claudeRuns / codexRuns / … [mémos existants]
       ├─ ModelBoundaryRail (A) — pistes par modèle
       └─ SentenceMenu / BoundaryEvidence (existant) — propositions, arbitrage
```

Les deux mondes sont **orthogonaux** : B ne lit que `humanRuns` ; A ne lit que les runs des
juges. `computeRuns` est la **brique commune** (un seul algorithme, deux modes).

### 3.5 Écriture (réutilise l'autosave existant, sans adaptation)

`applyBlockOp` ne fait que produire un nouveau `draftClauses`. `useAutosave` (débounce
1200 ms) calcule un **diff par ancre** (`planClauseSync`) → `creates`/`updates`/`deletes`
minimaux, idempotents (`clientOpId = localId`). Un lot bloc de `p` phrases = `p` POST
séquencés **hors chemin critique UI**. Aucun couplage `applyBlockOp` ↔ réseau.

---

## 4. Performance (≤ 300 phrases)

| Aspect | Coût | Maîtrise |
|---|---|---|
| `computeRuns(perSentence)` | O(C log C) + O(N) | C ≤ N ≤ 300 ; **déjà** mémoïsé |
| `deriveBlocks(runs)` | O(R), R ≤ 2N+1 | une passe pure ; **mémo** sur `[humanRuns]` |
| `segmentsFromRuns` (rail) | O(R) | mémo sur runs du juge ; **réutilise** les mémos `claudeRuns`/`codexRuns` |
| Re-dérivation par frappe | recalcule seulement si `draftClauses` change | `useMemo` ; `blockAt` indexé (dichotomie possible sur `start`) |
| Pose de plage (B2, p≈300) | **1** `set()` Zustand | `applyBlockOp` mute un tableau local puis un seul set → **1** rendu, **1** snapshot undo |
| Snapshots undo | O(C) copie, borné `UNDO_DEPTH=200` | un lot = **1** snapshot (pas N) |
| Rendu rail (A) | O(#segments · m) | un `<div>` par segment ; cellules interactives = débuts seulement |
| Alignement rail | mesuré via **1** `ResizeObserver` | débounce au resize ; recalcul sur `displayLang`/`translations` |

Règles non négociables : **B-PERF-1** `deriveBlocks` mémoïsée, **jamais** appelée dans une
boucle de rendu par phrase (la calculer une fois, indexer via `blockAt`). **B-PERF-2** les
lots passent par `applyBlockOp` (un `set()`), interdiction d'itérer `setBoundary` dans un
handler pour une plage large. **A-PERF** le rail consomme les mémos existants (zéro
recompute) et `sticky` (pas de listener `scroll` JS).

---

## 5. Tests (rappel — détail en 06-plan-tests)
- **vitest (pur)** : `deriveBlocks` / `blockAt` (contiguïté, trous, override → split,
  fusion), `segmentsFromRuns`, équivalence « plage via bloc == N clics phrase »
  (`draftClauses` identique → κ identique), abréviation `themeCode → abbr`.
- **vitest (store)** : `applyBlockOp` = **un** snapshot undo ; `gutterModels`/`gutterShowCategory`.
- **vitest (composant)** : rail — 1 piste, marqueur au seul début, toggle catégorie, piste
  sans données = désactivée.
- **Playwright** : annoter une plage (un undo défait tout) ; override → split visible ;
  poignées étendre/réduire ; afficher rail, masquer un modèle, activer catégories, survol
  tooltip, clic = phrase centrée.
- **MSW** : `claudePre`/`codexPre` (+ `mistralPre` simulé) servis comme aujourd'hui ; clauses
  via les endpoints existants.
