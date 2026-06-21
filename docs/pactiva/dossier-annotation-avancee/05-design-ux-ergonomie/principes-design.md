# Principes de design — Features A & B

> Cadre : atelier d'annotation Pactiva (thème **sombre anti-fatigue**, F6), charte
> **navy/gold** (`docs/pactiva/charte-graphique.md`). La réglette multi-pistes (A) et
> l'annotation phrase/bloc (B) doivent **enrichir** la lecture sans la cannibaliser. Cinq
> principes directeurs, chacun traduit en règles concrètes ancrées dans le code et les
> tokens existants.

---

## P1 — Clarté avant densité

L'annotateur lit du texte juridique long ; **la lecture est la tâche primaire**, tout le
reste est secondaire. La charte l'exige : « lisibilité avant tout », « décoration nulle »,
proscrire glow/3D/dégradés.

- **Colonne de lecture intouchable** : `max-w-reading` (70ch) + `leading-reading` (1.7).
  La réglette A vit **hors** de cette colonne (3e enfant `flex` à droite, comme
  `ComparePanel`) → elle **ne réduit jamais** la largeur de lecture (besoin A5).
- **Information progressive** : la catégorie sur le rail est **OFF par défaut**
  (`gutterShowCategory=false`) — on montre d'abord la *structure* (où sont les frontières),
  la couleur ne vient qu'à la demande. Idem la traduction FR (déjà à la demande).
- **Un seul accent rare** : l'or `#BA7517` (`gold`) est réservé à un point clé ; il n'est
  **jamais** un aplat large ni une teinte de piste/catégorie. Les sélections/focus utilisent
  l'accent navy (`accent`), pas l'or.

## P2 — Non-cannibalisation de l'écran (compacité, réversibilité)

Chaque couche ajoutée est **activable/désactivable** et **frugale en pixels**.

- **Réglette compacte** : piste = 24 px + gap 4 px (`gutter.track.width/gap`) ; 2 modèles
  ≈ 52 px, 3 ≈ 80 px. Sous `xl`, repli en mini-déclencheur ou masquage (la lecture prime).
- **Toggle maître réutilisé** : la réglette suit `showBoundaries` (case « Frontières » déjà
  présente) ; OFF ⇒ rail **non monté** (coût nul, pas seulement caché).
- **Le bloc n'ajoute aucun chrome permanent** : pas de bouton « fusionner », pas de barre
  bloc dédiée persistante. Les **poignées** n'apparaissent qu'au survol/sélection d'un bloc ;
  la `SelectionToolbar` (flottante, déjà existante) ne s'affiche que si une sélection existe.
- **Élévation minimaliste** (charte §6) : bordures `1px` (`line`) + fonds `panel`/`elevated`
  plutôt que des ombres ; une **seule** ombre douce tolérée pour les surfaces flottantes
  (menus, tooltips) : `0 8px 24px rgb(12 68 124 / .12)`.

## P3 — Hiérarchie visuelle (structure > catégorie > détail)

Trois niveaux de lecture, du plus structurel au plus fin, jamais en compétition.

1. **Structure** (toujours visible si frontières ON) : le rail gauche de thème (P2 existant)
   et les marqueurs ◷ de la réglette signalent *où ça coupe*.
2. **Catégorie** (à la demande) : teinte + abréviation. Toujours **redondante** (forme +
   texte + couleur), jamais portée par la couleur seule.
3. **Détail** (au focus/à l'ouverture) : `SentenceMenu`, `BoundaryEvidence`, tooltips —
   rationale/evidence/plage de phrases.

- **Bloc vs phrase, lisible d'un coup d'œil** : une phrase isolée = rail sur une ligne ; un
  **bloc** (size > 1) = rail **continu** avec coins haut/bas arrondis. Un override interne
  **rompt** la couleur du bloc → le split est lisible **sans action**.
- **Poids typographique** : libellés de thème en `text-ink` (`#E6EAF0` sombre), métadonnées
  (tags, abréviations, n° de phrase) en `text-ink-muted` (`#9AA6B6`) et `font-mono` réduit.

## P4 — Cohérence avec la charte navy/gold (et le code en place)

Rien d'inventé : on **réutilise** le système de tokens et les helpers existants.

- **Couleurs de catégorie** : toujours via `getThemeToken(code).color` (schéma fermé,
  `design-tokens.json`) → le rail, les badges et la réglette partagent **exactement** la
  même palette de thèmes (zéro divergence possible).
- **Surfaces & accent** : tokens Tailwind `bg / elevated / panel / panel-muted / line /
  ink / ink-muted / accent / reading`, pilotés par CSS variables (`--surface-*`) →
  bascule clair/sombre automatique. **Aucun hex en dur** dans les nouveaux composants
  (cohérent avec la « chasse aux couleurs en dur », Phase 5 identité Pactiva) : les
  géométries/opacités du rail vivent dans `A-design-tokens.json` (clé `gutter.*`).
- **Identité de piste ≠ catégorie** : l'en-tête de piste utilise une **palette neutre
  distincte** (`gutter.track.identity[]`, daltonisme-safe) pour ne pas se confondre avec les
  teintes de thème (détaillé dans `palette-graphisme.md`).
- **Iconographie** : jeu **lucide** uniquement (l'app les utilise déjà : `Eye`, `Users`,
  `Columns2`, `Ghost`), trait fin, `currentColor`. Le marqueur de frontière ◷ est un glyphe
  géométrique sobre, pas un picto plein.

## P5 — Feedback immédiat (et réversible)

Tout geste produit un retour visible **et** annulable.

- **Optimiste** : le store est la vérité UI ; la re-dérivation (`computeRuns` +
  `deriveBlocks`) est synchrone et mémoïsée → le bloc apparaît **instantanément** ; la
  persistance suit (autosave, débounce 1200 ms) sans bloquer.
- **Un geste = un undo** : poser une plage, étendre/réduire, désannoter un bloc =
  **une seule** entrée d'undo (`applyBlockOp` : 1 snapshot + 1 `actionLog`). Le journal
  d'actions affiche un libellé lisible (« Bloc <thème> 12–18 (7 phrases) »).
- **États d'enregistrement explicites** : la couche autosave expose saving/saved/offline/
  error (déjà en place) ; aucune perte silencieuse.
- **Mouvement sobre** (charte §6) : transitions 120–180 ms `ease-out` ; survol tooltip
  ≈ 120 ms ; **respect de `prefers-reduced-motion`** (pas d'animation d'apparition si réduit).

---

## Anti-patterns à refuser (gardes-fous design)
- Élargir/rétrécir la colonne de lecture quand on ouvre la réglette. ❌ (P1/P2)
- Couleur **seule** comme porteuse d'information (frontière, catégorie, accord/divergence). ❌
  → toujours forme/texte en renfort (`ergonomie-accessibilite.md`).
- Or `gold` en aplat large ou comme teinte de catégorie/piste. ❌ (charte)
- Ombres lourdes, glow, dégradés décoratifs. ❌ (charte « À proscrire »)
- Bouton/chrome permanent pour une opération **dérivée** (fusion de blocs). ❌ (la fusion est
  émergente, P3/P5).
- Undo phrase-par-phrase pour un geste de plage. ❌ (P5 : un lot = un undo).
