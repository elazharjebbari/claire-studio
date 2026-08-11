# Pactiva Lab — plateforme d'expérimentation pour l'article de recherche

**Objet.** Tout ce qu'il faut pour qu'à la fin de la campagne d'annotation, **aucun chiffre de
l'article ne reste à produire à la main** : export de jeux de données versionnés, module
d'apprentissage supervisé sur les thèmes de clauses, module Analyse & Qualité enrichi de
visualisations publiables, et exécution déportée sur **Grid'5000**.

**Date :** 11 août 2026 · **Contexte amont :**
[`../pactiva-papier-ressource/`](../pactiva-papier-ressource/00_README.md) (stratégie de l'article)
et [`../pactiva-anomalies-graphe/04_ANCRAGE_PLATEFORME.md`](../pactiva-anomalies-graphe/04_ANCRAGE_PLATEFORME.md)
(état réel des données).

---

## La proposition en une page

> **Un principe d'architecture gouverne tout le dossier : le calcul scientifique ne vit pas
> dans Django.**
>
> Pactiva **produit des jeux de données figés et signés** ; un **package Python autonome**
> (`research/pactiva_lab/`) les consomme, entraîne, évalue et écrit des résultats normalisés ;
> Pactiva **ingère et affiche** ces résultats. Le même package tourne à l'identique sur un
> portable, sur le VPS, ou sur un nœud GPU Grid'5000 — **sans une ligne de code différente**.
>
> Ce découplage est ce qui rend l'ensemble testable, reproductible et publiable. Il évite le
> piège classique : un backend web qui embarque PyTorch, impossible à déployer, impossible à
> tester, et dont les résultats ne sont pas reproductibles hors de lui.

**Les quatre livrables :**

| # | Livrable | Ce qu'il apporte à l'article |
|---|---|---|
| **L-A** | **Datasets versionnés** — sélection par *complétude* (documents finis, pas seulement soumis), empreinte, manifeste, splits figés | Chaque tableau de l'article cite un `dataset_id` reproductible |
| **L-B** | **Module d'expérimentation ML** — prétraitements combinables, modèles SOTA, embeddings, validation croisée par document | Les résultats supervisés, les ablations, les courbes d'apprentissage |
| **L-C** | **Analyse & Qualité enrichi** — 12 visualisations publiables (matrices d'accord, longue traîne, calibration, courbes de gold) | Les figures de l'article, exportables en SVG/PDF vectoriel |
| **L-D** | **Exécution Grid'5000** — soumission OAR via l'API REST, suivi, rapatriement, identifiants chiffrés | Les entraînements lourds (transformers, GPU) sans monopoliser le VPS |

---

## Le point scientifique qui commande la conception

Trois faits, établis sur les données réelles, contraignent l'architecture bien plus que les
préférences techniques :

1. **L'accord inter-annotateurs est de α-MASI 0,635.** C'est le **plafond humain** : aucun
   modèle supervisé entraîné sur ce gold ne peut raisonnablement le dépasser. Toute métrique
   doit donc être rapportée **relativement à ce plafond**, jamais dans l'absolu. Un module qui
   n'affiche pas le plafond humain produit des chiffres trompeurs.
2. **Les phrases d'un même contrat ne sont pas indépendantes.** Un split aléatoire par phrase
   gonflerait artificiellement les scores (le modèle reverrait le même contrat des deux côtés).
   **Toute validation croisée est groupée par document** — c'est un invariant du module, pas
   une option.
3. **La distribution est à longue traîne** (`PREAMBLE_SCOPE` 12,7 % → `FEEDBACK` 0,34 %). Le
   micro-F1 sera flatteur et le macro-F1 sévère : les deux doivent être rapportés
   systématiquement, avec les scores par étiquette et leurs intervalles de confiance.

---

## Contenu du dossier

| Fichier | Format | Objet |
|---|---|---|
| [`01_PLAN_SCIENTIFIQUE.md`](01_PLAN_SCIENTIFIQUE.md) | md | **Le plan du chercheur** : questions, protocole, état de l'art, familles de modèles, prétraitements, métriques, ablations, plan de figures |
| [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md) | md | Architecture technique, modèles de données, contrats, API, arbre de fichiers |
| [`03_UX_UI.md`](03_UX_UI.md) | md | Navigation, écrans, composants, design system, **catalogue des visualisations** |
| [`04_PLAN_DEV.md`](04_PLAN_DEV.md) | md | 9 lots séquencés, critères d'acceptation, dépendances |
| [`05_TESTS.md`](05_TESTS.md) | md | Stratégie et batterie de tests (unitaires, propriété, intégration, golden, a11y) |
| [`06_GRID5000.md`](06_GRID5000.md) | md | Intégration Grid'5000 : API, OAR, stockage, **sécurité des identifiants** |
| [`07_RUNBOOK_SONNET5.md`](07_RUNBOOK_SONNET5.md) | md | Runbook d'exécution pas à pas, optimisé pour un agent |
| [`specs/experiment-config.schema.json`](specs/experiment-config.schema.json) | json | Schéma de validation d'une configuration d'expérience |
| [`specs/pipeline-presets.yaml`](specs/pipeline-presets.yaml) | yaml | Presets de prétraitement, modèles, splits |
| [`specs/metrics-catalog.yaml`](specs/metrics-catalog.yaml) | yaml | Catalogue des métriques (existantes + à ajouter) |
| [`specs/api-endpoints.yaml`](specs/api-endpoints.yaml) | yaml | Contrat d'API du module Lab |
| [`specs/data-dictionary.csv`](specs/data-dictionary.csv) | csv | Dictionnaire des colonnes des exports |
| [`diagrams/*.puml`](diagrams/) | puml | Architecture, cycle de vie, navigation, séquence Grid'5000 |

## Ce qui existe déjà et qu'on ne réécrit pas

- `claire/analysis/` : **snapshot immuable + fingerprint**, `AnalysisRun` avec heartbeat/cancel/retry,
  `AnalysisReport` + artefacts, **registre de métriques versionnées** extensible, worker dédié.
  → Le Lab **étend** ce socle, il ne le remplace pas.
- `create_snapshot(include_drafts=…, scope={statuses, document_ids, actor_keys})` : la sélection
  fine existe déjà. Il manque **la notion de « document fini »** (§`02` L-A).
- `projects/masi.py`, `projects/iaa.py`, `projects/gold_scoring.py` : métriques de fiabilité pures
  et testées, réutilisées telles quelles.

## Note de fiabilité

Les éléments Grid'5000 proviennent de la documentation officielle consultée le 11 août 2026
(voir [`06_GRID5000.md`](06_GRID5000.md) §Sources). Les chiffres de campagne sont ceux de
[`../pactiva-papier-ressource/01_MATERIAU.md`](../pactiva-papier-ressource/01_MATERIAU.md) —
un instantané, à recalculer après chaque vague d'annotation.
