# Besoins — Refonte du workspace d'annotation (inspecteur, outils, gutter, compare, lecture)

> Demande utilisateur (2026-06-22) : enrichir et refondre l'expérience d'annotation
> du workspace (`/annotate/[id]`). Chaque besoin est tracé en exigence vérifiable.

## Axe 1 — Rationale au survol des phrases
- **B1.1** Au **hover** d'une phrase, afficher le `rationale` qui explique le choix du
  thème (« pourquoi ce thème et pas un autre »).
- **B1.2** Ne pas gêner la lecture ni la sélection (geste long-press/clic-droit déjà présent).
- **Acceptation** : survol d'une phrase annotée → le rationale (humain, et/ou LLM si pertinent) est visible sans clic.

## Axe 2 — Nature juridique intégrée intelligemment
- **B2.1** La nature juridique (par phrase/clause) doit être **visible** dans l'interface
  (pas seulement éditable dans un `<select>` perdu).
- **B2.2** Consultable « par LLM » : exposer, quand disponible, la nature proposée/dérivée
  par chaque juge (contrainte data : les fichiers LLM v9.2 ne portent pas la nature ;
  elle est dérivée du thème — cf. `02-architecture`).
- **Acceptation** : la nature juridique d'une clause est lisible d'un coup d'œil et son
  origine (humaine vs dérivée) est claire.

## Axe 3 — Refactoring de l'inspecteur (InspectorPanel)
- **B3.a** Thèmes : **tous visibles** (grille multi-rangées) + **hover explicatif** (détail du thème).
- **B3.b** Nature juridique : **fonctionnelle**, mieux présentée, **consultable par LLM**.
- **B3.c** `evidence_span` & `rationale` : mieux présentés + consultables par LLM.
- **B3.d** Commentaires : **plus visibles et utilisables**, pas optionnels/repliés.
- **Acceptation** : inspecteur restructuré en sections claires, hiérarchisées, cohérentes.

## Axe 4 — Refonte de la barre d'outils (document-controls)
- **B4.1** Analyser structure/hiérarchie/design/couleurs/style/animations de la barre
  (développée au fil de l'eau, peu ergonomique).
- **B4.2** Proposer plusieurs organisations comparatives → une proposition finale.
- **B4.3** Ajouter une **section « sélections multiples »** (au-delà de « jusqu'à la prochaine
  frontière » : sélectionner le segment courant, étendre/réduire, tout le thème courant…).
- **Acceptation** : barre groupée logiquement, lisible, cohérente, avec actions de sélection avancées.

## Axe 5 — Minimap / indicateur de position
- **B5.1** Un **petit cadre** montrant **où** on consulte dans le document courant
  (position du viewport), utile au scroll.
- **Acceptation** : on sait en permanence où l'on se situe dans le document.

## Axe 6 — Gutter des catégories (ModelBoundaryRail) plus lisible
- **B6.1** Plus **lisible**, ergonomique, compréhensible.
- **B6.2** **Continuité** de la ligne quand la catégorie d'un modèle **continue**.
- **B6.3** Mieux **visualiser les ruptures** de frontières.
- **Acceptation** : segments continus par modèle, frontières nettes, conflits inter-modèles lisibles.

## Axe 7 — Mode comparer dynamique (N-modèles) + barre divergences sticky
- **B7.1** Le mode comparer ne doit plus se limiter à Claude/Codex : **intégrer tous les
  modèles** (Mistral inclus), accord **N-way**.
- **B7.2** La **barre de divergences** doit rester **sticky** à l'écran quand l'option est
  active, pour faciliter la navigation entre divergences.
- **Acceptation** : comparer fonctionne pour ≥2 modèles présents ; barre divergences toujours accessible.

## Axe 8 — Enrichissement des annotations Mistral
- **B8.1** Importer les annotations Mistral `v9_2_session3_mistral` **après validation du
  format** (éviter les fichiers en cours d'écriture).
- **Acceptation** : ✅ FAIT — 46 fichiers valides importés en prod (Mistral 22 → 47 docs ;
  `Instagram` exclu car segments vides). Voir `09-plan-action`.

## Exigences transverses
- Cohérence avec le design system (tokens sémantiques, thème clair/sombre).
- Accessibilité (ARIA, clavier, contrastes, `prefers-reduced-motion`).
- Performance (documents 139+ phrases).
- Tests Vitest/MSW/Playwright + non-régression.
