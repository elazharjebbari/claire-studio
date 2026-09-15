# evaluation — E2, tests pré-enregistrés, audit expert, analyses

| Script | Étape (`docs/pactiva-grey-list-157/01_…`) | Entrées | Sorties |
|---|---|---|---|
| `evaluate_matches.py` | **F7** | `matches.jsonl` (run_rules), `reference.jsonl`, `clauses_all.jsonl`, `directive_93_13.yaml`, `norms.csv` (couverture), `name=predictions.jsonl` (B1/B2) | `E2.json`, `E2.md`, `sentences_eval.jsonl` : par item mappé P/R/F1 [IC document], Δ F1 vs thème seul (LODO sur la conception, seuil hors échantillon), couverture ; items sans catégorie → audit ; binaire règles ∪ vs B1/B2 + recouvrement |
| `run_stats.py` (+ `stats.py`) | **F8** | `sentences_eval.jsonl` | `STATS.json/.md` : permutation appariée par document (10 000), Holm sur les items, non-infériorité δ = 0,05 vs texte seul, Wilson |
| `audit_sheet.py export` / `merge` | **F9–F10** | `matches.jsonl`, `norms.csv`, clauses (texte local) ; puis 2 CSV remplis + clé | feuilles aveugles A/B (CSV + MD, **locales : texte CLAUDETTE**) + `audit_key.csv` ; `AUDIT.json` : taux par verdict et par cause (Wilson), part « référence absente » (RQ6), suffisance (RQ3), κ inter-experts |
| `analyse_lab_predictions.py` | fait | prédictions Lab B1/B2 | `ANALYSIS.md/json` (rappel par catégorie, thème, erreurs confiantes, recouvrement) |
| `extraction_stability.py`, `compare_extractors.py` | fait (autre session) | runs d'extraction | `STABILITY.json`, `COMPARE_*.json` |
| `../reporting/make_tables.py` | valorisation | `E2.json`, JSON des baselines, `AUDIT.json` | `T3_queries.tex`, `T4_cost.tex`, `T6_audit.tex` |

Commandes (hold-out, une seule fois, règles gelées) :

```bash
cd legal-kg
.venv/bin/python src/detection/run_rules.py --clauses data/annotations/holdout/clauses.jsonl --extraction results/extraction/<holdout-run>/step_5_validated.jsonl --population holdout --statuses validated
.venv/bin/python src/evaluation/evaluate_matches.py --matches results/rules/<run>/matches.jsonl --population holdout --universe population \
    --norms-csv graph/export/norms/<run>/norms.csv --predictions B2=results/baselines/B2_lab_bb37a8ce/predictions.jsonl --predictions B1=results/baselines/B1_lab_2c554b8b/predictions.jsonl
(cd src/evaluation && ../../.venv/bin/python run_stats.py --eval-dir ../../results/evaluation/holdout-<run>)
.venv/bin/python src/evaluation/audit_sheet.py export --matches results/rules/<run>/matches.jsonl --norms-csv graph/export/norms/<run>/norms.csv --clauses data/annotations/holdout/clauses.jsonl --out results/audit/holdout-<run>
.venv/bin/python src/reporting/make_tables.py --table queries --e2 results/evaluation/holdout-<run>/E2.json --out ../jurix2026-long-paper/tables/T3_queries.tex
```

Validé à blanc sur le pilote (population `design`, univers `extracted`, 287 phrases, 52 abusives) : `results/evaluation/design-pilot100-validated-porteur/`
— chiffres de **conception**, non publiables ; ils servent à vérifier la chaîne. Règles du protocole encodées : IC par document,
items à moins de 30 étiquettes marqués non concluants, items sans catégorie CLAUDETTE exclus des agrégats et envoyés à l'audit.
