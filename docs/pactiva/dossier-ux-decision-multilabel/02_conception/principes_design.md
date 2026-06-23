# Principes de design — clarté du triage C1–C5 & du multi-label

> Socle partagé du dossier. Tout le reste (wireframes, specs, prototypes, runbook) en découle.
> Conception UI/UX **sans code** ; adapté à l'app existante (claire-studio / Pactiva).

## 0. L'idée directrice : 3 canaux visuels orthogonaux

Le problème actuel vient du fait qu'un même signal (couleur) tente de porter trop de sens.
On sépare **3 canaux** indépendants, chacun avec son propre vecteur visuel :

| Canal | Question | Vecteur | Où |
|---|---|---|---|
| **Niveau C1–C5** | « quelle difficulté / quel accord ? » | **couleur** du badge (conservée) | carte de suggestion, gouttière, badge de niveau |
| **Provenance de validation** | « qui a validé : pré-annotation, moteur, ou moi ? » | **forme** d'icône (★ / ⚡ / ✎) | piste de validation, ClauseChip, en-tête de clause |
| **Multi-label** | « combien de thèmes, et lequel domine ? » | **chip plein vs pointillé** + toggle 🏷 + badge `+N` | document, inspecteur, plan |

Bénéfice : chaque canal reste lisible isolément, et leur superposition ne crée pas de
collision (couleurs proches placées à des endroits distincts).

## 1. Clarté (1 action = 1 geste, feedback immédiat)

- Toute action (valider, activer multi-label, choisir un thème) produit un **changement
  d'état visible en < 200 ms** : couleur, forme et/ou glyphe.
- La règle appliquée est **nommée** au moment de l'action (ex. tooltip « Validé via le triage —
  règle C2 · Haute »), jamais implicite.

## 2. Réversibilité (toggle, pas d'action piège)

- La validation multi-label est un **toggle** : re-cliquer **annule** (retour à l'état
  précédent) — pas besoin de chercher un « undo » séparé pour le geste courant.
- Tout reste couvert par l'undo/redo global existant (transactionnel) en filet de sécurité.
- Aucune action destructrice sans état réversible ou confirmation.

## 3. Hiérarchie (le principal ressort, le secondaire reste discret)

- Voir `systeme_visuel/hierarchie_visuelle.md` : primaire = plein/gras ; secondaire =
  contour pointillé/`+`. Lisible même en niveaux de gris.

## 4. Cohérence (même signe = même sens, partout)

- Le trio de provenance ★/⚡/✎ et les couleurs de niveau proviennent d'une **source unique**
  (cf. `lib/triage/levels.ts` existant + `systeme_visuel/*.yaml`) et s'affichent à l'identique
  dans la file, le rail, le document, l'inspecteur et le plan.

## 5. Accessibilité (WCAG AA, jamais la couleur seule)

- Information toujours portée par **forme + glyphe + texte**, la couleur en renfort.
- Contraste texte ≥ 4.5:1, éléments non textuels ≥ 3:1 ; navigation clavier complète ; focus
  visible ; `aria-label`/`title` sur chaque marque. Détail : `03_specifications/accessibilite.md`.

## 6. Multi-label : deux portes d'entrée

1. **Via C3** (conflit structuré) : la suggestion propose déjà primaire + secondaire ; valider
   pose le set ; toggle pour activer/désactiver.
2. **Hors C3** (pas de conflit, mais on VEUT un secondaire) : affordance **« + thème
   secondaire »** dans l'inspecteur (palette de thèmes) — même rendu (chip pointillé) et même
   toggle. → le multi-label n'est pas réservé aux cas de conflit.

## 7. Adaptativité au cas (C1/C2 vs C3 vs C4/C5)

- **C1/C2** : action primaire 1-clic (icône ⚡, peu d'attention).
- **C3** : set multi-label + toggle, feedback bleu clair, hiérarchie primaire/secondaire.
- **C4/C5** : alerte (couleur vive + `❗`), **jamais d'auto-validation** ; bouton de décision
  manuelle explicite (✎).
