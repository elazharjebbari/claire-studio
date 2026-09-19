# 03 — Architecture cible

> Diagrammes : `03a_composants.puml` (composants), `03b_sequence-classification.puml` (séquence). Contrat d'API : `03c_api-contrat.yaml`.

## 1. Vue d'ensemble

```
navigateur (page /, anglais, thème clair)
   │  GET  /downloads/*.{zip,jsonl,json,md}      ← fichiers statiques Next (frontend/public/downloads/)
   │  GET  /api/v1/public/demo/manifest           ← chiffres clés, carte du modèle, liste des téléchargements
   │  GET  /api/v1/public/demo/contracts           ← 17 contrats hold-out (nom, nb phrases)
   │  GET  /api/v1/public/demo/contracts/{doc}     ← phrases + gold + votes A1–A3 + juges (+ labels CLAUDETTE)
   │  POST /api/v1/public/demo/classify            ← {source: text|contract, text?|document?} → 202 {job}
   │  GET  /api/v1/public/demo/jobs/{id}           ← {status, result}
   ▼
Django (daphne :8017) — app `claire/demo/`
   ├── views.py        AllowAny · authentication_classes=[] · ScopedRateThrottle(scope="demo")
   ├── services.py     lecture du jeu figé (var/lab/datasets/<id>/), pseudonymes, garde-fous d'entrée
   ├── runner.py       fil d'exécution daemon → sous-processus `research/.venv python -m pactiva_lab predict`
   ├── models.py       DemoJob (id, status, source, document, n_sentences, result, error, timings, client_hash)
   └── management/commands/demo_selfcheck.py   charge le modèle, classe 3 phrases, vérifie le contrat
research/.venv — package pactiva_lab
   ├── inference.py    segment() [pysbd] · predict_sentences() · predict_text() · run_cli()
   └── models/heavy.py TransformerFinetune.save() / .load()
var/models/legalbert_T11_holdout/   poids + tokenizer + classes.json + model_config.json (preprocess, split, empreinte)
var/lab/datasets/0a2542a1-…/        jeu figé 7116e627… (sentences.jsonl avec texte, votes, gold, judges, reference)
```

## 2. Données servies

| Source | Utilisation | Transformation |
|---|---|---|
| `sentences.jsonl` (jeu figé) | texte détokenisé des 17 contrats hold-out, thème primaire/secondaires consensus, `agreement`, `unfair` | filtré à `taxonomies.json.populations.holdout` ; texte servi à l'écran seulement |
| `votes.jsonl` | trois votes par phrase | `annotator` → pseudonyme A1/A2/A3 (ordre alphabétique des identifiants, stable) |
| `gold.jsonl` | classe d'accord, palier, proposition, décision, tally, confiance | tel quel |
| `judges.jsonl` | thème par juge | identifiant de juge conservé (`claude`, `codex`, `mistral`, `fable`) avec le libellé du modèle réellement servi (depuis `prompts/README.md`) |
| `reference.jsonl` | catégories CLAUDETTE par phrase | tel quel (affichage « unfair (CH) » comme dans l'atelier) |
| `taxonomies.json` | libellés, couleurs, projections T20→T11, populations | dictionnaire anglais ajouté côté frontend (`labels.en.ts`) |
| `research/runs/demo_legalbert_T11_holdout/results/results.json` | métriques hold-out du modèle servi | copiées dans `RELEASE.json` par le script de génération |

## 3. Le job de classification

1. `POST classify` valide : source, taille (≤ 60 000 caractères), langue (≥ 5 % de mots-outils anglais), quota. Pour `contract`, le texte vient du jeu figé (17 documents autorisés).
2. Création d'un `DemoJob` (`queued`), **sans le texte** ; le texte est écrit dans un fichier temporaire du job (`var/demo/jobs/<id>/in.json`, permissions 600).
3. Un fil daemon (verrou de processus : un job à la fois, file FIFO, 3 en attente au plus) lance `research/.venv/bin/python -m pactiva_lab predict --model <DEMO_MODEL_DIR> --input in.json --out out.json` avec `OMP_NUM_THREADS=3`, délai 120 s.
4. À la fin : `result` (phrases, libellé, confiance, top-5, segmenteur, durée) stocké dans le job ; `in.json` supprimé ; pour `contract`, le résultat est enrichi côté lecture par gold/votes/juges et un résumé (exactitude, κ de Cohen modèle↔gold sur le document).
5. `GET jobs/{id}` retourne `queued | running | done | failed` ; les jobs sont purgés après 24 h (commande `demo_purge`, appelée par le fil au démarrage et toutes les heures).

Coût attendu sur le VPS : chargement ~5 s, ~40 ms par phrase (4 vCPU, séquence 128, contexte ±1), soit ~15 s pour un contrat de 200 phrases. Mémoire de pointe ~1,3 Go, libérée à la fin du sous-processus.

## 4. Sécurité

- `permission_classes=[AllowAny]`, `authentication_classes=[]`, `throttle_scope="demo"` : `DEFAULT_THROTTLE_RATES["demo"] = "30/hour"` et `"demo_burst" = "6/min"` (surchargeables par variables d'environnement).
- Limites : 60 000 caractères, 400 phrases (les suivantes sont ignorées et signalées), un fichier `.txt` ≤ 200 ko lu côté navigateur.
- Le texte collé n'est ni en base ni dans les journaux ; `client_hash` = HMAC de l'adresse tronquée, pour le quota et le débogage seulement.
- Option `DEMO_ACCESS_CODE` (vide = ouvert) : si renseigné, l'en-tête `X-Demo-Code` est exigé sur `classify`.
- En-têtes de sécurité existants conservés ; `X-Frame-Options: DENY` inchangé.

## 5. Frontend

- `frontend/src/app/page.tsx` : composant serveur, `theme-light`, lit `RELEASE.json` au build pour les cartes et chiffres ; monte les composants clients de `features/demo/`.
- `features/demo/` : `DemoPanel` (onglets Paste / Upload / CLAUDETTE contract, garde-fous, bouton à machine d'états), `useDemoJob` (sondage adaptatif 1 s → 3 s, arrêt à 3 min), `ResultsViewer` (volet lecture + rail latéral), `SentenceRow`, `ClauseBoundary`, `ThemeToc`, `ComparisonColumns` (gold, A1–A3, juges), `Summary`, `DownloadsGrid`, `KeyFigures`, `Codebook`.
- `lib/api/demo.ts` : appels `apiFetch` sans jeton ; `lib/taxonomy/labels.en.ts` : libellés anglais T20/T11.
- Ancienne page déplacée sur `/presentation` ; `e2e/welcome.spec.ts` adapté ; `/` ajoutée à `e2e/a11y.spec.ts` ; nouveaux fichiers ajoutés à `GUARDED` dans `scripts/check-no-hex.mjs`.

## 6. Génération des artefacts publiés

`scripts/build_thematic_layer_release.py` :
1. lit `data/thematic-layer/`, pseudonymise `votes.jsonl` (et réécrit le fichier versionné) ;
2. écrit `frontend/public/downloads/thematic-layer-7116e627/` (fichiers) et `thematic-layer-7116e627.zip` ;
3. écrit `RELEASE.json` : empreinte, tailles, SHA-256, chiffres clés (lus dans `manifest.json`, `research/runs/legalbert_T11/results.json`, `research/runs/demo_legalbert_T11_holdout/results/results.json`, `docs/pactiva-taxonomies/resultats/taxonomy_matrix.json`), carte du modèle ;
4. refuse d'écrire si un identifiant réel d'annotateur subsiste (liste lue depuis `manifest.json` avant pseudonymisation) ou si un champ `text` apparaît dans un fichier publié.

## 7. Déploiement

- Poids : `rsync` de `research/runs/demo_legalbert_T11_holdout/results/model/fold_0/` vers `/var/www/claire-studio/var/models/legalbert_T11_holdout/` (propriétaire `www-data`).
- Réglages : `DEMO_MODEL_DIR`, `DEMO_DATASET_ID`, `DEMO_THROTTLE_RATE`, `DEMO_ACCESS_CODE` dans `backend/.env` ; `pysbd` ajouté aux extras `transformers` de `research/pyproject.toml` (installé par le déploiement).
- Migration additive `demo/0001` → `deploy-claire.sh --allow-migrations`.
- Contrôle après déploiement : `manage.py demo_selfcheck` puis parcours reviewer complet sur `https://pactiva.legal`.
