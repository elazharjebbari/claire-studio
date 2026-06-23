# Système d'aide à la décision — UI & pédagogie (File de triage)

> Documente le **fonctionnement visible** du système d'aide à la décision : comment
> l'annotateur comprend et pilote le triage C1–C5. Complète `08-ux-ergonomie.md`
> (parcours) et `09-design-systeme.md` (tokens). Code source : `frontend/src/lib/triage/`
> + `frontend/src/components/workspace/triage/`.

## 1. Principe (rappel)

Pour chaque phrase, le moteur **déterministe** dérive un **niveau de confiance C1–C5** de
l'**accord entre plusieurs juges LLM** (jamais d'une confiance auto-déclarée), et propose :
le **set de thèmes** (1 primaire + N secondaires), la **frontière** (dure/molle), et la
**logique** (la règle qui s'applique). L'humain **accepte d'un geste** ou **ajuste**.
Aucun appel LLM supplémentaire : l'explication est traçable, journalisée, réversible.

## 2. Code couleur des niveaux (source unique)

Défini une seule fois dans `frontend/src/lib/triage/levels.ts` (`TRIAGE_LEVEL_META`) et
réutilisé partout (badge de carte, compteurs, légende, modale, overlay document) — garantit
la cohérence visuelle.

| Niveau | Libellé | Couleur | Hex | Glyphe | Signification (méthodologie) |
|---|---|---|---|---|---|
| **C1** | Or | émeraude | `#10B981` | ● | Accord total thème **et** frontière → référence directe ; acceptable **en lot**. |
| **C2** | Haute | lime | `#84CC16` | ◐ | Thème unanime, frontière en majorité (ou override anti-refuge) → **confirmer** d'un clic. |
| **C3** | Multi-label | violet | `#8B5CF6` | ⧉ | Désaccord **structuré** entre 2 thèmes liés (cluster) → multi-label ; **valider le couple**. |
| **C4** | Majorité | ambre | `#F59E0B` | ◑ | Majorité hors refuge/cluster + dissidence → **vérifier** (garder / choisir l'autre). |
| **C5** | Arbitrage | rose | `#F43F5E` | ⚖ | Désaccord fort/éclaté, pas de gagnant net → **décision humaine** ouverte. |

**Choix chromatique.** Gradient d'accord décroissant **émeraude → lime → ambre → rose**
pour C1‑C2‑C4‑C5 (sémantique « plus on descend, plus l'humain doit intervenir »). **C3
est codé en violet** (et non sur le gradient) : ce n'est pas un « moins bon » niveau mais un
**cas qualitativement différent** (chevauchement juridique réel → multi-label). Les teintes
de fond sont posées à très faible opacité (`color + 1a/22` ≈ 6–13 %) pour rester **subtiles**
sur fond sombre ; le texte/glyphe porte la couleur pleine (contraste AA).

## 3. Surfaces pédagogiques dans la file

1. **Compteurs colorés** (barre haute) — chaque pastille `Cx N` prend la teinte du niveau +
   un `title` au survol donnant la signification. Lecture immédiate de la distribution.
2. **Badge de la carte** — niveau + libellé + glyphe, même couleur.
3. **Légende repliable** (pied, `triage-legend-toggle`) — « ce que chacun veut dire » :
   liste C1→C5 avec pastille + signification d'une ligne. Repliée par défaut (subtile),
   dépliable d'un clic ; n'occupe pas d'espace tant qu'on n'en a pas besoin.
4. **Modale d'aide** (`?` dans l'en-tête, ou touche `?`) — `TriageHelpModal` : explique le
   principe, les 5 niveaux (couleur + signification + geste), le multi-label, les frontières,
   et **tous les raccourcis**. Accessible (role=dialog, aria-modal, Échap, clic extérieur).

## 4. Raccourcis clavier

`Entrée` accepter/confirmer/valider (hors C5) · `j`/`k` (ou ↓/↑) naviguer (le document
suit) · `A` accepter tout C1 · `S` accepter la sélection de phrases · `?` ouvrir l'aide ·
`Échap` fermer. Les frappes sont ignorées dans un `INPUT`/`TEXTAREA`.

## 5. Surfacer le niveau C1–C5 dans le DOCUMENT — étude d'approches

Objectif : afficher **subtilement** et de façon **togglable** (afficher/cacher) le niveau de
résolution de chaque phrase **dans le document**, avec le code couleur ci-dessus, sans
alourdir une interface déjà dense (rail de thème à gauche, piste de validation, badges,
gouttière des juges, overlays togglables). Approches évaluées :

| # | Approche | Description | Forces | Faiblesses | Subtilité |
|---|---|---|---|---|---|
| **A** | **Liseré sur la piste de validation** | Teinter le bord gauche déjà présent (validation-track) par le niveau, ou le doubler d'un fin trait. | Réutilise une zone existante ; zéro encombrement ; cohérent. | Conflit visuel possible avec le statut validé/à-faire qui occupe déjà cette piste. | ★★★ |
| **B** | **Pastille de niveau sur le badge de thème** | Ajouter un petit point/anneau coloré (●) sur le badge de clause existant. | Localisé sur l'objet « clause » ; lecture par phrase ; n'ajoute pas de colonne. | Petit ; n'apparaît que là où il y a un badge ; bruit si beaucoup de badges. | ★★★ |
| **C** | **Mini-colonne « triage » dans la gouttière** | Une fine colonne (comme `ModelBoundaryRail`) avec une cellule teintée par phrase. | S'intègre au système de gouttière/légende existant (togglable nativement) ; vue d'ensemble verticale. | Ajoute une colonne ; ne concerne que les phrases triables (≥2 juges). | ★★☆ |
| **D** | **Surlignage de fond de phrase** | Teinter très légèrement le fond de la phrase selon le niveau. | Très lisible d'un coup d'œil. | Entre en concurrence avec sélection/focus/injustice qui utilisent déjà le fond → risque de surcharge. | ★☆☆ |

**Recommandation : B (pastille sur le badge) + bascule globale**, éventuellement combinée à
**A** pour les phrases sans badge. Justification : la pastille est **ancrée sur la clause**
(l'unité que le niveau qualifie), reste **discrète**, et s'aligne sur le pattern d'overlays
existant. La bascule s'ajoute à la **légende/menu d'overlays** (comme `showBoundaries`,
fantômes…), avec un état persistant `showTriageLevels` dans le store UI.

> Décision d'implémentation arrêtée avec l'équipe produit (voir suivi). Une fois choisie,
> l'overlay réutilise `TRIAGE_LEVEL_META` (couleur/glyphe) et le `triage_level` déjà persisté
> sur la clause (additif) ainsi que `useTriage` pour les phrases non encore annotées.

## 6. Accessibilité

- Modale : `role=dialog`, `aria-modal`, focus géré, fermeture Échap/clic extérieur.
- Couleur **jamais** seul vecteur d'information : niveau toujours accompagné du **code Cx**
  et d'un **glyphe** ; tooltips textuels sur les compteurs ; légende textuelle.
- Contraste : texte/glyphe en couleur pleine sur fond très peu opaque (AA).
