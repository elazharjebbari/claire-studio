# Architecture — Refonte du workspace d'annotation Pactiva

> Lot **design-arch**. Vue d'ensemble des composants du workspace impactés et des
> nouveaux composants, des flux de données, et de la frontière frontend-only vs backend.
> Source : audit `00-audit/audit-uiux.json` (7 axes vérifiés contre le code), besoins
> `01-besoins/besoins.md`, code `frontend/src/components/workspace/*` et `ui/*`.
>
> Périmètre de la page `/annotate/[id]`. Toutes les décisions ci-dessous sont **arrêtées**
> (issues de l'audit) ; ce document décrit *comment* les composants s'assemblent, pas la
> justification de chaque axe (voir dossiers `03`→`07`).

---

## 1. Carte d'ensemble du workspace

L'orchestrateur est `AnnotationWorkspace.tsx` (`AnnotationWorkspace.tsx:26`). Il monte
la barre haute (`WorkspaceToolbar`), les bandeaux de session, puis le tryptique
redimensionnable `ResizablePanels` (gauche = `TocPanel`, centre = `DocumentPanel`,
droite = `InspectorPanel`), avec deux panneaux latéraux à la demande (`CommentsPanel`,
`HistoryPanel`).

```
AnnotationWorkspace
├─ WorkspaceToolbar ............... chrome applicatif (haut)   ── AXE 4 (overflow)
│   └─ [Plus] OverflowMenu* ....... Versions / Insights / Tour ── nouveau
├─ session-banner / judge-view-banner
└─ ResizablePanels
    ├─ left   : TocPanel .......... plan + Overlays + toggle Minimap* ── AXE 5
    ├─ center : DocumentPanel ..... cœur de lecture/annotation
    │   ├─ ToolbarShell* .......... document-controls regroupé  ── AXE 4
    │   │   ├─ ToolGroup* (Source/Comparaison) : LlmSourceSwitch · Comparer · Version
    │   │   ├─ SelectionTools* (conditionnel)  : N sélectionnées + actions ── AXE 4 (B4.3)
    │   │   ├─ ToolGroup* (Lecture)            : Frontières · Attribution · reading-controls
    │   │   ├─ ToolGroup* (Langue)             : LangSwitch
    │   │   └─ CollabBar (gauche, conditionnel)
    │   ├─ CompareStickyHeader* ... score N-way + DivergenceNav (un seul bloc sticky) ── AXES 6/7
    │   ├─ scrollRef <div> ........ NOUVEAU conteneur de scroll (lift) ── AXE 5
    │   │   ├─ colonne de lecture : SentenceRow[]
    │   │   │   ├─ <span> texte  → RationaleHover* (survol)   ── AXE 1
    │   │   │   ├─ SentenceMenu (clic-droit/long-press)       ── AXES 2/3
    │   │   │   ├─ ModelBoundaryStrip (gutter, segments continus) ── AXE 6
    │   │   │   └─ BoundaryEvidence (popover frontière)
    │   │   └─ DocumentMinimap* ... overlay vertical droite   ── AXE 5
    │   └─ ComparePanel (sidebar xl, nav interne retirée)     ── AXE 7
    └─ right  : InspectorPanel .... refonte 2 lots            ── AXE 3
        ├─ En-tête : ClauseChip + badge Nature + CertaintyPicker(sm) + Valider + Supprimer
        ├─ Classification : ThemePalette(grid+hover) + NaturePicker*  ── AXES 2/3
        ├─ Justification : Evidence + Rationale + InspectorJudgeCompare (N-way)
        └─ Commentaires : CommentCard* (extrait de CommentsPanel) + composer
```

`*` = composant créé ou substantiellement nouveau dans cette refonte.

---

## 2. Composants impactés (existants)

| Composant | Fichier | Axe | Nature du changement |
|---|---|---|---|
| `DocumentPanel` | `DocumentPanel.tsx` | 1,4,5,6,7 | Hôte principal : pose `RationaleHover`, lift du scroll + `DocumentMinimap`, `ToolbarShell`/groupes, gutter segments continus, `CompareStickyHeader`. Pivot de la refonte. |
| `InspectorPanel` | `InspectorPanel.tsx` | 2,3 | Réécriture en 3 zones (en-tête / classification / justification + commentaires) ; `<select>` nature → `NaturePicker` ; `ThemePalette` en `grid`+`describeOnHover` ; bouton Valider ; `CommentThread` → `CommentCard`. |
| `InspectorJudgeCompare` | `InspectorJudgeCompare.tsx` | 2,3,7 | Passe de bi-modèles figés (`type Source="human"\|"claude"\|"codex"`, `:17`) à N-modèles via `llm.preByJudge` (`hooks.ts:311-323`) × `LLM_JUDGES`. Ajoute la nature (Lot 2). |
| `SentenceMenu` | `SentenceMenu.tsx` | 1,2,3 | Source du gabarit `JudgeEntry`/`JudgeDetail` réutilisée par `RationaleHover` ; ajoute la nature LLM (Lot 2) dans `JudgeBlock`. |
| `ModelBoundaryRail` | `ModelBoundaryRail.tsx` | 6 | `ModelBoundaryStrip` rendu en **segments continus** (cellules jointives, ruptures nettes, teinte toujours visible, conflit en liseré). Conserve `data-testid`. |
| `WorkspaceToolbar` | `WorkspaceToolbar.tsx` | 4,7 | `OverflowMenu` pour actions rares ; libellés Claude/Codex figés (`:339,:344`) → `llmJudgeLabel`. |
| `TocPanel` | `TocPanel.tsx` | 5 | Toggle Minimap dans le fieldset Overlays ; surbrillance de la plage visible (optionnel). |
| `ResizablePanels` | `ResizablePanels.tsx` | 5 | Retire `overflow-y-auto` de la `<section>` (`:152-158`) → le scroll redescend dans `DocumentPanel`. |
| `ComparePanel` | `ComparePanel.tsx` | 7 | Retire la nav interne `compare-divergence-*` (doublon) ; disponible `<xl` (drawer). Signature de props inchangée. |
| `DivergenceNav` | `DivergenceNav.tsx` | 7 | Fusionné dans `CompareStickyHeader` ; supprime l'offset magique `top-[3.25rem]`. |
| `CommentsPanel` / `CommentThread` | idem | 3 | Carte riche extraite en `CommentCard` partagé ; `CommentThread` (version pauvre) retiré de l'inspecteur. |
| `LlmSourceSwitch` / `LangSwitch` | idem | 4 | Motif segmented déjà partagé → référence de l'état « actif » unifié (`bg-accent/15 ring-1 ring-accent/40`). |
| `useDivergenceShortcuts` | `useDivergenceShortcuts.ts` | 7 | Étape C : touches `1..N` dynamiques (au lieu de 1/2 Claude/Codex figés). |

### Stores & libs touchés (frontend)

| Module | Ajout | Axe |
|---|---|---|
| `store/ui.ts` | `showMinimap`/`toggleMinimap` + `partialize` (clone du pattern `readingWide`, `ui.ts:54/67/80`) | 5 |
| `store/workspace.ts` | `selectMany(indices:number[])` (voisin de `selectRange`, `:800`) | 4 |
| `lib/runs.ts` | `prevBoundaryFrom(starts, from)` (symétrique de `nextBoundaryFrom`, `:155-161`) | 4 |
| `lib/llmAgreement.ts` | `agreementNway(byIndexList, n)` → `{fullAgreementPct, fleissKappa, support}` | 7 |
| `lib/divergence.ts` | Dépréciation des fonctions pairwise mortes ; ne garder que `next/prev/divergenceOrdinal` | 7 |
| `lib/tokens.ts` | `legalNatureToken()` (couleur de nature — **requis** pour des pastilles fidèles, cf. §6) | 2 |
| `lib/pivot.ts` | `legal_nature` propagé (au lieu de `null`, `:114`) | 2 (Lot 2) |
| `types/contract.ts` | `PreClause.legalNature?: string\|null` (`:316`) | 2 (Lot 2) |

---

## 3. Nouveaux composants

### 3.1 `RationaleHover` — `components/workspace/RationaleHover.tsx` (AXE 1)

Popover **passif** de survol prolongé d'une phrase, calqué sur `BoundaryEvidence`.

```ts
interface RationaleHoverProps {
  x: number; y: number;                 // coordonnées du curseur
  theme: string | null;                 // thème humain (ou run courant)
  humanRationale: string | null;
  humanEvidence: string | null;
  judges: JudgeEntry[];                  // réutilise le type de SentenceMenu.tsx:28-43
}
```

- Positionnement via `useAnchoredPosition(x, y)` (`useAnchoredPosition.ts:46`) → `{ref, style}`
  avec flip/clamp viewport déjà éprouvé.
- Conteneur : `fixed z-40 bg-elevated border border-line shadow-xl animate-fade-in pointer-events-none max-w-sm`.
  **`pointer-events-none` est critique** : le popover ne vole jamais le pointeur → ne casse
  ni `onClick`, ni le long-press (`useLongPress.ts`), ni le drag de sélection
  (`useBlockDragSelect.ts`).
- Contenu : (a) puce thème `getThemeToken(theme).color` + label ; (b) rationale humain
  tronqué (~160 car.) ; (c) une ligne condensée par juge présent (`llmJudgeLabel` + label
  nature/thème) + evidence en italique entre guillemets (style `SentenceMenu.tsx:318-322`).
- `data-testid="rationale-hover"`.

**Câblage dans `DocumentPanel`** : état `hover:{index,x,y}|null` + timer (~300 ms à
l'entrée, tampon ~120 ms à la sortie). Callbacks `onHoverEnter/Leave` posés sur
`onPointerEnter/Leave` du `<span>` texte (`DocumentPanel.tsx:1110-1124`), gardés par
`e.pointerType==='mouse'` (le tactile garde long-press). Le popover n'ouvre que si la
phrase a de la matière : `anchorByIndex.get(index)?.rationale` non vide **OU** un
`detailAt(...)` non nul. **Repli a11y** : `title` natif minimal (thème + 1re phrase du
rationale) conservé sur le `<span>` pour clavier / lecteur d'écran / tactile.

### 3.2 `NaturePicker` — `components/ui/NaturePicker.tsx` (AXE 2/3)

Sélecteur de nature juridique calqué sur `ThemePalette`/`CertaintyPicker`, remplaçant le
`<select>` natif (`InspectorPanel.tsx:110-127`).

```ts
interface NaturePickerProps {
  value: string | null;
  legalNatures: LegalNature[];          // arrive déjà via scheme (AnnotationWorkspace.tsx:113)
  onChange: (code: string | null) => void;
  describeOnHover?: boolean;            // tooltip = LegalNature.definition (contract.ts:122)
  size?: "sm" | "md";
}
```

- 6 natures (`OBLIGATION/PROHIBITION/PERMISSION/DEFINITION/DECLARATION/PROCEDURE`,
  `vocabulary.yaml:33-39`). ARIA `radiogroup` (peu d'items → pas de filtre).
- Pastilles colorées via `legalNatureToken(code).color` (helper **requis**, cf. §6) ; le
  pattern `armTooltip` (~450 ms) de `ThemePalette.tsx:51-58` affiche `LegalNature.definition`.
- Badge de nature lecture seule (variante compacte) posé à droite du `ClauseChip` dans
  l'en-tête de l'inspecteur et utilisable par `RationaleHover`.

### 3.3 `DocumentMinimap` — `components/workspace/DocumentMinimap.tsx` (AXE 5)

Colonne verticale (~12 px) en overlay à droite du panneau de lecture, type éditeur de code.

```ts
interface DocumentMinimapProps {
  scrollRef: React.RefObject<HTMLElement>;
  n: number;
  sentenceColors: (string | null)[];   // memo : runAt(runs,i) → getThemeToken(theme).color
  boundaryStarts: number[];             // DocumentPanel.tsx:237-242
  conflictStarts: Set<number>;          // adapter : new Set(conflictStartByIndex.keys())
  unfairnessByIndex: Set<number>;       // DocumentPanel.tsx:170
  focused: number;
  onJump: (index: number) => void;      // → focusSentence (workspace.ts:340)
}
```

- 1 bande/phrase à hauteur uniforme (fill `sentenceColors[i]` ~0.5, tick frontière, liseré
  conflit, point injustice). Cadre viewport translucide piloté par `scrollTop/scrollHeight/
  clientHeight`.
- **Pré-requis architecture (bloquant)** : le scroll appartient aujourd'hui à
  `ResizablePanels.tsx:152-158`. On le **redescend** dans `DocumentPanel` (`<div ref={scrollRef}
  className="h-full overflow-y-auto">`), la `<section>` parente devenant `overflow-hidden`. La
  toolbar `sticky top-0` reste correcte (le contexte de scroll devient ce div). **Le wrapper
  doit englober tout le `<div>` extérieur** (`DocumentPanel.tsx:380`, `bg-reading`+centrage)
  pour ne pas casser le `sticky top-4` de `ComparePanel`.
- Perf (139+ phrases) : bandes mémoïsées (sous-composant), cadre piloté par `onScroll`
  throttlé en `requestAnimationFrame` (3 nombres), `ResizeObserver` sur `scrollRef`. **Aucun
  `getBoundingClientRect` par phrase.** Repli responsive : barre de progression sous un seuil
  de largeur.

### 3.4 `ToolbarShell` / `ToolGroup` / `ToolDivider` / `OverflowMenu` — `components/workspace/` (AXE 4)

Primitives de barre pour structurer `document-controls` (`DocumentPanel.tsx:388-514`).

- `ToolGroup` : `<div role="group" aria-label className="inline-flex items-center gap-1.5">`.
- `ToolDivider` : `<span aria-hidden className="mx-1 h-5 w-px bg-line/50">`.
- `OverflowMenu` : bouton « Plus » + popover (`border-line bg-elevated`) absorbant
  Versions/Insights/Tour.
- `ToolbarShell` : `role="toolbar"` + `aria-orientation`, ordre **stable** des groupes :
  `[Source/Comparaison] · [Sélection] · [Lecture] · [Langue]`, `CollabBar` à gauche.
- **Tous les `data-testid` conservés** : `document-controls`, `llm-source-switch`,
  `toggle-compare-panel`, `boundary-toggle`, `toggle-attribution`, `reading-controls`,
  `lang-switch`, `select-to-boundary`.

### 3.5 `SelectionTools` (`SelectionToolGroup`) — `components/workspace/` (AXE 4 / B4.3)

Section de sélection contextuelle, rendue **uniquement si `selectedSentences.length > 0`**
(pattern `CollabBar.tsx:31`). Compteur `data-testid="selection-count"` + actions :

| Action | testid | Câblage |
|---|---|---|
| Segment courant | `select-segment` | `runAt(runs, focused)` puis `selectRange(run.start, run.end)`. **NB** : en source humaine les runs sont per-phrase → borner via `boundaryStarts` pour rester utile. |
| Étendre / Réduire | `select-extend-next` / `select-reduce` | `nextBoundaryFrom` / `prevBoundaryFrom`* + `selectRange` sur min/max courants. |
| Jusqu'à la frontière | `select-to-boundary` | existant, déplacé ici. |
| Tout le thème courant | `select-theme` | runs de même `runThemeAt(runs, focused)` → `selectMany`* (sélection non contiguë). |
| Vider | `select-clear` | `clearSelection()` (`workspace.ts:819`). |

### 3.6 `CompareStickyHeader` — `components/workspace/` (AXE 7) et `CommentCard` (AXE 3)

- `CompareStickyHeader` : regroupe le score **N-way** (`agreementNway` : κ de Fleiss + %
  tous d'accord + support, libellés via `compareJudgesData.map(j=>j.label).join(' / ')`) et
  `DivergenceNav` dans **un seul** conteneur `sticky top-0 z-10 backdrop-blur` (remplace
  l'offset magique). Conserve `divergence-nav/-counter/-prev/-next`.
- `CommentCard` : carte riche extraite de `CommentsPanel.tsx:144-151` (avatar couleur
  contributeur, badge portée `scopeLabel`, résolution), partagée entre `CommentsPanel` et
  l'inspecteur (filtrée `scope=clause`).

---

## 4. Flux de données

### 4.1 Schéma & thèmes (runtime)
`useScheme` → `setRuntimeThemes(scheme.themes)` (synchrone, `AnnotationWorkspace.tsx:83-86`)
→ `getThemeToken`/`ClauseChip`/`ThemePalette`/`DocumentMinimap` lisent les couleurs runtime.
`scheme.legalNatures` (`:113`) alimente `NaturePicker` et `InspectorPanel` (incl. `definition`).

### 4.2 Annotation humaine (édition)
`useAnnotation` → `init()` du store → `DraftClause` (`store/workspace.ts:44-46` :
`theme`, `legalNature`, `evidenceSpan`, `rationale`, `certainty`, `validated`). Édition via
`updateDraft`/`setValidated` ; persistance par `useAutosave` (uniquement `isMine`).
`RationaleHover` et l'inspecteur lisent `DraftClause.rationale`/`evidenceSpan` **sans appel
API** (déjà en store).

### 4.3 Pré-annotations LLM (lecture / comparaison)
`useLlmAgreement` (`hooks.ts:307-323`) expose `preByJudge: Record<judgeId, PreAnnotation>`
(indexé par **tout** juge, Mistral inclus via `LLM_JUDGES`). `DocumentPanel` en dérive
`runsByJudge`, `detailMapByJudge`/`detailAt` (`:904-940`), `byIndexByJudge` (`:262-269`).
Ces structures alimentent : `RationaleHover` (juges présents), `ModelBoundaryStrip` (segments
+ conflits reliés), `ComparePanel`/`CompareStickyHeader` (`conflictZones` N-way + `agreementNway`),
`InspectorJudgeCompare` (onglets dynamiques).

### 4.4 État UI persisté
`store/ui.ts` (clé `claire.ui`, `partialize`) : `inspectorOpen`, `readingWide`,
`gutterShowCategory`, **`showMinimap`** (nouveau). `store/workspace.ts` (éphémère) :
`focusedSentence`, `selectedSentences`, `llmSource`, `selectedCompareIds`.

```
[Backend DRF] ──/scheme──▶ setRuntimeThemes ──┐
              ──/annotation──▶ init() ─▶ DraftClause ─┐
              ──/preannotations──▶ useLlmAgreement ─▶ preByJudge ─┐
                                                                  ▼
   DocumentPanel (runs/detail/byIndex/boundary/conflict) ─▶ Rail · Minimap · Hover · CompareHeader
   InspectorPanel (DraftClause + preByJudge) ─▶ ThemePalette · NaturePicker · JudgeCompare · CommentCard
```

---

## 5. Frontend-only vs Backend

### 5.1 100 % frontend (aucun changement serveur)

- **AXE 1 — RationaleHover** : donnée déjà en store (`DraftClause`) + déjà calculée
  (`detailMapByJudge`). *Aucun champ/API.*
- **AXE 3 (Lot 1) — refonte UI inspecteur** : `ThemePalette` grid, `NaturePicker` humain
  (`LegalNature.definition` déjà exposé par `/scheme`), `CommentCard`, bouton Valider,
  `InspectorJudgeCompare` N-way (`preByJudge` déjà fourni). *Aucun backend.*
- **AXE 4 — toolbar + sélection** : tout repose sur store/lib existants ; seuls ajouts
  front `prevBoundaryFrom` + `selectMany`. *Aucun backend.*
- **AXE 5 — minimap** : lift du scroll + memo couleurs + toggle UI. Données déjà
  client-side. *Aucun backend.*
- **AXE 6 — gutter segments continus** : `coalesceRuns`+`segmentsFromRuns` fournissent déjà
  les spans ; conflit relié dérivé de `byIndexByJudge`. *Aucun backend.*
- **AXE 7 — compare N-way + sticky** : `ComparePanel` déjà N-way ; seul ajout front
  `agreementNway` (κ de Fleiss). *Aucune route serveur.*

### 5.2 Dépendance backend (AXE 2 — nature LLM, **Lot 2 uniquement**)

La nature juridique **humaine** est complète de bout en bout. La **nature LLM** est la
seule dépendance backend de tout le dossier. Chaîne à étendre :

1. `imports/loaders.py` — extraire `legal_nature`. ⚠ **Correction load-bearing de l'audit** :
   `legal_nature` n'est **pas** dans `plan.clauses[]` (v9.4) ni dans `segments[]` (v9.2). Il
   vit dans le tableau de 1er niveau `annotations[]` (clé `id`). Le corpus actif est
   `v9.2-nature-derived` → la vraie extraction est une **jointure** `segment.start_id ↔
   annotations[].id` dans `normalize_v92`.
2. `imports/models.py` — colonne `PreClause.legal_nature` (CharField) + **migration**.
3. `imports/services.py` — ⚠ **fichier omis par l'audit** : la persistance réelle est
   `PreClause.objects.bulk_create(...)` (`services.py:54-64`) ; ajouter `legal_nature=...`,
   sinon colonne + serializer restent vides.
4. `imports/serializers.py` — ajouter `legal_nature` aux `fields` (camelCase auto via
   `djangorestframework_camel_case` → `legalNature`).
5. **Frontend** : `PreClause.legalNature` (`contract.ts:316`), `pivot.ts:114` (au lieu de
   `null`), `JudgeDetail.legalNature` (`SentenceMenu.tsx:28`) propagé via `buildJudgeDetailMap`/
   `detailAt`, affiché dans `JudgeBlock` + `InspectorJudgeCompare`.

**Pré-requis data transverse (non-LLM)** : ajouter le champ `definition` aux 6 natures dans
`vocabulary.yaml:34-39` (type/serializer le supportent déjà, valeur vide aujourd'hui) pour
alimenter le tooltip de `NaturePicker`.

Tant que les juges n'émettent pas la nature, l'UI affiche `—` proprement — **pas
d'heuristique** (Option C rejetée) pour préserver la confiance dans l'arbitrage.

### 5.3 Découpage en lots

- **Lot 1 (frontend-only)** : AXES 1, 3 (UI), 4, 5, 6, 7 + Lot 1 de l'inspecteur. Livrable
  sans redéploiement backend.
- **Lot 2 (backend + frontend)** : chaîne `legal_nature` LLM (AXE 2). Migration + déploiement
  prod requis ; débloque « nature consultable par LLM » (B2.2).
