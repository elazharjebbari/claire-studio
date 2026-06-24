# Risques & parades
- **Duplication du moteur multi-label** → réutiliser triage/rules.py (clusters/precedence/reliability), ne créer que l'électorat pondéré.
- **Verrou orphelin / course** → verrou DB + lease TTL + heartbeat + release (beforeunload/sendBeacon) + steal tracé ; tests freezegun.
- **Perte/corruption du gold** → GoldSentence matérialisé + GoldRun snapshot + simulation à réconciliation (12 seeds) + export == référence.
- **Temps réel sans Redis en prod** → verrou correct (DB) sans Redis ; signaler l'activation Redis pour la diffusion multi-worker.
- **Régression export annotateurs** → branche `scope.gold` isolée ; bloc `arbitration` additif testé absent des snapshots humains.
- **Hex en dur (ComparePanel)** → migrer vers tokens sémantiques (charte).
- **Divergence parité TS/PY** → golden partagé étendu (électorat mixte) + test_*_parity.
