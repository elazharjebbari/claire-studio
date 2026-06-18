# Typographie — CLAIRE Studio

> La typographie est l'outil n°1 de l'**anti-fatigue** (feature 6) : l'annotateur lit du texte juridique
> dense pendant des heures. Valeurs concrètes : `design_tokens.json` (section `typography`). Justifications
> détaillées : `ergonomics_anti_fatigue.md`. Conformité : `accessibility.md`.

## Familles de polices (tokens `font-family`)

| Rôle | Police | Pourquoi |
|---|---|---|
| **UI (sans)** | Inter (fallback système) | Neutre, très lisible aux petites tailles, large jeu de poids, excellent rendu écran. |
| **Lecture longue (serif, optionnel)** | Source Serif 4 (fallback Georgia) | Option dans `/settings` pour le panneau document : empattements qui guident l'œil en lecture prolongée. |
| **Mono** | JetBrains Mono (fallback) | Index de phrase `[6]`, codes de thème, diff, manifests — alignement et désambiguïsation `0/O`, `1/l`. |

Le panneau document peut basculer sans/serif selon préférence ; l'UI reste en sans pour la cohérence.

## Échelle de tailles (tokens `font-size`)

- **Corps minimum 16 px** (`base`) — jamais en dessous pour le texte lisible (AA, anti-accommodation).
- **Document en 17 px** (`md`) par défaut en densité confort, réductible à 16 px en densité compacte.
- Échelle modulaire douce (xs 12 → 2xl 30) : peu de paliers, hiérarchie claire, pas de « bruit » typographique.
- Le texte lisible n'est jamais figé en `px` qui empêcherait le zoom navigateur (accessibility.md §5).

## Interlignage (tokens `line-height`)

| Token | Valeur | Usage |
|---|---|---|
| `tight` | 1.25 | Titres, badges |
| `normal` | 1.5 | UI générale, inspecteur, panneaux |
| `reading` | **1.7** | **Corps du document** — aère le texte dense, réduit le crowding (anti-fatigue) |

## Longueur de ligne (token `measure.document = 70ch`)

- Colonne document **plafonnée à ~70 caractères** (cible 60–75ch), **quelle que soit la largeur d'écran**.
  Au-delà, l'œil se perd au retour ligne ; en deçà, trop de sauts. C'est l'optimum de lisibilité.
- En plein écran, l'espace excédentaire va aux panneaux Plan et Inspecteur, **pas** à l'élargissement du texte.

## Graisses (tokens `font-weight`)

- **Regular (400)** : corps du document.
- **Medium (500)** : phrases d'ancre et libellés de clause — hiérarchise **sans** crier.
- **Semibold/Bold (600/700)** : titres de panneaux, boutons primaires, en-têtes de tableau.

## Règles de composition

- **Alignement à gauche**, **jamais justifié** (les rivières de la justification fatiguent — ergonomics §1).
- **Index de phrase** en mono, couleur `fg-subtle`, discret mais scannable (`[0] [1] [2]…`).
- **Codes de thème** (`PRIVACY_DATA`) en mono medium dans les chips, doublant la couleur (accessibilité).
- **Markdown** des `rationale`/`guidelines`/`comments`/`review.body` : rendu avec la même échelle, titres
  limités à 2 niveaux pour ne pas casser le rythme de lecture.
- **Chiffres tabulaires** pour les métriques (avancement, κ, comptes d'export) → colonnes alignées.

## Hiérarchie type (exemples)

| Élément | Famille | Taille | Poids | Interligne |
|---|---|---|---|---|
| Titre d'écran | sans | xl/2xl | 700 | tight |
| Titre de panneau | sans | lg | 600 | tight |
| Corps document | serif/sans | md | 400 | reading (1.7) |
| Phrase d'ancre / clause | sans | md | 500 | reading |
| Index de phrase | mono | sm | 400 | reading |
| Label UI / bouton | sans | sm/base | 500/600 | normal |
| Métrique (κ, %) | mono (tabular) | base/lg | 600 | normal |
| Code de thème (chip) | mono | xs/sm | 500 | normal |

## Accessibilité typographique (rappel)

- Zoom 200 % sans perte (tailles relatives `rem`).
- `prefers-reduced-motion` n'affecte pas le texte mais les transitions associées.
- Contraste de chaque couple texte/fond vérifié AA (voir `color_system.md`).
