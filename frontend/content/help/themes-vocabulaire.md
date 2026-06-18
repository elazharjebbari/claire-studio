# Thèmes & vocabulaire

CLAIRE Studio repose sur un **vocabulaire fermé** : vous ne pouvez attribuer que
des thèmes définis par le schéma d'annotation du projet (`claire-themes-v1` par
défaut). Cette contrainte garantit la cohérence inter-annotateurs et la
comparabilité des exports.

## La palette de thèmes

- Chaque thème porte un **code** stable (ex. `TERMINATION`, `PRIVACY_DATA`,
  `ARBITRATION_DISPUTES`) et un **libellé** lisible.
- Chaque thème a une **couleur** dédiée, reprise dans le plan, sur les ancres de
  clause et dans l'inspecteur.
- La recherche typée filtre la liste : tapez quelques lettres du libellé.

## Nature juridique

Au-delà du thème, une clause peut recevoir une **nature juridique** (champ
optionnel proposé par le schéma), utile pour affiner la catégorisation.

> Le vocabulaire est versionné côté admin (`/admin/schemes`). Un schéma peut être
> cloné et faire évoluer ses thèmes sans casser les annotations existantes.
