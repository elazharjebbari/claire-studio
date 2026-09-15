#!/usr/bin/env bash
# Chaîne E2 sur le hold-out (une seule exécution par passe, règles gelées v0.2). Usage : scripts/run_holdout_e2.sh <repeat> [n_repeats_present]
set -euo pipefail
cd "$(dirname "$0")/.."
R="${1:-0}"; NREP="${2:-1}"
RUN=results/extraction/inline-opus5-holdout-v02-20260915
PY=.venv/bin/python
echo "== replay (passes présentes : $NREP)"
( cd src/extraction && ../../$PY inline_backend.py replay --clauses ../../data/annotations/holdout/clauses.jsonl --run-dir ../../$RUN --repeat "$NREP" --model claude-opus-5 --run-id holdout-inline-opus5-v02 --agents-note "sous-agents Claude Code general-purpose (model=opus -> claude-opus-5), contexte vierge ; schéma 0.2 + ancrage v0.2 ; collecte collect_inline_responses.py ou écriture directe" )
echo "== ingestion L3 (passe $R) → CSV"
( cd src && ../$PY -m graph.ingest_norms --clauses ../data/annotations/holdout/clauses.jsonl --extraction ../$RUN/step_5_corrected.jsonl --select "repeat:$R" --source llm:inline-opus5-v02 --run-id holdout-v02-pass$R --out ../graph/export/norms/holdout-v02-pass$R )
echo "== règles gelées v0.2 (population holdout, refus si non gelées)"
( cd src && ../$PY -m detection.run_rules --clauses ../data/annotations/holdout/clauses.jsonl --extraction ../$RUN/step_5_corrected.jsonl --population holdout --statuses proposed --repeat "$R" --out ../results/rules/holdout-v02-pass$R )
echo "== E2"
$PY src/evaluation/evaluate_matches.py --matches results/rules/holdout-v02-pass$R/matches.jsonl --population holdout --universe population \
  --norms-csv graph/export/norms/holdout-v02-pass$R/norms.csv \
  --predictions B2=results/baselines/B2_lab_bb37a8ce/predictions.jsonl --predictions B1=results/baselines/B1_lab_2c554b8b/predictions.jsonl \
  --n-boot 1000 --out results/evaluation/holdout-v02-pass$R
echo "== tests pré-enregistrés"
( cd src/evaluation && ../../$PY run_stats.py --eval-dir ../../results/evaluation/holdout-v02-pass$R --n-perm 10000 --n-boot 1000 )
echo "== tableaux"
$PY src/reporting/make_tables.py --table queries --e2 results/evaluation/holdout-v02-pass$R/E2.json --out results/evaluation/holdout-v02-pass$R/tables/T3_queries.tex >/dev/null
cat > /tmp/baselines_holdout.json <<'JSON'
{"B0$'$ theme only": {"precision": 0.286, "recall": 0.618, "f1": 0.391, "f1_ci95": {"low": 0.344, "high": 0.441}, "auc_pr": 0.233},
 "B1 TF-IDF + LR": {"precision": 0.441, "recall": 0.716, "f1": 0.546, "f1_ci95": {"low": 0.512, "high": 0.581}, "auc_pr": 0.504},
 "B2 Legal-BERT (fine-tuned)": {"precision": 0.643, "recall": 0.770, "f1": 0.701, "f1_ci95": {"low": 0.650, "high": 0.749}, "auc_pr": 0.775}}
JSON
$PY src/reporting/make_tables.py --table cost --e2 results/evaluation/holdout-v02-pass$R/E2.json --baselines-json /tmp/baselines_holdout.json --out results/evaluation/holdout-v02-pass$R/tables/T4_cost.tex >/dev/null
echo "== fait : results/evaluation/holdout-v02-pass$R/{E2.md,STATS.md,tables/}"
