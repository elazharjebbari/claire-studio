# Lot Minimap — `DocumentMinimap` (Axe 5)

> Décision arrêtée (audit, axe `minimap`, verdict `sound:true`) : **Option C — minimap
> verticale type éditeur de code** (cadre viewport + bandes de thèmes), avec repli
> gracieux en barre de progression et toggle persisté.
>
> Source d'audit : `00-audit/audit-uiux.json` (axe `minimap`, lignes 325-399).
> Besoin tracé : `01-besoins/besoins.md` **B5.1** — « un petit cadre montrant **où** on
> consulte dans le document courant ».

---

## 1. Problème et exigence

Le workspace ne possède **aucun indicateur de position de scroll**. La seule notion de
« position » est `focusedSentence` (`store/workspace.ts:81`), qui suit le **curseur**
clavier/clic, jamais le **viewport** réellement affiché. Quand l'utilisateur scrolle à la
molette, **aucun état applicatif ne bouge** (aucun `onScroll`, aucun `IntersectionObserver`
dans tout `components/workspace/` — vérifié par grep dans l'audit).

L'exigence B5.1 demande littéralement « un petit cadre montrant **où** on consulte » : ce
n'est pas une simple barre de % mais un **repère spatial** sur la structure du document
(139+ phrases, thèmes colorés, frontières, conflits).

### 1.1 Verrou architectural (bloquant pour A/B/C)

Le **conteneur scrollable n'appartient pas à `DocumentPanel`** mais à `ResizablePanels` :

```tsx
// ResizablePanels.tsx:152-158
<section
  role="region"
  className="h-full flex-1 overflow-y-auto bg-reading"
  aria-label="Document"
>
  {center}            {/* ← DocumentPanel est injecté ici, sans ref vers le scroller */}
</section>
```

`DocumentPanel` ne reçoit **aucune ref** vers ce nœud et n'a **aucun `onScroll`**. Toute
minimap — quelle que soit l'option — doit donc d'abord **obtenir une ref vers le conteneur
qui scrolle**. C'est le pré-requis n°1.

---

## 2. Options comparées

| Option | Description | Forces | Faiblesses | Ergonomie / fit | Effort |
|---|---|---|---|---|---|
| **A. Surbrillance de plage dans la TocPanel** | Mettre en évidence la plage visible parmi les `ClauseChip` du plan (`TocPanel.tsx:183-195`). | Réutilise le plan ; zéro nouvelle surface ; 1 seul état (`firstVisibleIndex`) comparé aux ancres. | **Granularité grossière** : la TOC ne liste que les *clauses*, pas les 139 phrases — entre 2 clauses, on ne sait pas où on est. Ne montre **ni la hauteur du viewport ni la densité**. Inutile sur documents peu annotés. | Cohérent (réutilise `ClauseChip`) mais répond **mal** à « OÙ je consulte ». | S |
| **B. Barre de progression (rail fin sticky)** | Un seul ratio `scrollTop/scrollHeight`, rendu en `role="progressbar"`. | Très léger ; aucun recalcul par phrase ; accessible. | Donne la **position %** mais **pas le contenu** (ni thèmes, ni frontières, ni conflits) ; pas de saut précis vers une zone vue d'avance ; n'exploite pas la data déjà calculée (`runs`, `conflictZones`, `unfairness`). | Cohérent mais minimaliste ; ne tire pas parti de l'identité « atelier ». | S |
| **C. Minimap verticale type éditeur** ✅ | Colonne fine (~12 px), 1 bande/phrase peinte à la couleur du run, **cadre translucide = viewport**, clic = saut, drag = scroll fluide ; surimpression frontières/conflits/injustice. | Répond **pleinement** à l'axe ; **toute la data existe déjà** côté client (couleurs, frontières, conflits, injustice) → fort ROI design ; saut direct + drag. | Plus de code (composant + gestion scroll/resize) ; nécessite la ref de scroll ; **piège perf** à éviter (ne pas lire 139 `getBoundingClientRect` par event de scroll). | Excellent : esthétique « atelier », repérage immédiat de structure + position ; s'aligne avec `ModelBoundaryRail` et la piste de validation déjà en marge. | M |

### 2.1 Choix justifié — Option C avec repli B

On retient **C** car c'est la **seule** option qui satisfait littéralement B5.1 (« un petit
cadre ») tout en capitalisant sur des données **déjà calculées** dans `DocumentPanel` :

- couleurs de thème par phrase : `runAt(runs, i)` + `getThemeToken(run.theme).color`
  (`DocumentPanel.tsx:580-581`) ;
- frontières « tous modèles confondus » : `boundaryStarts` (`DocumentPanel.tsx:237-242`) ;
- conflits inter-modèles : `conflictStartByIndex` (`DocumentPanel.tsx:244-249`) ;
- injustice CLAUDETTE : `unfairIndex` (`DocumentPanel.tsx:170`) ;
- couleurs d'accord en mode compare : `#34D399` / `#FBBF24` (`DocumentPanel.tsx:586-593`).

**Aucun nouvel endpoint ni champ** n'est requis : le coût est **100 % frontend**.

**B n'est pas abandonnée** : elle devient le **repli responsive** de C (sous un seuil de
largeur du panneau central, la minimap pleine voudrait trop d'espace de lecture → on rend
la barre de progression à la place). **A est un bonus** quasi gratuit une fois le state de
scroll disponible (surligner la plage visible dans la TocPanel), mais hors périmètre de ce
lot.

---

## 3. Pré-requis architectural : remonter le conteneur de scroll

### 3.1 Voie retenue — lifter `overflow-y-auto` dans `DocumentPanel`

On **déplace** la propriété de scroll de `ResizablePanels` vers `DocumentPanel`, ce qui
donne à ce dernier une **ref directe sur SON conteneur de scroll**, sans prop drilling.

**`ResizablePanels.tsx:152-158`** — la `<section>` devient un simple conteneur en
`overflow-hidden` :

```tsx
<section
  role="region"
  className="relative h-full flex-1 overflow-hidden bg-reading"  // overflow-y-auto → overflow-hidden ; + relative
  aria-label="Document"
>
  {center}
</section>
```

> `relative` est ajouté pour servir de **bloc de positionnement** au cas où l'on choisirait
> de poser la minimap en `absolute` au niveau de la `<section>` plutôt que dans le scroller
> (voir §4.4). `bg-reading` reste ici pour que le fond couvre la zone même hors flux.

**`DocumentPanel`** — on enveloppe le contenu de lecture dans un div scrollable porteur de
la ref :

```tsx
const scrollRef = useRef<HTMLDivElement>(null);
// ...
return (
  <>
    <div ref={scrollRef} className="h-full overflow-y-auto bg-reading">
      <div className="flex justify-center gap-4 px-6 py-8">   {/* ex-DocumentPanel.tsx:380 */}
        {/* …colonne de lecture + ComparePanel sticky… */}
      </div>
    </div>
    {/* popovers (SentenceMenu, BoundaryEvidence) restent en frères, fixed */}
  </>
);
```

#### Points de vigilance (relevés par le verdict d'audit, à ne pas rater)

1. **Sticky toolbar** — `document-controls` est `sticky top-0 z-20` (`DocumentPanel.tsx:388-390`).
   `sticky` se résout contre le **plus proche ancêtre scrollable** : en déplaçant
   l'`overflow-y-auto` dans le nouveau div, la toolbar reste correctement collée. ✔
2. **Fond + centrage + ComparePanel sticky** — `bg-reading`, le centrage `flex justify-center`
   et le `px-6 py-8` vivent dans le **div externe de `DocumentPanel`** (`DocumentPanel.tsx:380`),
   et le bloc `ComparePanel` sticky (`top-4`, vers `DocumentPanel.tsx:834-844`) est un
   **frère** de la colonne de lecture dans ce même div externe. **Le nouveau wrapper
   scrollable doit englober tout ce div externe** (et non la seule colonne de texte), sinon
   le `sticky top-4` du ComparePanel et le fond de lecture cassent. C'est pourquoi le
   `ref={scrollRef}` est posé **au-dessus** de `flex justify-center` ci-dessus.
3. **Double `ResizeObserver`** — `ResizablePanels` exécute déjà un `ResizeObserver` sur son
   conteneur (`ResizablePanels.tsx:53-65`) pour les largeurs ; le `ResizeObserver` qu'on
   ajoute sur `scrollRef` (§4.3) est **additif et sans effet de bord**. ✔

### 3.2 Voie alternative (rejetée) — prop `scrollRef` depuis `ResizablePanels`

`ResizablePanels` exposerait une `callback ref`/`onScroll` au `center` via une nouvelle prop.
Rejetée : prop drilling d'une ref de scroll à travers `AnnotationWorkspace`, couplage de
`ResizablePanels` (composant de layout générique) à un détail du `DocumentPanel`, et la
sticky toolbar resterait ancrée à la `<section>` parente — moins propre que la voie 3.1.

---

## 4. Composant `DocumentMinimap.tsx` (à créer)

`frontend/src/components/workspace/DocumentMinimap.tsx`

### 4.1 Contrat de props

```ts
export interface DocumentMinimapProps {
  /** Conteneur de scroll (le div lifté en §3.1). */
  scrollRef: React.RefObject<HTMLElement>;
  /** Nombre total de phrases (= sentences.length). */
  n: number;
  /** Couleur de thème par phrase, index → couleur CSS | null. Mémoïsé en amont. */
  sentenceColors: (string | null)[];
  /** Index de début de frontière « tous modèles confondus » (tick plus opaque). */
  boundaryStarts: number[];
  /** Index de début de zone de conflit inter-modèles (liseré ambre). */
  conflictStarts: Set<number>;
  /** Index marqués « injustice CLAUDETTE » (point rouge fin). */
  unfairnessByIndex: Set<number>;
  /** Phrase focalisée (curseur) — marqueur accentué. */
  focused: number;
  /** Saut vers une phrase (clic minimap). */
  onJump: (index: number) => void;
}
```

> **Adaptateurs au point d'appel** (relevés par le verdict d'audit) :
> - `conflictStartByIndex` est une `Map<number, number>` (`DocumentPanel.tsx:244-249`), pas
>   un `Set`. Passer `new Set(conflictStartByIndex.keys())`.
> - `unfairIndex` est une `Map<number, UnfairnessMark>` (`DocumentPanel.tsx:170`). Passer
>   `new Set(unfairIndex.keys())`.

### 4.2 `sentenceColors` — un memo unique côté `DocumentPanel`

On expose **un seul** tableau mémoïsé, recalculé uniquement quand `runs`/source changent :

```ts
const sentenceColors = useMemo<(string | null)[]>(
  () =>
    Array.from({ length: n }, (_, i) => {
      if (isCompare) {
        // Parité visuelle avec le rail : accord/divergence, pas un thème.
        const themes = selectedCompareIds
          .map((id) => byIndexByJudge[id]?.[i] ?? null)
          .filter((t): t is string => t != null);
        if (themes.length === 0) return null;
        return new Set(themes).size === 1 ? "#34D399" : "#FBBF24";
      }
      const r = runAt(runs, i);
      return r?.theme ? getThemeToken(r.theme).color : null;
    }),
  [n, runs, isCompare, selectedCompareIds, byIndexByJudge],
);
```

C'est le **même** vocabulaire de couleurs que le rail gauche (`DocumentPanel.tsx:580-593`)
→ cohérence garantie entre la marge et la minimap.

### 4.3 Rendu

- **Colonne fixe ~12 px** posée en overlay à droite du panneau central, alignée **sous la
  sticky toolbar**. Positionnement : `sticky` (top aligné sur la hauteur de la toolbar) à
  l'intérieur du scroller, OU `absolute` dans la `<section>` `relative` de §3.1 — préférer
  `sticky top-[var(--toolbar-h)] right-1` pour suivre le scroll sans JS.
- **Bandes uniformes** : chaque phrase = une bande de hauteur `H/n` (`H` = hauteur de la
  minimap). `fill = sentenceColors[i]` à **opacité ~0.5** ; bande neutre si `null`.
  - **tick plus opaque** (1 px, pleine opacité) sur `boundaryStarts` ;
  - **liseré ambre** (`#FBBF24`) en bord gauche sur `conflictStarts` ;
  - **point rouge fin** (`bg-danger`/rouge) sur `unfairnessByIndex` ;
  - **marqueur du `focused`** : fin liseré `ring-accent/40` (réutilise l'accent du focus,
    `DocumentPanel.tsx:1098`).
- **Cadre viewport** : un `<div>` translucide (`bg-ink/10` + `ring-1 ring-accent/40`) dont
  `top = (scrollTop / scrollHeight) * H` et `height = (clientHeight / scrollHeight) * H`.
- **Toggle de repli responsive** : sous un seuil de largeur du panneau central
  (mesurable via le `ResizeObserver` de §4.3, ou un `clientWidth < seuil`), rendre la
  **variante barre de progression** (option B) : un rail vertical 4 px + curseur ratio
  `scrollTop/scrollHeight` en `role="progressbar"`.

### 4.4 État de scroll et **stratégie perf** (139+ phrases)

**Règle d'or** : ne **jamais** lire `getBoundingClientRect` par phrase à chaque event.

1. **Bandes** = grille à hauteur uniforme → **un seul `map` mémoïsé** sur `sentenceColors`,
   re-rendu uniquement quand `runs`/source changent. Extraire les bandes dans un
   **sous-composant `React.memo`** (`MinimapBands`) pour qu'elles **ne re-rendent pas** au
   scroll.
2. **Cadre viewport** piloté par un `onScroll` (ou listener) sur `scrollRef`, **throttlé en
   `requestAnimationFrame`**, qui ne met à jour qu'un state de **3 nombres**
   `{ scrollTop, scrollHeight, clientHeight }`. Seul l'overlay du cadre re-render au scroll.
3. **`ResizeObserver`** sur `scrollRef` pour rafraîchir `scrollHeight`/`clientHeight` au
   redimensionnement de panneau (les `Handle` de `ResizablePanels` changent la largeur → le
   texte se reflow et `scrollHeight` change).

```ts
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  let raf = 0;
  const read = () =>
    setScroll({ scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; read(); });
  };
  read();
  el.addEventListener("scroll", onScroll, { passive: true });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
  ro?.observe(el);
  return () => {
    el.removeEventListener("scroll", onScroll);
    ro?.disconnect();
    if (raf) cancelAnimationFrame(raf);
  };
}, [scrollRef]);
```

### 4.5 Interactions

- **Clic** sur la minimap → `index = Math.round((y / H) * n)` → `onJump(index)` câblé sur
  `focusSentence(index)` (`store/workspace.ts:340`), qui déclenche le `scrollIntoView`
  existant (`DocumentPanel.tsx:373-376`).
- **Drag du cadre** → écrire directement `scrollRef.current.scrollTop = (y / H) * scrollHeight`
  (scroll fluide **sans** changer `focused` — la lecture n'est pas un acte d'annotation).
- **Survol d'une bande** → `title`/`aria-label` « Phrase {i} — {thème} ».

---

## 5. Toggle persisté — store UI

Ajouter `showMinimap` au store UI sur **exactement le même pattern** que `readingWide`
(`store/ui.ts:54`, `:67`, `:80`) :

```ts
// store/ui.ts — interface UiState
showMinimap: boolean;
toggleMinimap: () => void;
// défaut
showMinimap: true,
// action
toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
// partialize (claire.ui)
showMinimap: s.showMinimap,
```

**Toggle UI** : ajouter une case à cocher dans le `fieldset` **Overlays** de la `TocPanel`
(`TocPanel.tsx:198-234`), à côté de « Traduction (FR) » :

```tsx
<label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink">
  <input type="checkbox" data-testid="toggle-minimap" checked={showMinimap} onChange={toggleMinimap} />
  Minimap
</label>
```

`DocumentPanel` ne rend `<DocumentMinimap …/>` que si `showMinimap === true`.

---

## 6. Accessibilité

- La minimap est une **aide de navigation**, **redondante** avec le scroll natif et la
  navigation au focus : ne pas en faire un piège clavier. Conteneur `role="navigation"`
  `aria-label="Minimap du document"`.
- Bandes décoratives : `aria-hidden`, l'information thème étant déjà portée par le texte et
  par la piste de validation.
- Le **cadre viewport** porte `role="img"` / `aria-label` « Zone affichée : phrases X à Y ».
- Repli **barre de progression** : `role="progressbar"` + `aria-valuemin/now/max` (même
  pattern que `TocPanel.tsx:111-124`).
- `prefers-reduced-motion` : pas d'animation sur le déplacement du cadre (transform
  instantané) ; le `scrollIntoView({ behavior: "smooth" })` existant reste géré par l'OS.
- **Toggle off** par préférence persistée : aucune obligation visuelle.

---

## 7. Impacts

### Frontend
| Fichier | Changement |
|---|---|
| `frontend/src/components/workspace/DocumentMinimap.tsx` | **À créer** — composant + sous-composant `MinimapBands` mémoïsé + repli barre de progression. |
| `frontend/src/components/workspace/DocumentPanel.tsx` | Lift du scroll (`scrollRef` autour du div `flex justify-center`, lignes ~378-380) ; memo `sentenceColors` (§4.2) ; insertion conditionnelle de `<DocumentMinimap>` ; adaptateurs `Set` pour `conflictStartByIndex`/`unfairIndex`. Lignes clés : 237-249, 373-388, 580-593. |
| `frontend/src/components/workspace/ResizablePanels.tsx` | `<section>` (152-158) : `overflow-y-auto` → `overflow-hidden` + `relative`. |
| `frontend/src/store/ui.ts` | `showMinimap` + `toggleMinimap` + `partialize` (pattern `readingWide`, 54/67/80). |
| `frontend/src/components/workspace/TocPanel.tsx` | Case « Minimap » dans le `fieldset` Overlays (198-234). |

### Backend / Data
**Aucun.** Toute la donnée est déjà côté client (runs, frontières, conflits, injustice,
`focusedSentence`). Seul état nouveau : `ui.showMinimap` (persisté) + un state local de
scroll `{scrollTop, scrollHeight, clientHeight}`.

### A11y / Perf
- A11y : couvert §6.
- Perf : couvert §4.4 (bandes mémoïsées + cadre piloté rAF + `ResizeObserver`, **zéro**
  `getBoundingClientRect` par phrase). Le re-render au scroll est limité à l'overlay du
  cadre (3 nombres).

---

## 8. Critères d'acceptation (B5.1)

- [ ] Le scroll molette/clavier **met à jour** la position du cadre viewport (état applicatif).
- [ ] La minimap peint **1 bande/phrase** à la couleur du thème, avec frontières/conflits/injustice surimprimés.
- [ ] **Clic** = saut à la phrase ; **drag du cadre** = scroll fluide.
- [ ] Toggle « Minimap » persiste entre sessions (`claire.ui`).
- [ ] Sous le seuil de largeur, repli en **barre de progression** sans voler d'espace de lecture.
- [ ] La sticky toolbar et le ComparePanel sticky **restent corrects** après le lift du scroll.
- [ ] Aucune régression perf sur un document 139+ phrases (pas de jank au scroll).

---

## 9. Plan de tests

- **Vitest (pur)** : géométrie des bandes (`index → top/height`), inversion clic→index
  (`Math.round((y/H)*n)`), seuil de repli, adaptateurs `Map → Set`.
- **Vitest + RTL** : `toggle-minimap` bascule `showMinimap` et persiste ; `onJump` appelle
  `focusSentence`.
- **Playwright** : scroll du conteneur → le cadre se déplace ; clic minimap → la phrase
  cible reçoit le focus et est visible ; non-régression de la sticky toolbar (reste collée).
- **MSW** : non requis (aucun appel réseau nouveau).
