# Spécification — Badge d'annotation (chip primaire / secondaire + badge `+N`)

> Composant central du canal 3 (multi-label). Hérite du socle (`principes_design.md`,
> `palette_couleurs.yaml`, `icones_validation.yaml`, `hierarchie_visuelle.md`). Aucune
> redéfinition des couleurs de niveau ni du trio de provenance ici — voir les fichiers dédiés.

## 1. Périmètre

Le « badge d'annotation » désigne le **chip de thème** affiché :
- sous le `clause-badge` du document (zone multi-label, repliable) ;
- dans la zone « Thèmes » de l'inspecteur ;
- dans la `SuggestionCard` (chip primaire plein + chip secondaire contour).

Il porte **un seul des trois canaux** : le thème et son rang (primaire / secondaire).
Le niveau Cx et la provenance de validation sont rendus ailleurs (badge de niveau, piste,
en-tête) pour éviter toute collision de teintes.

## 2. Chip PRIMAIRE (thème dominant — 1 seul)

| Propriété | Valeur |
|---|---|
| Forme | capsule pleine, coins arrondis (rayon 8 px) |
| Fond | couleur de thème à **18 % d'opacité** (lisibilité AA du texte par-dessus) |
| Bordure | **2 px pleine**, couleur de thème à pleine saturation |
| Texte | libellé du thème, **gras**, encre claire (`ink`) — contraste ≥ 4.5:1 |
| Marque | **`✓`** devant le libellé (préfixe), même graisse que le texte |
| Opacité globale | 1 |
| Taille | 100 % (hauteur cible ≥ 24 px en document dense, ≥ 32 px en inspecteur) |
| Position | en tête : à gauche (rangée horizontale) ou en haut (pile verticale) |

Le `✓` du chip primaire signe **le rang « primaire »**, pas l'état de validation (lequel est
porté par la marque de provenance ★/⚡/✎ sur la piste). On ne confond pas : le `✓` ici est un
**marqueur de hiérarchie de thème**, toujours présent sur le primaire, indépendamment du statut
validé / à valider.

## 3. Chip SECONDAIRE (thème connexe — N possibles, jamais un refuge)

| Propriété | Valeur |
|---|---|
| Forme | capsule à **contour pointillé** |
| Fond | transparent (ou couleur de thème à ~8 %, plus discret que le primaire) |
| Bordure | **1 px pointillée**, couleur de thème |
| Texte | libellé, graisse **normale**, encre claire |
| Marque | **`+`** devant le libellé (préfixe) |
| Opacité globale | 0.9 |
| Taille | **~85 %** du primaire (padding réduit) ; cible cliquable ≥ 24 px maintenue par hit-zone invisible |
| Position | à la suite du primaire : à droite (rangée) ou dessous (pile) |

Règle métier rappelée (backend natif) : **le refuge n'est JAMAIS secondaire**. Un chip secondaire
ne peut donc pas porter le thème « refuge » ; l'affordance « + thème secondaire » exclut ce thème
de sa palette.

## 4. Distinction garantie en niveaux de gris

Test d'accessibilité (cf. `hierarchie_visuelle.md`) : sans la couleur, le primaire reste
identifiable par **forme pleine + bordure 2 px + gras + `✓`** ; le secondaire par **contour
pointillé + `+` + graisse normale**. La hiérarchie ne repose donc jamais sur la teinte seule.

## 5. États interactifs

| État | Chip primaire | Chip secondaire |
|---|---|---|
| **Repos** | tel que ci-dessus | tel que ci-dessus |
| **Survol (hover)** | fond → 24 %, bordure +1 niveau de luminosité ; curseur `pointer` ; tooltip « Thème principal — {nom} » | bordure pointillée → pleine au survol (préfiguration cliquable), tooltip « Thème secondaire — {nom} · clic = options » |
| **Focus clavier** | anneau de focus `selection_ring` (2 px, offset 2 px), visible et distinct du hover | idem |
| **Sélection** | anneau `selection_ring` persistant + fond → 24 % ; le chip devient l'ancre des actions (permuter / retirer) | idem ; ouvre le menu contextuel (Promouvoir en primaire / Retirer) |
| **Validé** | inchangé visuellement (le statut validé est signalé par la provenance sur la piste, pas par le chip) | inchangé |
| **Désactivé** | opacité 0.4, pas d'anneau de focus, `aria-disabled` | idem |

Transitions : changement d'état visible en **< 200 ms** (cf. `interactions.md`), easing
standard. Aucun déplacement de layout au survol (seuls fond / bordure / anneau changent).

## 6. Permutation primaire ↔ secondaire (swap-primary)

- Geste : sur un chip secondaire sélectionné, action **« Promouvoir en primaire »** (menu ou
  glyphe ↑). L'ancien primaire **rétrograde** en secondaire (devient pointillé + `+`), le
  secondaire **promu** devient plein + `✓`.
- Animation : morphing court (≤ 200 ms) bordure pointillée → pleine et `+` → `✓`, sans
  re-flow brutal. Annonce lecteur d'écran : « {nom} est désormais le thème principal ».
- Mappe l'endpoint `swap-primary` existant ; couvert par l'undo/redo global.

## 7. Badge `+N` du plan (ToC / `ClauseChip`)

Sur le `ClauseChip` du `TocPanel`, ajout d'une **pastille `+N`** quand la clause porte N thèmes
secondaires (N ≥ 1).

| Propriété | Valeur |
|---|---|
| Contenu | `+` suivi du **nombre** de secondaires (ex. `+2`) ; jamais `+0` (la pastille disparaît) |
| Forme | petite pastille arrondie, posée en sur-impression du coin du `ClauseChip` (haut-droite) |
| Fond | bleu clair multi-label `#64B5F6` à faible opacité ; bordure 1 px `#64B5F6` |
| Texte | encre lisible, ≥ 10 px en taille de glyphe mais ≥ 12 px de hauteur effective |
| Tooltip / aria | « {N} thème(s) secondaire(s) — multi-label » |
| Position vs existant | n'altère pas le glyphe d'état `✓` / `◷` du `ClauseChip` ni sa teinte de thème ; la pastille est un **3ᵉ marqueur distinct**, dans un coin libre |

Objectif : repérer les clauses multi-label **sans les ouvrir**. La pastille n'encode que le
**nombre** ; le détail (quels thèmes) reste dans le document / l'inspecteur.

## 8. Règles de cohérence

- Le `✓` du chip primaire et le `✓` d'état validé (piste) sont **visuellement distincts par le
  contexte** (préfixe de libellé vs marque sur barre de piste) ; ne jamais les fusionner.
- Une clause a **exactement un** chip primaire. S'il n'existe pas encore de primaire (clause
  non annotée), aucun chip n'est affiché — pas de chip « vide ».
- Le nombre de chips secondaires affichés = N ; au-delà de 3 en mode document compact, replier
  en `+N` cliquable qui déplie la liste complète.
