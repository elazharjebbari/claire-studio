# Recommandation & feuille de route — programme corrigé (multi-label, fiabilité d'abord)

> Analyse comparative des 11 propositions ([`01_CADRE_ET_PROPOSITIONS.md`](01_CADRE_ET_PROPOSITIONS.md)
> §B) et recommandation, intégrant les trois corrections (pas de déontique donnée · clauses
> multi-thèmes · fiabilité d'annotation en prérequis).

---

## 1. En une page

> ## 🏆 Recommandation : un portefeuille « fondation → graphe », dé-risqué
>
> **Papier phare (long)** — **F1 + G1 (+ G2)** :
> ### *« From Reliable Multi-Label Clause Themes to Hypergraph-Based Detection of Unfair Clauses in Terms of Service »*
> **(1)** On établit d'abord que l'on peut annoter les **thèmes multi-label** de façon **fiable sans
> LLM génératif** (IAA **α de Krippendorff/MASI** humain + effet de la formation ; puis **classifieur
> supervisé Legal-BERT**) — le **prérequis** pour bâtir un graphe. **(2)** On modélise le contrat en
> **hypergraphe clause–thèmes** et on détecte les **hyperarcs anormaux / co-occurrences de thèmes
> rares**, **évalués contre les labels d'abusivité CLAUDETTE** (precision@k, AUC-PR). **Ablations :** le
> **coût du bruit déontique prédit** (D1) et la **robustesse au bruit du classifieur** (G5).
>
> **Papier compagnon (short)** — **A1** :
> ### *« Auditing an Unfair-Clause Gold: Label Errors, Annotator Reliability, and Disagreement »*
> Détection d'**anomalies d'annotateurs** (Cleanlab/Data Maps/MACE) + désaccord (LeWiDi) — **faisable**,
> comble **Braun 2023**, et **nourrit** la fiabilité du phare.
>
> **Valve de décision (mi-août)** : si le pipeline hypergraphe n'est pas mûr, **promouvoir F1 + A1 en
> *long*** (« fiabilité de l'annotation + audit du gold », 26–27/30, **haute faisabilité**) et rétrograder
> G1 en *short* « preuve de concept ». Gagnant dans les deux cas.

**Pourquoi.** Ce portefeuille **répond aux trois remarques** : la **fiabilité** est la colonne
vertébrale (point 3), le **multi-label** est natif (hypergraphe + co-occurrence, point 2), la
**déontique** est reléguée à une **ablation honnête** (point 1). Il **maximise l'invention** (G1) tout en
**bornant le risque** (F1/A1 très faisables), couvre les deux tracks JURIX et **amorce un programme**.

---

## 2. Analyse comparative

**Trois têtes qui s'enchaînent, pas trois rivales.** A1 (27) nettoie le gold ; **F1 (26)** prouve qu'on
peut en tirer des thèmes fiables **sans LLM** ; **G1 (26)** en fait un hypergraphe où l'anomalie
(abusivité) émerge. C'est **une seule chaîne** : `A1 → F1 → G1`. La question n'est pas « laquelle ? »
mais « **combien** en met-on dans le papier phare, et laquelle sécurise ? ».

- **F1 est le pivot.** Sans lui, G1 est bâti sur du sable (et un reviewer JURIX le pointera
  immédiatement). Avec lui, G1 devient défendable. F1 **répond directement** à *« thèmes fiables sans
  LLM, avec entraînement »* et **contraste avec le mur du κ** (LLM-seul échoue).
- **G1 porte l'invention** (hypergraphe multi-label + anomalie de co-occurrence ↔ abusivité), mais son
  risque est le **petit N** (50 ToS) et la **dépendance à F1**.
- **A1 est le filet** (haute faisabilité, comble Braun 2023, répond à *« anomalies d'annotateurs »*) et
  **alimente** F1 (un gold audité est un meilleur gold d'entraînement).
- **G2 (co-occurrence)** est le **mécanisme** de G1 (souvent une section) ; **D1 (déontique) et G5
  (robustesse)** sont des **ablations** qui **transforment les limites en résultats**.
- **B1, G3, G4, G6** sont excellents mais **programme** (2027).

**Écarté du cœur 2026 :** G6 (ambitieux, petit N) ; G3 (comparatif, moins d'insight juridique) → *short*
ou roadmap.

---

## 3. Le papier phare (long, ≤10 p.)

**Titre (proposition, EN) :**
> **From Reliable Multi-Label Clause Themes to Hypergraph-Based Detection of Unfair Clauses in Terms of
> Service.**

**Résumé (ébauche).**
> Détecter les clauses abusives dans les conditions d'utilisation est traité comme une classification de
> phrases, ce qui ignore que l'abusivité est souvent **relationnelle** — une **combinaison inhabituelle
> de sujets juridiques**. Nous montrons d'abord que l'on peut obtenir une **annotation thématique
> multi-label fiable** des clauses **sans recourir à un LLM génératif** : nous mesurons l'accord
> inter-annotateur multi-label (α de Krippendorff, distance MASI) d'annotateurs **formés**, et nous
> entraînons un **classifieur supervisé** (Legal-BERT) capable d'étiqueter un contrat inédit à un niveau
> utile — tout en documentant sa **fragilité sur les thèmes rares** (micro-F1 ≫ macro-F1). Nous
> représentons ensuite chaque contrat en **hypergraphe clause–thèmes** et détectons, **sans
> supervision**, les **hyperarcs / co-occurrences de thèmes anormaux** ; nous évaluons ces anomalies
> **contre les labels d'abusivité de CLAUDETTE** (precision@k, AUC-PR) et non par la seule rareté. Nous
> quantifions enfin, par **ablation**, (i) le **coût d'une couche déontique prédite** (bruitée, macro-F1
> ~0,6) et (ii) la **robustesse** de la détection au bruit du classifieur thématique. Nous publions le
> protocole et le schéma de graphe.

**Contributions.**
1. **Fiabilité (L0)** : un protocole et une mesure (α-MASI, avant/après formation) établissant qu'une
   **annotation thématique multi-label fiable est atteignable sans LLM**, avec un classifieur supervisé
   pour l'appliquer à un ToS inédit — **prérequis** de tout graphe.
2. **Modélisation multi-label (L3)** : l'**hypergraphe clause–thèmes** comme représentation fidèle du
   multi-label, où l'**anomalie de co-occurrence** est un signal d'abusivité.
3. **Détection & évaluation** : hyperarcs anormaux **évalués contre l'abusivité CLAUDETTE** (pas la
   rareté seule) ; baselines peu profonds vs deep (DOMINANT, GraphBEAN).
4. **Deux résultats méthodologiques par ablation** : le **coût du bruit déontique prédit** (faut-il
   ajouter cette couche ?) et la **borne de robustesse** au bruit du classifieur thématique.

**Plan (10 pages).**
1. Introduction — abusivité = anomalie relationnelle ; pourquoi la phrase ne suffit pas.
2. Related work — CLAUDETTE/lignée EUI ; LEDGAR/LexGLUE ; **hypergraphes & GAD** (HGNN, Alam 2024,
   Silva-Willett) ; co-occurrence de labels (ML-GCN). *Delta explicite* (cf. §A.5 du doc 1).
3. **Fiabilité des thèmes** — IAA multi-label (α-MASI) + formation ; classifieur supervisé (Legal-BERT),
   micro/macro-F1, LRAP ; contraste avec LLM-seul (mur du κ).
4. **Hypergraphe clause–thèmes** — construction depuis le gold Pactiva ; features.
5. **Détection d'anomalies** — hyperarc/co-occurrence ; évaluation vs UNFAIR-ToS ; baselines.
6. **Ablations** — couche déontique prédite (D1) ; robustesse au bruit (G5).
7. Discussion (petit N, rare≠abusif, biais) & conclusion (+ artefacts).

**Différenciation (noir sur blanc).** vs **CLAUDETTE** : abusivité **relationnelle & multi-label**, pas
phrase ; vs **GRAPH-GRPO-LEX** (2025) : **hypergraphe multi-label + HGNN-AD + ancrage abusivité ToS** (eux
: KG mono-étiquette, métriques de graphe, CUAD) ; vs **LexGLUE/LEDGAR** : **détection d'anomalie de
structure**, pas classification ; vs **ML-GCN** : on **inverse** la co-occurrence pour la détection
d'anomalie, en **juridique**.

**Plan d'expériences (corrigé).**
- **[F1 — fiabilité]** Calculer **α-MASI** sur les thèmes multi-label du gold (par thème, avant/après
  formation si les données le permettent) ; entraîner **Legal-BERT** multi-label sur le gold humain,
  rapporter **micro/macro-F1, LRAP** et l'**incertitude par thème** (les rares).
- **[F2 — graphe]** Construire l'**hypergraphe clause–thèmes** des 50 ToS (hyperarc = clause↔ses thèmes ;
  features = multi-hot thèmes + certitude + embedding Legal-BERT + label CLAUDETTE comme cible faible).
- **[F3 — anomalie]** **HGNN-AD non supervisé** (Alam 2024) + **co-occurrence** (Silva-Willett) ;
  baselines LOF/IsolationForest/OCSVM et DOMINANT/GraphBEAN ; **évaluer contre UNFAIR-ToS** (precision@k,
  AUC-PR), **par famille de thèmes** (procédurale {J,LAW,A} vs opérationnelle) ; validation croisée **par
  ToS** ; **rare ≠ abusif** discuté.
- **[Ablation D1]** classifieur déontique (LexDeMod/NLLP, macro-F1 ~0,6) injecté comme feature → effet
  sur l'AUC-PR (aide/nuit ?).
- **[Ablation G5]** dégrader les labels thématiques (macro-F1 0,83 → 0,60) → stabilité des anomalies.
- **[Repro]** publier schéma de graphe + protocole (+ corpus enrichi si permis).

---

## 4. Le papier compagnon (short, ≤5 p.) — A1

**Titre :** *Auditing an Unfair-Clause Gold: Label Errors, Annotator Reliability, and Disagreement.*
Détection d'anomalies d'annotateurs (**Cleanlab + Data Maps + CROWDLAB + MACE**), **modélisation du
désaccord** (LeWiDi, soft labels), **au-delà de κ** (Gwet AC / α-MASI sur la prévalence ~9:1). **Comble
Braun 2023**, répond à *« détecter les anomalies des annotateurs »*, et **fournit le gold audité** qui
alimente la fiabilité (F1) du phare. Fusionnable avec F1 en un *long* si l'on préfère un seul papier
« fiabilité + audit ».

---

## 5. Feuille de route pluriannuelle

| Phase | Horizon | Livrables | Propositions |
|---|---|---|---|
| **P1 — Fondation & graphe** | **JURIX 2026** | Fiabilité des thèmes (sans LLM) + hypergraphe + anomalie de co-occurrence ↔ abusivité + ablations | **F1, G1, G2** (long) · **D1, G5** (ablations) · **A1** (short) |
| **P2 — Extensions** | **2027** | **Géométrie** (biparti vs hypergraphe, G3) · **complétude** (thème manquant, G4) · **few-shot** ToS inédit (G6) · raisonnement de conflit déontique (si couche fiabilisée) | **G3, G4, G6** |
| **P3 — Ressource** | **2027-28** | **Benchmark d'anomalies ToS multi-label** (baselines + soft labels) + publication du corpus enrichi ; volet cross-lingue FR | **B1** |
| **P4 — Boucle qualité** | continu | Arbitrage priorisé (active-learning HLV) intégré à Pactiva | *(cf. dossiers annexes)* |

**Fil narratif de thèse :** *le LLM seul échoue à produire un gold thématique à l'échelle (mur du κ) → on
audite et fiabilise l'annotation humaine multi-label (A1, F1) → ce gold fiable devient un hypergraphe où
les clauses abusives émergent comme co-occurrences anormales (G1) → on étend (géométrie, complétude,
few-shot) et on publie une ressource.* Chaque phase = un papier.

---

## 6. Risques & mitigations

| Risque | Prob. | Impact | Mitigation |
|---|---|---|---|
| **Pipeline hypergraphe (G1) non abouti** | Moyenne | Élevé | **Valve mi-août** : F1 + A1 en *long* ; G1 → *short* PoC. |
| **Gold multi-annotateur insuffisant** (F1/A1) | Moyenne | Élevé | Cibler un **échantillon stratifié** sur-annoté (≥2–3 annotateurs) ; suffisant pour α-MASI et l'audit. |
| **Petit N (50 ToS)** → sur-apprentissage GNN/HGNN | Réelle | Moyen | Baselines peu profonds sérieux ; **validation croisée par ToS** ; rapporter la dispersion ; AnomalyGFM/transfert en repli. |
| **rare ≠ abusif** (faux positifs de co-occurrence) | Réelle | Moyen | **Évaluer contre labels** (precision@k, AUC-PR), pas la rareté ; anomalie conditionnelle (Hauskrecht). |
| **Fragilité macro-F1 sur thèmes rares** (boucle de risque) | Réelle | Moyen | La **quantifier** (G5) au lieu de la subir ; rapporter l'incertitude par thème. |
| **Couche déontique prédite bruitée** | Certaine | Faible (traité) | **Ablation D1** ; ne jamais en faire un axe donné. |
| **Perçu « trop ML »** (⚑) | Faible-moy. | Élevé | Ancrage **protection consommateur** + lignée CLAUDETTE ; l'IAA et la fiabilité sont des questions **juridiques** de qualité de preuve. |

---

## 7. Décisions à trancher avec le porteur / l'encadrant

1. **Ambition 2026** : viser le *long* F1+G1 (fiabilité → hypergraphe) avec A1 en filet — **recommandé**.
2. **État réel de la campagne** : combien de ToS **multi-annotés** aujourd'hui (détermine α-MASI, l'audit
   A1 et l'entraînement du classifieur F1) ? *Je peux l'extraire de la prod.*
3. **Un jeu de test d'anomalies** : au-delà des labels CLAUDETTE (cible faible), produire une petite
   **vérité-terrain d'anomalies de co-occurrence** (20–30 cas jugés) fiabiliserait l'évaluation de G1.
4. **Géométrie du graphe** : commencer par l'**hypergraphe** (le plus fidèle) et garder le **biparti**
   (GraphBEAN) comme comparateur ; outil PyG/DGL + hypergraph lib.
5. **Publier le corpus enrichi** (thèmes multi-label + graphe) dès 2026 (licence/DOI) ou en P3 ?
6. **Fusion ou deux papiers** : F1+A1 peuvent fusionner en un *long* « fiabilité + audit » **très sûr**
   si G1 n'est pas prêt.

---

## Note de fiabilité

Recommandations fondées sur la vérification du code (`ClauseTheme` multi-label ; `legal_nature`
optionnel), le matériau de thèse et **trois revues de littérature** dont les citations sont **réelles
mais à re-confirmer** (quelques ID/pagination « à vérifier »). La faisabilité 2026 dépend d'un **état
réel de la campagne d'annotation** à établir. Le caractère inédit de la combinaison (hypergraphe
multi-label + anomalie de co-occurrence ↔ abusivité ToS) est affirmé « à notre connaissance ». Dates et
quotas JURIX à revérifier à la source.
