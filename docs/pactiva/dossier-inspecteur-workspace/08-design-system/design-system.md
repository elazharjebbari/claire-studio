# Design System — Workspace d'annotation Pactiva

> Lot **design-arch**. Tokens à utiliser, cohérence des contrôles (segmented / toggle /
> picker), couleurs de thème et de nature, accessibilité, animations `fade-in` et
> `prefers-reduced-motion`. Référentiel transverse pour tous les nouveaux composants du
> dossier (`RationaleHover`, `NaturePicker`, `DocumentMinimap`, `ToolbarShell`/`ToolGroup`,
> `SelectionTools`, `CompareStickyHeader`, `CommentCard`).
>
> Source de vérité couleurs : `frontend/design-tokens.json` (dérivé de
> `dossier/00_overview/vocabulary.yaml`), exposée en CSS variables par
> `frontend/src/app/globals.css` et en classes Tailwind par `frontend/tailwind.config.ts`.

---

## 1. Principe : aucune couleur en dur

Toute couleur passe par un token. Trois canaux :

1. **Surfaces & sémantique** → classes Tailwind adossées à des CSS variables, qui basculent
   automatiquement clair/sombre (classe `.dark`, `tailwind.config.ts:15`). Jamais de hex de
   surface dans un composant.
2. **Couleurs de thème de clause** → `getThemeToken(code).color` (`lib/tokens.ts`), hydraté
   au runtime depuis le schéma API (`setRuntimeThemes`, `AnnotationWorkspace.tsx:83`). Repli
   statique `design-tokens.json`.
3. **Couleurs de nature juridique** → **nouveau** `legalNatureToken(code).color`
   (`lib/tokens.ts`), cf. §4.2.

### 1.1 Tokens de surface (CSS vars, `globals.css`)

| Classe Tailwind | CSS var | Usage |
|---|---|---|
| `bg-bg` | `--surface-bg` | fond applicatif |
| `bg-elevated` | `--surface-bg-elevated` | **popovers, dialogs, overflow, RationaleHover** |
| `bg-panel` / `bg-panel-muted` | `--surface-panel(-muted)` | panneaux, états inactifs de contrôles |
| `bg-reading` | `--surface-reading` | colonne de lecture du document |
| `border-line` | `--surface-border` | toutes les bordures de structure |
| `text-ink` / `text-ink-muted` | `--surface-text(-muted)` | **tout texte** (jamais une couleur de thème comme texte) |
| `bg-accent` / `text-accent` / `text-accent-fg` | `--surface-accent` / `--surface-on-accent` | actif/sélection, action primaire |

### 1.2 Tokens sémantiques (états)

`success` `warning` `danger` `info` (`--sem-*`). Pour les contrôles de barre, **utiliser les
états sémantiques** plutôt que des `emerald-*`/`amber-*`/`red-*` Tailwind bruts (encore
présents dans `StatusPill`/`ClauseChip` — à harmoniser progressivement). Le compare reste sur
le couple `emerald` (accord) / `amber` (divergence) / `slate` (partiel) déjà installé dans
`ComparePanel` (`STATUS_COLOR`) — à conserver tel quel pour la cohérence du strip.

---

## 2. Cohérence des contrôles

L'audit (axe 4) a relevé **trois conventions d'« actif » concurrentes**. La refonte impose
**un seul vocabulaire visuel** par famille de contrôle.

### 2.1 Segmented (radios mutuellement exclusifs) — *référence*

`LlmSourceSwitch` et `LangSwitch` partagent déjà le bon markup → **canon** :

```
conteneur : rounded-md border border-line bg-panel-muted/40 p-0.5
item actif : bg-accent/15 text-ink shadow-sm ring-1 ring-accent/40
item inactif : text-ink-muted hover:text-ink
```

→ S'applique à : `LlmSourceSwitch`, `LangSwitch`, et tout nouveau segmented.
**`shadow-sm` inclus** (l'audit l'avait omis) pour fidélité au modèle `LlmSourceSwitch.tsx:71`.

### 2.2 Toggle (on/off binaire) — *à unifier*

Aujourd'hui « Frontières » est un `<input type=checkbox>` nu, « Attribution »/« Comparer »
un bouton `border-accent/60 bg-accent/10`. **Décision** : standardiser tous les toggles en
bouton `aria-pressed` avec **le motif segmented actif** (§2.1) — un seul état « actif » dans
toute la barre. « Frontières » (`boundary-toggle`) cesse d'être un checkbox natif.

### 2.3 Picker (sélection dans un vocabulaire) — *parité thème / nature / certitude*

| Picker | Composant | ARIA | Couleur |
|---|---|---|---|
| Thème | `ThemePalette` | `listbox` (filtrable) | `getThemeToken().color` |
| **Nature** | **`NaturePicker`** | `radiogroup` (6 items, sans filtre) | **`legalNatureToken().color`** |
| Certitude | `CertaintyPicker` | `radiogroup` | `c.color` du token |

Règles communes :
- **Pastille colorée + libellé textuel** — jamais la couleur seule (a11y, §5).
- Sélection : `ring-2` à la couleur du token (`--tw-ring-color`), fond `${color}` à
  ~0.18–0.22 d'alpha (cf. `ClauseChip.tsx:67`, `CertaintyPicker.tsx:54`). **Le texte reste
  `text-ink`** pour garantir AA 4.5:1.
- Tooltip d'intention : `armTooltip` à **~450 ms** (`ThemePalette.tsx:51-58`) → `NaturePicker`
  réutilise ce délai pour `LegalNature.definition`.
- `describeOnHover` : `ThemePalette` passe en `layout="grid"` + `describeOnHover` dans
  l'inspecteur (tous thèmes visibles, multi-rangées, tooltip).

### 2.4 Boutons & badges (`primitives.tsx`)

`Button` (variants `primary`/`outline`/`ghost`/`subtle`), `Badge`, `Panel`, `Field`,
`StatusPill` restent les primitives de base. **Réutiliser `Field`** pour `NaturePicker` dans
l'inspecteur (label majuscule `text-ink-muted` cohérent). `OverflowMenu` et le popover de
`RationaleHover` réutilisent `bg-elevated border-line shadow-xl` (style dialogs existants).

---

## 3. Couleurs de thème

20 thèmes, palette continue META→MISC (`design-tokens.json:3-24`), du gris neutre au navy/violet.
Conventions :

- **Réservées aux éléments non textuels** : pastille, fond léger (alpha ≤ ~0.18), bordure,
  bande de gutter, bande de minimap. Le commentaire de `ClauseChip.tsx:63-66` fait foi.
- **Gutter (axe 6)** : teinte de catégorie **toujours visible** (alpha ~0.30), le toggle
  « Catégories » devient un réglage d'**intensité/étiquette**, pas d'apparition. Fond gris
  `--surface-border` réservé aux runs **sans** thème.
- **Minimap (axe 5)** : `sentenceColors[i]` à ~0.5 d'alpha ; tick frontière plus opaque ;
  liseré conflit en `warning` ; point injustice fin en `danger`.
- **Abréviations** : `abbrevThemeCode` (3 lettres) suffit pour l'étiquette de gutter, mais le
  **libellé complet** (`getThemeToken().label`) va au tooltip de survol (collisions possibles
  type `TERMINATION`/`TERM_*`). Champ `abbrev`/`short` optionnel à envisager dans `ThemeToken`.

---

## 4. Couleurs de nature juridique (AXE 2)

### 4.1 État actuel
`vocabulary.yaml:33-39` ne fournit que `{code, label, order}` pour les 6 natures
(`OBLIGATION/PROHIBITION/PERMISSION/DEFINITION/DECLARATION/PROCEDURE`) — **ni couleur, ni
definition**. Le type `LegalNature` (`contract.ts:116-123`) supporte déjà `definition?`.

### 4.2 Décision — token de nature
Pour des pastilles fidèles à `ThemePalette`/`CertaintyPicker`, une couleur est **requise**
(et non « optionnelle » comme le suggérait l'audit). Deux ajouts data :

1. **`definition`** sur chaque nature dans `vocabulary.yaml:34-39` (alimente le tooltip).
2. **`color`** par nature (proposition, à figer dans `vocabulary.yaml` + `design-tokens.json`,
   choisie pour rester distincte de la palette de thèmes et lisible AA sur les deux fonds) :

| Code | Sémantique | Couleur proposée |
|---|---|---|
| `OBLIGATION` | devoir contraignant | `#DC2626` (rouge) |
| `PROHIBITION` | interdiction | `#F97316` (orange) |
| `PERMISSION` | faculté | `#22C55E` (vert) |
| `DEFINITION` | définition | `#0EA5E9` (cyan) |
| `DECLARATION` | déclaration | `#8B5CF6` (violet) |
| `PROCEDURE` | procédure | `#6B7280` (gris) |

Helper `legalNatureToken(code) → { code, label, color, definition }` dans `lib/tokens.ts`,
sur le même modèle que `getThemeToken` (table par code + fallback neutre). **Origine claire**
(B2) : nature humaine = pastille pleine ; nature dérivée/LLM = pastille en pointillé ou suffixe
« · dérivé », ou `—` si absente (jamais d'invention).

---

## 5. Accessibilité (a11y)

Exigences transverses (`besoins.md:60-63`).

- **Couleur jamais seule** : toute pastille de thème/nature/certitude est doublée d'un libellé
  textuel (`ClauseChip`, `ThemePalette`, `CertaintyPicker` le font déjà). `DocumentMinimap` :
  chaque bande porte un `title`/`aria-label` (« phrase i — thème »).
- **Rôles ARIA** :
  - `ToolbarShell` → `role="toolbar"` + `aria-orientation` ; chaque `ToolGroup` →
    `role="group"` + `aria-label` (« Source », « Sélection », « Lecture », « Langue »).
  - `NaturePicker` → `role="radiogroup"` / items `role="radio"` + `aria-checked` (modèle
    `CertaintyPicker.tsx:27-40`).
  - `RationaleHover` → popover passif : **pas** de piège de focus ; repli `title` natif sur le
    `<span>` pour clavier/lecteur d'écran/tactile (le riche n'arrive qu'à la souris).
  - `CompareStickyHeader` → score en `role="status"`/`aria-live` (modèle `SaveIndicator`).
- **Clavier** : tout contrôle est focusable et actionnable au clavier (`ThemePalette`
  flèches+Enter ; pickers Espace/Enter). Étape C : adoption divergence `1..N` dynamique.
- **Contrastes** : texte toujours `text-ink`/`text-ink-muted` (AA 4.5:1 garanti par les
  surfaces). Les couleurs de token ne servent que de fond/bordure à faible alpha + ring.
- **Focus visible** : `:focus-visible { outline: 2px solid rgb(var(--surface-accent)) }`
  (`globals.css:74`) — ne pas le supprimer sur les nouveaux contrôles.
- **Cibles tactiles** : conserver les hauteurs de `Button`/segmented existants ; le gutter
  reste fin mais cliquable (zone `onJump`).

---

## 6. Animations

### 6.1 `fade-in` (seule keyframe du système)
`tailwind.config.ts:59-66` : `fade-in 120ms ease-out` (`opacity 0→1`, `translateY 2px→0`).
**À réutiliser tel quel** pour toute apparition de popover/section :

- `RationaleHover` : `animate-fade-in` (cohérent avec `BoundaryEvidence`, `SentenceMenu`).
- `SelectionTools`, `CompareStickyHeader`, `OverflowMenu` : `animate-fade-in` à l'apparition
  conditionnelle (translate-y discret).
- Tooltips de pickers : `animate-fade-in`.

### 6.2 Transitions
Baseline `transition-colors` (toggles, segmented, chips). `CertaintyPicker` utilise
`transition-all` pour le ring/fond — acceptable pour les pickers. **Pas** de nouvelle keyframe :
le système reste minimaliste (une seule animation nommée).

### 6.3 `prefers-reduced-motion`
Déjà géré globalement (`globals.css:112-121`) : neutralise `animation-duration`,
`transition-duration` et force `scroll-behavior: auto` (l'opacité finale est préservée).
**Conséquences pour les nouveaux composants** :

- `RationaleHover`/popovers : apparaissent **instantanément** (opacité finale conservée) — OK.
- `DocumentMinimap` : le saut au clic (`scrollIntoView`/`scrollTop`) devient **instantané**
  (pas de smooth) — conforme. Le suivi du cadre viewport (rAF) n'est pas une animation CSS et
  reste fluide mais peu coûteux ; acceptable car non décoratif.
- Ne **jamais** introduire d'animation décorative non couverte par cette media query.

---

## 7. Checklist d'intégration (par nouveau composant)

- [ ] Couleurs via token (`getThemeToken` / `legalNatureToken` / CSS var) — zéro hex de surface.
- [ ] État « actif » = motif segmented unique (§2.1).
- [ ] Surface popover = `bg-elevated border-line shadow-xl`.
- [ ] Pastille **+ libellé** (jamais couleur seule).
- [ ] Rôle ARIA + `aria-label` + focusable clavier.
- [ ] Apparition = `animate-fade-in` ; aucune keyframe nouvelle.
- [ ] Comportement correct sous `prefers-reduced-motion` (opacité finale, scroll instantané).
- [ ] `data-testid` conservés/ajoutés (non-régression e2e).
- [ ] Lisible en thème **clair** et **sombre** (toutes les surfaces basculent).
