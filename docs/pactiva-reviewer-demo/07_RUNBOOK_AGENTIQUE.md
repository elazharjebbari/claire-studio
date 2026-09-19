# 07 — Runbook agentique (exécution du plan)

> Pour une session agentique qui exécute les lots de `06_PLAN_ACTION.md`. Commandes exactes, portes, pièges, interdits. Boucle par lot : lire le plan → implémenter en petits commits → tests du lot → suites complètes → auto-revue adversariale du `git diff` → commit.

## 0. Conventions du dépôt (vérifiées)

| Quoi | Commande |
|---|---|
| Tests backend | `cd backend && DJANGO_SECRET_KEY=x .venv/bin/python -m pytest -q` |
| Tests recherche | `cd research && HF_HUB_OFFLINE=1 .venv/bin/python -m pytest -q` (venv distinct) |
| Tests frontend | `cd frontend && npx vitest run` |
| Types / lint / couleurs | `cd frontend && npx tsc --noEmit && npm run lint && npm run check:colors` |
| e2e accessibilité | `cd frontend && npx playwright test e2e/a11y.spec.ts` |
| Build prod | `cd frontend && npm run build` |
| Déploiement | `DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh --allow-migrations` (racine, worktree propre, branche `main`) |
| VPS | `ssh -i ~/.ssh/corolle_deploy root@46.202.128.168` ; app dans `/var/www/claire-studio` ; Django : `cd backend && DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py …` |

## 1. L1 — modèle servi (local)

```bash
cd research
export OMP_NUM_THREADS=8 MKL_NUM_THREADS=8 TOKENIZERS_PARALLELISM=false
nohup .venv/bin/python -m pactiva_lab run \
  --config runs/demo_legalbert_T11_holdout/config.json \
  --data ../var/lab/datasets/0a2542a1-c5b0-4ef8-95e0-15abea0566db \
  --out runs/demo_legalbert_T11_holdout/results \
  --progress runs/demo_legalbert_T11_holdout/progress.json > runs/demo_legalbert_T11_holdout/run.log 2>&1 &
# suivi : tail -2 runs/demo_legalbert_T11_holdout/run.log ; fin = results/_SENTINEL
# contrôle :
.venv/bin/python -c "import json;r=json.load(open('runs/demo_legalbert_T11_holdout/results/results.json'));print(r['split'],r['metrics']['macro_f1'],r['metrics'].get('kappa'))"
echo '{"text":"We may terminate your account at any time. Fees are non refundable."}' > /tmp/in.json
.venv/bin/python -m pactiva_lab predict --model runs/demo_legalbert_T11_holdout/results/model/fold_0 --input /tmp/in.json --out /tmp/out.json && cat /tmp/out.json | head -c 600
```
Porte : `split.n_test_documents == 17`, `n_train_documents == 33`, macro-F1 T11 dans [0,65 ; 0,80] (le papier donne 0,735 en validation croisée à 5 plis).

## 2. L2 — publication des données

```bash
python3 scripts/build_thematic_layer_release.py            # pseudonymise, génère downloads/ + RELEASE.json
python3 scripts/build_thematic_layer_release.py --check    # vérifie sans écrire (CI)
git add data/thematic-layer frontend/public/downloads scripts/build_thematic_layer_release.py
```
Porte : la commande `--check` sort 0 ; `grep -c "elazhar\|ouali\|boulaich" frontend/public/downloads -r` retourne 0.

## 3. L3 — API publique

- Créer `backend/claire/demo/` (apps, models, services, runner, views, urls, management/commands, migrations, tests).
- Enregistrer l'app dans `INSTALLED_APPS`, les routes dans `config/api_urls.py` sous `public/demo/`.
- Réglages `base.py` : `DEMO_MODEL_DIR`, `DEMO_DATASET_ID`, `DEMO_ACCESS_CODE`, `DEMO_MAX_CHARS=60000`, `DEMO_MAX_SENTENCES=400`, `DEMO_QUEUE_MAX=3`, `DEMO_JOB_TIMEOUT=120`, scopes `demo` / `demo_burst`.
- Tests : `cd backend && DJANGO_SECRET_KEY=x .venv/bin/python -m pytest -q tests/test_demo_api.py` ; le runner est testé avec un `predict` simulé (`DEMO_PREDICT_COMMAND` pointant sur un script Python qui écrit un `out.json`).
- Contrôle local : `manage.py demo_selfcheck --model ../research/runs/demo_legalbert_T11_holdout/results/model/fold_0`.

## 4. L4 — page

- Déplacer `frontend/src/app/page.tsx` → `frontend/src/app/presentation/page.tsx` (adapter les chemins d'ancres).
- Créer `frontend/src/features/demo/{DemoPanel,ResultsViewer,SentenceRow,ClauseBoundary,ThemeToc,ComparisonCells,Summary,DownloadsGrid,KeyFigures,useDemoJob,language,export}.tsx|ts`, `frontend/src/lib/api/demo.ts`, `frontend/src/lib/taxonomy/labels.en.ts`.
- Ajouter les nouveaux fichiers à `GUARDED` dans `frontend/scripts/check-no-hex.mjs`.
- `npx vitest run tests/demo*.test.tsx && npx tsc --noEmit && npm run check:colors && npm run build`.

## 5. L5 — qualité

```bash
cd frontend && npx vitest run && npx tsc --noEmit && npm run lint && npm run check:colors
cd ../backend && DJANGO_SECRET_KEY=x .venv/bin/python -m pytest -q
cd ../research && HF_HUB_OFFLINE=1 .venv/bin/python -m pytest -q
cd ../frontend && npx playwright test e2e/a11y.spec.ts e2e/welcome.spec.ts
```
Auto-revue adversariale : `git diff main --stat` puis lecture critique (fuites d'identifiants, texte dans les exports, 401 possibles sur la page publique, hex, chaînes françaises sur `/`).

## 6. L6 — déploiement

```bash
# poids (≈ 440 Mo)
rsync -az --info=progress2 -e "ssh -i ~/.ssh/corolle_deploy" \
  research/runs/demo_legalbert_T11_holdout/results/model/fold_0/ \
  root@46.202.128.168:/var/www/claire-studio/var/models/legalbert_T11_holdout/
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 'chown -R www-data:www-data /var/www/claire-studio/var/models && \
  grep -q DEMO_MODEL_DIR /var/www/claire-studio/backend/.env || printf "DEMO_MODEL_DIR=/var/www/claire-studio/var/models/legalbert_T11_holdout\nDEMO_DATASET_ID=0a2542a1-c5b0-4ef8-95e0-15abea0566db\n" >> /var/www/claire-studio/backend/.env'
# déploiement (porte de tests + migration additive demo/0001)
DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh --allow-migrations
# contrôle
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 'cd /var/www/claire-studio/backend && DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py demo_selfcheck'
curl -s https://pactiva.legal/api/v1/public/demo/manifest | head -c 400
curl -s -X POST https://pactiva.legal/api/v1/public/demo/classify -H 'Content-Type: application/json' -d '{"source":"contract","document":"Headspace"}'
```
Porte : health 200 ; job `done` en moins de 30 s ; 7ᵉ `classify` en une minute → 429.

## 7. Pièges connus

- Le proxy coupe à 60 s : jamais d'inférence synchrone dans une vue.
- `apiFetch` redirige vers `/login` sur 401 : la page `/` n'appelle que des endpoints `AllowAny`.
- `HOME` n'est pas inscriptible sous systemd : passer `HF_HOME` vers un dossier du job ou charger le modèle depuis `DEMO_MODEL_DIR` (aucun téléchargement à l'exécution).
- transformers 5 sur le VPS, 4.44 en local : le dossier de poids est écrit en safetensors, lu par les deux ; `model_config.json` est le nôtre.
- `research/.venv` du VPS est reconstruit par le déploiement : `pysbd` doit être dans `pyproject.toml` (extras `transformers`).
- `vi.mock` de `@/lib/api/demo` doit lister toutes les exportations utilisées.
- Ne jamais éditer `taxonomies.json` (empreinte publiée).

## 8. Interdits absolus

- Aucune réservation Grid'5000 sans confirmation explicite du porteur ; aucun déploiement pendant un run Grid'5000.
- Aucun nom d'annotateur dans l'API publique, les téléchargements, l'interface ou les tests (utiliser des identifiants fictifs dans les fixtures).
- Aucun texte CLAUDETTE dans `frontend/public/downloads/` ni dans les exports côté client.
- Aucune couleur hex ni classe Tailwind brute dans les nouveaux composants.
- Aucune chaîne française sur `/`.
- Ne pas modifier les chiffres publiés à la main : toujours par `build_thematic_layer_release.py`.
