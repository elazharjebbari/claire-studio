# Ajouts au design system — Features A & B

> Nouveaux composants, tokens et états introduits par la réglette (A) et l'annotation
> phrase/bloc (B). Principe : **étendre** le système existant (tokens `--surface-*`,
> Tailwind `bg/panel/line/ink/accent`, helpers `getThemeToken`/`readableTextColor`),
> **zéro hex en dur** dans les composants. Les géométries du rail sont déjà spécifiées dans
> `02-feature-A-.../A-design-tokens.json` (clé `gutter.*`) — ce document en donne la
> sémantique UI (variantes & états) et ajoute les tokens propres au **bloc** (B).

---

## 1. Nouveaux composants

### 1.1 `ModelBoundaryRail` (A) — réglette multi-pistes
Réalise la « réglette de frontières par modèle ». Sous-éléments :

| Sous-composant | Rôle | Tokens |
|---|---|---|
| **Track (piste)** | colonne verticale d'un modèle | `gutter.track.{width=24, widthDense=16, gap=4, borderColor, neutralFill}` |
| **Track header** | initiale du modèle (C / Cx / M) | `gutter.track.header.{height=18, fontSize=10, fontWeight=600, color}` + `track.identity[]` |
| **Cell (corps de segment)** | bloc dessiné par segment | `gutter.cell.{minHeight=22, categoryOpacity=0.28, bodyOpacity=0.18, radius=3}` |
| **Boundary marker** | glyphe ◷ au début de segment (forme porteuse a11y) | `gutter.marker.{glyph="◷", height=10, width=10, color, colorMuted, agreementHint}` |
| **Abbr (abréviation catégorie)** | 2–3 lettres sur la cellule de début | `gutter.abbr.{maxChars=3, fontSize=8, fontFamily=mono, fontWeight=600}` + `readableTextColor` |
| **Legend (panneau repliable)** | toggles par modèle + « Catégories » + « Tout/Aucun » | `gutter.legend.{width=200, radius=6, bg, border, fontSize=12}` |
| **Tooltip** | modèle / catégorie / plage de phrases | `gutter.tooltip.{maxWidth=240, radius=6, bg, border, color, shadow}` |

### 1.2 `BlockHandlesLayer` (B) — poignées de bord d'un bloc
Couche affichée **uniquement** pour le bloc sélectionné (double-clic / `b`). Deux poignées
(bord haut, bord bord bas) + contour accentué du bloc. Tokens proposés (cf. §3).

### 1.3 Extensions de composants existants (pas de nouveau composant)
- `SentenceRow` : ajout des états **bloc** (rail continu, coins arrondis) et **poignée
  ancrée** (au survol/sélection). Réutilise le `boxShadow: inset 3px 0 0 <runColor>80` déjà
  en place pour le rail gauche.
- `SelectionToolbar` : ajout de l'action **« Désannoter le bloc »** en mode bloc
  (`applyBlockOp("clearBlock")`) — la barre existe déjà (P4/P8).

---

## 2. États visuels (matrice hover / active / disabled / readonly / selected)

### 2.1 Réglette — cellule de piste

| État | Apparence | Token / classe |
|---|---|---|
| **neutral** (catégorie OFF) | fond `neutralFill`, marqueur ◷ au début | `gutter.track.neutralFill` (rgb border / .12) |
| **hover** | fond `neutralFillHover`, filet horizontal léger sur la phrase | `gutter.track.neutralFillHover` (.22) ; `motion.fast=120ms` |
| **category** (catégorie ON) | fond teinté `categoryOpacity`, abréviation au début | `getThemeToken().color` @ 0.28 ; `readableTextColor` |
| **category-hover** | teinte renforcée | `categoryOpacityHover=0.45` |
| **focus** (clavier) | anneau `focusRing` 2 px | `gutter.cell.focusRing = rgb(var(--surface-accent)/.7)` |
| **active** (clic en cours) | marqueur plein 1 instant | `marker.color` |
| **agreement-hint** (2+ modèles coupent ici) | liseré emerald optionnel | `marker.agreementHint = rgb(52 211 153)` (jamais seul porteur) |
| **disabled** (piste sans données) | en-tête barré, opacité réduite | `gutter.track.disabledOpacity=0.35`, `aria-disabled` |
| **readonly** | identique (la réglette est **toujours** lecture seule) | — |

### 2.2 Annotation — phrase vs bloc

| État | Phrase (size 1) | Bloc (size > 1) |
|---|---|---|
| **idle** | rail gauche 1 ligne (`inset 3px 0 0 color80`) | rail **continu** `[start..end]`, coins haut/bas arrondis |
| **hover** | `hover:bg-panel/40` (existant) | + léger liseré du bloc entier |
| **focused** (curseur) | `bg-accent/10 ring-1 ring-accent/40` (existant) | idem sur la phrase focalisée |
| **selected** (P4) | `ring-1 ring-accent/70 bg-accent/5` (existant) | sélection de toute la plage |
| **block-selected** (double-clic) | n/a | **contour accentué** + **2 poignées** visibles |
| **override** (phrase interne re-thématisée) | sous-bloc d'une autre teinte → **rupture** du rail | rend le split lisible sans action |
| **disabled / readonly** (R1) | pas de poignée, pas de mutation ; curseur `not-allowed` ; mutateurs no-op | idem ; poignées **non rendues** |
| **ghost LLM** (non retenu) | `outline-dashed` (existant) | inchangé |

### 2.3 Poignée de bloc (`BlockHandlesLayer`)

| État | Apparence |
|---|---|
| **idle** (bloc sélectionné) | barre de préhension discrète au bord, couleur du thème du bloc |
| **hover** | grossit légèrement, curseur `ns-resize` |
| **active** (glisser) | ligne de prévisualisation de la nouvelle borne ; tooltip « → phrase k » |
| **focus** (clavier) | anneau `accent` ; activable par `Alt+↑/↓` ou `Maj+,`/`Maj+.` |
| **collision** (cible d'un autre thème) | indicateur « écrasera <thème> » (politique « écraser sur extension explicite ») |
| **readonly** | non rendu |

---

## 3. Tokens à ajouter (bloc B) — proposition

> Pour la réglette (A), **tous** les tokens existent déjà dans `A-design-tokens.json`
> (`gutter.*`). Pour le **bloc** (B), on propose un petit groupe `block.*` (même esprit :
> géométries + opacités + durées, **pas** de couleur en dur — la teinte vient de
> `getThemeToken`). À placer dans un futur `B-design-tokens.json` ou à fusionner dans les
> tokens du workspace.

```jsonc
{
  "block": {
    "rail": {
      "width": 3,                 // largeur du rail de thème (= inset existant)
      "opacity": 0.5,             // "80" hex actuel ≈ .5 ; conserver la cohérence
      "radiusTop": 3,             // coins arrondis en HAUT du bloc (size>1)
      "radiusBottom": 3,          // coins arrondis en BAS du bloc
      "continuousNote": "Le rail est continu sur [start..end] ; une rupture = override."
    },
    "selection": {
      "outlineColor": "rgb(var(--surface-accent) / 0.7)",
      "outlineWidth": 1,
      "bgTint": "rgb(var(--surface-accent) / 0.05)"
    },
    "handle": {
      "size": 24,                 // cible tactile ≥ 24
      "grip": 12,                 // zone visuelle de préhension
      "color": "rgb(var(--surface-accent))",
      "hoverScale": 1.15,
      "previewColor": "rgb(var(--surface-accent) / 0.4)"
    },
    "motion": {
      "fast": 120,
      "easing": "cubic-bezier(0.2, 0, 0, 1)",
      "respectsReducedMotion": true
    }
  }
}
```

- **Cohérence** : `block.rail.opacity` reproduit le `80` hexadécimal du `boxShadow` actuel
  (`inset 3px 0 0 ${runColor}80`) pour ne pas changer le rendu existant des phrases.
- **Couleur** : aucune teinte de thème en dur ; le rail prend `getThemeToken(theme).color`.
  L'accent de sélection/poignée utilise `--surface-accent` (navy éclairci en sombre).

---

## 4. Variantes

- **Densité de réglette** : `comfortable` (défaut, `track.width=24`) ↔ `dense`
  (`track.widthDense=16`, en-têtes en initiale seule) — activée au-delà de ~5 pistes.
- **Catégorie** : `structure` (OFF, neutre) ↔ `category` (ON, teinte + abréviation).
- **Bloc** : `phrase` (size 1) ↔ `block` (size > 1) — purement dérivé, pas un mode utilisateur.
- **Lecture** : `editable` (mon annotation) ↔ `readonly` (annotation d'autrui, R1) — masque
  poignées et neutralise les mutateurs.
- **Thème de surface** : `dark` (atelier, défaut) ↔ `light` (cohérence charte) — automatique
  via les CSS variables, sans variante de composant.

---

## 5. Règles d'intégration (gardes-fous DS)
- **Aucun hex en dur** dans `ModelBoundaryRail` / `BlockHandlesLayer` : tout passe par
  `gutter.*` / `block.*` ou `getThemeToken` (Phase 5 identité Pactiva).
- **Réutiliser** les classes existantes pour les états de phrase (`bg-accent/10`,
  `ring-accent/40`, `outline-dashed`) plutôt que d'en recréer.
- **Une seule** ombre (surfaces flottantes) : `gutter.tooltip.shadow` /
  `0 8px 24px rgb(12 68 124 / .12)` ; pas d'ombre sur le rail ni sur les blocs.
- **Iconographie lucide** uniquement ; le marqueur ◷ est un glyphe géométrique (pas un
  picto plein, pas d'emoji dans l'UI produit — charte).
