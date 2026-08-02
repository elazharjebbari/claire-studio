# Recommandation & feuille de route — un programme de détection d'anomalies pour les ToS

> Analyse comparative des 12 propositions ([`01_PROGRAMME_ANOMALIES.md`](01_PROGRAMME_ANOMALIES.md)
> §B), recommandation d'un **portefeuille** pour JURIX 2026, et **roadmap pluriannuelle** (la recherche
> continue).

---

## 1. En une page

> ## 🏆 Recommandation : un portefeuille à deux papiers pour JURIX 2026, adossé à un programme
>
> **Le programme (thèse) :** *détecter les anomalies des ToS à quatre niveaux — abusive (L1),
> sémantique (L2), relationnelle/déontique (L3), annotateur (L4) — en transformant le contrat en
> **graphe de connaissances déontique** grâce à l'annotation Pactiva.*
>
> **Papier phare (long, inventif)** — **G1 + G4** :
> ### *« The Deontic Contract Graph: Structural and Normative Anomaly Detection in Terms of Service »*
> Contrat → KG de clauses typées `(thème, nature déontique O/F/P)` → **détection d'anomalies de graphe
> par GNN** (DOMINANT/OCGNN/TAM) ancrée sur l'abusivité **CLAUDETTE**, avec la **segmentation
> thématique évaluée par son utilité aval** (G4) et un premier jet **conflit déontique** (G3) /
> **complétude** (G2). C'est la **force de proposition principale** et une **niche inédite** (à notre
> connaissance).
>
> **Papier compagnon (short, dé-risqué)** — **A1 (+A2/A3)** :
> ### *« Auditing an Unfair-Clause Gold: Label Errors, Annotator Reliability, and Irreducible Ambiguity »*
> Détection d'**anomalies d'annotateurs** (Cleanlab + Data Maps + MACE + CROWDLAB) sur le gold
> multi-annotateur, **modélisation du désaccord** (LeWiDi, soft labels) et **au-delà de κ** (Gwet AC).
> **Entièrement faisable**, comble le **gap de Braun 2023**, et **garantit une présence** à Toulouse.
>
> **Valve de décision (mi-août)** : si le pipeline graphe ne produit pas de résultats propres à temps,
> **promouvoir A1+A2 en *long*** (score 26–27/30, faisabilité haute) et rétrograder le graphe en
> *short* « vision + preuve de concept ». Le portefeuille reste gagnant dans les deux cas.

**Pourquoi ce choix.** Il **maximise l'invention** (le graphe déontique, que personne n'assemble sur
ToS) **tout en bornant le risque** (l'audit annotateur est un filet de sécurité à haute faisabilité qui,
en prime, **répond à une demande explicite**). Il **couvre les deux tracks JURIX** (I logique/normatif,
II NLP/ML) et **surfe sur les sujets chauds** (neuro-symbolique, human-in-the-loop, hallucination,
perspectivism). Et il **amorce un programme** de plusieurs papiers, pas un one-shot.

---

## 2. Analyse comparative (synthèse)

**Deux pôles.** Le tableau fait apparaître un pôle **haute-ambition/haute-nouveauté mais programme**
(G1 26, G3 25, B1 25 — construction lourde, faisabilité 2–3/5) et un pôle **inventif-ET-faisable-2026**
(A1 27, A2 26, G4 24, + le **mur du κ** v1 à 29). La tentation serait de jouer la sécurité (pôle 2) ; ce
serait passer à côté de la demande — *plus inventif, centré graphe & anomalies*. La bonne réponse n'est
pas de choisir un pôle mais de **les articuler en portefeuille** : le graphe porte l'ambition, l'audit
porte la sécurité, et **les deux appartiennent au même programme** (L4 conditionne L1–L3).

**Ce qui départage les têtes de liste :**
- **G1 (graphe déontique)** est **le plus inventif et le plus différenciant** (pont Track I↔II, niche
  vierge), mais **le plus coûteux à construire** → livrable en *slice* évaluable en 2026, plein en 2027.
- **A1 (audit annotateur)** est **le mieux noté sur le combiné faisabilité×rigueur×réception** (27/30)
  et **comble un gap identifié** (Braun 2023) → **le meilleur pari « acceptation » de 2026**.
- **A2 (désaccord/soft labels)** **relie** le résultat fort du dossier v1 (mur du κ) à un cadre reconnu
  (perspectivism) → excellent complément d'A1, potentiellement fusionnable en un *long*.
- **G4 (segmentation = prior d'anomalie)** **neutralise** la faiblesse « pur NLP » qui plombait la
  segmentation au dossier v1 → la brique qui **arrime** le graphe à l'existant.
- **G3, B1, J1, G2** sont **excellents mais moyen terme** → roadmap.

**Ce qui est écarté du cœur 2026 :** S1 (trop étroit seul), A3 (méthodo *short*), A4 (à monter). Ils
restent des **compléments** ou des **sections**.

---

## 3. Le papier phare (long, ≤10 p.) — le Graphe de Contrat Déontique

**Titre (proposition, EN) :**
> **The Deontic Contract Graph: Structural and Normative Anomaly Detection in Terms of Service.**

**Résumé (ébauche).**
> Les détecteurs de clauses abusives opèrent phrase par phrase et ignorent la **structure normative**
> du contrat, alors qu'une clause est abusive *en contexte*, qu'une clause peut **manquer**, et que deux
> clauses peuvent se **contredire**. Nous représentons chaque *Terms of Service* comme un **graphe de
> connaissances déontique** : les nœuds sont des **clauses typées** par thème (≈20) et par **nature
> déontique** (obligation / interdiction / permission, plus les natures constitutives), les arêtes
> encodent parties, définitions, renvois, adjacence thématique et conflits. Sur ce graphe, nous
> appliquons des **détecteurs d'anomalies de graphe** (peu profonds — LOF, Isolation Forest, One-Class
> SVM ; et profonds — DOMINANT, OCGNN, TAM) et testons l'hypothèse que **les clauses abusives de
> CLAUDETTE sont des nœuds à faible affinité déontique** avec leur voisinage. Nous montrons en outre que
> **la qualité de la segmentation thématique se mesure par son utilité aval** en détection d'anomalies,
> et esquissons deux extensions : la **clause manquante** comme lien improbable et le **conflit
> déontique** comme arête d'anomalie. Nous publions le schéma du graphe et le protocole.

**Contributions.**
1. Une **représentation** : le graphe de connaissances **déontique** d'un ToS, dérivé de l'annotation
   Pactiva (première application du typage déontique O/F/P à la détection d'anomalies sur CLAUDETTE).
2. Une **évaluation** : quels détecteurs d'anomalies de graphe (nœud/arête/sous-graphe) capturent quels
   types d'injustice CLAUDETTE — avec baselines peu profonds et profonds.
3. Une **méthodologie** : évaluer la **segmentation thématique par son utilité aval** (G4), et non par
   un F1 qui plafonne.
4. Des **extensions démontrées en préliminaire** : complétude (G2) et conflit déontique (G3).

**Plan (10 pages).**
1. Introduction — l'anomalie contractuelle est relationnelle ; limite « phrase » de CLAUDETTE.
2. Related work — **GRAPH-GRPO-LEX, OLG++, ComplianceNLP** (KG de contrats) ; **Aires 2017, LegalRuleML**
   (déontique) ; **GAD** (Ma 2023) ; CLAUDETTE/lignée EUI. *Delta explicite* (cf. table §A.4 du doc 1).
3. Le graphe de contrat déontique — schéma, nœuds/arêtes, construction depuis l'annotation Pactiva.
4. Détection d'anomalies de nœud — baselines vs GNN-GAD, ancrage CLAUDETTE, homophilie déontique.
5. La segmentation comme *prior* — ablation « utilité aval ».
6. Extensions — complétude (link prediction) + conflit déontique (préliminaire, oracle synthétique).
7. Discussion (limites : petit N de graphes, dépendance au gold) & conclusion (+ artefacts).

**Différenciation (à écrire noir sur blanc).** vs **GRAPH-GRPO-LEX** (2025) : nous ajoutons **GNN-GAD +
homophilie déontique + segmentation thématique**, sur **ToS/CLAUDETTE** (eux : *linter* par métriques de
graphe, CUAD) ; vs **OLG++** : nous **détectons**, ils **représentent** ; vs **Aires 2017** : **KG
global + GAD**, pas des paires ; vs **CLAUDETTE** : l'abusivité devient **relationnelle et structurelle**.

**Plan d'expériences.**
- **[Construire]** Graphe déontique des 50 ToS depuis le gold Pactiva (nœuds = clauses ; features =
  embeddings LegalBERT + one-hot thème + one-hot nature ; arêtes = adjacence/renvoi/similarité).
- **[Mesurer]** GAD nœud : LOF / IsolationForest / OCSVM vs DOMINANT / OCGNN / TAM ; cible = clause
  abusive CLAUDETTE ; rapporter AUROC/AUPRC **par famille** de thèmes (procédurale vs opérationnelle).
- **[Ablation G4]** segmentation « stratégie B » vs classifieur vs gold humain → effet sur le GAD aval.
- **[Préliminaire G2/G3]** link prediction RotatE (clause manquante) sur split de ToS ; conflits
  **synthétiques** (oracle déterministe) pour valider la détection de sous-graphe.
- **[Éthique/repro]** publier schéma + code + (si permis) sous-corpus enrichi.

---

## 4. Le papier compagnon (short, ≤5 p.) — l'audit du gold (anomalies d'annotateurs)

**Titre (proposition, EN) :**
> **Auditing an Unfair-Clause Gold: Label Errors, Annotator Reliability, and Irreducible Ambiguity.**

**Idée.** Sur le gold multi-annotateur Pactiva : (a) **détecter les clauses mal étiquetées** (Confident
Learning/Cleanlab + Data Maps + AUM + CROWDLAB) et quantifier le **taux réel d'erreurs** (à la Northcutt
2021) ; (b) **profiler la fiabilité des annotateurs** (MACE *trustworthiness*, confusion Dawid-Skene par
thème, ability IRT) ; (c) **isoler l'ambiguïté irréductible** (région *ambiguous* de Cartography +
entropie du modèle d'annotation, cadre ChaosNLI/LeWiDi), en **reformulant les « 18 % » du mur du κ**
comme **variation humaine mesurée**. Bonus : **au-delà de κ** (Gwet AC1/AC2 sur la prévalence ~9:1) et
**priorité d'arbitrage** (ActiveLab).

**Pourquoi c'est fort.** **Haute faisabilité** (méthodes sur étagère + données campagne) ; **comble le
gap de Braun 2023** (le droit efface le désaccord) ; **répond explicitement** à *« détecter les
anomalies des annotateurs »* ; **valorise le module GOLD** de Pactiva ; **sécurise** une acceptation.

**Lien au phare.** L4 **nettoie le gold** qui entraîne/évalue le GAD du phare (L1–L3) : les deux papiers
sont **le même programme** vu de deux bouts. On peut d'ailleurs les **fusionner en un seul *long*** si
l'on préfère un unique papier « du gold audité au graphe d'anomalies ».

---

## 5. Feuille de route pluriannuelle (la recherche continue)

| Phase | Horizon | Livrables | Propositions |
|---|---|---|---|
| **P1 — Amorçage** | **JURIX 2026** (déc. 2026) | Graphe déontique + GAD nœud (PoC évaluable) **+** audit du gold (anomalies d'annotateurs) | **G1, G4** (long) · **A1, A2, A3** (short) |
| **P2 — Raisonnement** | **JURIX / ICAIL / AI & Law 2027** | **Conflit déontique** complet (neuro-symbolique : *le GNN propose, LegalRuleML dispose*) · **LLM-juge ancré KG** (GraphRAG anti-hallucination) · **complétude** (clause manquante) | **G3, J1, G2** |
| **P3 — Ressource** | **2027-2028** | **Benchmark unifié d'anomalies ToS** (L1–L4) + baselines · volet **cross-lingue FR↔EN** (dossier v1, P7) · publication du corpus enrichi | **B1** (+ v1-P7) |
| **P4 — Arbitrage actif** | continu | **Arbitrage priorisé** par active-learning HLV intégré à Pactiva (boucle qualité) | **A4** |

**Fil narratif du programme (pour la thèse) :** *les LLM échouent à produire un gold d'annotation
juridique à l'échelle (mur du κ, dossier v1) → on construit un gold humain expert assisté (Pactiva),
qu'on audite par détection d'anomalies d'annotateurs (P1/L4) → ce gold enrichi devient un graphe de
connaissances déontique sur lequel on détecte les anomalies du contrat (P1/L3-L1) → on raisonne
(conflits, complétude) et on explique (LLM ancré KG) (P2) → on publie une ressource et un banc (P3).*
Un **récit de thèse cohérent**, dont chaque phase est un papier.

---

## 6. Risques & mitigations

| Risque | Prob. | Impact | Mitigation |
|---|---|---|---|
| **Pipeline graphe (G1) non abouti** en sept. | Moyenne-haute | Élevé | **Valve de décision mi-août** : promouvoir A1+A2 en *long* ; graphe → *short* « vision + PoC ». |
| **Gold multi-annotateur insuffisant** (pour L4/GAD) | Moyenne | Élevé | Cibler un **échantillon stratifié** sur-annoté (≥2–3 annotateurs) plutôt que les 50 ToS ; suffisant pour A1/A2 et le GAD. |
| **Petit N de graphes (50 ToS)** → sur-apprentissage GNN | Réelle | Moyen | Baselines peu profonds sérieux ; validation croisée par ToS ; **augmentation** (conflits synthétiques) ; rapporter la dispersion. |
| **Perçu « trop ML »** (⚑) | Faible-moy. | Élevé | Le **déontique** et la **protection consommateur** au cœur ; dialogue nourri avec la lignée CLAUDETTE + LegalRuleML. |
| **Doublonnage LLM-as-judge / KG** | Faible | Moyen | Différencier par l'**ancrage KG déontique** (J1) et le **résultat négatif** (mur du κ) ; citer GraphRAG/ConsRAG. |
| **κ trompeur sur classe rare** | Moyenne | Moyen | **Gwet AC1/AC2 + α + entropie** (A3) ; supports et dispersion partout. |
| **Nouveauté contestée** (recherche non exhaustive) | Faible | Moyen | Formuler « à notre connaissance » ; citer **précisément** GRAPH-GRPO-LEX / OLG++ / ComplianceNLP comme les plus proches. |

---

## 7. Décisions à trancher avec le porteur / l'encadrant

1. **Ambition 2026 : un *long* graphe (G1) risqué mais très inventif, ou un *long* audit (A1+A2) sûr ?**
   → Recommandé : **viser le graphe** en gardant l'audit comme *short* **et** filet (valve mi-août).
2. **État réel de la campagne** : combien de ToS **multi-annotés** aujourd'hui, débit d'ici mi-août ?
   (détermine la faisabilité de L4 et du GAD ancré sur gold humain). *Je peux l'extraire de la prod.*
3. **Un ou deux papiers ?** Recommandé **deux** (long + short) ; un unique *long* « du gold audité au
   graphe » est une alternative élégante si le temps manque.
4. **Construire le graphe** : outil (NetworkX/PyG), stockage (Neo4j ?), et **combien d'arêtes** typer
   au départ (commencer minimal : adjacence + renvoi + similarité thématique).
5. **Conflits déontiques** : produire un **petit jeu annoté** de conflits ToS **maintenant** (même 20–30
   cas) débloque G3 pour 2026 en préliminaire — décision de coût/valeur.
6. **Publication du corpus enrichi** (licence/DOI) dès 2026 ou en P3 ? Le publier tôt **maximise
   l'impact** et la reproductibilité.

---

## Note de fiabilité

Recommandations fondées sur l'analyse du dossier de thèse, de la plateforme et de **deux revues de
littérature récentes** (graphes/déontique ; anomalies d'annotateurs) dont les citations sont
**réelles mais à re-confirmer** (quelques numéros arXiv/pagination « à vérifier »). La faisabilité 2026
dépend d'un **état réel de la campagne d'annotation** à établir. Le caractère inédit de la combinaison
complète est affirmé « à notre connaissance » (recherche non exhaustive). Dates/quotas JURIX à
revérifier à la source.
