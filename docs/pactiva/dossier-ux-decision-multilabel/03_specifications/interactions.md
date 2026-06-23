# Spécification — Micro-interactions

> Détaille les durées, courbes d'easing et états (focus / hover / active / disabled) communs à
> tous les composants du dossier. Objectif socle : **tout changement d'état visible en < 200 ms**,
> réversibilité, et perception sans la couleur seule.

## 1. Budget de temps (feedback)

| Type de retour | Durée cible | Note |
|---|---|---|
| Retour de pression (active) | **< 100 ms** | enfoncement bouton / switch ; quasi instantané |
| Changement d'état (couleur / forme / glyphe) | **< 200 ms** | validation, bascule toggle, morphing `◷`→provenance |
| Apparition / repli de zone (secondaires, popover) | **150–200 ms** | fondu + léger glissement |
| Tooltip (délai d'apparition) | **300–400 ms** au survol ; **0 ms** au focus clavier | disparition immédiate à la sortie |

Aucune animation > 250 ms sur un chemin d'action courant (ne pas freiner l'annotateur en série).

## 2. Courbes d'easing

| Mouvement | Easing | Justification |
|---|---|---|
| Entrée (apparition, glissement ON) | `ease-out` (décélération) | l'élément « arrive » et se pose |
| Sortie (disparition, repli OFF) | `ease-in` (accélération) | l'élément « part » |
| Bascule réversible (toggle, swap) | `ease-in-out` | symétrie = lisibilité de la réversibilité |
| Pression (active) | linéaire court | retour mécanique immédiat |

Respecter `prefers-reduced-motion` : si activé, **supprimer les translations / morphings** et ne
garder que le changement d'état final (couleur / glyphe), sans transition de mouvement.

## 3. États génériques par composant

### 3.1 Chip de thème (primaire / secondaire)
- **Hover** : fond 18 % → 24 %, bordure +1 luminosité, curseur `pointer`, tooltip après 300 ms.
- **Focus** : anneau `selection_ring` 2 px, offset 2 px ; distinct du hover.
- **Active** : enfoncement léger (< 100 ms).
- **Sélection** : anneau persistant + fond 24 % ; ancre des actions (permuter / retirer).
- **Disabled** : opacité 0.4, pas de hover/focus, `aria-disabled`.
- Pas de re-flow au survol : seuls fond / bordure / anneau changent.

### 3.2 Toggle multi-label `🏷`
- **Hover** : élévation du fond du switch ; tooltip décrivant l'action **cible** (« Activer le
  multi-label » / « Revenir en mono-label »).
- **Focus** : anneau 2 px ; activable **Espace / Entrée**.
- **Active** : switch enfoncé < 100 ms.
- **Bascule** : glissement du curseur 150 ms `ease-in-out` + libellé Mono↔Multi + teinte
  `#64B5F6` ; zone secondaire en fondu 150–200 ms.
- **Disabled** : opacité 0.4, `aria-disabled` + tooltip de raison.

### 3.3 Marque de provenance `★/⚡/✎` et état `◷`
- **Validation** : morphing `◷` ambre → forme de provenance vert, ≤ 200 ms.
- **Hover** : tooltip texte (provenance + règle Cx le cas échéant) après 300 ms.
- **Focus** : si interactif (en-tête cliquable), anneau 2 px ; sinon élément informatif non
  focusable mais lisible par lecteur d'écran.

### 3.4 Bouton de validation rapide (rail)
- **Hover** : surbrillance + tooltip « Valider et passer au suivant ».
- **Active** : enfoncement < 100 ms, puis transition d'état de la clause < 200 ms.
- **Disabled** (C4/C5) : grisé, `aria-disabled`, tooltip « Décision humaine requise ».

### 3.5 Indicateur de conflit C4/C5
- **Repos** : `❗` + liseré, **sans clignotement** (saillance par contraste, pas par animation).
- **Résolution** : `❗` → `✎` vert, morphing ≤ 200 ms, liseré retiré.

## 4. Réversibilité visible

- Toute bascule (toggle, swap-primary) est **symétrique** : l'animation inverse doit être
  reconnaissable comme « l'annulation » du geste. Même durée à l'aller et au retour.
- Un geste annulé en < 200 ms ne laisse **aucun artefact** (pas d'état intermédiaire figé).

## 5. Continuité et anti-saut

- Les changements de fond / bordure ne modifient **pas** la boîte (pas de variation de padding au
  hover) pour éviter les sauts de layout dans les listes denses.
- Le focus clavier ne doit **jamais** être masqué par un survol concurrent ; il reste prioritaire
  visuellement.

## 6. Cibles et loi de Fitts (rappel)

- Cibles ≥ **24 px** en gouttière dense, ≥ **32 px** en inspecteur ; hit-zone étendue par padding
  invisible quand le visuel est plus petit. Les micro-interactions de hover s'appliquent à toute
  la hit-zone, pas seulement au glyphe.
