# graph — construction et ingestion du graphe

| Script | Couches | Sortie | Cypher |
|---|---|---|---|
| `build_document_graph.py` | L1 (documents, phrases, clauses, sections), L2 (thèmes, votes, juges, gold), L4-référence (labels + sévérité, isolée) | `graph/export/<fp8>/<run>/*.csv` | `01_ingest.cypher` |
| `import_claudette_original.py` | sévérité et sections depuis les XML originaux | `data/annotations/{severity,sections}.jsonl` | — |
| `ingest_norms.py` | **L3** (normes validées, acteur, evidence, relations, validation humaine) et **L5** (appariements `MATCHES_ITEM` de `detection/run_rules.py`) | `graph/export/norms/<run>/*.csv` + `INGEST.json` | `05_ingest_norms.cypher` |

```bash
cd legal-kg/src
../.venv/bin/python -m graph.ingest_norms --clauses ../data/annotations/pilot_100/clauses.jsonl \
    --extraction ../results/extraction/<run>/validated.jsonl --select validated --source llm:<modèle> \
    --matches ../results/rules/<run>/matches.jsonl
```

Une seule ligne d'extraction par clause est ingérée (`--select validated`, ou `repeat:N` pour une ablation « proposé »).
Les identifiants suivent `graph/schema/NAMING.md`. Aucun de ces scripts n'est lu par les règles ; la couche L4 de
référence n'est jamais lue par L3/L5. Le chargement Memgraph (docker, volume `/import`) n'a pas encore été exécuté sur
une instance : les CSV et le Cypher sont testés structurellement (`tests/test_ingest_norms.py`).
