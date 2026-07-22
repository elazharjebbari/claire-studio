# Contrats API

## Endpoints recommandés

```text
GET  /api/v1/projects/{slug}/analysis/catalog
POST /api/v1/projects/{slug}/analysis/scopes/preview
POST /api/v1/projects/{slug}/analysis/runs
GET  /api/v1/projects/{slug}/analysis/runs/{uuid}
POST /api/v1/projects/{slug}/analysis/runs/{uuid}/cancel
GET  /api/v1/projects/{slug}/analysis/runs/{uuid}/cases
GET  /api/v1/projects/{slug}/analysis/runs/{uuid}/visualizations/{code}
GET  /api/v1/projects/{slug}/analysis/presets
POST /api/v1/projects/{slug}/analysis/presets
PATCH/DELETE /api/v1/projects/{slug}/analysis/presets/{uuid}
POST /api/v1/projects/{slug}/analysis/reports
GET  /api/v1/projects/{slug}/analysis/reports/{uuid}
GET  /api/v1/projects/{slug}/analysis/reports/{uuid}/download
```

Les pages overview/quality/etc. composent ces ressources ; éviter dix endpoints qui recalculent
chacun le même périmètre.

## Création d’un run

```json
{
  "contractVersion": 1,
  "mode": "inter_human",
  "unit": "sentence",
  "actors": [
    { "type": "human", "id": "17" },
    { "type": "human", "id": "24" }
  ],
  "filters": { "statuses": ["submitted", "in_review", "approved"] },
  "metrics": [{ "code": "cohen_kappa", "version": "1" }],
  "idempotencyKey": "client-generated-uuid"
}
```

Réponse `202` pour un job ou `200` pour un cache hit, avec le même schéma de run.

## Enveloppe de résultat

```json
{
  "meta": {
    "contractVersion": 1,
    "analysisRunId": "uuid",
    "status": "succeeded",
    "computedAt": "2026-07-22T09:00:00Z",
    "fingerprint": "sha256:...",
    "support": {
      "documents": 18,
      "eligibleUnits": 5100,
      "includedUnits": 4820,
      "actors": 2
    },
    "filters": {},
    "metricVersions": { "cohen_kappa": "1" },
    "warnings": []
  },
  "summary": {},
  "visualizations": [],
  "links": { "cases": "...", "manifest": "..." }
}
```

## Contrat de visualisation

```json
{
  "code": "agreement_by_theme",
  "title": "Sur quels thèmes l’accord est-il fragile ?",
  "dimensions": [{ "key": "theme", "label": "Thème", "type": "category" }],
  "measures": [{ "key": "kappa", "label": "κ", "type": "number" }],
  "recommendedVisualization": "horizontal_bar",
  "rows": [{ "theme": "TERMINATION", "kappa": 0.62, "support": 186 }],
  "table": { "defaultSort": [{ "key": "kappa", "direction": "asc" }] },
  "drilldown": { "dimensionKeys": ["theme"] }
}
```

## Erreurs stables

Envelope RFC 9457 `application/problem+json` avec `type`, `title`, `status`, `code`, `detail`,
`requestId` et erreurs de champs. Codes : `invalid_scope`, `incompatible_metric`,
`insufficient_support`, `no_actor_overlap`, `run_stale`, `run_conflict`, `run_failed`,
`permission_denied`, `artifact_expired`. Aucun détail interne, SQL, chemin ou texte contractuel.

## Versioning

Version majeure dans le chemin uniquement en cas de rupture globale (`/api/v2`). Les DTO incluent
`contractVersion`; les métriques ont leur version indépendante. Ajouter un champ est compatible ;
changer son sens ne l’est pas. Des tests de contrat figent exemples et compatibilité camelCase.
