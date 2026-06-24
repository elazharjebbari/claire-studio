# Lacunes du socle à combler
- Couche prefs **PAR DOCUMENT** absente (aujourd'hui par compte) → ajouter `perDoc[documentId]` dans `ui_preferences`.
- Verrou partagé multi-worker : la présence utilise LocMemCache ; le **verrou d'arbitrage doit être DB-source-de-vérité** (durable, partagé) — le WS ne fait que diffuser.
- `freezegun` (tests d'expiration de verrou) absent des deps de test.
- Hex en dur dans `ComparePanel.STATUS_COLOR` → migrer vers tokens sémantiques.
- Factories `PreAnnotation`/`PreClause` absentes du conftest (à ajouter pour les scénarios multi-comptes).
