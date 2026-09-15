# extraction

Construction de la couche L3 (templates normatifs) à partir des clauses. Protocole : `docs/LLM_EXTRACTION.md`.
Contrats d'entrée/sortie : `docs/AGENTS.md` § Interfaces. Enregistrement des runs : `docs/REPRODUCIBILITY.md`.

| Script | Rôle |
|---|---|
| `build_clause_set.py` | jeux de clauses ≤ 8 phrases (`data/annotations/`) : pilote 100 (conception), hold-out 1 087 |
| `extract_templates.py` | backend **API** : `messages.parse` Pydantic, étapes 1–5 (schéma, structure, sémantique, ancrage, correction), `run.json` ; `--dry-run` sans appel |
| `inline_backend.py` | backend **sous-agents Claude Code** (sans clé API) : `export` rend les lots depuis le prompt versionné, `replay` fait passer les réponses par les MÊMES étapes 2–5 et écrit le même format |

## Backend inline — règles d'usage

1. **Jamais dans la conversation principale** : elle a les règles gelées en contexte ; une extraction faite en les
   connaissant biaiserait les champs vers ce qui les déclenche. Uniquement des sous-agents **neufs** (pas de *fork*),
   qui ne lisent que leur fichier de lot.
2. Les lots (`results/extraction/<run>/batches/`) contiennent des textes CLAUDETTE : ignorés par git.
3. `replay` refuse de rejouer si le prompt a changé depuis l'export (hash dans `MANIFEST.json`).
4. `run.json` porte `backend: inline_subagent` et `protocol_deviations` (pas de température 0, pas de décodage
   contraint, clauses par lots, prompt système de Claude Code en surcouche, pas de décompte de tokens). Ce backend
   sert le pilote de conception et le démarrage de la validation juriste ; il ne tient pas lieu de la sélection de
   modèle (LLM_EXTRACTION §5) ni de l'extraction du hold-out destinée à la publication sans déclaration explicite.

```bash
.venv/bin/python src/extraction/inline_backend.py export --clauses data/annotations/pilot_100/clauses.jsonl \
    --out results/extraction/<run> --batch-size 25
# un sous-agent neuf par lot et par répétition → responses/r<repeat>_batch_XX.jsonl
.venv/bin/python src/extraction/inline_backend.py replay --clauses data/annotations/pilot_100/clauses.jsonl \
    --run-dir results/extraction/<run> --repeat 3
```
