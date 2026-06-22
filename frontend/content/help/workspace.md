# Le workspace d'annotation

Le cœur du produit est le workspace `/annotate/[id]`, organisé en **trois
panneaux redimensionnables** :

1. **Plan / TOC** (gauche) — les clauses du document (thèmes colorés), la
   progression de couverture, les sauts rapides et les bascules d'overlays
   (injustice, fantômes LLM, traduction).
2. **Document** (centre) — le texte en lecture, colonne d'environ 70 caractères,
   interligne aéré, thème sombre doux. Chaque phrase est indexée et cliquable.
3. **Inspecteur** (droite) — la clause sélectionnée : thème, nature juridique,
   certitude, *evidence span*, justification, fil de commentaires et diff vs LLM.

## Poser une frontière de clause

Une clause commence à une phrase « ancre ». Pour la poser :

- **Au clic** : cliquez une phrase du document, elle devient le début d'une clause.
- **Au clavier** : naviguez avec `j` / `k`, puis appuyez sur `B` pour poser une
  frontière sur la phrase focalisée.

Cliquer une phrase déjà ancrée sélectionne sa clause dans l'inspecteur.

## Sélection multi-blocs et modes de langue

- **Sélection multi-blocs** : maintenez le **bouton droit** et glissez sur
  plusieurs phrases pour sélectionner une plage de clauses, puis annotez-les
  ensemble (cf. « Sélection multi-blocs »).
- **Modes de langue** : le switch **VO / Bilingue / FR** de la barre d'en-tête
  bascule l'affichage du texte ; l'annotation reste alignée sur l'index de
  phrase (cf. « Modes de langue & traduction »).

## Repères de lecture & d'écran

Plusieurs aides visuelles facilitent la navigation dans les longs documents :

- **Confort de lecture** — ajustez la **taille du texte** (A− / A+) et la **largeur**
  de la colonne de lecture. Ces réglages n'affectent que l'affichage, jamais vos
  données.
- **Gouttière des catégories** — une bande continue, à gauche du texte, code la
  **catégorie de thème** de chaque clause et matérialise les **ruptures** entre
  clauses voisines, pour lire la structure d'un coup d'œil. Activable via sa bascule.

## Attribuer un thème

Une fois une clause sélectionnée, attribuez-lui un thème :

- Ouvrez la **palette de thèmes** dans l'inspecteur (ou touche `T`), tapez pour
  filtrer, puis choisissez le thème. Les couleurs aident au repérage visuel.

Les frontières redimensionnent les panneaux au clavier (flèches gauche/droite sur
les poignées) ou à la souris ; les largeurs sont mémorisées localement.
