# Runbook — exécution de la batterie multi-annotation

## Pré-requis
- Backend : env Python avec deps (conda `claire` en local, ou `backend/.venv`) +
  `hypothesis` (dans `requirements.txt`). `DJANGO_SECRET_KEY` requis (n'importe quelle
  valeur en test). Exports en `EXPORTS_RUN_INLINE=True` (déjà dans `config/settings/test.py`).
- Frontend : `npm install` fait ; Node + Playwright (navigateurs) pour l'e2e.

## Commandes

### Backend — toute la batterie
```bash
cd backend
DJANGO_SECRET_KEY=test <python> -m pytest -p no:warnings -q
```
### Backend — ciblé multi-annotation
```bash
DJANGO_SECRET_KEY=test <python> -m pytest -q \
  tests/test_multi_annotation_battery.py \
  tests/test_campaign_simulation.py \
  tests/test_export_async.py
```
### Mode « validation pré-campagne » (property approfondi)
```bash
# Plus d'exemples hypothesis (contre-exemples plus rares) :
DJANGO_SECRET_KEY=test <python> -m pytest -q tests/test_campaign_simulation.py \
  -p no:cacheprovider --hypothesis-seed=random
# (ou augmenter max_examples via HYPOTHESIS profile / settings dans le test)
```
> `<python>` = `/Users/elazhar/miniforge3_x86_64/envs/claire/bin/python` (local) ou
> `backend/.venv/bin/python` (gate de déploiement).

### Frontend
```bash
cd frontend
node_modules/.bin/tsc --noEmit
node_modules/.bin/vitest run                 # 208 tests
node_modules/.bin/vitest run tests/multiSessionStore.test.ts tests/documentList.test.tsx
node_modules/.bin/playwright test e2e/multi-annotation.spec.ts e2e/no-duplicate-documents.spec.ts
```

## Interprétation
- **Vert partout** → critères GO remplis (cf. `06-plan-action.md`).
- **Échec property/simulation** : hypothesis/pytest impriment le `seed` + le
  contre‑exemple. Reproduire : relancer le même test (le seed est dans le nom du
  paramètre `test_campaign_simulation[seed]` ou la sortie hypothesis). Le message
  d'assert pointe l'invariant violé (ex. `perte/écart seed=… {got} != {ref}`).
- **Si un invariant casse** → NO‑GO. Corriger le code applicatif (jamais le test pour
  « le faire passer »), re‑run la suite complète.

## Reporting (modèle)
```
Date | Backend X/X | Frontend Y/Y | Simulation seeds=12 ops≈1700 OK | Property 700 ex OK | E2E Z/Z | Verdict GO/NO-GO
```

## CI (intégration au gate de déploiement)
`deploy/deploy-claire.sh` exécute déjà `pytest` (backend) + `tsc && vitest` (front)
avant tout push. La batterie multi-annotation y est donc **incluse** : un invariant
cassé bloque le déploiement.
