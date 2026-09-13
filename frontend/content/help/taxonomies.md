# Taxonomies de lecture (T20 / T14 / T11 / T10)

Un contrat peut se lire à plusieurs **niveaux de finesse**. Le sélecteur de taxonomie
change la grille de lecture des thèmes **sans jamais toucher aux annotations** : c'est une
loupe, pas une modification.

> **T20 est la source.** C'est la taxonomie réellement annotée, stockée en base et
> exportée. T14, T11 et T10 sont des **projections** calculées à l'affichage : basculer
> ne duplique rien, n'altère rien, et se défait d'un clic.

## Où le trouver

Dans la barre d'outils de l'**atelier de résolution GOLD**
(`Résolution GOLD` → un document), à gauche de la bascule de langue : quatre boutons
`T20` · `T14` · `T11` · `T10`.

Le sélecteur est accessible au clavier (flèches ←/→) et expose un `radiogroup`. Survolez
un bouton pour lire à quoi sert le schéma.

## Les quatre taxonomies

| | Classes | À quoi elle sert |
|---|---|---|
| **T20** | 20 | La taxonomie **d'annotation**. C'est elle que les annotateurs utilisent et que les exports contiennent. Grille par défaut. |
| **T14** | 14 | **Fusion de fiabilité** : on ne regroupe que les thèmes dont l'accord entre annotateurs s'effondre, avec leur voisin sémantique immédiat. Aucune réorganisation de fond. |
| **T11** | 11 | **Familles fonctionnelles, stratifiée.** Regroupe par fonction contractuelle, mais **jamais à travers les strates d'abusivité** : limitation de responsabilité et exclusion de garantie restent séparées. C'est le schéma **recommandé**. |
| **T10** | 10 | T11 **plus** la fusion des deux clauses exculpatoires. Sert de **test à charge** du garde-fou : cette seule fusion supplémentaire coûte 2 à 3 fois plus de signal d'abusivité. Elle n'est pas destinée à être adoptée. |

## Ce qui change à l'écran

Quand une taxonomie autre que T20 est active :

- un **bandeau** rappelle que vous lisez une projection et que **les décisions restent
  écrites en T20** ;
- les **libellés, couleurs et glyphes** suivent la taxonomie choisie, dans le plan, le fil
  de lecture et l'inspecteur ;
- une classe fusionnée porte le signe **⊕N** (N = nombre de thèmes T20 regroupés) ;
- une **légende** apparaît dans le plan : elle liste chaque classe, ce qu'elle couvre, les
  **thèmes T20 qu'elle contient**, leur nombre de phrases dans ce document, et la raison
  mesurée de la fusion ;
- l'**info-bulle** de chaque pastille énumère les thèmes T20 regroupés.

Ce qui ne change **pas** : la découpe du document (les frontières de clauses restent celles
des annotations), les votes des annotateurs, les décisions déjà prises, et l'écriture.

## Parcourir un contrat, en pratique

1. Ouvrez un document depuis le cockpit **Résolution GOLD**.
2. Laissez **T20** pour voir ce que les annotateurs ont réellement posé.
3. Basculez sur **T11** : les thèmes voisins se regroupent, le nombre de classes tombe de
   20 à 11, et les libellés deviennent des familles (« Contenu, propriété intellectuelle &
   signalements »).
4. Ouvrez la **légende** dans le plan pour voir, classe par classe, ce que chaque famille
   contient et combien de phrases du document elle couvre.
5. Sélectionnez une phrase : l'inspecteur montre les votes des trois annotateurs
   **dans la taxonomie choisie**. Deux annotateurs en désaccord en T20 peuvent apparaître
   d'accord en T11 — c'est précisément ce que la fusion cherche à mesurer.
6. Revenez à **T20** avant d'arbitrer : les boutons de décision restent en T20 de toute
   façon, une macro-catégorie n'étant pas une étiquette.

## Pourquoi une macro-catégorie n'est pas une étiquette

On **annote** en T20 et on **arbitre** en T20. Une classe fusionnée est une façon de
*lire* plusieurs thèmes ensemble : l'écrire en base reviendrait à perdre l'information
fine, définitivement et sans retour possible. C'est pourquoi les contrôles de décision
restent en T20 quelle que soit la grille affichée, et qu'une note le rappelle dans
l'inspecteur.

## Comment les fusions ont été décidées

Elles ne sont pas de convenance : chaque regroupement s'appuie sur trois signaux mesurés
sur le corpus — la **confusabilité** entre deux thèmes (combien de fois les annotateurs
hésitent entre eux), la **fiabilité** de chaque thème pris isolément, et la **cohérence
juridique** de la famille. Une contrainte les borne : ne jamais fusionner deux thèmes dont
les profils d'abusivité diffèrent fortement, sous peine de diluer le signal que la
détection de clauses abusives exploite.

Chaque classe fusionnée affiche sa justification dans la légende.

## Où sont les chiffres

Le dossier `docs/pactiva-taxonomies/` porte la mesure complète : quatre taxonomies × trois
populations de documents × trois sources d'étiquettes (annotations brutes, consensus,
gold). Le résultat principal : **T11 fait passer l'accord inter-annotateurs au-dessus du
seuil d'acceptabilité** que T20 n'atteint sur aucune population, et ce gain se reproduit
sur les documents qui n'ont pas servi à concevoir les fusions.

## Limites actuelles

Le sélecteur n'est présent que dans l'**atelier de résolution GOLD**. L'atelier
d'annotation et la vue « Comparer » affichent toujours T20 : la projection y viendra dans
un second temps, car ces écrans portent les chemins d'écriture et demandent plus de
précautions.
