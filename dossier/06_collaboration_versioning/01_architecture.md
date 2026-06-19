# 01 — Architecture cible

## Vue d'ensemble

```
Navigateur (Next.js 14, App Router, TS strict)
  ├─ UI workspace (DocumentPanel, Inspector, Toc, ComparePanel…)
  ├─ State local : Zustand (édition temps réel, pile undo/redo, action log)
  ├─ Données serveur : React Query (REST) + cache
  ├─ Temps réel : client WebSocket (présence, patches CRDT, commentaires live)
  └─ CRDT : Yjs (Y.Doc par annotation) ↔ y-websocket provider
        │
        │  REST (CRUD, versions, exports, analytics)         WS (collab)
        ▼                                                     ▼
Backend (Django 5.1 + DRF + SimpleJWT)            ASGI (Django Channels + Daphne/Uvicorn)
  ├─ apps: corpora, annotations, imports,           ├─ Consumer AnnotationRoom
  │        comments, reviews, translations,         │    (présence, broadcast patches,
  │        activity (audit), accounts, projects     │     persistance périodique du Y.Doc)
  ├─ Versioning : AnnotationVersion + snapshots     ├─ Channel layer : Redis
  ├─ Audit immuable : ActivityEvent (append-only)   └─ Auth WS : JWT court + ticket signé
  └─ Analytics : agrégats matérialisés (vues SQL)
        │
        ▼
Postgres (prod) / SQLite (dev)   +   Redis (channel layer, presence, locks)
        │
        ▼
MLflow (RGPD-safe) pour le suivi d'expériences (inchangé)
```

Voir `architecture.puml` pour le diagramme de composants.

## Choix structurants

### Temps réel — Django Channels + WebSockets + CRDT (décision)

- **Transport** : WebSocket via **Django Channels** (ASGI), *channel layer* **Redis**.
- **Édition concurrente** : **CRDT** (Yjs `Y.Doc` par annotation). Les clauses, ancres
  et champs (thème, certitude, evidence, rationale) sont stockés dans des structures
  Yjs (`Y.Map`/`Y.Array`) → fusion automatique sans conflit destructif.
- **Présence & curseurs** : Yjs *awareness* (qui est là, quelle phrase il regarde,
  couleur d'utilisateur) diffusé via le même socket.
- **Persistance** : le consumer applique les updates au `Y.Doc` serveur et **snapshote**
  périodiquement (debounce 2–5 s + à la soumission) vers Postgres ; l'audit
  (`ActivityEvent`) est écrit à chaque opération sémantique (pas à chaque keystroke).
- **Repli** : si le WS est indisponible, l'éditeur reste fonctionnel en **REST +
  verrou optimiste** (champ `version` par clause → 409 sur conflit) ; resynchro au
  retour du socket. La couche métier ne dépend pas du transport.

Alternatives écartées (cf. `06_realtime_collaboration.md` §Comparatif) : polling +
verrous (pas de vrai temps réel) ; SSE (unidirectionnel, pas d'awareness native).

### Frontière state local / serveur

- **Zustand** = vérité d'interaction instantanée (focus, sélection, brouillon, pile
  undo/redo, journal d'actions) — déjà en place.
- **React Query** = lecture/écriture REST (documents, versions, commentaires, reviews,
  analytics) avec invalidations ciblées.
- **Yjs** = état partagé d'édition lorsque le mode collaboratif est actif ; le store
  Zustand se *bind* au `Y.Doc` (observer → set) plutôt que de dupliquer la logique.

### Sécurité

- JWT (SimpleJWT) pour REST. Pour le WS : **ticket signé court** délivré par un
  endpoint REST authentifié, présenté à la connexion (évite d'exposer le JWT dans l'URL).
- **Liens de partage** : jeton signé (HMAC) expirable + scope projet + rôle ; à
  l'ouverture, l'utilisateur **authentifié** rejoint le projet (membership) — le lien
  n'octroie jamais d'accès anonyme aux données.
- Audit **append-only** (pas d'UPDATE/DELETE sur `ActivityEvent`).

## Qualité de service

- **Optimisme + idempotence** : chaque mutation porte un `client_op_id` ; rejouée sans
  effet de bord. Réconciliation par CRDT.
- **Observabilité** : logs structurés, métriques (latence WS, taille des updates,
  conflits), traces des snapshots.
- **Dégradation gracieuse** : collaboratif OFF → mono-utilisateur identique à
  aujourd'hui. Aucune régression du chemin solo.
