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

## Attribuer un thème

Une fois une clause sélectionnée, attribuez-lui un thème :

- Ouvrez la **palette de thèmes** dans l'inspecteur (ou touche `T`), tapez pour
  filtrer, puis choisissez le thème. Les couleurs aident au repérage visuel.

Les frontières redimensionnent les panneaux au clavier (flèches gauche/droite sur
les poignées) ou à la souris ; les largeurs sont mémorisées localement.
