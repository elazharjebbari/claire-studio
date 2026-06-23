# Spécification — Rail d'actions rapides (gutter gauche)

## Layout (par ligne de phrase)
```
│[B1][B2]│ ▌ │  Texte de la phrase …
 └ rail ─┘ └track┘
 left-1    left-11   pl-14 (texte)        ← quand showQuickActions = ON
```
- Rail : `absolute left-1 top-1` (aligné au haut de la ligne, prévisible pour le curseur collant), deux boutons côte à côte (~18 px).
- Piste de validation : décalée de `left-1` → `left-11` quand le rail est actif.
- Ligne : `pl-5` → `pl-14` quand le rail est actif (sinon layout inchangé).
- Visibilité : rail opaque si phrase focalisée OU survol de la ligne (`group-hover`), sinon `opacity-0` (reste cliquable). Transition `opacity/scale 150ms`.

## Bouton 1 — Valider + suivant
- Aspect : pastille émeraude, icône ✓. `title="Valider (modèle courant) + phrase suivante"`.
- Action (clic) :
  1. `clientY = e.clientY` ;
  2. clause existante à l'ancre → `setValidated(localId, true)` ; sinon run du juge courant → `resolveDivergence(i, judge, theme)` ;
  3. `focusSentence(i+1)` (drapeau anti-scrollIntoView) ;
  4. rAF : repositionne le scroll de l'ancêtre scrollable pour que `[data-quickaction-validate="i+1"]` revienne à `clientY` (curseur collant).
- Désactivé si rien à valider ET pas de suivant.

## Bouton 2 — Recommandation
- Aspect : pastille teintée `TRIAGE_LEVEL_META[level].color` (fond `±1a`, texte couleur pleine), glyphe + code (ex. `◐ C2`). `title="Appliquer {level} · {label} — {action}"`.
- Clic (C1–C4) : `applyTriageDecision({anchorIndex:i, themes, boundary, triageLevel:level})`.
- Clic (C5) : ouvre la carte (pas d'application directe).
- Hover : popover `SuggestionCard` (à droite du rail, `left-full ml-2`, z-50, fade+slide), avec accepter/permuter/retirer/choisir → mêmes handlers que la file de triage. Fermeture à la sortie (délai court).
- Affiché seulement si `TRIAGE_ENABLED && triage.ready && result`.

## États & couleurs
- B1 : émeraude `#34D399` (cohérent avec la piste « validé »).
- B2 : C1 `#10B981` · C2 `#84CC16` · C3 `#8B5CF6` · C4 `#F59E0B` · C5 `#F43F5E` (source `levels.ts`).

## Accessibilité
- `<button>` natifs, `aria-label` explicite, focus visible, `title` portant la règle.
- Le rail n'altère pas l'ordre de lecture (placé avant le texte mais après la track dans le DOM ? → DOM: rail puis track puis contenu ; aria-label distinct).

## Activation
- `showQuickActions` (store workspace, défaut `false`) + `toggleQuickActions`.
- Case « Actions rapides » dans la barre d'overlays (DocumentPanel), à côté de « Frontières »/« Niveaux ».
