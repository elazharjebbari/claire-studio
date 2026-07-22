# Plan de remédiation — socle statistiques et déploiement

> État initial : branche `main`, commit `af84cf3`, audit du 22 juillet 2026.
> Périmètre : combler les lacunes techniques objectives avant de spécifier de nouveaux KPI métier.

## 1. Lacunes caractérisées

| ID | Gravité | Lacune | Preuve | Conséquence |
|---|---:|---|---|---|
| LAC-STAT-01 | critique | Les mutations de clauses ne produisent pas d'événements métier. | `record_event` n'est appelé ni par `add_clause`, ni par `ClauseViewSet`. | Impossible de mesurer correctement les ajouts, corrections et suppressions ; l'audit est incomplet. |
| LAC-STAT-02 | haute | L'avancement « annotateurs » parcourt tous les membres, reviewers compris. | `annotators_progress()` itère `project.memberships` sans filtre de rôle. | Un reviewer sans session apparaît comme annotateur à 0 %, ce qui fausse les agrégats et dénominateurs. |
| LAC-STAT-03 | haute | Les spécifications analytics dépassent l'implémentation. | `AnalyticsSnapshot`, métriques de vélocité et instrumentation Prometheus absents du code. | Risque de considérer une cible documentaire comme une fonctionnalité disponible. |
| LAC-STAT-04 | moyenne | Certains insights document/corpus prennent une seule annotation représentative. | `rep = d_anns.first()` dans `ProjectViewSet.insights*`. | Une vue multi-annotateur peut afficher le statut et les clauses d'une seule personne comme s'ils représentaient le document. |
| LAC-CI-01 | critique | Les workflows GitHub Actions ciblent `annotation-studio/*`, absent du dépôt. | Tous les `working-directory` et chemins d'artefacts contiennent ce préfixe. | La CI ne peut pas exécuter correctement lint, tests ou build depuis la racine actuelle. |
| LAC-CI-02 | critique | La CI configure pnpm alors que seul `package-lock.json` est versionné. | Aucun `pnpm-lock.yaml`; `package.json`/scripts locaux utilisent npm. | Installation non reproductible et échec de `--frozen-lockfile`/cache. |
| LAC-BUILD-01 | haute | Compose et la CI demandent deux Dockerfiles absents. | `build.context` pointe vers `backend/` et `frontend/`, sans Dockerfile. | `docker compose build` et le job CI d'images échouent. |
| LAC-DEPLOY-01 | critique | Le gate de tests peut ignorer pytest si le venv n'existe pas. | Condition `[ -x "$VENV_PY" ]` sans branche d'échec. | Un déploiement peut partir sans test backend. |
| LAC-DEPLOY-02 | critique | Le rollback code ne restaure pas une migration DB incompatible. | `git reset --hard PREV_SHA`, puis `migrate` vers l'avant. | Un rollback peut laisser le code précédent face à un schéma incompatible. |
| LAC-DEPLOY-03 | haute | Aucun garde-fou sur branche, worktree ou SHA testé. | Le script déploie directement `git rev-parse --abbrev-ref HEAD`. | Mauvaise branche ou changements non commités peuvent être confondus avec le contenu réellement déployé. |
| LAC-DEPLOY-04 | haute | Le healthcheck final ne valide que l'API. | Boucle sur `/api/v1/health` uniquement. | Une panne frontend ou WebSocket peut passer pour un déploiement sain. |
| LAC-DATA-01 | moyenne | La DB SQLite locale a des migrations en attente. | `showmigrations --plan` signale notamment annotations 0004/0005 et gold 0001 non appliquées. | Les tests manuels locaux ne reflètent pas le schéma du code courant. |

## 2. Décisions de remédiation

### Lot A — vérité statistique et audit

1. Émettre `clause.added`, `clause.updated` et `clause.deleted` dans la même transaction que la
   mutation.
2. Cibler l'annotation dans `ActivityEvent`, avec seulement des métadonnées bornées : identifiant de
   clause, index d'ancre et champs modifiés. Aucun texte juridique, rationale ou evidence span.
3. Ne pas émettre un second événement lors du rejeu idempotent d'un `client_op_id`.
4. Couvrir les écritures unitaires, batch, upsert, changement de primaire et frontière.
5. Exclure les membres `reviewer` de l'endpoint `annotators-progress`.

### Lot B — CI et build reproductibles

1. Réaligner tous les chemins GitHub Actions sur la racine actuelle.
2. Standardiser la CI frontend sur `npm ci` et le cache `package-lock.json`.
3. Ajouter des Dockerfiles minimaux et reproductibles pour le backend et le frontend.
4. Ajouter un contrôle statique automatisé garantissant que les chemins CI et contextes Docker
   existent réellement.

### Lot C — déploiement sûr

1. Faire échouer le déploiement si le venv ou les dépendances frontend manquent.
2. Refuser un worktree sale et une branche hors allowlist, avec override explicite si nécessaire.
3. Capturer le SHA testé et pousser/déployer ce SHA.
4. Vérifier API et frontend après redémarrage ; garder un smoke WebSocket documenté lorsque la
   fonctionnalité le nécessite.
5. Refuser par défaut une migration non rétrocompatible : appliquer une stratégie expand/contract et
   sauvegarder la DB avant toute migration à risque. Le script ne peut pas promettre un rollback DB
   générique.

### Lot D — insights avancés, différé

Les changements de sémantique des écrans `insights` et les nouveaux KPI nécessitent les choix produit
du commanditaire : grain, rôles, anonymisation et finalité. Ils ne seront pas inventés dans ce lot.
L'audit doit seulement rendre explicite cette dette et fournir le journal nécessaire à la suite.

## 3. Critères d'acceptation

| ID | Critère vérifiable |
|---|---|
| AC-01 | Une création de clause produit exactement un `clause.added`. |
| AC-02 | Un retry idempotent ne produit aucun événement supplémentaire. |
| AC-03 | PATCH, swap primaire et frontière produisent `clause.updated`. |
| AC-04 | DELETE produit `clause.deleted` et l'événement survit à la suppression de la clause. |
| AC-05 | Un batch produit un événement par clause réellement créée/modifiée, aucun pour un conflit/retry. |
| AC-06 | Les payloads ne contiennent ni texte, ni rationale, ni evidence span. |
| AC-07 | `annotators-progress` ne renvoie que les rôles annotator et lead. |
| AC-08 | Tous les `working-directory` et chemins de lockfile CI existent. |
| AC-09 | `docker build` dispose d'un Dockerfile dans chaque contexte. |
| AC-10 | Le script de déploiement refuse un environnement non testable et un worktree sale. |
| AC-11 | Le script vérifie séparément la santé de l'API et du frontend. |
| AC-12 | `manage.py check`, tests backend ciblés, typecheck/tests frontend et contrôles statiques passent. |

## 4. Stratégie de validation

- pytest API/DB pour AC-01 à AC-07 ;
- test shell statique pour AC-08 à AC-11, sans connexion au VPS ;
- `bash -n`/ShellCheck si disponible pour les scripts ;
- build Docker si Docker est disponible, sinon validation statique explicite ;
- suite ciblée IAA/gold/multi-annotation afin de détecter une régression du socle statistique ;
- mise à jour de ce document avec le résultat réel, pas seulement le résultat attendu.

## 5. Hors périmètre de cette remédiation

- choix des futurs KPI et design de leur écran ;
- classement nominatif des personnes ;
- déploiement, push GitHub ou modification du serveur ;
- migration immédiate vers des snapshots analytics ;
- installation d'une stack Prometheus/Grafana sans besoin mesuré.

## 6. Résultat d'exécution

| ID | État | Résultat |
|---|---|---|
| LAC-STAT-01 | corrigée | Les créations, upserts, batchs, PATCH, changements de primaire, frontières et suppressions produisent des événements bornés dans la transaction. |
| LAC-STAT-02 | corrigée | `annotators-progress` filtre maintenant les rôles `annotator` et `lead`. |
| LAC-STAT-03 | caractérisée | La différence cible/implémentation est documentée ; aucun faux snapshot ou KPI n'a été inventé. |
| LAC-STAT-04 | différée | La sémantique des insights nécessite les choix produit sur le grain et les rôles. |
| LAC-CI-01 | corrigée | Tous les chemins Actions sont relatifs à la racine actuelle. |
| LAC-CI-02 | corrigée | npm + `package-lock.json` sont utilisés dans Actions, Makefile et scripts. |
| LAC-BUILD-01 | corrigée statiquement | Dockerfiles et `.dockerignore` ajoutés ; Compose corrigé. Build Docker non exécuté, moteur Docker absent de la machine. |
| LAC-DEPLOY-01 | corrigée | Le gate échoue si le venv ou les binaires frontend manquent ; `--no-tests` exige `DEPLOY_UNSAFE=1`. |
| LAC-DEPLOY-02 | mitigée explicitement | Les migrations exigent `--allow-migrations` après revue/backup ; le script avertit que le rollback DB n'est pas automatique. |
| LAC-DEPLOY-03 | corrigée | Branche, worktree, SHA testé et SHA distant sont contrôlés. |
| LAC-DEPLOY-04 | corrigée | API et frontend ont deux smokes distincts. |
| LAC-DATA-01 | corrigée localement | Toutes les migrations ont été appliquées à la DB SQLite locale. |

### Validation exécutée

- `manage.py check` : succès ;
- migrations locales : toutes appliquées ;
- Ruff backend complet : succès ;
- pytest backend complet : **432 tests passés** ;
- tests dédiés aux lacunes : création/retry/PATCH/DELETE/batch/upsert/swap/frontière et rôles ;
- typecheck frontend : succès ;
- ESLint frontend : succès sans warning ;
- Vitest frontend complet : **522 tests passés** ;
- couverture frontend : succès, 77,24 % des statements sur le périmètre instrumenté ;
- build Next.js production : succès, 27 pages statiques générées ;
- contrôle statique `scripts/check_repo_integrity.sh` : succès ;
- `git diff --check` et syntaxe shell du déploiement : succès.

### Limites de validation restantes

- GitHub Actions n'a pas été exécuté sur GitHub, car aucun push n'est autorisé dans cette étape ;
- les images Docker n'ont pas été construites localement, aucun moteur Docker/Podman n'étant installé ;
- aucun SSH, déploiement ou smoke de production n'a été lancé ;
- le warning Vite sur son ancienne API CJS reste non bloquant ; il relève d'une montée de version
  ultérieure, pas du socle statistique ;
- les futurs KPI, leur confidentialité et leur interface restent volontairement à spécifier avec le
  commanditaire.
