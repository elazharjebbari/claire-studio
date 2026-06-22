# Comparer les juges LLM, arbitrer les divergences

Le mode **Comparaison** transforme les pré-annotations LLM en un véritable outil
d'arbitrage. Il s'active depuis le sélecteur de source, en haut du document
(humain · un juge · **Comparaison**). L'atelier compare **N juges** — aujourd'hui
**Claude, Codex et Mistral** — et accueille tout nouveau juge automatiquement.

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
- Une divergence = une phrase où **au moins deux juges** proposent un thème, mais
  des thèmes **différents** (l'accord par phrase est calculé sur l'ensemble des
  juges présents).

## Arbitrer : choisir une proposition

Sur une divergence, ouvrez le menu (clic-droit) ou l'aperçu de frontière (icône 👁
ou touche **`e`**), puis cliquez **« Choisir <juge> »** pour adopter la proposition
d'un juge — **n'importe lequel, y compris Mistral**.

Au clavier, en mode comparaison, **`1`** adopte **Claude** et **`2`** adopte
**Codex** sur la divergence courante (raccourcis binaires) ; pour les autres juges,
passez par l'œil 👁 « Choisir ».

La phrase porte alors un **voyant** « ✓ <Juge> » : la décision est visible et
tracée. Adopter une proposition crée (ou met à jour) votre clause humaine avec le
thème du juge — vous restez libre de la modifier ensuite.

## Aperçu des preuves à la frontière (œil 👁)

L'aperçu (icône 👁 / touche `e`) montre, **pour chaque juge**, le **thème**,
l'**evidence span** (citation justificative) et le **rationale** (raisonnement).
Les onglets sont **dynamiques** (un par juge présent) ; l'onglet « Comparer » place
les juges **en regard** pour trancher en un coup d'œil, et un bouton « Choisir »
adopte la proposition.

Les frontières LLM (et leur icône 👁) sont disponibles **dans tous les modes**, y
compris en mode Humain, pour arbitrer sans changer de vue. Vous pouvez les masquer
avec la case **Frontières** en tête de document.

## Panneau comparatif

La touche **`g`** (ou le bouton « ⇄ Comparer ») ouvre une vue côte à côte des
découpages des juges :

- **une colonne par juge** (Claude, Codex, Mistral…), remplie par la **couleur du
  thème** ;
- une bande code l'accord par tranche : **vert** = accord, **ambre** = divergence,
  **gris** = couverture partielle (un seul juge) ;
- cliquer un bloc **saute** à la phrase correspondante.

C'est l'outil idéal pour repérer d'un regard où les segmentations se chevauchent
et où elles s'écartent, quel que soit le nombre de juges.
