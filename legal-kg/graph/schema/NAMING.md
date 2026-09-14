# Conventions de nommage et de versionnement (Memgraph)

- **Étiquettes** : PascalCase, singulier (`Sentence`, `AnnexItem`). **Relations** : UPPER_SNAKE, verbe ou
  nom de relation (`CONTAINS`, `MATCHES_ITEM`). **Propriétés** : snake_case.
- **Identifiants** : `<label>:<document>:<local>` — `document:9gag`, `sentence:9gag:12`,
  `clause:9gag:consensus:0003`, `annotation:9gag:12:zahra.boulaich`, `gold:9gag:12`, `norm:9gag:c0003:n1`,
  `run:<uuid>`. `Theme.key = code@taxonomy` ; `Rule.key = id@version`.
- **Sources** : `human` (annotateur nommé dans `annotator`), `llm` (juge nommé), `consensus`, `gold`,
  `claudette`, `rule`, `model`.
- **Versionnement** : les résultats (`MATCHES_ITEM`, `PREDICTED`, `SIMILAR_TO`) sont append-only, portés par
  `run_id` ; une réexécution ajoute et pose `superseded_by` sur l'ancienne arête ; les règles sont
  identifiées par `(id, version)` + `rules_hash`.
- **Provenance** : tout nœud/arête dérivé → `PRODUCED_BY(Run)` ; toute intervention humaine → `Activity`.
- **Interdits** : stocker `IMPOSES`/`GRANTS`/`PROHIBITS`/`ALLOWS` (vues) ; supprimer un résultat ; lire
  `LABELED` dans une règle.
