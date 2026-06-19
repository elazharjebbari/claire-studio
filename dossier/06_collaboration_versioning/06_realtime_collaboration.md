# 06 — Collaboration temps réel : conflits & partage (points 4b & 7)

## Comparatif des approches (rappel de décision)

| Approche | Forces | Faiblesses | Verdict |
|---|---|---|---|
| **Channels + WS + CRDT (Yjs)** | vrai temps réel, présence/curseurs, fusion sans conflit destructif, offline-friendly | infra (Redis/ASGI), courbe d'apprentissage | **RETENU** |
| Polling + verrous optimistes | simple, sans infra WS | pas de présence live, latence, contention sur verrous | repli |
| SSE + verrous par section | léger, push serveur | unidirectionnel, pas d'awareness native | non retenu |

## Modèle CRDT

`Y.Doc` par annotation :
- `clauses: Y.Map<anchorIndex(string), Y.Map>` ; chaque clause = `Y.Map` de champs
  (`theme`, `legal_nature`, `evidence_span`, `rationale`, `certainty`, `resolvedFrom`).
- L'édition concurrente de **clauses différentes** fusionne sans conflit. L'édition
  concurrente du **même champ** suit le *last-writer-wins* Yjs (déterministe), tout en
  laissant une trace (`ActivityEvent`) pour audit/arbitrage humain a posteriori.
- **Awareness** : `{ userId, name, color, focusSentence, selection }` → présence +
  curseurs distants.

Le store Zustand **s'abonne** au `Y.Doc` (observer → set) quand le collaboratif est ON ;
en OFF, le store fonctionne seul (chemin solo inchangé). Binding encapsulé dans un
adaptateur `collabBinding.ts` (aucune fuite de Yjs dans les composants).

## Boucle réseau (voir `collab-sequence.puml`)

1. Ouverture du document → `GET /annotations/{id}/collab-ticket` (JWT requis) renvoie un
   **ticket signé court**.
2. Connexion `WS /ws/annotations/{id}/?ticket=…` ; le consumer vérifie le ticket +
   membership, rejoint le groupe `annotation.{id}`, émet `collab.join`.
3. Échange d'updates Yjs (binaire) + awareness via le groupe (channel layer Redis).
4. Le consumer **snapshote** le `Y.Doc` (debounce 2–5 s + à la soumission) → Postgres,
   et écrit les `ActivityEvent` sémantiques (pas chaque keystroke).
5. Déconnexion → `collab.leave` ; la `CollaborationSession` est clôturée quand la salle
   se vide.

## Gestion des conflits

- **Structurelle** : CRDT (pas de conflit destructif sur des clauses/champs distincts).
- **Sémantique** (deux personnes re-thématisent la même clause) : LWW déterministe +
  **voyant de conflit** (« Alice et Bruno ont édité ce thème ») proposant d'ouvrir
  l'historique de la phrase pour arbitrer. On n'écrase jamais silencieusement *sans
  trace*.
- **Verrou doux optionnel** (flag) : un éditeur peut « prendre la main » sur une clause
  (lock consultatif Redis TTL) pour signaler qu'il y travaille ; non bloquant.

## Lien de partage (point 4b)

- `POST /projects/{slug}/share-links` `{ role_granted, expires_at, max_uses }` (owner) →
  jeton **HMAC signé**.
- Ouverture `/<app>/join/{token}` : l'utilisateur **doit être authentifié** ; à
  l'acceptation, on crée/active sa `Membership` (rôle accordé), on consomme le quota,
  on émet `share.consume`. **Aucun accès anonyme** aux données.
- Révocation (`revoked=true`) et expiration vérifiées à chaque usage.

## Sécurité & résilience
- Ticket WS court (≠ JWT dans l'URL) ; vérif membership à chaque message d'écriture.
- Idempotence via `client_op_id`. Reprise après coupure : resynchro Yjs (state vector).
- Limite de débit par socket ; taille d'update plafonnée ; back-pressure.
- Dégradation : WS KO → bandeau « hors-ligne, vos modifications seront synchronisées » +
  écriture REST optimiste, resynchro au retour.
