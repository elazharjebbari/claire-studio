# Comportements — interactions, transitions & feedback

> Spécification des micro-interactions du dispositif C1–C5 / multi-label.
> Découle du socle (`principes_design.md`, `systeme_visuel/*`). Aucune action ne dépasse
> **200 ms** de feedback perçu ; toute transition est **réversible** et **non-couleur-seule**
> (forme + glyphe + texte). Cibles cliquables **≥ 24 px** (gouttière dense) / **≥ 32 px**
> (inspecteur).

## 1. Conventions de timing & d'animation

| Token | Durée | Courbe | Usage |
|---|---|---|---|
| `instant` | 0–50 ms | — | bascule d'état logique, focus |
| `micro` | 80–120 ms | ease-out | survol, apparition de glyphe, pastille `＋N` |
| `standard` | 120–180 ms | ease-in-out | validation, toggle, swap primaire/secondaire |
| `alerte` | 180–200 ms | ease-out + 1 pulse | conflit C4/C5 (jamais clignotant continu) |

Règle d'or : **le changement visible démarre en < 200 ms** ; au-delà, c'est un état de
chargement explicite (skeleton/spinner), pas une micro-interaction.

## 2. Tableau Action → réaction UI → animation → feedback

| # | Action (geste) | Réaction UI (état avant → après) | Animation (durée/courbe) | Feedback multi-canal (forme + glyphe + texte + couleur) | Réversibilité |
|---|---|---|---|---|---|
| **A. Survol d'une clause / d'un chip** | pointer sur la clause, le ClauseChip ou un chip de thème | élévation légère + révélation du rail d'actions rapides ; tooltip de provenance | `micro` 80–120 ms, ease-out | tooltip texte « Validé via le triage — règle C2 · Haute » ; halo de focus (anneau accent) ; aucune perte d'info au survol | sortie pointeur = retour immédiat (`instant`) |
| **B. Focus clavier (Tab) sur cible** | navigation clavier vers chip/toggle/bouton | anneau de focus visible (≥ 3:1) ; même tooltip que survol via `aria-describedby` | `instant` | contour de focus net + `aria-label` lu ; ordre de tabulation = primaire → secondaires → toggle → valider | reversible par navigation |
| **C. Clic « Valider » (provenance moteur ⚡)** | clic bouton valider (≥ 24 px) | `◷ ambre (a_valider)` → `⚡ vert (valide) + Cx` ; piste de validation passe au vert ; ClauseChip du plan met ✓ | `standard` 120–180 ms, ease-in-out ; glyphe morph ◷→⚡ + transition ambre→vert | forme **⚡** (stable) + couleur **vert #34D399** + badge **Cx** teinté niveau + texte « Validé via le triage » ; toast discret optionnel | undo/redo global (transactionnel) |
| **C-bis. Clic « Valider » (pré-annotation ★ / manuel ✎)** | adoption d'un seed (★) ou saisie manuelle (✎) | `◷ ambre` → `★ vert` (seed) ou `✎ vert` (manuel) | `standard` ; même morph que C | forme **★** ou **✎** conservée + vert + tooltip « Pré-annotation LLM confirmée » / « Saisi manuellement » | undo/redo global |
| **D. « Valider + suivant » (rail)** | clic action combinée | validation (comme C) + scroll/focus animé vers la clause suivante non validée | validation `standard` 120–180 ms + scroll `standard` enchaîné (total perçu < 200 ms avant le scroll) | même feedback que C + indicateur de progression du plan mis à jour | undo restitue l'état ET la position |
| **E. Toggle Multi-label 🏷 → ON** | clic/Espace sur le toggle 🏷 (#64B5F6) | `Mono` → `Multi` : apparition des chips secondaires (contour pointillé `+`) sous le primaire ; pastille `＋N` apparaît sur le ClauseChip du plan | `standard` 120–180 ms ; chips secondaires fondu+glissement court ; `＋N` `micro` | switch positionné à droite + libellé **« Multi-label »** + glyphe **🏷** + fond bleu clair léger ; distinguable **sans couleur** (position + libellé) | **le toggle EST l'annulation** (voir F) |
| **F. Toggle Multi-label 🏷 → OFF (annuler)** | re-clic sur le toggle 🏷 | `Multi` → `Mono` : retrait des chips secondaires (le primaire reste) ; pastille `＋N` disparaît | `standard` 120–180 ms ; sortie inverse de E | switch à gauche + libellé **« Mono »** ; retour exact à l'état précédent (réversibilité native, principe 2) | re-clic = re-ON ; filet undo/redo global |
| **G. Permuter primaire ↔ secondaire (swap-primary)** | clic « Permuter » dans la SuggestionCard / inspecteur | le chip secondaire devient **plein/gras/✓**, l'ancien primaire devient **pointillé/`+`** ; ordre de position échangé | `standard` 120–180 ms ; transition de style (remplissage/bordure) + réordonnancement | forme des chips change (plein↔pointillé) + marque ✓↔+ + libellé d'ordre ; pas de saut brutal | undo/redo + re-permuter |
| **H. Ajout d'un secondaire hors-C3** | clic « + thème secondaire » (inspecteur), choix dans la palette | nouveau chip **pointillé `+`** ajouté à la suite ; `＋N` incrémenté ; passe en `Multi` si Mono | `micro`→`standard` ; chip entrant fondu+scale léger | chip pointillé + `+` + libellé du thème + `aria-live` « secondaire ajouté » ; refuge **jamais** proposé en secondaire | suppression (clic ✕ sur le chip) réversible |
| **I. Retirer le 2ⁿᵈ thème** | clic « Retirer 2ⁿᵈ » / ✕ sur un chip secondaire | chip secondaire retiré ; `＋N` décrémenté ; retour `Mono` si plus aucun secondaire | `standard` ; chip sortant fondu | `aria-live` « secondaire retiré » + mise à jour `＋N`/plan ; primaire intact | undo/redo restitue le chip |
| **J. Conflit C4/C5 détecté** | le moteur classe la clause en C4 (◑ ambre) ou C5 (⚖ rose) | badge de niveau vif + glyphe **❗** ; **aucune** auto-validation ; bouton de décision manuelle (✎) mis en avant | `alerte` 180–200 ms + **1 seule** pulsation (pas de clignotement continu) | couleur vive (ambre C4 / rose C5 #F43F5E) + glyphe ❗ + texte « Décision humaine requise — pas d'auto-validation » ; saillance max dans le plan | reste en attente jusqu'à action ✎ |
| **K. Résolution d'un conflit C4/C5** | clic décision manuelle (✎) sur clause C4/C5 | `Conflit (❗)` → `✎ vert (valide, manuel)` ; ❗ retiré | `standard` 120–180 ms ; morph ❗→✎ + rose/ambre→vert | forme **✎** + vert + tooltip « Saisi/validé manuellement » + journalisation de la règle appliquée | undo/redo global |
| **L. Ouverture de la SuggestionCard (C3)** | clic bouton recommandation Cx / Entrée | popover ancré au rail : chip primaire plein + secondaire pointillé + explication + frontière ▮/┄ | `micro` 80–120 ms ; fondu+scale d'entrée | titre Cx coloré niveau + chips hiérarchisés + actions (Accepter/Permuter/Retirer/Choisir/Annuler) ≥ 24 px | Échap/clic dehors = fermeture sans effet |
| **M. Annuler un override (SuggestionCard)** | clic « Annuler override » | retour à la proposition initiale du moteur (set + provenance ⚡) | `standard` ; restauration animée des chips | texte « Override annulé — proposition du moteur restaurée » + chips remis à l'état proposé | couvert par undo/redo |

## 3. Règles transverses de feedback

- **Jamais de couleur seule** : chaque transition d'état modifie aussi une **forme** (★/⚡/✎/◷/❗),
  un **glyphe** (✓/+/＋N) et/ou un **libellé**. Le test « niveaux de gris » doit rester lisible.
- **Stabilité de la forme** : la forme de provenance (★/⚡/✎) ne change pas entre l'état proposé
  et validé ; **seule la couleur** passe d'ambre à vert. Cela évite la confusion « ai-je validé ? ».
- **Pas d'animation piège** : aucune animation > 200 ms ne masque une action ; aucun clignotement
  continu (conflit = 1 pulse unique puis état stable saillant).
- **Réversibilité visible** : pour le multi-label, **aucun bouton « undo » dédié n'est requis** sur
  le geste courant — le toggle 🏷 le porte. L'undo/redo global reste le filet transactionnel.
- **Cohérence d'emplacement** : niveau (couleur) dans badge/gouttière ; provenance (forme) sur la
  piste/chip/en-tête ; multi-label (plein/pointillé + `＋N`) sur document/plan/inspecteur — les
  teintes proches (lime C2, vert validé, vert manuel) ne se télescopent jamais au même endroit.
- **Accessibilité du mouvement** : respecter `prefers-reduced-motion` — les transitions de style
  restent (changement instantané de forme/couleur/glyphe) mais les déplacements/scale sont
  supprimés ; le feedback < 200 ms est alors un changement d'état immédiat.
