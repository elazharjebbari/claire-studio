# Registre des prompts

| id | version | fichier | hash SHA-256 | schéma | modèles testés | date | changements |
|---|---|---|---|---|---|---|---|
| clause_template_extraction | 0.1 | `clause_template_extraction.md` | `7cf08dc25490899f…` | `clause_template.schema.json` 0.1 (`aeb1d0a00322b918…`) ; inventaires `legal_kg_schema.yaml` 0.1 | Claude Opus 5 (inline, 3 passes), gpt-6-astra (Codex, 3 passes) | 2026-09-15 | pilote 100 clauses |
| clause_template_extraction | **0.2** | `clause_template_extraction.md` (texte inchangé, `7cf08dc25490899f…`) | idem | schéma JSON inchangé ; **inventaires `legal_kg_schema.yaml` 0.2** (+6 codes) ; **ancrage lexical v0.2** (`LEXICAL_TRIGGERS` : `specified_reason` += if/where/upon/in the event/suspect/fraud/security/legal/necessary ; `remedy=none` += no liability/not liable/without any refund) | Claude Opus 5 (inline) | 2026-09-15 | décision F0 option 1 ; répétition du pilote puis hold-out |
| clause_template_verifier | — | *(à écrire)* | — | — | — | — | vérificateur d'ancrage (autre famille de modèle) |
| unfairness_judge_baseline (B3) | — | *(à écrire — contient les définitions CLAUDETTE, donc JAMAIS utilisé pour l'extraction)* | — | — | — | — | baseline LLM prompté |

Règles : un prompt utilisé dans un run est copié intégralement dans `results/<kind>/<run_id>/prompt.md` ;
toute modification = nouvelle version + nouvelle ligne ; les prompts d'extraction sont soumis au test
d'étanchéité (`tests/test_rule_isolation.py`).
