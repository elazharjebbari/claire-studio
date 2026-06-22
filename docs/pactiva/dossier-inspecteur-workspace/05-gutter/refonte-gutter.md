# Refonte du gutter des catégories — `ModelBoundaryRail`

> Axe 6 des besoins (`01-besoins/besoins.md:41-45`). Décision arrêtée : **option C
> hybride** — cellules rendues en segments continus jointifs, ruptures nettes, libellé
> de bloc, colonne conflit superposée. Source d'audit : `00-audit/audit-uiux.json`
> (axe `gutter`, lignes 402-481, verdict `sound: true`).

## 1. Contexte et symptôme

Le gutter (`ModelBoundaryRail.tsx`, composant `ModelBoundaryStrip`) est la réglette
fine rendue à droite de chaque ligne de phrase. Elle affiche, par modèle (Claude /
Codex / Mistral), **où** chacun place ses frontières de clause et, en option, la
catégorie de thème.

Le composant revendique une philosophie d'**alignement natif sans mesure pixel**
(`ModelBoundaryRail.tsx:6-9`) : la bande est rendue *à l'intérieur* de chaque ligne de
phrase, positionnée en absolu `right-1 top-0 bottom-0` de CETTE ligne uniquement
(`DocumentPanel.tsx:818-827`). Il n'existe aucun canvas continu couvrant plusieurs
phrases. C'est un atout (zéro recalcul au scroll/resize, robuste aux hauteurs de ligne
variables) que la refonte doit **conserver**.

Le défaut n'est donc pas la donnée — elle est déjà coalescée en spans propres via
`coalesceRuns` + `segmentsFromRuns` (`DocumentPanel.tsx:211,225` ; `runs.ts:102-113`,
`177-181`) — mais le **rendu** : un run de 8 phrases est dessiné comme 8 mini-cellules
empilées avec interstice (`gap-px`, `ModelBoundaryRail.tsx:59`) et coins arrondis
(`rounded-[1px]`, `:101`). On lit une pile de pastilles, jamais un bloc.

### Constats d'audit (tous vérifiés contre le code)

| # | Problème | Ancre | Gravité |
|---|----------|-------|---------|
| 1 | Cellules par phrase, pas de bloc continu (fragmentation purement visuelle) | `ModelBoundaryRail.tsx:82-132`, `:59`, `:101` | major |
| 2 | Frontière = tick 3px de même teinte sur fond même teinte (25% alpha) → contraste faible ; rupture inter-thèmes sans séparateur | `:113-123`, `:107` | major |
| 3 | Libellé conditionnel : abréviation 3 lettres en `text-[7px]` sur 10px de large, seulement si `showCategory` ON | `:124-129`, `tokens.ts:105-108` | major |
| 4 | `showCategory=false` (défaut, `ui.ts:51`) ⇒ fond gris neutre identique pour tous les segments : on ne distingue plus les thèmes | `:84-110`, `:86` | major |
| 5 | Pas de continuité inter-ligne : chaque phrase redessine sa portion, hauteurs hétérogènes (badge, frontière LLM, traduction FR) cassent la perception du segment | `DocumentPanel.tsx:819-827` | major |
| 6 | Colonne conflit = 4e colonne ambre séparée, non reliée aux modèles qui divergent | `:55-81` | minor |
| 7 | Pas d'en-tête de colonne : association colonne→modèle de mémoire (ordre `models[]`) | `:40-135` | minor |
| 8 | `data-boundary="1"` posé mais aucun style de rupture ne l'exploite | `:95` | minor |

## 2. Options comparées

| Option | Principe | Forces | Faiblesses | Ergonomie | Effort |
|--------|----------|--------|------------|-----------|--------|
| **A — Refonte in-place de la cellule par phrase** | Garde 1 cellule/phrase ; supprime `gap`/arrondis, monte l'alpha, sépare aux ruptures, agrandit l'abréviation | Aucune refonte structurelle ; gains rapides ; risque de régression faible ; cohérent tokens/`identityColor` | Reste 1 nœud DOM/phrase/modèle (perf `O(phrases×modèles)`) ; hauteurs hétérogènes entre lignes ⇒ continuité jamais parfaite ; libellé toujours coincé dans 10px | Plafond ergonomique bas mais cohérent | **S** |
| **B — Réglette à segments rendue par PISTE (1 bloc/run) en overlay aligné** | Une colonne par modèle, un nœud par SEGMENT, positionné par mesure pixel (offsetTop des phrases via refs/ResizeObserver) | Vraie continuité ; un seul nœud par segment ; libellé complet centré dans le bloc ; conflits dessinés en surbrillance | Introduit la **mesure pixel** que le code évite explicitement (`ModelBoundaryRail.tsx:6-9`) ; recalcul scroll/resize ; risque de désalignement avec hauteurs de ligne variables (badges, frontière LLM, FR) ; refonte lourde | Excellent fit cible mais dette d'alignement | **L** |
| **C — Hybride : cellule par phrase MAIS rendue comme segment** ✅ | Garde le rendu par-ligne (zéro mesure) en SIMULANT le bloc : cellules jointives sans arrondi interne, teinte pleine, séparateur net aux ruptures, libellé de bloc, conflit en liseré des colonnes divergentes | Continuité + ruptures + lisibilité SANS dette de mesure ; données déjà prêtes ; réversible ; conserve `data-testid` (tests intacts) | Libellé lisible reste contraint par la largeur (mitigé par élargissement w-3.5 + tooltip riche) ; léger surcoût pour détecter rupture vs continuité | **Meilleur compromis** : conserve « alignement natif sans mesure pixel » tout en livrant les 3 objectifs | **M** |

**Choix retenu : option C.** Elle livre les trois objectifs de l'axe 6 (continuité
B6.2, ruptures nettes B6.3, lisibilité B6.1) sans abandonner l'alignement natif sans
mesure pixel — donc sans la dette de scroll/resize de l'option B. Le verdict d'audit la
valide `sound: true` (`audit-uiux.json:478-481`), avec deux scories sans impact relevées
(voir §6).

## 3. Détails d'implémentation (`ModelBoundaryStrip`)

Toute la refonte tient dans `ModelBoundaryStrip` + un calcul amont léger dans
`DocumentPanel.tsx`. **Aucune nouvelle donnée API.**

### 3.1 — Continuité (B6.2)

Pour chaque modèle, comparer le segment de la phrase `i` et de `i-1`. Le helper
`segAt(segments, i)` **existe déjà** (`ModelBoundaryRail.tsx:32-34`) et est réutilisable
tel quel pour `i-1` — l'audit le présente comme « à ajouter », c'est une scorie : il est
déjà là.

```tsx
const seg     = m.hasData ? segAt(m.segments, sentenceIndex) : undefined;
const prevSeg = m.hasData ? segAt(m.segments, sentenceIndex - 1) : undefined;
const isStart = seg != null && seg.startSentence === sentenceIndex;
const isEnd   = seg != null && seg.endSentence === sentenceIndex; // dérivé de GutterSegment.endSentence
```

Rendu jointif :

- Retirer `gap-px` du conteneur `role="row"` (`:59`) → cellules collées verticalement.
- Retirer `rounded-[1px]` du `<button>` cellule (`:101`).
- N'arrondir que les extrémités du run : `isStart ? "rounded-t-[3px]" : ""` +
  `isEnd ? "rounded-b-[3px]" : ""`. Le corps du run n'a aucun coin → un run lit comme
  un bloc vertical continu.

Comme `coalesceRuns` garantit qu'un run = un bloc de thème contigu (deux segments
adjacents de même thème sont impossibles dans un modèle), `isStart`/`isEnd` suffisent à
borner proprement chaque bloc.

### 3.2 — Teinte toujours visible (corrige #4)

Découpler la teinte du toggle. Aujourd'hui `tint = showCategory && token ? token.color
: undefined` (`:86`), donc sans `showCategory` tout devient gris `--surface-border`
(`:108`). Nouveau modèle :

```tsx
const token = seg ? getThemeToken(seg.themeCode) : null;
const tint  = token?.color;                  // TOUJOURS la couleur de catégorie
const alpha = showCategory ? "59" : "33";    // hex alpha : 35% si étiquette, 20% sinon
```

`showCategory` devient un toggle d'**intensité + étiquette**, pas d'apparition : OFF =
bandes de couleur douces (20%), ON = bandes plus saturées (35%) + abréviation. Le fond
gris `--surface-border` ne sert plus qu'aux runs sans thème (ne devrait pas arriver
puisque `segmentsFromRuns` exclut les runs neutres, mais garder le repli).

### 3.3 — Ruptures nettes (B6.3, corrige #2 et #8)

Remplacer le tick 3px (`:113-123`) par un **séparateur de rupture** explicite et un
**liseré saturé** :

- À `isStart` avec un `prevSeg` de thème différent (rupture intra-modèle) : dessiner une
  fine ligne sombre `1px` en `rgb(var(--surface-bg))` au sommet de la cellule **plus**
  un liseré `2px` saturé en `token.color` (couleur de catégorie pleine, pas l'alpha).
- À `isStart` en bord de document (pas de `prevSeg`) : liseré saturé seul.
- Corps de run (même thème adjacent) : **aucun trait** → continuité ≠ rupture
  visuellement, ce qui était le cœur du problème.

```tsx
{isStart && (
  <span
    aria-hidden
    data-testid={`gutter-boundary-${m.id}-${sentenceIndex}`}   // CONSERVÉ (tests)
    className="absolute inset-x-0 top-0 h-[2px]"
    style={{ backgroundColor: token?.color ?? m.identityColor }}
  />
)}
{isStart && prevSeg && (
  <span aria-hidden className="absolute inset-x-0 top-0 h-px"
        style={{ backgroundColor: "rgb(var(--surface-bg))", transform: "translateY(-0.5px)" }} />
)}
```

Le `data-testid="gutter-boundary-${m.id}-${sentenceIndex}"` est **conservé à
l'identique** : le test `modelBoundaryRail.test.tsx` assert sa présence au start
(`gutter-boundary-claude-5`) et son absence en milieu (`gutter-boundary-claude-6`) — la
condition `isStart` ne change pas.

### 3.4 — Libellé de bloc (B6.1, corrige #3)

- Élargir la colonne de `w-2.5` (10px) à **`w-3.5`** (14px) — assez pour 3 lettres en
  `text-[9px]` (au lieu de `text-[7px]` sous le seuil de lisibilité).
- Abréviation au début du run uniquement (`isStart`), centrée. Garder
  `abbrevThemeCode` mais traiter le **risque de collision réel** (voir §3.7 tokens).
- **Libellé complet au survol** : remplacer le `title` natif (`:97`) par un tooltip
  riche flottant côté gauche de la piste, montrant `getThemeToken(...).label` complet +
  la plage `phrases s–e`. Réutiliser le pattern `useAnchoredPosition` +
  `animate-fade-in` déjà employé par `BoundaryEvidence`/`SentenceMenu` (cohérent avec la
  décision 1, RationaleHover). Conserver le `title` natif minimal en repli a11y/tactile.

L'abréviation est l'aperçu compact (toujours visible si `showCategory`), le tooltip est
la vérité lisible. On ne sacrifie pas la largeur de la colonne de lecture.

### 3.5 — Conflits reliés (B6.1, corrige #6)

Transformer la colonne conflit (`:55-81`) : au lieu d'une 4e colonne ambre détachée,
marquer en **liseré ambre** (`border-l-2`/`border-r-2`, `#F59E0B`) les colonnes des
modèles **effectivement en divergence** à cet index. Le conflit devient lisible « entre
Claude et Codex » plutôt qu'une bande sans lien.

La donnée existe déjà : `byIndexByJudge` (`DocumentPanel.tsx:262-269`,
`Record<judgeId, (string|null)[]>`) donne le thème de chaque juge par phrase. Dériver
côté `DocumentPanel` la liste des modèles divergents par index et la passer en prop :

```ts
// DocumentPanel.tsx — à côté de conflictStartByIndex (:244-250)
const conflictModelsByIndex = useMemo(() => {
  const m = new Map<number, Set<string>>();
  for (let i = 0; i < n; i += 1) {
    const present = gutterVisibleModels
      .map((g) => ({ id: g.id, t: byIndexByJudge[g.id]?.[i] ?? null }))
      .filter((x) => x.t != null);
    if (new Set(present.map((x) => x.t)).size >= 2) {
      m.set(i, new Set(present.map((x) => x.id)));  // tous les présents à un index conflictuel
    }
  }
  return m;
}, [gutterVisibleModels, byIndexByJudge, n]);
```

Nouvelle prop `ModelBoundaryStrip` : `conflictModelIds?: Set<string>`. Dans la cellule,
si `conflictModelIds?.has(m.id)`, ajouter le liseré ambre. **Conserver** le bouton
conflit existant + son `data-testid="gutter-conflict-${i}"` et `onJump(conflictStart)`
(le test `gutter-conflict-4` doit passer) — on le garde comme zone clickable de saut,
mais on lui retire son rôle de « 4e colonne » : il peut devenir une fine poignée
intégrée plutôt qu'une colonne pleine de 10px.

### 3.6 — Hiérarchie des colonnes (corrige #7)

Ajouter un **mini-entête sticky** par colonne : une pastille `m.identityColor` (et/ou
`m.initial`, déjà sur `GutterModel`, `:26,:29`, peuplés `DocumentPanel.tsx:224,227`) en
haut de la réglette, rappelant quel modèle sans survol. Comme la réglette est rendue
par-ligne (pas de conteneur continu), l'entête se pose le plus simplement dans le
conteneur de la **colonne de lecture** (un petit bandeau aligné sur `right-1` au-dessus
de la première phrase), ou en répétant la pastille identité en tête de chaque run
(`isStart`). Privilégier la 2e voie (zéro nouvelle structure DOM hors-flux) : à
`isStart`, sous le liseré, un point `identityColor` de 3px.

### 3.7 — Tokens : abréviation non collisionnante

`abbrevThemeCode` prend les 3 premières lettres du 1er mot (`tokens.ts:105-108`).
L'exemple de collision de l'audit (`license`/`limitation`) est **faux** (LIC vs LIM),
mais de **vraies** collisions existent : `LIMITATION` vs `LIMITATION_OF_LIABILITY` (LIM
vs LIM), `TERMINATION` vs `TERM_*` (TER vs TER). Recommandation :

- Ajouter un champ optionnel `abbrev?: string` à `ThemeToken` (`tokens.ts:7-12`),
  rétro-compatible (peuplé depuis `vocabulary.yaml`/`design-tokens.json` quand fourni).
- `abbrevThemeCode(code)` lit `getThemeToken(code).abbrev` si présent, sinon le calcul
  actuel. Aucun thème existant ne casse (repli inchangé).
- Le **libellé complet** restant au tooltip (§3.4), la collision d'abréviation n'est
  qu'esthétique : non bloquante.

## 4. Impacts

### Frontend
- `ModelBoundaryRail.tsx` — réécriture du rendu de `ModelBoundaryStrip` (jointif,
  teinte découplée, séparateur de rupture, liseré conflit, libellé, entête colonne).
  Nouvelle prop `conflictModelIds?: Set<string>`. `ModelBoundaryLegend` inchangée hormis
  le libellé du toggle « Catégories » → « Catégories » reste, mais sa sémantique passe à
  *intensité/étiquette* (cf. §3.2).
- `DocumentPanel.tsx` — ajouter `conflictModelsByIndex` (§3.5) et le passer au strip
  (`:819-827`). Aucune autre donnée.
- `runs.ts` — `GutterSegment` porte déjà `endSentence` (`:163-170`) ; rien à ajouter,
  `isEnd` est dérivé. `segAt` déjà présent.
- `tokens.ts` — champ optionnel `abbrev` + lecture dans `abbrevThemeCode` (§3.7).
- `store/ui.ts` — `gutterShowCategory` reste un booléen persisté ; seule sa sémantique
  d'usage change (pas de migration de schéma de stockage).

### Backend / data
**Aucun.** Tous les segments continus et zones de conflit dérivent déjà du front
(`coalesceRuns`/`segmentsFromRuns`/`conflictZones`, `byIndexByJudge`). « Aucune donnée
API nouvelle » est confirmé par le verdict (`audit-uiux.json:476`).

### Accessibilité
- Conserver `role="row"` sur le conteneur et `aria-label`/`title` riches par cellule.
- Le liseré de rupture et le liseré conflit sont `aria-hidden` (purement visuels) ;
  l'information textuelle reste portée par `aria-label`/`title` (modèle · thème · plage,
  + « en conflit avec N modèles » quand applicable).
- Couleurs : ne pas reposer sur la seule teinte. La rupture est portée par le
  **séparateur** (forme) en plus de la couleur ; le conflit par le **liseré** (position)
  en plus de l'ambre. L'identité de modèle garde `identityColor` **et** `initial`
  (daltonisme). Vérifier le contraste du séparateur sombre sur fond clair (thème light)
  via `--surface-bg`.
- `prefers-reduced-motion` : le tooltip riche réutilise `animate-fade-in` (déjà borné)
  et doit être désactivé/instantané sous reduced-motion (cohérent avec le système).

### Performance
- L'option C **conserve** la complexité actuelle `O(phrases × modèles)` en nœuds DOM
  (1 cellule/phrase/modèle) — elle ne l'aggrave pas. Le calcul `prevSeg` par cellule est
  un `Array.find` sur les segments d'un modèle (peu nombreux) : négligeable. Le verdict
  note ce point comme « peu coûteux, conforme aux patterns existants ».
- `conflictModelsByIndex` est `O(phrases × modèles)` mémoïsé, recalculé seulement quand
  `gutterVisibleModels`/`byIndexByJudge`/`n` changent. Aucun recalcul au scroll (atout de
  l'alignement natif préservé). Documents 139+ phrases : pas de régression.

## 5. Tests (non-régression + nouveaux)

`tests/modelBoundaryRail.test.tsx` doit rester **vert sans modification** : la refonte
conserve la structure `<button>` par cellule et tous les `data-testid` —
`model-gutter-row-*`, `gutter-cell-<id>-*`, `gutter-boundary-<id>-*`,
`gutter-conflict-*`, `gutter-conflict-start-*`, `gutter-toggle-<id>`,
`gutter-toggle-category`. Les assertions existantes (marqueur au start, absent en
milieu, cellule sans segment désactivée, clic-centrer, clic conflit → 1re phrase, toggles
persistés) restent valides.

Nouveaux tests à ajouter :
- **Continuité** : sur un run `[5,7]`, la cellule 6 (milieu) n'a ni `rounded-t` ni
  `rounded-b` ni séparateur ; la cellule 5 a `rounded-t` + liseré, la cellule 7 a
  `rounded-b`.
- **Teinte sans toggle** : `showCategory={false}` ⇒ la cellule d'un segment porte une
  couleur de catégorie (alpha 20%), PAS le gris neutre `--surface-border` (vérifier le
  style inline). Régression directe du constat #4.
- **Liseré conflit** : `conflictModelIds={new Set(["claude"])}` ⇒ la cellule
  `gutter-cell-claude-*` porte le liseré ambre, `gutter-cell-codex-*` non.
- **Abréviation non collisionnante** : `abbrevThemeCode` lit `abbrev` du token quand
  fourni (test unitaire `tokens`).

## 6. Scories d'audit à ignorer (relevées par le verdict)

1. `segAt` présenté comme « à ajouter » alors qu'il **existe déjà** (`:32-34`).
2. Exemple de collision `abbrevThemeCode` (`license`/`limitation`) **inexact** (LIC/LIM
   distincts) ; les vraies collisions sont `LIMITATION`/`LIMITATION_OF_LIABILITY` et
   `TERMINATION`/`TERM_*`. Le besoin (champ `abbrev`) reste réel.

Ces deux points ne changent pas la conception ; ils évitent du travail redondant et un
exemple trompeur.
