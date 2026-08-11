# Plan de développement — lots priorisés

> Priorisation par impact/risque, pas par ordre chronologique arbitraire. **Lot 0
> exécuté dans cette session** (voir `11_RUNBOOK_SONNET5.md` pour le journal réel).
> Lots 1+ documentés pour une exécution future, quand un compte Grid'5000 existera.

---

## Lot 0 — correctifs et fondations (exécuté cette session, sans compte G5K requis)

Tout ce qui peut être implémenté et **vérifié réellement** sans identifiants Grid'5000 :

1. **`ComputeCredential.ssh_key_encrypted`** (migration Django) + endpoints
   `PUT`/`GET /me/compute-credentials` étendus (accepte/masque la clé SSH comme le mot
   de passe).
2. **`g5k_ssh.py`** : gestion de fichier de clé temporaire (0600, suppression garantie).
3. **`g5k_reference.py`** : fonction pure `gpu_clusters_for(min_vram_gb, catalogue)` —
   testée contre une fixture réelle (`specs/g5k-clusters-gpu-sample.json`, extraite du
   miroir public du reference-repository, données réelles de vrais nœuds GPU).
4. **Migration du client HTTP** vers `python-grid5000` (`g5k_client.py`), avec
   `test_connection()` retournant désormais `(apiOk, sshOk, detail)`.
5. **Garde-fou sweep GPU** (`services.py`) : refuse un sweep GPU > seuil sans
   confirmation explicite.
6. **Correction du contenu factuellement erroné** de `docs/pactiva-lab/06_GRID5000.md`
   (marqué déprécié, pointe vers ce dossier).
7. **Tests** : unitaires pour toutes les fonctions pures ; tests HTTP mockés pour le
   client G5K (comportement conforme à `research/03_API_REST.md`, pas de suppositions) ;
   **un test réel non-destructif** contre le miroir public GitHub du
   reference-repository (aucune authentification requise, aucune réservation).

## Lot 1 — écran « Nouvelle expérience » enrichi (nécessite un compte pour être testé en conditions réelles ; le code reste testable par mock)

1. Endpoint `GET /projects/<slug>/lab/g5k/clusters?minVramGb=N` (utilise
   `g5k_reference.py` + credentials de l'utilisateur si configurés, sinon état vide).
2. Panneau « Cluster recommandé » dans `ExperimentLauncher.tsx` (§`08_UX_UI.md` §3).
3. Avertissement de sweep GPU dans l'UI (§`08_UX_UI.md` §4).
4. Formulaire Calcul étendu (champ clé SSH, double indicateur `apiOk`/`sshOk`,
   §`08_UX_UI.md` §2).

## Lot 2 — job conteneur pour les sweeps GPU (chantier de modélisation)

Nouveau modèle `ExperimentRunBatch` (un job OAR, plusieurs `ExperimentRun` enfants
exécutés séquentiellement ou en parallèle dans la même réservation). Remplace le
garde-fou du Lot 0 par une vraie solution plutôt qu'un avertissement. Nécessite : script
généré qui boucle sur N configs, agrégation des résultats par run enfant, UI de suivi
d'un batch (barre de progression globale + détail par enfant).

## Lot 3 — monitoring énergie (Kwollect)

1. Activer `-t monitor=wattmetre_power_watt` dans le script généré pour les runs GPU
   (opt-in, coût nul si non consommé).
2. Nouvel endpoint qui interroge `GET /sites/{site}/metrics?job_id=X` après ingestion
   d'un run terminé, stocke `kwh_consumed` dans `RunArtifact` ou un champ dédié.
3. Affichage dans `RunResults.tsx` (« Ce run a consommé ~0,4 kWh ») — argument
   scientifique pour l'article (reproductibilité + impact environnemental).

## Lot 4 — image Singularity figée (reproductibilité stricte, optionnel)

Construire une fois une image `.sif` avec CUDA/PyTorch/transformers figés (au lieu de
réinstaller Conda à chaque réservation) — gain de temps de démarrage et garantie de
non-dérive de version entre deux runs à des dates différentes.

---

## Effort et risque par lot

| Lot | Effort | Risque | Bloqué par un compte G5K ? |
|---|---|---|---|
| 0 | Moyen (migration client + nouveau modèle + tests) | Faible (tout testable localement) | Non |
| 1 | Faible-moyen (UI + un endpoint) | Faible | Non pour le code ; oui pour la vérification en conditions réelles |
| 2 | Élevé (nouveau modèle, script conteneur) | Moyen | Non pour le code ; oui pour la vérification |
| 3 | Faible | Faible | Oui (nécessite un job réel pour avoir des métriques) |
| 4 | Moyen | Faible | Oui (nécessite un nœud GPU réel pour builder l'image) |
