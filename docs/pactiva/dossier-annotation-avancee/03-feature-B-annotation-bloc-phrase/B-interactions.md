# Feature B — Table des interactions (gestes → store → rendu)

> Table **exhaustive** des gestes (souris + clavier) pour le modèle hybride
> **phrase atomique + bloc dérivé**. Pour chaque cas : **geste**, **action(s) du store**
> (`store/workspace.ts`), **conséquence visuelle** (rail/poignées via `computeRuns` +
> `deriveBlocks`), **undo**.
>
> Légende store : actions **existantes** = `setBoundary`, `toggleBoundary`,
> `removeBoundary`, `updateDraft`, `selectRange`, `toggleSelected`, `setSelectedClauses`,
> `clearSelection`, `undo`, `redo`. Action **nouvelle** (seul ajout requis par B) =
> `applyBlockOp` (lot atomique = **un** snapshot undo). Toutes no-op si `readOnly` (R1).

## 1. Gestes SOURIS

| # | Geste | Cible | Action(s) store | Conséquence visuelle | Undo |
|---|-------|-------|-----------------|----------------------|------|
| S1 | **Clic** | une phrase | ouvre `SentenceMenu` ; au choix d'un thème → `toggleBoundary(i, t)` | phrase prend la teinte `t` ; **fusionne** au voisin de même thème → bloc agrandi (dérivé) | 1 |
| S2 | **Clic** sur phrase déjà au thème `t`, re-choix `t` | une phrase | `toggleBoundary(i, t)` → `removeBoundary(i)` | phrase redevient neutre ; bloc voisin **scindé** si elle était interne | 1 |
| S3 | **Glisser** (press-move-release) | phrases `i..j` | pendant : `selectRange(i, k)` (live) ; au relâché : surbrillance de plage | bande de sélection sur `[i..j]` ; `SelectionToolbar` apparaît (« n sélectionnées ») | — |
| S4 | **Maj+clic** | de l'ancre courante à `j` | `selectRange(ancre, j)` | idem S3 (sélection contiguë) | — |
| S5 | **Cmd/Ctrl+clic** | phrase isolée | `toggleSelected(i)` (ajoute/retire de la sélection) | sélection **discontinue** possible | — |
| S6 | **Choix d'un thème** dans `SelectionToolbar` (après S3/S4/S5) | plage sélectionnée | **`applyBlockOp({kind:"annotateRange", anchors:[…], theme:t})`** (remplace la boucle `setBoundary` par phrase par **un** lot) | toute la plage prend `t` → **un bloc** dérivé `[i..j]` ; sélection effacée | **1** (lot) |
| S7 | **Double-clic** | une phrase annotée | `setSelectedClauses(blockAt(index).localIds)` | **sélectionne le BLOC contigu** de même thème ; poignées de bord affichées | — |
| S8 | **Double-clic** | phrase neutre | `clearSelection()` + `clearClauseSelection()` | aucune sélection (rien à grouper) | — |
| S9 | **Glisser la poignée de bord** vers l'extérieur | bord d'un bloc sélectionné | `applyBlockOp({kind:"extend", anchors:[nouvelles], theme:bloc.theme})` | bloc **étendu** ; collision → écrase la cible (politique spec §3.3) | **1** (lot) |
| S10 | **Glisser la poignée de bord** vers l'intérieur | bord d'un bloc sélectionné | `applyBlockOp({kind:"shrink", anchors:[retirées]})` | bloc **réduit** ; phrases libérées redeviennent neutres | **1** (lot) |
| S11 | **Clic-droit** (ou long-press ~450 ms) | une phrase interne à un bloc | ouvre `SentenceMenu` ; re-thématiser → `setBoundary(k, t')` | **override** : `k` change de teinte → bloc **scindé** en sous-blocs dérivés (split visuel) | 1 |
| S12 | **Clic-droit** → « Retirer » | une phrase | `removeBoundary(k)` | phrase neutre ; split si interne | 1 |
| S13 | **Right-drag** (glisser bouton droit) | plage de phrases | `setSelectedClauses(clauseRangeBetween(runs, from, to))` (P8, existant) | sélection **multi-blocs** ; `SelectionToolbar` mode bloc | — |
| S14 | **« Annoter les blocs »** (toolbar mode bloc) | blocs sélectionnés | `applyBlockOp({kind:"annotateRange", anchors:[toutes les phrases des blocs], theme:t})` | tous les blocs sélectionnés re-thématisés en `t` ; adjacents fusionnent | **1** (lot) |
| S15 | **« Désannoter le bloc »** (toolbar mode bloc) | bloc(s) sélectionné(s) | `applyBlockOp({kind:"clearBlock", anchors:[localIds → ancres]})` | bloc(s) effacé(s) ; voisins inchangés | **1** (lot) |
| S16 | **Survol** | un bloc | (aucune mutation) | liseré + tooltip « Bloc <thème> · phrases i–j · n phrases » | — |
| S17 | **Clic** ailleurs / **Échap** | hors sélection | `clearSelection()` + `clearClauseSelection()` | sélection et poignées masquées | — |

## 2. Gestes CLAVIER (raccourcis proposés)

> Cohérents desktop ; n'entrent pas en conflit avec la navigation `j/k` existante
> (`moveFocus`). `Espace`/`Maj+flèches` étendent la **sélection** ; les lettres de thème
> restent gérées par la palette. Tous les mutateurs sont **no-op** en `readOnly`.

| # | Raccourci | Effet | Action(s) store | Rendu | Undo |
|---|-----------|-------|-----------------|-------|------|
| K1 | `j` / `k` (ou ↓ / ↑) | déplacer le focus phrase | `moveFocus(+1)` / `moveFocus(-1)` | curseur de focus déplacé | — |
| K2 | `Maj+↓` / `Maj+↑` | étendre la sélection d'une phrase | `selectRange(ancre, focus±1)` | plage de sélection grandit/rétrécit | — |
| K3 | `Espace` | (dé)sélectionner la phrase focalisée | `toggleSelected(focus)` | sélection discontinue | — |
| K4 | `Échap` | annuler la sélection / fermer menu | `clearSelection` + `clearClauseSelection` | sélection et poignées masquées | — |
| K5 | `A` (puis palette) | annoter la sélection courante | si sélection → `applyBlockOp(annotateRange)` ; sinon ouvre palette sur le focus | plage → bloc dérivé `t` | **1** (lot) |
| K6 | `Entrée` sur phrase focalisée | ouvrir le menu d'annotation | ouvre `SentenceMenu` au focus | popover thème | — |
| K7 | touche de thème (palette ouverte) | poser/retirer le thème (toggle) | `toggleBoundary(focus, t)` | phrase ↔ neutre ; merge/split dérivés | 1 |
| K8 | `D` (sur phrase/bloc) | **double-clic clavier** : sélectionner le bloc du focus | `setSelectedClauses(blockAt(focus).localIds)` | bloc sélectionné + poignées | — |
| K9 | `Maj+]` | **étendre** le bloc sélectionné d'une phrase (bord bas) | `applyBlockOp({kind:"extend", anchors:[end+1], theme})` | bloc +1 phrase | **1** (lot) |
| K10 | `Maj+[` | **réduire** le bloc sélectionné d'une phrase (bord bas) | `applyBlockOp({kind:"shrink", anchors:[end]})` | bloc −1 phrase | **1** (lot) |
| K11 | `Suppr` / `Backspace` | désannoter la sélection (phrase, plage ou bloc) | `applyBlockOp({kind:"clearBlock", anchors:[…]})` (ou `removeBoundary` si 1 phrase) | phrases redeviennent neutres | **1** (lot) |
| K12 | `Cmd/Ctrl+Z` | annuler | `undo()` (restaure le snapshot complet) | l'état précédent revient **d'un coup** (lot compris) | — |
| K13 | `Cmd/Ctrl+Maj+Z` (ou `Ctrl+Y`) | rétablir | `redo()` | rétablit la dernière annulation | — |

## 3. Couverture des cas exigés (récapitulatif)

| Cas (besoin) | Gestes | Atomicité undo |
|--------------|--------|:---:|
| **Créer phrase** (B1) | S1, K6+K7 | 1 |
| **Créer plage / bloc** (B2) | S3/S4/S5 → S6, K2/K3 → K5 | **1** lot |
| **Override** (B3, split) | S11, S12, K7 sur phrase interne | 1 |
| **Étendre** (B4) | S9, K9 | **1** lot |
| **Réduire** (B4) | S10, K10 | **1** lot |
| **Merge** (B5) | **automatique** (re-dérivation après S1/S6/S9) | (n/a) |
| **Split** (B5) | conséquence de S11/S12/K7 | 1 |
| **Toggle off phrase** (B6) | S2, S12, K7 | 1 |
| **Toggle off bloc** (B6) | S15, K11 | **1** lot |
| **Undo / Redo** (B9) | K12 / K13 | — |

## 4. Règles transverses d'interaction
- **Priorité des modes** (existant `SelectionToolbar`) : si des **blocs** sont sélectionnés
  (`selectedClauseIds`), le mode bloc prime sur la sélection de phrases.
- **Sélection vs édition** : sélectionner (S3–S5, S7, S13, K2–K3, K8) ne modifie **jamais** la
  donnée ; seules les actions thème/poignées/suppression mutent.
- **`applyBlockOp` = un undo** : tout geste agissant sur **plusieurs** phrases (plage, extend,
  shrink, clear bloc) passe par `applyBlockOp` → **un seul** snapshot et **une** entrée
  `actionLog` (`block.*`). Les gestes mono-phrase gardent l'API existante (un snapshot).
- **`readOnly` (R1)** : S1-S2 ouverture de menu autorisée en lecture, mais toute mutation
  (`setBoundary`/`removeBoundary`/`applyBlockOp`) est **no-op** ; sélection et navigation
  restent disponibles (cohérent avec les gardes existantes du store).
- **A11y** : tous les gestes souris ont un équivalent clavier (K1–K13) ; poignées focusables ;
  feedback bloc/phrase non uniquement chromatique (cf. spec §6).
