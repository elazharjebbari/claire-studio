# Modes de langue (VO / Bilingue / FR) & traduction

Le panneau central peut afficher le document dans trois modes, via un **switch
segmenté** dans la barre d'en-tête du document.

## Les trois modes

- **VO** — le texte **original** seul (mode par défaut).
- **Bilingue** — chaque phrase affiche la **VO** puis, en dessous, sa **traduction
  FR** (lecture comparée). Si une phrase n'a pas de traduction, seule la VO
  s'affiche.
- **FR** — chaque phrase affiche directement le **texte traduit**. Si la
  traduction d'une phrase est absente, le texte original est conservé et un
  petit indicateur **« VO »** signale le repli.

Le switch est accessible au clavier (flèches ←/→) et expose un `radiogroup`.

> Quel que soit le mode, **toutes** les interactions restent identiques : clic
> (focus / pose d'ancre), menu de phrase, sélection de phrases et de blocs,
> frontières, injustice, certitude. L'unité d'annotation demeure **l'index de
> phrase** : changer la langue d'affichage ne déplace jamais une annotation.

## Traduire / masquer une phrase

En mode **VO** ou **Bilingue**, vous pouvez afficher la traduction d'une seule
phrase :

- Ouvrez le **menu de la phrase** (clic-droit ou appui long) puis cliquez
  **« Traduire cette phrase »**. La ligne FR apparaît sous la phrase.
- L'entrée du menu devient alors **« Masquer la traduction »** (bascule).
- Une petite croix **×** sur la ligne FR permet aussi de la masquer directement.

Cette surcouche par phrase ne s'applique qu'aux modes VO/Bilingue ; en mode **FR**,
toutes les phrases sont déjà traduites.

## Overlay du plan

La bascule **« Traduction (FR) »** du panneau Plan est cohérente avec le switch :
elle fait passer le document de **VO** à **FR** (et inversement).
