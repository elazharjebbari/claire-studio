# 09 — UX/UI/design du mode collaboratif (point 7)

> Objectif : la collaboration **simplifie** le travail et ne **surcharge** jamais
> l'écran. Voyants discrets, icônes pertinentes, panneaux à la demande.

## Principes

1. **Présence ambiante, pas envahissante** : une pile d'avatars (couleurs de membres)
   en haut à droite ; curseurs distants en couleur, étiquette au survol seulement.
2. **Progressive disclosure** : tout ce qui est collaboratif (attribution, commentaires,
   présence détaillée) se **révèle à la demande** (toggles), masqué par défaut pour le
   travail solo concentré.
3. **Couleur = identité, jamais seule porteuse d'info** : toujours doublée d'initiales
   ou de texte (accessibilité).
4. **Continuité** : on réutilise le langage visuel existant (rails, badges, popovers,
   tokens) ; le collaboratif n'introduit pas un second design system.

## Composants & états

- **PresenceBar** : avatars empilés (max N + « +k »), point vert = actif, gris = inactif.
  Clic → liste des participants + « suivre » (synchronise le scroll sur leur focus).
- **Curseur distant** : fine barre colorée sur la phrase regardée par l'autre ; n'altère
  pas la lecture (opacité faible).
- **Voyant de conflit** : sur une clause éditée en concurrence, pastille ambre « ✥ 2 »
  → popover « Alice & Bruno ont édité le thème · voir l'historique ».
- **Indicateur de connexion** : pastille discrète (vert=live, ambre=reconnexion,
  gris=hors-ligne) + bandeau non bloquant si hors-ligne.
- **Toggles d'en-tête** : `Présence`, `Attribution`, `Commentaires` — chacun ON/OFF,
  état persistant (localStorage).

## Partage & onboarding collaboratif

- Bouton **« Inviter »** (owner) → dialogue : rôle, expiration, quota → génère le lien,
  bouton copier. Lien lisible « rejoindre le projet … ».
- À l'ouverture du lien (authentifié) : écran de confirmation « Rejoindre *Projet X* en
  tant qu'*annotateur* ? » → entrée dans la salle, avatar visible des autres.

## Micro-interactions

- Apparition/disparition d'avatars animée (fade), jamais de saut de layout.
- Quand quelqu'un modifie une clause que je regarde : surbrillance brève (flash) +
  pastille d'auteur, sans voler le focus.
- Sons/notifs : aucun par défaut (option).

## États vides / dégradés
- Seul sur le document : aucune décoration collaborative (identique au solo actuel).
- Hors-ligne : bandeau « Modifications enregistrées localement, synchronisation au
  retour » ; rien n'est bloqué.

## Maquettes de référence
Wireframes ASCII et états dans ce fichier ; tokens de couleur d'auteur dans
`config-flags.yaml` (palette accessible). Le rendu final suit le thème sombre
anti-fatigue existant.

```
┌───────────────────────────────────────────────── workspace ┐
│ Version[Auto▾] ☑Frontières  [Humain|Claude|Codex|Comparer] ⇄ │  ← sticky
│  〔Présence: (A)(B)+1〕  ●live   〔Attribution�〕〔Commentaires⟩ │
├──────────────┬───────────────────────────────┬──────────────┤
│   Plan       │  Document (phrases indexées)   │  Inspecteur  │
│              │  ▎12 …terminate…   (A)         │  / Comments  │
│              │  ✥2 conflit thème              │              │
└──────────────┴───────────────────────────────┴──────────────┘
```
