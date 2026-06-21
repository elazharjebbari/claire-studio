# Feature A — Décision : réglette multi-pistes verticale

> Décision **arrêtée** (non rediscutée). Ce document justifie le choix, explique le
> score, liste les risques et leurs parades, et acte le sort des alternatives écartées.
> Étude : `A-etude-comparative.md` · Matrice : `A-comparatif.csv` · Spéc : `A-specification.md`.

## 1. Décision

Implémenter une **réglette multi-pistes verticale** : un **gutter à droite** de la colonne
de lecture, **une piste fine par modèle** (Claude, Codex, +Mistral), **alignée aux
phrases**. Marqueur de frontière ⟦◷⟧ au début de chaque segment ; **teinte + abréviation
de catégorie optionnelles** ; **tooltip** au survol (modèle, catégorie, plage de phrases) ;
**clic = centrer la phrase**. Togglable **globalement** (réutilise `showBoundaries`) **et
par modèle**. Accessible AA, daltonisme-safe (forme **+** couleur), compacte et non
intrusive. Extensible à N modèles sans refonte.

## 2. Pourquoi (en une phrase)

C'est la **seule** option qui satisfait **simultanément** les quatre exigences cardinales
du besoin : *alignement à la phrase* (axe vertical = sens de lecture), *simultanéité de N
modèles*, *préservation de la zone de lecture* (gutter hors de `max-w-reading`), et
*accessibilité robuste* — le tout en **réutilisant** la donnée et les mécanismes déjà en
place (`computeRuns`/runs LLM, `getThemeToken`, `focusSentence`).

## 3. Justification du score (matrice pondérée)

Barème : note 1–5 par critère, pondérée par un poids 1–5. Total max = Σpoids × 5 =
**27 × 5 = 135**.

| Solution | Score pondéré | / 135 | Rang |
|---|---:|---:|:--:|
| **Réglette multi-pistes verticale** | **124** | **92 %** | **1** |
| Minimap horizontale repliable | 84 | 62 % | 2 |
| Bascule de source (baseline) | 83 | 61 % | 3 |
| Overlays empilés rail gauche | 80 | 59 % | 4 |
| Chips inline | 69 | 51 % | 5 |

**Lecture du résultat**
- Les **poids forts (5)** vont aux critères qui *définissent* le besoin : **lisibilité
  simultanée** et **scalabilité N modèles**. La réglette y marque 5/5 sur les deux ;
  toutes les autres y perdent gros (bascule 1+1, chips 2+2, overlays 4+2, minimap 3+3).
  C'est ce qui creuse l'écart (124 vs ≤ 84).
- La réglette n'est **pas** la moins chère (cout d'implémentation 3/5, poids faible 2) :
  l'alignement mesuré (hauteurs de ligne variables) coûte un peu. Mais ce poids volontairement
  **faible** reflète une décision d'agence : on **n'optimise pas pour le coût** sur une
  feature dont la valeur est la comparaison.
- La **bascule** plafonne malgré un coût nul et une compacité parfaite, **parce qu'elle ne
  répond pas** au besoin (simultanéité 1/5) — exactement le constat d'audit.
- L'écart minimap/bascule/overlays est **faible** (84/83/80) : aucune n'est mauvaise *en
  soi*, mais chacune échoue sur **une** exigence cardinale différente (minimap : alignement ;
  overlays : préservation de la lecture ; bascule : simultanéité). La réglette est la seule
  sans point faible cardinal.

> **Robustesse à la pondération** — la pondération a été fixée *avant* le scoring (poids =
> importance pour le besoin A, pas pour favoriser une solution). Test de sensibilité : si on
> **double** le poids du *coût d'implémentation* (2 → 4, le critère le plus défavorable à la
> réglette), les scores deviennent : réglette **130**, bascule 93, minimap 90, overlays 86,
> chips 77. La réglette **reste largement en tête** (+37 sur la 2e). Le choix ne dépend donc
> pas d'un réglage fin des poids.

## 4. Conséquences (ce que la décision implique)

- **Aucun nouvel endpoint, aucune migration** : on relit les `PreAnnotation` déjà importées
  et on consomme `claudeRuns`/`codexRuns` (déjà mémoïsés dans `DocumentPanel`).
- **Store** : 2 états + 2 actions (`gutterModels`, `gutterShowCategory`,
  `toggleGutterModel`, `toggleGutterCategory`), même pattern que les toggles existants.
- **1 nouveau composant** `ModelBoundaryRail.tsx` + (option) 1 helper pur `segmentsFromRuns` dans
  `runs.ts`.
- **Tokens** : nouveaux `gutter.*` (largeurs/opacités/z-index/durées/neutres), pas de hex en
  dur dans le composant.
- La **bascule de source** et `BoundaryEvidence`/`compare` **restent** : ce sont des outils
  complémentaires (inspection, édition, IAA chiffré, arbitrage), pas des doublons.

## 5. Risques & parades

| Risque | Gravité | Parade |
|---|:--:|---|
| **Désalignement** réglette/phrases (hauteurs variables : traduction FR per-phrase) | élevée | Alignement **mesuré** via un seul `ResizeObserver` sur le conteneur de lecture ; recalcul quand `displayLang`/`translatedSentences` changent (cf. spéc §3 A1, §6). Tests vitest sur `rowTops`. |
| **Surcharge visuelle** si Catégories ON + beaucoup de segments | moyenne | Catégorie **OFF par défaut** ; teinte à `cell.categoryOpacity` modérée ; corps de segment dessiné en **un bloc** (pas une cellule/phrase). |
| **Densité** si > ~5 modèles | moyenne | Mode **condensé** (largeur `track.widthDense`, initiales seules) prévu dans les tokens ; au-delà, orienter vers `compare` pairé. |
| **Empiètement** sous petits écrans | moyenne | Gutter **hors** de `max-w-reading` ; repli en mini-déclencheur / masquage < `xl` (la lecture prime). |
| **Confusion** « frontière mienne vs modèle » | faible | La réglette est **à droite** (référence LLM), le rail **à gauche** reste l'humain (édition). Séparation spatiale claire (raison majeure d'écarter S4). |
| **Coût d'alignement** sous-estimé | faible | Helper pur testé isolément ; pas de listener scroll JS (sticky natif) ; budget perf chiffré (spéc §6). |
| **A11y** régressions | faible | Checklist a11y (spéc §7) en Definition of Done ; tooltips au focus ; `role="grid"` + roving tabindex ; contraste via `readableTextColor`. |

## 6. Alternatives écartées (et pourquoi, brièvement)

- **Bascule de source (baseline)** — *écartée comme réponse à A* (conservée comme outil) :
  pas de simultanéité (le problème même) ; non scalable à N (compare = 2 juges).
- **Minimap horizontale** — *écartée* : axe X contre-intuitif (le document se lit en Y) ;
  désalignement structurel avec les phrases ; marqueurs fusionnés à haute densité ;
  cibles a11y trop petites. *Réserve* : candidate pertinente pour une future **navigation**
  globale, pas pour la comparaison fine.
- **Overlays empilés rail gauche** — *écartée* : charge la marge **de lecture** (à gauche)
  au lieu de la préserver ; mélange statut édition (humain) et référence (LLM) au même
  endroit ; tooltips/clic peu naturels dans une zone étroite collée au texte.
- **Chips inline** — *écartée* : intrusives (hachent le texte → casse A5) ; lecture croisée
  faible (pas d'alignement colonne) ; doublon avec les fantômes LLM existants ; se dégrade
  vite avec N.

## 7. Critères de réévaluation (quand rouvrir la décision)

Rouvrir **seulement** si : (a) le nombre de modèles dépasse durablement ~5 **et** que le
mode condensé s'avère insuffisant en tests utilisateurs ; (b) un besoin de **vue globale
document** (navigation) émerge — alors **ajouter** une minimap en complément, sans retirer
la réglette ; (c) des mesures de perf montrent un coût d'alignement inacceptable malgré les
parades (peu probable au vu du budget chiffré).
