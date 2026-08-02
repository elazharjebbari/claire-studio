# Détecter les anomalies dans les ToS par un graphe **multi-label** : des thèmes fiables au raisonnement de graphe

> **Partie A** — le cadre corrigé et l'état de l'art récent qui le fonde.
> **Partie B** — le long tableau de 11 propositions d'articles, scorées.
> Recommandation : [`02_RECOMMANDATION_ET_ROADMAP.md`](02_RECOMMANDATION_ET_ROADMAP.md).

---

# Partie A — Le cadre corrigé

## A.1 Le problème, honnêtement posé

Le but est la **détection d'anomalies** dans les ToS — la raison d'être de CLAUDETTE (la clause
*abusive* au sens de la directive 93/13/CEE **est** l'anomalie). Une anomalie contractuelle est le plus
souvent **relationnelle** (une clause abusive *en contexte*, une clause qui **manque**, une combinaison
de sujets inhabituelle), donc invisible à un classifieur de phrases. On veut donc **représenter le
contrat comme un graphe** et y détecter des anomalies.

Mais trois faits imposent un cadre **plus prudent et mieux fondé** que « un contrat = un graphe
déontique » :

1. **Pas de nature déontique donnée.** CLAUDETTE ne fournit que **8 catégories d'abusivité + 3 niveaux
   de sévérité, par phrase** ; les annotateurs Pactiva produisent **thème (multi-label) + frontières +
   certitude + rationale**, **pas** la nature juridique (champ `legal_nature` optionnel, non renseigné).
2. **Clauses multi-thèmes.** Une clause porte **plusieurs thèmes** (`ClauseTheme` : un primaire + des
   secondaires) — le thème scalaire n'est qu'un miroir du primaire.
3. **Fiabilité d'abord.** On ne peut construire un graphe fiable qu'à partir de **thèmes fiables**. Or le
   « mur du κ » a montré que **le LLM seul échoue** à produire ces thèmes à l'échelle (κ 0,32–0,45).
   D'où la question fondatrice : **peut-on obtenir des thèmes fiables autrement — des humains formés,
   puis un classifieur supervisé — assez pour bâtir les graphes ?**

## A.2 Le pipeline « fondations d'abord »

```
ToS
 └─ F0  Segmentation en clauses (frontières)
 └─ F1  Annotation thématique MULTI-LABEL fiable        ◀── PRÉREQUIS (contribution à part entière)
        · IAA humain multi-label (Krippendorff α, distance MASI) + effet de la FORMATION
        · puis classifieur supervisé (Legal-BERT) SANS LLM génératif à l'inférence
 └─ F2  Graphe HYPERGRAPHE / BIPARTI clause–thèmes       ◀── multi-label natif
        · nœud clause relié à SES thèmes ; features = multi-hot thèmes + certitude + embedding + abusivité
        · nature déontique = couche PRÉDITE optionnelle (ablation « avec/sans »), jamais un axe donné
 └─ F3  Détection d'anomalies
        · CO-OCCURRENCE (combinaison de thèmes rare = hyperarc anormal)   ◀── nouveau, natif au multi-label
        · sémantique (clause vs ses thèmes) · complétude (thème attendu manquant) · relationnelle
 └─ F4  Audit des annotateurs (qualité du gold ; boucle vers F1)
```

**La segmentation thématique n'est pas une fin** (son F1 plafonne, « pur NLP ») : elle est le **substrat**
dont on établit d'abord la **fiabilité** (F1), puis dont on mesure la valeur par **l'utilité aval** en
détection d'anomalies (F3).

## A.3 La « pile d'anomalies » corrigée

| Niveau | Anomalie | Comment (approches récentes) | Évaluation |
|---|---|---|---|
| **L0 — Fiabilité** *(prérequis)* | Thèmes non fiables ⇒ graphe non fiable | **α de Krippendorff (MASI)** humain + formation ; **classifieur supervisé** (Legal-BERT) | α, micro/macro-F1, LRAP |
| **L1 — Normative** | **Clause abusive** (but de CLAUDETTE) | anomalie **de co-occurrence** de thèmes (hyperarc rare) ; classif contextuelle | labels UNFAIR-ToS (precision@k, AUC-PR) |
| **L2 — Sémantique** | Clause **mal étiquetée / atypique** | clause vs ses thèmes (OOD, proximité de centroïde) sur le gold enrichi | gold |
| **L3 — Relationnelle** | **Combinaison de thèmes inhabituelle** + **thème manquant** (complétude) + renvoi cassé | **hyperedge anomaly** (HGNN) · **co-occurrence** (Silva-Willett) · link prediction | oracle + checklist |
| **L3′ — Déontique** *(extension)* | Conflit normatif O∧F | **couche déontique PRÉDITE** (macro-F1 ~0,6) → **ablation du bruit** | oracle synthétique |
| **L4 — Annotation** | **Anomalies d'annotateurs** | Cleanlab, Data Maps, MACE, CROWDLAB ; désaccord (LeWiDi) | ré-annotation, entropie |

**Fil conducteur.** L0 conditionne tout ; L1–L3 sont la détection sur le graphe **multi-label** ; L3′
(déontique) est une **extension honnête** dont on **mesure le coût du bruit** ; L4 nettoie le gold. Le
« 18 % d'ambiguïté irréductible » du mur du κ est une **statistique à mesurer** (pas une constante), via
L4.

## A.4 État de l'art récent (grounding)

### L0 — Fiabilité de l'annotation thématique multi-label (sans LLM)
- **Mesurer l'accord multi-label.** Cohen/Fleiss κ **ne gèrent pas** le multi-label multi-annotateur ;
  la bonne pratique est **Krippendorff α avec distance MASI** (Passonneau, LREC 2006 — *Measuring
  Agreement on Set-valued Items* ; seuils ≥0,667 acceptable, ≥0,8 fiable). Cadre général : *Measuring
  Annotator Agreement Generally…* (arXiv 2022).
- **Effet de la formation.** *How Annotation Trains Annotators* (2024) — les guidelines + rounds de
  calibration **améliorent l'IAA surtout chez les experts**. Précédent domaine : CLAUDETTE (adjudication
  par 3ᵉ annotateur ; κ binaire **≈ 0,64**, *à revérifier dans Lippi et al. 2019*).
- **Classifieur supervisé fiable, sans LLM génératif.** **LEDGAR** (Tuggener et al., LREC 2020 —
  multi-label de provisions) et **UNFAIR-ToS** (dans **LexGLUE**, Chalkidis et al., ACL 2022) sont les
  bancs. SOTA (leaderboard LexGLUE) : **Legal-BERT** (Chalkidis et al., Findings EMNLP 2020) sur
  UNFAIR-ToS **μ-F1 96,0 / macro-F1 83,0** ; LEDGAR **88,2 / 83,0**. → **Oui**, on peut étiqueter un ToS
  inconnu à un niveau **utile**, mais **μ-F1 ≫ macro-F1** = **fragile sur les classes rares**. Métriques
  à rapporter : micro/macro-F1, **LRAP**, ranking loss.

### L3 — Graphe multi-label & détection d'anomalies
- **Encoder le multi-label.** Trois géométries : (a) **hypergraphe** — un hyperarc relie une clause à
  l'ensemble de ses thèmes : **HGNN** (Feng et al., AAAI 2019), **HyperGCN** (Yadati et al., NeurIPS
  2019), **UniGNN** (IJCAI 2021) ; (b) **biparti** clause–thème — **GraphBEAN**, **Eagle** (Neural
  Networks 2025), **BiG-FAN** (2025) ; (c) **nœud multi-label** — **CorGCN** (Bei et al., KDD 2025).
- **Anomalie de hyperarc / co-occurrence** *(cœur du signal)* : **Hyperedge Anomaly Detection with HGNN**
  (Alam et al., 2024, non supervisé) ; fondement conceptuel **co-occurrence multivariée rare = anomalie**
  : **Silva & Willett, IEEE TPAMI 2009** (*Hypergraph-Based Anomaly Detection of High-Dimensional
  Co-Occurrences*) ; *Outliers in Multi-label Datasets* (MICAI 2020) ; **anomalie conditionnelle**
  (Hauskrecht et al., 2016 — « cette combinaison est anormale *sachant* le contexte »).
- **Socle GAD** : **DOMINANT** (Ding et al., SDM 2019, reconstruction) comme baseline ; **UniGAD**
  (NeurIPS 2024, multi-niveaux nœud/arête/graphe) ; **AnomalyGFM** (2025, few-shot pour un ToS inédit) ;
  surveys Ma et al. (IEEE TKDE 2021/2023).
- **Poser la « normalité »** : graphes de co-occurrence de labels **ML-GCN** (Chen et al., CVPR 2019),
  *Label Graph Superimposing* (AAAI 2020) — inverser leur logique donne un **score d'anomalie de
  combinaison** (arêtes/hyperarcs de faible probabilité).

### L3′ — Déontique **prédite** (et son coût)
- Classification de modalité déontique : **Chalkidis et al.** (ACL 2018, obligation/prohibition) ;
  **LexDeMod** (Sancheti et al., EMNLP 2022, déontique multi-label lié à l'agent) ; **NLLP 2023**
  (Minkova et al., **macro-F1 ~0,61–0,62**). → Injecter une couche déontique prédite = **30–40 %
  d'erreur macro** sur classes minoritaires → **anomalies fantômes**. D'où : **feature auxiliaire
  évaluée en ablation**, jamais un axe structurant — **et c'est une contribution méthodologique**.

### L4 — Anomalies d'annotateurs
- **Cleanlab / Confident Learning** (Northcutt et al., JAIR 2021) ; **Data Maps** (Swayamdipta et al.,
  EMNLP 2020) ; **CROWDLAB**, **MACE** (Hovy et al., NAACL 2013), **IRT** ; désaccord légitime **LeWiDi**
  (Leonardelli et al., SemEval-2023), **ChaosNLI** (Nie et al., 2020) ; **Braun (AI & Law 2023)** — *le
  droit efface les traces de désaccord* (le gap à combler) ; accord robuste sur classes rares **Gwet
  AC1/AC2**.

## A.5 Positionnement de nouveauté (corrigé)

À notre connaissance (recherche non exhaustive), **personne ne combine** : *annotation thématique
multi-label fiable de clauses* + *hypergraphe clause–thèmes* + *détection d'anomalie de hyperarc /
co-occurrence* + *ancrage sur l'abusivité CLAUDETTE*, avec la déontique traitée en **couche prédite
mesurée**. Les briques existent séparément (HGNN, Alam 2024, Silva-Willett 2009, LEDGAR, Legal-BERT),
mais leur **assemblage sur ToS pour la détection d'abusivité** est ouvert. Travaux à différencier :
CLAUDETTE (phrase, pas de graphe), GRAPH-GRPO-LEX 2025 (KG de contrat *mono-étiquette*, métriques de
graphe, CUAD), LexGLUE (classification, pas d'anomalie de structure), ML-GCN (co-occurrence de labels
*hors* juridique et *hors* anomalie).

**Hypothèse centrale, testable :** *une clause abusive tend à cumuler une **combinaison hétérogène/rare
de thèmes** (ex. limitation de responsabilité + juridiction + modification unilatérale) ; cette
co-occurrence rare est détectable comme **hyperarc anormal**, et corrèle avec le label d'abusivité
CLAUDETTE.* **Vigilance :** rare ≠ abusif (une combinaison licite peut être atypique) → **évaluer contre
les labels** (precision@k, AUC-PR), pas seulement par la rareté.

---

# Partie B — Le long tableau des propositions

## B.1 Grille de scoring

6 dimensions, 0–5, **/30**. ⚑ = quasi-éliminatoire à JURIX. **AJ** ⚑ ancrage juridique/fit · **NV**
nouveauté · **RI** ⚑ rigueur empirique · **FA** faisabilité JURIX 2026 (sept.) · **RC** réception ·
**IM** impact. **≥25 → long** · 19–24 → short/long-si-mûr · <19 → poster/workshop.

## B.2 Détail des propositions

> Familles : **F** fondation/fiabilité (L0) · **G** graphe multi-label (L3) · **D** déontique prédite
> (L3′) · **A** annotateurs (L4) · **B** ressource.

### F1 — La fiabilité d'abord : peut-on annoter les thèmes de clauses de façon fiable (sans LLM) ?
- **Idée.** Établir empiriquement le **prérequis** : (a) **IAA humain multi-label** (α de Krippendorff,
  distance MASI) sur les thèmes, **avant/après formation** et **par thème** ; (b) entraîner un
  **classifieur supervisé** (Legal-BERT) sur le gold humain pour étiqueter un **ToS inconnu**, et
  mesurer s'il est **assez fiable pour bâtir un graphe**. Contraste explicite : **LLM-seul (mur du κ,
  échec) vs humains-formés vs classifieur supervisé**.
- **Approches récentes.** MASI (Passonneau 2006) ; *How Annotation Trains Annotators* ; LEDGAR/LexGLUE ;
  Legal-BERT.
- **Intérêt.** Répond frontalement à *« obtenir des thèmes fiables sans LLM, avec entraînement »* ;
  **prérequis de tout le programme** ; contraste fort avec les datasets semi-automatiques (LEDGAR).
- **Forces.** **Données de la campagne + méthodes sur étagère** → **très faisable** ; rigueur forte.
- **Faiblesses.** Besoin d'un **gold multi-annotateur** suffisant ; moins « spectaculaire ».
- **Faisabilité 2026.** **Haute.** · **Réception.** **Très bonne.**
- **Différenciation.** L'IAA MASI *avant/après formation* + le classifieur comme **condition de validité
  d'un graphe** juridique est un cadrage neuf.

### G1 — Détection d'anomalie de hyperarc pour découvrir les clauses abusives *(cœur inventif)*
- **Idée.** Modéliser chaque **clause comme un hyperarc reliant ses thèmes** (ou chaque thème comme
  hyperarc reliant ses clauses) ; appliquer un **HGNN non supervisé** (à la Alam et al. 2024) pour
  repérer les **associations de thèmes anormales** ; **évaluer les hyperarcs les plus anormaux contre
  les labels UNFAIR-ToS** (precision@k, AUC-PR). Baselines : DOMINANT, GraphBEAN (biparti).
- **Approches récentes.** HGNN/HyperGCN ; hyperedge AD (Alam 2024) ; Silva-Willett 2009 ; DOMINANT.
- **Intérêt.** Rend l'abusivité **relationnelle et multi-label** ; **premier pont hypergraphe-anomalie ↔
  abusivité** sur ToS.
- **Forces.** Très inventif ; **natif au multi-label** (répond au point 2) ; évaluable sur CLAUDETTE.
- **Faiblesses/risques.** **Petit N** (50 ToS) → régularisation/validation croisée par ToS ; dépend de
  la fiabilité des thèmes (F1) ; rare ≠ abusif → évaluer contre labels.
- **Faisabilité 2026.** **Moyenne.** · **Réception.** **Très bonne.**
- **Différenciation.** vs GRAPH-GRPO-LEX (mono-étiquette, métriques de graphe, CUAD) : **hypergraphe
  multi-label + HGNN-AD + ancrage abusivité ToS**.

### G2 — La co-occurrence de thèmes comme signal d'abusivité
- **Idée.** Construire le **graphe/matrice de co-occurrence** des thèmes (normalité de référence),
  définir un **score d'anomalie de combinaison** (arêtes/hyperarcs de faible probabilité), et le
  **corréler au caractère abusif**. Ablation : **rareté brute vs anomalie conditionnelle** (Hauskrecht).
- **Approches récentes.** ML-GCN / Label Graph Superimposing (normalité) ; co-occurrence anormale
  (Silva-Willett) ; outliers multi-label (MICAI 2020).
- **Intérêt.** Opérationnalise directement la découverte de thèse (**« cooccurrences non homogènes »
  ~9–15 %**) comme détecteur d'anomalie.
- **Forces.** Simple, interprétable, faisable ; fort ancrage empirique interne.
- **Faiblesses.** Peut être une **section de G1** plutôt qu'un papier seul.
- **Faisabilité 2026.** **Moyenne-haute.** · **Réception.** Bonne.
- **Différenciation.** ML-GCN fait de la *classification* ; ici on **inverse** pour la *détection
  d'anomalie* sur du juridique.

### G3 — Quelle géométrie pour l'anomalie multi-label en droit ? (biparti vs hypergraphe vs nœud-ML)
- **Idée.** Comparaison contrôlée **biparti** (GraphBEAN/Eagle) vs **hypergraphe** (HGNN/HyperGCN) vs
  **nœud-multi-label** (CorGCN) sur le même corpus ToS annoté ; guide de choix de représentation.
- **Intérêt.** Méthodologique, utile à la communauté ; question ouverte réelle.
- **Forces.** Rigueur ; réutilisable. · **Faiblesses.** « Comparatif » → moins d'insight juridique.
- **Faisabilité 2026.** **Moyenne.** · **Réception.** Moyenne-bonne.
- **Score-type :** *short*.

### G4 — Le thème manquant comme anomalie de complétude
- **Idée.** La taxonomie des thèmes = **checklist** attendue ; **link prediction** sur le graphe
  clause–thème signale les **thèmes attendus mais absents** d'un contrat (ex. rétractation, juridiction)
  ⇒ **anomalie de complétude**. Évaluation contre une checklist experte.
- **Approches récentes.** KG-embeddings / prédiction de liens ; ComplianceNLP (lacune = absence).
- **Intérêt.** Très concret (checklist automatique) ; protection consommateur.
- **Forces.** Réutilise le graphe (G1). · **Faiblesses.** « Normalité » de population à définir
  prudemment (petit N).
- **Faisabilité 2026.** **Moyenne.** · **Réception.** Bonne.

### D1 — Le coût du bruit déontique : faut-il ajouter une couche obligation/interdiction prédite ?
- **Idée.** Entraîner un **classifieur déontique** (LexDeMod / NLLP-2023, macro-F1 ~0,6), l'**injecter
  comme feature** du graphe, et **mesurer par ablation** son effet (positif/négatif) sur la détection
  d'anomalies. Contribution : **quantifier quand une couche prédite bruitée nuit** au graphe.
- **Approches récentes.** Chalkidis 2018 ; LexDeMod (EMNLP 2022) ; NLLP 2023.
- **Intérêt.** **Transforme la limite (pas de déontique donnée) en résultat méthodologique** ; honnête ;
  pont vers le raisonnement normatif (JURIX-natif) sans le sur-vendre.
- **Forces.** Inventif, rigoureux, réaliste. · **Faiblesses.** Dépend du graphe (G1) ; résultat peut
  être « négatif » (mais c'est publiable).
- **Faisabilité 2026.** **Moyenne.** · **Réception.** Bonne (méthodo + déontique).
- **Différenciation.** Personne ne **mesure le coût** d'une couche déontique prédite dans un graphe
  d'anomalies juridiques.

### G5 — Robustesse de la détection d'anomalies au bruit du classifieur thématique
- **Idée.** Étude de **sensibilité** : dégrader la qualité des labels thématiques (simuler macro-F1
  0,83 → 0,60) et mesurer la **stabilité des anomalies** détectées → **borne de fiabilité
  opérationnelle** (la « boucle de risque » : thèmes rares mal prédits ET porteurs d'anomalie).
- **Approches récentes.** Legal-BERT (μ≫macro) ; robustesse GAD.
- **Intérêt.** **Réponse directe à la fragilité multi-label** ; garde-fou méthodologique.
- **Forces.** Faisable (simulation) ; honnête. · **Faiblesses.** Section forte plutôt que papier seul.
- **Faisabilité 2026.** **Haute.** · **Réception.** Bonne.

### G6 — Détection d'anomalies *few-shot* sur un ToS inédit
- **Idée.** Un nouveau ToS a peu/pas d'exemples anormaux ; tester un **graph foundation model**
  (AnomalyGFM) ou un transfert Legal-BERT→graphe pour flaguer les clauses atypiques d'un contrat jamais
  vu, validé contre CLAUDETTE.
- **Intérêt.** **Passage à l'échelle « nouveau document »** (utilité pratique).
- **Forces.** Sujet porteur. · **Faiblesses.** Ambitieux ; petit N.
- **Faisabilité 2026.** **Faible-moyenne.** · **Réception.** Bonne. · **Type :** programme.

### A1 — Auditer un gold de clauses abusives par détection d'anomalies d'annotateurs
- **Idée.** Audit data-centric du gold multi-annotateur : **Cleanlab + Data Maps + CROWDLAB + MACE** →
  (a) taux d'erreurs d'étiquetage, (b) **fiabilité par annotateur** (biais par thème), (c) **erreur vs
  ambiguïté** ; **modéliser le désaccord** (LeWiDi, soft labels) ; **au-delà de κ** (Gwet AC, α-MASI).
- **Approches récentes.** Cleanlab, Data Maps, MACE, LeWiDi ; **Braun 2023** (gap).
- **Intérêt.** **Comble le gap de Braun 2023** ; répond à *« détecter les anomalies des annotateurs »* ;
  **nourrit F1** (nettoie le gold qui bâtit le graphe).
- **Forces.** **Haute faisabilité** (méthodes sur étagère + données) ; rigueur.
- **Faiblesses.** Dépend d'un gold multi-annotateur suffisant.
- **Faisabilité 2026.** **Haute.** · **Réception.** **Très bonne.**

### B1 — Un benchmark d'anomalies multi-label pour les ToS *(ressource)*
- **Idée.** Publier corpus enrichi (thèmes multi-label + graphe) + **benchmark** : baselines peu profonds
  (LOF/IF/OCSVM) vs deep (DOMINANT, HGNN-AD, GraphBEAN) sur la détection d'abusivité, avec **soft
  labels** (désaccord préservé). *Quel type de structure (nœud/arête/hyperarc) capte quel type
  d'injustice.*
- **Intérêt.** Ressource reconnue par JURIX (*datasets for AI & Law*) ; fédère le programme.
- **Forces.** Fort impact/citations. · **Faiblesses.** **Ambitieux** ; dépend de F1/G1 + gold mûr.
- **Faisabilité 2026.** **Faible** (programme 2027). · **Réception.** **Excellente.**

## B.3 Tableau de scoring consolidé

| # | Proposition (abrégé) | AJ⚑ | NV | RI⚑ | FA | RC | IM | **/30** | Horizon | Format |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **A1** | Audit gold — anomalies d'annotateurs | 4 | 4 | 5 | 5 | 5 | 4 | **27** | 2026 | **Long/Short** |
| **F1** | Fiabilité des thèmes (humain + classifieur, sans LLM) | 4 | 3 | 5 | 5 | 5 | 4 | **26** | 2026 | **Long** |
| **G1** | Hyperarc anormal → clauses abusives | 4 | 5 | 4 | 3 | 5 | 5 | **26** | 2026 | **Long** |
| **B1** | Benchmark d'anomalies ToS multi-label | 5 | 4 | 4 | 2 | 5 | 5 | **25** | Programme | Long (2027) |
| **G2** | Co-occurrence de thèmes = signal d'abusivité | 4 | 4 | 4 | 4 | 4 | 4 | **24** | 2026 | Short/section |
| **D1** | Coût du bruit déontique prédit (ablation) | 4 | 4 | 4 | 3 | 4 | 4 | **23** | 2026 | Short/section |
| **G5** | Robustesse au bruit du classifieur thématique | 3 | 4 | 4 | 5 | 4 | 3 | **23** | 2026 | Short/section |
| **G4** | Thème manquant = anomalie de complétude | 4 | 4 | 3 | 3 | 4 | 4 | **22** | 2026-27 | Short |
| **G3** | Géométrie : biparti vs hypergraphe vs nœud-ML | 3 | 4 | 4 | 3 | 3 | 3 | **20** | 2026-27 | Short |
| **G6** | Anomalie *few-shot* sur ToS inédit | 3 | 4 | 3 | 2 | 4 | 4 | **20** | Programme | Long (2027) |

**Lecture.** Trois têtes très proches : **A1** (le plus faisable, comble Braun, répond « anomalies
d'annotateurs »), **F1** (le prérequis, répond « thèmes fiables sans LLM »), **G1** (le plus inventif, le
graphe multi-label). Elles **s'enchaînent naturellement** (F1 → G1, A1 → F1). La stratégie de
portefeuille est dans [`02_RECOMMANDATION_ET_ROADMAP.md`](02_RECOMMANDATION_ET_ROADMAP.md).

---

## Notes de fiabilité

- **Citations** issues des trois revues commandées (ACL/arXiv/éditeurs) ; quelques ID/pagination marqués
  « à vérifier » (Legal-BERT Findings EMNLP 2020 ; ML-GCN CVPR 2019 ; *How Annotation Trains Annotators*
  2024 ; chiffres du hyperedge-AD 2024) — **à re-confirmer avant soumission**.
- **CLAUDETTE** : complet = **100 ToS / 20 417 clauses / ~9:1** ; sous-ensemble projet = **50 ToS /
  9 414 phrases**. κ binaire **≈ 0,64** *à revérifier dans Lippi et al. 2019*.
- **SOTA classification** (LexGLUE) : Legal-BERT UNFAIR-ToS **μ-F1 96 / macro-F1 83** — l'écart μ≫macro
  est le point de rigueur central (thèmes rares fragiles).
- **Déontique prédite** ~**macro-F1 0,6** → couche **optionnelle évaluée**, jamais un axe donné.
- Le **« 18 % d'ambiguïté irréductible »** = statistique à **mesurer sur le gold**, pas une constante.
