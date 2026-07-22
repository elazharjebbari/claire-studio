# Lots avancés implémentés - jobs, fiabilité, Gold, taxonomie et PDF

**Branche :** `codex/analysis-lab-roadmap`
**Date :** 22 juillet 2026

## 1. Capacités ajoutées

Le socle snapshot est étendu sans modifier son contrat d'immutabilité. Les nouveaux snapshots
capturent aussi les versions d'annotations sanitizées et l'état complet du Gold, tout en excluant
les textes, preuves, rationales et commentaires d'arbitrage.

Métriques versionnées disponibles :

| Code                    | Portée                             | Sorties principales                             |
| ----------------------- | ---------------------------------- | ----------------------------------------------- |
| `quality.v1`            | qualité des observations           | validation, multi-label, certitude, supports    |
| `intra_annotator.v1`    | versions successives d'un humain   | stabilité, kappa, unités modifiées              |
| `pairwise_agreement.v1` | humain-humain, humain-LLM, LLM-LLM | accord brut, kappa, Jaccard, F1 frontières, cas |
| `gold_analysis.v1`      | décisions et propositions Gold     | readiness, risques, classes d'accord, proximité |
| `taxonomy.v1`           | thèmes primaires/secondaires       | fréquence, rareté, cooccurrences                |

Le calcul pairwise utilise l'intersection co-couverte et expose toujours le support. Une moyenne
de kappa n'est produite que pour les paires ayant au moins 20 unités. Les faibles supports génèrent
un avertissement plutôt qu'un zéro trompeur.

## 2. Exécution durable

En production, l'API crée un `AnalysisRun` en état `queued`. Le service systemd
`claire-studio-analysis-worker` réclame les jobs persistés, met à jour progression et heartbeat,
et laisse les résultats en base. Un redémarrage du serveur ne perd donc pas la demande.

Les états sont `queued`, `running`, `succeeded`, `failed`, `canceled` et `stale`. L'annulation est
coopérative entre deux métriques. Un run sans heartbeat au-delà de 900 secondes est marqué en
échec explicite. En test, le dispatcher reste inline ; en développement, un thread est disponible.

Commandes d'exploitation :

```bash
python manage.py analysis_worker --once
python manage.py analysis_worker --poll 1
python manage.py benchmark_analysis <snapshot_uuid> --repeat 5
python manage.py purge_analysis_artifacts --dry-run
python manage.py purge_analysis_artifacts
```

Le endpoint `/analysis/health` expose les nombres de runs et artefacts queued/running/failed sans
contenu analytique. Chaque calculator journalise sa durée, son run et sa version.

## 3. Presets, scope et drill-down

- `/scopes/preview` indique avant capture le nombre de documents, annotations et brouillons ;
- un scope peut restreindre statuts, documents et acteurs sans jamais élargir les droits ;
- les presets personnels ou partagés conservent seulement une configuration ;
- `/runs/{id}/cases` pagine les désaccords sanitizés : id document, index, pseudonymes et thèmes ;
- les cas ne contiennent aucun texte et héritent de la visibilité du snapshot.

## 4. Gold et taxonomie

Les analyses Gold distinguent unités proposées, unités décidées, risque et classe d'accord. Elles
ne modifient aucune `GoldSentence`. Les propositions taxonomiques sont des objets séparés avec
preuve agrégée, rationale, rapport source et workflow `draft/reviewed/rejected`. Aucun statut
"applied" automatique n'existe : la modification d'un schéma reste une action métier distincte.

## 5. Rapports PDF privés

Un rapport historique peut demander un artefact PDF. Le worker produit un A4 Pactiva avec :

- titre, snapshot et fingerprint ;
- KPI et avertissement brouillons ;
- profils pseudonymisés ;
- tableau des accords avec supports ;
- manifeste des métriques et versions.

Le chemin serveur n'est jamais sérialisé. Le téléchargement vérifie confinement du chemin, statut
et droits du rapport. Chaque fichier possède SHA-256, taille, version de renderer et date
d'expiration. La purge supprime seulement le fichier et conserve le manifeste DB comme preuve.

La génération a été vérifiée par extraction des métadonnées, rendu Poppler en PNG et inspection
visuelle : format A4, typographie lisible, tableaux non tronqués, pied de page et pagination corrects.

## 6. Déploiement

Les migrations `0002`, `0003` et `0004` sont additives : colonnes de suivi sur `AnalysisRun`, puis
tables Preset, Artifact et TaxonomyProposal, puis index worker/rétention. Elles ne réécrivent ni
annotations ni Gold. Le paquet `reportlab` est ajouté aux dépendances backend.

Avant le premier déploiement :

1. sauvegarder PostgreSQL et vérifier la restauration ;
2. répéter les trois migrations Analysis sur staging ;
3. installer/copier `claire-studio-analysis-worker.service` et faire `daemon-reload` ;
4. vérifier les droits d'écriture de `backend/var/analysis` pour `www-data` ;
5. déployer avec `./deploy/deploy-claire.sh --allow-migrations` ;
6. contrôler les trois services, `/api/v1/health` et `/analysis/health` ;
7. réaliser un smoke snapshot, run, rapport, render PDF, download ;
8. programmer quotidiennement `purge_analysis_artifacts`.

Le script de déploiement installe et redémarre maintenant le worker avec le backend et le frontend.
Le rollback du code ne rétrograde toujours pas le schéma additif.

## 7. Validation finale

| Contrôle                               | Résultat                                                        |
| -------------------------------------- | --------------------------------------------------------------- |
| suite backend complète                 | 444 tests réussis                                               |
| tests dédiés Analysis Lab              | 12 réussis                                                      |
| suite frontend complète                | 527 tests réussis                                               |
| tests UI Analysis Lab                  | 5 réussis                                                       |
| Ruff, Django check et migrations check | réussis                                                         |
| TypeScript et build Next.js production | réussis                                                         |
| scripts de déploiement `bash -n`       | réussis                                                         |
| PDF                                    | métadonnées, checksum, rendu PNG et inspection visuelle réussis |

La validation technique ne remplace pas l'approbation scientifique et métier des seuils ou de
l'interprétation du kappa. Cette approbation reste un gate avant exposition décisionnelle large.
