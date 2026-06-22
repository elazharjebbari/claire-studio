# Runbook d'exécution — annotation assistée

Pré-requis : env dev/test via conda `claire` ou `backend/.venv` ; déploiement via
`DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh` (le gate tourne AVANT le push).

## 0. Préparation (Lot 0)
```bash
# Réconcilier le vocabulaire (BLOQUANT) : vérifier theme_aliases vs scheme app
grep -nE "CANONICAL_THEMES|=" backend/claire/imports/theme_mapping.py
# Figer moteur/07-regles-routage.yaml, puis générer les deux runtimes :
npm --prefix frontend run build:rules     # -> src/lib/triage/rules.generated.ts
python backend/manage.py build_rules      # -> backend/claire/triage/rules.py
# Lint du YAML + non-régression du golden set
```

## 1. Backend — migrations multi-label (Lot 2)
```bash
cd backend
# Générer & inspecter AVANT d'appliquer
python manage.py makemigrations annotations            # 0004_clausetheme, 0005_clause_boundary_level
python manage.py sqlmigrate annotations 0004           # revue SQL
# Migration de données legacy (mono -> 1 ClauseTheme primary) incluse, RÉVERSIBLE
python manage.py migrate
# Vérifier la rétro-compat : lecture `theme` == primaire
python manage.py shell -c "from claire.annotations.models import Clause; c=Clause.objects.first(); print(c.theme, [(t.theme.code,t.role) for t in c.theme_tags.all()])"
```
Rollback migration : `python manage.py migrate annotations 0003`.

## 2. Tests (par lot, et complet)
```bash
# Moteur pur (Lot 1)
npm --prefix frontend run test -- tests/triageEngine.test.ts
# Parité front/back
npm --prefix frontend run test -- tests/triageParity.test.ts
backend/.venv/bin/python -m pytest backend/tests/test_triage_parity.py -q
# Invariants data (Lot 2)
backend/.venv/bin/python -m pytest backend/tests/test_clause_multilabel.py backend/tests/test_clauses_batch.py -q
# Composants + store (Lot 3-4)
npm --prefix frontend run test -- tests/suggestionCard.test.tsx tests/multiThemePalette.test.tsx tests/triageStore.test.ts
# e2e (Lot 5)
npm --prefix frontend run e2e -- triage.spec.ts
# Mesure (Lot 6)
backend/.venv/bin/python -m pytest backend/tests/test_iaa_multilabel.py -q
```

## 3. Déploiement (par lot, flag fermé par défaut)
```bash
# Flag OFF en prod tant que non validé :
#   front: NEXT_PUBLIC_TRIAGE=false   back: TRIAGE_ENABLED=false   (dans .env)
DJANGO_SECRET_KEY=deploy-gate-key ./deploy/deploy-claire.sh
# Le gate exécute pytest + vitest ; build bloqué si rouge. Healthcheck 200 attendu.
```

## 4. Passe pilote (Lot 7, avant ouverture du flag)
```bash
# 1) Activer le flag pour l'annotateur pilote uniquement (cf. 13-strategie-prod.md)
# 2) 3 documents : un facile (bcp de C1), un cluster-lourd (bcp de C3), un dur (bcp de C5)
# 3) Mesurer temps/clic réel par niveau (instrumentation events) ; recalculer α MASI :
backend/.venv/bin/python scripts/iaa_multilabel.py --judge ... --out exemples/iaa_after_human.json
# Critère GO : α MASI >= 0.67 visé, pas de perte de données, temps C1+C2 << C4+C5.
```

## 5. Vérifications post-déploiement
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://pactiva.legal/api/v1/health   # 200
# Le mode file s'ouvre, le lot C1 crée N clauses atomiquement, l'override est annulable,
# le multi-label persiste, la frontière molle se fusionne/scinde, soumission OK.
```

## 6. Rollback
- **Flag** : `NEXT_PUBLIC_TRIAGE=false` + `TRIAGE_ENABLED=false` → l'atelier revient à
  l'annotation classique (le multi-label en base reste lisible via le primaire). Redeploy.
- **Données** : `migrate annotations 0003` (la migration data est réversible : 1 primaire → `theme`).
- **Règles** : revenir à la version YAML précédente + `build:rules` + re-triage.

## 7. Observabilité
- Events front : `triage_open`, `level_accept{level,batch_size}`, `override_undo`,
  `swap_primary`, `boundary_merge/split`, `escalate` → mesurer temps/clic par niveau.
- Logs back : audit des overrides + provenance ; compteur de clauses multi par doc.
- MLflow / suivi : α MASI, κ par thème, Pk/WindowDiff par version de règles.
