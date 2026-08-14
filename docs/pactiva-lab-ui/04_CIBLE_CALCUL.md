# Complément d'audit — visibilité de la cible de calcul (Local / Grid'5000)

Suite directe de `01_AUDIT.md`. Déclencheur : question utilisateur du 14 août 2026 —
« comment accéder à l'interface de gestion Grid'5000 depuis le lab ? comment exécuter
les calculs directement sur Grid'5000, est-ce pris en compte ? il n'y a que 3 onglets ».

## Constat

L'exécution sur Grid'5000 était déjà **entièrement implémentée côté backend**
(`Grid5000Backend`, `runners/g5k.py`, soumission OAR réelle, rapatriement SSH — vérifié
avec de vrais identifiants plus tôt dans le projet) mais **invisible côté UI** :

1. **Aucun badge de cible** nulle part — ni dans la liste des presets (mode guidé), ni
   dans la liste des runs, ni dans le détail d'un run. Seul indice indirect : le texte
   libre du hint de durée (« ~45 min GPU ») ou, une fois lancé, le statut transitoire
   « en attente d'allocation ».
2. **`Experiment.compute_target`** (une `ForeignKey` vers le modèle `ComputeTarget`)
   existe dans le schéma de données mais **n'intervient à aucun moment** dans la
   décision d'exécution réelle — `worker._backend_for()` lit exclusivement
   `run.config["compute"]["target"]` (une simple chaîne dans le JSON de configuration).
   Exposer le mauvais champ aurait affiché, dans certains cas, une cible différente de
   celle réellement utilisée — un risque identifié et évité avant d'écrire le code (voir
   commentaire dans `ExperimentRunSummarySerializer.get_compute_target`).
3. **L'identifiant du job OAR** (`externalJobId`, déjà exposé par l'API) n'était
   affiché **nulle part** dans l'UI — aucun moyen de croiser un run bloqué avec les
   outils natifs Grid'5000 (`oarstat`, Drawgantt) sans requêter l'API à la main.
4. Confirmation : il n'y a bien que 3 onglets (Jeux de données / Expériences / Calcul),
   et c'est un choix d'architecture assumé — Grid'5000 est une **cible de calcul par
   expérience**, pas une section à part. L'onglet « Calcul » est déjà, et reste,
   l'unique écran de gestion des identifiants (mot de passe API + clé SSH, test de
   connexion) — il n'y a pas d'« interface de gestion Grid'5000 » supplémentaire à
   construire pour ça.

## Correctifs mis en place

| Correctif | Détail |
|---|---|
| Composant partagé `ComputeTargetBadge` | Icône + libellé (« Local » / « Grid'5000 · site ») — un seul composant, pas trois implémentations divergentes. |
| Backend : `ExperimentRunSummarySerializer.compute_target`/`compute_site` | Lit la MÊME clé que le worker (`config.compute.target`), jamais la FK `Experiment.compute_target` — testé explicitement pour empêcher la régression inverse. |
| Liste des runs (`RunList.tsx`) | Nouvelle colonne « Cible » avec le badge. |
| Détail d'un run (`RunResults.tsx`) | Badge dans l'en-tête + `Job OAR : <externalJobId>` quand renseigné. |
| Liste des presets, mode guidé (`ExperimentLauncher.tsx`) | Badge à côté de chaque preset, dérivé de `preset.config.compute` — visible **avant** de créer quoi que ce soit. |

## Ce qui a été considéré et écarté pour ce lot

- **Filtrer/trier la liste des runs par cible** — utile à terme (une longue liste
  mélangeant local et Grid'5000), mais aucun signal aujourd'hui que la liste des runs
  est assez longue pour en avoir besoin. Backlog.
- **Lien direct vers les outils natifs Grid'5000** (Drawgantt, `monika`) depuis l'UI —
  nécessiterait de construire l'URL exacte par site/job, un détail d'intégration à
  traiter avec `03_STRATEGIE_FIABILITE_G5K.md` (§ Observabilité) plutôt qu'ici.
- **Nettoyer la FK `Experiment.compute_target` inutilisée** — un changement de modèle
  de données (migration), hors du périmètre d'un audit UI ; noté pour la stratégie de
  fiabilité (source de confusion si quelqu'un s'y fie un jour par erreur).

## Validation

Backend : 734 pytest (+1, `test_la_liste_des_runs_expose_la_cible_d_execution_reellement_utilisee`).
Frontend : 674 vitest (+7 : 1 colonne Cible dans RunList, 2 badge dans RunResults,
2 job OAR dans RunResults, 2 badge par preset dans ExperimentLauncher). tsc propre.
