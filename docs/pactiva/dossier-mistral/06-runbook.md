# 06 — Runbook : exécution opérationnelle

> Procédure pas-à-pas pour livrer Mistral, du local à la prod, avec **commandes
> réelles** (vérifiées contre `deploy/deploy-claire.sh` et
> `deploy/push-preannotations.sh`). Ordre : **tests → build → deploy → push données →
> import prod → smoke → (rollback)**.
>
> Conventions vérifiées : venv backend = `backend/.venv/` ; settings prod =
> `config.settings.prod` ; health = `https://pactiva.legal/api/v1/health` ; projet
> prod = `campagne-pactiva` ; hôte = `root@46.202.128.168` ; clé `~/.ssh/corolle_deploy`.
> Les commandes réseau (ssh/rsync/curl prod) doivent tourner **hors sandbox**.

## 0. Pré-vol (local)

```bash
cd /Users/elazhar/PycharmProjects/claire-studio

# 0.1 — Branche dédiée (ne pas travailler sur main directement)
git checkout -b feat/mistral-3e-juge

# 0.2 — Vérifier que l'enum + la migration + le défaut --judges sont en place
grep -n "MISTRAL" backend/claire/imports/models.py
ls backend/claire/imports/migrations/ | grep -i judge          # 0002_alter_preannotation_judge.py
grep -n "judges" backend/claire/imports/management/commands/import_preannotations.py | grep default

# 0.3 — Vérifier que les données Mistral sont présentes (gitignorées)
ls data/preannotations/mistral/*_mistral.json | wc -l           # attendu : 22
ls data/preannotations/claude/*.json | wc -l                    # 50 (parité corpus)
ls data/preannotations/codex/*.json  | wc -l                    # 50

# 0.4 — Pas de migration manquante
cd backend && DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py makemigrations --check --dry-run ; cd ..
```

> Si `mistral/` est vide en local, copier les fichiers source :
> ```bash
> mkdir -p data/preannotations/mistral
> cp /Users/elazhar/PycharmProjects/CLAIRE/annotations/v9_2_session3_mistral/*_mistral.json \
>    data/preannotations/mistral/
> ```

## 1. Import local (dev) — vérifier le flux

```bash
cd /Users/elazhar/PycharmProjects/claire-studio/backend

# 1.1 — Import idempotent (1re passe)
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py \
  import_preannotations --project campagne-pactiva --judges claude,codex,mistral
# attendu : imported≈ (22 mistral + claude/codex) / missing=28 (docs sans mistral) / errors=0

# 1.2 — Re-run (idempotence : aucun doublon)
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py \
  import_preannotations --project campagne-pactiva --judges mistral

# 1.3 — Vérifier en base
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python manage.py shell -c \
"from claire.imports.models import PreAnnotation; \
print('mistral=', PreAnnotation.objects.filter(judge='mistral').count())"
cd ..
```

## 2. Tests (gate)

```bash
# 2.1 — Backend
cd backend && .venv/bin/python -m pytest -p no:warnings -q ; cd ..

# 2.2 — Frontend : typage + unitaires
cd frontend && npm run typecheck && npm run test ; cd ..

# 2.3 — Frontend : e2e (Playwright)
cd frontend && npm run e2e ; cd ..
```

Points à vérifier verts :
- pytest : import `mistral/` idempotent (TC-02), `normalize_v92` (TC-03), GET
  `?judge=mistral` (TC-05).
- vitest : `llmJudges` (TC-07/08), réglette 3 pistes + piste vide grisée (TC-11/12),
  ghostJudges (TC-16/17), prefill Mistral (TC-18).
- Playwright : `prefill-mistral` (TC-24/25), réglette 3 pistes (TC-23), et
  **`llm-compare.spec.ts` inchangé** (TC-26, garde-fou pairwise).

## 3. Build (local, sanity)

```bash
cd frontend && npm run build ; cd ..        # next build — doit réussir sans erreur de type
```

## 4. Déploiement code (prod)

> `deploy-claire.sh` ré-exécute le gate de tests, push la branche, fait sur le VPS :
> `git pull` → `pip install` → **`migrate`** (applique `0002`) → `collectstatic` →
> `npm install && npm run build` → `restart` des 2 services → **healthcheck** (10
> essais) → **rollback automatique** si health ≠ 200.

```bash
cd /Users/elazhar/PycharmProjects/claire-studio

# 4.1 — Déploiement complet (gate inclus)
./deploy/deploy-claire.sh
#   ▶ [1/4] gate tests   ▶ [2/4] git push   ▶ [3/4] VPS pull/migrate/build/restart
#   ▶ [4/4] health … → "✓ Déploiement OK … (health 200)"

# (variante si tests déjà passés à l'étape 2)
# ./deploy/deploy-claire.sh --no-tests
```

> La migration `0002_alter_preannotation_judge` s'applique **automatiquement** à
> l'étape [3/4] (`manage.py migrate --noinput`). **Aucune** action manuelle de schéma.

## 5. Push des données Mistral (prod)

> `data/preannotations/` est **gitignoré** → non déployé par `git pull`. Ce script
> l'envoie par **rsync** puis lance l'**import idempotent** côté prod.

```bash
cd /Users/elazhar/PycharmProjects/claire-studio

# 5.1 — rsync data/preannotations/ (claude+codex+mistral) → VPS, puis import prod
./deploy/push-preannotations.sh campagne-pactiva
#   ▶ [1/3] mkdir distant   ▶ [2/3] rsync --delete   ▶ [3/3] import_preannotations
#   ✓ Pré-annotations envoyées et importées (projet campagne-pactiva)
```

> Le script appelle en prod :
> `manage.py import_preannotations --project campagne-pactiva`
> (le défaut `--judges claude,codex,mistral` s'applique). Attention : `rsync --delete`
> **miroir** le local → s'assurer que `data/preannotations/mistral/` est complet (22)
> **avant** de pousser.

## 6. Vérifications & smoke prod

```bash
# 6.1 — Health (hors sandbox)
curl -s -o /dev/null -w '%{http_code}\n' https://pactiva.legal/api/v1/health     # attendu : 200

# 6.2 — Mistral présent via l'API (token admin requis ; sinon vérifier en shell prod)
ssh -i ~/.ssh/corolle_deploy -o IdentitiesOnly=yes root@46.202.128.168 \
  "cd /var/www/claire-studio/backend && DJANGO_SETTINGS_MODULE=config.settings.prod \
   .venv/bin/python manage.py shell -c \
   \"from claire.imports.models import PreAnnotation; \
     print('mistral=', PreAnnotation.objects.filter(judge='mistral').count())\""
# attendu : mistral= 22  (× nb de docs couverts, ≥ 1 par doc couvert)
```

### Smoke fonctionnel (navigateur, prod)
1. Se connecter (compte de la campagne) ; ouvrir un document **couvert** par Mistral.
2. Activer **« Frontières »** → la réglette montre **3 pistes** : C / Cx / **M**.
3. Ouvrir un document **non couvert** (28/50) → piste **M grisée** + en-tête barré
   (pas d'erreur).
4. **Prefill « Mistral »** → confirmer → les clauses se peuplent ; provenance
   `preannotation:mistral`.
5. Activer le **fantôme Mistral** → propositions en filigrane.
6. Clic-droit sur une phrase → bloc **Mistral** présent + « adopter ».
7. Vérifier l'**absence de 400** (onglet réseau) et **pas de tempête autosave**
   (pas de réessais en boucle).
8. **Non-régression** : mode **Comparer** fonctionne comme avant (pairwise
   claude-vs-codex).

## 7. Rollback

### 7.1 Code (automatique)
`deploy-claire.sh` effectue le rollback **seul** si health ≠ 200 :
`git reset --hard ${PREV_SHA}` → `migrate` → `npm run build` → `restart`. Aucune action
manuelle ; le script sort en erreur (`exit 1`).

### 7.2 Code (manuel, si besoin)
```bash
ssh -i ~/.ssh/corolle_deploy -o IdentitiesOnly=yes root@46.202.128.168 \
  "set -e; cd /var/www/claire-studio && git reset --hard <PREV_SHA> && \
   cd backend && DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py migrate --noinput && \
   cd ../frontend && npm run build && systemctl restart claire-studio claire-studio-web"
```

### 7.3 Données
Les pré-annotations sont **additives/idempotentes**. Pour retirer Mistral des données
prod (cas extrême) :
```bash
ssh -i ~/.ssh/corolle_deploy -o IdentitiesOnly=yes root@46.202.128.168 \
  "cd /var/www/claire-studio/backend && DJANGO_SETTINGS_MODULE=config.settings.prod \
   .venv/bin/python manage.py shell -c \
   \"from claire.imports.models import PreAnnotation; \
     PreAnnotation.objects.filter(judge='mistral').delete()\""
```
> Le code front gère nativement l'absence de Mistral (piste grisée) → retirer les
> données ne casse rien.

## 8. Check-list de sortie (Go/No-Go)

- [ ] `makemigrations --check` : aucune migration manquante.
- [ ] `data/preannotations/mistral/` : **22** fichiers.
- [ ] pytest / vitest / typecheck / e2e : **verts** (dont non-régression compare).
- [ ] `deploy-claire.sh` : **health 200**, services actifs.
- [ ] `push-preannotations.sh` : import prod `errors=0`.
- [ ] Smoke prod : 3 pistes, piste grisée OK, prefill Mistral OK, **aucun 400**, pas de
      tempête autosave.
- [ ] `git` : branche mergée vers `main` après validation (PR).

## 9. Annexe — commandes de référence (récap)

| But | Commande |
|-----|----------|
| Import local | `manage.py import_preannotations --project campagne-pactiva --judges claude,codex,mistral` |
| Import mistral seul | `manage.py import_preannotations --project campagne-pactiva --judges mistral` |
| Vérif migrations | `manage.py makemigrations --check --dry-run` |
| Tests back | `cd backend && .venv/bin/python -m pytest -p no:warnings -q` |
| Tests front | `cd frontend && npm run typecheck && npm run test` |
| E2E | `cd frontend && npm run e2e` |
| Build front | `cd frontend && npm run build` |
| Deploy code | `./deploy/deploy-claire.sh` |
| Push données + import prod | `./deploy/push-preannotations.sh campagne-pactiva` |
| Health prod | `curl -s -o /dev/null -w '%{http_code}\n' https://pactiva.legal/api/v1/health` |
