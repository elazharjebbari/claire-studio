# EXPERIMENTAL_PROTOCOL — expériences, baselines, contrôles de fuite, statistiques

> Traduit les RQ de [RESEARCH_QUESTIONS.md](RESEARCH_QUESTIONS.md) en expériences E0–E6 exécutables,
> avec leurs baselines (§16 du programme), leurs contrôles anti-fuite et leur analyse statistique.
> Ablations détaillées : [ABLATION_PLAN.md](ABLATION_PLAN.md) ; métriques :
> [EVALUATION_PLAN.md](EVALUATION_PLAN.md) ; enregistrement : [REPRODUCIBILITY.md](REPRODUCIBILITY.md).
> Configurations : [`configs/experiment.example.yaml`](../configs/experiment.example.yaml).

---

## 1. Données, découpes, étanchéité

- **Corpus** : 50 ToS, 9 414 phrases, 2 450 clauses consensus ; référence CLAUDETTE (1 137 labels, 8
  catégories) ; couche thématique T20 → T11.
- **Deux découpes, deux usages** :
  1. **Conception / validation figée** (33 / 17 documents, spécification de taxonomie) — pour tout ce
     qui implique une **conception humaine** (règles, inventaires, exemples few-shot, seuils) : conçu
     sur les 33, évalué sur les 17, **une seule fois**.
  2. **Validation croisée 5 plis par document** (`splits.json`, graine 42) — pour les modèles appris
     (baselines, KG + classifieur, embeddings) ; les 17 documents de validation restent aussi un jeu de
     test final commun.
- **Étanchéité** : (a) les prompts d'extraction ne contiennent ni labels ni items ; (b) les règles sont
  gelées (empreinte SHA-256 + commit) **avant** toute exécution sur les 17 ; (c) les modèles appris ne
  voient jamais les phrases de test dans leurs plis ; (d) un test automatique vérifie qu'aucune règle ne
  lit `LABELED`/`Category` ; (e) les exemples few-shot proviennent exclusivement des 33.
- **Unité d'évaluation** : la phrase (référence) ; agrégation des signalements de `Norm` vers les phrases
  d'evidence (LEGAL_MODEL §5) ; variante « clause entière » en annexe.

## 2. Baselines (obligatoires)

| Code | Baseline | Entrée | Sortie | Notes |
|---|---|---|---|---|
| **B0** | majorité / prévalence | — | classe majoritaire ; score = taux de base | plancher |
| **B0'** | thème seul | thème T11 consensus | P(catégorie \| thème) estimée sur train | le plancher **fort** (AP 0,404 sur T20) |
| **B1** | TF-IDF + régression logistique (un-contre-tous par catégorie) | phrase (±1 phrase de contexte en variante) | scores par catégorie | Lab `baselines.py` |
| **B2** | encodeur fine-tuné (BERT-base, **Legal-BERT**) | phrase ±1 | idem | Lab `heavy.py`, cible `unfair` (à ajouter) ; G5K |
| **B3** | LLM prompté (zero-shot / few-shot) avec les définitions CLAUDETTE | phrase | catégories | même modèle que l'extraction, prompt distinct ; 1 exécution |
| **B4** | graph-only structurel | L1+L2 sans texte : thème, position, voisinage thématique, co-occurrence (G2) | scores | isole ce que la structure documentaire apporte sans normes |

## 3. Approches évaluées

| Code | Approche | Ce qu'elle lit | Sortie | Explication |
|---|---|---|---|---|
| **A3** | règles de graphe (R1–R2, puis +R3) | L2 + L3 (+ L1 pour R3) | `MATCHES_ITEM` | sous-graphe témoin |
| **A4** | similarité de graphe | L1–L3 : clauses similaires (structure + thème + embeddings de clause) à des clauses **de train** étiquetées | score k-NN | clauses voisines (cas analogues) |
| **A5** | détection d'anomalie de graphe | L1–L3 sans labels : rareté de configuration normative, anomalie conditionnelle (DOMINANT-like sur le graphe clause–thème–norme) | score | motif rare (à confronter à *rare ≠ abusif*) |
| **A6** | hybride LLM + KG | LLM prompté **avec** le sous-graphe de la clause (norme + voisinage) | catégories | mixte (à traiter avec prudence : l'explication LLM n'est pas une explication) |
| **A7** | KG + règles + classifieur | features L2–L3 + sorties des règles → classifieur (LR/GBM) | scores | importance des features + règle déclenchée |
| **A8** | KG + embeddings | node2vec / GNN sur le graphe (Memgraph MAGE) + texte → classifieur | scores | faible (baseline d'ablation) |

## 4. Expériences

### E0 — Fiabilité des templates (RQ0)
Pilote 100 clauses (conception) : 2 juristes valident indépendamment → κ par champ, taux
accept/edit/reject, exactitude des propositions. Puis hold-out : 888 clauses validées (1 juriste, 20 %
en double). **Gate 5** dépend de E0.

### E1 — Structure vs texte (RQ1)
B0–B4 et A3, A7, A8 sur les 5 plis ; métriques par catégorie ; Δ apparié par document ; Holm sur 8
catégories. Sous-analyse : catégories compositionnelles (CR, USE, TER) vs « à thème unique » (A, LAW).

### E2 — L'annexe exécutée (RQ2)
Règles gelées ; exécution sur hold-out (templates validés) ; P/R/F1 par règle/item/catégorie ; Δ vs B0' ;
ablations (sans exceptions §2 ; R1 seul ; R1+R2 ; +R3). Répliquée avec les templates d'un second
modèle (ouvert) et avec les templates **bruts** (lien avec RQ4).

### E3 — Hybride et explicabilité (RQ3)
Non-infériorité de A7 (ou A3+A7) vs meilleur de B1–B3 (borne 0,05 macro-F1) ; étude humaine
d'explication (EVALUATION_PLAN §3) sur 200 signalements stratifiés (règle × correct/incorrect) ;
comparaison à une explication par attention (B2 + saliency) sur les mêmes phrases.

### E4 — Construction automatique (RQ4)
Pilote multi-modèles (LLM_EXTRACTION §5) ; extraction complète ; métriques KG (EVALUATION_PLAN §1) ;
reproductibilité (3 exécutions) ; coût/latence ; règles sur brut vs validé.

### E5 — Ce que le graphe voit (RQ5)
Ensembles de vrais positifs par méthode ; McNemar par paire de méthodes ; lecture par famille R1–R4 et
par catégorie ; exemples qualitatifs.

### E6 — Audit des faux positifs (RQ6)
Tous les signalements du hold-out (ou échantillon stratifié si > 400) classés par 2 juristes ; origine
de l'erreur ; liste des omissions candidates du corpus de référence (livrable au benchmark).

## 5. Analyse statistique (règles communes)

1. Bootstrap **par document** (1 000 tirages) pour tous les IC ; jamais par phrase.
2. Comparaisons appariées : mêmes documents/plis ; test de permutation apparié (10 000 permutations)
   sur la différence de macro-F1 ; Wilcoxon signé en confirmation.
3. Classifieurs par phrase : McNemar sur les désaccords.
4. Proportions (audit, acceptation) : IC de Wilson ; accord inter-juges : κ.
5. Corrections : Holm par famille de comparaisons ; tailles d'effet toujours rapportées.
6. Petits effectifs déclarés (A : 44 labels au total, 17 sur le hold-out) ; pas de conclusion par
   catégorie sous 30 labels sans IC affiché.
7. Non-infériorité (RQ3) : borne déclarée avant l'expérience ; IC unilatéral 95 %.

## 6. Ordre d'exécution et dépendances

E0 → (Gate 5) → E4-complet → E2 → E1/E3 (nécessitent A3/A7) → E5 → E6. B0–B3 peuvent démarrer
immédiatement (Gate 6 : baseline reproductible). Le DAG complet : [`diagrams/dag.puml`](../diagrams/dag.puml).
