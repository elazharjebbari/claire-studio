# graph/rules — le DSL des règles (ADR-003)

Un fichier YAML par version de règles ; compilé en Cypher (et en fonction Python pure pour les tests)
par `src/detection/rules/compile.py` (à écrire en phase 7). Gel : `FROZEN.txt` contient une ligne par
version gelée : `<sha256>  <fichier>  <version>  <date ISO>  <commit>`. Le moteur refuse d'exécuter sur la
population `holdout` une version absente de `FROZEN.txt` ou gelée après la première exécution.

## Champs d'une règle

| Champ | Sens |
|---|---|
| `id`, `item`, `family` | identifiant, item(s) de l'annexe, famille R1 présence · R2 absence · R3 composition · R4 incohérence |
| `where` | conjonction de conditions sur une `Norm` : `theme` (T11 de la clause), `actor`, `modality`, `action`, `object_contains`/`object_contains_any`, `condition`, `notice`, `remedy` ; une liste = appartenance ; `any:` = disjonction de blocs |
| `unless` | exceptions (négation) : `related` (norme liée par `EXCEPTION_TO`/`CONDITIONAL_ON` satisfaisant un motif), `exists_in_document` (une autre norme du document satisfait un motif), `has_norm` (la clause porte une norme satisfaisant un motif), `object_contains` |
| `has_norm` (dans `where`) | pour R2 : la clause porte une norme satisfaisant le motif |
| `threshold` | items quantitatifs : `{field, op, value}` déclaré avant évaluation |
| `item_selector` | choix de l'item selon un token de `object` (Q-ab) |
| `status` | `quantitative` pour signaler un seuil déclaré |

## Sémantique

- `not_stated` ≠ `none` ; les listes sont des appartenances ; l'absence de champ dans `where` = non contraint.
- Une règle apparie des `Norm{status: validated}` (ou `proposed` en ablation) ; le résultat est une arête
  `MATCHES_ITEM{rule_id, rule_version, run_id, evidence_ids}` par norme appariée.
- Projection vers les phrases : `evidence_only` (défaut) ou `whole_clause` (annexe).
- **Interdit** : toute référence à `LABELED`, `Category`, aux codes de catégories CLAUDETTE ou au mot
  « unfair » (test `tests/test_rule_isolation.py`).
