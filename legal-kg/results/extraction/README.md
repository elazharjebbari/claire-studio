# results/extraction

Runs d'extraction de templates (couche L3). Seuls `run.json`, `MANIFEST.json` et `STABILITY.json` sont versionnés :
les lots, les réponses et les `step_*.jsonl` contiennent des textes CLAUDETTE (licence tierce) et restent locaux.

| Run | Backend | Population | Contenu | Résultat |
|---|---|---|---|---|
| `dry-run/` | stub | pilote 100 | pipeline sans appel (0 norme) | validation du format |
| `inline-opus5-pilot100-20260915/` | `inline_subagent` (12 sous-agents Claude Opus 5 à contexte vierge, lots de 25, 3 passes) | pilote 100 (conception) | `pass0/` (passe 0 seule), racine = 3 passes, `validation/` (feuille juriste, passe 0), `STABILITY.json` | 300/300 conformes, 608 normes, κ Fleiss 0,77 sur les phrases signalées par les règles gelées ; diagnostic conception P 0,67 / R 0,47 |

Règles appliquées à ces normes (`proposed`, population `design`) : `results/rules/pilot100-inline-opus5-pass0/SUMMARY.json`.
Export L3/L5 correspondant (non versionné) : `graph/export/l3-pilot100-inline-opus5-pass0/`.

Lecture des écarts : `run.json.protocol_deviations`. Le backend inline sert le pilote et le démarrage de la validation
juriste ; la sélection de modèle (LLM_EXTRACTION §5) et l'extraction du hold-out exigent le backend API ou une
déclaration explicite de l'écart dans la publication.
