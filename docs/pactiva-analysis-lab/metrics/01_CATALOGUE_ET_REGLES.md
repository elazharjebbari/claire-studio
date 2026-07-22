# Catalogue initial des métriques et règles de calcul

## Contrat commun

Chaque sortie contient : code/version, unité, valeur, numérateur, dénominateur, documents, unités,
acteurs, période, statuts, méthode, avertissements et liens de drill-down. Les valeurs nulles sont
« non calculables », jamais zéro. Les arrondis concernent l’affichage, pas le stockage.

## Catalogue MVP

| Code                        | Formule / définition                                  | Unité           | Support minimal           | Source                    |
| --------------------------- | ----------------------------------------------------- | --------------- | ------------------------- | ------------------------- | ------- | ------ | --- | ----------- |
| `coverage.v1`               | unités couvertes / unités attendues                   | phrase/document | 1 doc                     | Assignment, Clause        |
| `completion.v1`             | sessions soumises / assignées                         | document        | 1                         | Assignment, Annotation    |
| `certainty_distribution.v1` | distribution 0–3 + manquants                          | clause          | 10 clauses                | Clause                    |
| `multilabel_rate.v1`        | clauses avec >1 thème / clauses                       | clause          | 10                        | ClauseTheme               |
| `calendar_cycle.v1`         | médiane création→1re soumission                       | session         | 5 sessions                | Annotation, ActivityEvent |
| `raw_agreement.v1`          | accords / unités co-couvertes                         | phrase          | 20 communes               | observations              |
| `cohen_kappa.v1`            | `(Po-Pe)/(1-Pe)` par paire                            | phrase          | 20 + 2 classes            | service IAA               |
| `alpha_masi.v1`             | α Krippendorff distance MASI                          | phrase          | 2 acteurs/20 unités       | service IAA               |
| `jaccard_multilabel.v1`     | `                                                     | A∩B             | /                         | A∪B                       | ` moyen | phrase | 20  | ClauseTheme |
| `boundary_f1.v1`            | F1 des débuts dans tolérance définie                  | frontière       | 20                        | Clause                    |
| `theme_f1.v1`               | macro/micro F1 contre référence                       | thème           | support par thème visible | obs/Gold                  |
| `llm_acceptance.v1`         | suggestions adoptées sans changement / vues éligibles | phrase          | 20                        | provenance + events       |
| `gold_proximity.v1`         | accord sur phrases Gold décidées co-couvertes         | phrase          | 20                        | GoldSentence              |
| `entropy.v1`                | entropie normalisée des votes                         | phrase          | 2 acteurs                 | observations              |

## Alignement des unités

Pour une phrase, une clause est projetée par propagation du thème depuis son ancre jusqu’à l’ancre
suivante dans la même annotation. Pour les frontières, seules les ancres sont comparées. Les
documents sans recouvrement sont exclus d’une métrique pairwise mais restent visibles dans la
couverture. L’API expose toujours `eligible`, `included` et `excluded_by_reason`.

## Comparaisons

- intra : versions immuables du même annotateur ;
- inter-humains : statuts soumis/revue/approuvé par défaut ;
- humain–LLM : la référence est explicite, jamais implicite ;
- inter-LLM : identité = juge + version de modèle/schéma/prompt ;
- Gold : seulement les phrases `decided`, sauf métrique de readiness.

## Incertitude et faibles supports

Les proportions critiques proposent intervalle Wilson ; les métriques bootstrap indiquent seed,
nombre d’itérations et méthode. Sous le seuil, la valeur peut être masquée tout en affichant le
support et la raison. Les catégories rares ne sont jamais regroupées silencieusement.

## Métriques interdites au MVP

- « score global de performance » d’un annotateur ;
- temps actif déduit du délai calendaire ;
- classement nominatif ;
- précision LLM sans référence et recouvrement explicités ;
- moyenne de κ sans dispersion, paires et support disponibles ;
- causalité d’un effet d’ancrage déduite d’une simple corrélation.

## Validation scientifique

Chaque calculator possède jeux synthétiques, cas dégénérés, valeurs de référence calculées par une
implémentation indépendante et tests de propriétés (symétrie, bornes, invariance d’ordre). Toute
modification de formule incrémente la version et ne réécrit pas les anciens runs.
