# data/processed/ — export Lab `7116e627f528c557…`

Contenu attendu (non versionné pour les `.jsonl`) : `sentences.jsonl` (texte + consensus), `reference.jsonl`
(labels CLAUDETTE), `votes.jsonl`, `judges.jsonl`, `gold.jsonl`, `labels.json`, `manifest.json`, `splits.json`.

Reconstitution :
1. `votes.jsonl`, `judges.jsonl`, `gold.jsonl`, `labels.json`, `manifest.json`, `splits.json` : copier depuis
   `../../data/thematic-layer/` (données publiées avec le short paper, même empreinte).
2. `sentences.jsonl` et `reference.jsonl` (textes et labels CLAUDETTE, licence tierce) : export du dataset
   `7116e627…` depuis le Lab Pactiva (`/lab/datasets`, critères `submitted` + `consensus`), ou reconstruction
   depuis `../../data/claudette_tos/` (documents originaux tagués) avec l'alignement phrase du Lab.

Le profil (`src/profiling/profile_dataset.py`) et le build (`src/graph/build_document_graph.py`) vérifient
l'empreinte du manifeste avant de tourner.
