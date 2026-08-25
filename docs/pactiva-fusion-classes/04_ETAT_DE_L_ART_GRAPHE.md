# 04 — État de l'art : détecter les clauses abusives par modélisation en graphe

> Périmètre : les quatre maillons de notre chaîne cible — (1) détection de clauses
> abusives dans les ToS, (2) segmentation thématique de contrats, (3) modélisation
> de contrats par graphes / graphes de connaissances, (4) formalisation normative
> interrogeable (déontique, conformité). Pour chaque maillon : ce qui existe, ce qui
> manque, et où notre proposition (fascicule 05) se loge.
>
> Convention : les références 2024–2026 signalées ⚠ ont été identifiées par
> recherche (titres/résumés) et restent à lire intégralement avant citation dans un
> papier.

## 1. Détection de clauses abusives dans les ToS

**La lignée CLAUDETTE** est le socle du domaine : Lippi et al. (2019, *AI & Law*)
définissent la tâche (classification de phrases en 8 catégories d'abusivité, corpus
de 50 ToS — celui-là même que nous ré-annotons), avec SVM et premiers réseaux ;
Drawzeski et al. (2021) l'étendent en corpus multilingue ; Ruggeri et al. (2022)
ajoutent des réseaux à mémoire augmentés de *rationales* — première prise au
sérieux de l'explicabilité, mais par attention, sans garantie symbolique.

**La vague LLM (2024–2026)** évalue les grands modèles sur la même tâche :
[Are LLM-based methods good enough for detecting unfair terms of service?](https://arxiv.org/abs/2409.00077)
(zéro-shot décevant face aux modèles fine-tunés) ; ⚠ [Is It Worth Using LLMs for
Unfair Clause Detection in ToS?](https://dl.acm.org/doi/full/10.1145/3769126.3769218)
(ICAIL 2025) ; ⚠ [Text to Trust](https://arxiv.org/html/2510.22531) (compromis
fine-tuning complet vs LoRA/QLoRA sur BERT, LLaMA, SaulLM — le fine-tuning complet
garde le meilleur équilibre précision/rappel) ; ⚠ [Harmful Terms and Where to Find
Them](https://arxiv.org/html/2502.01798v1) (mesure à l'échelle de conditions
financières défavorables). Nos propres mesures convergent : juges LLM à 48–60 %
d'accord avec les humains là où les humains s'accordent à κ 0,769 — et le
fascicule 02 §5.4 montre qu'environ 6,5 points de cet écart sont de la granularité
de taxonomie.

**Limite commune à tout ce maillon** : la clause est classée **isolément**, phrase
par phrase. Aucun système ne voit le document comme une structure — alors que
l'abusivité est souvent **compositionnelle** (un plafond de responsabilité anodin
devient léonin combiné à une exclusion de garantie et une indemnisation à la charge
de l'utilisateur). C'est précisément le signal de co-occurrence que nos
expériences G2 mesurent (référence supervisée par identité de combinaison :
AUC-PR 0,589 sur votes, 3,2 × le taux de base).

## 2. Segmentation thématique de contrats

[Aumiller et al. (2021)](https://arxiv.org/abs/2012.03619) segmentent des ToS par
similarité topique (~74 000 documents, RoBERTa) — le corpus le plus proche du
nôtre ; [LEDGAR](https://aclanthology.org/2020.lrec-1.155/) (Tuggener et al., 2020)
classe ~850 000 provisions de contrats SEC et — précédent directement pertinent
pour ce dossier — **réduit ~12 000 intitulés de provisions à 100 classes
exploitables** : la réduction de taxonomie est un geste établi de constitution de
ressource, que nous outillons ici par la mesure (α par classe, strates
d'abusivité) au lieu de la fréquence seule. CUAD (Hendrycks et al., 2021) étiquette
41 types de clauses « à risque » pour la due diligence ; Chalkidis et al. (2017 →)
extraient les éléments contractuels, et Contracts-BERT / Legal-BERT fournissent les
encodeurs pré-entraînés que notre plan expérimental compare déjà
(`encoders-comparison`). Les segmenteurs génériques récents (⚠ SegNSP 2026)
confirment que la frontière thématique reste le point dur — cohérent avec notre
mesure humaine (Jaccard de frontières reconstruites 0,43–0,56).

**Ce qui manque** : ces travaux produisent des segments ou des étiquettes, jamais
une **structure de document interrogeable**. La segmentation est une fin ; pour
nous, c'est le constructeur de nœuds du graphe.

## 3. Graphes et graphes de connaissances pour les contrats

Le maillon le plus actif en 2025 : ⚠ [GRAPH-GRPO-LEX](https://arxiv.org/html/2511.06618)
propose une ontologie contrat→graphe (parties, clauses, obligations en
nœuds/arêtes) et un LLM entraîné par renforcement (GRPO) pour la segmentation et
l'extraction ; ⚠ [Agentic GraphRAG for Commercial Contracts](https://neo4j.com/blog/developer/agentic-graphrag-for-commercial-contracts/)
(Neo4j, 2025) construit un graphe de contrats commerciaux comme substrat de
question-réponse ; ⚠ la [construction de KG juridiques par LLM augmentés de
connaissances](https://www.mdpi.com/2078-2489/15/11/666) (2024) et les hybrides
GNN+LLM type [LLG-Judger](https://dl.acm.org/doi/abs/10.1145/3709026.3709068)
(prédiction de jugement) complètent le paysage ; la détection de **contradictions**
de politiques par KG existe pour les privacy policies.

**Lecture critique** : ces graphes servent la *retrieval* (GraphRAG : mieux
répondre à des questions) ou l'*extraction* (due diligence). Aucun ne vise la
**détection d'abusivité** ; aucun n'évalue contre un gold d'abusivité de type
CLAUDETTE ; et le typage des nœuds y est soit ad hoc, soit délégué au LLM sans
mesure de fiabilité. Notre différence : des types de nœuds issus d'une taxonomie
**dont la fiabilité inter-annotateurs est mesurée et publiée** (T11, α ≥ 0,667) —
la condition pour qu'une requête sur le graphe ait un sens juridique opposable.

## 4. Formalisation normative interrogeable

La tradition symbolique fournit les langages : **LegalRuleML** (Athan et al.,
2013) et ODRL pour les normes ; Francesconi & Governatori,
[Patterns for legal compliance checking in a decidable framework of linked open
data](https://link.springer.com/article/10.1007/s10506-022-09317-8) (*AI & Law*,
2022) pour la conformité par motifs OWL/SPARQL décidables ; ⚠ [Representing
Normative Regulations in OWL DL](https://arxiv.org/html/2504.05951v1) (2025) couple
annotation de texte et vérification automatique ; ⚠ [DAOnt](https://arxiv.org/html/2604.16386)
(2026) exécute du raisonnement déontique SPARQL sur le Data Act européen ; ⚠ une
[version RDF tolérante aux conflits du schéma déontique
traditionnel](https://arxiv.org/pdf/2411.19918) traite les conflits normatifs.

**Lecture critique** : ces cadres partent de la norme déjà formalisée — le goulot
est le **pont texte → formel**, qui reste manuel ou fragile. Notre chaîne fournit
exactement ce pont : segmentation + typage fiable (T11) + extraction de slots par
schéma de clause (05 §3), la couche symbolique n'intervenant qu'en aval, sur une
structure déjà validée. Le proxy déontique à règles de notre expérience D1 (gain
mesuré +0,048 d'AUC-PR sur la référence supervisée) est la version minimale de
cette couche.

## 5. Synthèse : la niche

| Maillon | État de l'art | Le manque | Notre apport |
|---|---|---|---|
| Détection d'abusivité | classification phrase à phrase (CLAUDETTE → LLM) | pas de structure de document, pas de compositionnalité | détection par **motifs de graphe**, y compris co-occurrence (G2) |
| Segmentation | segments topiques, provisions | la segmentation comme fin en soi | la segmentation comme **constructeur de nœuds typés** |
| Graphes de contrats | GraphRAG, extraction, ontologies 2025 | ni abusivité, ni fiabilité du typage | types = taxonomie T11 **à fiabilité mesurée**, évaluation contre CLAUDETTE |
| Formalisation normative | OWL/SPARQL/LegalRuleML matures | le pont texte→formel | pipeline neuro-symbolique : neural pour typer, symbolique pour juger |

Formulation de positionnement (proposée pour le papier long) : *premier cadre de
détection de clauses abusives dans les ToS par requêtes interprétables sur un
graphe contractuel dont les types de nœuds proviennent d'une taxonomie à fiabilité
inter-annotateurs mesurée, évalué contre la référence CLAUDETTE.*

Sources complémentaires consultées :
[Contract Knowledge Graphs](https://www.emergentmind.com/topics/contract-knowledge-graphs) ·
[Analyzing Legal Contracts using KGs](https://medium.com/@ys7887811/analyzing-legal-contracts-using-knowledge-graphs-with-neo4j-modus-hypermode-039c794fdfbf) ·
[Reliability vs. granularity in discourse annotation](https://www.academia.edu/42135957/Reliability_vs_granularity_in_discourse_annotation_What_is_the_trade_off) ·
[Coarse2Fine](https://aclanthology.org/2021.emnlp-main.46/) ·
[Structural Text Segmentation of Legal Documents](https://arxiv.org/abs/2012.03619) ·
[Patterns for legal compliance checking](https://link.springer.com/article/10.1007/s10506-022-09317-8).
