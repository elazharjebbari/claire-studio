# STATE_OF_THE_ART — graphes, anomalies, connaissances juridiques, LLM : ce qui existe, ce qui manque

> **Statut de vérification.** Toute référence citée ici porte une clé BibTeX de
> [`literature/references.bib`](literature/references.bib). ✅ = vérifiée à la source (éditeur, ACL
> Anthology, arXiv, dblp, PDF) le 14 septembre 2026 ou lors des dossiers JURIX ; ⚠ = référence connue
> mais détail (pages, DOI) non re-vérifié ; les travaux cités seulement par URL dans les dossiers d'août
> (`docs/pactiva-fusion-classes/04`) ne sont repris que s'ils ont pu être confirmés. Aucun chiffre de
> performance n'est attribué à un travail sans que la source le donne.
>
> Ce document répond aux sections 1 à 4 du programme (théorie des graphes et anomalies ; graphes,
> ontologies et représentation juridique ; Legal KG ; modélisation des contrats) et prépare §28
> (positionnement) — voir [PUBLICATION_STRATEGY.md](PUBLICATION_STRATEGY.md).

---

## 1. Théorie des graphes et détection d'anomalies

### 1.1 Cadre et taxonomie des anomalies de graphe

La référence structurante reste la revue d'Akoglu, Tong & Koutra ✅ [akoglu2015graph] : anomalies de
**nœud**, d'**arête**, de **sous-graphe** et de **graphe entier**, sur graphes **statiques** ou
**dynamiques**, **attribués** ou non, en régime non supervisé ou (semi-)supervisé, avec une insistance
— rare et précieuse pour nous — sur la **description** de l'anomalie (pourquoi elle est anormale), pas
seulement sa détection. La revue de Ma et al. ✅ [ma2023gad] couvre la génération profonde (GNN,
auto-encodeurs, contrastif) avec la même partition nœud/arête/sous-graphe/graphe.

Trois familles nous concernent directement :

| Famille | Idée | Travaux de référence | Transposition à un contrat |
|---|---|---|---|
| **Structurelle / par motifs** | un sous-graphe est anormal s'il dévie des motifs fréquents (MDL, Subdue) | Noble & Cook ✅ [noble2003graph] (KDD 2003) ; Eberle & Holder (GBAD) ⚠ | une clause dont la configuration acteur–modalité–action–condition n'apparaît (presque) jamais dans le corpus |
| **Contextuelle / conditionnelle** | anormal *sachant* le contexte (attributs, voisinage) | DOMINANT ✅ [ding2019dominant] (auto-encodeur GCN, reconstruction structure + attributs) ; Hauskrecht et al. (anomalie conditionnelle) ⚠ | une limitation de responsabilité anodine isolément, anormale sachant qu'elle côtoie une exclusion de garantie et une indemnisation à la charge du consommateur |
| **Co-occurrence / hypergraphe** | une combinaison multivariée rare est une anomalie ; hyperarête = ensemble d'attributs co-présents | Silva & Willett ✅ [silva2009hypergraph] (TPAMI 2009, EM variationnel sur hypergraphe) ; HGNN ✅ [feng2019hgnn] ; Alam et al. 2024 (anomalie d'hyperarête par HGNN) ⚠ | une clause portant une combinaison de thèmes rare (nos hyperarêtes clause–thèmes) |

À retenir : (i) la détection **non supervisée** de co-occurrences rares a déjà été testée sur nos
données (G2, `docs/pactiva-experiences-papiers/04`) et **n'atteint pas** le taux de base (AUC-PR
0,18 ≈ base 0,186) — *rare ≠ abusif* ; (ii) l'**identité de la combinaison**, apprise, porte un signal
supervisé fort (AUC-PR 0,589) ; (iii) la littérature GAD évalue presque toujours contre des anomalies
**injectées** ou des étiquettes de fraude — le transfert au juridique exige une référence humaine
(CLAUDETTE) et une définition de l'anomalie **par la norme**, pas par la rareté.

### 1.2 Raisonnement par règles et contraintes sur graphes

L'autre lignée n'est pas statistique : une anomalie est une **violation de contrainte** (schéma,
règle métier, règle de droit). Dans les bases de graphes, ce sont les contraintes d'intégrité du modèle
de graphe de propriétés (Angles ✅ [angles2018property]) et, côté KG, SHACL/ShEx pour RDF et les
requêtes de motif (Hogan et al. ✅ [hogan2021kg], §« validation »). Dans le droit computationnel, la
**vérification de conformité** (compliance checking) est mûre côté formalisme — LegalRuleML ✅
[athan2015legalruleml], la revue de Hashmi et al. ✅ [hashmi2018compliance] sur la conformité des
processus, les motifs de conformité en OWL/SPARQL de Francesconi & Governatori (*AI & Law* 2022) ⚠ —
mais suppose la norme **déjà formalisée** et le fait **déjà structuré**. C'est exactement le maillon que
nous devons fournir : texte → structure validée → règle exécutable.

### 1.3 Apprentissage de représentations et GNN : quand c'est pertinent

Embeddings de nœuds (node2vec, disponible dans Memgraph MAGE ✅ [memgraph-mage]) et GNN (GCN ⚠
[kipf2017gcn], HGNN ✅) sont pertinents pour **deux** usages précis : (a) la **similarité de clauses**
au-delà du texte (deux clauses structurellement proches dans le graphe contrat) ; (b) un **détecteur
appris sur le graphe** (nœud-clause classé abusif/non) comme point de comparaison des règles. Ils ne
sont **pas** une source d'explication au sens juridique (§6) ; leur rôle dans le protocole est celui de
baseline et d'ablation (« KG + embeddings »), pas de contribution centrale.

## 2. Graphes, property graphs, knowledge graphs, ontologies : différences et complémentarités

Cadre de référence : Hogan et al. ✅ [hogan2021kg] (modèles de données, langages de requête et de
validation, schémas, ontologies, embeddings, raisonnement déductif et inductif) ; Angles ✅
[angles2018property] pour la formalisation du property graph ; Casanovas et al. ✅ [casanovas2016swlegal]
pour l'état du Web sémantique juridique ; LKIF-Core ✅ [hoekstra2007lkif] comme ontologie noyau du
droit ; Filtz, Kirrane & Polleres ✅ [filtz2021linkedlegal] pour le paysage des données juridiques liées
(ELI/ECLI).

| Artefact | Ce que c'est | Formalisme | Force pour nous | Limite pour nous |
|---|---|---|---|---|
| **Graphe classique** | sommets/arêtes, éventuellement pondérés | mathématique | algorithmes (centralité, motifs, anomalies) | pas de sémantique des types |
| **Property graph (LPG)** | nœuds et arêtes étiquetés, propriétés clé–valeur, multigraphe | Cypher/openCypher, GQL (ISO 39075) | natif Memgraph/Neo4j, provenance et versions en propriétés, requêtes de chemin lisibles | pas de sémantique formelle des types, pas d'inférence OWL native |
| **RDF / triplets** | ressources et prédicats URI, graphes nommés | RDF 1.1, SPARQL, SHACL | interopérabilité (ELI, ECLI, Akoma Ntoso), publication FAIR | verbeux pour les attributs d'arête (réification), écosystème d'anomalies moins riche |
| **Ontologie** | vocabulaire + axiomes (classes, propriétés, contraintes, définitions) | OWL 2, RDFS | définitions partagées et inférence (subsomption, disjonction, cardinalités) ; LKIF-Core, ODRL, ELI | coût de conception ; l'inférence OWL n'est pas la détection d'anomalie ; l'instanciation depuis le texte reste le goulot |
| **Taxonomie** | hiérarchie de classes | SKOS, arbre | nos T20/T14/T11 versionnées | pas de relations autres que la subsomption |
| **Knowledge graph** | graphe d'instances **+** schéma/ontologie **+** provenance, typiquement multi-sources | LPG ou RDF, schéma explicite (Hogan : « graph of data intended to accumulate and convey knowledge ») | c'est la cible : instances (clauses, normes) reliées à des concepts (thèmes, items de l'annexe) | la qualité dépend entièrement de l'extraction |
| **Graphe conceptuel / sémantique** | représentation logique de phrases (Sowa) | CG, AMR | fidèle au sens phrastique | trop fin, non robuste sur du texte contractuel long |
| **Base de graphes** | moteur (Memgraph, Neo4j, ArangoDB…) | Cypher, Gremlin, GQL | stockage, index, MAGE (node2vec, communautés, GNN) | choix d'implémentation, pas de modélisation |

**Ontologie vs knowledge graph, en une phrase** : l'ontologie dit *ce qui peut exister et ce qui s'en
déduit* (une `Norm` a exactement un `bearer`, `Prohibition` et `Permission` sur la même action par le
même acteur sont incompatibles) ; le KG dit *ce qui existe dans ce contrat* (cette clause d'eBay énonce
cette permission du fournisseur de résilier sans préavis). **Complémentarité** : l'ontologie sert de
**schéma de validation** (SHACL-like, ou contraintes Memgraph + tests) et de **vocabulaire des
requêtes** ; le KG porte les instances, la provenance et les scores. Dans le domaine juridique, les
approches hybrides (LKIF-Core + instances ; Akoma Ntoso pour la structure documentaire + ontologie pour
la sémantique ; ELI/ECLI pour les identifiants) sont la norme de fait (Casanovas et al. ✅).

**Décision de principe** (détail : [ADR-001](adr/ADR-001-choice-of-graph-model.md),
[ADR-002](adr/ADR-002-choice-of-memgraph.md)) : **property graph Memgraph comme substrat d'exécution**,
**ontologie légère en YAML** (types, propriétés, cardinalités, disjonctions) comme schéma validé par
tests et exportable en RDF/OWL pour la publication — pas l'inverse, parce que nos requêtes sont des
motifs de chemin et de composition, que la provenance par arête est essentielle, et que l'écosystème
d'anomalies et d'embeddings est côté LPG.

## 3. Knowledge graphs appliqués au droit

### 3.1 Construction et extraction

- **Construction automatique de KG** : revue de Zhong et al. ✅ [zhong2023kgc] (acquisition, raffinement,
  évolution ; > 300 méthodes) ; feuille de route LLM ↔ KG de Pan et al. ✅ [pan2024llmkg] (KG-enhanced
  LLM, LLM-augmented KG, synergie) ; GraphRAG ✅ [edge2024graphrag] comme exemple industriel de KG
  construit par LLM à des fins de synthèse — utile comme patron d'ingénierie, sans évaluation de la
  fidélité des triplets extraits.
- **Extraction juridique** : entités et événements dans les décisions (Filtz et al., *Events matter*,
  JURIX ⚠) ; extraction d'obligations/interdictions (Chalkidis et al. 2018 ✅ [chalkidis2018obligation]) ;
  modalité déontique liée à l'agent (LexDeMod, Sancheti et al. 2022 ✅ [sancheti2022lexdemod]) ;
  extraction de connaissance ouverte pour la QA juridique (Sovrano et al., JURIX 2020 ✅
  [sovrano2020legalkg]) ; éléments contractuels (CUAD ✅ [hendrycks2021cuad], ContractNLI ✅
  [koreeda2021contractnli]) ; **contrats → graphe sémantique par LLM + RL** (GRAPH-GRPO-LEX ✅
  [dechtiar2025graphgrpolex], ICDMW 2025) — le travail le plus proche de notre étage de construction,
  sans visée d'abusivité ni référence humaine d'abusivité.
- **Ontologies et standards réutilisables** : LKIF-Core ✅ (concepts juridiques de base : norme, rôle,
  action, agent) ; LegalRuleML ✅ (règles, déontique, défaisabilité) ; Akoma Ntoso ⚠ (structure
  documentaire) ; ELI/ECLI ✅ (identifiants) ; PROV-O ⚠ (provenance) ; ODRL ⚠ (permissions/obligations
  pour politiques numériques — vocabulaire déontique réutilisable pour nos `Norm`).

### 3.2 Raisonnement, conformité, incohérences

Vérification de conformité par règles (Hashmi et al. ✅), motifs OWL/SPARQL décidables (Francesconi &
Governatori ⚠), détection de contradictions dans les politiques de confidentialité par graphe ⚠ : la
maturité est du côté du **raisonnement sur structure déjà formalisée**. Personne, à notre connaissance,
n'évalue un raisonnement par règles juridiques **contre une référence humaine d'abusivité** sur des
contrats B2C en langue naturelle.

### 3.3 Détection de clauses abusives

État de l'art détaillé dans `draft/jurix2026_short_paper_etat_de_l_art.md` §2-A : la lignée CLAUDETTE ✅
[lippi2019claudette, lagioia2019deep, ruggeri2022memory, drawzeski2021corpus, galassi2024multilingual,
panarelli2025worth], AGB-DE ✅ [braun2024agbde], le corpus chilien ✅ [loffler2025chilean], Text to Trust
✅ [juttu2025texttotrust]. Constat commun : **classification de phrases, aucune structure, aucune base
légale citée par la décision** ; les explications existantes sont des rationales appris ✅
[ruggeri2022memory, liepina2020claudettetool].

## 4. Modéliser un contrat en graphe : granularités et relations

### 4.1 Granularités (ce que nos données permettent réellement)

| Granularité | Disponible ? | Fiabilité mesurée | Rôle dans le graphe |
|---|---|---|---|
| Document (50 ToS) | ✅ | — | racine, métadonnées, population (conception/validation) |
| Section | ⚠ perdue dans LexGLUE, présente dans l'archive XML originale (`* N. Title`) | — | à réintroduire depuis l'archive originale (chantier données) |
| **Clause** (plage de phrases de même jeu de thèmes) | ✅ 2 450 (médiane 2 phrases, p90 9, max 68) | frontières : Jaccard 0,37–0,47 entre annotateurs | **unité de la structure normative** ; les clauses > 8 phrases doivent être re-découpées |
| **Phrase** | ✅ 9 414 | unité d'annotation CLAUDETTE et de la couche thématique | **unité de provenance et d'évaluation** (les labels d'abusivité y vivent) |
| Span / proposition | ❌ (pas d'annotation de spans ; CLAUDETTE est par phrase) | — | à produire par extraction (evidence des templates) |
| Rôle sémantique / **énoncé normatif** (acteur, modalité, action, conditions) | ❌ à extraire | — | le cœur du modèle C/D ; validation humaine obligatoire |
| Concept juridique (thème T20/T11 ; item de l'annexe ; catégorie CLAUDETTE) | ✅ | α-MASI 0,658 (T20) / 0,725 (T11) ; catégories = référence | nœuds de vocabulaire, cibles des requêtes |

### 4.2 Relations (retenues, écartées, différées)

| Relation | Sens | Statut |
|---|---|---|
| `CONTAINS` / `PART_OF`, `NEXT` | structure et ordre | retenue (documentaire) |
| `HAS_THEME` (primaire/secondaire, source, confiance) | clause/phrase → thème | retenue (couche thématique) |
| `STATES` | clause → énoncé normatif | retenue (normative) |
| `HAS_ACTOR`, `HAS_ACTION`, `HAS_OBJECT`, `CONDITIONAL_ON`, `HAS_NOTICE`, `HAS_REMEDY` | structure interne de l'énoncé | retenue (comme propriétés ou nœuds selon cardinalité, voir GRAPH_MODEL §D) |
| `IMPOSES` / `GRANTS` / `PROHIBITS` / `ALLOWS` | raccourcis lisibles = modalité × acteur | retenue comme **vue** dérivée (pas stockée deux fois) |
| `EXCEPTION_TO`, `REFERS_TO` | renvois internes | retenue si détectable (regex « section », « as described in ») ; sinon différée |
| `MATCHES_ITEM` (→ item de l'annexe), `MATCHED_BY` (règle → clause) | résultat d'une requête, avec version de règle | retenue (couche résultats) |
| `LABELED` (→ catégorie CLAUDETTE) | référence | retenue (jamais utilisée par les règles : séparation stricte) |
| `SIMILAR_TO` | similarité texte/embedding | différée (baseline « graph similarity ») |
| `CONTRADICTS` | permission vs interdiction du même acte | exploratoire (famille F4) |
| `VIOLATES` / `POTENTIALLY_VIOLATES` | jugement de droit | **remplacée** par `MATCHES_ITEM` : le graphe n'affirme pas la violation, il montre la correspondance à un item indicatif |

## 5. LLM pour la construction de KG et l'annotation

Extraction générative structurée (revue Xu et al. 2023 ⚠), génération contrainte par grammaire/JSON
(Outlines, Willard & Louf 2023 ⚠ ; sorties structurées natives des API), hallucinations (Ji et al. 2023 ⚠),
LLM annotateurs et juges ✅ [savelka2023unreasonable, gilardi2023chatgpt, bavaresco2025judges,
mukherjee2026geometry, thalken2023legal, dominguezolmedo2025lawma], ancrage ✅ [choi2024llmeffect],
collaboration humain–LLM ✅ [li2023coannotating]. Nos propres mesures : 4 juges sur le même vocabulaire,
κ vs consensus 0,58 (fable) / 0,52 (claude) / 0,33 (mistral) / 0,26 (codex), κ inter-juges jusqu'à 0,80.
Leçon : **le LLM propose, l'humain valide, la structure est versionnée avec sa provenance** — jamais
de vérité terrain LLM (détail : [LLM_EXTRACTION.md](LLM_EXTRACTION.md)).

## 6. Explicabilité en IA & droit

Atkinson, Bench-Capon & Bollegala ✅ [atkinson2020explanation] : l'explication juridique doit être
formulée dans les termes du droit (règles, facteurs, précédents), pas dans ceux du modèle. Les
rationales par attention ✅ [ruggeri2022memory] et les explications générées ✅ [liepina2020claudettetool]
sont post hoc. Notre position : l'explication est **le sous-graphe témoin** (nœuds d'évidence + règle
appariée + item de l'annexe), produit *par construction* par la requête — voir
[EVALUATION_PLAN.md](EVALUATION_PLAN.md) §3 pour sa mesure (fidélité, suffisance, stabilité, utilité).

## 7. Ce qui est largement traité, ce qui reste ouvert

| Déjà largement traité | Peu étudié / ouvert |
|---|---|
| classification de phrases abusives (CLAUDETTE et suites) | **détection fondée sur la structure du contrat** et sur l'annexe 93/13 |
| GAD sur graphes sociaux/financiers avec anomalies injectées | GAD **définie par une norme juridique**, évaluée contre une référence humaine |
| ontologies et langages de règles juridiques | **le pont texte → instance validée**, mesuré |
| KG de contrats pour la recherche/QA (GraphRAG, GRAPH-GRPO-LEX) | KG de contrats **pour juger**, avec types de nœuds à fiabilité mesurée |
| LLM extracteurs de triplets | **protocole de validation** de l'extraction (compliance de schéma, fidélité par champ, hallucinations) sur clauses |
| explications post hoc | explication = **sous-graphe témoin**, évaluée par des juristes |

Les lacunes méthodologiques transversales : (i) absence de référence humaine structurée (templates
validés) pour évaluer l'extraction ; (ii) confusion fréquente entre *rare* et *anormal* ; (iii) fuites
entre construction du graphe et évaluation (règles écrites en regardant les labels) ; (iv) explications
non évaluées. Le programme est conçu pour traiter les quatre (voir
[EXPERIMENTAL_PROTOCOL.md](EXPERIMENTAL_PROTOCOL.md)).
