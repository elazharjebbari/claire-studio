# Cadre scientifique & propositions d'articles JURIX 2026

> **Ce document fait deux choses.** La **Partie A** pose le contexte de recherche et l'inscrit dans
> le cadre des *Terms of Service* (ToS) et de la base reconnue CLAUDETTE/UNFAIR-ToS. La **Partie B**
> présente le long tableau des idées d'articles, scorées pour JURIX. La recommandation finale
> comparative est dans [`02_RECOMMANDATION_FINALE.md`](02_RECOMMANDATION_FINALE.md).

---

# Partie A — Le cadre de recherche

## A.1 Résumé exécutif

La thèse (« Analyse automatique de documents juridiques contractuels », LORIA) vise à **détecter et
expliquer des anomalies dans des contrats**, à plusieurs granularités (structurelle, logique,
sémantique). Après un premier fil sur des **contrats français** (base *Gold* propriétaire + accords
d'entreprise *ACCO*), un **double pivot** a été décidé : (i) vers des **jeux de données publics,
licenciés et reproductibles**, et (ii) vers une **validation assistée par LLM**, calibrée par un
**gold humain**. C'est précisément à cet endroit que s'insère la plateforme **Pactiva**.

Le point d'ancrage est la base **CLAUDETTE / UNFAIR-ToS** (Lippi et al., 2019), corpus de référence
de la communauté *IA & Droit* pour la détection de clauses abusives dans les conditions
d'utilisation. Cette base a une **limite reconnue par ses propres auteurs** : elle annote la
**phrase**, pas la **clause**, avec des labels binaires d'(in)équité, sans structure, sans thème,
sans certitude, sans justification. Trois campagnes d'annotation **entièrement pilotées par des LLM**
(protocoles V8, V9.2, V9.4) ont chacune franchi leur seuil en calibration puis **échoué au passage à
l'échelle** — le « **mur du κ** ». Ce résultat négatif, robuste et reproductible, établit le besoin
scientifique : **un gold humain de référence, produit par des experts assistés — non remplacés — par
les LLM.**

Pactiva est l'instrument qui produit ce gold. Il **enrichit** CLAUDETTE : passage de la phrase à la
**clause** (frontières), **taxonomie thématique** (≈20 thèmes lisibles) + **nature juridique** +
**certitude** (0–3) + **justification** + **span d'évidence**, le tout produit par une **collaboration
LLM ↔ annotateurs humains experts** (les LLM pré-annotent et routent, l'humain valide et décide, un
**module GOLD** résout les conflits inter-annotateurs — les LLM y sont **référence, jamais partie au
conflit**), avec traçabilité, versioning, accord inter-annotateurs (κ de Cohen, α de Krippendorff/MASI,
F1 de frontières, concordance humain–LLM) et **volet multilingue français** (les 50 documents
traduits phrase à phrase).

Cette configuration coche exactement les cases que la communauté JURIX valorise en 2026 : **base
reconnue + protocole d'annotation rigoureux (κ) + human-in-the-loop + LLM sous évaluation critique +
explicabilité (rationales) + multilinguisme**. Elle offre au moins trois contributions publiables
distinctes (un résultat négatif méthodologique, une ressource enrichie, un protocole d'arbitrage),
détaillées en Partie B.

## A.2 L'objet : les *Terms of Service* comme terrain juridique **et** computationnel

Les **conditions générales d'utilisation** (ToS) sont des contrats d'adhésion : l'utilisateur
« accepte » sans négocier. Le droit européen encadre leurs abus via la **directive 93/13/CEE** sur
les clauses abusives dans les contrats conclus avec les consommateurs. Une clause est « abusive » si,
en dépit de l'exigence de bonne foi, elle crée un **déséquilibre significatif** au détriment du
consommateur. Ce cadre juridique fournit une **taxonomie opérationnelle** de familles de clauses à
risque (limitation de responsabilité, résiliation unilatérale, modification unilatérale, retrait de
contenu, arbitrage, juridiction, choix de la loi, contrat par simple usage…).

Le ToS est donc un objet doublement intéressant :

- **Juridiquement** : la détection d'abusivité est une tâche de protection du consommateur, à fort
  enjeu sociétal et parfaitement dans le périmètre *IA & Droit*.
- **Computationnellement** : un ToS est un document semi-structuré (sections, clauses numérotées,
  listes), long, répétitif d'un service à l'autre, ce qui en fait un banc d'essai idéal pour la
  segmentation, la classification multi-label et la détection d'anomalies.

## A.3 La base reconnue : CLAUDETTE / UNFAIR-ToS

**CLAUDETTE** (Lippi, Pałka, Contissa, Lagioia, Micklitz, Sartor & Torroni — présenté à *JURIX 2017*,
étendu dans *Artificial Intelligence and Law* 27:117–139, 2019) est le corpus fondateur : **50 ToS**
de grandes plateformes, annotés par des juristes selon **8 catégories** de clauses potentiellement
abusives et **3 niveaux de sévérité** (1 = clairement équitable, 2 = potentiellement abusive, 3 =
clairement abusive).

| Code | Catégorie (dir. 93/13/CEE) | # phrases positives* | Couverture ToS | Sévérité moy. |
|---|---|---|---|---|
| LTD | Limitation of liability | 236–296 | 98 % | — |
| TER | Unilateral termination | 196–236 | 96 % | 2,44 |
| CH | Unilateral change | 149–188 | 98 % | — |
| CR | Content removal | 101–118 | 90 % | 2,40 |
| USE | Contract by using | 111–117 | 94 % | — |
| LAW | Choice of law | 70 | 98 % | 1,94 |
| J | Jurisdiction | 57–68 | 82 % | **2,86** (la + sévère) |
| A | Arbitration | 42–44 | **56 %** | — (marqueur « anti-UE », plateformes US) |

\* *Les comptes varient selon la source (voir infra) ; ordres de grandeur.*

**Trois redistributions publiques, trois fidélités** (résultat d'analyse propre au projet) :

| | **LexGLUE** (Chalkidis 2022) | **Niklaus/Drawzeski 2021** (HF) | **CLAUDETTE XML** (Lippi 2019, orig.) |
|---|---|---|---|
| Volume (EN) | 9 414 phrases | 25 929 phrases (4 langues) | 5 785 paragraphes |
| Documents distincts | **0 (perdus)** | 25 | **50** |
| Ordre des phrases | perdu | `line_number` | position fichier |
| Sévérité 1/2/3 | **absente (binarisée)** | agrégée (1 niveau) | **3 niveaux** |
| Sections natives | absentes | absentes | `* N. Title` |

**Conséquence méthodologique :** seule l'archive XML originale préserve l'identité document, l'ordre,
la sévérité par catégorie et les sections. Le benchmark LexGLUE, le plus utilisé, est aussi le plus
**appauvri** (structure détruite). C'est un point de reproductibilité important pour tout article.

**La lignée JURIX/ICAIL native.** CLAUDETTE est le cœur d'une lignée portée par le groupe de
Bologne/EUI, qu'un article JURIX **doit** citer et dont il doit se différencier :

- Lagioia, Ruggeri, Drazewski, Lippi, Micklitz, Torroni, Sartor — *Deep Learning for Detecting and
  Explaining Unfairness in Consumer Contracts*, **JURIX 2019**.
- Ruggeri, Lagioia, Lippi, Torroni — *Detecting and explaining unfairness in consumer contracts
  through memory networks*, ***AI and Law* 30(1):59–92, 2022** (architecture à **mémoire de
  rationales** — proche de la logique « rationale/thème » de Pactiva).
- Galassi et al. — *Unfair clause detection in ToS across multiple languages*, ***AI and Law*, 2024**
  (**extension multilingue** — résonne avec le volet FR de Pactiva).
- Grundler, Liepina, Musicco, Lagioia, Galassi, Sartor, Torroni — *Detecting Vague Clauses in Privacy
  Policies: BERT Models and LLMs*, **JURIX 2024**.
- *Is It Worth Using LLMs for Unfair Clause Detection in Terms of Service?*, **ICAIL 2025**.

## A.4 Le verrou scientifique : le « mur du κ »

La limite de CLAUDETTE, reconnue par ses auteurs (« *the system handles a pure sentence classification
task, not directly single clauses* »), est le grain **phrase**. Or la mécanique contractuelle se joue
à la **clause** (le pouvoir de modification, la résiliation, la limitation de responsabilité sont des
clauses, souvent pluri-phrastiques). Le projet a donc tenté de **re-granulariser** CLAUDETTE en
clauses puis de l'annoter thématiquement — **d'abord entièrement par LLM**.

Trois protocoles successifs, deux juges LLM constants (**Claude Opus** + **Codex/GPT**, plus **Gemini**
en comité), métrique = **κ de Cohen** (Landis & Koch : ≥0,80 visé). Le récit est celui d'une
**calibration trompeuse** :

| Paradigme | Calibration (petit banc) | **Passage à l'échelle (50 docs)** | Chute |
|---|---|---|---|
| **Structurel V8.1** | κ = **0,86** (3 docs) | **κ global = 0,32** | −54 pts |
| **Thématique V9.2** | κ = 0,75–0,80 (5 docs) | **κ thème = 0,45** (45 autres docs = 0,41) | banc non représentatif |
| **Clause V9.4** | pilote aveugle 10 docs = **0,80** | **κ thème = 0,32** (40 docs restants = 0,14) | plafond 0,78 **réfuté** |

**Diagnostic (le résultat scientifique central).** Trois effondrements indépendants disent la même
chose :

1. **Calibration ≠ validité.** Un banc de 3–10 documents, même aveugle et difficile, peut être un
   **faux positif** ; seul le corpus complet fait foi.
2. **Biais de granularité inter-modèle**, structurel et persistant à travers 4 versions et 2
   paradigmes : **Codex fragmente systématiquement plus que Claude** (×1,96 à ×5,1 selon le schéma ;
   ex. Codex verse 24,9 % des phrases dans la catégorie-refuge `PREAMBLE_SCOPE` vs 4,9 % pour Claude).
   Ce biais « pollue tout κ » et doit être traité explicitement, jamais ignoré.
3. **Anatomie du désaccord** (κ thème 0,45 décomposé) : κ frontières = 0,39 **et** κ étiquetage = 0,45
   sont faibles *indépendamment* ; les lignes de faille sont **refuge 41 % + segmentation 31 % +
   ambiguïté réelle 18 %** → **≈72 % d'artefacts de méthode corrigeables** mais **≈18 % d'ambiguïté
   juridique authentique, incompressible**, qui **exige un jugement humain expert**.
4. **L'auto-correction LLM-only est instable** : ajouter une règle pour « sauver » un document en
   casse un autre (V8.2 : YouTube −0,28 pendant que Crowdtangle +0,15, bilan net négatif). Un système
   de règles LLM ne se calibre pas sans **référent externe humain**.

> **Conclusion :** un protocole *LLM-only* a besoin d'un **référent humain (gold)**, et une décision
> ne doit **jamais** être prise sur un sous-banc. C'est la justification empirique directe de Pactiva.

## A.5 La réponse : enrichir CLAUDETTE par annotation thématique en collaboration LLM ↔ humain

Ce que la présentation « CLAUDETTE : des phrases aux clauses » conceptualise, et que Pactiva
implémente, est un **changement d'unité et un enrichissement** :

**Du token à la clause.** Une analyse propre au projet a établi un **contrat de données à 3 niveaux** :
Document (50) → **Bloc-clause (933, cible de modélisation)** → Phrase (5 785), reliés par clés
étrangères. La segmentation « stratégie B » (4 règles observables) atteint une cohérence d'annotation
de **0,91** et une homogénéité sémantique meilleure que les sections natives — la clause est le bon
grain.

**L'enrichissement produit par Pactiva**, par clause :

| Dimension | CLAUDETTE original | **Pactiva (enrichi)** |
|---|---|---|
| Unité | phrase | **clause** (frontières, multi-phrases) |
| Étiquette | 8 familles d'abusivité (binaire) | **≈20 thèmes juridiques lisibles** + conservation des labels d'abusivité natifs (`ReferenceLabel`) |
| Nature | — | **6 natures juridiques** (obligation, interdiction, permission, définition, déclaration, procédure) |
| Confiance | — | **certitude 0–3** par clause et globale |
| Explication | — | **rationale** + **span d'évidence** |
| Provenance | 1 (juriste) | **traçée** : humain / graine LLM (`claude`/`codex`/`mistral`) jamais confondus |
| Qualité | — | **κ, α, F1, concordance, versioning immuable** |
| Langue | EN | **EN + FR** (50 docs traduits phrase à phrase) |

**La collaboration LLM ↔ humain, matérialisée.** Trois fonctions : **Lecture** (le contrat phrase à
phrase) → **Pré-annotation** (frontières et thèmes **proposés par les modèles**, plusieurs modèles en
parallèle) → **Validation** (l'humain corrige les frontières, choisit le thème, signale les cas
ambigus). Le modèle est un **accélérateur ; la décision juridique reste humaine.** En aval, le
**module GOLD** arbitre les désaccords **inter-annotateurs** (verrou exclusif, majorité, décision
tracée, gold figé immuable) — avec un invariant fort : **les LLM sont référence, jamais partie au
conflit** (ils ne changent jamais le résultat d'un arbitrage entre humains).

**Ce que la plateforme mesure** (catalogue de métriques versionnées, avec supports minimaux et
garde-fous éthiques — pas de classement nominatif, pas de score opaque d'annotateur) : couverture,
distribution de certitude, taux multi-label, **κ de Cohen** par paire, **α de Krippendorff (distance
MASI)**, **F1 de frontières** (avec tolérance), **F1 de thème** macro/micro, **taux d'adoption des
suggestions LLM**, **entropie des votes**, **proximité au gold**. C'est l'infrastructure empirique
d'un article JURIX crédible.

## A.6 Positionnement JURIX (ce qui rend cet objet « publiable »)

- **Track cible** : II (NLP & ML pour le droit — *datasets for AI & Law*, déploiement de LLM) et/ou
  III (systèmes socio-techniques — XAI, équité, human-in-the-loop).
- **Critères éliminatoires satisfaits** : ancrage juridique (protection consommateur, dir. 93/13) ;
  dialogue avec la lignée CLAUDETTE (JURIX/ICAIL/*AI & Law*) ; rigueur empirique possible (baselines,
  κ, analyse d'erreurs) ; reproductibilité (corpus public, plateforme ouverte, prompts).
- **Tendances 2025–2026 exploitées** : LLM sous évaluation **critique** (dissocier exactitude et
  validité) ; **LLM-as-annotator / human-in-the-loop** (le LLM ne doit pas être l'unique source de
  labels) ; limites méthodologiques du **LLM-as-judge** (α trompeur sur classes déséquilibrées → Gwet
  AC2, corrélations de rang) ; **hallucination** juridique ; **multilinguisme**.
- **Format** : single-blind (non anonymisé) — **favorable**, Pactiva est public (pactiva.legal). Long
  ≤10 p. (≈19–23 % d'acceptation, exige une évaluation complète) ; short ≤5 p. ; poster ≤2 p.
- **Deux pièges à éviter** : (a) présenter Pactiva comme un **produit** sans contribution scientifique
  évaluée → poster au mieux ; (b) mettre le LLM en position de **juge** sans validation de l'accord.

---

# Partie B — Le long tableau des propositions d'articles

## B.1 Grille de scoring

Chaque proposition est notée sur **6 dimensions**, chacune de **0 à 5**, pour un **total sur 30**. Les
dimensions marquées ⚑ sont **quasi-éliminatoires** à JURIX.

| Dim. | Signification |
|---|---|
| **AJ** ⚑ | **Ancrage juridique & fit JURIX** — éclaire une vraie question de droit, dialogue avec la lignée IA & Droit |
| **NV** | **Nouveauté / valeur ajoutée** — delta net vs CLAUDETTE / Ruggeri / Galassi |
| **RI** ⚑ | **Rigueur empirique atteignable** — baselines, métriques, **analyse d'erreurs**, κ |
| **FA** | **Faisabilité d'ici sept. 2026** — données déjà disponibles vs à produire |
| **RC** | **Réception communauté** — probabilité que les reviewers JURIX adhèrent |
| **IM** | **Impact / différenciation** — portée, mémorabilité, réutilisabilité |

**Lecture du total :** **≥ 25/30 → viser *long paper*** · **19–24 → *short* solide (ou *long* si les
données mûrissent)** · **< 19 → *poster* / à retravailler / autre venue.**

## B.2 Les propositions

> 12 propositions, regroupées en 4 familles. Le détail « idée / intérêt / forces / faiblesses /
> faisabilité / réception / fit JURIX » est en B.3 ; les scores sont consolidés en B.4.

**Famille 1 — Évaluation critique de l'annotation LLM (le « mur du κ »)**
- **P1 — « Calibration ≠ Validité »** : le mur du κ (3 effondrements calibration→échelle).
- **P2 — Biais de granularité inter-modèle** dans les comités de juges LLM.
- **P3 — Anatomie du désaccord** : décomposer κ pour localiser l'ambiguïté juridique irréductible.
- **P4 — « Annoter le rôle, pas la position »** : taxonomie fonctionnelle + arbre tracé (κ ×22).

**Famille 2 — Ressource & protocole (l'enrichissement Pactiva)**
- **P5 — CLAUDETTE++** : ressource enrichie clause-level (thèmes + nature + certitude + rationale),
  produite en collaboration LLM ↔ humain, avec κ et gold. *(angle central visé par le porteur)*
- **P6 — Protocole GOLD human-in-the-loop** : résolution de conflits inter-annotateurs, LLM en
  **référence non-décisionnaire**.
- **P7 — Transfert de taxonomie cross-lingue FR↔EN** de l'abusivité (volet multilingue).

**Famille 3 — Analyses empiriques sur UNFAIR-ToS**
- **P8 — « Les catégories d'injustice sont-elles des régions sémantiques ? »** (validation externe,
  2 familles, calibration par famille).
- **P9 — « Les phrases abusives sont les phrases-noyaux »** (résultat géométrique contre-intuitif).
- **P10 — « Mesurer l'abusivité sans le ratio »** : sévérité absolue vs effet de dilution.

**Famille 4 — Segmentation & reproductibilité**
- **P11 — Segmentation de clauses ToS** : heuristique vs supervisé léger vs séquentiel (plafond F1).
- **P12 — Récupérer l'oracle structurel perdu** : pipeline Wayback & perte typographique des
  benchmarks aplatis.

## B.3 Détail par proposition

### P1 — « Calibration n'est pas validité » : le mur du κ de l'annotation LLM de clauses ToS
- **Idée.** Démontrer, sur les 50 ToS de CLAUDETTE, que **trois protocoles d'annotation entièrement
  LLM** (structurel, thématique, clause) franchissent leur seuil en calibration (κ 0,80–0,86) puis
  **s'effondrent à l'échelle** (κ 0,32–0,45). Thèse : en annotation juridique par LLM, **la
  calibration sur un petit banc ne prédit pas la validité**.
- **Intérêt / valeur ajoutée.** Résultat **négatif rigoureux et généralisable** — rare et
  précieux ; anti-hype, exactement le registre 2025–2026. Fournit un **garde-fou méthodologique**
  réutilisable (banc aveugle stratifié, décision sur corpus complet).
- **Forces.** Données **entièrement disponibles** (expériences faites) ; récit clair ; chiffres
  spectaculaires ; s'ancre dans la lignée CLAUDETTE ; parle aux débats LLM-as-judge/annotator.
- **Faiblesses / risques.** Un résultat négatif doit être **impeccablement contrôlé** (sinon « vous
  avez mal fait le prompt ») → nécessite ablations + analyse d'erreurs soignées ; risque « pas assez
  de contribution *positive* » → répondre en pointant vers le gold humain.
- **Faisabilité (sept. 2026).** **Très haute** — analyses déjà produites, à mettre en forme.
- **Réception communauté.** **Très bonne** : la communauté aime les mises en garde méthodologiques
  fondées ; surfe sur l'évaluation critique des LLM.
- **Fit JURIX.** Track II ; **long paper** naturel.

### P2 — Biais de granularité inter-modèle dans les comités de juges LLM
- **Idée.** Montrer qu'un comportement **stable et mesurable** — Codex « fragmentariste » vs Claude
  « globaliste » — persiste à travers **4 versions de protocole et 2 paradigmes** (×1,96 à ×5,1), et
  qu'il **biaise structurellement tout accord** dans un comité de juges LLM. Proposer une
  **normalisation**.
- **Intérêt.** Phénomène **généralisable au LLM-as-judge** bien au-delà du juridique ; contribution
  méthodologique nette.
- **Forces.** Données disponibles ; invariant frappant ; utile à quiconque agrège des juges LLM.
- **Faiblesses.** 2 modèles seulement → généralisation à étayer (ajouter Gemini/Mistral renforcerait) ;
  ancrage juridique **plus faible** (risque « trop ML »).
- **Faisabilité.** **Haute** (rejouer avec un 3ᵉ/4ᵉ modèle serait un plus).
- **Réception.** Bonne, surtout si cadré « pourquoi les panels de juges LLM sont biaisés ».
- **Fit JURIX.** Track II ; **short** solide, *long* si étendu à ≥3 modèles.

### P3 — Anatomie du désaccord : décomposer κ pour localiser l'ambiguïté juridique irréductible
- **Idée.** Décomposer le κ d'accord (frontières vs étiquetage) et les désaccords en lignes de faille
  (**refuge 41 % / segmentation 31 % / ambiguïté réelle 18 %**) pour séparer **artefacts corrigeables**
  et **ambiguïté juridique incompressible**, et **placer l'humain là où il compte**.
- **Intérêt.** Transforme un κ opaque en **diagnostic actionnable** ; dit *où* le jugement humain est
  irremplaçable — pile le débat human-in-the-loop.
- **Forces.** Données disponibles ; méthodologie transférable à toute tâche d'annotation.
- **Faiblesses.** Peut sembler « second » sans le récit du mur (P1) → **excellent comme partie d'un
  long P1**, un peu mince seul.
- **Faisabilité.** **Haute.**
- **Réception.** Bonne ; l'idée « 18 % d'ambiguïté irréductible » est mémorable.
- **Fit JURIX.** Track II/III ; **short**, ou **section d'un long P1**.

### P4 — « Annoter le rôle, pas la position » : taxonomie fonctionnelle + arbre de décision tracé
- **Idée.** Découverte méthodologique : reformuler la segmentation comme **classification de rôles
  fonctionnels** (7 rôles) dérivant la structure de façon déterministe, via un **arbre de décision
  tracé (Q1→Q6)** que le juge exécute et **justifie nœud par nœud** — fait passer κ de 0,03 à **0,68
  (×22)** et rend **chaque désaccord auditable** (localisé sur un nœud).
- **Intérêt.** **Explicabilité/auditabilité** — pilier historique JURIX ; recette réutilisable pour
  concevoir des tâches d'annotation LLM falsifiables.
- **Forces.** Résultat fort (×22) ; auditabilité concrète ; données disponibles.
- **Faiblesses.** Porte surtout sur la **structure** (moins « juridique » que l'abusivité) ; à relier
  au grain clause.
- **Faisabilité.** **Haute.**
- **Réception.** Bonne (XAI + méthodo) ; complète bien P1.
- **Fit JURIX.** Track III (XAI) ; **short**, ou brique d'un long.

### P5 — CLAUDETTE++ : ressource enrichie clause-level en collaboration LLM ↔ experts humains
- **Idée.** Publier une **augmentation de CLAUDETTE/UNFAIR-ToS** : re-granularisation en clauses +
  **taxonomie de ≈20 thèmes** + **nature juridique** + **certitude** + **rationale** + span
  d'évidence, produite par des **experts humains assistés de plusieurs LLM**, avec **protocole,
  accord inter-annotateur (κ), résolution GOLD** et **volet FR**. Livrable : dataset + *data
  statement* + protocole.
- **Intérêt.** **La contribution « ressource » que JURIX reconnaît explicitement** (*datasets for AI
  & Law*). C'est l'angle **central** visé par le porteur ; réutilisable par toute la communauté.
- **Forces.** Ancrage juridique maximal ; comble une limite *reconnue* de CLAUDETTE ; multilingue ;
  s'appuie sur une plateforme réelle et un module de qualité.
- **Faiblesses / risques.** **Dépend de la maturité du gold** : il faut un sous-corpus **réellement
  multi-annoté et arbitré** d'ici septembre (au moins un échantillon représentatif) pour rapporter
  un κ crédible ; sinon la contribution paraît « annoncée, pas mesurée ».
- **Faisabilité.** **Moyenne** — plateforme + campagne + traductions prêtes, **mais l'annotation
  humaine multi-annotateur doit être suffisamment avancée** (jalon critique, voir recommandation).
- **Réception.** **Très bonne** si le κ et l'analyse d'erreurs sont là ; c'est le type de papier que
  la communauté cite et réutilise.
- **Fit JURIX.** Track II ; **long paper** (ou *resource* short si l'échantillon est petit).

### P6 — Protocole GOLD human-in-the-loop : LLM en référence, jamais juge
- **Idée.** Formaliser et évaluer le **protocole de résolution des conflits inter-annotateurs** de
  Pactiva : verrou exclusif, majorité, décision tracée, **gold figé immuable**, et l'**invariant** que
  les LLM sont **référence, jamais partie au conflit**. Positionnement direct contre le « LLM-as-judge
  décisionnaire ».
- **Intérêt.** Répond frontalement à la tendance « human-in-the-loop, LLM pas source unique de
  labels » ; propose une **architecture de gouvernance** de la qualité.
- **Forces.** Ancrage fort ; le module existe et tourne ; angle « éthique/gouvernance » apprécié.
- **Faiblesses.** Besoin de **données de conflits réels** pour être empirique (sinon « design paper »
  → poster) ; recouvre partiellement P5.
- **Faisabilité.** **Moyenne** (dépend de conflits arbitrés réels).
- **Réception.** Bonne, surtout en track III ; peut sembler « ingénierie » sans évaluation.
- **Fit JURIX.** Track III ; **short/long** selon données ; **fort candidat *demo/poster*** en repli.

### P7 — Transfert de taxonomie cross-lingue FR↔EN de l'abusivité
- **Idée.** Exploiter les **50 ToS traduits en FR** (phrase à phrase, alignement 1:1 vérifié) pour
  étudier la **transférabilité** de la taxonomie d'abusivité/thèmes entre langues ; comparer
  annotation EN vs FR, détection cross-lingue, dérive.
- **Intérêt.** Le **multilinguisme est explicitement valorisé** à JURIX (cf. Galassi 2024) ; le FR est
  un différenciateur.
- **Forces.** Traductions **déjà faites** (9 414 lignes) ; s'inscrit dans une lignée active.
- **Faiblesses.** Doit **construire les expériences** de transfert ; risque de doublonner Galassi 2024
  s'il ne dit rien de neuf → différencier par le **grain clause + certitude**.
- **Faisabilité.** **Moyenne** (données prêtes, expériences à mener).
- **Réception.** Bonne (multilingue + lignée) ; delta vs Galassi à soigner.
- **Fit JURIX.** Track II ; **short**, *long* si l'étude est complète.

### P8 — Les catégories d'injustice CLAUDETTE sont-elles des régions sémantiques ?
- **Idée.** Validation **externe** de la taxonomie de Lippi 2019 par un encodeur neutre : corrélation
  **ρ(cohérence, homogénéité) = −0,53** et **deux familles** — **procédurale séparable** {J, LAW, A}
  vs **opérationnelle enchevêtrée** {LTD, TER, CH, CR, USE}. Implication : **calibrer les détecteurs
  par famille**, pas par seuil global.
- **Intérêt.** Éclaire *pourquoi* certaines catégories sont dures à détecter — utile aux concepteurs
  de détecteurs.
- **Forces.** Résultat empirique propre, chiffré, reproductible ; données disponibles.
- **Faiblesses.** Perçu comme **plus « ML » que « droit »** → doit être **fortement cadré** juridique ;
  à confirmer avec un encodeur juridique (LegalBERT).
- **Faisabilité.** **Haute** (analyse faite ; robustesse LegalBERT à ajouter).
- **Réception.** Moyenne-bonne selon le cadrage juridique.
- **Fit JURIX.** Track II ; **short**.

### P9 — « Les phrases abusives sont les phrases-noyaux »
- **Idée.** Résultat **contre-intuitif** : les phrases marquées abusives sont **plus proches du
  centroïde** de leur catégorie que les phrases équitables (d_unfair − d_fair = −0,044, p=2×10⁻⁴) →
  ce sont les **phrases-noyaux**, ce qui **réhabilite l'annotation-phrase** de Lippi.
- **Intérêt.** Curiosité mémorable ; discute ce que « le noyau juridique » d'une clause signifie
  géométriquement.
- **Forces.** Original ; données disponibles.
- **Faiblesses.** **Mince** pour un long ; risque « joli mais so what ? » ; dépend d'un encodeur.
- **Faisabilité.** **Haute.**
- **Réception.** Moyenne (intriguant, mais faible portée).
- **Fit JURIX.** **Short/poster** ; bon **complément** d'un autre papier.

### P10 — Mesurer l'abusivité sans le ratio : sévérité absolue vs effet de dilution
- **Idée.** Critique métrologique : la corrélation **taille du ToS ↔ taux d'injustice = −0,53** (les
  longs ToS *diluent* les clauses problématiques) invalide le **ratio** comme mesure ; proposer une
  métrique **fréquence × sévérité en absolu** + profilage plateforme (ex. Arbitrage = marqueur US /
  anti-UE).
- **Intérêt.** Enjeu **protection consommateur** concret ; corrige une mauvaise pratique de mesure.
- **Forces.** Juridiquement pertinent ; simple, clair, reproductible.
- **Faiblesses.** Portée limitée ; risque « point mineur ».
- **Faisabilité.** **Haute.**
- **Réception.** Bonne en track III (équité) si bien narré.
- **Fit JURIX.** **Short/poster.**

### P11 — Segmentation de clauses ToS : heuristique vs supervisé léger vs séquentiel
- **Idée.** Étude comparative de la segmentation en clauses (règles RegEx « stratégie B » vs Random
  Forest vs modèles séquentiels), diagnostic du **plafond F1 ≈ 0,74**, question plafond intrinsèque vs
  contingent, recommandation **hybride** (règles proposent, classifieur valide).
- **Intérêt.** Brique technique utile ; ancrable sur CUAD/LEDGAR.
- **Forces.** Données/expériences en partie faites ; reproductible.
- **Faiblesses.** **Risque fort « pur NLP sans insight juridique »** → mal reçu si non recadré ;
  incrémental.
- **Faisabilité.** **Haute.**
- **Réception.** **Faible-moyenne** à JURIX sans forte couche juridique.
- **Fit JURIX.** **Short** au mieux ; **plutôt un workshop NLLP/CEUR**.

### P12 — Récupérer l'oracle structurel perdu : pipeline Wayback & perte typographique des benchmarks
- **Idée.** Méthode de récupération des **HTML originels** (Internet Archive) pour reconstruire un
  oracle de structure, quantifiant la **perte typographique** des benchmarks aplatis (**F1 0,80 →
  0,23** quand on passe du HTML riche au format CLAUDETTE aplati). Message générique : *les benchmarks
  Legal NLP détruisent la structure dont dépend la segmentation.*
- **Intérêt.** **Reproductibilité / qualité des données** — sujet apprécié ; alerte utile à la
  communauté.
- **Forces.** Résultat net ; pipeline réutilisable.
- **Faiblesses.** Couvre **17/50 docs** (34 %) ; niche ; ancrage juridique indirect.
- **Faisabilité.** **Haute** (fait).
- **Réception.** Moyenne (méthodo/data, apprécié mais spécialisé).
- **Fit JURIX.** **Short/poster.**

## B.4 Tableau de scoring consolidé

| # | Proposition (abrégé) | AJ⚑ | NV | RI⚑ | FA | RC | IM | **Total /30** | Format visé |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **P1** | Calibration ≠ validité (mur du κ) | 4 | 5 | 5 | 5 | 5 | 5 | **29** | **Long** |
| **P5** | CLAUDETTE++ (ressource enrichie) | 5 | 4 | 4 | 3 | 5 | 5 | **26** | **Long** (si gold mûr) |
| **P4** | Annoter le rôle, pas la position (κ ×22) | 4 | 4 | 4 | 5 | 4 | 4 | **25** | Short / brique de long |
| **P2** | Biais de granularité inter-modèle | 3 | 5 | 4 | 5 | 4 | 4 | **25** | Short (Long si ≥3 modèles) |
| **P3** | Anatomie du désaccord (18 % irréductible) | 4 | 4 | 4 | 5 | 4 | 4 | **25** | Short / brique de long |
| **P6** | Protocole GOLD human-in-the-loop | 5 | 4 | 3 | 3 | 5 | 4 | **24** | Short/Long (ou poster) |
| **P7** | Transfert taxonomie FR↔EN | 4 | 4 | 3 | 3 | 4 | 4 | **22** | Short (Long si complet) |
| **P8** | Catégories = régions sémantiques ? | 3 | 3 | 4 | 5 | 3 | 3 | **21** | Short |
| **P10** | Mesurer l'abusivité sans le ratio | 4 | 3 | 3 | 5 | 3 | 3 | **21** | Short/poster |
| **P9** | Phrases abusives = phrases-noyaux | 3 | 4 | 3 | 5 | 3 | 3 | **21** | Short/poster |
| **P12** | Oracle Wayback / perte typographique | 2 | 3 | 4 | 4 | 3 | 3 | **19** | Short/poster |
| **P11** | Segmentation clauses (heur./sup./séq.) | 2 | 2 | 4 | 4 | 2 | 2 | **16** | Workshop NLLP |

**Légende :** AJ = ancrage juridique/fit · NV = nouveauté · RI = rigueur empirique · FA = faisabilité
sept. 2026 · RC = réception communauté · IM = impact/différenciation. ⚑ = quasi-éliminatoire.

**Lecture rapide.** Le peloton de tête (P1, P5, P4, P2, P3) partage un socle **déjà expérimenté** (sauf
la part « gold mûr » de P5). Le **choix stratégique** — combiner le résultat négatif (P1) et la
réponse constructive (P5/P6), ou jouer la sécurité — est traité dans
[`02_RECOMMANDATION_FINALE.md`](02_RECOMMANDATION_FINALE.md).

---

## Notes de fiabilité

- Les **chiffres κ, ρ, F1** proviennent des présentations et analyses du dossier de thèse
  (`CLAIRE/docs/personnal/`) ; certains varient légèrement selon la source (arrondi / périmètre
  d'échantillon) et sont à **re-vérifier dans les notebooks** avant publication.
- Les **citations JURIX/ICAIL/*AI & Law*** et les **dates/quotas 2026** sont à **revérifier à la
  source** (jurix.nl, irit.fr, DBLP, IOS Press) avant soumission.
- Le compte de thèmes est **≈20** (19 dans la présentation « des phrases aux clauses », 20 dans le
  schéma `vocabulary.yaml` implémenté) — à figer dans le *data statement*.
