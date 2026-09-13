# 01 — Architecture expérimentale

## 1. Diagnostic AS-IS

| Constat | Conséquence |
|---|---|
| Les résultats vivaient en **JSON dispersés** : `docs/*/annexes/*.json`, dossiers de run du Lab, sorties de scripts ad hoc | Impossible de savoir, devant un chiffre, s'il est à jour, sur quel dataset il porte, et s'il est citable |
| Des campagnes historiques (août) tournaient sur des instantanés **partiels** : 39 documents, 12 documents multi-annotés | Des chiffres publiés cohabitaient avec des chiffres périmés, sans marquage |
| Le Lab stocke ses runs en base avec config et environnement | Bon socle pour les modèles, mais rien pour les mesures pures (accords, taxonomies) |
| Aucune notion de **statut** ni de **porte de contrôle** | « Final » était une intention, jamais une propriété vérifiée |
| Trois mesures manquaient | Référence humaine (leave-one-annotator-out), benchmark des juges contre le GOLD, analyse d'erreurs par classe d'accord |

## 2. Architecture cible

```
  dataset Lab (figé, empreinte)        spécification de taxonomie (figée, empreinte)
              │                                        │
              ▼                                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  research/experiments/                                        │
   │    campaign.py        → enveloppe, portes, provenance         │
   │    run_campaign.py    → RQ1 / RQ2 / RQ3 (mesures pures)       │
   │    rq4_models.py      → RQ4 (lit les runs du Lab)             │
   └──────────────────────────────────────────────────────────────┘
              │                                        ▲
              ▼                                        │
   frontend/src/features/paper/campaign.json    runner du Lab (entraîne)
              │
              ▼
   Vue « Résultats de l'article » — navigation, comparaisons, drill-down, export
```

**Séparation des responsabilités** : le runner du Lab est le seul à entraîner ; la campagne
est la seule à qualifier, tracer et publier. RQ4 ne recalcule rien — elle lit les sorties
du runner et les met sous la même enveloppe que les autres questions.

## 3. Modèle de données d'un résultat

Une expérience produit une enveloppe unique, identique pour les quatre questions :

| Bloc | Contenu |
|---|---|
| Identité | `id`, `rq`, `title` |
| Science | `question`, `hypothesis`, `protocol`, `summary`, `interpretation`, `uncertainty`, `limits`, `dependsOn` |
| Données | `data` : empreinte du dataset, taxonomie, source d'étiquettes, populations, identifiant de partition |
| Configuration | `config` : découpe, graine, rééchantillons, modèle, prétraitement |
| Mesures | `metrics[]` : clé, libellé, valeur, IC, unité, note, sens de lecture |
| Résultats | `results` : la structure détaillée (par thème, matrices, erreurs) — matière du drill-down |
| Validité | `gates[]` : identifiant, libellé, passé/échoué, détail, bloquante ou non |
| Statut | `status` — **déduit des portes**, jamais saisi |
| Provenance | version du code (+ dépôt propre ou non), version et empreinte de la spécification de taxonomie, Python, plateforme, date d'exécution |

## 4. Les portes de contrôle

Ce sont elles qui font la différence entre un chiffre et un chiffre **publiable**.

| Porte | Vérifie | Bloquante |
|---|---|---|
| `dataset_frozen` | Le dataset porte une empreinte | oui |
| `not_partial_snapshot` | 50 documents et 150 annotations (pas un instantané d'août) | oui — un échec rend le résultat **périmé** |
| `taxonomy_spec_frozen` | Les mappings sont versionnés et empreintés | oui |
| `seed_recorded` | La graine est déclarée | oui |
| `code_version_recorded` | Le SHA du dépôt est enregistré (et signale un dépôt modifié) | non |
| `split_document_level` | La découpe est `group_kfold_document` | oui (si modèle) |
| `no_train_test_leak` | Corollaire du groupement par document | oui (si modèle) |
| `gold_finalized` | Toutes les résolutions sont figées | oui (si l'expérience dépend du gold) |
| `gold_complete` | Aucune phrase en attente d'arbitrage | oui (si gold) |
| `same_population` | Les comparaisons sont internes à une population | oui (si comparaison) |

**Règle de statut** : aucune porte bloquante en échec → `validated`. Échec de
`not_partial_snapshot` → `stale`. Tout autre échec → `preliminary`. `final` est un
marquage manuel supplémentaire, réservé au gel de publication.

## 5. Reproductibilité

Cinq éléments sont enregistrés avec chaque chiffre, et suffisent à le rejouer :

1. **L'empreinte du dataset** (SHA-256 des critères, lignes, votes et état gold) ;
2. **L'empreinte de la spécification de taxonomie** (les mappings exacts utilisés) ;
3. **La graine** et le nombre de rééchantillons ;
4. **La version du code** (SHA du dépôt), avec un signalement si le dépôt était modifié ;
5. **La configuration complète** (découpe, modèle, prétraitement).

La commande de reproduction est la même que celle de production :
`python research/experiments/run_campaign.py <dataset> --gold-state <json> --model-runs <dir>`.

## 6. Séparation des populations

La partition **conception (33) / validation (17)** est figée dans la spécification de
taxonomie, pas dans un script. Toute comparaison est INTERNE à une population : on ne
compare jamais un chiffre de conception à un chiffre de validation, on les rapporte côte
à côte. Le corpus complet est rapporté comme tel, jamais comme une validation.

## 7. Modifications backend / API

**Aucune.** La campagne lit un export de dataset et des dossiers de run ; elle écrit un
fichier JSON que le frontend importe statiquement. C'est délibéré : un résultat publié ne
doit pas dépendre de la disponibilité d'un serveur, et un chiffre figé dans git est
diffable, revu en relecture de code, et lié à un commit.

## 8. Modifications UI/UX

| Fichier | Rôle |
|---|---|
| `features/paper/types.ts` | Types miroirs des enveloppes + métadonnées de statut |
| `features/paper/export.ts` | Export CSV / JSON / LaTeX, **purs et testés** (tableaux, synthèse par question, macros de valeurs citables) |
| `features/paper/PaperResults.tsx` | Navigation par question, filtres, tableaux avec IC, badges de statut, bandeau « ce qui bloque », exports |
| `features/paper/ExperimentDetail.tsx` | Question, hypothèse, protocole, incertitude, interprétation, limites, contrôles, provenance, et drill-down (par classe, matrice d'accord, erreurs représentatives) |
| `app/(app)/projects/[slug]/paper/page.tsx` | La route |
| `components/shell/Sidebar.tsx` | L'entrée « Résultats de l'article » |
