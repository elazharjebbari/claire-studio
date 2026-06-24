# Sélecteur de thèmes unifié (primaire + secondaires) — audit, conception & plan

> Cible : le bloc « Annoter… » du menu **clic-droit** (`SentenceMenu`), aujourd'hui une
> grille de sélection UNIQUE (le primaire) + un `MultiLabelEditor` séparé pour les
> secondaires. Objectif : **une seule grille** où l'on choisit le **primaire** ET les
> **secondaires** (avec ordre 1, 2, …), ergonomie/design impeccables, indice LLM discret.

---

## 1. Audit du fonctionnement actuel

**Composant** : `ThemePalette` (`layout="grid"`) dans `SentenceMenu.tsx:155`.
- Sélection **UNIQUE** : `value = coveringDraft.theme` ; `onChange = handleSetTheme` →
  `toggleBoundary(sentenceIndex, code)` (crée / re-thématise / retire le PRIMAIRE).
- Marquage : `aria-selected` + `font-semibold` + `✓` sur le primaire. Aucun secondaire.

**Secondaires** : bloc SÉPARÉ `MultiLabelEditor` (`SentenceMenu.tsx:188`) — toggle
Mono/Multi (`🏷`) + une **2ᵉ grille** `ThemePalette` pour ajouter un secondaire + chips
pointillés retirables.

**Données** : `ThemeTag {label, role:'primary'|'secondary', support?}` ; `DraftClause.themes`.
Store : `setClauseThemes(localId, themes)` → `sanitizeThemeSet` (dédup, **exactement 1
primaire**, **refuge jamais secondaire**), aligne `theme`↔primaire, valide, purge triage.
`setBoundary`/`toggleBoundary` (primaire), `removeBoundary` (désannote). **L'ordre des
secondaires = l'ordre du tableau** (pas de champ `order` côté front ; le backend en a un).

**Faiblesses (UX/ergonomie)** :
1. **Deux grilles** (primaire, puis secondaire) = redondance, charge cognitive, mêmes 20
   items affichés 2×.
2. **Parcours long** pour le multi : grille 1 (primaire) → bloc Multi → toggle → grille 2
   (secondaire). Beaucoup de clics/scroll dans un popover déjà dense.
3. **Aucune lecture unifiée** « qui est primaire / qui est secondaire et dans quel ordre ».
4. **Indice LLM absent** dans la grille (les propositions des juges sont plus bas).
5. `describeOnHover` (tooltip d'intention) partagé → ok, à conserver.

---

## 2. Améliorations proposées (par axe)

### UX / Ergonomie
- **Une seule grille multi-sélection** : 1ᵉʳ clic = **primaire** ; clics suivants =
  **secondaires** ordonnés (1, 2, …). Re-clic = retire (le retrait du primaire promeut
  automatiquement le 1ᵉʳ secondaire — `sanitizeThemeSet`). **★** sur une option
  sélectionnée = la **promouvoir primaire** (l'ancien primaire redevient secondaire).
- **Refuges** (`PREAMBLE_SCOPE`, `MISC_BOILERPLATE`) : **primaire uniquement** → en
  secondaire, l'option est désactivée avec mention « principal uniquement » (respecte
  l'invariant, évite le clic sans effet dû à `sanitizeThemeSet`).
- **Désannotation** : retirer la dernière sélection retire la clause (cohérent avec
  l'actuel re-clic du primaire). Suppression du `MultiLabelEditor` redondant du menu
  (la grille EST l'éditeur). *(Inspecteur inchangé pour l'instant.)*

### Design / Style
- Option **primaire** : pastille de thème **pleine** + badge **★ Principal** (accent),
  ligne en surbrillance forte (`ring-1 ring-accent/50 bg-accent/10`).
- Option **secondaire** : badge **numéro** rond (`1`, `2`, …) dans la couleur du thème +
  ligne en surbrillance douce (`bg-panel-muted/60`, liseré pointillé gauche couleur thème).
- Option **non sélectionnée** : état actuel (hover léger).
- **Compteur** en en-tête de section : « 1 principal · N secondaire(s) ».

### Indice LLM (discret, non cannibalisant)
- Sur les options correspondant au thème proposé par un juge présent, un **micro-marqueur**
  (initiale du juge, `text-[8px]`, `text-ink-muted/70`, sans fond) à droite du libellé.
  Survol → « Proposé par Claude ». Jamais de couleur forte ni de badge plein. *(Les juges
  ne proposent qu'UN thème/phrase dans la donnée — donc ce sont des indices de
  primaire ; pas de « secondaire LLM » en donnée.)*

### Animation
- Apparition du badge ★/numéro : `transition-colors` + `animate-fade-in` (déjà standard).
- Pas de mouvement de réordonnancement spectaculaire (sobre) ; `prefers-reduced-motion` géré.

### Accessibilité
- `role="listbox"` `aria-multiselectable="true"` ; chaque `<li>` `role="option"`
  `aria-selected` ; le primaire porte un libellé a11y « principal », les secondaires
  « secondaire n ». ★ = bouton `aria-label="Définir comme principal"`. Navigation clavier
  conservée (flèches + Entrée toggle ; touche dédiée pour promouvoir, ex. `p`/`*`).

---

## 3. Conception & architecture

**Nouveau composant** `src/components/ui/ThemeMultiPicker.tsx` (présentational, pur) :
```
props: {
  selection: ThemeTag[];                 // primaire + secondaires (ordre = tableau)
  themeCodes?: string[];                 // référentiel (schéma) ; repli THEMES
  refuges?: string[];                    // codes primaire-uniquement
  judgeHints?: Record<string,string[]>;  // code thème → libellés de juges (indice discret)
  describeOnHover?: boolean;
  onToggle: (code: string) => void;      // ajoute/retire
  onPromote: (code: string) => void;     // promeut primaire
  focusRef?: ...;
}
```
Aucun état métier : tout l'état vit dans le store (`DraftClause.themes`). Le composant lit
`selection` et émet `onToggle`/`onPromote`. Réutilise la grille/tokens existants.

**Orchestration** dans `SentenceMenu` (création + multi) :
- `selection` = `coveringDraft` ? `themes` (ou `[{theme,primary}]`) : `[]`.
- `onToggle(code)` :
  - pas de clause → `setBoundary(sentenceIndex, code)` (crée le primaire) ;
  - clause + code absent → `setClauseThemes(localId, [...set, {code, secondary}])` ;
  - clause + code présent → set sans `code` ; si vide → `removeBoundary` ; sinon
    `setClauseThemes` (sanitize promeut un primaire).
- `onPromote(code)` → `setClauseThemes(localId, set.map(role: code?primary:secondary))`.
- `judgeHints` construit depuis `judges` présents (chaque `detail.theme`).
- **Retrait** du `<MultiLabelEditor>` du menu clic-droit (redondant).

**Data / backend** : **aucun changement** — `ThemeTag`/`setClauseThemes`/`ClauseTheme`
(role+order) existent ; l'autosave PATCH `themes` est déjà en place. L'ordre des
secondaires = ordre du tableau (déjà persisté par l'index `order` côté backend).

---

## 4. Plan de développement (séquencé)
1. `ThemeMultiPicker.tsx` (grille multi : primaire ★, secondaires numérotés, refuges
   primaire-only, indice LLM discret, a11y, clavier).
2. Intégration `SentenceMenu` (orchestration onToggle/onPromote/judgeHints ; retrait du
   MultiLabelEditor redondant).
3. Tests vitest composant (`themeMultiPicker.test.tsx`) : primaire/secondaires/ordre,
   promote, refuge désactivé en secondaire, indice LLM, a11y.
4. e2e (`annotate`/`triage` ou nouveau) : clic-droit → choisir primaire + 2 secondaires
   → vérifier badges ★/1/2 + persistance (autosave).
5. Gate tsc + vitest + e2e ; revue ; commit + déploiement.

## 5. Plan d'exécution
| # | Étape | Vérif |
|---|---|---|
| 1 | Composant `ThemeMultiPicker` | test composant vert |
| 2 | Intégration `SentenceMenu` | tsc |
| 3 | Tests vitest + e2e | verts |
| 4 | Revue (charte/hex, a11y, refuge, ordre) | corrigé |
| 5 | Commit + deploy (gate + health) | prod=local, 200 |

## Critères d'acceptation
- Une seule grille ; 1ᵉʳ clic = primaire (★ Principal), clics suivants = secondaires
  numérotés (1, 2, …) ; ★ promeut ; re-clic retire ; refuge non sélectionnable en
  secondaire ; indice LLM discret ; persistance via autosave ; zéro hex en dur ; a11y.
