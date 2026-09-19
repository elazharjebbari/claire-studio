# 06 — Plan d'action par lots

> Chaque lot a un périmètre, des dépendances, des tests et un critère de sortie. Les jalons tabulés sont dans `06a_jalons.csv`. Ordre de coupe si le temps manque : L4-bis (export CSV/JSON) → aperçus des fichiers → filtre « disagreements only » ; jamais les quotas, la pseudonymisation ni les tests.

| Lot | Périmètre | Dépend de | Tests | Critère de sortie |
|---|---|---|---|---|
| **L0** Inférence | `TransformerFinetune.save/load`, `inference.py` (pysbd), sous-commande `predict`, sauvegarde optionnelle dans le runner (`model.save_model`) | — | `tests/test_heavy_models.py` (aller-retour à 1e-5, CLI sur texte collé) | tests verts ✅ |
| **L1** Modèle servi | run local `runs/demo_legalbert_T11_holdout` (recette E4.4, découpe 33/17, poids sauvegardés) | L0 | `results.json` cohérent (17 documents de test, macro-F1 du même ordre que le papier), `predict` sur 3 phrases | poids + `model_config.json` (preprocess, split, empreinte) |
| **L2** Publication des données | `scripts/build_thematic_layer_release.py` : pseudonymisation de `votes.jsonl`, dossier + zip dans `frontend/public/downloads/`, `RELEASE.json` (tailles, SHA-256, chiffres clés, carte du modèle) ; README du jeu mis à jour | L1 (pour la carte du modèle ; le reste indépendant) | test du script : aucun identifiant réel, aucun champ `text`, empreinte inchangée, pseudonymes stables | fichiers générés, commit |
| **L3** API publique | app `claire/demo` : `DemoJob`, services (jeu figé, pseudonymes, garde-fous, résumé κ), runner (fil, verrou, sous-processus, purge), vues `manifest / contracts / contracts/{doc} / classify / jobs/{id}`, scopes de quota, réglages, migration, `demo_selfcheck` | L0, L2 | pytest : contrat des réponses, 17 documents seulement, pseudonymes, refus (taille, langue, quota, file), cycle de vie du job avec un `predict` simulé, purge | pytest vert, `demo_selfcheck` OK en local |
| **L4** Page | `page.tsx` (anglais, clair), `features/demo/*`, `lib/api/demo.ts`, `labels.en.ts`, ancienne page → `/presentation`, `check-no-hex` étendu | L2 (RELEASE.json), L3 | vitest : `DemoPanel` (garde-fous, états), `ResultsViewer` (segments, colonnes, filtre), `labels.en` couvre tous les codes ; `tsc` ; `check:colors` | build Next OK, page lisible sans API |
| **L5** Qualité | e2e a11y sur `/`, `welcome.spec` adapté, revue adversariale du diff, `make test` backend, `vitest run` complet | L3, L4 | toutes suites vertes | porte de déploiement franchissable |
| **L6** Déploiement | poids → VPS (`var/models/`), `.env` (`DEMO_*`), `pysbd` dans les extras, `deploy-claire.sh --allow-migrations`, `demo_selfcheck` sur le VPS, contrôle du parcours en production | L5 | health 200, classification réelle d'un contrat hold-out < 30 s, quotas actifs (429 au 7ᵉ appel/min) | page en ligne |
| **L7** Clôture | parcours reviewer complet (coller, `.txt`, contrat, téléchargements, chiffres), mémoire projet, GATES_LOG (papier court), compte rendu au porteur | L6 | liste de contrôle `08_BATTERIE_TESTS.md` § manuel | compte rendu remis |

## Dépendances externes et décisions du porteur

| Sujet | État | Qui |
|---|---|---|
| Entraînement du modèle | local (CPU), lancé le 19 sept. ; option Grid'5000 si le porteur le demande | session |
| Historique git de `votes.jsonl` | à décider (laisser / réécrire) | porteur |
| Licence et DOI | à décider | porteur |
| Code d'accès reviewer | ouvert par défaut ; activable par `DEMO_ACCESS_CODE` | porteur |
