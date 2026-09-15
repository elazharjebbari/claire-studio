# PUBLICATION_STRATEGY — positionnements, contributions défendables, venues

> Répond aux sections 28 (positionnement), 29 (contributions) et 35.31–32. La règle d'or du
> programme : *« Quelle est la contribution précise, comment est-elle évaluée, quelle preuve la
> distingue de l'état de l'art ? »* — chaque ligne ci-dessous y répond ou est écartée.

---

## 1. Ce qui est déjà pris, ce qui est ouvert (synthèse de STATE_OF_THE_ART §7)

| Largement traité | Peu étudié |
|---|---|
| classifier des phrases abusives (CLAUDETTE → LLM) | détecter **par la structure du contrat** et **par l'annexe 93/13**, avec référence humaine |
| GAD sur graphes sociaux/financiers | GAD **définie par une norme**, non par la rareté |
| formalismes de règles juridiques | **le pont texte → instance validée**, mesuré |
| KG de contrats pour la recherche/QA | KG de contrats **pour juger**, types à fiabilité mesurée |
| LLM extracteurs | protocole de **validation de l'extraction** sur clauses (hallucination, ancrage, reproductibilité) |
| explications post hoc | explication = **sous-graphe témoin** évaluée par des juristes |

## 2. Positionnements candidats

| # | Positionnement | Contribution centrale | Nouveauté | Difficulté | Risque scientifique | Valeur | Venue |
|---|---|---|---|---|---|---|---|
| P1 | **Exécuter la grey list** (Submission 157) : règles pré-enregistrées sur templates validés, mesurées contre CLAUDETTE | RQ2 + RQ6 (+RQ0) | forte (personne n'a exécuté l'annexe) | moyenne (templates à valider) | rappel faible possible → reste publiable comme mesure de l'écart loi ↔ benchmark | haute | **JURIX 2026 (long, déposé)** → *AI & Law* (extension) |
| P2 | **Legal KG en couches pour les ToS** : ressource + schéma + provenance + évaluation de la construction | modèle D + RQ4 | moyenne–forte (KG *pour juger*, provenance du désaccord) | moyenne | « encore un KG » si l'évaluation d'extraction est faible | haute si RQ4 solide | ISWC/ESWC resource track ; *Semantic Web Journal* ; LREC-COLING |
| P3 | **Structure vs texte** : où le graphe voit ce que le texte ne voit pas | RQ1 + RQ5 | moyenne (comparaison rarement faite proprement) | élevée (baselines fortes, Legal-BERT μ-F1 96 sur LexGLUE) | résultat nul possible sur les catégories à thème unique | moyenne–haute (résultat négatif propre publiable) | ICAIL 2027 ; NLLP |
| P4 | **Explications par sous-graphe évaluées par des juristes** | RQ3 | forte (évaluation humaine d'explications juridiques rare) | élevée (étude humaine) | petite taille d'étude | haute | ICAIL 2027 ; *AI & Law* ; XAI workshops |
| P5 | **Anomalie de co-occurrence** (hypergraphe) | A5 / G2 | moyenne | moyenne | déjà mesuré : rare ≠ abusif ; signal supervisé seulement | moyenne (résultat négatif utile) | workshop (NLLP, GAD) |
| P6 | **Construction de KG juridique par LLM : benchmark d'extraction** | RQ4 seul | moyenne | moyenne | dépend d'un fournisseur → réplication ouverte obligatoire | moyenne | NLLP ; LREC-COLING |

**Recommandation** : P1 maintenant (déjà soumis), puis **P2 + P3 fusionnés** dans un long ICAIL 2027
(« a layered legal knowledge graph of ToS: what structure adds to text, measured »), **P4** comme papier
distinct si l'étude humaine atteint ≥ 200 cas × 2 juristes, P5/P6 comme sections ou workshops.

## 3. Les huit contributions candidates : défendables ou non ?

| # | Contribution | Verdict | Condition pour qu'elle tienne |
|---|---|---|---|
| 1 | Représentation des ToS en Legal KG | **défendable comme ressource**, pas comme idée (GRAPH-GRPO-LEX, GraphRAG existent) | couches, provenance du désaccord, types à fiabilité mesurée, évaluation d'extraction |
| 2 | Génération automatique du KG par LLM | défendable **si** RQ4 mesure hallucination/ancrage/reproductibilité et réplique sur un modèle ouvert | pilote multi-modèles, protocole déclaré |
| 3 | Formalisation des critères 93/13 dans le graphe | **défendable et originale** (annexe exécutable + exceptions §2 + mapping catégories) | validation par juristes ; règles gelées |
| 4 | Détection explicable | défendable **si** les explications sont évaluées (RQ3) | étude humaine |
| 5 | Comparaison texte vs graphe | défendable **si** baselines fortes et plis identiques ; un résultat nul est acceptable | Legal-BERT fine-tuné sur `unfair`, LLM prompté |
| 6 | Architecture hybride LLM + KG + règles | **pas une contribution en soi** ; c'est l'instrument des contributions 3–5 | — |
| 7 | Couche structurée dérivée de CLAUDETTE | **défendable** (templates validés + thèmes + gold) | publication avec licence claire, sans textes |
| 8 | Outil open-source reproductible | défendable comme **artefact** (plateforme + pipeline + graphe), pas comme papier | dépôt public, DOI, tests |

## 4. Menaces à traiter dans tout papier issu du programme

Pré-inscription documentée (empreintes, dates, ce que les auteurs savaient) ; « potentially unfair » ≠
abusif ; phrase vs clause ; annexe ≠ catégories ; circularité douce (thèmes, templates, règles par la
même équipe) ; deux régimes (sans labels vs supervisé) ; taille du hold-out (17 documents) ; un seul
système juridique ; ancrage des pré-annotations LLM (Choi et al. 2024).

## 5. Calendrier de valorisation

| Échéance | Livrable | Dépend de |
|---|---|---|
| 14–15 sept. 2026 | 157 version de grâce (H0 du dossier `docs/pactiva-grey-list-157/`) | E0 partiel, E2 hold-out |
| 8 oct. / 15 oct. 2026 | notification / camera-ready 157 | E2 complet, E6 |
| déc. 2026 | JURIX (présentation) ; workshop NLLP/GAD pour P5 si résultat | — |
| janv.–mars 2027 | ICAIL 2027 long : P2+P3 (Gate 8) | E1, E4, E5 |
| 2027 | *AI & Law* : P1 étendu + P4 | E3 |
| 2027 | resource track (ISWC/ESWC ou LREC) : graphe + couche structurée | Gate 4, publication FAIR |


## Positionnement arrêté le 15 septembre 2026 : pipeline entièrement automatique, sans validation juriste des templates

Décision du porteur : les templates ne sont **pas** relus par les juristes pour la soumission 157 (délai). Les résultats
caractérisent le pipeline de bout en bout, l'extraction étant traitée comme une **source de bruit mesurée** (stabilité entre
passes, écart inter-modèles, drapeaux d'ancrage), et non comme une vérité validée. Conséquences protocolaires : E2 s'exécute
sur les normes en statut `proposed` ; l'ablation « proposé vs validé » disparaît ; l'audit expert (E6) et l'évaluation de
suffisance des explications (E3) sont reportés à l'étude de suite ; l'analyse des faux positifs se fait par croisement
automatique (thème, sévérité, catégorie, stabilité) et par cas illustratifs choisis par les auteurs, présentés comme tels.

Formulation retenue pour la section *Limitations and future work* (à reprendre telle quelle, compléter les crochets) :

> The normative templates used in this study were not reviewed by legal experts, as this was not feasible within the time
> frame of the present work. Our results therefore characterise the end-to-end pipeline, with extraction treated as a
> measured source of noise; they do not establish the correctness of individual templates. This work is part of an ongoing
> collaboration with legal experts, who [describe their actual contribution, e.g. contributed to the thematic annotation of
> the corpus]. The follow-up study, [currently in preparation], addresses the main limitations identified here: (i)
> independent double validation of the templates by two legal experts, with per-field agreement and adjudication, which
> will allow extraction errors to be separated from rule errors; (ii) re-extraction with pinned model versions at
> temperature zero, and replication with an open-weight model; (iii) an expert evaluation of the evidence subgraphs used
> as explanations.
