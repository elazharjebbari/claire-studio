# 12 — Contrat d'API (REST + WebSocket)

Camel-case en sortie/entrée (bridge DRF existant). Détails machine : `openapi-additions.yaml`.

## Versioning (points 2, 6)
- `GET  /annotations/{id}/versions` → `[{ number, name, description, kind, stats,
  createdBy, createdAt, parentVersion }]` (paginé).
- `POST /annotations/{id}/versions` `{ name?, description?, kind }` → crée version +
  snapshot + `ActivityEvent(version.*)`.
- `GET  /annotations/{id}/versions/{n}/diff?against=m` → diff de snapshots.
- `POST /annotations/{id}/versions/{n}/restore` → nouvelle version depuis un snapshot.
- `POST /annotations/{id}/submit` `{ versionName, versionDescription }` (transactionnel :
  crée la version de soumission + passe `submitted`).

## Historique & attribution (points 2, 3, 6)
- `GET /annotations/{id}/activity` → timeline d'événements (filtrable verb/actor/since).
- `GET /documents/{id}/sentence-history?index=N` → timeline d'une phrase.
- `GET /annotations/{id}/attribution?by=sentence|clause` → cible → dernier auteur+verbe.
- `GET /documents/{id}/contributors` → annotateurs + couleurs.

## Commentaires (point 3)
- `GET/POST /annotations/{id}/comments` `{ body, scope, clause?, sentenceIndex?,
  rangeStart?, rangeEnd?, threadRoot? }`.
- `POST /comments/{id}/resolve`.

## Analytics (point 5)
- `GET /projects/{slug}/insights` → KPI + distributions + activité.
- `GET /projects/{slug}/insights/{documentId}` → métriques document + heatmap.

## Collaboration & partage (points 4b, 7)
- `GET  /annotations/{id}/collab-ticket` → `{ ticket, expiresAt }` (ticket WS signé court).
- `POST /projects/{slug}/share-links` `{ roleGranted, expiresAt, maxUses? }` → `{ token, url }`.
- `GET  /projects/{slug}/share-links` ; `POST /share-links/{id}/revoke`.
- `POST /join/{token}` → crée/active la membership (utilisateur authentifié requis).

## Config admin (console)
- `GET /config/flags` → feature flags effectifs (UI s'y conforme).
- `GET/PATCH /projects/{slug}/members` ; rôles & couleurs.

## WebSocket
- `WS /ws/annotations/{id}/?ticket=…`
  - **client→serveur** : `yjs-update` (binaire), `awareness` (présence/curseur), `ping`.
  - **serveur→client** : `yjs-update` (broadcast), `awareness`, `presence` (join/leave),
    `conflict` (édition concurrente du même champ).
  - Auth : ticket signé vérifié à la connexion ; membership vérifiée à chaque écriture.
  - Idempotence : `clientOpId` par opération.

## Conventions transverses
- Pagination enveloppée `{ count, next, previous, results }`.
- Idempotence des écritures via `clientOpId` (entête ou corps).
- Erreurs : 401 (auth), 403 (rôle/membership), 409 (conflit verrou optimiste), 410
  (lien expiré/révoqué), 429 (débit).
