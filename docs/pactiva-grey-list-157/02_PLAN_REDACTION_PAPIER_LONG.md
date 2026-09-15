# Soumission 157 — Plan de rédaction du papier long JURIX 2026

*15 septembre 2026. Complète `01_CHAINE_FINALE_ET_VALORISATION.md`. Base de travail : le brouillon v0 déjà écrit dans
`jurix2026-long-paper/main.tex (sections dans jurix2026-long-paper/sections/)` (introduction, état de l'art, tableau de la grey list, couche thématique,
templates, requêtes, protocole, résultats à trous, audit, discussion, conclusion), les inventaires du protocole
(`legal-kg/docs/`), des résultats (`legal-kg/results/`, `jurix2026-short-paper/`) et de la bibliographie.*

## 0. Cadre JURIX 2026 (papier long)

- Format IOS Press (`IOS-Book-Article.cls`, `vancouver.bst`), **10 pages au maximum hors références** (à revérifier sur
  l'appel au moment du camera-ready ; le short était à 5 pages hors références et remerciements). Tableaux ≥ 8 pt,
  figures en niveaux de gris. Environnement déjà prêt : `jurix2026-long-paper/` (compilable, gabarit du short
  paper réutilisable : `tools/check_pages.sh`, marqueur `\label{end:body}`).
- Lectorat : IA & droit (juristes et informaticiens). Ce qui est jugé : nouveauté, rigueur (pré-inscription), clarté
  juridique, reproductibilité, honnêteté sur les limites. Un résultat nul par item est acceptable si mesuré proprement
  (`PUBLICATION_STRATEGY.md` §P1).
- Budget indicatif : 10 pages ≈ 5 200 mots + 6 tableaux/figures. Le brouillon v0 fait déjà ≈ 3 300 mots hors tableaux.

---

## 1. Trois structures candidates

### S1 — « IMRaD étendu » (structure du brouillon v0)
1 Introduction · 2 Related work · 3 Grey list as a resource (T1) · 4 Thematic layer (T2) · 5 Clause templates ·
6 Unfairness queries · 7 Evaluation protocol · 8 Results (T3–T5) · 9 Expert audit (T6) · 10 Discussion · 11 Conclusion.

| Critère | Analyse |
|---|---|
| Qualité scientifique | Complète et linéaire ; chaque objet (item, thème, template, requête) est défini avant d'être mesuré. Risque : le lecteur atteint les résultats page 7 ; les contributions se diluent en 11 sections. |
| Lisibilité | Très prévisible pour un relecteur JURIX ; mais 11 têtes de section coûtent de l'espace (≈ ½ page de titres et transitions) et fragmentent la méthode en 4 sections courtes. |
| Présentation | La grey list arrive tôt (bien), mais le message central (« exécuter l'annexe mesure l'écart loi ↔ benchmark ») n'est porté par aucune section dédiée : il apparaît en discussion. |
| Risque pages | Élevé : 11 sections + 6 tableaux dépassent 10 pages sans coupes sévères. |

### S2 — « Questions de recherche comme colonne vertébrale »
1 Introduction (RQ2, RQ6, RQ3 explicitées) · 2 Background · 3 From the Annex to executable queries (droit → modèle →
règles gelées, T1) · 4 Materials (corpus, couche thématique T2, templates et leur validation, extraction) · 5 Protocol
(pré-inscription, référence, métriques, baselines) · 6 RQ-A : What can be expressed, what is retrieved ? (T3) ·
7 RQ-B : The price of interpretability (T4, T5) · 8 RQ-C : When the query is right and the benchmark is not (audit T6) ·
9 Discussion & limitations · 10 Conclusion.

| Critère | Analyse |
|---|---|
| Qualité scientifique | Chaque section de résultats répond à une hypothèse pré-enregistrée avec son test ; la structure rend la pré-inscription visible (H1/H0 annoncées § 1 et tranchées § 6–8). C'est la forme la plus défendable devant un relecteur méthodologique. |
| Lisibilité | Le lecteur sait dès l'introduction ce qu'il va apprendre ; les sections de résultats sont autoportantes. Coût : « Materials » devient dense (thèmes + templates + extraction en une section). |
| Présentation | Le « second pilier » (l'audit qui interroge le benchmark) obtient une section de résultats à part entière, ce qui correspond au positionnement (`PUBLICATION_STRATEGY.md` : RQ6). |
| Risque pages | Moyen : 10 sections mais 3 sections de résultats courtes et ciblées ; la méthode est compactée. |

### S3 — « Ressource puis mesure » (papier de ressource)
1 Introduction · 2 Related work · 3 The executable grey list : a resource (ontologie de la directive, expressibilité T1,
schéma de template, 15 règles gelées, plateforme, licence) · 4 Building it on CLAUDETTE (thèmes T2, extraction LLM +
validation juriste, stabilité T7, graphe et parité) · 5 Measuring it (protocole + résultats T3–T5 fusionnés) · 6 Audit
(T6) · 7 Discussion · 8 Conclusion & availability.

| Critère | Analyse |
|---|---|
| Qualité scientifique | Valorise le mieux ce qui est déjà solide (ontologie, règles gelées, parité, stabilité de l'extraction, chargement réel) et rend le papier robuste même si le rappel des requêtes est faible. Risque : perçu comme « ressource + démo » plutôt que comme résultat empirique ; les RQ passent au second plan. |
| Lisibilité | Peu de sections, progression naturelle « voici l'objet, voici comment il est construit, voici ce qu'il vaut ». La section 5 devient longue (protocole + 3 tableaux). |
| Présentation | Met en avant la publication d'artefacts (requêtes, templates, plateforme), argument fort pour JURIX ; mais la nouveauté empirique (« personne n'a exécuté l'annexe ») est moins saillante que dans S2. |
| Risque pages | Faible à moyen : 8 sections, mais § 3–4 accumulent des détails techniques tentants à couper. |

### Verdict
| | S1 IMRaD étendu | S2 RQ | S3 Ressource |
|---|---|---|---|
| Rigueur / défendabilité | ++ | **+++** | ++ |
| Nouveauté mise en avant | + | **+++** | ++ |
| Simplicité de lecture | ++ | **++(+)** | +++ |
| Robustesse si rappel faible | + | ++ | **+++** |
| Tenue en 10 pages | − | **+** | + |

**Retenu : S2, avec deux emprunts** — à S3 la section unique « The executable grey list » qui présente la ressource
(droit → modèle → règles gelées) avant tout matériau, et la conclusion « availability » ; à S1 l'ordre strict
définition → mesure à l'intérieur de chaque section. La structure finale est au § 3.

---

## 2. Bloc par bloc : trois approches, analyse, proposition finale

Pour chaque bloc : A/B/C = trois façons de l'écrire ; ✔ = choix ; budget en mots (hors tableaux).

### 2.1 Titre, résumé, mots-clés (≈ 220 mots)
- A. Résumé « problème → méthode → résultats chiffrés » (classique). B. Résumé « question → ce que nous mesurons →
  ce que nous publions » (l'actuel, sans chiffres). C. Résumé A avec 3 chiffres clés (F1 requêtes vs B2, % d'items
  exprimables, % de FP défendables).
- Analyse : B est honnête tant que les résultats manquent, mais un résumé sans chiffres est faible en camera-ready ;
  A sans structure de question perd le positionnement. ✔ **C** : garder les deux premières phrases du résumé actuel
  (la grey list ignorée, « we turn the grey list into an executable resource »), puis trois chiffres du hold-out
  (item-level P/R agrégés, Δ vs thème seul, écart à B2) et le taux de FP « reference omission ». Titre inchangé
  (déjà enregistré dans EasyChair).

### 2.2 Introduction (≈ 650 mots)
- A. Anecdote juridique (un item lu littéralement) → problème → contributions (v0 actuelle). B. Départ par le
  benchmark (« CLAUDETTE prédit sans motif ») → la loi comme spécification. C. Départ par la question empirique
  (« la liste indicative retrouve-t-elle ce que les juristes annotent ? ») → trois ingrédients → RQ et contributions.
- Analyse : A est élégante et déjà écrite ; B est défensive ; C aligne l'introduction sur S2 et prépare les sections
  de résultats. ✔ **A + C** : conserver les deux premiers paragraphes de v0, remplacer le paragraphe « three ingredients »
  par l'énoncé des trois questions (RQ-A expressibilité/rappel par item = RQ2 ; RQ-B prix de l'interprétabilité = RQ3 ;
  RQ-C benchmark vs loi = RQ6) avec leurs hypothèses pré-enregistrées en une ligne chacune, puis la liste des
  contributions (i–vi) réduite à 5 lignes.

### 2.3 Background and related work (≈ 500 mots)
- A. Cinq paragraphes thématiques (v0 : détection, représentation juridique, requêtes sur contrats, explication,
  couche thématique). B. Deux axes seulement : « détecteurs qui prédisent » vs « représentations qui ne sont pas
  peuplées » — et le vide entre les deux. C. Tableau comparatif des travaux (prédit / explique / cite la loi / peuplé
  depuis le texte).
- Analyse : A est complète et déjà écrite ; C coûte ⅓ de page pour peu de gain ; B est plus incisive mais perd des
  citations attendues (ContractNLI, CUAD, LegalRuleML). ✔ **A resserrée** : garder les cinq paragraphes, couper à
  ≈ 100 mots chacun, déplacer le paragraphe « thematic layer » vers Materials (avec renvoi au short paper comme
  ressource compagnon), ajouter une phrase sur l'extraction schema-guided par LLM et sa stabilité.

### 2.4 The executable grey list : law → model → frozen queries (≈ 700 mots + T1)
- A. Trois sous-sections juridiques : le test général art. 3(1), l'annexe et ses exceptions § 2, la correspondance
  avec CLAUDETTE (v0 « grey list as a resource » + « queries »). B. Une section « du texte de l'annexe à la requête »
  guidée par un item exemple (g) suivi de bout en bout : effet, élément constitutif, exception, champs de template,
  requête, ce que renvoie l'exécution. C. Présentation formelle : schéma de norme, grammaire des requêtes, familles
  R1–R4, gel.
- Analyse : C est aride pour JURIX ; A disperse ; B est la plus lisible et la plus convaincante pour un juriste, mais
  il faut quand même donner le schéma et les familles. ✔ **B avec un encart formel** : fil conducteur (g), puis T1
  (17 items, catégories, thèmes, S/Q/P/—), le schéma de template en un paragraphe (7 champs, `not_stated ≠ none`,
  plusieurs normes par clause), les quatre familles de requêtes avec les quatre exemples en prose de v0, et le
  paragraphe de pré-inscription (écrites sans les labels, gelées par empreinte, lint anti-référence, seuils déclarés
  pour (e) et (h)). Mention explicite : LAW sans item, J rattaché à (q), (c)(n)(o) non exprimables.

### 2.5 Materials : corpus, thematic layer, templates (≈ 650 mots + T2)
- A. Trois sous-sections égales (corpus / thèmes / templates + extraction). B. Une section centrée sur les templates,
  le corpus et les thèmes en un paragraphe chacun avec renvoi au short paper. C. Les thèmes traités comme une simple
  baseline, la construction reléguée en annexe.
- Analyse : C sous-vend la couche validée (elle est ce qui rend les requêtes possibles) ; A coûte une page. ✔ **B** :
  corpus (50 ToS, 9 414 phrases, 1 137 labels, 11,0 %, hold-out 17/4 078/440) ; couche thématique en 120 mots
  (3 annotateurs, α-MASI 0,658 → 0,725 en T11, cascade gold 46,8/48,3/4,9 %, plafond κ 0,859) + T2 (abusivité par
  thème, déjà écrite) ; templates et extraction en 300 mots : pipeline en 7 étapes résumé (schéma fermé, evidence
  obligatoire, ancrage, validation juriste, provenance), pilote 100 clauses × 3 passes (conformité 100 %, 2,03
  normes/clause, Jaccard décisif 0,80, κ de Fleiss 0,77 des phrases signalées ; second extracteur Codex : κ inter-
  modèles 0,63–0,71), écarts au protocole déclarés en une phrase, puis ce qui a été fait sur le hold-out (F3–F4).

### 2.6 Evaluation protocol (≈ 450 mots)
- A. Paragraphe unique dense (v0). B. Liste numérotée des règles pré-enregistrées. C. Tableau « RQ × hypothèse ×
  métrique × test ».
- Analyse : A se lit mal ; C est compact et rend la pré-inscription auditable ; B convient à un rapport, pas à un
  papier. ✔ **C + 150 mots** : un petit tableau (3 lignes RQ-A/B/C : H1, H0, métrique, test, unité) suivi d'un
  paragraphe sur la découpe (33/17, une seule exécution, règles gelées avant validation des templates du hold-out),
  la référence (labels par phrase, item → catégories mappées, `any` sinon), la projection evidence-only, le bootstrap
  par document, la permutation appariée, Holm, et les baselines B0'/B1/B2 avec leur découpe identique.

### 2.7 Results A — expressibility and per-item retrieval (≈ 500 mots + T3 + Fig. 3)
- A. Tableau par requête + commentaire item par item. B. Tableau par item agrégé + trois constats. C. Figure P/R par
  item avec IC + tableau en annexe.
- Analyse : A est le plus complet mais long ; C perd les effectifs ; B risque de masquer les variantes (j, j′, absence).
  ✔ **A compact** : T3 avec une ligne par requête (signalées, P, R, F1 [IC], Δ F1 vs thème seul) et lignes agrégées
  « items structurels » ; trois constats : expressibilité 11/2/1/3, items où H1 est acceptée (P ≥ 0,60, R ≥ 0,50 sur
  LTD/TER/CH), items où elle est rejetée et pourquoi (couverture : borne supérieure du rappel donnée par la présence
  d'une norme). Fig. 3 si la place le permet.

### 2.8 Results B — the price of interpretability (≈ 400 mots + T4 + T5)
- A. Comparaison binaire seulement (F1 abusif : B0' 0,391, B1 0,546, B2 0,701, requêtes). B. Comparaison par catégorie
  mappée. C. Les deux, plus le recouvrement (Venn) et les ablations.
- Analyse : A seule est trompeuse (les requêtes ne visent pas toutes les catégories) ; B seule cache le total ; ✔ **C** :
  T4 à deux blocs (binaire ; par catégorie mappée, IC), test de non-infériorité pré-déclaré à 0,05 sur les items
  structurels, T5 ablations (proposé vs validé = prix de la validation ; evidence vs clause ; T20 vs T11 ; sans thème),
  et le recouvrement avec B2 : ce que les requêtes retrouvent parmi les 65 phrases hors de portée des modèles texte
  (RQ5). Rappeler que les erreurs de B2 sont confiantes (83/101 FN < 0,1) : l'écart n'est pas un problème de seuil.

### 2.9 Results C — when the query is right and the benchmark is not (≈ 450 mots + T6 + Fig. 2)
- A. Statistiques d'audit seules. B. Trois cas commentés seuls. C. Statistiques + cas + κ inter-juristes + taxonomie des
  causes (template / requête / référence).
- Analyse : ✔ **C**, c'est le second pilier : T6 (par requête : correct / discutable / faux ; cause des faux ; part
  « signalement fondé, référence absente » avec IC de Wilson ; κ), Fig. 2 = une explication réelle (clause, template,
  règle, item, phrases témoins) et deux cas de FP défendables en 3 lignes chacun. Résultat de suffisance de
  l'explication (≥ 70 % visé) en une phrase, avec le comparateur saillance si F10 a été fait.

### 2.10 Discussion and limitations (≈ 450 mots)
- A. Trois points + limites en bloc (v0). B. Discussion organisée par RQ. C. Discussion « ce que cela change pour le
  benchmark et pour la pratique » + menaces à la validité listées.
- Analyse : B répète les résultats ; A est déjà bonne ; C ajoute la portée. ✔ **A + menaces explicites de C** : garder
  les trois points de v0 (l'annexe est exécutable là où ça compte ; le thème porte le signal, les templates portent les
  motifs ; le désaccord annexe ↔ benchmark est un résultat), puis les limites dans l'ordre de `PUBLICATION_STRATEGY.md`
  : phrase vs clause, « potentially unfair » ≠ abusif, circularité douce (même équipe pour thèmes/templates/règles,
  atténuée par le gel), templates proposés par un modèle et validés partiellement, seuils déclarés non dérivés,
  17 documents et IC larges, un seul système juridique, écarts du backend d'extraction, B3 absent.

### 2.11 Conclusion and availability (≈ 200 mots)
- A. Reprise des contributions. B. Une phrase de résultat par RQ + ce qui est publié. C. Ouverture (ICAIL, autres
  ordres juridiques, article 3(1)).
- ✔ **B + une phrase de C** : requêtes gelées, ontologie, templates validés (champs + indices, pas les textes),
  code, rapport de parité, plateforme d'annotation ; DOI.

---

## 3. Structure finale retenue et budget

| § | Titre (anglais) | Mots | Tableaux / figures | Pages cumulées |
|---|---|---|---|---|
| — | Title, abstract, keywords | 220 | — | 0,4 |
| 1 | Introduction | 650 | — | 1,3 |
| 2 | Background and related work | 500 | — | 2,0 |
| 3 | The executable grey list: from the Annex to frozen queries | 700 | T1 (≈ 0,55 p.) | 3,5 |
| 4 | Materials: corpus, validated thematic layer, clause templates | 650 | T2 (≈ 0,35 p.), Fig. 1 optionnelle | 4,8 |
| 5 | Pre-registered evaluation protocol | 450 | mini-tableau RQ (≈ 0,2 p.) | 5,6 |
| 6 | Results A — expressibility and per-item retrieval | 500 | T3 (≈ 0,4 p.), Fig. 3 optionnelle | 6,7 |
| 7 | Results B — the price of interpretability | 400 | T4 + T5 (≈ 0,5 p.) | 7,7 |
| 8 | Results C — expert audit: when the query is right and the benchmark is not | 450 | T6 (≈ 0,3 p.), Fig. 2 (≈ 0,3 p.) | 8,9 |
| 9 | Discussion and limitations | 450 | — | 9,6 |
| 10 | Conclusion and availability | 200 | — | 10,0 |

Total ≈ 5 170 mots + ≈ 2,6 pages de tableaux/figures : tient dans 10 pages **si** T1 est resserré (police
`\footnotesize`, colonnes `p{}` déjà réglées) et si Fig. 1 et Fig. 3 restent optionnelles. Ordre de coupe si
dépassement : Fig. 3 → Fig. 1 → 100 mots dans § 2 → T5 réduit à 3 lignes → cas de FP réduits à un.

Cohérence de lecture : chaque section de résultats commence par la question, énonce l'hypothèse pré-enregistrée, donne
le tableau, tranche H1/H0 avec l'IC, et se termine par une phrase de portée. Une seule voix : « we measure », jamais
« we prove ». Les chiffres de conception n'apparaissent que comme diagnostics déclarés dans § 4.

---

## 4. Mappage section → ressources (où trouver quoi)

Notation : chemins relatifs à la racine du dépôt ; **[PUB]** utilisable comme résultat ; **[CONC]** diagnostic de
conception à présenter comme tel ; **[À PRODUIRE]** livré par la chaîne finale (F-numéro de `01_…`).

### § 1 Introduction
- Texte de départ : `jurix2026-long-paper/main.tex (sections dans jurix2026-long-paper/sections/)` § Introduction (paragraphes 1–2 à garder).
- RQ et hypothèses : `legal-kg/docs/RESEARCH_QUESTIONS.md` — RQ2 (l.44-56 : P ≥ 0,60, R ≥ 0,50 sur LTD/TER/CH, ΔF1 > 0 vs
  thème seul), RQ3 (l.58-72 : non-infériorité 0,05, suffisance ≥ 70 %), RQ6 (l.104-114 : ≥ 20 % des FP = référence
  absente), RQ5 (l.89-102 : ≥ 30 % des TP manqués par le texte seul).
- Positionnement « personne n'a exécuté l'annexe » : `legal-kg/docs/PUBLICATION_STRATEGY.md` l.11-24 ; contributions
  défendables l.39-46.
- Références : `eu1993directive`, `lippi2019claudette`, `ruggeri2022memory`, `liepina2020claudettetool`,
  `panarelli2025worth`, `frasheri2024llm`, `micklitz2017empire` (toutes dans `jurix2026-long-paper/references.bib`).

### § 2 Background and related work
- Texte de départ : placeholder § Background (5 paragraphes).
- État de l'art complet : `legal-kg/docs/STATE_OF_THE_ART.md` ; `docs/pactiva-etat-de-l-art-short-paper/00_ETAT_DE_L_ART.md`
  (59 réf., § plateforme) ; `draft/jurix2026_short_paper_etat_de_l_art.md`.
- Bibliographies : `legal-kg/docs/literature/references.bib` (64 entrées, ⚠ 7 à revérifier — liste dans GATES_LOG G1) ;
  `jurix2026-short-paper/references.bib` (40 entrées vérifiées) ; placeholder `references.bib`.
- Clés attendues : détection (`lippi2019claudette`, `lagioia2019deep`, `drawzeski2021corpus`, `galassi2024multilingual`,
  `chalkidis2022lexglue`, `braun2024agbde`, `loffler2025chilean`) ; représentation (`athan2015legalruleml`,
  `sharifi2020symboleo`, `chalkidis2018obligation`, `sancheti2022lexdemod`) ; requêtes (`koreeda2021contractnli`,
  `hendrycks2021cuad`) ; explication (`atkinson2020explanation`) ; extraction LLM (voir inventaire bibliographique § 5).

### § 3 The executable grey list
- T1 déjà rédigé : placeholder `tab:greylist` ; source : `legal-kg/ontology/directive_93_13.yaml` (items l.36-228,
  exceptions § 2 l.25-30, `categories_without_item` l.231-234) ; `legal-kg/docs/LEGAL_MODEL.md` (table l.44-60,
  légende S/Q/P/— l.62-66, niveaux R1–R4 l.70-80, règles de projection l.92-102).
- Schéma de template : placeholder § Clause Templates ; `legal-kg/ontology/legal_kg_schema.yaml` (vocabulaires) ;
  `legal-kg/llm/schemas/clause_template.schema.json`.
- Requêtes : `legal-kg/graph/rules/grey_list_queries.yaml` (15 règles v0.1, familles R1–R3, seuils déclarés e/h) ;
  version compilée `legal-kg/graph/cypher/04_rules_compiled.cypher` ; ADR-003.
- Pré-inscription : `legal-kg/graph/rules/FROZEN.txt` (SHA-256 `8f2967db…`, date UTC) ; contrôles d'étanchéité
  `EXPERIMENTAL_PROTOCOL.md` l.22-25 ; `REPRODUCIBILITY.md` l.55-58 ; tests `legal-kg/tests/test_rule_isolation.py`,
  `test_rules_engine.py`. Si v0.2 : nouvelle ligne FROZEN (F1).
- Références : `eu1993directive`, `micklitz2017empire`, doctrine et CJUE (inventaire bibliographique § 5), `athan2015legalruleml`.

### § 4 Materials
- Corpus : `legal-kg/docs/DATA_PROFILE.md` § 1-2 (50 / 9 414 / 1 137 / 0,1096 ; catégories LTD 296 … A 44) ;
  `DATA_UNDERSTANDING.md` § 2 (sévérité 95,6 %). Hold-out : `docs/pactiva-grey-list-157/00_APPORT_ET_FAISABILITE.md`
  § 9 (888 clauses, 4 078 phrases, 490 labels, 17 documents nommés) ; `legal-kg/data/annotations/SUMMARY.json`.
- Couche thématique : `jurix2026-short-paper/tables/reliability.tex` (α-MASI 0,658 → 0,725), `tables/systems.tex`
  (κ humain 0,859, Legal-BERT 0,720), `sections/03-methodology.tex` (cascade 46,8/48,3/4,9 %) ; T2 déjà rédigé
  (placeholder `tab:themes`, source `DATA_PROFILE.md` § 3) ; réf. `krippendorff2018content`, `passonneau2006masi`,
  `artstein2008intercoder`, `braun2024differ` ; citer le short paper comme ressource compagnon (données publiées
  `data/thematic-layer/`).
- Extraction et templates : `legal-kg/docs/LLM_EXTRACTION.md` (pipeline 7 étapes l.44-54, sélection de modèle l.92-98) ;
  ADR-004 ; pilote **[CONC sauf stabilité PUB]** : `legal-kg/results/extraction/inline-opus5-pilot100-20260915/run.json`
  (300/300, 608 normes, 2,027/clause, 10,7 % vides, ancrage 0,2056), `STABILITY.json` (Jaccard 0,7955, κ Fleiss
  0,7671, 37/35/36 signalées), `codex-pilot100-20260915/STABILITY.json` (κ 0,897), `COMPARE_opus5_vs_codex_passes01.json`
  (κ inter-modèles 0,633/0,707, `other` 0,394 vs 0,514) ; écarts : `run.json.protocol_deviations`. Validation juriste :
  `results/extraction/inline-opus5-pilot100-20260915/validation/` (F2) et hold-out (F4) **[À PRODUIRE]** : κ par champ
  (RQ0, cible ≥ 0,67).
- Graphe (une phrase) : `legal-kg/docs/GRAPH_MODEL.md` l.62-67 (L1–L5), ADR-001/002 ; chargement réel et parité
  `legal-kg/results/parity/fc306c32…/PARITY.md` **[PUB]** ; Fig. 1 depuis `legal-kg/diagrams/*.puml`.

### § 5 Protocol
- Découpe et règles : `EXPERIMENTAL_PROTOCOL.md` l.11-27 (33/17, une seule exécution, evidence-only), l.86-94 (règles
  statistiques 1–7 : bootstrap 1 000 par document, permutation appariée 10 000, Wilson, pas de conclusion sous 30 labels).
- Métriques : `EVALUATION_PLAN.md` § 2 l.32-44 (macro-F1 principal, PR-AUC, couverture) ; § 3 l.52-63 (7 dimensions
  d'explicabilité, suffisance 2 × 200 cas, contrefactuel).
- Baselines : `EXPERIMENTAL_PROTOCOL.md` l.31-38 ; presets Lab `docs/pactiva-lab/specs/pipeline-presets.yaml`
  (`unfair-legalbert-holdout`, `unfair-tfidf-holdout`) ; tâche `U1_unfair` (`research/pactiva_lab/runner.py`).
- Ablations : `ABLATION_PLAN.md` l.9-22 (AB-6/7 validés vs bruts, AB-12 sans exceptions § 2, AB-13 T20).
- Mini-tableau RQ : à composer depuis `RESEARCH_QUESTIONS.md` l.116-127 (synthèse RQ × expérience).

### § 6 Results A
- **[À PRODUIRE F7]** `legal-kg/results/evaluation/holdout-v0.2/E2.json` → T3 (`make_tables.py --table queries`).
- Expressibilité 11/2/1/3 : `LEGAL_MODEL.md` l.62-66, `directive_93_13.yaml`.
- Diagnostic de conception à ne PAS présenter comme résultat : `STABILITY.json.design_diagnostic` (P 0,67–0,69, R 0,46–0,48) ;
  appariements du pilote `legal-kg/results/rules/pilot100-*/SUMMARY.json` (38 / 37 phrases ; par item j 10, g 8, k 5…).
- Couverture (borne du rappel) : nombre de phrases abusives des catégories mappées portées par une clause ayant au moins
  une norme — à calculer dans F7.

### § 7 Results B
- B0'/B1/B2 **[PUB]** : `legal-kg/results/baselines/README.md` (macro 0,219 / 0,447 ; binaire 0,391 / 0,546 / 0,529 Lab ;
  **B2 0,701 [0,650 ; 0,749], AUC-PR 0,775, κ 0,661, ECE 0,056**) ; JSON `results/baselines/24e6dcb9…/run.json`,
  `B2_lab_bb37a8ce/results.json`, prédictions `predictions.jsonl` (B1 et B2) pour l'appariement phrase à phrase.
- Analyse d'erreurs B2 **[PUB]** : `B2_lab_bb37a8ce/ANALYSIS.md` (rappel par catégorie TER 0,89 → A 0,65 ; F1 par thème
  0,37–0,79 ; 83/101 FN < 0,1 ; 129/188 FP > 0,9 ; recouvrement 243/96/36/65).
- Requêtes vs B2 par catégorie mappée et non-infériorité **[À PRODUIRE F7/F8]** ; ablations T5 **[À PRODUIRE]**.
- Référence texte-seul externe (non comparable, à citer avec prudence) : LexGLUE UNFAIR-ToS `chalkidis2022lexglue`,
  `chalkidis2020legalbert`.

### § 8 Results C — audit
- **[À PRODUIRE F9–F11]** `AUDIT.csv`, κ inter-juristes, causes ; taxonomie `legal-kg/docs/ERROR_ANALYSIS.md` l.12-24
  (E-DIS = référence discutable → RQ6, E-RUL-M/D, E-EXT-*, E-PRJ), procédure l.28-33.
- Fig. 2 : lire un cas réel via `legal-kg/graph/cypher/03_explanation_queries.cypher` (exemple déjà obtenu :
  Endomondo, clause 483, Q-p, item (p), phrase 490) ; explication en prose générée par la même requête.
- Sévérité CLAUDETTE (pour qualifier les FP défendables) : `legal-kg/data/annotations/claudette_severity.jsonl`.
- Suffisance de l'explication (RQ3/RQ4) **[À PRODUIRE F10]** : `EVALUATION_PLAN.md` l.52-63 ; ADR-005.

### § 9 Discussion
- Trois points : placeholder § Discussion. Menaces à la validité : `PUBLICATION_STRATEGY.md` l.50-53 ; petits effectifs
  `EXPERIMENTAL_PROTOCOL.md` l.92-93 (A : 17 labels sur le hold-out) ; LAW sans item `LEGAL_MODEL.md` l.64-66 ;
  écarts de protocole `run.json.protocol_deviations` ; dettes `GATES_LOG.md` (relecture juriste de l'ontologie, B3,
  fusion `HAS_THEME` sans effet sur les règles).
- Réf. : `braun2024differ` (désaccord conservé), `atkinson2020explanation`.

### § 10 Conclusion and availability
- Politique de publication : `REPRODUCIBILITY.md` l.62-65 (structures + offsets, pas les textes ; DOI Zenodo) ;
  licence CLAUDETTE (textes non redistribués) ; plateforme Pactiva (mention déjà présente dans le short paper,
  `sections/06-conclusion.tex`) ; artefacts : `graph/rules/`, `ontology/`, `results/parity/`, `FROZEN.txt`.

### Bibliographie — voir § 5 ci-dessous (inventaire par thème)

## 5. Bibliographie — une seule source à maintenir, trous à combler

**Source unique** : `legal-kg/docs/literature/references.bib` (64 entrées). Les .bib du short paper (40) et du placeholder (46)
en sont des préfixes exacts : aucun conflit de clé ; le .bib final du long paper sera un sous-ensemble de A + les ajouts
ci-dessous. Style `vancouver.bst`, BibTeX (pas biber), **jamais d'arobase dans un commentaire**. Statuts de vérification
les plus fins : `draft/jurix2026_short_paper_etat_de_l_art.md` § 11.

### 5.1 Références par section (clés existantes ✅ sauf mention)
| § | Clés |
|---|---|
| 1 Introduction | `eu1993directive`, `lippi2019claudette`, `ruggeri2022memory` (⚠ DOI), `liepina2020claudettetool`, `panarelli2025worth` (⚠ abstract), `frasheri2024llm`, `micklitz2017empire` (⚠ DOI) |
| 2 Related — détection | `lagioia2019deep`, `drawzeski2021corpus`, `galassi2024multilingual` (⚠ volume), `chalkidis2022lexglue`, `braun2024agbde`, `loffler2025chilean`, `chalkidis2020legalbert`, `dominguezolmedo2025lawma` |
| 2 Related — représentation & KG | `athan2015legalruleml`, `sharifi2020symboleo`, `hoekstra2007lkif`, `hogan2021kg`, `angles2018property`, `filtz2021linkedlegal`, `casanovas2016swlegal`, `sovrano2020legalkg`, `hashmi2018compliance`, `chalkidis2018obligation`, `sancheti2022lexdemod` |
| 2 Related — requêtes / construction auto | `koreeda2021contractnli`, `hendrycks2021cuad` (⚠), `zhong2023kgc`, `pan2024llmkg`, `edge2024graphrag`, **`dechtiar2025graphgrpolex` (à ajouter, travail le plus proche, ⚠ DOI IEEE)** |
| 2 Related — explication | `atkinson2020explanation`, `ruggeri2022memory`, `liepina2020claudettetool` |
| 3 Grey list | `eu1993directive`, `micklitz2017empire`, `athan2015legalruleml` ; **jurisprudence CJUE à créer en `@misc` avec ECLI** : *Océano Grupo* C-240/98 à C-244/98, *Invitel* C-472/10, *RWE Vertrieb* C-92/11, *Aziz* C-415/11 (citées en prose dans `legal-kg/docs/LEGAL_MODEL.md` l.8-10, 65) |
| 4 Materials — couche thématique | `krippendorff2018content`, `passonneau2006masi`, `artstein2008intercoder`, `marchal2022multilabel`, `braun2024differ`, `nangia2019human`, plateformes `klie2018inception`, `stenetorp2012brat` |
| 4 Materials — extraction LLM | `pan2024llmkg`, `zhong2023kgc`, `savelka2023unreasonable`, `choi2024llmeffect` (ancrage des pré-annotations) ; **à ajouter** : génération contrainte / extraction structurée (Xu et al. 2023, Willard & Louf 2023 « Outlines »), hallucination (Ji et al. 2023) — citées sans clé dans `STATE_OF_THE_ART.md` § 5 |
| 5 Protocol | **à ajouter** : bootstrap par grappes/documents, validation croisée par groupes, pré-inscription en ML (aucune entrée méthodologique dans le .bib) |
| 7 Results B | `chalkidis2022lexglue`, `chalkidis2020legalbert`, `zheng2023judging` / `bavaresco2025judges` si B3 est ajouté |
| 8 Audit / 9 Discussion | `atkinson2020explanation`, `braun2024differ`, `plank2022variation`, `uma2021disagreement`, `micklitz2017empire` |
| 10 Availability | `memgraph-mage` (⚠ date de consultation à fixer), `pei2022potato` (⚠ pages) si la plateforme est comparée |

### 5.2 À faire côté bibliographie (F12 et rédaction)
1. **Créer** les entrées manquantes prioritaires : `dechtiar2025graphgrpolex`, `juttu2025texttotrust`, `singh2025survey`,
   `grundler2024vague`, `mukherjee2026geometry` (toutes ✅ dans le draft d'état de l'art, absentes de A) ; 4 arrêts CJUE
   (`@misc`, ECLI, date, curia.europa.eu) ; 3 références d'extraction structurée ; 2–3 références statistiques.
2. **Revérifier** avant camera-ready : `ruggeri2022memory`, `micklitz2017empire`, `galassi2024multilingual`,
   `panarelli2025worth`, `pei2022potato`, `kipf2017gcn`, `memgraph-mage`, `hendrycks2021cuad` (liste GATES_LOG G1 : 7 ⚠).
3. Ne pas citer `docs/pactiva-etat-de-l-art-short-paper/00_ETAT_DE_L_ART.md` comme source de statut (remplacé le 14 sept.).
4. Budget : ≈ 45 références pour 10 pages ; les blocs GAD/GNN (`akoglu2015graph`, `ma2023gad`, …) ne servent pas ce
   papier et restent pour ICAIL.

---

## 6. Récapitulatif des décisions proposées

1. Structure **S2** (colonne vertébrale = trois questions pré-enregistrées), enrichie de la section unique « executable
   grey list » (S3) ; 10 sections, ≈ 5 200 mots, 6 tableaux + 2 figures optionnelles.
2. Le brouillon v0 du placeholder est conservé à ≈ 70 % : introduction (2 premiers §), état de l'art resserré, T1, T2,
   templates, exemples de requêtes, discussion, conclusion.
3. Les résultats de conception (P/R du pilote, 38 appariements) n'apparaissent qu'en § 4 comme diagnostics déclarés ;
   seuls les chiffres du hold-out portent les sections 6–8.
4. Le second pilier (audit, « quand la requête a raison et le benchmark tort ») a sa section de résultats ; c'est ce qui
   rend le papier publiable même si le rappel des requêtes est faible.
5. Trois chantiers bibliographiques à ouvrir dès maintenant : CJUE en BibTeX, extraction structurée par LLM, méthodes
   statistiques de la pré-inscription.
