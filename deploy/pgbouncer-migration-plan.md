# Plan d'action — Migration de toutes les apps vers PgBouncer (VPS mutualisé)

But : router **toutes les apps** qui parlent à Postgres via **PgBouncer** (127.0.0.1:**6432**)
afin d'éliminer définitivement la rétention de connexions (fuites) et d'offrir un pooling
pérenne. Le Postgres reste sur 5432 (cible du pooler).

## 0. État (déjà en place)
- PgBouncer 1.22 installé, actif, `auth_file` = tous les rôles, `[databases] * = host=127.0.0.1 port=5432`, `pool_mode=transaction`, écoute 6432. Vérifié OK.
- Filets actifs : reaper cron (`/etc/cron.d/pg_idle_reaper`, purge idle > 2 h) + `max_connections=200`.
- Donc : **aucune urgence** — la migration se fait posément, app par app, avec rollback.

## 1. Inventaire des consommateurs Postgres
| App | Base(s) | Rôle | Stack | Service(s) systemd | Connexions idle observées | Priorité |
|---|---|---|---|---|---|---|
| optimise | `corolle_optimise` | optimise | Django WSGI + Celery | corolle-optimise(.|-celery|-beat) | **27 (9 j)** | 🔴 haute |
| corolle (reviews) | `corolle` | corolle | Django WSGI + Celery | corolle(.|-celery|-beat) | **22 (6 j)** | 🔴 haute |
| alraha | `gestion_stock_db` | django_user | Django WSGI + Celery | gunicorn_alraha, celery_alraha(_beat) | **26** | 🔴 haute |
| cod | `cod`/(corolle_cod) | — | Django WSGI + Celery | corolle-cod(.|-celery|-beat) | — | 🟠 |
| tracking | `tracking`/(corolle_*) | — | Django WSGI + Celery | corolle-tracking(.|-celery|-beat) | — | 🟠 |
| alfenna | `alfenna_db` | user_alfenna | Django WSGI + Celery | gunicorn_alfenna, celery_alfenna | 3 | 🟠 |
| lumiereacademy | (lumiereacademy) | — | Django WSGI + Celery | gunicorn_lumiereacademy, celery_lumiereacademy | — | 🟠 |
| lumierelearning | `lumierelearning_db` | user_lumierelearning | Django WSGI + Celery | gunicorn_lumierelearning, celery_lumierelearning | 5 | 🟠 |
| lumierelearning-staging | `lumierelearning_staging` | user_lumierelearning | Django | celery_lumierelearning_staging | 1 | 🟢 pilote |
| baiti | `baiti`/`staging_baiti` | — | Django WSGI **+ ASGI daphne** + Celery | gunicorn_baiti, daphne_baiti, celery_baiti, celerybeat_baiti | — | 🟠 (ASGI : prudence) |
| femiglow | `femiglow`/`staging_femiglow` | femiglow | (Node) | (à confirmer) | 9 | 🟠 |
| listmonk | `listmonk` | listmonk | Node (pool intégré) | listmonk.service | 1 | 🟢 (déjà borné) |
| postiz | `postiz` | postiz | Node (pool intégré) | (postiz) | 3 | 🟢 (déjà borné) |
| **claire (Pactiva)** | `claire_studio` | claire | Django **ASGI daphne** | claire-studio(.|-web) | **0** (bon citoyen) | ⚪ optionnel |
| bases de **test** | `femiglow_test_*`, `*_test_db`, `*_import` | — | éphémères (CI/tests) | — | churn, pas de fuite | ⚫ ne pas migrer / **DROP** (ménage) |

> Étape 0 de chaque migration : confirmer le **fichier de conf DB** exact (`grep -rl "5432\|<dbname>" /var/www/<app>` → `.env` / `settings*.py`) et la **liste des services** à redémarrer (web **+ celery + beat**, ils tiennent souvent les connexions).

## 2. Choix du mode de pooling (déterminant)
PgBouncer `pool_mode` :
- **transaction** (défaut, max d'économie) → **Django WSGI + Celery** (requêtes courtes). Gain maximal.
- **session** (1 connexion serveur par client connecté, moins d'économie mais 100 % compatible) → **ASGI/async** (claire, baiti-daphne) et tout ce qui utilise des fonctionnalités de session.
- **Ne pas (forcément) migrer** : apps **Node** qui ont déjà un pool **borné** (listmonk, postiz) → elles ne fuient pas ; migration facultative (session mode) seulement pour centraliser.

**Incompatibilités du mode transaction** (→ basculer en `session` pour l'app concernée) :
`LISTEN/NOTIFY`, prepared statements côté serveur, `SET`/`SET LOCAL` de session persistants, advisory locks de session, curseurs `WITH HOLD`.
Contrôle par app : `grep -riE "LISTEN |NOTIFY |advisory_lock|WITH HOLD" <code>` ; Django/psycopg gère, mais en transaction il **faut** `DISABLE_SERVER_SIDE_CURSORS=True`.

## 3. Recette par app (répétable, avec rollback)
Pour chaque app, dans l'ordre :
1. **Sauvegarder** la conf : `cp <conf> <conf>.bak.pgb`.
2. **Compat** : grep LISTEN/NOTIFY/advisory/prepared → choisir `transaction` (défaut) ou `session`.
3. **(Django)** ajouter `DISABLE_SERVER_SIDE_CURSORS = True` (option DB) — obligatoire en transaction.
   - via django-environ : `DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True` dans settings, ou option si le code le permet.
4. **Pointer la conn string sur 6432** : `…@127.0.0.1:5432/<db>` → `…@127.0.0.1:6432/<db>` (host inchangé).
5. **(si mode session requis)** ajouter un override dans `/etc/pgbouncer/pgbouncer.ini` :
   `[databases]` → `<db> = host=127.0.0.1 port=5432 pool_mode=session pool_size=<N>` puis `systemctl reload pgbouncer`.
6. **Redémarrer les services de l'app** : web **+ celery + beat**.
7. **Vérifier** :
   - app répond (HTTP 200) + logs sans erreur DB ;
   - `psql -p6432 -U pgbouncer pgbouncer -c "SHOW POOLS"` → pool créé, `cl_active`/`sv_active` cohérents ;
   - `pg_stat_activity` : les connexions **directes** de cette db chutent (passent par pgbouncer) ;
   - les autres sites toujours 200.
8. **Rollback** si souci : restaurer `<conf>.bak.pgb`, redémarrer les services.

## 4. Dimensionnement PgBouncer (à finaliser dans pgbouncer.ini)
- Garder le wildcard `* = host=127.0.0.1 port=5432` (transaction) comme défaut.
- Overrides par base sensible (ASGI/LISTEN) en `pool_mode=session`.
- Bornage : `default_pool_size=20`, `reserve_pool_size=5`, `max_db_connections=<≤ ~25/db>`, `max_client_conn=2000`.
- **Invariant capacité** : Σ(pool_size serveur de toutes les bases) **< `max_connections`=200** avec marge. Avec ~12 apps actives × (web ~10 + celery ~5) → viser un total serveur ~120–150. Surveiller via `SHOW POOLS`.

## 5. Ordre d'exécution (du moins au plus risqué)
1. **Pilote** : `lumierelearning-staging` (Django, staging, faible enjeu) → valider recette + rollback de bout en bout.
2. **Gros pollueurs Django WSGI (le gain)** : optimise → corolle → alraha → puis cod, tracking, alfenna, lumiereacademy, lumierelearning (chacun : web + celery + beat). Une app à la fois, vérif entre chaque.
3. **Node** (listmonk, postiz, femiglow) : évaluer le pool intégré ; migrer en `session` seulement si utile (ils ne fuient pas).
4. **ASGI/async en dernier, prudence** : `baiti` (daphne) en **session mode** ; **claire** facultatif (0 fuite — peut rester en direct, ou session mode si on veut tout centraliser ; **ne pas** mettre claire en transaction sans tests Channels).
5. **Ménage** : `DROP DATABASE` des `femiglow_test_*` / `*_test_db` / `*_import` orphelines (après confirmation qu'elles ne servent plus).

## 6. Validation globale (après chaque vague)
- `SHOW POOLS` / `SHOW STATS` pgbouncer (clients vs serveurs).
- `pg_stat_activity` : total connexions directes maîtrisé + en baisse.
- Tous les sites HTTP 200 (boucle de smoke).
- Au repos quelques jours : vérifier qu'aucune base ne re-grimpe (le reaper reste le filet).

## 7. Definition of Done
- [ ] Toutes les apps prod (hors test) pointent sur 6432, mode adéquat.
- [ ] Connexions serveur Postgres stables et bornées (≪ 200), zéro fuite multi-jours.
- [ ] Tous les sites 200 ; logs DB propres ; rollback documenté par app (`*.bak.pgb`).
- [ ] Bases de test orphelines supprimées.
- [ ] (filets conservés : reaper + max_conn=200, ceinture+bretelles).

## 8. Rollback global
Repointer les conn strings sur 5432 + redémarrer les services. PgBouncer reste installé (inerte). Aucune perte de données (pooler = transport).
