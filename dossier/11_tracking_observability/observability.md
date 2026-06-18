# Observabilité (logs, métriques, traces, alerting)

> Périmètre : tracking/observabilité **technique**, distincte de l'audit produit
> (`tracking.md`, `activity_feed.md`). Cible : exploitabilité, débogabilité, fiabilité (qualités
> CONTRACT §6, déclinées dans `14_plans/quality_requirements.csv`).

## 1. Les trois piliers

| Pilier | Outil | Usage |
|---|---|---|
| Logs structurés | JSON (stdlib `logging` + `structlog`), agrégés (Loki/ELK) | déboguer, tracer une requête |
| Métriques | Prometheus (`/metrics`), Grafana | tendances, SLO, alerting |
| Traces | OpenTelemetry (OTLP) → Tempo/Jaeger | latence bout-en-bout, requêtes lentes |

Backend Django/DRF + workers (exports, sync traductions, imports) instrumentés uniformément.

## 2. Logs structurés

Format **JSON** une-ligne, champs normalisés pour corrélation :

```json
{"ts": "2026-06-18T11:00:00.123Z", "level": "INFO", "logger": "annotations.views",
 "event": "annotation.submitted", "request_id": "req_8f2a", "trace_id": "…",
 "user_pseudo": "A", "project": "claudette-gold-v1", "annotation_id": 102,
 "duration_ms": 42, "status_code": 200}
```

Règles :

- **`request_id`** propagé (header `X-Request-ID` ou généré) ; **`trace_id`** issu d'OTel — un log se
  relie à sa trace.
- **Pas de PII** dans les logs : on logge `user_pseudo` (pseudonyme), jamais email/nom ; pas de
  `evidence_span`/contenu de clause ; pas de token. Filtre de log dédié (`PIIScrubber`) en garde-fou.
- Niveaux : `DEBUG` (dev), `INFO` (transactions), `WARNING` (dégradations), `ERROR` (échecs),
  `CRITICAL` (indispo). Erreurs non gérées → Sentry (sans PII) avec `request_id`.
- Les **événements métier** restent dans `ActivityEvent` (DB) ; les logs en sont le miroir technique
  corrélable, pas la source produit.

## 3. Métriques Prometheus

Exposées sur `/metrics` (scrape interne, non public). Familles (détail typé dans `metrics_catalog.csv`) :

- **RED** (par endpoint) : `http_requests_total{method,route,status}`,
  `http_request_duration_seconds` (histogramme), `http_requests_errors_total`.
- **Worker/jobs** : `export_jobs_total{format,status}`, `export_job_duration_seconds`,
  `translation_sync_total{status}`, `preannotation_import_total{schema_version,status}`.
- **DB** : `db_query_duration_seconds`, `db_connections_in_use` (détection N+1, saturation pool).
- **Domaine** (techniques, pas produit) : `annotations_active_gauge`, `queue_depth` (jobs en attente).
- **Process** : CPU, mémoire, GC (exporter standard).

Conventions : noms `snake_case`, unités SI suffixées (`_seconds`, `_bytes`, `_total`), labels à
**faible cardinalité** (jamais d'id utilisateur/annotation en label — explosion de cardinalité +
fuite). Les routes sont **templatisées** (`/annotations/{id}` pas l'id réel).

## 4. Traces distribuées

- Instrumentation OTel auto (Django, DRF, requests, psycopg) + spans manuels sur les étapes lourdes
  (génération d'export par format, sync traduction, normalisation pré-annotation).
- Chaque span porte `project`, `user_pseudo`, `request_id` ; le contenu sensible est exclu des
  attributs.
- Échantillonnage : 100 % des erreurs, taux configurable sur le succès (défaut 10 %) pour le coût.

## 5. Dashboards (Grafana)

- **API Health** : RED par route, taux d'erreur, p50/p95/p99 latence, codes 4xx/5xx.
- **Pipeline qualité (technique)** : durée/échec des exports, sync traductions, imports
  pré-annotations.
- **Ressources** : CPU/mémoire/DB pool/queue depth.
- **Corrélation** : liens log↔trace via `trace_id` (Grafana Loki↔Tempo).

> Les dashboards **produit** (vélocité, IAA, certitude) relèvent du tracking
> (`tracking.md`/`metrics_catalog.csv`), pas de l'observabilité technique — séparation nette.

## 6. Alerting (SLO-driven)

Alertes Prometheus/Alertmanager sur objectifs de service :

| Alerte | Condition | Sévérité |
|---|---|---|
| API error budget | taux 5xx > 1 % sur 5 min | page |
| Latence API | p95 `http_request_duration_seconds` > 800 ms 10 min | warning |
| Export en échec | `export_jobs_total{status="failed"}` en hausse | warning |
| Queue saturée | `queue_depth` > seuil 15 min | warning |
| DB pool saturé | `db_connections_in_use / max` > 0.9 5 min | page |
| Authn anormale | pic d'échecs login (cf. `12_security/security.md` rate limiting) | page |

Chaque alerte renvoie au dashboard et au runbook correspondant (débogabilité : on sait où regarder).

## 7. Garanties (qualité)

- **Débogable** : `request_id` + `trace_id` partout, log↔trace corrélés, runbooks d'alerte.
- **Sans PII** : pseudonymisation et scrubbing systématiques, jamais de contenu de clause en
  log/metric/trace (cohérent RGPD, `12_security/rgpd_dpia.md`).
- **Faible cardinalité** : labels contrôlés, routes templatisées.

## 8. Tests (CONTRACT §6)

- `pytest logging_pii` : `PIIScrubber` retire email/nom/token/contenu ; `request_id` présent.
- `pytest metrics_cardinality` : aucun label à cardinalité non bornée ; routes templatisées.
- `pytest tracing` : `trace_id` propagé et présent dans les logs corrélés.
