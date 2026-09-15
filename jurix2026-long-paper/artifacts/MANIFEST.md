# Artefacts du papier 157 — copies figées

Copies exactes des fichiers de `legal-kg/` dont proviennent les chiffres du papier, figées le 15 septembre 2026
(13 h 35) pour que le dossier du papier soit autoportant. **Aucun texte de contrat CLAUDETTE** (licence tierce) :
seulement des identifiants, des comptes et des métriques. Les sources vivantes restent dans `legal-kg/` ; en cas
de régénération, recopier, mettre à jour ce manifeste, puis `make tables` et relire les chiffres du texte.

Protocole : requêtes et schéma v0.2 gelés le 15 sept. 2026 à 08:24 UTC (voir `rules/FROZEN.txt`) avant toute
extraction du hold-out ; extraction du hold-out en deux passes par `claude-opus-5` ; analyse principale pré-enregistrée = passe 0 (`holdout-v02-pass0`), passe 1 = contrôle de sensibilité (`*_pass1`). `DISAGREEMENT.*` est la version passe 0 citée dans Results C (la source a depuis été recalculée sur deux passes).

| Copie | Source dans le dépôt | Commit source | SHA-256 (16) | Usage dans le papier |
|---|---|---|---|---|
| `evaluation/E2.json` | `legal-kg/results/evaluation/holdout-v02-pass0/E2.json` | 0fb08e4 | `f45bda4863fd59e9` | Tables 4–5 (générées), Results A/B, résumé |
| `evaluation/E2.md` | `legal-kg/results/evaluation/holdout-v02-pass0/E2.md` | 0fb08e4 | `1d5b47cc1172d06b` | lecture humaine d'E2.json |
| `evaluation/STATS.json` | `legal-kg/results/evaluation/holdout-v02-pass0/STATS.json` | 0fb08e4 | `cb29608b0d971a71` | tests pré-enregistrés : Holm, non-infériorité, Wilson (Results A/B) |
| `evaluation/STATS.md` | `legal-kg/results/evaluation/holdout-v02-pass0/STATS.md` | 0fb08e4 | `e49ffc24a2cf5348` | lecture humaine de STATS.json |
| `evaluation/DISAGREEMENT.json` | `legal-kg/results/evaluation/holdout-v02-disagreement/DISAGREEMENT.json` | non suivi (copie du 15 sept. 13 h 35) | `0d45cb3ccc96a149` | Results C (manqués N1/N2, faux positifs, granularité) — version passe 0, copiée avant réécriture en passe 1 |
| `evaluation/DISAGREEMENT.md` | `legal-kg/results/evaluation/holdout-v02-disagreement/DISAGREEMENT.md` | non suivi (copie du 15 sept. 13 h 35) | `86b289e803d2d569` | lecture humaine de DISAGREEMENT.json |
| `extraction/holdout-v02-pass0_run.json` | `legal-kg/results/extraction/inline-opus5-holdout-v02-20260915/run.json` | 0fb08e4 | `f9ac581a82a911e0` | Materials : extraction du hold-out (1 087 fenêtres, 2 809 templates) |
| `extraction/pilot100-v02_run.json` | `legal-kg/results/extraction/inline-opus5-pilot100-v02-20260915/run.json` | ad6d278 | `0fb78a361baa793f` | Materials : conformité du pilote (98 %) |
| `extraction/pilot100-v02_STABILITY.json` | `legal-kg/results/extraction/inline-opus5-pilot100-v02-20260915/STABILITY.json` | ad6d278 | `958ccd27bce5acc0` | Materials : stabilité du pilote (Jaccard 0,81, κ 0,86) |
| `extraction/pilot100-v01_COMPARE_claude-opus-5_vs_gpt-6-astra.json` | `legal-kg/results/extraction/COMPARE_claude-opus-5_vs_gpt-6-astra.json` | 5aae029 | `b80fbc568a43f6f4` | Limitations : accord inter-extracteurs ≈ 0,6 |
| `rules/holdout-v02-pass0_SUMMARY.json` | `legal-kg/results/rules/holdout-v02-pass0/SUMMARY.json` | 0fb08e4 | `ecd1cb63c3049b0b` | appariements des requêtes gelées sur le hold-out |
| `rules/grey_list_queries.yaml` | `legal-kg/graph/rules/grey_list_queries.yaml` | 20abe05 | `c3303e6743c40a88` | requêtes gelées v0.2 (Section 3) |
| `rules/FROZEN.txt` | `legal-kg/graph/rules/FROZEN.txt` | 20abe05 | `dd43c554e6478d29` | empreintes et dates de gel (pré-inscription) |
| `ontology/directive_93_13.yaml` | `legal-kg/ontology/directive_93_13.yaml` | 06277ba | `e0507b99dc2f91bf` | Table 1 : items, catégories, expressibilité |
| `ontology/legal_kg_schema.yaml` | `legal-kg/ontology/legal_kg_schema.yaml` | 20abe05 | `3682acf620cdd8c6` | vocabulaires des templates et inventaires d'actions v0.2 |
| `llm/clause_template_extraction.md` | `legal-kg/llm/prompts/clause_template_extraction.md` | 06277ba | `7cf08dc25490899f` | prompt d'extraction versionné |
| `llm/clause_template.schema.json` | `legal-kg/llm/schemas/clause_template.schema.json` | 06277ba | `aeb1d0a00322b918` | schéma de sortie des templates |
| `baselines/B2_legal-bert_holdout_results.json` | `legal-kg/results/baselines/B2_lab_bb37a8ce/results.json` | 09b59d1 | `ad8b7646a11281f4` | configuration et résultats de Legal-BERT (Table 5) |
| `extraction/holdout-v02_STABILITY_passes01.json` | `legal-kg/results/extraction/inline-opus5-holdout-v02-20260915/STABILITY.json` | e39294b | `80addffd154a7ffa` | Materials : stabilité hold-out entre les passes 0 et 1 (Jaccard 0,77, κ 0,82) |
| `evaluation/E2_pass1.json` | `legal-kg/results/evaluation/holdout-v02-pass1/E2.json` | e39294b | `1711b3930d7e2f8e` | sensibilité : union F1 0,34 [0,28 ; 0,41] en passe 1 (Results B) |
| `evaluation/E2_pass1.md` | `legal-kg/results/evaluation/holdout-v02-pass1/E2.md` | e39294b | `f3388d61373df831` | lecture humaine d'E2_pass1.json |
| `evaluation/STATS_pass1.json` | `legal-kg/results/evaluation/holdout-v02-pass1/STATS.json` | e39294b | `257b83ed5aa48072` | sensibilité : item (i) +0,14, p Holm 0,15 ; autres verdicts inchangés (Results A) |
| `evaluation/STATS_pass1.md` | `legal-kg/results/evaluation/holdout-v02-pass1/STATS.md` | e39294b | `d4749b1c8583d7ba` | lecture humaine de STATS_pass1.json |
