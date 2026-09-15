# graph — construction et ingestion du graphe

| Script | Couches | Sortie | Cypher |
|---|---|---|---|
| `build_document_graph.py` | L1 (documents, phrases, clauses, sections), L2 (thèmes, votes, juges, gold), L4-référence (labels + sévérité, isolée) | `graph/export/<fp8>/<run>/*.csv` | `01_ingest.cypher` |
| `import_claudette_original.py` | sévérité et sections depuis les XML originaux | `data/annotations/{severity,sections}.jsonl` | — |
| `load_memgraph.py` | charge schéma + L1/L2/L4 + L3/L5 dans une instance Memgraph (Bolt), exécute `04_rules_compiled.cypher` et compare aux appariements de l'évaluateur Python | `results/parity/<run>/PARITY.{md,json}` | tous |
| `ingest_norms.py` | **L3** (normes validées, acteur, evidence, relations, validation humaine) et **L5** (appariements `MATCHES_ITEM` de `detection/run_rules.py`) | `graph/export/norms/<run>/*.csv` + `INGEST.json` | `05_ingest_norms.cypher` |

```bash
cd legal-kg/src
../.venv/bin/python -m graph.ingest_norms --clauses ../data/annotations/pilot_100/clauses.jsonl \
    --extraction ../results/extraction/<run>/validated.jsonl --select validated --source llm:<modèle> \
    --matches ../results/rules/<run>/matches.jsonl
```

Une seule ligne d'extraction par clause est ingérée (`--select validated`, ou `repeat:N` pour une ablation « proposé »).
Les identifiants suivent `graph/schema/NAMING.md`. Aucun de ces scripts n'est lu par les règles ; la couche L4 de
référence n'est jamais lue par L3/L5. Chargement réel exécuté le 15 sept. 2026 (parité OUI, voir `results/parity/`). Procédure sur ce poste (macOS Intel,
Docker via Colima ; client docker statique dans `~/.local/bin`) :

```bash
colima start --vm-type=vz --cpu 2 --memory 4 --disk 20        # une fois par session
mkdir -p graph/export/memgraph_import/norms
cp graph/export/<fp8>/<run>/*.csv graph/export/memgraph_import/
cp graph/export/norms/<run>/*.csv graph/export/memgraph_import/norms/      # un seul volume : pas de montage imbriqué sous un /import en lecture seule
docker run -d --name memgraph -p 7687:7687 -v "$PWD/graph/export/memgraph_import:/import:ro" memgraph/memgraph:latest --log-level=WARNING --memory-limit=2500
.venv/bin/python src/graph/load_memgraph.py --norms graph/export/norms/<run> --status proposed --population design --reset
```

Les index d'identifiants de `memgraph_schema.cypher` sont indispensables : sans eux, les `LOAD CSV` à 90 000 lignes balaient
l'étiquette à chaque `MATCH {id}` (> 10 min observées, contre 2,4 s avec index).
