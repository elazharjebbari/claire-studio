# Plan de tests (risque-d'abord + pyramide + golden-paths)
## Backend (pytest)
- **gold_scoring.py PUR** : human>LLM, départage (llm.role), **humain≠LLM = signal fort**, accord absolu→auto_1click, seuils de risque (auto/manuel), secondaires (≥2 annotateurs), bornes confidence [0,1].
- **property-based (hypothesis)** : monotonie (un vote concordant ne baisse jamais le score), invariance par permutation des annotateurs, idempotence du recompute, dominance humain>LLM, pondérations aléatoires.
- **fixtures multi-comptes** : `PreAnnotationFactory`/`PreClauseFactory` (à ajouter) + `gold_campaign` seedant **3 annotateurs réels (claude/codex/mistral)** annotations DIVERGENTES contrôlées + PreAnnotation par juge, primaire+secondaires.
- **simulation à réconciliation** (patron test_campaign_simulation) : 12 seeds, modèle de référence gold réconcilié à chaque pas ; vérifie statuts/%/historique et `export == référence`.
- **temps réel** (freezegun + WebsocketCommunicator) : verrou EXCLUSIF (2ᵉ arbitre refusé), auto-expiration (freeze_time), libération au disconnect, course 2 arbitres.
- **permissions/étanchéité** : matrice rôles (annotator ne peut arbitrer ; reviewer/lead selon config ; partage on/off) + 423 sur écriture verrouillée/résolue.
- **export** : scope `gold` intermédiaire vs final, gating download, multi-label, bloc `arbitration` purement additif (build_snapshot humain ne le contient jamais).
## Frontend
- **vitest purs** : `goldScoring.ts` (parité EXACTE backend), regroupement blocs d'accord, multi-label primaire+secondaires ; `divergence` recâblée inter-annotateurs.
- **MSW** : endpoints gold (liste/lock/decide/stats/export), fixtures 3 juges + 3 annotateurs.
- **composants** : navigation conflit↔conflit ET bloc↔bloc, clic successif sous le curseur, data-testids stables.
- **e2e playwright** (3-4 golden-paths) : (1) arbitrage bootstrap→export ; (2) verrou exclusif visible ; (3) gating export gold ; (4) a11y.
## Comptes de test
Créer/réutiliser comptes **claude/codex/mistral** avec leurs annotations pour jouer des scénarios de résolution réalistes (accord absolu, majorité, divergence, humain≠LLM).
