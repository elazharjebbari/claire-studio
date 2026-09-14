# Registre des prompts

| id | version | fichier | hash SHA-256 | schéma | modèles testés | date | changements |
|---|---|---|---|---|---|---|---|
| clause_template_extraction | 0.1 | `clause_template_extraction.md` | *(à calculer au gel : `shasum -a 256`)* | `clause_template.schema.json` 0.1 | — (pilote à venir) | 2026-09-15 | version initiale |
| clause_template_verifier | — | *(à écrire)* | — | — | — | — | vérificateur d'ancrage (autre famille de modèle) |
| unfairness_judge_baseline (B3) | — | *(à écrire — contient les définitions CLAUDETTE, donc JAMAIS utilisé pour l'extraction)* | — | — | — | — | baseline LLM prompté |

Règles : un prompt utilisé dans un run est copié intégralement dans `results/<kind>/<run_id>/prompt.md` ;
toute modification = nouvelle version + nouvelle ligne ; les prompts d'extraction sont soumis au test
d'étanchéité (`tests/test_rule_isolation.py`).
