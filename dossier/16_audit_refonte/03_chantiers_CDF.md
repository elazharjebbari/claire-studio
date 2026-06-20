# Chantiers C, F, D — réalisés (suite autonome)

> Branche `refonte/vague1-derigidification`. Tout vert : pytest 99/99 · tsc 0 ·
> Vitest 112/112 · e2e 68/68 · `next build` OK. Port frontend par défaut = **3001**.

## Port 3001 par défaut
Pour éviter les collisions (un autre projet occupait 3000) : `next dev -p 3001`,
Playwright, scripts (dev_all/e2e/run_real/dev_up/ports.env), docker-compose, CORS +
FRONTEND_BASE_URL backend. Surchargeable via `FRONTEND_PORT`. CORS tolère encore 3000.

## Chantier C — fiabilité de l'enregistrement
- **Idempotence** : `Clause.client_op_id` (migration additive) ; un retry réseau
  portant le même op retombe sur la clause existante (200), pas de doublon.
- **Auto-save** : `lib/autosave.planClauseSync` (diff PUR par ancre → create/update/
  delete) + hook `useAutosave` (debounce 1.2 s, écriture optimiste, MAJ incrémentale
  du snapshot, idempotence via client_op_id, reprise `online`, convergence).
- **Indicateur d'état** dans la barre d'outils (enregistrement / enregistré /
  hors-ligne / erreur), store dédié `store/autosave`.
- Tests : idempotence backend (3), diff Vitest (5), e2e « enregistré » après édition.

## Chantier F — publication de projet
- `Project.visibility` (private/public, **privé par défaut** — RGPD). Migration additive.
- Endpoints publics lecture seule, sans auth : `GET /public/projects`,
  `GET /public/projects/{slug}` (KPI + distribution de thèmes). Privé ≡ inexistant (404).
- Front : `/public` + `/public/[slug]` (agrégats), toggle Publier/Dépublier (admin),
  liens « Projets publiés » (landing + Sidebar). Tests : 6 backend + e2e.

## Chantier D — collaboration : liens de partage persistés
- **ShareLink** persisté (migration additive) : token, rôle, créateur, expiration,
  quota (max_uses/used_count), révocation. Endpoints : create/list (admin), revoke,
  et `POST /share-links/{token}/join` — l'invité rejoint via son compte **authentifié**
  (jamais anonyme), refus si révoqué/expiré/épuisé, quota décompté à la 1re adhésion.
- Front : page `/join/[token]` (jonction + redirection, ou /login?next= si non
  connecté). Tests : 8 backend.

### Temps réel (présence WebSocket) — LIVRÉ
- Backend : **Channels** + ASGI `ProtocolTypeRouter` (HTTP + WS), auth **JWT WS**
  (token en query string, jamais anonyme), `PresenceConsumer` par annotation
  diffusant le roster (présents + focus) → **présence multi-utilisateur réelle**.
  Couche InMemory en dev/test, Redis en prod (`CHANNELS_USE_REDIS`). 3 tests
  (`WebsocketCommunicator` + shim daphne).
- Front : `createWebSocketCollab` (client WS réel) + `useLivePresence` (WS si
  flag+`NEXT_PUBLIC_WS_URL`, sinon repli REST) ; `CollabBar` consomme la même forme.
- **CRDT : N/A** — les annotations sont mono-propriétaire (INV-4), donc pas de
  co-édition concurrente d'une même annotation ; le temps réel = présence/awareness
  (+ liens de partage pour inviter). Serveur ASGI = daphne/uvicorn (prod).

## Reste
- Servir l'ASGI en prod (daphne/uvicorn) + Redis pour la couche Channels multi-workers
  (config prête via `CHANNELS_USE_REDIS`) ; daphne non installable dans cet env de dev
  (deps natives) — la présence est testée via InMemory.
- Mineurs : invitations par e-mail (recoupe E/F), curseurs intra-document plus fins,
  dette lint ruff préexistante (~111), nettoyage e2e zombies (kill `next dev` résiduels).
