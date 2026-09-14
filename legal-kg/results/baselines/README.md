# Baselines de détection d'abusivité — état au 15 septembre 2026

Run de référence : `6bf45ed8-6a24-4cf3-9613-398474fc7a39` (`src/detection/baselines_unfairness.py --split both --context 1`,
seuils sur scores hors-échantillon par GroupKFold interne, IC 95 % bootstrap par document, 1 000 tirages).
Cible : 8 catégories CLAUDETTE par phrase (multi-label). Découpes : conception 33 → validation 17 ; 5 plis par document.

| Baseline | Hold-out macro-F1 [IC 95 %] | 5 plis macro-F1 (± sd) | Lecture |
|---|---|---|---|
| B0 majorité | 0,000 | 0,000 | plancher |
| **B0' thème seul** (P(cat \| thème T11), T11 consensus) | **0,219** [0,201 ; 0,239] | 0,240 ± 0,010 | fort pour LTD (0,44) / CH (0,40) / TER (0,36), nul pour A, J, LAW, CR : **le thème dit qu'une phrase est à risque, pas de quelle catégorie** — c'est ce que la structure (acteur/action/condition) doit apporter |
| **B1 TF-IDF (mots 1–2 + car. 3–5) + LR équilibrée, contexte ±1** | **0,447** [0,413 ; 0,480] | 0,452 ± 0,024 | PR-AUC par catégorie 0,28 (A) → 0,65 (J) ; rappel 0,48–0,93, précision 0,25–0,43 |

Par catégorie (hold-out, B1) : A F1 0,36 (n = 17) · CH 0,45 · CR 0,37 · J 0,55 · LAW 0,50 · LTD 0,46 · TER 0,48 · USE 0,42.

Ce que cela fixe pour le protocole : (i) toute méthode graphe/règles se compare à **B1 ≈ 0,45** et au thème seul
≈ 0,22–0,24 ; (ii) la comparaison avec LexGLUE (Legal-BERT m-F1 0,83) n'est **pas** directe (autre découpe,
pas de plis par document, modèle fine-tuné) — B2 Legal-BERT sur nos plis reste à faire (Gate 6) ; (iii) les
petits effectifs (A 17, LAW 27, J 28 sur le hold-out) donnent des IC larges à afficher systématiquement.

Run `be3a372e…` : remplacé (seuils in-sample), conservé avec note `SUPERSEDED.md`.


## Agrégat binaire « phrase abusive » (run `24e6dcb9…`, 15 sept. soir) — comparable à la tâche Lab `U1_unfair`

Le run `24e6dcb9…` reproduit `6bf45ed8…` à l'identique (macro-F1 0,4472, mêmes IC à 10⁻³ près) et ajoute pour chaque
baseline l'agrégat binaire : positif si **au moins une catégorie** dépasse son seuil (fixé hors-échantillon), score = max
des scores normalisés par le seuil. Hold-out : 440 phrases abusives sur 4 078 (10,8 %).

| Baseline | F1 binaire (hold-out) [IC 95 % doc.] | P | R | AUC-PR |
|---|---|---|---|---|
| B0 majorité | 0,000 | — | — | 0,108 (= taux de base) |
| B0' thème seul (T11) | **0,391** [0,344 ; 0,441] | 0,286 | 0,618 | 0,233 |
| B1 TF-IDF + LR, contexte ±1 | **0,546** [0,512 ; 0,581] | 0,441 | 0,716 | 0,504 |
| **B1 via Pactiva Lab** (`unfair-tfidf-holdout`, run prod `2c554b8b…`, dataset `7116e627…`, cible binaire directe, argmax LR équilibrée) | **0,529** [0,492 ; 0,572] | 0,454 | 0,634 | 0,510 |

Lecture : les deux implémentations indépendantes (legal-kg un-contre-tous à 8 têtes agrégées ; Lab classifieur binaire
direct) tombent dans le même intervalle — c'est le **contrôle de parité** attendu avant B2. B2 Legal-BERT (Lab,
`unfair-legalbert-holdout`, même dataset, découpage `design_holdout`) se compare à **0,53–0,55** en F1 binaire et
≈ 0,50–0,51 en AUC-PR ; sa lecture par catégorie n'est pas disponible (cible binaire), la comparaison par catégorie reste
celle de la macro-F1 legal-kg.
