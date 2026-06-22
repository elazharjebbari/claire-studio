# Runbook de déploiement — Refonte workspace Pactiva

> Cible : prod `pactiva.legal` (VPS OLS mutualisé). Mécanisme : `deploy/deploy-claire.sh`
> (push GitHub → VPS `git pull` → backend `migrate`/`collectstatic` + front `build` →
> restart des 2 services systemd → healthcheck avec **rollback automatique** si `health != 200`).
> Services : `claire-studio` (Django ASGI/daphne) + `claire-studio-web` (Next.js).
> Health : `https://pactiva.legal/api/v1/health`.

Ce runbook décrit le déploiement **par lot** (A → B → C, cf. `plan-action.md`), la gate de tests, le healthcheck, le rollback et les **vérifications post-déploiement par axe**.

---

## 0. Pré-requis (poste de déploiement)

- Branche de travail à jour, working tree propre (`git status`).
- `DJANGO_SECRET_KEY` requis pour la gate backend (les settings `config.settings.prod` la lisent ; le `pytest` backend la charge via l'environnement). L'exporter **avant** de lancer le script :
  ```bash
  export DJANGO_SECRET_KEY="$(cat /Users/elazhar/PycharmProjects/claire-studio/.credentials/django_secret_key 2>/dev/null)"
  # ou la valeur prod gardée hors dépôt
  ```
- Clé SSH VPS présente : `~/.ssh/corolle_deploy` (le script l'utilise en `IdentitiesOnly=yes`, `BatchMode=yes`). Aucun secret n'est jamais écrit dans le dépôt.
- Le script déploie la **branche courante** (`git rev-parse --abbrev-ref HEAD`). Vérifier qu'on est sur la branche de refonte attendue.

---

## 1. Gate de tests (locale, bloquante)

Le script `deploy/deploy-claire.sh` exécute la gate par défaut (`[1/4]`). On peut la rejouer manuellement avant push :

```bash
# Backend (si venv présent) — nécessite DJANGO_SECRET_KEY
( cd /Users/elazhar/PycharmProjects/claire-studio/backend && .venv/bin/python -m pytest -p no:warnings -q )

# Frontend : typecheck + tests unitaires (bloquants dans le script)
( cd /Users/elazhar/PycharmProjects/claire-studio/frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run )

# E2E ciblés (NON exécutés par le script — à jouer manuellement avant les lots A/B)
( cd /Users/elazhar/PycharmProjects/claire-studio/frontend && npx playwright test e2e/document-ux.spec.ts e2e/llm-compare.spec.ts e2e/a11y.spec.ts )
```

La gate du script est : `tsc --noEmit && vitest run` (+ `pytest` si venv). **Aucun push n'a lieu si la gate échoue** (`set -euo pipefail`).

> Lot C : `pytest` doit couvrir le loader (`normalize_v92` jointure `start_id`) et le serializer. Si `DJANGO_SECRET_KEY` n'est pas exporté, la gate backend échoue à l'import des settings — c'est volontaire (fail fast).

---

## 2. Déploiement (par lot)

### Lot A et Lot B (front only, sans migration)

```bash
export DJANGO_SECRET_KEY="…"
/Users/elazhar/PycharmProjects/claire-studio/deploy/deploy-claire.sh
# ou, si la gate a déjà été jouée et qu'on veut sauter les tests :
# /Users/elazhar/PycharmProjects/claire-studio/deploy/deploy-claire.sh --no-tests
```

Le script enchaîne : gate → capture `PREV_SHA` (VPS) → `git push` → VPS `pull` + `migrate` (no-op A/B) + `collectstatic` + `npm run build` → `systemctl restart` → healthcheck.

### Lot C (avec migration + réimport)

1. **Dump de sécurité** de la table impactée, avant tout réimport :
   ```bash
   ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 \
     "sudo -u postgres pg_dump -t imports_preclause claire > /root/backups/preclause_$(date +%F_%H%M).sql"
   ```
2. **Déploiement** (la migration `legal_nature` est appliquée automatiquement par `[3/4]`) :
   ```bash
   export DJANGO_SECRET_KEY="…"
   /Users/elazhar/PycharmProjects/claire-studio/deploy/deploy-claire.sh
   ```
3. **Réimport contrôlé** des préannotations (hors heures de pointe) via le pipeline d'ingestion (`deploy/push-preannotations.sh` ou la commande d'import backend selon le runbook corpus), puis vérifier le **taux de match** de la jointure `start_id ↔ annotations[].id` dans les logs du loader. Si match anormalement bas → ne pas considérer le lot comme livré, investiguer le format avant tout autre déploiement.

---

## 3. Healthcheck

`[4/4]` du script : jusqu'à 10 tentatives × 3 s sur `https://pactiva.legal/api/v1/health`, attendu `200`. Vérification manuelle :

```bash
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 \
  "curl -s -o /dev/null -w '%{http_code}\n' https://pactiva.legal/api/v1/health"
# État des services :
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 \
  "systemctl is-active claire-studio claire-studio-web"
```

---

## 4. Rollback

- **Automatique** (toute occurrence où `health != 200`) : le script exécute
  `git reset --hard ${PREV_SHA}` → `migrate --noinput` → `npm run build` → `systemctl restart` puis sort en erreur. Aucune action manuelle requise.
- **Manuel** (régression fonctionnelle détectée après un health 200) :
  ```bash
  ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 "set -e; cd /var/www/claire-studio && \
    git reset --hard <PREV_SHA> && \
    cd backend && DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py migrate --noinput && \
    cd ../frontend && npm run build && systemctl restart claire-studio claire-studio-web"
  ```
- **Lot C** : le `migrate` du rollback est **no-op** (migration additive `CharField default=""` : la colonne reste, inutilisée — pas de perte de données). Si des valeurs de nature erronées ont été écrites par un réimport, restaurer la table depuis le dump :
  ```bash
  ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 \
    "sudo -u postgres psql claire < /root/backups/preclause_<date>.sql"
  ```

> Pièges OpenLiteSpeed connus (cf. mémoire prod) : après un `restart`, vérifier le WebSocket de collaboration et, en cas de souci TLS, l'état `vhssl` post-cert. Ces points ne sont pas modifiés par cette refonte mais restent à surveiller après chaque restart.

---

## 5. Vérifications post-déploiement par axe

À jouer sur `https://pactiva.legal/annotate/<id>` avec un document réel (≥ 139 phrases, ≥ 2 juges présents dont Mistral).

### Lot A
- **Axe 1 — Hover** : survol > ~300 ms d'une phrase annotée → popover rationale visible (`[data-testid="rationale-hover"]`) ; survol d'une phrase nue → aucun popover ; clic / clic-droit / long-press toujours opérants pendant le hover.
- **Axe 2 — Nature (UI)** : `NaturePicker` à pastilles dans l'inspecteur (plus de `<select>`) ; tooltip de définition au survol ; badge de nature dans l'en-tête de clause ; la sélection persiste (recharger la page).
- **Axe 6 — Gutter** : un run lit comme un bloc continu ; teinte de thème visible toggle OFF ; séparateur net aux ruptures ; liseré ambre sur les colonnes des modèles divergents.
- **Axe 7 — Compare banner** : activer Comparer avec Claude + Mistral → banner liste les bons modèles + score N-way ; au scroll, banner + nav divergences restent collés ; `n`/`p` naviguent.

### Lot B
- **Axe 3 — Inspecteur** : thèmes en grille + hover ; bouton Valider présent ; comparateur avec un onglet par juge présent (Mistral inclus) ; commentaires visibles + compteur + composer inline.
- **Axe 4 — Toolbar** : barre groupée (Source / Sélection / Lecture / Langue) ; sélectionner ≥1 phrase → `SelectionToolGroup` apparaît avec `selection-count` ; « Segment courant » / « Tout le thème courant » / « Vider » opérants ; Versions/Insights/Tour dans « Plus ».
- **Axe 5 — Minimap** : colonne minimap à droite peinte par thème ; cadre viewport suit le scroll ; clic = saut + focus ; toggle dans Overlays persiste. **Non-régression scroll** : toolbar sticky, `ComparePanel` sticky et `scrollIntoView` au focus inchangés.

### Lot C
- **Axe 2/3 — Nature LLM** : sur une clause couverte par les juges, le comparateur et le `SentenceMenu` affichent la nature de chaque juge ; voyant accord/divergence sur la nature ; un juge sans nature → `—`.
- **Vérif data** : taux de match jointure dans les logs du loader ; échantillon SQL `SELECT legal_nature, count(*) FROM imports_preclause GROUP BY 1` cohérent (pas 100 % vide).
- **Non-régression chaîne humaine** : saisie de nature → autosave → diff/historique (`clause.set_legalNature`) inchangés.

> Toute vérification en échec sur un axe critique (hover qui casse le clic, scroll cassé, score compare incohérent, nature LLM vide après réimport) déclenche un rollback du lot concerné (section 4) avant correction.
