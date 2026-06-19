# 04 — Undo / Redo & boîte d'actions (point 4a)

## Modèle : pile de commandes inversibles

Chaque mutation humaine est une **commande** `{ verb, before, after, targetRef }`
(même structure que l'`ActivityEvent`). On maintient deux piles dans le store :
`past[]` (annulables) et `future[]` (rejouables).

- **do(cmd)** : applique l'effet, `past.push(cmd)`, vide `future`.
- **undo()** : `cmd = past.pop()` → applique `before` (inverse), `future.push(cmd)`.
- **redo()** : `cmd = future.pop()` → applique `after`, `past.push(cmd)`.

Les commandes sont dérivées directement des actions du store (setBoundary,
updateDraft, setCertainty, removeBoundary, resolveDivergence, replacePrefill). Le
`actionLog` (livré ce cycle) **est** la pile `past` enrichie d'horodatage et de label ;
undo/redo (cycle suivant) consomme exactement ces entrées.

## Raccourcis & boîte d'actions

- `⌘/Ctrl+Z` : undo ; `⌘/Ctrl+Shift+Z` ou `⌘/Ctrl+Y` : redo.
- **Boîte d'actions** (panneau « Historique ») : liste chronologique inversée, chaque
  entrée = icône de verbe + label + cible cliquable (recentre le document) + bouton
  « revenir ici » (undo en cascade jusqu'à ce point). État *annulé* grisé, *rejouable*
  signalé.

## Inversibilité par verbe (cf. `event-types.csv` colonne `undoable`)

| Verbe | Inverse |
|---|---|
| clause.create | clause.delete |
| clause.delete | clause.create (restaure before) |
| clause.retheme / set_* | ré-applique `before` |
| divergence.adopt | restaure thème + resolvedFrom antérieurs |
| prefill.apply / switch | restaure l'ensemble des clauses seedées antérieures |
| version.submit / snapshot | **non annulable** (immuable ; créer une nouvelle version) |

## Bornes & robustesse

- Profondeur de pile bornée (ex. 200) ; au-delà, on tronque le plus ancien.
- Les actions **non annulables** (soumission) **vident** la pile redo et posent un jalon.
- En collaboratif (cycle suivant) : l'undo est **local à l'utilisateur** et s'exprime
  comme une nouvelle opération CRDT (on n'annule pas le travail des autres). L'undo
  produit un `ActivityEvent(*.revert)` traçable.

## Tests
Pile pure testée isolément (do/undo/redo, troncature, jalon non annulable) ; parcours
Playwright : créer → undo → la clause disparaît → redo → réapparaît.
