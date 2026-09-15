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


## B2 — Legal-BERT fine-tuné, cible binaire (Lab, run prod `bb37a8ce…`, job OAR 2067180, 15 sept. 09:02–09:06)

Preset `unfair-legalbert-holdout` : `nlpaueb/legal-bert-base-uncased`, hyperparamètres de E4.4 (8 époques max, lot 16, lr 2e-5,
perte pondérée, arrêt précoce patience 3, contexte ±1 phrase, 128 tokens), **un seul entraînement sur les 33 documents de
conception, une seule mesure sur les 17 du hold-out** (`design_holdout`), décision = argmax (aucun seuil réglé), dataset
`7116e627…`. Matériel : A100-SXM4-40GB (sirius, lyon). Copie du `results.json` dans `B2_lab_bb37a8ce/`.

| Modèle (hold-out, 4 078 phrases, 440 abusives) | F1 abusif [IC 95 % doc.] | P | R | AUC-PR | κ | ECE |
|---|---|---|---|---|---|---|
| B0' thème seul (legal-kg, agrégat binaire) | 0,391 [0,344 ; 0,441] | 0,286 | 0,618 | 0,233 | — | — |
| B1 TF-IDF + LR (legal-kg, agrégat) | 0,546 [0,512 ; 0,581] | 0,441 | 0,716 | 0,504 | — | — |
| B1 TF-IDF + LR (Lab, binaire direct) | 0,529 [0,492 ; 0,572] | 0,454 | 0,634 | 0,510 | 0,462 | 0,335 |
| **B2 Legal-BERT (Lab)** | **0,701** [0,650 ; 0,749] | 0,643 | 0,770 | **0,775** | 0,661 | **0,056** |

Matrice de confusion B2 (lignes = vérité) : fair 3 450 / 188 ; unfair 101 / 339. Taux d'erreur sur les phrases abusives 23,0 %
(B1 Lab : 36,6 %).

Ce que cela fixe : (i) **le plancher texte-seul à battre ou à expliquer est désormais B2 ≈ 0,70 de F1 binaire / 0,77 d'AUC-PR**
sur le hold-out, pas B1 ; (ii) l'écart B2 − B1 (+0,17, IC disjoints) mesure ce que la capacité d'un encodeur juridique apporte
**sans structure** — toute approche graphe/règles (E2, A3–A8) devra montrer un gain *au-delà* de B2 ou un apport en
explicabilité/précision par item que B2 ne fournit pas (B2 ne dit ni quel item de l'annexe, ni pourquoi) ; (iii) B2 reste un
classifieur de phrases : la comparaison par item de la grey list (RQ2) et l'évaluation d'explication (RQ4) n'ont pas d'équivalent
côté B2, ce qui est précisément la contribution visée par 157.

## Analyse d'erreurs B2 (et B1) — `src/evaluation/analyse_lab_predictions.py` → `B2_lab_bb37a8ce/ANALYSIS.md`

- **Rappel par catégorie (B2)** : TER 0,89 · J 0,86 · LAW 0,85 · CR 0,81 · LTD 0,74 · CH 0,74 · USE 0,73 · **A 0,65** (n = 17). Les
  phrases à ≥ 2 catégories sont presque toutes vues (rappel 0,93, n = 44).
- **Par thème T11** : F1 0,72–0,79 dans les thèmes porteurs (TERMINATION, MODIFICATION, DISPUTES_LAW, LIMITATION_LIABILITY),
  **0,37–0,58** dans les thèmes à faible taux de base (THIRD_PARTY_SERVICES, FRAMEWORK, ACCOUNT_USE, WARRANTY) : c'est la
  **précision** qui chute (0,33–0,53), pas seulement le rappel.
- **Les erreurs sont confiantes** : 83/101 faux négatifs ont un score « abusif » < 0,1 et 129/188 faux positifs > 0,9. Un
  ré-étalonnage de seuil ne les récupérerait pas ; il manque de l'information, pas de la calibration (ECE 0,056).
- **Indépendance de l'accord humain sur le thème** : taux d'erreur 0,068–0,074 quelle que soit la classe d'accord — l'ambiguïté
  thématique n'explique pas les erreurs d'abusivité.
- **Recouvrement B1/B2** sur les 440 phrases abusives : 243 vues par les deux, 96 par B2 seul, 36 par B1 seul, **65 par aucun**.
  Ces 65 phrases (et les 188 faux positifs de B2) sont la cible naturelle des approches structurelles (E2, A3–A8) et de
  l'analyse qualitative (ERROR_ANALYSIS.md) : à extraire en priorité dans le pilote si elles tombent dans le hold-out (elles y
  sont toutes) — sans jamais les utiliser pour régler les règles (gel).
- Dispersion par document : F1 de 0,49 (WorldOfWarcraft) à 0,86 (PokemonGo), médiane 0,72.
