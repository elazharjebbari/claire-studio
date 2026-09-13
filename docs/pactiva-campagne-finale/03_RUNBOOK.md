# 03 — Runbook exécutable

> État : **exécuté le 13 septembre 2026**. Chaque lot indique objectif, fichiers, données,
> commande, métriques attendues, tests, critère de succès, artefacts, risques et rollback.

## Vue d'ensemble

| Lot | Objectif | État |
|---|---|---|
| L1 | Dataset final figé (50 doc. × 3 annotateurs, gold complet) | ✅ |
| L2 | Socle de campagne : enveloppe, portes, provenance | ✅ |
| L3 | RQ1 — fiabilité de l'annotation (5 expériences) | ✅ |
| L4 | RQ2 — granularité de la taxonomie (3 expériences) | ✅ |
| L5 | RQ3 — humains contre LLM (3 expériences) | ✅ |
| L6 | RQ4 — modèles compacts (runs + 3 expériences) | ✅ (CPU) |
| L7 | Vue « Résultats de l'article » + exports | ✅ |
| L8 | Gel de publication (finalisation du GOLD) | ⏳ **action humaine** |

---

## L1 — Dataset final

| | |
|---|---|
| **Données** | Projet `campagne-pactiva`, 50 documents, 3 annotateurs, statut `submitted`, agrégation `consensus` |
| **Commande** | Construction d'un dataset Lab (UI ou API `POST /lab/datasets`) |
| **Attendu** | 50 documents, 9 414 phrases, 150 annotations, 28 242 votes, 9 414 phrases de gold |
| **Succès** | ✅ empreinte `7116e627…` ; export `gold.jsonl` portant les 462 décisions humaines |
| **Risque** | Construire sur un corpus incomplet → **parade** : la porte `not_partial_snapshot` marque le résultat « périmé » |
| **Rollback** | Aucun : la construction d'un dataset est additive et n'écrit rien dans le corpus |

## L2 — Socle de campagne

| | |
|---|---|
| **Fichiers** | `research/experiments/campaign.py` |
| **Modifications** | `Experiment` (contrat), `Gate` (contrôle), `envelope()` (enveloppe standardisée), `standard_gates()`, `status_from_gates()`, provenance (SHA du dépôt, propreté, environnement) |
| **Tests** | Cohérence statut ↔ portes vérifiée côté frontend sur les 14 enveloppes |
| **Succès** | ✅ toute enveloppe porte dataset, taxonomie, source d'étiquettes, graine, version du code |
| **Risque** | Un statut saisi à la main → **parade** : `status` est calculé, jamais passé en argument |

## L3 — RQ1 (fiabilité)

| | |
|---|---|
| **Expériences** | E1.1 coût du multi-label · E1.2 fiabilité par thème · E1.3 frontières · E1.4 cascade gold · E1.5 référence humaine |
| **Commande** | `python research/experiments/run_campaign.py <dataset> --gold-state <json>` |
| **Métriques attendues** | α-MASI, α nominal, Δ apparié avec IC, α et AC1 par thème, Jaccard des frontières, parts de cascade, exactitude et κ humains |
| **Succès** | ✅ 4 validées ; E1.4 préliminaire (gold non figé) |
| **Artefacts** | enveloppes E1.1–E1.5 dans `campaign.json` |
| **Risque** | Mesurer les frontières sur les ancres de clause (artefact à 1,0) → **parade** : frontières RECONSTRUITES (changement du jeu de thèmes) |

## L4 — RQ2 (granularité)

| | |
|---|---|
| **Expériences** | E2.1 comparaison des 4 taxonomies × 3 populations · E2.2 validation hold-out · E2.3 compromis fiabilité/signal |
| **Métriques attendues** | α-MASI par cellule, Δ apparié contre T20 avec IC et stabilité de signe, taux de désaccord, AP d'abusivité, rendement |
| **Succès** | ✅ E2.2 validée (le résultat anti-surajustement) ; E2.1 et E2.3 préliminaires (dépendent du gold) |
| **Risque** | Comparer entre populations → **parade** : porte `same_population`, et les Δ sont calculés SÉPARÉMENT par population |

## L5 — RQ3 (humains contre LLM)

| | |
|---|---|
| **Expériences** | E3.1 matrice d'accord 7×7 · E3.2 divergence au pré-remplissage · E3.3 benchmark des juges contre le GOLD |
| **Métriques attendues** | κ par paire, divergence par annotateur et par juge, exactitude/macro-F1/κ des juges |
| **Succès** | ✅ E3.1 et E3.2 validées ; E3.3 préliminaire |
| **Risque** | Comparer des vocabulaires différents → **parade** : κ à vocabulaire constant, et benchmark rejoué en T20 **et** T11 pour vérifier la stabilité du classement |

## L6 — RQ4 (modèles compacts)

| | |
|---|---|
| **Fichiers** | `research/experiments/rq4_models.py` |
| **Runs** | `position_only` et `tfidf_linear` en T20 et T11, plus 5 points de courbe d'apprentissage (8/16/24/32/40 documents) |
| **Commande** | `PYTHONPATH=research python -m pactiva_lab run --config <cfg> --data <dataset> --out <run>` puis `run_campaign.py … --model-runs <dir>` |
| **Métriques attendues** | macro-F1 avec IC bootstrap, micro-F1, κ, dispersion inter-plis, taux d'erreur par classe d'accord, confusions |
| **Succès** | ✅ 3 expériences validées ; TF-IDF 0,483 (T20) → 0,597 (T11) ; plafond humain κ 0,859 |
| **Risque** | Comparer des macro-F1 de taxonomies différentes comme si c'était la même tâche → **parade** : limite déclarée explicitement dans E4.1 |
| **Non fait** | Fine-tuning GPU (Legal-BERT, encodeurs, frontières) : demande Grid'5000 |

## L7 — Vue « Résultats de l'article »

| | |
|---|---|
| **Fichiers** | `features/paper/{types,export,PaperResults,ExperimentDetail}.tsx`, route `projects/[slug]/paper`, entrée de barre latérale |
| **Fonctions** | Navigation par question, filtres (taxonomie, citables), tableaux avec IC, badges de statut, bandeau « ce qui bloque » nommé, drill-down (classes, matrice, erreurs), provenance dépliable, export CSV/JSON/LaTeX |
| **Tests** | `frontend/tests/paperResults.test.tsx` — 14 cas |
| **Succès** | ✅ 881 tests frontend, `tsc` et `eslint` propres |
| **Rollback** | La vue lit un JSON : la retirer n'affecte aucune donnée |

## L8 — Gel de publication ⏳

| | |
|---|---|
| **Action** | Finaliser les 50 résolutions gold (atelier → « Soumettre la résolution », ou en lot) |
| **Effet** | La porte `gold_finalized` passe ; **E1.4, E2.1, E2.3 et E3.3 basculent en « validé »** |
| **Ensuite** | Rejouer `run_campaign.py` (quelques minutes) et committer le `campaign.json` mis à jour |
| **Risque** | Un gold figé n'est plus modifiable sans `reopen` (lead/admin) — c'est le but |

---

## Liste des expériences et dépendances

```
RQ1  E1.1 coût du multi-label ────────┐
     E1.2 fiabilité par thème         │
     E1.3 frontières                  │
     E1.4 cascade gold                │
     E1.5 référence humaine ──────┐   │
                                  │   │
RQ2  E2.1 comparaison taxonomies ─┼───┘
     E2.2 validation hold-out ────┼── dépend de E2.1
     E2.3 compromis fiabilité ────┼── dépend de E2.1
                                  │
RQ3  E3.1 matrice d'accord        │
     E3.2 divergence au seed      │
     E3.3 benchmark des juges ────┘ dépend de E1.5 (comparaison au plafond humain)

RQ4  E4.1 planchers et taxonomie ── dépend de E1.5 et E2.1
     E4.2 courbe d'apprentissage ── dépend de E4.1
     E4.3 analyse des erreurs ───── dépend de E4.1
```

## Critères d'acceptation

| # | Critère | État |
|---|---|---|
| 1 | Chaque expérience déclare dataset, découpe, taxonomie, source d'étiquettes, méthode, métriques, IC, graine, configuration, version du code, version du gold, empreinte, date, environnement | ✅ (testé) |
| 2 | Les résultats ne sont pas des JSON dispersés mais une vue navigable | ✅ |
| 3 | Navigation par question de recherche | ✅ |
| 4 | Comparaison T20/T14/T11/T10 | ✅ (E2.1, 12 cellules) |
| 5 | Comparaison corpus complet / validation | ✅ (E2.2) |
| 6 | Comparaison annotateurs / LLM / modèles | ✅ (E1.5, E3.1, E3.3, E4.1) |
| 7 | Métriques principales et IC 95 % | ✅ |
| 8 | Tableaux comparatifs | ✅ |
| 9 | Détail par thème | ✅ (drill-down) |
| 10 | Matrices d'accord | ✅ (drill-down E3.1) |
| 11 | Drill-down jusqu'aux phrases | ✅ (erreurs représentatives avec document, index, attendu, prédit, confiance) |
| 12 | Filtres par taxonomie et statut | ✅ — ⚠ filtres par dataset et par modèle non exposés (une seule valeur dans cette campagne) |
| 13 | Distinction finaux / préliminaires / périmés | ✅ (statut déduit) |
| 14 | Export CSV / JSON / LaTeX | ✅ (+ macros de valeurs citables) |
| 15 | Tout chiffre traçable jusqu'à son run | ✅ (provenance dans l'enveloppe, l'export CSV et le LaTeX) |
| 16 | Contrôles automatiques avant « final » | ✅ (10 portes) |
| 17 | GOLD jamais modifié destructivement | ✅ **aucune écriture** |

## Rollback

| Étage | Rollback |
|---|---|
| Campagne | `git revert` du `campaign.json` : la vue revient à l'état précédent |
| Code de campagne | Modules autonomes sous `research/experiments/` — aucun impact sur le Lab ni le backend |
| Vue | Retirer la route et l'entrée de barre latérale ; aucune donnée concernée |
| Données | Rien à annuler : la campagne ne fait que LIRE |
