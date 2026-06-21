# Palette & graphisme — Features A & B

> Comment la couleur est employée dans la réglette (A) et l'annotation phrase/bloc (B) :
> trois familles de couleur **strictement séparées** (catégories de thème · identité de
> piste · sémantique d'accord), motifs/hachures pour le daltonisme, et une exigence
> d'élégance/sobriété fidèle à la charte navy/gold. Source de vérité : `design-tokens.json`
> + `getThemeToken()` ; **zéro hex en dur** dans les nouveaux composants.

---

## 1. Les trois familles de couleur (ne jamais les mélanger)

### 1.1 Couleurs de **catégorie** (thème de clause) — via `getThemeToken`
Palette fermée du schéma (`design-tokens.json::themes`, 20 entrées), du violet-méta au gris
boilerplate. Elle code **le quoi** (la nature juridique du segment). Exemples :
`MODIFICATION_OF_TERMS #F59E0B`, `LIMITATION_LIABILITY #DC2626`, `GOVERNING_LAW #D946EF`,
`MISC_BOILERPLATE #94A3B8`.

- **Usage** : rail gauche de thème (B), teinte de cellule de réglette quand
  « Catégories » est ON (A), puce de badge. **Toujours** via `getThemeToken(code).color`
  → cohérence automatique entre rail, badge et réglette (un seul barème).
- **Jamais** seule : accompagnée de l'abréviation (rail) ou du label (badge/tooltip).
- **Opacités** maîtrisées (réglette) : corps de segment `0.18`, cellule de catégorie `0.28`
  (hover `0.45`) — assez pour distinguer, assez discret pour ne pas crier (P1/P2).

### 1.2 Couleurs d'**identité de piste** (modèle) — palette neutre dédiée
Code **le qui** (quel modèle), **distincte** des catégories pour éviter toute confusion
« couleur de modèle vs couleur de thème ». Source : `A-design-tokens.json::gutter.track.identity` :

```
identity[0] #94A3B8  (gris ardoise)
identity[1] #A78BFA  (lavande)
identity[2] #5EEAD4  (turquoise)
identity[3] #FCD34D  (ambre clair)
identity[4] #F9A8D4  (rose poudré)
```

- **Usage** : **en-tête** de piste uniquement (initiale C / Cx / M) — pas le corps des
  cellules (le corps porte la catégorie ou le neutre).
- **Choix** : teintes désaturées, espacées en teinte **et** en luminance → discriminables en
  deutéranopie/protanopie. Au-delà de 5 pistes, **repli sur l'initiale seule** (la
  forme/lettre porte l'info, la couleur devient secondaire).
- **Ne pas** réutiliser une couleur de catégorie comme identité de piste (et inversement).

### 1.3 Couleurs **sémantiques** (accord / divergence / certitude / états)
Code **l'état**. Déjà en place, **réutilisé tel quel** :

- Accord/divergence (mode compare) : `#34D399` (emerald) / `#FBBF24` (amber) — **toujours**
  doublés du libellé « accord »/« divergence » et de ✓/✗.
- Certitude : `certaintyScale` (`#94A3B8 → #22C55E`) + emoji + label (`CertaintyPicker`).
- États système (charte §3.5) : succès `#34C77B`, attention `#E0A100`, erreur `#F2585F`,
  info `#5B9DFF` (sombre) — pour l'enregistrement, jamais pour catégorie/piste.

### 1.4 Marque navy / gold — structure & accent rare
- **Navy** (`accent` = #4E86D4 sombre / #0C447C clair) : focus, sélection, contour de bloc
  sélectionné, anneaux. C'est la couleur **structurante** de l'atelier.
- **Or** (`gold` #BA7517) : accent **rare** réservé à la marque/à un point clé ; **jamais**
  une teinte de piste, de catégorie ou un aplat large (charte). Absent de la logique A/B.

---

## 2. `getThemeToken` & la cohérence chromatique

Tout consommateur de couleur de thème (rail, badge, réglette, menu, ComparePanel) passe par :

```ts
getThemeToken(code).color   // teinte de catégorie (schéma projet hydraté ou repli statique)
readableTextColor(hex)      // quasi-noir/blanc le plus contrasté → AA sur teinte dynamique
hexToRgbChannels(hex)       // "r g b" pour les CSS variables Tailwind si besoin
```

- `getThemeToken` est **générique** (H4) : un corpus tiers aux codes/couleurs différents
  s'affiche correctement (table hydratée au runtime depuis le schéma API, repli statique
  `design-tokens.json`, puis gris neutre `#94A3B8`). La réglette en hérite **sans effort** :
  Mistral et tout futur juge réutilisent **le même** barème de catégories → aucune
  divergence chromatique entre pistes.
- **Aucun composant A/B ne code une couleur de thème en dur** : un thème inconnu retombe sur
  le repli neutre, jamais sur une couleur fausse.

---

## 3. Motifs / hachures pour le daltonisme

La couleur ne suffit jamais ; on ajoute des **signaux de forme/texture** réutilisables :

| Signal | Forme/texture | Où |
|---|---|---|
| Frontière de modèle | **glyphe ◷** (cercle-horloge) au seul début de segment | réglette (A) |
| Catégorie | **abréviation** 2–3 lettres (`MOD`, `LTD`, `LAW`…) | réglette + badge |
| Bloc vs phrase | **rail continu + coins arrondis** (bloc) vs trait (phrase) | rail gauche (B) |
| Override interne | **rupture** du rail (sous-bloc) | rail gauche (B) |
| Ghost LLM non retenu | **contour pointillé** (`outline-dashed`, existant) | phrase |
| Frontière LLM dans le texte | **trait pointillé** + icône `Eye` (existant) | DocumentPanel |
| Piste sans données | **en-tête barré** + opacité réduite | réglette |

- **Hachures optionnelles** (mode « daltonisme renforcé », activable) : un motif de hachures
  diagonales très léger (`repeating-linear-gradient`, faible opacité) peut redoubler la
  teinte de catégorie sur les cellules de réglette, pour distinguer deux thèmes proches en
  teinte sans dépendre de la couleur. À garder **subtil** (charte : pas de texture
  décorative) et **désactivé par défaut**.
- Le motif/forme est **toujours** le porteur primaire ; la couleur est un **renfort**, pas
  l'inverse.

---

## 4. Élégance & sobriété (fidélité charte)

- **Géométrie nette, alignements stricts** : la réglette est une grille `repeat(N, …)`
  parfaitement alignée aux phrases (mesure `ResizeObserver`) ; les marqueurs ◷ s'empilent en
  colonnes lisibles. « Rigueur institutionnelle », « zéro décoration superflue ».
- **Élévation minimaliste** : bordures `1px` (`line`) + fonds `panel`/`elevated` ; une
  **seule** ombre douce pour les surfaces flottantes (tooltip rail, menus) :
  `0 8px 24px rgb(12 68 124 / .12)`. Pas d'ombre sur le rail ni sur les blocs.
- **Proscrit** (charte) : glassmorphism, néomorphisme, 3D, dégradés décoratifs, glow,
  textures lourdes, emojis dans l'UI produit, couleurs vives **hors palette**. Les teintes de
  catégorie sont vives par nécessité fonctionnelle mais **toujours** à opacité maîtrisée et
  jamais en aplat plein large.
- **Mouvement sobre** : 120–180 ms `ease-out` ; apparitions désactivées si
  `prefers-reduced-motion`.
- **Densité contrôlée** : la couleur n'apparaît en masse (catégorie ON) que sur demande ; la
  vue par défaut est « structure » (neutre + formes), reposante pour de longues sessions
  (atelier sombre anti-fatigue, F6).

---

## 5. Récapitulatif d'usage couleur (qui code quoi)

| Famille | Source | Code… | Renfort non-couleur | Interdits |
|---|---|---|---|---|
| Catégorie (thème) | `getThemeToken().color` | le **quoi** (nature juridique) | abréviation / label | en aplat plein large ; sans renfort |
| Identité de piste | `gutter.track.identity[]` | le **qui** (modèle) | initiale ; barré si vide | réutiliser une couleur de catégorie |
| Sémantique | tokens existants | l'**état** (accord, certitude, save) | label / ✓✗ / emoji | l'employer pour catégorie/piste |
| Marque navy | `accent` (`--surface-accent`) | **structure** (focus, sélection) | anneau / contour | — |
| Marque or | `gold` | accent **rare** marque | — | piste/catégorie ; aplat large |
