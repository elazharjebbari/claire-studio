# Operations — exploitation CLAIRE Studio

> Procédures d'exploitation pour le MVP : migrations, backup/restore DB, reset, logs,
> diagnostic. Toutes les commandes s'appuient sur le `Makefile` racine, `docker-compose.yml`
> et les scripts `scripts/*.sh`. Voir aussi `RUNBOOK.md` (démarrage) et `seeding.md` (seed).

## 1. Migrations de base de données

CLAIRE est **DB-centrique** : les invariants durs (CONTRACT §2) sont garantis par contraintes.
Toute évolution de schéma passe par une migration Django versionnée.

```bash
# Générer une migration (côté backend, par l'agent backend ; documenté ici pour l'exploitation)
cd backend && make makemigrations        # (si exposé) génère les fichiers de migration
make migrate                              # applique les migrations (délègue à backend/)
```

Bonnes pratiques d'exploitation :
- **Toujours** lancer `make migrate` après un pull qui ajoute des migrations.
- Sauvegarder la DB **avant** une migration en production (cf. §3).
- Les migrations qui touchent un invariant dur doivent être accompagnées d'un test dédié
  (cf. `testing_strategy.md §2.1`).
- Ne jamais éditer une migration déjà appliquée en CI/prod : créer une migration corrective.

## 2. États des services (Docker Compose)

```bash
docker compose ps                  # état + healthchecks
docker compose up -d postgres      # Postgres seul (mode dev local)
docker compose up -d               # toute la pile
docker compose restart backend     # redémarrer un service
docker compose stop                # arrêt sans suppression
docker compose down                # arrêt + suppression conteneurs (volumes conservés)
docker compose down -v             # + suppression du volume Postgres (RESET DONNÉES)
```

Healthchecks : `postgres` (pg_isready), `backend` (`GET /api/v1/` ou `/healthz`), `frontend`
(`GET /`). Les dépendances `depends_on: condition: service_healthy` garantissent l'ordre de
démarrage.

## 3. Backup & restauration de la base

### Backup

```bash
# Dump logique (recommandé) — via le conteneur postgres
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > backups/claire_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restauration

```bash
gunzip -c backups/claire_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

> Convention : stocker les dumps hors Git (`backups/` gitignoré). Aucune donnée personnelle ne
> doit figurer dans des logs/artefacts (Q-SEC-02) ; un dump DB est une donnée sensible — chiffrer
> au repos en production.

## 4. Reset de l'environnement

| Niveau | Commande | Effet |
|---|---|---|
| Soft (re-seed) | `make seed` | ré-applique le seed (idempotent), ne détruit pas la DB |
| Schéma propre | `make migrate` après `down -v` + `up -d postgres` | DB vierge re-migrée |
| Reset total | `docker compose down -v && make migrate && make seed` | **perte totale**, état neuf reproductible |
| Reset workspace | `make clean` | caches, node_modules, .venv, artefacts de test |

## 5. Logs & observabilité

```bash
docker compose logs -f backend          # logs applicatifs backend
docker compose logs -f frontend         # logs Next.js
docker compose logs -f postgres         # logs DB
make logs                               # (cible agrégée) suit tous les services
```

Diagnostic (Q-DEB-01) : chaque requête porte un `request_id` et un `trace_id` corrélés entre
logs et traces. Pour suivre une requête de bout en bout, filtrer sur le `request_id` retourné
dans l'en-tête de réponse.

Règle PII (Q-SEC-02) : le `PIIScrubber` retire email/nom/token/contenu des logs, metrics et
traces. Ne jamais désactiver le scrubber en production ; ne jamais logguer le contenu textuel
des phrases/clauses.

## 6. Exploitation des jobs d'export (F5)

- Les exports sont des `ExportJob` asynchrones (statut `pending|running|done|failed`).
- Throttling + concurrence bornée par projet (Q-OPT-03) : surveiller la file ; un pic d'exports
  ne doit pas saturer les workers.
- Artefacts stockés sous un chemin contrôlé (`artifact_path`) ; purge périodique conseillée.
- Exports comparatifs/IAA : `anonymize=true` par défaut (Q-SEC-04) — ne pas désactiver sans
  justification.

## 7. Rotation des secrets

- `DJANGO_SECRET_KEY` / `JWT_SIGNING_KEY` : la rotation invalide les sessions/tokens en cours
  (re-login requis). Planifier hors heures de pointe.
- Stocker les secrets de production hors `.env` versionnable (gestionnaire de secrets).
  `.env.example` ne contient **que** des placeholders.

## 8. Check de santé rapide

```bash
curl -fsS http://localhost:8000/api/v1/ >/dev/null && echo "backend OK"
curl -fsS http://localhost:3000/ >/dev/null && echo "frontend OK"
docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" && echo "db OK"
```
