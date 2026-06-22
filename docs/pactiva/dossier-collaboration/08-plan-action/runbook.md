# Runbook — Déploiement « Sessions vs Collaboration »

> Cible : **pactiva.legal** (VPS OLS mutualisé). Stack : Django ASGI/Channels (daphne)
> + Next.js (`next start`) + Postgres + Redis. 2 services systemd : `claire-studio`
> (backend), `claire-studio-web` (front). Script : `deploy/deploy-claire.sh`.

## 0. Pré-requis
- Accès SSH VPS : clé `~/.ssh/corolle_deploy` (jamais de secret en clair).
- Variables d'env prod présentes sur le VPS (`DJANGO_SECRET_KEY`, `DATABASE_URL`, …).
- Branche à jour, working tree propre, commit fait.

## 1. Ordre des tâches (dépendances)
```
commit ──▶ gate de tests ──▶ git push ──▶ VPS pull ──▶ migrate ──▶ collectstatic
        ──▶ npm build front ──▶ restart services ──▶ healthcheck ──▶ (rollback si KO)
```

## 2. Gate de tests (bloquant) — validations techniques
| Niveau | Commande | Attendu |
|---|---|---|
| Backend | `pytest -p no:warnings -q` (env Django) | 125 passed (1 test prod nécessite `DJANGO_SECRET_KEY`) |
| Front types | `tsc --noEmit` | 0 erreur |
| Front unit | `vitest run` | 186 passed |

> Note : `deploy-claire.sh` exécute le gate backend seulement si `backend/.venv` existe.
> En local, l'env Django est l'env conda `claire` ; on lance donc le gate backend
> manuellement avant le déploiement.

## 3. Déploiement
```bash
./deploy/deploy-claire.sh           # gate → push → VPS → health (+rollback auto)
# (commandes réseau côté agent : dangerouslyDisableSandbox)
```
Le script :
1. enregistre le SHA prod courant (`PREV_SHA`) pour rollback ;
2. `git push origin <branche>` ;
3. VPS : `git pull --ff-only` → `pip install -r requirements.txt` →
   `migrate --noinput` (applique `exports/0002_alter_exportjob_format`) →
   `collectstatic` → `npm install && npm run build` → `systemctl restart` des 2 services ;
4. **Healthcheck** `https://pactiva.legal/api/v1/health` (10 tentatives × 3 s).

## 4. Points de contrôle (validations fonctionnelles post-déploiement)
| # | Vérification | Méthode |
|---|---|---|
| H1 | `GET /api/v1/health` = 200 | automatique (script) |
| H2 | Login des 3 comptes (elazhar / jc.lamirel / zahra.boulaich) | manuel ou smoke |
| H3 | **Plus de documents en double** sur `/projects/campagne-pactiva` et dans le sélecteur | visuel + `GET /projects/campagne-pactiva/documents` (1 ligne/doc) |
| H4 | Annotateur : `GET /annotations` ne renvoie QUE ses sessions | curl authentifié |
| H5 | Admin : `GET /projects/campagne-pactiva/documents` renvoie `sessions[]` (matrice) | curl admin |
| H6 | Export : `POST /projects/campagne-pactiva/exports` (jsonl) puis `GET /exports/{id}/download` | curl admin |
| H7 | IAA : `GET /projects/campagne-pactiva/iaa` répond sans erreur | curl admin |

### Smoke API (lecture seule, non destructif)
```bash
TOKEN=...  # login elazhar
curl -s -H "Authorization: Bearer $TOKEN" \
  https://pactiva.legal/api/v1/projects/campagne-pactiva/documents | jq '.count, (.results|length)'
# count == nb de documents distincts (≈50), pas 150.
```

## 5. Plan de reprise (rollback)
- **Automatique** : si `health != 200`, le script `git reset --hard $PREV_SHA` →
  `migrate` → `npm run build` → `restart`. Déploiement abandonné, prod restaurée.
- **Manuel** (si besoin après coup) :
  ```bash
  ssh -i ~/.ssh/corolle_deploy root@<vps> \
    "cd /var/www/claire-studio && git reset --hard <PREV_SHA> && \
     cd backend && DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py migrate --noinput && \
     cd ../frontend && npm run build && systemctl restart claire-studio claire-studio-web"
  ```
- La migration `exports/0002` est **sans impact schéma** (CharField choices) : un
  rollback de code ne nécessite pas de migration inverse de données.

## 6. Communication
- Changement de comportement notable : un annotateur ne voit plus les sessions des
  autres (indépendance). À signaler à l'équipe (jc.lamirel, zahra.boulaich) :
  « chacun annote sur sa session ; la comparaison passe par les outils dédiés ».
