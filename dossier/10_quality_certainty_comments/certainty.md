# Certitude (échelle intuitive 0–3)

> Périmètre : feature **F10** (gestion certitude). Champs : `Clause.certainty[0..3]?`,
> `Annotation.global_certainty[0..3]?`. Vocabulaire : `vocabulary.yaml` `certainty_scale`.
> Surface : inspecteur du workspace (boutons + raccourcis `0`–`3`).

## 1. L'échelle

L'échelle est **intuitive, à 4 paliers**, conçue pour être posée au clavier sans réfléchir
(navigation.md §3) :

| Valeur | Libellé | Emoji | Raccourci | Couleur | Sens opérationnel |
|---|---|---|---|---|---|
| 0 | Incertain | 🤔 | `0` | `#94A3B8` | « je devine / à revoir » |
| 1 | Plutôt | 🙂 | `1` | `#38BDF8` | « penche vers ce thème mais doute » |
| 2 | Confiant | 😀 | `2` | `#34D399` | « raisonnablement sûr » |
| 3 | Certain | 💯 | `3` | `#22C55E` | « évident, sans ambiguïté » |

`certainty` est **optionnel** (`?`) : une clause sans certitude posée est `null` (= « non renseigné »),
distinct de `0` (= « incertain », posé volontairement). Cette distinction est préservée partout
(agrégation, export, métriques) — ne jamais coalescer `null` en `0`.

## 2. Granularité : clause puis annotation

Deux niveaux :

- **`Clause.certainty`** : confiance sur **ce segment** (cette frontière + ce thème). C'est le niveau
  où l'annotateur exprime le doute, au moment de poser/éditer la clause.
- **`Annotation.global_certainty`** : confiance d'ensemble sur **tout le document**. Peut être posée
  explicitement par l'annotateur, ou **dérivée** des certitudes de clause (voir §3).

## 3. Agrégation clause → annotation

Quand `global_certainty` n'est pas saisie manuellement, le frontend propose une valeur **suggérée**
(l'annotateur valide ou corrige — jamais d'écriture silencieuse). Règle d'agrégation :

- Sur les clauses ayant une `certainty` non nulle, agréger par une mesure **conservatrice** : la
  **certitude globale suggérée = arrondi de la moyenne pondérée par la couverture en phrases de chaque
  clause**, puis bornée vers le bas par la présence de clauses très incertaines.
- Concrètement : `g = round( Σ_c (certainty_c · span_len_c) / Σ_c span_len_c )`, puis si une clause
  porte `certainty=0`, plafonner la suggestion à `1` (un doute fort tire l'ensemble vers le bas).
- Les clauses `certainty=null` sont **exclues** du calcul (pas comptées comme 0). Si toutes sont
  nulles, la suggestion est `null`.

Ce comportement est documenté et testé pour être défendable scientifiquement (la pondération par
longueur évite qu'une micro-clause incertaine domine ; le plafonnement par doute fort est explicite).

## 4. Usage downstream

La certitude est un **signal de qualité**, jamais un filtre destructif :

- **Revue (F10, `review_rating.md`)** : le reviewer voit la heatmap de certitude par clause pour
  cibler sa relecture sur les zones `0/1`. La rubrique de review peut pondérer.
- **IAA (`07_collaboration_versioning/inter_annotator_agreement.md`)** : on peut calculer un IAA
  restreint aux clauses `certainty ≥ 2` pour distinguer désaccord « assumé » vs « hésitant »
  (rapporté séparément, jamais en remplacement de l'IAA complet).
- **Export (`08_import_export/export_formats.md`)** : `certainty` et `global_certainty` sont des
  colonnes/champs de premier ordre (avec `null` préservé) ; le manifeste documente l'échelle.
- **Tableau de bord** : distribution de certitude par projet/annotateur (signal de difficulté du
  corpus ou de besoin de consigne), exposé dans `11_tracking_observability/metrics_catalog.csv`.
- **Pré-annotations** : une `Clause` issue d'un seed LLM démarre **sans** certitude (`null`) — la
  confiance est une décision **humaine** ; le LLM ne pose pas de certitude gold.

## 5. Garanties

- Échelle **fermée** {0,1,2,3} ; toute autre valeur rejetée (400). `null` autorisé = non renseigné.
- L'agrégation est **suggestive** : `global_certainty` n'est jamais écrasée sans action de
  l'annotateur (cohérent avec CLAUDE.md « expliquer/défendre chaque choix »).
- Stabilité d'affichage : couleurs/emojis viennent de `vocabulary.yaml` (source unique), pas de
  duplication front.

## 6. Tests (CONTRACT §6)

- `pytest certainty` : bornes {0..3} + `null` ; rejet hors borne ; `null` ≠ `0` préservé partout.
- `pytest certainty_aggregate` : pondération par longueur ; plafonnement par doute fort ; toutes
  nulles → suggestion `null` ; suggestion jamais écrite sans validation.
- `e2e review.spec` : pose au clavier `0`–`3`, heatmap en revue, certitude globale suggérée/validée.
