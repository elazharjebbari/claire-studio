# 07 — Runbook d'exécution pour agents (Claude Opus 5)

Ce runbook rend les lots L0–L6 de `06_PLAN_ACTION.md` exécutables par un agent sans
autre contexte. **Lisez d'abord `00_README.md` (principes non négociables), puis le lot
visé dans `06_PLAN_ACTION.md`, puis cette page en entier.**

## 0. Conventions du dépôt (vérifiées, ne pas redécouvrir)

### Environnements et suites de tests
| Quoi | Commande |
|---|---|
| Tests backend (Django) | `cd backend && DJANGO_SECRET_KEY=x .venv/bin/python -m pytest -q` |
| Tests recherche (ML pur) | `cd research && .venv/bin/python -m pytest -q` (⚠️ venv distinct du backend) |
| Tests frontend | `cd frontend && npx vitest run` |
| Types | `cd frontend && npx tsc --noEmit` |
| Lint | `cd frontend && npm run lint` |
| Garde couleurs | `cd frontend && npm run check:colors` |
| Build prod | `cd frontend && npm run build` |
| Déploiement complet | `DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh` (depuis la racine) |

### Pièges connus (réels, rencontrés)
1. **Test flaky préexistant** : `lab.test.tsx` › « un identifiant déjà enregistré permet
   d'ajouter la clé SSH… » (userEvent.type) échoue parfois en suite complète, passe
   toujours en isolation. S'il bloque la porte du deploy : relancer le deploy tel quel.
   **Ne pas le “corriger” en le désactivant.**
2. **`deploy-claire.sh` pipé vers `tail` masque l'échec** : toujours vérifier la ligne
   `✓ Déploiement OK — claire-studio @ <sha>` ET `git rev-parse HEAD` côté serveur —
   jamais le seul code de sortie.
3. **Camélisation DRF récursive** : TOUT JSONField traverse la camélisation
   (`macro_f1` → `macroF1`), y compris à l'intérieur de `metrics`. Les fixtures de
   tests frontend doivent être en camelCase (bug réel historique documenté dans
   `labResults.test.tsx`).
4. **Ne jamais lire `Experiment.compute_target` (FK)** pour la cible d'exécution — la
   source de vérité est `run.config.compute.target` (mensonge silencieux sinon,
   commentaire dans `serializers.py`).
5. **`react-query` dans les tests** : reproduire le câblage `onError→useApiErrorStore`
   de `app/providers.tsx` dans le wrapper de test si le test vérifie la remontée
   d'erreurs (patron dans `labResults.test.tsx`).
6. Les tests vitest du Lab moquent `@/features/lab/api` : **tout nouvel export d'api.ts
   doit être ajouté aux `vi.mock` existants** des fichiers de tests touchés.

### Interdits absolus
- **Aucune réservation Grid'5000** (aucun run `compute.target=g5k`) sans confirmation
  explicite de l'utilisateur — aucune tâche de ce dossier n'en a besoin.
- Aucun deploy pendant qu'un run G5K est actif (le worker redémarre et tuerait le job) :
  vérifier `waiting/running = 0` avant `deploy-claire.sh` (endpoint runs ou
  `journalctl -u claire-studio-lab-worker`).
- Pas de couleur hex ni de palette Tailwind brute ; tokens sémantiques uniquement.
- Ne pas renommer/supprimer de champ existant de `results.json` (ajouts seulement).
- Ne pas paraphraser les textes : copier ceux de `05_CONTENUS_PEDAGOGIQUES.md`.

## 1. Boucle standard d'un lot

```
1. Lire 06_PLAN_ACTION.md §lot + les sections référencées des docs 03/04/05.
2. Implémenter (petits commits logiques).
3. Écrire/adapter les tests du lot (08_BATTERIE_TESTS.md §lot).
4. Suites : recherche et/ou backend selon le lot + vitest + tsc + lint + check:colors.
5. Auto-revue adversariale (workflow 2 agents : correction + design/a11y sur git diff).
   Corriger les findings retenus, re-tester.
6. Commit final du lot (message : contexte → cause → changement, français).
7. Déployer UNIQUEMENT si le lot est utilisateur-visible et complet ; sinon accumuler.
8. Mettre à jour la section « État d'avancement » en fin de ce fichier.
```

## 2. Notes d'exécution par lot (compléments au plan)

### L0 (stats Python)
- `stats.py` : les prédictions arrivent comme lignes de `predictions.jsonl`
  (document, index, fold, y_true, y_pred, confidence…). Grouper PAR DOCUMENT d'abord ;
  l'appariement A/B se fait sur la clé `(document, index)` — **asserter que les deux
  runs couvrent exactement les mêmes clés**, sinon lever une erreur explicite
  (`predictions_mismatch`) plutôt que de calculer un Δ faux.
- Seed : paramètre explicite, défaut fixé (42) — le déterminisme est testé.
- LRAP : la fonction existe (`metrics.py:149`) ; il s'agit de l'appeler dans le chemin
  T2 du runner et d'écrire `lrap` dans `metrics`.

### L1 (endpoints)
- Lecture des artefacts : `RunArtifact` donne le nom/checksum ; le fichier vit sous
  `run.storage_path`. Vérifier le checksum avant usage ; 422 `predictions_missing` si
  absent (cas réel : anciens runs, runs partiels).
- `aggregate` : l'axe d'un sweep learning-curve est `config.evaluation.learning_curve.n_documents`
  (posé par `expand_sweep`) ; pour label-noise, l'axe équivalent dans la config du
  preset. Ne pas inventer d'axe : lire `expand_sweep()` dans `contracts.py`.
- Respecter le patron de permissions existant (`_project_for`, lead/reviewer).

### L2 (socle frontend)
- `ExperimentIntro` : état replié PAR COMPTE via le système de prefs existant
  (`store/prefs.ts`, couche serveur) — pas de localStorage direct.
- `resultViewFor` est PUR et testé exhaustivement (tous les presets + replis).
- La vue générique reste le défaut : aucune régression sur les tests existants
  (`labResults.test.tsx` doit passer sans modification autre qu'additive).

### L3/L4 (vues)
- Réutiliser `Figure` pour TOUTE nouvelle figure (export CSV/SVG et table accessible
  gratuits). Palette : `seriesColor`/`VIZ_VARS` de `analysis/charts`.
- `fitPowerLaw` (L4) : moindres carrés sur `log`-transformation avec garde-fous
  (c borné > 0 ; si l'ajustement diverge → pas de courbe, message honnête). Parité
  Python : golden JSON partagé (patron `goldParity.test.ts` / `gold_scoring`).
- Chaque vue gère les 3 états : sweep incomplet, run unique, échec.

### L5 (pédagogie)
- Ajouter les pages markdown au `manifest.ts` du centre d'aide (patron existant).
- Le lint éditorial (08 §5) doit passer : aucune formulation interdite.

### L6 (finitions)
- Étendre `GUARDED` dans `scripts/check-no-hex.mjs` aux fichiers `features/lab/`
  APRÈS stabilisation des vues (sinon le garde bloque le travail en cours).
- La revue finale utilise le patron de revue de ce dossier : 2 agents sur
  `git diff HEAD` + fichiers non trackés lus en entier.

## 3. Definition of done globale

- Les 10 presets du `recommended_order` + les 4 hors liste routent vers leur famille ;
  une expérience libre route vers la vue générique enrichie.
- Chaque vue ouvre sur une intro + un verdict avec IC ; chaque KPI a sa définition.
- `08_BATTERIE_TESTS.md` : toutes les suites vertes, critères d'acceptation cochés.
- Déployé en prod, healthchecks 200, commit sur `main`.
- Mémoire projet mise à jour (`memory/` : nouveau fichier ou enrichissement
  `pactiva-lab.md`) + « État d'avancement » ci-dessous complété.

## État d'avancement (à tenir à jour par les agents)

| Lot | Statut | Commit(s) | Notes |
|---|---|---|---|
| L0 | à faire | — | |
| L1 | à faire | — | |
| L2 | à faire | — | |
| L3 | à faire | — | |
| L4 | à faire | — | |
| L5 | à faire | — | |
| L6 | à faire | — | |
