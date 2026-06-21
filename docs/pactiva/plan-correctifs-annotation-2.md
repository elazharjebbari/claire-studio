# Plan de correctifs — Annotation (2e série, D1 → D6)

Audit, analyse des solutions (backend / frontend / ui / ux / design / animation / data),
décision, plan de tests et d'exécution pour 6 points. Exécution lot par lot, déploiement
piloté (`deploy/deploy-claire.sh`, health 200 + rollback auto). Aucun changement de schéma.

## D1 — Toggle de désélection dans l'inspecteur (panneau droit)
- **Constat** : `InspectorPanel` → `ThemePalette onChange` fait `updateDraft(theme)` ;
  re-cliquer le thème déjà posé = no-op. Pas de désannotation depuis l'inspecteur.
- **Solution (frontend/ux)** : toggle **côté consommateur** (ThemePalette inchangée) — si
  `code === draft.theme` → `removeBoundary(draft.anchorIndex)` + `selectClause(null)` ;
  sinon `updateDraft`. Cohérent avec le toggle du `SentenceMenu` (C3).
- **Alternatives** : bouton « Supprimer » seul (déjà présent, moins direct) ; prop
  `onDeselect` dans ThemePalette (plus de surface). → toggle consommateur retenu (minimal).
- **Tests** : composant InspectorPanel — re-clic thème courant ⇒ clause retirée.

## D2 — Multi-sélection Cmd/Ctrl (sélection ET désélection de phrases)
- **Constat** : `onActivate` gère `shift` (range) et `meta/ctrl` (`toggleSelected`), mais le
  **clic simple ne réinitialise pas** `selectedSentences`/`selectedClauseIds` → sélection
  résiduelle, comportement confus ; la désélection Cmd existe (`toggleSelected`) mais l'état
  parasite la masque.
- **Solution (ux)** : standardiser — **clic simple** = réinitialiser la multi-sélection puis
  focus ; **Cmd/Ctrl+clic** = `toggleSelected` (ajoute/retire) ; **Maj+clic** = `selectRange`.
- **Data/animation** : aucun ; `toggleSelected` déjà trié/dédupliqué.
- **Tests** : store + handler — Cmd+clic ajoute/retire ; clic simple vide la sélection.

## D3 — Outil « sélectionner jusqu'à la frontière suivante » (tous modèles confondus)
- **Constat** : aucun moyen rapide de sélectionner le bloc courant jusqu'à la prochaine
  frontière (humaine **ou** LLM).
- **Solution (frontend/ux + data)** : helper PUR `nextBoundaryFrom(starts, from, n)` ; la
  frontière = **union** des débuts de segment (clauses humaines + chaque modèle LLM visible).
  Action : sélectionner `[focused, nextBoundary-1]` (`selectRange`). **Widget** = bouton dans
  la barre d'outils du document (icône) + raccourci clavier `Maj+F`.
- **Alternatives** : ne considérer que l'humain (moins utile) ; menu dédié (lourd). → union
  multi-modèles + bouton/raccourci retenu.
- **Tests** : `nextBoundaryFrom` (pur) ; intégration sélection.

## D4 — Menu clic-droit : pas de scroll, toutes les catégories visibles, jamais hors écran
- **Constat** : `ThemePalette` (`<ul max-h-64 overflow-auto>`) + wrapper `max-h-40
  overflow-auto` dans `SentenceMenu` → scroll. 20 thèmes. Le positionnement est déjà clampé
  au viewport (`placeWithinViewport` : flip + clamp) — à conserver/vérifier.
- **Solution (ui/design)** : prop `layout="grid"` sur `ThemePalette` (grille **2 colonnes**,
  sans `max-h`/scroll). `SentenceMenu` l'utilise et retire le wrapper scrollable. 20 thèmes →
  ~10 lignes × 2 col, tient dans `max-h-[88vh]` ; le clamp garantit l'absence de débordement.
- **Tests** : `placeWithinViewport` (flip/clamp, déjà couvert — étendre) ; rendu grid 2 col
  sans `overflow-auto`.

## D5 — Fantômes LLM multiples (Claude + Codex affichés ensemble)
- **Constat (data)** : `ghostByIndex = new Map(ghosts.filter(...).map(g => [g.anchorIndex, g]))`
  → clé = index ⇒ si Claude **et** Codex ont un fantôme au même index, le **dernier écrase**.
- **Solution** : `Map<number, Ghost[]>` (regroupement par index) ; `SentenceRow` rend **tous**
  les fantômes de la phrase (un badge par juge).
- **Tests** : `ghostByIndex` groupé (2 juges même index → 2 entrées) ; rendu de 2 badges.

## D6 — Réglette : bande continue, clic, zones de conflit
- **Constat** : pistes par modèle (colonnes) — chaque modèle est déjà indépendant, mais le
  rendu par ligne peut paraître discontinu ; clic = jump (présent) ; **pas** de gestion des
  conflits.
- **Solutions** :
  - (a) **Continuité** (design) : corps de segment **sans rupture** ; seule la **frontière
    propre** au modèle marque une coupure (tick + liseré de fond), pas la frontière d'un autre
    modèle. Cellules jointives, fond plein, marqueur uniquement en début de segment.
  - (b) **Clic** (ux) : clic sur n'importe quelle cellule d'un segment → `focusSentence(
    segment.startSentence)` (déjà), confirmer + a11y (Entrée/Espace).
  - (c) **Zones de conflit** (data/ui) : piste **« conflit »** dédiée — une phrase est en
    conflit si les modèles **visibles** (avec données) **divergent** de thème. Helper PUR
    `conflictZones(models, n)` → intervalles ; chaque zone est **clickable** → jump à sa 1re
    phrase. Marqueur ambre, forme distincte (a11y daltonisme).
  - **Animation** : transition de fond douce (`transition-colors`), respect `reduced-motion`.
- **Tests** : `conflictZones` (pur) ; clic cellule/zone → onJump(1re phrase).

## Ordre d'exécution (lots)
- **DL1** = D5 + D1 + D2 (data ghost + interactions simples, faible risque) ;
- **DL2** = D4 (palette grid + clamp) ;
- **DL3** = D3 (outil frontière suivante) ;
- **DL4** = D6 (réglette continuité + conflits).
- Puis **tests** (vitest : helpers purs + composants), **tsc + build**, **déploiement** +
  smoke prod.

**Tests transverses** : `nextBoundaryFrom`, `conflictZones`, `placeWithinViewport`,
`ghostByIndex` groupé, toggle inspecteur, multi-sélect reset — tous en vitest. Aucun backend.
