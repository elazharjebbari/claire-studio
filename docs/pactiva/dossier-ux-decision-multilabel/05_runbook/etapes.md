# Runbook — étapes de mise en œuvre (ordonnées, design d'abord)

> Checklist d'exécution UX/UI. **Aucun code ici** : on décrit l'ordre, les composants
> existants à faire évoluer, les états/gestes à produire et les critères de réussite mesurables.
> Le détail des cibles et la méthode de preuve sont dans `criteres_validation.md`.
>
> Principe d'ordonnancement : on pose d'abord le **système visuel** (source de vérité partagée),
> puis on l'applique composant par composant du plus structurant (provenance) au plus
> spécifique (conflits), et on ferme par accessibilité + tests utilisateurs. Chaque étape
> doit être **validable isolément** (on peut s'arrêter après n'importe laquelle sans casser
> l'acquis : ✓/◷ actuels restent valides tant que le trio ★/⚡/✎ n'a pas pris le relais).

---

## Étape 1 — Geler le système visuel (fondations)

**But** : une source unique de vérité visuelle, avant de toucher le moindre composant.

**À produire (design, pas de code)** :
- Geler les 3 canaux orthogonaux : couleur de niveau C1–C5 (inchangée), forme de provenance
  ★/⚡/✎, primaire plein / secondaire pointillé `+` + toggle 🏷. Référence : `palette_couleurs.yaml`,
  `icones_validation.yaml`, `hierarchie_visuelle.md`.
- Planche de référence (specimen) montrant chaque marque à l'échelle réelle (glyphes ≥ 12 px,
  cibles ≥ 24 px gouttière / ≥ 32 px inspecteur), en **dark** et **light**, et en **niveaux de gris**.
- Tableau des tokens d'état (vert `valide` / ambre `a_valider` / gris `non_couvert`) mappés sur
  les variables de surface de l'app.
- ⚠ Pré-requis bloquant : **figer la liste des thèmes / `theme_aliases`** avant toute spec de
  chips (cohérence des libellés dans plan + document + inspecteur).

**Composants concernés** : aucun encore (artefact de design partagé en amont).

**Critères de réussite** :
- 100 % des marques (★/⚡/✎/◷/❗/🏷/`+`/`+N`) présentes sur la planche, en dark + light + N&B.
- Test « niveaux de gris » : primaire vs secondaire distinguables **sans la couleur** (forme + `✓`/`+`).
- Revue designer + 1 annotateur senior : 0 ambiguïté de sens signalée sur le specimen.

---

## Étape 2 — Indicateur de provenance unifié (★/⚡/✎)

**But** : afficher la provenance de validation **partout**, pas seulement dans l'en-tête de clause.

**À produire** :
- Spec du trio forme = provenance / couleur = état, appliqué aux 3 emplacements existants :
  - **Piste de validation** (barre `w-1` à gauche du document) : remplace le ✓/◷ générique par
    la forme de provenance une fois validé (◷ reste l'état « à valider »).
  - **ClauseChip (TocPanel)** : remplace le glyphe ✓/◷ unique par ★/⚡/✎ (validé) ou ◷ (à valider).
  - **En-tête de clause** : aligner les pastilles actuelles (`✓ Juge` / `◷ Juge` / `✎ moi`) sur le
    même trio, libellé de juge conservé.
- Règle « une seule forme par clause » (dernière action de validation fait foi).
- États d'icône : ★/⚡/✎ **ambre** = proposé ; **vert** = validé ; ⚡ accompagné du code Cx teinté.
- Tooltip nommant la règle (« Validé via le triage — règle C2 · Haute »).

**Composants à faire évoluer** : `ValidationTrack`, `ClauseChip`/`TocPanel`, en-tête de clause.

**Critères de réussite** :
- La même provenance affiche la **même forme** dans les 3 emplacements (vérif visuelle pairée).
- Tooltip présent et exact sur 100 % des marques (forme + état + règle).
- Test de reconnaissance : un annotateur identifie « qui a validé » sans ouvrir l'inspecteur,
  ≥ 90 % de bonnes réponses sur 10 clauses mélangées (★/⚡/✎).

---

## Étape 3 — Badge `+N` & hiérarchie des chips primaire/secondaire

**But** : rendre le multi-label lisible en un coup d'œil et distinguer le thème dominant.

**À produire** :
- **Plan** : pastille `+N` sur le ClauseChip = nombre de thèmes secondaires (0 → pas de pastille).
  Position et taille selon `hierarchie_visuelle.md` ; ne pas télescoper le glyphe de provenance.
- **Document** : sous le badge de thème, chips secondaires en **contour pointillé** préfixés `+`,
  repliables ; chip primaire **plein/gras** avec `✓`.
- **Inspecteur** : zone « Thèmes » = primaire (gros) puis secondaires (`+`), prête à recevoir le toggle (étape 4).
- Application stricte du tableau primaire/secondaire (forme/bordure/graisse/taille/opacité/position).

**Composants à faire évoluer** : `ClauseChip`/`TocPanel` (pastille `+N`), badge de thème document,
zone « Thèmes » de `InspectorPanel`.

**Critères de réussite** :
- Repérage des clauses multi-label dans le plan **sans les ouvrir** : ≥ 90 % de réussite.
- Distinction primaire/secondaire correcte en N&B (test grayscale) sur 10 clauses : ≥ 90 %.
- `+N` cohérent avec le nombre réel de secondaires (audit de cohérence : 100 %).

---

## Étape 4 — Toggle multi-label + feedback < 200 ms

**But** : activer/désactiver le multi-label par un geste réversible, avec retour immédiat.

**À produire** :
- Toggle 🏷 (#64B5F6) en tête de zone « Thèmes » de l'inspecteur, états **Mono** / **Multi-label**
  distinguables **sans couleur** (libellé + position du switch).
- Comportement **toggle = annulation** : re-cliquer revient à l'état précédent (pas d'undo séparé
  pour le geste courant ; undo/redo global reste le filet).
- Feedback < 200 ms à l'activation : apparition/disparition des chips secondaires + accent bleu clair.
- États : actif (fond bleu clair léger + 🏷 + « Multi-label »), inactif (neutre + « Mono »),
  focus visible, désactivé si non applicable.

**Composants à faire évoluer** : `InspectorPanel` (zone Thèmes + toggle), liaison aux chips secondaires.

**Critères de réussite** :
- Latence perçue du basculement < 200 ms (mesure prototype).
- Réversibilité : 100 % des cas reviennent exactement à l'état initial après re-clic.
- État ON/OFF identifiable en N&B (test grayscale) : 100 %.
- Cible du toggle ≥ 32 px dans l'inspecteur.

---

## Étape 5 — Multi-label hors C3 (porte d'entrée « + thème secondaire »)

**But** : permettre d'ajouter un secondaire **sans conflit C3**, via la palette de thèmes.

**À produire** :
- Affordance **« + thème secondaire »** dans la palette de thèmes de l'inspecteur, rendu identique
  (chip pointillé `+`) et même toggle 🏷.
- Règle métier UX : le **refuge n'est JAMAIS secondaire** (interdiction visible + message).
- Cohérence avec la voie C3 (SuggestionCard) : un secondaire ajouté à la main est indistinguable,
  à l'affichage, d'un secondaire issu d'une suggestion acceptée.

**Composants à faire évoluer** : palette de thèmes de `InspectorPanel`, alignement avec `SuggestionCard`.

**Critères de réussite** :
- Un annotateur ajoute un secondaire hors C3 sans aide : succès ≥ 90 %, ≤ 2 gestes.
- Tentative de poser le refuge en secondaire : bloquée + message clair (100 %).
- Rendu d'un secondaire « manuel » == rendu d'un secondaire « C3 » (vérif visuelle : identique).

---

## Étape 6 — Conflits C4/C5 (alerte, jamais d'auto-validation)

**But** : traiter les cas à forte attention sans jamais valider automatiquement.

**À produire** :
- Saillance C4 (`◑` ambre, à vérifier) et C5 (`⚖` rose + `❗`, liseré marqué) selon l'ordre
  d'attention de `hierarchie_visuelle.md`.
- **Aucune auto-validation** en C4/C5 : seul le bouton de décision manuelle (✎) valide.
- Sur la SuggestionCard : actions de résolution (Accepter/Confirmer/Permuter/Retirer 2ⁿᵈ/
  Choisir/Annuler override) et frontière dure ▮ / molle ┄ conservées, alignées sur le trio de marques.

**Composants à faire évoluer** : `SuggestionCard`, `QuickActionRail` (bouton recommandation Cx /
décision manuelle), gouttière (saillance C4/C5).

**Critères de réussite** :
- 0 clause C4/C5 validée sans geste humain explicite (audit : 0 occurrence).
- C5 est l'élément le plus saillant de la zone au test de saillance (eye-tracking ou clic-1er-regard).
- Compréhension de « pourquoi attention requise » via tooltip/contexte : ≥ 90 %.

---

## Étape 7 — Accessibilité (WCAG AA, jamais la couleur seule)

**But** : garantir que chaque signal est lisible sans dépendre de la couleur.

**À produire** :
- Audit contraste : texte ≥ 4.5:1, éléments non textuels ≥ 3:1 (chips à 18 % d'opacité inclus).
- Chaque marque doublée d'un `title`/`aria-label` textuel ; navigation clavier complète ; focus visible.
- Test « daltonisme » (simulation deutéranopie/protanopie) sur les 3 canaux superposés.
- Cibles ≥ 24 px (gouttière) / ≥ 32 px (inspecteur) ; loi de Fitts (hit-zone par padding invisible).

**Composants concernés** : tous les composants touchés (étapes 2–6) + parcours clavier global.

**Critères de réussite** :
- 100 % des contrastes au seuil AA (rapport d'audit chiffré).
- 100 % des marques porteuses d'un libellé textuel équivalent (forme + glyphe + texte).
- Parcours clavier complet sans piège ni focus perdu (checklist : 0 défaut bloquant).
- Tous les sens distinguables en N&B + en simulation daltonisme (test grayscale + CVD).

---

## Étape 8 — Tests utilisateurs (validation finale)

**But** : prouver que le dispositif est compris, rapide et préféré, sur annotateurs réels.

**À produire** :
- Protocole : 5–8 annotateurs, tâches scénarisées (valider C1/C2 ; résoudre C3 ; ajouter secondaire
  hors C3 ; traiter C4/C5 ; lire le plan multi-label).
- Mesures : SUS, taux de compréhension des marques, temps par tâche, taux d'erreur, latence perçue.
- Comparaison avant/après (UI actuelle ✓/◷ sans multi-label vs nouvelle).

**Critères de réussite** (cf. `criteres_validation.md`) :
- **SUS ≥ 85**.
- **Compréhension des marques ≥ 90 %** (★/⚡/✎/`+N`/toggle).
- **Feedback perçu < 200 ms** sur les gestes clés (validation, toggle).
- **Contraste AA** confirmé sur l'écran réel.
- 0 régression sur l'acquis (validation mono toujours possible en 1 clic pour C1/C2).
