# Détecter les anomalies dans les *Terms of Service* : du graphe de connaissances déontique à l'audit des annotateurs

> **Partie A** — la vision de recherche et l'état de l'art récent qui la fonde.
> **Partie B** — le long tableau de 12 propositions d'articles, scorées.
> Recommandation finale : [`02_RECOMMANDATION_ET_ROADMAP.md`](02_RECOMMANDATION_ET_ROADMAP.md).

---

# Partie A — La vision : le contrat comme graphe, l'anomalie comme raisonnement

## A.1 Thèse centrale

**CLAUDETTE a été construite pour détecter une anomalie** — la clause *abusive* (dir. 93/13/CEE). Mais
elle le fait **phrase par phrase, sans structure**, alors qu'une anomalie contractuelle est presque
toujours **relationnelle** : une clause est abusive *en contexte* (une limitation de responsabilité
adossée à une clause d'arbitrage et de résiliation unilatérale), une clause peut **manquer** (absence
d'un droit de rétractation attendu), deux clauses peuvent se **contredire** (une obligation qui heurte
une permission). Ces anomalies sont invisibles à un classifieur de phrases.

> **Idée maîtresse.** L'annotation Pactiva — clause (frontières) + **thème** (≈20) + **nature
> juridique** (obligation / interdiction / permission / définition / déclaration / procédure) +
> certitude + rationale + labels d'abusivité CLAUDETTE — fournit exactement ce qu'il faut pour
> **transformer chaque contrat en un graphe de connaissances déontique**, et faire de la **détection
> d'anomalies un raisonnement de graphe**. La segmentation thématique n'est plus une fin en soi (dont
> le F1 plafonne et paraît « pur NLP ») mais le **substrat structurant** dont on mesure la valeur par
> son **utilité aval** en détection d'anomalies.

Le point de levier décisif, **inexploité par la lignée CLAUDETTE** : la **nature juridique** annotée
par Pactiva mappe sur des **opérateurs déontiques** — obligation ⇒ **O**, interdiction ⇒ **F**,
permission ⇒ **P** (les trois autres — définition, déclaration, procédure — sont *constitutives*, non
régulatives). Ce mapping rend calculables les **conflits normatifs** (O∧F, P∧F, contrary-to-duty) et
inscrit le travail à l'intersection des **deux tracks de JURIX** : NLP/ML (II) **et** logique &
raisonnement normatif (I).

## A.2 La « pile d'anomalies » — un cadre unificateur à quatre niveaux

| Niveau | Anomalie | Unité | Détection (approches récentes) | Ancrage d'évaluation |
|---|---|---|---|---|
| **L1 — Normative** | **Clause abusive** (le but de CLAUDETTE) | clause en contexte de graphe | classifieur contextuel ; **LLM-as-judge ancré KG (GraphRAG)** | labels CLAUDETTE |
| **L2 — Sémantique** | Clause **mal étiquetée / atypique** | clause vs son thème | embeddings + OOD, **proximité inter-groupes** (déjà amorcé en thèse), sur le gold enrichi 20 thèmes + LegalBERT | gold enrichi |
| **L3 — Relationnelle / déontique** | **Conflit normatif** + **clause manquante** (complétude) + renvoi cassé / redondance | paires & sous-graphes de clauses | **graphe déontique** + **GNN-GAD** (DOMINANT, CoLA, OCGNN, TAM) + **link prediction** (RotatE/ComplEx) + NLI (ContractNLI *contradiction*) + **logique déontique défaisable** (LegalRuleML) | oracle symbolique + checklist experte |
| **L4 — Annotation** | **Anomalies d'annotateurs** : clause mal annotée · annotateur anormal · item **intrinsèquement ambigu** | items & annotateurs du gold | **Confident Learning/Cleanlab**, **Data Maps**, **AUM**, **CROWDLAB**, **MACE/Dawid-Skene/IRT**, **apprentissage avec désaccord (LeWiDi)** | ré-annotation, entropie |

**Pourquoi les quatre niveaux forment un seul programme.** L4 (qualité du gold) **conditionne** L1–L3 :
un détecteur d'anomalies n'est fiable que si son gold l'est. Réciproquement, le graphe déontique (L3)
fournit un **contexte** qui aide à trancher les cas ambigus de L4. Le fameux **« 18 % d'ambiguïté
irréductible »** du mur du κ (dossier v1) devient ici une **quantité mesurée et modélisée** (variation
humaine légitime, *soft labels*), reliée à la théorie du désaccord (ChaosNLI, Plank 2022, LeWiDi) —
plus un simple constat.

## A.3 État de l'art récent qui fonde le programme (2019-2026)

### L3 — Graphes & détection d'anomalies de graphe
- **Détection d'anomalies de graphe (GAD).** Surveys de référence : **Ma et al., IEEE TKDE 2023**
  (arXiv 2106.07178) — taxonomie nœud/arête/sous-graphe/graphe ; **Qiao et al., IEEE TKDE 2025**
  (arXiv 2409.09957). Méthodes GNN : **DOMINANT** (Ding et al., SDM 2019, auto-encodeur GCN
  structure+attributs), **AnomalyDAE** (Fan et al., ICASSP 2020), **OCGNN** (Wang et al., 2021,
  objectif *one-class*), **CoLA** (Liu et al., IEEE TNNLS 2021, contrastif nœud↔sous-graphe), **TAM**
  (Qiao & Pang, NeurIPS 2023, *one-class homophily*). Baselines « peu profonds » à conserver : **LOF**
  (Breunig 2000), **Isolation Forest** (Liu 2008), **One-Class SVM/SVDD** (Schölkopf 2001 ; Tax & Duin
  2004), **Radar/ANOMALOUS** (attribués).
- **KG de contrats + complétude.** **GRAPH-GRPO-LEX** (Dechtiar et al., 2025, arXiv 2511.06618) —
  contrat → graphe orienté à **types déontiques** (Obligation/Right/Prohibition) + un *« contract
  linter »* (nœuds orphelins, **cycles = contradictions**, points d'articulation) ; **OLG++** (Dasgupta
  et al., 2025, arXiv 2507.05488) — graphes déontiques riches (défaisabilité EXCEPTION/OVERRIDE/
  PRECEDENCE), représentation seule ; **ComplianceNLP** (Guo et al., 2026, arXiv 2604.23585) — KG+RAG,
  **lacune réglementaire = obligation absente**. KG-embeddings pour la **link prediction** (clause
  manquante = triplet improbable) : **TransE** (Bordes 2013), **ComplEx** (Trouillon 2016), **RotatE**
  (Sun 2019). Anomalies dans les KG : **SEKA/CPRA/TAXO** (Senaratne et al., 2024, arXiv 2412.04780).
- **Déontique & incohérences.** **LegalRuleML** + *defeasible deontic logic* (Governatori & Rotolo) —
  **bien reçus à ICAIL/JURIX 2025** (« Legal Explanation in Defeasible Deontic Logic via LegalRuleML »,
  ICAIL 2025). Conflits normatifs contractuels : **Aires et al., AI & Law 2017** (typologie O/F/P,
  directs/indirects) ; **NeuralConflict** (Huang et al., 2024). Incohérences : **ContractNLI** (Koreeda
  & Manning, EMNLP Findings 2021, classe *contradiction*) ; **Contract Inconsistency Checking** (Zhang
  et al., AAAI 2021 — *incohérences de « blancs »*, à ne pas surinterpréter) ; **ContractCheck**
  (Khoja et al., 2025, FOL+SMT) ; **« contract smells »** (Dechtiar et al., 2025). Typage déontique
  automatique : Chalkidis et al. (ACL 2018), NLLP 2023.
- **KG + LLM.** **GraphRAG** (Edge et al., Microsoft, 2024) — réponses **ancrées/provenancées**
  (anti-hallucination) ; **ConsRAG** (Nguyen & Satoh, JURIX 2024).

### L4 — Anomalies d'annotateurs & apprentissage avec désaccord
- **Erreurs d'étiquetage.** **Confident Learning / Cleanlab** (Northcutt et al., JAIR 2021) ;
  *pervasive label errors* (Northcutt et al., NeurIPS D&B 2021 — ~3,3 % d'erreurs moyennes) ;
  **Dataset Cartography / Data Maps** (Swayamdipta et al., EMNLP 2020 — régions *easy/ambiguous/hard*) ;
  **AUM** (Pleiss et al., NeurIPS 2020) ; **CROWDLAB** (Goh & Mueller, 2022 — consensus + score qualité
  + note annotateur).
- **Modèles d'annotateurs.** **Dawid-Skene** (1979) ; **MACE** (Hovy et al., NAACL 2013 —
  *trustworthiness*, détection de *spammers*) ; **Paun et al., TACL 2018** (modèles bayésiens) ; **IRT**
  (Lalor et al., EMNLP 2019 — difficulté d'item vs capacité d'annotateur).
- **Variation humaine (perspectivism).** **Plank, EMNLP 2022** (*human label variation* : erreur vs
  ambiguïté vs subjectivité) ; **Uma et al., JAIR 2021** (*Learning from Disagreement*) ; **LeWiDi**
  SemEval-2023 (Leonardelli et al.) et LeWiDi-2025 ; **ChaosNLI** (Nie et al., EMNLP 2020 — désaccord
  humain structurel, 100 annotations/item).
- **Accord au-delà de κ.** **Gwet AC1/AC2** (Gwet 2008/2014) — **robuste au paradoxe de prévalence**,
  décisif car les clauses abusives sont **rares (~9:1)** dans CLAUDETTE et effondrent Cohen/Fleiss κ ;
  **Krippendorff α** ; *soft labels*.
- **En droit.** **Braun, AI & Law 2023** — *tous les datasets juridiques effacent les traces de
  désaccord* ⇒ **le gap exact** à combler ; **ACORD** (ACL 2025 — annotation multi-experts avec
  adjudication tracée) ; **CLAUDETTE** (Lippi et al., AI & Law 2019 — 100 ToS / 20 417 clauses / ratio
  ~9:1, gold **agrégé, désaccord non exposé**).

## A.4 Positionnement de nouveauté

À notre connaissance (recherche non exhaustive), **la combinaison intégrale** — *segmentation
thématique de clause* + *typage déontique O/F/P* + *graphe de connaissances du contrat* + *détection
d'anomalies de graphe par GNN* — **appliquée à CLAUDETTE/ToS n'existe pas.** Les briques existent
séparément :

| Travail proche | Ce qu'il fait | Ce qui manque (notre delta) |
|---|---|---|
| **GRAPH-GRPO-LEX** (2025) | contrat→KG déontique + *linter* (orphelins, cycles, articulation) | **pas** de GNN-GAD ; **pas** de raisonnement de conflit déontique ; sur **CUAD**, pas ToS ; **pas** de segmentation thématique comme signal |
| **OLG++** (2025) | KG déontique riche (défaisabilité) | **représentation/QA seulement**, aucune détection d'anomalie |
| **ComplianceNLP** (2026) | KG+RAG, lacune réglementaire | **inter-documents réglementaires**, pas anomalie de graphe de contrat ToS |
| **Aires et al.** (2017) | conflits normatifs O/F/P par **paires** | **pas** de KG global ni de GNN-GAD |
| **CLAUDETTE** (2019) | abusivité **phrase par phrase** | **aucune** structure/graphe ; gold **agrégé** (désaccord effacé) |
| **Braun** (2023) | *constat* que le droit efface le désaccord | **aucune** méthode d'exploitation ; pas d'anomalies d'annotateurs outillées |

**Deux niches défendables et JURIX-natives** en découlent : (i) le **graphe déontique + GAD** pour
détecter conflits/lacunes/atypies (L3, la plus inventive) ; (ii) l'**audit du gold par détection
d'anomalies d'annotateurs** qui exploite et **préserve** le désaccord (L4, la plus faisable et qui
comble le gap de Braun 2023).

---

# Partie B — Le long tableau des propositions

## B.1 Grille de scoring (identique au dossier v1, pour comparabilité)

6 dimensions, 0–5, **total /30**. ⚑ = quasi-éliminatoire à JURIX.
**AJ** ⚑ ancrage juridique/fit · **NV** nouveauté/invention · **RI** ⚑ rigueur empirique atteignable ·
**FA** faisabilité **pour JURIX 2026 (sept.)** · **RC** réception communauté · **IM** impact/portée.
Colonne **Horizon** : `2026` (livrable pour la deadline) vs `Programme` (moyen terme, la recherche
continue). Lecture : **≥25 → long** · 19–24 → short/long-si-mûr · <19 → poster/workshop.

## B.2 Détail des 12 propositions

> Familles : **G** = graphe/déontique (L3) · **J** = KG+LLM (L1) · **S** = sémantique (L2) ·
> **A** = annotateurs (L4) · **B** = ressource/benchmark (transverse).

### G1 — Le Graphe de Contrat Déontique pour la détection d'anomalies de ToS *(cœur inventif)*
- **Idée.** Construire, par ToS, un **KG de clauses** typées `(thème, nature déontique O/F/P/constitutif)`
  avec arêtes `is_part_of, defines, references, adjacence-thématique, conflit`, puis appliquer un
  **GNN-GAD** (DOMINANT/OCGNN/TAM) dont le score d'anomalie combine **reconstruction structurelle** et
  **violation d'homophilie déontique**. Hypothèse testable : *les clauses abusives CLAUDETTE sont des
  nœuds à faible affinité déontique avec leur voisinage thématique*.
- **Approches récentes.** GNN-GAD (Ma 2023 ; DOMINANT ; TAM) ; KG déontique (GRAPH-GRPO-LEX, OLG++).
- **Intérêt/valeur.** Fait de l'abusivité une propriété **relationnelle** ; pont Track I↔II ; réutilise
  directement l'annotation déontique de Pactiva.
- **Forces.** Très inventif ; évaluable sur CLAUDETTE (L1) ; générique (tout ToS).
- **Faiblesses/risques.** **Construction de pipeline lourde** (KG + GNN) ; besoin d'un KG fiable ;
  petit N de graphes (50 ToS) → régularisation/validation soignées.
- **Faisabilité 2026.** **Moyenne-faible** (ambitieux) → *slice* évaluable possible (GAD nœud vs
  CLAUDETTE) + reste en programme.
- **Réception.** **Très bonne** (neuro-symbolique + KG bien reçus à JURIX 2025).
- **Différenciation.** vs GRAPH-GRPO-LEX : **GNN-GAD + homophilie déontique + segmentation thématique +
  ToS/CLAUDETTE** (eux : métriques de graphe, CUAD).

### G2 — La clause manquante comme lien improbable *(anomalie de complétude)*
- **Idée.** Entraîner des **embeddings de KG** (RotatE/ComplEx) sur une population de ToS « bien
  formés » ; pour un nouveau contrat, la **link prediction** signale les triplets attendus mais absents
  (ex. clause de rétractation, de juridiction) ⇒ **anomalie de complétude**. La taxonomie des 20 thèmes
  sert de **squelette/checklist** attendu.
- **Approches récentes.** KG-embeddings (RotatE) ; ComplianceNLP (lacune = absence) ; SEKA/TAXO.
- **Intérêt.** L'« article manquant » de la thèse, **généralisé et piloté par la taxonomie** ; très
  concret pour le juriste (checklist automatique).
- **Forces.** Évaluable contre une checklist experte ; réutilise les 50 ToS comme population.
- **Faiblesses.** Petit N ; « normalité » d'un ToS à définir prudemment (biais de population).
- **Faisabilité 2026.** **Moyenne.**
- **Réception.** Bonne (complétude = protection consommateur).
- **Différenciation.** vs ComplianceNLP (inter-cadres réglementaires) : **intra-contrat ToS + taxonomie
  thématique**.

### G3 — Le conflit déontique comme arête d'anomalie *(neuro-symbolique)*
- **Idée.** Détecter les **conflits normatifs** (O∧F, P∧F sur actions liées ; contrary-to-duty) entre
  clauses via le **typage déontique** + **NLI** (ContractNLI *contradiction*) / **logique déontique
  défaisable** (LegalRuleML) ; injecter des **arêtes de conflit** dans le KG et faire de la **détection
  d'anomalie de sous-graphe** (un contrary-to-duty non résolu = sous-graphe anormal). Oracle = solveur
  symbolique.
- **Approches récentes.** Aires 2017 (typologie) ; LegalRuleML/defeasible (ICAIL 2025) ; ContractNLI ;
  NeuralConflict 2024.
- **Intérêt.** **Le plus « JURIX-natif »** (déontique + argumentation) ; hybride symbolique↔neuronal.
- **Forces.** Très inventif ; explicable (preuve de conflit).
- **Faiblesses/risques.** Nécessite un **jeu de conflits annoté** (à produire) ; les vrais conflits sont
  **rares** dans les ToS (surtout implicites) → prévoir des **conflits synthétiques** (oracle
  déterministe) pour l'ablation.
- **Faisabilité 2026.** **Faible-moyenne** (programme).
- **Réception.** **Excellente** en track I.
- **Différenciation.** vs Aires 2017 : **KG global + sous-graphe + typage Pactiva + ToS** (eux :
  paires, corpus générique).

### G4 — La segmentation thématique comme *prior* de détection d'anomalies *(dé-risque le « pur NLP »)*
- **Idée.** Utiliser la **segmentation thématique de clause** pour poser les **nœuds** et les **arêtes
  de similarité thématique** du KG, puis **évaluer la segmentation par son utilité aval** : améliore-t-
  elle la détection de clauses abusives (L1) et l'anomalie *type-vs-contexte* (une « permission » dans
  une section « limitation de responsabilité » ressort-elle comme anomalie de nœud) ? **La
  segmentation n'est pas notée en F1 mais en gain d'anomalie.**
- **Approches récentes.** Topic/clause-type classification (survey 2507.21108) ; GNN-GAD.
- **Intérêt.** **Rend la segmentation juridiquement signifiante** (répond à la critique « pur NLP » qui
  plombait P11 du dossier v1).
- **Forces.** **Segmentation déjà largement faite** (stratégie B + classifieurs) → faisable ; ablation
  propre.
- **Faiblesses.** Dépend d'un module d'anomalie aval (à coupler à G1).
- **Faisabilité 2026.** **Moyenne-haute.**
- **Réception.** Bonne (cadrage aval convaincant).
- **Différenciation.** Personne n'évalue la segmentation de clause **par son utilité de détection
  d'anomalies** sur ToS.

### J1 — LLM-juge ancré sur le graphe (GraphRAG) pour une abusivité explicable
- **Idée.** **GraphRAG** sur le KG du contrat + LLM-juge contraint de **citer les nœuds/arêtes**
  justifiant chaque verdict d'abusivité/anomalie (provenance obligatoire, style ConsRAG) ; mesurer la
  **réduction d'hallucination** vs LLM nu, ancrage sur ContractNLI + CLAUDETTE.
- **Approches récentes.** GraphRAG (2024) ; ConsRAG (JURIX 2024) ; LLM-as-judge critique.
- **Intérêt.** Surfe sur **le sujet chaud « hallucination juridique »** ; explicabilité par preuve de
  graphe.
- **Forces.** Réutilise l'infra KG (G1) ; très « dans l'air du temps » JURIX.
- **Faiblesses.** Risque de doublonner la vague LLM-as-judge → différencier par **l'ancrage KG**.
- **Faisabilité 2026.** **Moyenne** (build GraphRAG).
- **Réception.** **Très bonne.**
- **Différenciation.** vs ConsRAG : **ancrage sur un KG déontique de contrat**, pas RAG textuel.

### S1 — Anomalie sémantique *type-vs-contexte* sur le gold enrichi
- **Idée.** Détecter la clause dont le **contenu diverge de son thème** (plus proche du centroïde d'un
  autre thème) = **mal étiquetée/atypique**, désormais sur le gold enrichi à **20 thèmes** avec des
  **encodeurs juridiques** (LegalBERT/JuriBERT) — reprise et durcissement de la « proximité
  inter-groupes » amorcée en thèse.
- **Approches récentes.** OOD textuel ; encodeurs juridiques ; proximité de centroïdes.
- **Intérêt.** Brique L2 simple, utile au nettoyage du gold (feed L4).
- **Forces.** **Analyse déjà amorcée** (thèse) → faisable ; reproductible.
- **Faiblesses.** Portée limitée seule ; « ML » → à cadrer.
- **Faisabilité 2026.** **Moyenne-haute.**
- **Réception.** Moyenne (meilleure comme brique d'un ensemble).
- **Différenciation.** Sur le **gold enrichi 20 thèmes + certitude**, pas les 8 catégories brutes.

### A1 — Auditer un gold de clauses abusives par détection d'anomalies d'annotateurs *(le plus faisable)*
- **Idée.** **Audit data-centric unifié** du gold multi-annotateur : **Cleanlab (Confident Learning)** +
  **Data Maps** + **AUM** + **CROWDLAB** + **MACE** → (a) quantifier le **taux réel d'erreurs
  d'étiquetage** (à la Northcutt), (b) **profiler la fiabilité par annotateur** (biais par thème,
  spammer/fatigue), (c) séparer **erreur vs ambiguïté**. Répond frontalement à *« détecter les
  anomalies des annotateurs »*.
- **Approches récentes.** Cleanlab, Cartography, AUM, CROWDLAB, MACE/IRT.
- **Intérêt.** **Comble le gap de Braun 2023** (le droit efface le désaccord) ; premier **audit
  data-centric d'un gold *unfair clauses***.
- **Forces.** **Méthodes sur étagère + données de la campagne** → **haute faisabilité** ; rigueur forte.
- **Faiblesses.** Dépend d'un **gold multi-annotateur** suffisant (≥2 annotateurs sur un échantillon) ;
  moins « spectaculaire » que le graphe.
- **Faisabilité 2026.** **Haute.**
- **Réception.** **Très bonne** (data-centric + qualité en droit).
- **Différenciation.** vs CLAUDETTE/ACORD : on **détecte et modélise** les anomalies d'annotateurs, on
  ne se contente pas d'adjuger.

### A2 — Ne réconciliez pas trop vite : modéliser le désaccord dans l'annotation d'abusivité
- **Idée.** Réponse directe à **Braun 2023** : comparer **gold agrégé vs soft labels** (cadre **LeWiDi**)
  pour la classification d'abus ; mesurer quelle part du désaccord est **erreur** (Cleanlab) vs
  **ambiguïté légitime** (Cartography/ChaosNLI). **Reformuler les « 18 % » du mur du κ** comme
  **variation humaine mesurée** et caractérisée (types de clauses les plus litigieux).
- **Approches récentes.** Plank 2022 ; Uma 2021 ; LeWiDi ; ChaosNLI.
- **Intérêt.** **Perspectivism** appliqué au droit — angle vif et sous-exploité en juridique.
- **Forces.** Relie le résultat fort du dossier v1 (mur du κ) à un cadre théorique reconnu ; faisable.
- **Faiblesses.** Besoin d'un sous-corpus **sur-annoté** (N annotateurs) pour être convaincant.
- **Faisabilité 2026.** **Haute** (sur un échantillon).
- **Réception.** **Très bonne.**
- **Différenciation.** Premier traitement *learning-with-disagreement* de l'abusivité contractuelle.

### A3 — Au-delà de κ : mesurer l'accord sur les classes rares en droit
- **Idée.** Étude **méthodologique** : montrer l'effondrement de **Cohen/Fleiss κ** sous la prévalence
  **~9:1** des clauses abusives (paradoxe de κ) et l'apport de **Krippendorff α + Gwet AC1/AC2 +
  entropie du modèle d'annotation** ; proposer une **grille de reporting IAA** pour JURIX/ICAIL.
- **Approches récentes.** Gwet AC (2008/2014) ; α ; modèles d'annotation (§L4).
- **Intérêt.** **Utilité méthodologique immédiate** pour toute la communauté d'annotation juridique.
- **Forces.** Faisable, chiffrable, réutilisable.
- **Faiblesses.** Portée « méthodo » plutôt qu'« insight » → *short*.
- **Faisabilité 2026.** **Haute.**
- **Réception.** Bonne (utile, un peu technique).
- **Différenciation.** Ancré sur un cas juridique réel à forte prévalence.

### A4 — Arbitrage priorisé par active learning sensible à la variation humaine
- **Idée.** Opérationnaliser **Gruber et al. 2025** + **ActiveLab** : **priorité d'arbitrage** =
  f(qualité-label ↓, désaccord/entropie ↑, difficulté-item IRT ↑, fiabilité-annotateurs ↓) → envoyer
  au juriste-arbitre d'abord les « erreurs probables » et « désaccords à forte incidence », **ne pas
  gaspiller** l'arbitrage sur l'ambiguïté irréductible (garder en *soft labels*). Montrer qu'on atteint
  la qualité du gold complet en arbitrant **une fraction** des clauses.
- **Approches récentes.** Active learning sous HLV (Gruber 2025) ; ActiveLab (2023) ; CROWDLAB.
- **Intérêt.** **Valorise directement le module GOLD de Pactiva** (arbitrage) ; gain coût/qualité
  démontrable.
- **Forces.** Très applicable ; connecte annotation et détection d'anomalies.
- **Faiblesses.** Nécessite données de campagne + expériences d'AL à monter.
- **Faisabilité 2026.** **Moyenne.**
- **Réception.** Bonne (efficience + human-in-the-loop).
- **Différenciation.** *Arbitrage* juridique priorisé par AL-HLV — inédit sur clauses abusives.

### B1 — Une taxonomie & un benchmark unifiés d'anomalies pour les ToS *(ressource)*
- **Idée.** Publier une **taxonomie d'anomalies ToS (L1–L4)** + un **benchmark reproductible** : ToS→KG
  déontique enrichi, avec **baselines peu profonds** (LOF/IF/OCSVM) vs **deep GAD** (DOMINANT/CoLA/TAM)
  vs le *linter* GRAPH-GRPO-LEX, évalués sur l'abusivité CLAUDETTE + les anomalies L2/L3. Contribution :
  *quel type d'anomalie (nœud/arête/sous-graphe) correspond à quel type d'injustice*.
- **Approches récentes.** Toute la boîte GAD + KG + LeWiDi (soft labels).
- **Intérêt.** **Ressource que JURIX reconnaît** (*datasets for AI & Law*) ; fédère le programme.
- **Forces.** Fort impact/citations ; réutilisable.
- **Faiblesses.** **Ambitieux** ; dépend de G1–G3 + gold mûr.
- **Faisabilité 2026.** **Faible** (programme, plutôt 2027).
- **Réception.** **Excellente.**
- **Différenciation.** Premier banc d'anomalies **multi-niveaux** sur ToS.

## B.3 Tableau de scoring consolidé

| # | Proposition (abrégé) | AJ⚑ | NV | RI⚑ | FA | RC | IM | **/30** | Horizon | Format |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **A1** | Audit gold — anomalies d'annotateurs | 4 | 4 | 5 | 5 | 5 | 4 | **27** | 2026 | **Long** |
| **G1** | Graphe de contrat déontique + GNN-GAD | 5 | 5 | 4 | 2 | 5 | 5 | **26** | Programme (slice 2026) | **Long** |
| **A2** | Modéliser le désaccord (soft labels) | 4 | 4 | 4 | 5 | 5 | 4 | **26** | 2026 | **Long/Short** |
| **G3** | Conflit déontique = arête d'anomalie | 5 | 5 | 3 | 2 | 5 | 5 | **25** | Programme | Long (2027) |
| **B1** | Taxonomie & benchmark d'anomalies ToS | 5 | 4 | 4 | 2 | 5 | 5 | **25** | Programme | Long (2027) |
| **G4** | Segmentation = *prior* d'anomalie | 4 | 4 | 4 | 4 | 4 | 4 | **24** | 2026 | Short/Long |
| **J1** | LLM-juge ancré KG (GraphRAG) | 4 | 4 | 4 | 3 | 5 | 4 | **24** | 2026-27 | Short/Long |
| **G2** | Clause manquante = lien improbable | 4 | 4 | 4 | 3 | 4 | 4 | **23** | 2026-27 | Short/Long |
| **A3** | Au-delà de κ (Gwet AC, classes rares) | 3 | 3 | 4 | 5 | 4 | 3 | **22** | 2026 | Short |
| **A4** | Arbitrage priorisé (AL-HLV) | 4 | 4 | 3 | 3 | 4 | 4 | **22** | 2026-27 | Short |
| **S1** | Anomalie sémantique type-vs-contexte | 3 | 3 | 4 | 4 | 3 | 3 | **20** | 2026 | Short |
| **B?** | *(v1)* Mur du κ — voir dossier précédent | 4 | 5 | 5 | 5 | 5 | 5 | **29** | 2026 | Long |

> **Rappel :** le **« mur du κ »** (dossier v1, 29/30) reste la proposition la plus faisable **et** la
> mieux notée toutes catégories. Il **s'intègre naturellement ici comme le niveau L4** (mesure de
> l'ambiguïté irréductible) et **motive** A1/A2. La recommandation combine ces forces.

**Lecture.** Deux pôles se dégagent : un pôle **inventif haute-ambition mais programme** (G1, G3, B1) et
un pôle **inventif-ET-faisable-2026** (A1, A2, G4, + le mur du κ v1). La stratégie de portefeuille est
traitée dans [`02_RECOMMANDATION_ET_ROADMAP.md`](02_RECOMMANDATION_ET_ROADMAP.md).

---

## Notes de fiabilité

- **Citations** vérifiées via les deux revues commandées (ACL Anthology / arXiv / éditeurs) mais à
  **re-confirmer** avant soumission ; quelques numéros arXiv/pagination sont marqués « à vérifier » dans
  les briefs sources (ex. GraphRAG 2404.16130, CoLA, ConsRAG).
- **CLAUDETTE** : le corpus complet = **100 ToS / 20 417 clauses / ratio ~9:1** (Lippi 2019) ; le
  **sous-ensemble du projet = 50 ToS / 9 414 phrases**. À préciser dans tout article.
- Le **« 18 % d'ambiguïté irréductible »** n'est **pas** une constante publiée : à présenter comme
  **statistique mesurée sur notre gold**, adossée conceptuellement à ChaosNLI/LeWiDi.
- Le mapping **nature juridique → opérateur déontique** (O/F/P) ne concerne que les 3 natures
  régulatives ; définition/déclaration/procédure sont **constitutives** (à traiter à part dans le KG).
