# Lot Hover Rationale — `RationaleHover` (Axe 1)

> Décision arrêtée (audit, axe `hover-rationale`, verdict `sound:true`) : **Option B —
> popover React de hover dédié**, déclenché au survol prolongé (~300 ms), `pointer-events-none`,
> fermé après un tampon anti-papillotement (~120 ms).
>
> Source d'audit : `00-audit/audit-uiux.json` (axe `hover-rationale`, lignes 4-68).
> Besoins tracés : `01-besoins/besoins.md` **B1.1** (au hover d'une phrase, afficher le
> `rationale` qui explique le choix du thème) et **B1.2** (ne pas gêner la lecture ni la
> sélection / long-press / clic-droit).

---

## 1. Problème et exigence

Le `rationale` humain n'est **exposé nulle part au survol** d'une phrase. Le `<span>` de
texte de `SentenceRow` (`DocumentPanel.tsx:1110-1124`) ne porte **aucun** `title` ni
`aria-describedby`. Les seules infos au survol existantes sont :
- le `title` statique des ghosts LLM (`DocumentPanel.tsx:1138`, « Frontière proposée par
  {judge} … : {theme} », **sans** rationale) ;
- le `title` du bouton boundary-peek (texte fixe).

Le rationale **humain** (`DraftClause.rationale`, `store/workspace.ts:46`) n'est lisible que
dans l'`InspectorPanel` (textarea, sur la clause **sélectionnée**) ou via le clic-droit
(`SentenceMenu`). Le rationale **LLM** est pourtant **déjà calculé par phrase** (via
`detailMapByJudge` + `detailAt`, `DocumentPanel.tsx:150-159` et `:924-940`) mais n'apparaît
qu'au clic-droit/long-press (`SentenceMenu` `JudgeBlock`).

→ B1.1 demande de rendre ce rationale visible **au seul survol, sans clic** ; B1.2 impose de
**ne casser ni la lecture ni la sélection** (long-press ~450 ms `useLongPress.ts:47`,
`onClick` focus+sélection `DocumentPanel.tsx:771-791`, drag de blocs `useBlockDragSelect`,
`scrollIntoView` au focus `DocumentPanel.tsx:373-376`).

### 1.1 La donnée est déjà disponible — aucun besoin backend

| Donnée | Source (déjà présente) |
|---|---|
| Rationale **humain** | `DraftClause.rationale` (`store/workspace.ts:44-46`), défaut `""` (`:389/457/518/566`) — alimenté par `fromClause`. Accessible au call site via `anchorByIndex.get(index)` (`DocumentPanel.tsx:552`, `:171-174`). |
| Evidence **humain** | `DraftClause.evidenceSpan` (`store/workspace.ts:44-46`). |
| Rationale / evidence **LLM** par phrase | `JudgeDetail` (`SentenceMenu.tsx:28-36`), construit par `buildJudgeDetailMap` (`DocumentPanel.tsx:904-917`) + résolu par `detailAt(detailMapByJudge[id], runsByJudge[id], index)` (`:924-940`). |
| Thème + couleur | `getThemeToken(theme)` (puce + label, cf. badge `DocumentPanel.tsx:671-676`). |
| Libellé de juge | `llmJudgeLabel(id)` (`lib/llmJudges.ts:30`). |

> Limite à respecter : `DraftClause.rationale` vaut `""` par défaut tant que l'humain n'a
> rien saisi (`store/workspace.ts:389` etc.). **Le hover ne doit s'afficher que s'il y a de
> la matière** (rationale humain non vide **OU** au moins un détail LLM non nul), sinon il
> gêne la lecture pour rien.

> Note (axe 2) : `PreClause` **n'expose pas** `legal_nature` aujourd'hui (`types/contract.ts:316-321`).
> La nature LLM dépend de la chaîne backend décrite à l'axe `legal-nature` ; **ce lot
> n'attend pas cette dépendance**. Quand `JudgeDetail.legalNature` existera, le hover pourra
> l'afficher dans la même ligne par juge (champ optionnel, dégradé propre si absent).

---

## 2. Options comparées

| Option | Description | Forces | Faiblesses | Ergonomie / fit | Effort |
|---|---|---|---|---|---|
| **A. Attribut `title` natif** | `title={thème + rationale}` sur le `<span>` de texte (`DocumentPanel.tsx:1110-1124`). | ~3 lignes ; zéro JS, zéro dépendance ; accessible ; le long-press OS le montre sur tactile. | **Latence ~1 s** ; fermeture au moindre mouvement ; **aucune mise en forme** (pas de puce de thème, evidence en italique, dépliage) ; tronqué par l'OS ; ne distingue pas humain/LLM ; ne couvre pas le rationale LLM riche. | Cohérent mais **pauvre** ; régression de qualité face aux popovers stylés (`SentenceMenu`, `BoundaryEvidence`). | S |
| **B. Popover React `RationaleHover`** ✅ | Popover positionné via `useAnchoredPosition`, animation `fade-in`, délai ~300 ms, `pointer-events-none`. | **Contrôle total** du contenu (puce+label thème, rationale humain, mini-résumé par juge, evidence en italique) ; délai réglable ; fermeture tolérante ; **ne casse ni sélection ni long-press** ; réutilise hook + anim **déjà éprouvés** ; donnée déjà dispo. | Composant à créer + gestion du timer enter/leave + a11y clavier ; veiller à n'ouvrir qu'au survol prolongé. | M |
| **C. Encart latéral persistant (suivi du focus)** | Panneau qui suit le focus, pas le hover. | Zéro interférence ; lecture confortable d'un long rationale ; humain + tous les juges côte à côte. | **Ne répond pas** à la demande (« au **survol** ») : c'est du focus, pas du hover ; **duplique l'`InspectorPanel`** (rationale + `InspectorJudgeCompare` déjà présents) ; consomme de la largeur. | Redondant avec l'inspecteur ; n'apporte pas le geste « survol = aperçu ». | M |

### 2.1 Choix justifié — Option B

On retient **B**, seul choix qui :
1. **respecte la demande** (survol, pas focus ni clic) ;
2. reste **cohérent avec le système** : `useAnchoredPosition` (flip+clamp+`ResizeObserver`,
   `useAnchoredPosition.ts:46-88`) et l'animation `fade-in` (120 ms ease-out,
   `tailwind.config.ts:60-66`) sont **déjà** utilisés par `SentenceMenu` et `BoundaryEvidence` ;
3. ne gêne **ni la lecture ni la sélection** grâce à `pointer-events-none` ;
4. est **complémentaire** du clic-droit/long-press : le hover = **aperçu passif** en lecture,
   le menu = **édition**.

**A rejetée** (qualité insuffisante). **C rejetée** (c'est du focus, redondant avec
l'inspecteur, hors demande).

---

## 3. Composant `RationaleHover.tsx` (à créer)

`frontend/src/components/workspace/RationaleHover.tsx` — **variante passive** de
`BoundaryEvidence` (même squelette `fixed`/`bg-elevated`/`border-line`/`shadow-xl`, **sans**
interactivité : pas de tabs, pas de bouton, pas de listener clic-extérieur/Escape).

### 3.1 Contrat de props

```ts
export interface RationaleHoverProps {
  /** Coordonnées (clientX/clientY) du survol — pour useAnchoredPosition. */
  x: number;
  y: number;
  /** Thème de la clause humaine couvrant la phrase (puce + label). */
  theme: string | null;
  /** Rationale humain (déjà filtré non vide en amont). */
  humanRationale: string | null;
  /** Evidence span humain (citation, optionnelle). */
  humanEvidence: string | null;
  /** Détails par juge présents pour la phrase (ordre LLM_JUDGES). */
  judges: JudgeEntry[];   // réutilisé tel quel depuis ./SentenceMenu
}
```

> `JudgeEntry` (`{ id, label, detail: JudgeDetail | null }`) et `JudgeDetail` sont déjà
> exportés par `SentenceMenu.tsx:28-43`. Le tableau `judges` se construit **exactement**
> comme pour le menu (`DocumentPanel.tsx:866-874`) → réutilisation sans coût.

### 3.2 Positionnement & conteneur

```tsx
const { ref, style } = useAnchoredPosition(x, y);   // flip + clamp + ResizeObserver
return (
  <div
    ref={ref}
    role="tooltip"
    data-testid="rationale-hover"
    className="pointer-events-none fixed z-40 max-w-sm rounded-lg border border-line bg-elevated p-3 text-sm text-ink shadow-xl animate-fade-in"
    style={style}
  >
    {/* contenu §3.3 */}
  </div>
);
```

Différences clés avec `BoundaryEvidence` (qui est `role="dialog"`, `z-50`, interactif) :
- **`pointer-events-none`** → le popover n'intercepte **jamais** le pointeur : `onClick`,
  long-press et drag de sélection de blocs passent à travers vers la phrase. **C'est le
  point qui garantit B1.2.**
- **`z-40`** (sous les vrais dialogues `z-50` : `SentenceMenu`, `BoundaryEvidence`) → si un
  menu s'ouvre, il passe devant le hover.
- **`role="tooltip"`** (aperçu en lecture), pas `dialog`.
- **Aucun** listener clic-extérieur/Escape : la fermeture est pilotée par le hover lui-même
  (§4), pas par interaction utilisateur.

### 3.3 Contenu (3 zones)

1. **Thème** — puce colorée + label, comme le badge (`DocumentPanel.tsx:671-676` /
   `BoundaryEvidence.tsx:179-181`) :
   ```tsx
   <span className="flex items-center gap-1 font-medium text-ink">
     <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: getThemeToken(theme).color }} />
     {getThemeToken(theme).label}
   </span>
   ```
2. **Rationale humain** — tronqué ~160 caractères, **sans bouton « déplier »** (le popover
   est `pointer-events-none`, donc non interactif). Evidence humaine optionnelle en italique
   bordée (style `SentenceMenu.tsx:318-322`) :
   ```tsx
   {humanEvidence && (
     <p className="mt-1 border-l-2 border-line pl-2 italic text-ink-muted">« {humanEvidence} »</p>
   )}
   {humanRationale && <p className="mt-1 text-ink-muted">{truncate(humanRationale, 160)}</p>}
   ```
3. **Mini-résumé par juge** — une ligne condensée par juge **présent** :
   `{Juge} · {label thème}` (réutilise `llmJudgeLabel` + `getThemeToken`), evidence en
   italique tronquée :
   ```tsx
   {judges.filter((j) => j.detail).map((j) => (
     <div key={j.id} className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
       <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getThemeToken(j.detail!.theme).color }} />
       <span className="font-medium">{j.label}</span> · {getThemeToken(j.detail!.theme).label}
     </div>
   ))}
   ```

Si **ni** rationale humain **ni** détail LLM → le composant n'est pas monté (garde en amont,
§4) : on ne montre **jamais** un popover vide.

---

## 4. Câblage dans `DocumentPanel` & anti-papillotement

### 4.1 État et timers

```ts
const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
const openTimer = useRef<number | null>(null);   // délai d'ouverture ~300 ms
const closeTimer = useRef<number | null>(null);  // tampon de fermeture ~120 ms
```

### 4.2 Handlers passés à `SentenceRow` (nouveaux props)

Ajouter à l'interface de `SentenceRow` (`DocumentPanel.tsx:1033-1055`) puis câbler sur le
`<span>` de texte (`DocumentPanel.tsx:1110-1124`) :

```tsx
onPointerEnter={(e) => {
  if (e.pointerType !== "mouse") return;          // ne PAS concurrencer le long-press tactile
  onHoverEnter(e.clientX, e.clientY);
}}
onPointerLeave={() => onHoverLeave()}
```

> **Garde `pointerType === "mouse"`** : crucial face à `useLongPress` (`DocumentPanel.tsx:1057`,
> `useLongPress.ts:47`) — le tactile ouvre le menu par long-press, pas le hover.

Au niveau `DocumentPanel` (où vivent `anchorByIndex`, `detailMapByJudge`, `runsByJudge`),
on calcule la **garde « matière »** AVANT d'armer le timer d'ouverture :

```ts
function hoverEnter(index: number, x: number, y: number) {
  if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  const draft = anchorByIndex.get(index);
  const hasHuman = !!draft?.rationale?.trim();
  const hasLlm = LLM_JUDGES.some((j) =>
    detailAt(detailMapByJudge[j.id] ?? EMPTY_DETAIL, runsByJudge[j.id] ?? EMPTY_RUNS, index),
  );
  if (!hasHuman && !hasLlm) return;               // rien à montrer → pas de popover
  openTimer.current = window.setTimeout(() => setHover({ index, x, y }), 300);
}
function hoverLeave() {
  if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
  closeTimer.current = window.setTimeout(() => setHover(null), 120);  // tampon anti-papillotement
}
```

> Le recalcul `detailAt` par survol est **peu coûteux** (conforme aux patterns existants du
> menu) et n'arrive qu'au mouvement de souris, pas au scroll.

### 4.3 Rendu du popover (frère des autres popovers)

```tsx
{hover && (() => {
  const draft = anchorByIndex.get(hover.index);
  return (
    <RationaleHover
      x={hover.x}
      y={hover.y}
      theme={draft?.theme ?? null}
      humanRationale={draft?.rationale?.trim() ? draft.rationale : null}
      humanEvidence={draft?.evidenceSpan?.trim() ? draft.evidenceSpan : null}
      judges={LLM_JUDGES.map((j) => ({
        id: j.id,
        label: j.label,
        detail: detailAt(detailMapByJudge[j.id] ?? EMPTY_DETAIL, runsByJudge[j.id] ?? EMPTY_RUNS, hover.index),
      }))}
    />
  );
})()}
```

À placer en frère de `SentenceMenu`/`BoundaryEvidence` (`DocumentPanel.tsx:860-886`).

### 4.4 Anti-conflit (synthèse B1.2)

| Geste | Mécanisme anti-conflit |
|---|---|
| Lecture (curseur en mouvement) | Délai d'ouverture **300 ms** → pas de papillotement en survolant ; tampon **120 ms** à la sortie. |
| `onClick` (focus/sélection) | `pointer-events-none` → le clic traverse le popover ; aucun vol de pointeur. |
| Long-press (~450 ms) / clic-droit | Garde `pointerType === "mouse"` → le hover ne s'arme **que** souris ; le tactile garde le long-press. |
| Drag de blocs (`useBlockDragSelect`) | `pointer-events-none` + le hover ferme à la sortie de la phrase. |
| Ouverture du menu (`SentenceMenu` `z-50`) | Le hover (`z-40`) passe **dessous** ; à l'ouverture du menu, fermer le hover (`setHover(null)`) par sécurité. |
| Scroll (`scrollIntoView`) | Le hover ferme quand le pointeur quitte la phrase ; `useAnchoredPosition` reclampe sinon. |

---

## 5. Accessibilité

- **Repli `title` natif minimal** conservé sur le `<span>` de texte : `title={thème + 1re
  phrase du rationale}`. Il sert de **fallback** pour le **tactile** et les **lecteurs
  d'écran** ; le popover riche vient **par-dessus** à la souris. (Aujourd'hui les `<span>`
  frères — mark d'injustice `DocumentPanel.tsx:1117`, ghosts `:1138` — portent déjà un
  `title`, donc le pattern est cohérent.)
- Le popover est `role="tooltip"`, `aria-hidden` n'est **pas** posé (il complète la phrase) ;
  comme il est `pointer-events-none`, il n'est pas focusable et ne piège pas le clavier.
- **Pas d'équivalent clavier nécessaire** : le rationale reste pleinement accessible au
  clavier via la sélection → `InspectorPanel` (textarea) et via le `SentenceMenu` (ouvrable
  au clavier). Le hover est un **plus** souris, pas l'unique chemin.
- `prefers-reduced-motion` : l'animation `fade-in` est légère (opacity + 2 px) ; on peut la
  neutraliser via `motion-reduce:animate-none`.

---

## 6. Impacts

### Frontend
| Fichier | Changement |
|---|---|
| `frontend/src/components/workspace/RationaleHover.tsx` | **À créer** — popover passif (variante de `BoundaryEvidence`). |
| `frontend/src/components/workspace/DocumentPanel.tsx` | État `hover` + timers ; garde « matière » ; props `onHoverEnter/onHoverLeave` ajoutés à l'interface `SentenceRow` (1033-1055) et câblés sur le `<span>` texte (1110-1124) avec garde `pointerType==='mouse'` ; `title` natif de repli ; rendu du popover (frère, 860-886). |
| `frontend/src/components/workspace/useAnchoredPosition.ts` | **Réutilisé** (aucune modif). |
| `frontend/src/components/workspace/SentenceMenu.tsx` | **Réutilisé** : `JudgeEntry`/`JudgeDetail` importés (aucune modif requise pour ce lot). |
| `frontend/tailwind.config.ts` | Animation `fade-in` **déjà présente** (60-66) — aucune modif. |

### Backend / Data
**Aucun.** Rationale/evidence **humain** déjà dans `DraftClause` (`store/workspace.ts:44-46`) ;
rationale/evidence **LLM** déjà exposés via `PreClause.rationale/evidenceSpan`
(`types/contract.ts:316-321`) → `JudgeDetail` (`buildJudgeDetailMap`/`detailAt`). Le hover
conditionne son affichage à la **présence réelle** de texte.

### A11y / Perf
- A11y : couvert §5 (repli `title`, `role="tooltip"`, chemins clavier préservés).
- Perf : ouverture différée 300 ms (pas de re-render au survol bref) ; `detailAt` recalculé
  au survol uniquement (pas au scroll) ; popover unique monté à la fois.

---

## 7. Critères d'acceptation (B1.1 / B1.2)

- [ ] Survol prolongé (~300 ms) d'une phrase **annotée** → popover avec thème + rationale
      (humain et/ou LLM) **sans clic**.
- [ ] Survol d'une phrase **sans matière** (rationale humain vide ET aucun détail LLM) →
      **aucun** popover.
- [ ] Le popover **ne capte pas** le pointeur : clic/focus, long-press et drag de blocs
      fonctionnent identiquement, popover affiché ou non.
- [ ] Sur **tactile**, le hover ne s'arme pas (le long-press ouvre le menu comme avant).
- [ ] Pas de papillotement en balayant plusieurs phrases (délai d'ouverture + tampon).
- [ ] Repli `title` natif disponible pour lecteurs d'écran / tactile.

---

## 8. Plan de tests

- **Vitest (pur)** : la garde « matière » (rationale vide + aucun détail → pas d'ouverture) ;
  troncature à 160 caractères ; sélection des juges `detail != null`.
- **Vitest + RTL** : `onPointerEnter` (souris) après 300 ms → `rationale-hover` monté ;
  `onPointerLeave` → démonté après 120 ms ; `pointerType==='touch'` → jamais monté ;
  ouverture d'un `SentenceMenu` → le hover se ferme.
- **Playwright** : survol → popover visible ; clic **à travers** le popover → la phrase
  reçoit le focus (preuve du `pointer-events-none`) ; non-régression long-press/clic-droit.
- **MSW** : non requis (aucun appel réseau).
