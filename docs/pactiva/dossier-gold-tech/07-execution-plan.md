# Plan d'exécution (phasé)
- **V1 — Fondation (CE LOT)** : moteur `gold_scoring.py` PUR + miroir `goldScoring.ts` + golden partagé + tests pytest/vitest (unit + property-based + scénarios). Schéma `ResolutionConfig` (front + validation back) + preset « confiance annotateurs ». Aucune migration risquée ; déployable.
- **V2 — Modèles & data** : app `claire/gold/` (GoldResolution/GoldSentence/GoldRun/ArbitrationEvent) + migration + orchestration (construire les votes depuis Annotation/PreAnnotation via _theme_vector / _judge_vector) + recompute async (ExportJob). Endpoints `gold/documents`, `gold/{doc}`, `decide`, `auto-resolve`. Tests + simulation.
- **V3 — Verrou temps réel** : GoldLock (lease) + endpoints lock:* + extension PresenceConsumer + `useArbitrationLock`. Tests WS (freezegun).
- **V4 — Cockpit** : `/gold` (KPIs + table virtualisée role=grid + filtres/tri/lots + GoldBatchBar) ; prefs cockpit par compte. e2e.
- **V5 — Atelier de résolution** : `/gold/[documentId]` (ResizablePanels, ConflictTocPanel/partition, ResolutionPanel carte de vote, navigation conflit/bloc, sticky-cursor, mode focus) ; bus d'interaction ; prefs par document. e2e + composants.
- **V6 — Stats & Export** : onglet stats (matrices + proximité gold) ; export gold (scope.gold + bloc arbitration). 
- **V7 — Studio de config** : section admin (PresetPicker + progressive-disclosure) ; gel via verrou projet.
- Gate (pytest+tsc+vitest) + déploiement à chaque lot ; e2e ciblés.
