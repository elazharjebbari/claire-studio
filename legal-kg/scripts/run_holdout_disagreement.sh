#!/usr/bin/env bash
# Désaccords règles ↔ référence + stabilité inter-passes sur le hold-out. Usage : scripts/run_holdout_disagreement.sh <n_repeats>
set -euo pipefail
cd "$(dirname "$0")/.."
N="${1:-2}"; RUN=results/extraction/inline-opus5-holdout-v02-20260915; PY=.venv/bin/python
ARGS=()
for r in $(seq 0 $((N-1))); do
  [ -f results/rules/holdout-v02-pass$r/matches.jsonl ] || ( cd src && ../$PY -m detection.run_rules --clauses ../data/annotations/holdout/clauses.jsonl --extraction ../$RUN/step_5_corrected.jsonl --population holdout --statuses proposed --repeat $r --out ../results/rules/holdout-v02-pass$r >/dev/null )
  ARGS+=(--matches results/rules/holdout-v02-pass$r/matches.jsonl)
done
$PY src/evaluation/disagreement_analysis.py "${ARGS[@]}" --extraction $RUN/step_5_corrected.jsonl --repeat 0 --population holdout --universe population --out results/evaluation/holdout-v02-disagreement
$PY src/evaluation/extraction_stability.py --clauses data/annotations/holdout/clauses.jsonl --extraction $RUN/step_5_corrected.jsonl --statuses proposed --out $RUN/STABILITY.json >/dev/null && echo "STABILITY.json écrit (sans diagnostic de référence : hold-out)"
