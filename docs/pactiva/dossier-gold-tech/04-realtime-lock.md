# Verrou d'arbitrage temps réel (DB source de vérité + diffusion WS)
- **Verrou** porté par `GoldResolution.locked/_by/_at/lock_expires_at` (durable, partagé multi-worker).
- Endpoints (calqués sur annotations lock/unlock) : `POST gold/{docId}/lock:acquire` (select_for_update + si `now>expires` réattribue), `:heartbeat` (prolonge), `:release`, `:steal` (lead/reviewer → ArbitrationEvent verb=override). **Lease 90s, heartbeat 20s.**
- **Front** : `useArbitrationLock` (heartbeat setInterval 20s ; `beforeunload`→`sendBeacon(release)` ; inactivité ~60s → stoppe heartbeat → expiration serveur naturelle).
- **Diffusion** : étendre `PresenceConsumer` d'un handler `lock` → `group_send {lock.update, holder, expiresAt}` (group `gold_{slug}`) ; repli polling REST si WS off. Réutilise `ws_auth.JWTAuthMiddleware`.
- **UI** : bandeau « Arbitré par X » (user_color), read-only si tenu par autre, bouton « Reprendre » (steal) lead/reviewer. data-testids : `gold-lock-banner`, `gold-lock-acquire`, `gold-lock-steal`, `gold-arbitration-note`.
- **Prérequis prod (signalé)** : temps réel multi-worker = activer `CHANNELS_USE_REDIS=true` + `REDIS_URL` + CACHES Redis ; le verrou reste correct sans Redis (vérité DB).
