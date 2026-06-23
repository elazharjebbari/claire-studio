# Benchmark — outils d'annotation et multi-label / provenance / raccourcis

> But : situer les choix de Pactiva par rapport aux outils de référence de l'annotation
> (Label Studio, Prodigy, INCEpTION, brat). On regarde **trois axes** qui font notre
> problème : (1) le **multi-label** (plusieurs étiquettes sur un même segment), (2) la
> **validation / provenance** (pré-annotation, revue, qui a décidé), (3) les **raccourcis /
> vitesse**. On reste sur des connaissances générales et des principes d'interaction
> observables ; **aucun chiffre de performance n'est inventé** et les détails susceptibles
> d'évoluer par version sont signalés comme tels.

## 1. Vue d'ensemble

| Outil | Positionnement | Multi-label | Provenance / validation | Raccourcis |
|---|---|---|---|---|
| **Label Studio** | Plateforme généraliste configurable (texte, image, audio…) | Oui, natif (choix multiples par région) | Pré-annotations importables + workflow de revue/accord | Hotkeys configurables par label |
| **Prodigy** | Outil scriptable orienté « décisions rapides » | Oui, mais paradigme « 1 décision = 1 vue » privilégié | Forte intégration modèle (active learning, accept/reject) | Clavier d'abord (accept/reject/ignore) |
| **INCEpTION** | Plateforme linguistique riche (couches, relations) | Oui, multi-couches et features | Recommandations automatiques + curation/adjudication explicite | Raccourcis, mais UI dense |
| **brat** | Annotateur web minimaliste historique | Oui (types multiples sur un span) | Manuel ; pas de couche de revue intégrée | Limités |

## 2. Lecture par axe

### 2.1 Multi-label (plusieurs thèmes sur un segment)

- **Label Studio** : le multi-label est de premier ordre — une région peut porter plusieurs
  étiquettes via des contrôles à choix multiples. Les étiquettes sont distinguées par
  **couleur**, ce qui plafonne vite quand le nombre de classes monte (collisions de teintes,
  fatigue chromatique). Il n'y a pas de notion native forte de **primaire vs secondaire** :
  les labels d'un même span sont a priori « à plat ».
- **Prodigy** : philosophie inverse — décomposer en micro-décisions binaires plutôt
  qu'afficher un set riche. Efficace pour la vitesse, mais le multi-label *structuré*
  (un dominant + des connexes) n'est pas le terrain naturel de l'outil ; on l'obtient en
  chaînant des questions.
- **INCEpTION** : le plus expressif — features multiples, couches superposées, relations.
  Puissance maximale mais **densité visuelle élevée** et courbe d'apprentissage forte.
- **brat** : plusieurs types par span possibles, rendu par couleur/étiquette texte ; pas de
  hiérarchie primaire/secondaire ni d'assistance.

**Ce qu'on en retient pour Pactiva** : aucun de ces outils ne matérialise clairement une
**hiérarchie primaire/secondaire** à plat sur le span. Notre choix — **chip plein (primaire)
vs chip pointillé `+` (secondaire)** + pastille `＋N` au plan — est un différenciateur : il
porte la hiérarchie par la **forme**, pas par la couleur, donc il tient quand le nombre de
thèmes augmente (là où le code-couleur seul des autres outils sature).

### 2.2 Validation / provenance

- **Label Studio** : sait ingérer des **pré-annotations** (prédictions de modèle) que
  l'annotateur confirme ou corrige, et propose des flux de **revue** / mesure d'accord.
  Mais la distinction visuelle « ceci vient d'un modèle » vs « ceci est validé à la main »
  reste discrète au moment de l'annotation.
- **Prodigy** : la provenance modèle est centrale (active learning) ; le geste est
  accept/reject sur une suggestion. La trace « adopté du modèle » vs « saisi » est implicite
  dans le flux plutôt qu'affichée comme un attribut persistant et lisible du segment.
- **INCEpTION** : sépare nettement **recommandations automatiques** et **curation /
  adjudication** (un curateur arbitre les annotations divergentes). C'est le plus proche de
  notre besoin reviewer, mais la lisibilité « d'un coup d'œil » de l'origine sur chaque
  segment n'est pas son point fort (UI chargée).
- **brat** : pas de couche de provenance/revue native.

**Ce qu'on en retient pour Pactiva** : la **provenance comme attribut visible et permanent**
de chaque clause — et distinguée par une **forme stable** (★ pré-annotation / ⚡ moteur+Cx /
✎ manuel), la couleur n'encodant que l'**état** — va plus loin que ces outils, où la
provenance est surtout un attribut de *workflow* peu visible pendant l'annotation. Cela sert
directement le persona reviewer (cibler les clauses seedées sans les ouvrir).

### 2.3 Raccourcis / vitesse

- **Label Studio** : hotkeys assignables par label ; bon pour les sets stables.
- **Prodigy** : référence de la vitesse — **clavier d'abord**, décisions binaires,
  enchaînement « suivant » fluide. C'est l'inspiration la plus directe pour notre
  « valider + suivant » et l'action 1-clic en C1/C2.
- **INCEpTION** : raccourcis présents mais noyés dans une UI dense ; la vitesse n'est pas
  l'argument premier.
- **brat** : interaction surtout à la souris.

**Ce qu'on en retient pour Pactiva** : viser le **modèle Prodigy** pour les niveaux faciles
(C1/C2 : un geste, on enchaîne), tout en gardant une **modulation par niveau** que Prodigy
n'a pas (C3 ouvre le multi-label ; C4/C5 forcent une décision humaine explicite). On combine
la vitesse de Prodigy et l'expressivité d'INCEpTION, sans hériter de leur densité respective.

## 3. Forces / faiblesses synthétiques

| Outil | Forces (à imiter) | Faiblesses (à éviter) |
|---|---|---|
| **Label Studio** | Multi-label natif ; ingestion de pré-annotations ; flux de revue. | Hiérarchie primaire/secondaire absente ; saturation par la couleur quand les classes se multiplient. |
| **Prodigy** | Vitesse clavier, micro-décisions, enchaînement. | Multi-label structuré peu naturel ; provenance implicite. |
| **INCEpTION** | Expressivité (couches/relations) ; curation/adjudication explicite. | Densité visuelle et courbe d'apprentissage ; lisibilité « coup d'œil » faible. |
| **brat** | Légèreté, simplicité du span multi-type. | Pas de provenance/revue ; raccourcis pauvres ; pas d'assistance. |

## 4. Synthèse — ce que Pactiva retient

1. **La forme plutôt que la couleur** pour la hiérarchie multi-label (plein/pointillé, `＋N`) :
   répond directement à la saturation chromatique observée chez Label Studio/brat, et reste
   accessible (lisible en niveaux de gris).
2. **La provenance comme attribut persistant et lisible partout** (forme ★/⚡/✎, état en
   couleur) : va au-delà de la provenance « de workflow » des autres outils, au service du
   reviewer.
3. **La vitesse de Prodigy, modulée par le niveau Cx** : 1-clic quand c'est facile, set
   multi-label quand c'est un C3, décision humaine obligatoire en C4/C5 — une adaptativité
   qu'aucun des quatre n'offre telle quelle.
4. **Éviter la densité d'INCEpTION** : exposer la richesse (multi-label, provenance,
   comparateur) sans charger l'écran — d'où les 3 canaux *orthogonaux* à emplacements
   distincts.

> Précaution : les capacités exactes (raccourcis, rendu multi-label, flux de revue) varient
> selon les versions de ces outils. Ce benchmark vise les **principes d'interaction** stables,
> pas un comparatif de fonctionnalités daté.
