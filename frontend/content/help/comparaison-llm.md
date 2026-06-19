# Comparer Claude & Codex, arbitrer les divergences

Le mode **Comparaison** transforme les pré-annotations LLM en un véritable outil
d'arbitrage. Il s'active depuis le sélecteur de source, en haut du document
(humain · Claude · Codex · **Comparaison**).

## Choisir la version d'annotation

Le sélecteur **Version** (en tête de document) liste les versions disponibles pour
ce contrat (v9, v9.1, v9.2, v9.3…). Le changement est **instantané** et **non
destructif** : il ne touche qu'à l'overlay LLM affiché — vos clauses humaines déjà
posées ne bougent pas. L'option « Auto » sélectionne la version la plus riche
(celle qui porte le plus de preuves et de justifications).

## Naviguer les divergences

En mode comparaison, une barre **Divergences** apparaît avec un compteur « k / N ».

- Flèches ◂ ▸, ou touches **`n`** (suivante) / **`p`** (précédente), pour sauter
  d'un désaccord au suivant. Le focus se centre sur la frontière concernée.
- Une divergence = une phrase où Claude **et** Codex proposent un thème, mais des
  thèmes **différents**.

## Arbitrer : choisir une proposition

Sur une divergence, ouvrez le menu (clic-droit) ou l'aperçu de frontière (icône 👁
ou touche **`e`**), puis cliquez **« Choisir Claude »** ou **« Choisir Codex »**.
Au clavier, **`1`** adopte Claude et **`2`** adopte Codex sur la divergence courante.

La phrase porte alors un **voyant** « ✓ Claude » / « ✓ Codex » : la décision est
visible et tracée. Adopter une proposition crée (ou met à jour) votre clause
humaine avec le thème du juge — vous restez libre de la modifier ensuite.

## Aperçu des preuves à la frontière

L'aperçu (icône 👁 / touche `e`) montre, pour chaque modèle, le **thème**, l'**evidence
span** (citation justificative) et le **rationale** (raisonnement). L'onglet
« Comparer » place Claude et Codex en regard pour trancher en un coup d'œil.

Les frontières LLM (et leur icône 👁) sont disponibles **dans tous les modes**, y
compris en mode Humain, pour arbitrer sans changer de vue. Vous pouvez les masquer
avec la case **Frontières** en tête de document.

## Panneau comparatif

La touche **`g`** (ou le bouton « ⇄ Comparer ») ouvre une vue côte à côte des blocs
contigus de chaque modèle :

- colonne gauche = blocs de **Claude**, colonne droite = blocs de **Codex**,
  remplis par la **couleur du thème** ;
- une bande centrale code l'accord par tranche : **vert** = accord, **ambre** =
  divergence, **gris** = couverture partielle (un seul modèle) ;
- cliquer un bloc **saute** à la phrase correspondante.

C'est l'outil idéal pour repérer d'un regard où les segmentations se chevauchent
et où elles s'écartent.
