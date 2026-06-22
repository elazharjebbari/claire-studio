# UX & ergonomie — parcours, principes, raccourcis, accessibilité

Objectif : **non encombrant, intuitif, fluide**. La machine propose **et explique** ;
l'humain **accepte en 1 geste** ou **ajuste** sans friction. Deux surfaces, **un seul
modèle mental** (niveau → vigilance) et **les mêmes gestes**.

## 1. Deux surfaces complémentaires
### A. Mode « File de triage » (l'accélérateur, clavier-first)
Un panneau focalisé qui présente les phrases **regroupées et ordonnées par niveau**
(C1 → C5). On vide d'abord le facile (C1 par lot, C2 1 clic), puis on concentre
l'attention sur C4/C5. Toujours **ancré** : la phrase courante est surlignée dans le
document à côté (split view), donc on ne perd jamais le contexte.

### B. Carte de suggestion inline (édition en contexte)
La **même carte** apparaît dans le document (au clic/clic-droit d'une phrase via
`SentenceMenu`), sur une **frontière** (`BoundaryEvidence`) et dans l'**inspecteur** pour
la clause sélectionnée. Pour corriger ponctuellement sans entrer dans la file.

> Principe : **mêmes composants, mêmes gestes, mêmes couleurs** dans les deux surfaces.

## 2. Anatomie de la carte de suggestion (« contexte / décision / logique »)
```
[badge niveau]  [résumé 1 ligne]                         [CTA primaire]  [⋯ actions]
contexte : votes des K juges (pastilles colorées par juge)
décision : set recommandé (primaire ✓ + secondaire ◻) · frontière (dure ▮ / molle ┄)
logique  : la règle qui s'applique (+ justification mesurée : κ, préséance, cluster)
```
- **Contexte** = ce que les juges ont dit (transparence).
- **Décision** = ce que le système recommande (actionnable).
- **Logique** = *pourquoi* (confiance & traçabilité ; dérivée de la règle, pas d'un LLM).
- **Encombrement minimal** : 1 ligne de résumé visible ; contexte/logique repliés par
  défaut sur C1/C2 (déjà sûrs), dépliés sur C3/C4/C5 (besoin de comprendre).

## 3. Geste cible par niveau (le cœur de l'accélération)
| Niveau | Vue par défaut | Geste 1 (rapide) | Gestes d'ajustement |
|---|---|---|---|
| **C1** | repliée, lot | **Accepter le lot** (1 action pour N) | (rare) ouvrir pour exclure une phrase |
| **C2** | repliée | **Confirmer** (`Entrée`) | **Annuler l'override** (refuge restauré) |
| **C3** | dépliée | **Valider le set** (`Entrée`) | **Permuter** (`S`) · **Retirer 2nd** (`-`) |
| **C4** | dépliée | **Garder majorité** (`Entrée`) | **Choisir l'autre** (`→`/`2`) · en faire un multi |
| **C5** | dépliée, aucune présélection | **Choisir** un candidat (`1/2/3`) | **Créer multi** · **Indécidable** (`⟂`, escalade) |
| Frontière molle | inline ┄ | **Scinder** (confirmer) | **Fusionner** avec la précédente |

## 4. Raccourcis clavier (file de triage — alignés sur l'atelier existant)
| Touche | Action |
|---|---|
| `Entrée` | Accepter / Confirmer / Valider le set (action primaire du niveau) |
| `A` | Accepter le **lot** courant (C1) |
| `1` `2` `3` | Choisir le candidat n (C4 minoritaire / C5) |
| `S` | Permuter primaire/secondaire (C3) |
| `-` | Retirer le secondaire (C3 → mono) |
| `M` / `D` | Fusionner (merge) / Scinder (divide) une frontière molle |
| `U` | Annuler l'override anti-refuge (restaure le refuge) |
| `X` | Indécidable / escalader (C5) |
| `J` / `K` ou `↓`/`↑` | Item suivant / précédent (cohérent avec j/k du document) |
| `Échap` | Quitter la file (revenir à l'atelier) |

## 5. Principes ergonomiques (heuristiques appliquées)
1. **Effort proportionnel** : ce qui est sûr est replié et groupé ; ce qui est risqué est
   déplié et présélectionné a minima.
2. **Reconnaissance > rappel** : le set recommandé est pré-rempli ; l'humain reconnaît et
   confirme, il ne ressaisit pas.
3. **Visibilité de l'état** : badge de niveau coloré, compteur « k / N » par niveau,
   progression globale, voyant « ● brouillon ».
4. **Réversibilité** : tout override est annulable (valeur d'origine conservée) ; undo/redo
   global (⌘Z/⌘Y) couvre les actions de file.
5. **Prévention d'erreur** : C4 n'est jamais accepté « machinalement » (le minoritaire est
   montré) ; refuge jamais proposé en secondaire ; indécidable plutôt qu'un choix au hasard.
6. **Cohérence** : mêmes couleurs de thème, mêmes pastilles de juge, mêmes raccourcis que
   l'atelier (pas de second langage à apprendre).
7. **Charge cognitive** : 1 décision à la fois en mode file ; contexte ancré (split view).

## 6. Accessibilité (WCAG AA)
- **Clavier complet** : toute action a un raccourci ; focus visible ; ordre de tabulation logique.
- **Couleur non porteuse seule** : le niveau porte aussi un **label** (C1…C5) + une **icône**
  (●/▮/┄/⚖) — pas uniquement la teinte (daltonisme).
- **ARIA** : la file = `role="list"`/`listitem` ; la carte = `region` nommée (« Suggestion,
  niveau C3 ») ; les pastilles de juge ont un `aria-label` (« mistral : LICENSE_IP »).
- **Contraste** ≥ 4,5:1 sur le texte ; les bandes de couleur restent décoratives.
- **Lecteur d'écran** : l'explication (contexte/décision/logique) est lue dans cet ordre ;
  l'action primaire est annoncée (« Accepter le lot, 12 phrases »).
- **Réduction de mouvement** : `prefers-reduced-motion` désactive les transitions de carte.

## 7. États & cas limites (UX)
- **< 2 juges** : pas de triage → carte/queue masquées, bandeau « pré-annotations
  insuffisantes pour le triage ».
- **Aucune pré-annotation** : le mode file affiche un état vide explicite + lien prefill.
- **Conflit INV-2** (phrase déjà annotée) : la carte montre « déjà annotée » et propose
  d'ouvrir la clause existante au lieu de créer.
- **Frontière molle non tranchée** : visuellement pointillée ; rappel discret en fin de file
  (« k frontières molles à trancher »).
- **Indécidable (C5)** : retiré de la file active, listé dans « à escalader » (4ᵉ avis).
