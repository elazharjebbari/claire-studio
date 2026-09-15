# Submission 157 — « Executing the Grey List » : apport scientifique et faisabilité depuis notre point de départ

> **Date : 14 septembre 2026 (matin).** Analyse préalable à la rédaction du long paper JURIX 2026
> (≤ 10 pages, IOS Press). Le PDF déposé le 14 sept à 07 h 55 est un placeholder ; la grâce d'édition
> court sur ~1 jour. Ce document répond à deux questions : **qu'apporte ce papier** (et à quelles
> conditions l'apport tient), et **qu'est-ce qui est faisable** à partir de ce que nous avons
> réellement ce matin — avec des chiffres de dimensionnement calculés sur l'export du dataset
> `7116e627…` (50 ToS, 9 414 phrases, 2 450 clauses).
>
> Pièces connexes : placeholder `jurix2026-long-paper/`, état de l'art
> `draft/jurix2026_short_paper_etat_de_l_art.md` (§2-H : aval), modèle de clause et requêtes
> `docs/pactiva-fusion-classes/05_MODELE_GRAPHE.md` (§3–5), résultats G2 `docs/pactiva-experiences-papiers/04`.

---

## 0. Verdict en dix lignes

1. **L'apport est réel et bien placé pour JURIX** : le papier fait ce qu'aucun détecteur de clauses abusives ne fait — **exécuter l'annexe de la directive 93/13** comme un jeu de requêtes lisibles, pré-enregistrées, et **mesurer** ce que cette lecture littérale retrouve du benchmark CLAUDETTE. Il touche les trois topics déclarés (représentation des règles/DSL, XAI juridique, extraction d'information) et il est **publiable quel que soit le sens du résultat** (§2.3).
2. **La faisabilité est bonne parce que le socle existe** : couche thématique triple-annotée, 2 450 clauses déjà délimitées, étiquettes CLAUDETTE par phrase dans l'export, split conception/validation figé (33/17), baseline « thème seul » déjà calculée, moteur de plis/bootstrap, accès Grid'5000, deux juristes dans l'équipe.
3. **Ce qui manque est précisément ce que l'abstract promet de neuf** : les **templates** (extraction + validation humaine), les **requêtes** (écriture, gel, moteur), l'**évaluation par item** sur le hold-out, le **modèle texte-seul d'abusivité** (n'existe pas : nos modèles prédisent les thèmes, pas l'abusivité) et l'**audit expert**.
4. **En 24 h**, un périmètre honnête est atteignable : templates sur les **533 clauses cibles du hold-out** (proposition LLM + validation juriste sur les 5 thèmes à forte strate, ~240 clauses), **11 requêtes gelées** avec empreinte, P/R par item contre les 490 labels CLAUDETTE du hold-out, baselines thème-seul et TF-IDF, audit des phrases signalées. Legal-BERT-abusivité et la validation exhaustive vont au camera-ready (15 octobre).
5. **Trois risques scientifiques doivent être traités dans le texte, pas contournés** : la pré-inscription est crédible seulement si elle est **documentée** (empreinte, date, ce que les auteurs savaient) ; la comparaison « requêtes vs modèle appris » oppose deux régimes (sans étiquettes vs supervisé) et doit être présentée ainsi ; l'annexe et les 8 catégories CLAUDETTE **ne coïncident pas** — c'est un résultat, à condition de le mesurer.

---

## 1. Le sujet, décomposé

### 1.1 La thèse

> La grey list n'est pas une liste de mots-clés mais une liste de **configurations de droits et
> d'obligations** (qui peut faire quoi, à qui, sous quelle condition, avec quel recours). Si l'on
> dispose (i) du **type** de chaque clause et (ii) d'une **structure minimale** de cette clause, alors
> chaque item de l'annexe devient une **requête** exécutable, dont chaque déclenchement cite son
> fondement juridique. La question empirique — ouverte parce que la liste est indicative — est **ce que
> cette exécution littérale retrouve** des clauses que des juristes ont marquées comme abusives.

### 1.2 Les neuf engagements de l'abstract

| # | Engagement (abstract) | Nature | Existe ? |
|---|---|---|---|
| E1 | Chaque clause identifiée par son **thème validé par des humains** | ressource | ✅ couche thématique (short paper) |
| E2 | Clause → **template** : qui agit, obligation/permission/interdiction, conditions, délais, recours | extraction + validation | ❌ schéma conçu (05_MODELE_GRAPHE §3), rien d'extrait |
| E3 | **Requêtes** traduisant les items de la grey list en conditions sur templates | représentation | ❌ 4 familles esquissées en pseudo-Cypher, aucune requête exécutable |
| E4 | Requêtes **écrites sans accès aux labels** et **figées avant évaluation** | protocole | ❌ à faire ET à documenter (empreinte, date) |
| E5 | **Quels items sont exprimables** | analyse | ✅ fait dans le placeholder (11 S / 2 Q / 1 P / 3 —), à consolider |
| E6 | **Précision/rappel par requête** contre les labels de référence, sur hold-out | évaluation | ❌ ; hold-out figé (17 docs), 490 labels disponibles |
| E7 | Les templates ajoutent-ils du signal **au-delà du thème seul** | ablation | ✅ baseline thème-seul existe (AP LODO 0,404/0,418 ; P(abusif\|thème)) ; ❌ comparaison à faire |
| E8 | **Coût de l'interprétabilité** face à un modèle appris texte-seul | comparaison | ❌ aucun modèle d'abusivité entraîné chez nous (nos modèles prédisent les thèmes) ; LexGLUE fournit une référence externe |
| E9 | **Audit expert** des explications ; faux positifs → **omissions du corpus de référence** ; publication | validation + ressource | ❌ ; juristes disponibles ; plateforme sans écran « template » |

### 1.3 Ce que le papier n'est pas

Il n'est **pas** un détecteur de plus, ni un système de raisonnement juridique complet, ni une
formalisation LegalRuleML. C'est un **papier de mesure d'une ressource juridique** (l'annexe) rendue
exécutable par une ressource linguistique (la couche thématique) et une structure délibérément
pauvre (le template). Cette modestie est sa force : chaque résultat est lisible par un juriste et
falsifiable.

---

## 2. L'apport scientifique

### 2.1 Ce qui est neuf (et vérifié contre l'état de l'art)

| Apport | Pourquoi c'est neuf | Preuve de nouveauté |
|---|---|---|
| **Exécuter l'annexe 93/13 comme requêtes** | Toute la lignée CLAUDETTE (Lippi 2019 → Galassi 2024 → Panarelli ICAIL 2025) *classifie* ; les explications sont apprises (Ruggeri 2022, outil CLAUDETTE 2020). Personne n'a pris l'annexe comme **spécification** exécutable et mesuré son rappel. | état de l'art §2-A, §2-H ; recherches « grey list executable », « Annex 93/13 rules detection » sans résultat |
| **Pré-inscription de règles juridiques** | Les approches à règles en droit (LegalRuleML, Symboleo) sont des langages d'auteur ; aucune évaluation de règles **gelées avant** de voir les labels sur ce benchmark. | §2-H ; Atkinson et al. 2020 réclament l'explication en termes juridiques sans protocole d'évaluation |
| **Séparer le signal du type et le signal de la structure** | Le thème seul porte déjà 3,7 × le hasard (AP 0,404) ; savoir ce que la structure ajoute est une question que ni ContractNLI ni CUAD ne posent (ils apprennent la réponse). | résultats G2 ; §2-H |
| **Le benchmark contre la loi** | Les catégories CLAUDETTE dérivent de l'annexe mais ne la recouvrent pas (LAW sans item ; items (c), (d), (h), (n), (o) sans catégorie). Mesurer l'écart et **remonter des omissions** du corpus de référence par audit est une contribution au benchmark lui-même. | tableau 1 du placeholder ; Braun 2024 sur les jeux de données juridiques |
| **Ressource : templates + requêtes + structures validées** | Aucune ressource publique de clauses de ToS structurées (acteur/modalité/action/conditions/recours) ; Braun & Matthes 2022 non publié, AGB-DE sans structure. | §3 de l'état de l'art |

### 2.2 Adéquation aux topics JURIX déclarés

- *Computational representations of legal rules and DSLs for law* : le couple template + requête est une mini-DSL, volontairement plate, avec sémantique explicite (§6) ; l'analyse d'expressibilité (E5) est une contribution de représentation.
- *Explainable AI for legal applications* : l'explication n'est pas post-hoc — c'est la requête elle-même et les champs qui l'ont satisfaite ; l'audit expert mesure si cette explication **suffit à trancher**.
- *Information extraction* : le remplissage des templates est de l'extraction structurée, proposée par LLM et validée ; l'ablation « propositions brutes vs validées » (E7-bis) chiffre le prix de la validation.

### 2.3 Pourquoi le résultat est publiable dans les deux sens

| Si la grey list exécutée… | Lecture | Ce qu'on écrit |
|---|---|---|
| retrouve une **large part** des labels (rappel élevé sur (a)/(b), (f)/(g), (j)/(k), (q)) avec une précision comparable au modèle appris | la loi, lue littéralement, est un détecteur compétitif **et** explicable | « interpretability is cheap here » + où le modèle appris garde l'avantage |
| retrouve **peu** (rappel faible) | les annotateurs CLAUDETTE ont marqué bien au-delà de l'annexe : le benchmark encode une doctrine plus large que la liste | mesure de l'écart loi ↔ benchmark, item par item ; ce que les templates ne capturent pas (proportionnalité, faits externes) |
| retrouve **autre chose** (précision faible mais faux positifs défendables à l'audit) | le corpus de référence a des omissions | contribution au benchmark : liste de phrases candidates, taux d'omission estimé par l'audit |

Le protocole pré-enregistré est ce qui rend ces trois issues également crédibles : on ne peut pas être
accusé d'avoir ajusté les requêtes au résultat.

### 2.4 Les faiblesses conceptuelles à traiter dans le texte

1. **« Potentially unfair » ≠ abusif.** CLAUDETTE étiquette des clauses *potentiellement* abusives (et les niveaux de sévérité sont absents de l'export utilisé — tous à 1). Les requêtes retrouvent des *configurations* ; l'écart avec le jugement d'abusivité au cas par cas est assumé.
2. **Phrase vs clause.** La référence est par phrase, l'annexe parle de clauses. Il faut une **règle de projection** déclarée : une clause signalée ⇒ toutes ses phrases signalées ? seulement les phrases portant le template ? (proposition §6.4 : la phrase d'origine du champ décisif + les phrases de la même clause portant une catégorie mappée comptent comme TP ; le reste de la clause n'est ni TP ni FP — sinon les clauses longues (max 68 phrases) écrasent la précision).
3. **Annexe ↔ catégories.** LAW n'a pas d'item ; J n'existe que via (q) ; CR se rattache à (f) par extension ; (c), (d), (h), (n), (o) n'ont pas de catégorie. Le mapping doit être **tabulé et justifié** (fait au placeholder, à faire relire par les juristes).
4. **Circularité douce.** Les thèmes viennent de notre couche ; les templates sont proposés par un LLM et validés par les auteurs-juristes ; les requêtes sont écrites par ces mêmes juristes, qui connaissent les définitions CLAUDETTE et les statistiques du corpus de conception. La parade : **split strict** (les 17 documents de validation n'ont servi ni à concevoir les thèmes fusionnés, ni les templates, ni les requêtes), **empreinte** des requêtes avant validation des templates du hold-out, et **déclaration** explicite de ce que les auteurs savaient (les taux d'abusivité par thème sur les 33 documents de conception — pas ceux du hold-out).
5. **Deux régimes comparés.** Le modèle texte-seul est **supervisé** par les labels ; les requêtes ne voient **aucun** label. Présenter E8 comme « ce que coûte de se passer des labels *et* d'obtenir une explication », pas comme un match à armes égales. Ajouter le troisième point de comparaison : le **thème seul supervisé** (P(catégorie \| thème) estimée sur la conception), qui isole ce que la structure apporte à supervision constante.
6. **Prix de la validation humaine.** Sans validation, les templates sont des sorties LLM ; l'ablation « propositions brutes vs validées » (E7-bis) est indispensable pour que la ressource ne soit pas un décalque.

---

## 3. Point de départ : inventaire des actifs (état réel ce matin)

| Actif | État | Où | Utilité pour 157 |
|---|---|---|---|
| **Export dataset** `7116e627…` : 9 414 phrases avec texte, thème primaire/secondaires consensus, `boundary`, **`unfair` (catégories CLAUDETTE)**, votes bruts, juges, gold, splits | ✅ local (copie de session) et Lab prod | `sentences.jsonl`, `reference.jsonl` (1 137 labels), `votes.jsonl`, `judges.jsonl`, `gold.jsonl`, `splits.json` | **tout le matériau** ; aucun accès prod nécessaire |
| **Clauses** = plages maximales de phrases de même jeu de thèmes | ✅ `build_segments()` → **2 450 clauses** (médiane 2 phrases, max 68) | `research/pactiva_lab/cooccurrence.py` | unité des templates ; ⚠ scinder les clauses > ~8 phrases avant extraction |
| **Split conception/validation** 33/17 figé (spécification `frozenAt`) | ✅ | `frontend/src/lib/taxonomy/taxonomies.json` (`populations`) | le hold-out du papier, déjà utilisé par le short : cohérence entre les deux papiers |
| **Strates d'abusivité par thème** | ✅ calculées (50 docs) ; à **recalculer sur les 33** pour le texte pré-inscription | `docs/pactiva-audit-2026-09/annexes/explore_full.json` | motivation + baseline thème-seul |
| **Baseline thème-seul** P(abusif \| thème / combinaison), AP LODO | ✅ 0,404 / 0,418 (T20, 50 docs) ; combinaison 0,589 (votes, G2) | `run_taxonomy_matrix.py`, `cooccurrence.py` | E7 ; à refaire **par catégorie** et sur conception → hold-out |
| **Proxy déontique** par règles de modaux | ✅ `deontic_tag()` (obligation/interdiction/permission/statement) | `cooccurrence.py` | amorce du champ *modalité* ; insuffisant seul |
| **Moteur de règles pur** (triage C1–C5, YAML, miroir PY/TS, cas dorés) | ✅ conçu et implémenté pour les thèmes | `backend/claire/triage/engine.py`, `frontend/src/lib/triage/engine.ts` | patron réutilisable pour le **moteur de requêtes** (conditions déclaratives + explication retournée) |
| **Lab** : plis par document, bootstrap par document, enveloppes/portes de validité, export LaTeX | ✅ | `research/pactiva_lab`, `research/experiments/campaign.py` | rigueur statistique clé en main ; ajouter une enveloppe « E-GL » |
| **Legal-BERT fine-tuning** (thèmes) | ✅ code + G5K opérationnel (E4.4 hier) | `models/heavy.py`, frontales lyon/nancy | E8 : **changer la cible** (`unfair` → binaire ou par catégorie) : modification légère du runner |
| **Juges LLM** (4 × 9 414 phrases, thèmes) | ✅ | `judges.jsonl` | pas directement utile (thèmes) ; montre que le pipeline externe existe |
| **Client LLM dans le dépôt** | ❌ **aucun** — les pré-annotations ont été importées de fichiers (`import_preannotations`) | — | l'extraction de templates exige le **pipeline externe** (celui des juges v9.2) ou un script API ad hoc |
| **Plateforme Pactiva** | ✅ prod ; pas d'écran « template » | — | validation des templates **hors plateforme** pour 157 (tableur/JSON + CLI) ; écran = camera-ready |
| **Juristes** | ✅ 2 co-autrices juristes + 1 annotateur | — | écriture des requêtes, validation, audit |
| **Chiffres du hold-out** (calculés ce matin) | 17 docs ; **888 clauses**, 4 078 phrases ; **533 clauses des 10 thèmes cibles** (2 388 phrases, **219 abusives**) ; **490 labels** : LTD 132 · TER 102 · CH 88 · CR 52 · USE 44 · J 28 · LAW 27 · A 17 | — | dimensionnement §5 |

---

## 4. Écart engagement → actif → effort

| Eng. | Ce qu'il faut produire | À partir de | Effort (h·personne) | Qui | Risque |
|---|---|---|---|---|---|
| E2 | schéma JSON du template (champs + vocabulaires fermés par thème) | 05_MODELE_GRAPHE §3 | **1,5** | A. + juriste | vocabulaire d'actions trop fin → silence ; trop grossier → requêtes molles |
| E2 | prompt d'extraction + exécution sur les 533 clauses cibles du hold-out (et les 930 de conception pour l'ablation E7-bis si le temps le permet) | pipeline externe des juges ou script API | **2–3** (dont ~30 min de calcul) | A. | clauses longues (> 8 phrases) à scinder ; sorties JSON invalides |
| E2 | **validation humaine** des templates du hold-out : 5 thèmes à forte strate (LTD 76 + TER 55 + MOD 53 + ARB 32 + LAW 26 = **242 clauses**) à ~1 min/clause | propositions LLM | **4** (2 juristes × 2 h) | F.Z.B., F.O. | fatigue → validation « d'accord par défaut » : mesurer l'accord inter-validateurs sur 40 clauses communes |
| E3 | **11 requêtes** (items structurels) + 2 quantitatives à seuil déclaré + 1 proxy (i) ; format JSON déclaratif ; moteur d'exécution retournant l'explication | 05_MODELE_GRAPHE §4, tableau 1 du placeholder | **3** (2 écriture juriste + 1 moteur) | juriste + A. | sémantique de *not stated* vs *none* ; agrégation clause → phrases |
| E4 | **gel** : fichier de requêtes + schéma + mapping items↔catégories, **SHA-256 + commit horodaté** AVANT toute validation de template du hold-out et AVANT tout calcul sur le hold-out ; note « ce que les auteurs savaient » | — | **0,5** | A. | à faire **en premier** dans l'ordre chronologique — c'est la crédibilité de tout le papier |
| E5 | tableau des 17 items consolidé et relu par juriste | placeholder | **0,5** | juriste | (c)/(d)/(h) : trancher S vs — |
| E6 | script d'évaluation : P/R/F1 par requête et par item, IC bootstrap par document (17 docs → IC larges, à dire) | Lab (`measurement.py`) | **1,5** | A. | règle de projection clause → phrase (§6.4) |
| E7 | baseline thème-seul **par catégorie** : P(cat \| thème) estimée sur les 33, seuil fixé sur les 33, appliquée aux 17 ; + variante combinaison | `run_taxonomy_matrix.py` | **1,5** | A. | — |
| E7-bis | même requêtes sur templates **non validés** | E2 | **0,5** | A. | — |
| E8 | modèle texte-seul d'abusivité : **TF-IDF + LR** par catégorie (33 → 17) aujourd'hui ; **Legal-BERT** binaire/par catégorie sur G5K (job ~1–2 h) si la journée le permet, sinon camera-ready + **LexGLUE** en référence externe | `baselines.py`, `heavy.py` (cible à changer) | **1** (TF-IDF) / **3** (Legal-BERT, dont attente) | A. | ne pas comparer des splits différents ; déclarer le régime supervisé |
| E9 | audit : toutes les phrases signalées sur le hold-out classées {correct, discutable, faux} + origine de l'erreur {template, requête, référence} ; grille en tableur ; 2 juristes, désaccords discutés | sorties E6 | **3** (si ≤ 400 phrases signalées) | F.Z.B., F.O. | volume inconnu avant E6 : prévoir un échantillonnage stratifié par requête si > 400 |
| E9 | publication : JSON (templates validés, requêtes, mapping), README, licence, DOI | — | **1** (+ camera-ready) | A. | licence des textes CLAUDETTE : publier structures + offsets, pas les textes |

**Total minimal (E2 partiel, E3, E4, E5, E6, E7, E7-bis, E8 TF-IDF, E9 audit) ≈ 18–20 h·personne**,
parallélisable sur 3–4 personnes : **tenable en une journée longue**, à condition que l'extraction LLM
soit lancée tôt et que l'ordre de gel soit respecté.

---

## 5. Plan de faisabilité en trois horizons

### H0 — le PDF de la grâce (≤ 24 h) : un périmètre vrai, pas un périmètre complet

Ordre **chronologique impératif** (la crédibilité de E4 en dépend) :

| Heure | Action | Livrable |
|---|---|---|
| T+0 | Recalculer les strates par thème **sur les 33 documents de conception seulement** ; figer le schéma de template et les vocabulaires | `schema.json`, tableau strates-conception |
| T+1 | Juristes : écrire les requêtes à partir du texte de l'annexe + définitions CLAUDETTE + schéma (sans regarder le hold-out) ; A. : moteur | `queries.json` |
| T+3 | **GEL** : commit + SHA-256 de `schema.json`, `queries.json`, `mapping_items.json`, `preregistration.md` (ce que les auteurs savaient) | empreinte dans le papier |
| T+3 | Lancer l'extraction LLM des templates : hold-out 533 clauses cibles (puis conception 930 si temps) | `templates_proposed.jsonl` |
| T+4 → T+8 | Validation humaine : 242 clauses des 5 thèmes forts (2 juristes en parallèle, 40 clauses communes pour l'accord) ; en parallèle A. : baselines thème-seul et TF-IDF, script d'évaluation | `templates_validated.jsonl`, baselines |
| T+8 | Exécuter les requêtes (validées + brutes) ; P/R par item ; IC bootstrap | tableau 3 rempli |
| T+9 → T+12 | Audit des phrases signalées (échantillonnage stratifié si > 400) ; rédaction résultats/discussion | grille d'audit, texte |
| T+12 | Recompiler, contrôle 10 pages, dépôt | PDF |

**Ce que le PDF H0 dira honnêtement** : templates validés sur les 5 thèmes qui portent 93 % des labels
LTD/TER/CH/A/J/LAW du hold-out ; requêtes des autres thèmes (fees, preamble, user content, third
party) exécutées sur templates **proposés** et marquées comme telles ; Legal-BERT-abusivité annoncé pour
la version finale avec LexGLUE comme référence externe.

### H1 — camera-ready (15 octobre, si accepté)

Validation des 533 clauses du hold-out (puis des 930 de conception pour E7-bis complet) ; accord
inter-validateurs par champ ; Legal-BERT binaire et par catégorie sur le même split (G5K, 2 jobs) ;
requêtes de **composition** (F3 : exclusion + garantie + indemnisation) et d'**absence** (F2 : modification
sans notification) évaluées qualitativement ; écran « template » dans la plateforme ; dépôt Zenodo.

### H2 — au-delà (article de revue)

Niveaux de sévérité CLAUDETTE (archive XML originale) ; extension multilingue (corpus Drawzeski) ;
comparaison avec un LLM prompté avec le texte de l'annexe (le « juge grey list ») ; templates comme
supervision faible d'un détecteur appris.

---

## 6. Le protocole à figer maintenant (texte de pré-inscription)

### 6.1 Données et split
- Corpus : 50 ToS CLAUDETTE, export `7116e627…` ; clauses = plages maximales de phrases de même jeu de thèmes consensus (2 450).
- **Conception** : les 33 documents `designSet` de la spécification de taxonomie (`frozenAt` antérieur) ; **validation** : les 17 `holdout`. Aucun chiffre du hold-out n'est consulté avant le gel.
- Référence : `reference.jsonl` (catégorie par phrase). Un item est scoré contre la ou les catégories du mapping ; les items sans catégorie (d, m, p) contre « toute catégorie ».

### 6.2 Schéma de template (champs fermés)
`actor ∈ {provider, user, third_party}` · `modality ∈ {obligation, permission, prohibition, power}` ·
`action ∈ inventaire par thème` (terminate, suspend, modify_terms, modify_service, change_price,
exclude_liability, cap_liability, license_content, remove_content, impose_arbitration,
waive_class_action, choose_forum, choose_law, retain_payment, auto_renew, assign_contract,
interpret_terms, …) · `object` (libre court) · `conditions ∈ {for_cause, specified_reason,
discretion, none_stated}` · `notice ∈ {duration, reasonable, none, not_stated}` · `remedy ∈ {refund,
right_to_cancel, compensation, none, not_stated}` · `evidence` = indices des phrases d'origine.
Convention : **`not_stated` ≠ `none`**. Une clause peut porter plusieurs templates.

### 6.3 Requêtes
Conjonctions de conditions sur les champs (égalité, appartenance, négation), éventuellement sur
plusieurs templates du même document (composition). Chaque requête cite son item. Seuils déclarés pour
(e) et (h). Fichier `queries.json` + moteur pur (`grey_list/engine.py`) retournant, par déclenchement,
les champs satisfaits et les phrases d'origine.

### 6.4 Règle de projection clause → phrase (scoring)
Une requête qui se déclenche sur un template marque **les phrases `evidence` du template** (pas toute
la clause). TP si la phrase porte une catégorie mappée ; FP sinon ; FN = phrases de la référence
(catégories mappées) dans les documents du hold-out non marquées par l'item. Rapporter aussi la variante
« clause entière » en annexe pour montrer la sensibilité.

### 6.5 Métriques
Par requête et par item : P, R, F1 ; par catégorie CLAUDETTE : F1 des requêtes vs thème-seul vs
TF-IDF (vs Legal-BERT en H1) ; IC 95 % par bootstrap sur les 17 documents (déclarer leur largeur).
Ablation : templates validés vs proposés. Audit : proportions {correct, discutable, faux} et origine de
l'erreur.

### 6.6 Ce que les auteurs savaient au moment du gel (à écrire tel quel)
Les définitions des 8 catégories CLAUDETTE ; les taux d'abusivité par thème **sur les 33 documents de
conception** ; l'existence d'un signal de combinaison de thèmes (G2) ; **pas** les labels ni les
statistiques des 17 documents de validation ; pas les templates du hold-out (extraits après le gel).

---

## 7. Risques et parades

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Extraction LLM indisponible ou lente (pas de client dans le dépôt) | moyenne | bloquant pour E2 | lancer le pipeline externe dès T+3 ; repli : templates **rédigés à la main** par les juristes pour les 242 clauses des 5 thèmes forts (c'est ~4 h, et cela supprime le biais LLM) |
| Volume d'audit > 400 phrases | moyenne | E9 partiel | échantillon stratifié par requête (30 par requête), déclaré |
| Rappel très faible sur (q) parce que J/A/LAW se jouent en une phrase déjà bien typée par le thème | élevée | « les templates n'ajoutent rien » | c'est un résultat : le thème suffit pour les items à un seul champ ; les templates comptent pour (g), (j), (a/b) où la **condition** fait la différence |
| Clauses longues (max 68 phrases) → templates multiples, evidence floue | certaine | précision | scinder à 8 phrases ; `evidence` obligatoire par template |
| Pré-inscription contestée (« les auteurs connaissaient le corpus ») | moyenne | crédibilité | §6.6 écrit noir sur blanc ; empreinte + commit public ; hold-out jamais consulté |
| IC très larges (17 documents) | certaine | interprétation | rapporter les IC, agréger par groupe d'items, ne pas sur-interpréter les items à < 20 labels (A 17, LAW 27, J 28) |
| Comparaison E8 jugée déloyale | moyenne | discussion | trois régimes explicites : sans labels (requêtes), supervision par thème, supervision par texte |
| Textes CLAUDETTE sous droits | faible | publication | publier structures + offsets + identifiants, pas les textes |

---

## 8. Décisions à prendre maintenant

1. **Périmètre des thèmes validés à la main pour H0** : les 5 forts (LTD, TER, MOD, ARB, LAW = 242 clauses) — recommandé — ou les 10 cibles (533 clauses, ~9 h de validation).
2. **Source des templates** : pipeline LLM externe (lequel ? le juge le plus proche des humains, *fable* ou *claude*, κ 0,59) ou **rédaction manuelle** par les juristes sur les 242 clauses (plus lent de ~2 h, mais élimine la circularité LLM et fournit directement la ressource « validée »).
3. **Legal-BERT-abusivité aujourd'hui ?** Un job G5K de 1–2 h après une modification du runner (cible `unfair`) ; sinon TF-IDF + LexGLUE en référence, Legal-BERT au camera-ready. Recommandation : lancer le job si le runner est prêt avant T+6, ne pas en dépendre.
4. **Règle de projection** clause → phrase (§6.4) : evidence-only (recommandé) vs clause entière.
5. **Formulation de la pré-inscription** : accepter d'écrire §6.6 tel quel dans le papier.
6. **Titre des colonnes du tableau 3** : par requête ET par item, avec « n labels de référence » pour que le lecteur voie les petits effectifs.

---

## 9. Annexes de dimensionnement (calculs du 14 septembre, export `7116e627…`)

**Clauses par thème (50 documents, consensus)** — segments / dont abusifs : LICENSE_IP 318/35 ·
LIMITATION_LIABILITY 241/**124** · USER_CONTENT 238/51 · ACCEPTABLE_USE 226/38 · FEES_PAYMENT 206/52 ·
ELIGIBILITY_ACCOUNT 205/29 · PREAMBLE_SCOPE 172/54 · THIRD_PARTY_SERVICES 171/25 · MISC_BOILERPLATE 160/4 ·
WARRANTY_DISCLAIMER 154/21 · TERMINATION 145/**103** · MODIFICATION_OF_TERMS 128/**108** ·
ARBITRATION_DISPUTES 97/54 · PRIVACY_DATA 94/10 · META 92/0 · GOVERNING_LAW 68/**53** · COMMUNICATIONS 54/1 ·
FEEDBACK 27/0 · DMCA 9/3 · PROMOTIONS 4/0.

**Hold-out (17 documents)** : 888 clauses, 4 078 phrases ; 533 clauses des 10 thèmes cibles (2 388
phrases, 219 abusives) : USER_CONTENT 92 · FEES_PAYMENT 86 · LIMITATION_LIABILITY 76 · THIRD_PARTY 68 ·
TERMINATION 55 · MODIFICATION 53 · WARRANTY 52 · PREAMBLE 48 · ARBITRATION 32 · GOVERNING_LAW 26.
Labels CLAUDETTE : 490 (LTD 132, TER 102, CH 88, CR 52, USE 44, J 28, LAW 27, A 17).

**Conception (33 documents)** : 1 562 clauses ; 930 clauses cibles (3 215 phrases, 356 abusives).

**Mapping items ↔ catégories ↔ thèmes** : tableau 1 du placeholder (`jurix2026-long-paper/main.tex (sections dans jurix2026-long-paper/sections/)`),
à faire relire par les juristes avant le gel.

**Documents de validation** : Headspace, LindenLab, LinkedIn, Nintendo, Oculus, PokemonGo, Skype, Spotify,
Tinder, TripAdvisor, Twitter, WhatsApp, WorldOfWarcraft, Yahoo, Zynga, eBay, musically.
