# detection

## Moteur de règles (`rules/`) — ADR-003

| Fichier | Rôle |
|---|---|
| `rules/loader.py` | charge `graph/rules/grey_list_queries.yaml`, lint d'étanchéité (aucun `LABELED`/`Category`/catégorie CLAUDETTE), vocabulaire fermé des champs, **vérification du gel** : sur `population=holdout`, un fichier dont le SHA-256 n'est pas dans `graph/rules/FROZEN.txt` est refusé (`RulesError`). |
| `rules/model.py` | `NormRecord` / `ClauseRecord` et `norms_from_extraction()` (sorties `step_5_corrected.jsonl` → normes avec evidence en indices absolus). |
| `rules/evaluate.py` | **sémantique de référence** en Python pur : conjonction, listes = appartenance, `any`, `has_norm` (règle de clause, une fois par clause), `unless` (`related`, `exists_in_document`, `has_norm`, `object_contains`), seuils déclarés (valeur absente = pas de déclenchement), `item_selector`, filtre de statut (`validated` par défaut ; `proposed` = ablation), projection `evidence_only` / `whole_clause`. |
| `rules/compile_cypher.py` | même sémantique compilée en Cypher Memgraph paramétré (`$run_id`, `$status`) → `graph/cypher/04_rules_compiled.cypher` ; le Cypher généré est relinté. |
| `run_rules.py` | E2 sans Memgraph : clauses + extraction → `matches.jsonl`, `sentence_items.jsonl`, `SUMMARY.json` (hash et statut de gel des règles inclus). Ne lit jamais la référence d'abusivité. |

```bash
cd legal-kg/src
../.venv/bin/python -m detection.rules.compile_cypher            # régénère 04_rules_compiled.cypher
../.venv/bin/python -m detection.run_rules --clauses ../data/annotations/pilot_100/clauses.jsonl \
    --extraction ../results/extraction/<run>/step_5_corrected.jsonl --population design --statuses proposed
```

Tests : `tests/test_rules_engine.py` (cas dorés par règle, gel, étanchéité du YAML et du Cypher) et
`tests/test_rule_isolation.py`. Les cas dorés sont la spécification exécutable : toute évolution du YAML
(nouvelle version + nouvelle empreinte) doit ajouter ses cas.

## Baselines texte-seul (`baselines_unfairness.py`)
B0 majorité, B0' thème-seul, B1 TF-IDF+LR (seuils hors-pli, bootstrap document). Voir `results/baselines/README.md`.
B2 Legal-BERT (cible `unfair`) : via le runner Pactiva Lab (tâche `U1_unfair`), voir docs/EXPERIMENTAL_PROTOCOL.md.
