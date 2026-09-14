# État de l'art — short paper JURIX 2026 « A Thematic Layer for CLAUDETTE »

> ⚠ **Remplacé le 14 septembre 2026 (02 h) par la version complète** [`draft/jurix2026_short_paper_etat_de_l_art.md`](../../draft/jurix2026_short_paper_etat_de_l_art.md) (52 références, fusion avec la carte de littérature du brouillon, axe segmentation ajouté). Ce fichier est conservé pour traçabilité.

> **Date : 14 septembre 2026.** Recherche menée pour la section *Background and Related Work*
> (≤ 0,5 page) et pour l'ancrage de chaque affirmation de l'abstract. Toute référence listée ici
> a été **vérifiée à la source** (page éditeur, ACL Anthology, arXiv ou PDF) pour le titre, les
> auteurs, le lieu et l'année ; les chiffres cités proviennent des abstracts ou du texte intégral
> quand il était accessible. Les points non vérifiés sont marqués ⚠. Les entrées BibTeX
> correspondantes sont dans [`jurix2026-short-paper/references.bib`](../../jurix2026-short-paper/references.bib)
> (clés indiquées entre crochets).
>
> Point de départ : les revues déjà compilées dans `docs/pactiva-jurix-2026/01` (§A.3–A.4),
> `docs/pactiva-anomalies-graphe/01` (§A.4) et `docs/pactiva-fusion-classes/04` (§1–2), recoupées
> et complétées par ~25 recherches web ciblées (2024–2026 en priorité).

---

## 1. Le terrain : CLAUDETTE et sa lignée

**Le corpus de référence.** CLAUDETTE (Lippi et al., *AI & Law* 27(2):117–139, 2019) [lippi2019claudette]
définit la tâche : 50 ToS, phrases étiquetées selon 8 catégories de clauses potentiellement abusives au
sens de la directive 93/13/CEE [eu1993directive], avec SVM et premiers réseaux. Le même groupe (Bologne/EUI)
l'a étendu : corpus multilingue de 25 documents × 4 langues (Drawzeski et al., NLLP 2021)
[drawzeski2021corpus] ; réseaux à mémoire avec *rationales* (Ruggeri et al., *AI & Law* 30(1):59–92, 2022)
[ruggeri2022memory] ; détection multilingue (Galassi et al., *AI & Law*, 2024) [galassi2024multilingual] ;
présence continue à JURIX/ICAIL (Lagioia et al., JURIX 2019 [lagioia2019deep] ; Grundler et al., JURIX 2024,
*honorable mention*, sur les politiques de confidentialité [grundler2024vague]). UNFAIR-ToS est aussi une
des sept tâches de **LexGLUE** (Chalkidis et al., ACL 2022) [chalkidis2022lexglue] — 9 414 phrases, sans
identité de document ni sévérité —, où Legal-BERT atteint μ-F1 96,0 / m-F1 83,0.

**La vague LLM sur la même tâche (2024–2026).** *Is It Worth Using LLMs for Unfair Clause Detection in
ToS?* (Panarelli, Galassi, Lagioia, Liepiņa, Lippi, Pałka, Sartor, ICAIL 2025) [panarelli2025worth] pose
frontalement la question ⚠ (abstract non accessible : conclusion à citer prudemment, à partir du titre et
du contexte). *Text to Trust* (Juttu et al., arXiv 2510.22531, 2025) [juttu2025texttotrust] : sur
CLAUDETTE-ToS, le **fine-tuning complet de BERT garde le meilleur équilibre précision/rappel** face à
LoRA/QLoRA (TinyLlama, LLaMA, SaulLM) et au zero-shot GPT-4o/o3-mini. Frasheri et al. (arXiv 2409.00077,
2024) [frasheri2024llm] : sur des questions de politiques de confidentialité, les LLM font « à peine mieux
que le hasard ». Hors CLAUDETTE : **AGB-DE** (Braun & Matthes, ACL 2024) [braun2024agbde], 3 764 clauses de
93 contrats allemands, validité annotée par juristes, **aucune approche au-dessus de F1 0,54** (BERT
fine-tuné en tête ; GPT-3.5 meilleur en rappel seulement).

**Ce que personne ne fournit.** Tous ces travaux étiquettent l'*abusivité* d'une phrase ; **aucun ne dit
de quoi la clause traite** sur le corpus CLAUDETTE. AGB-DE porte bien des *topics* (23), mais chaque
instance n'y a **qu'un seul annotateur** et aucun coefficient d'accord n'est rapporté (76 % d'accord brut
sur un sous-ensemble initial) ; Braun & Matthes 2022 (§2) ne publient pas leur corpus.

> **Positionnement (phrase pour le papier).** *CLAUDETTE and its multilingual and LLM-era extensions all
> label unfairness; none records the subject matter of the clause. We add that layer to the original
> 50 contracts, with full triple annotation.*

## 2. Taxonomies thématiques de clauses et ressources voisines

| Ressource | Unités | Taxonomie | Multi-label | Annotateurs / unité | Accord rapporté | Public |
|---|---|---|---|---|---|---|
| **LEDGAR** (Tuggener et al., LREC 2020) [tuggener2020ledgar] | ~850 k provisions, contrats SEC | ~12 000 intitulés → **100 classes** retenues par fréquence | oui | étiquettes natives (pas d'annotation) | — | oui |
| **CUAD** (Hendrycks et al., NeurIPS D&B 2021) [hendrycks2021cuad] | 510 contrats, 13 k annotations | 41 types de clauses « à risque » | — | experts, revue multiple | — | oui |
| **OPP-115** (Wilson et al., ACL 2016) [wilson2016opp115] | 115 politiques de confidentialité, 23 k pratiques | 10 catégories + attributs | oui | **3** étudiants en droit | **Fleiss κ 0,49–0,91** selon la catégorie | oui |
| Braun & Matthes (ECNLP 2022) [braun2022topics] | > 6 000 clauses, > 170 CGV DE/EN | **23 topics / 37 sous-topics** (experts) | oui | 2 (étudiant + auteurs), arbitrage juriste | **87 % brut** (non corrigé du hasard) | **non** (droit d'auteur) |
| **AGB-DE** (ACL 2024) [braun2024agbde] | 3 764 clauses, 93 contrats DE | 23 topics / 37 sous-topics + validité | oui (30 clauses) | **1** | 76 % brut (sous-ensemble) | oui |
| Aumiller et al. (ICAIL 2021) [aumiller2021segmentation] | ~74 k ToS | segmentation topique (non supervisée) | — | — | — | oui |
| **Cette couche** | 9 414 phrases, 50 ToS CLAUDETTE | 20 thèmes (T20) → 11 (T11), spécification versionnée | oui | **3** annotateurs formés + **4** juges LLM sur les mêmes phrases | **α-MASI 0,658 / 0,725**, α nominal, κ par paire, IC bootstrap | annotations + codebook + protocole |

Deux lectures : (i) la **réduction de taxonomie est un geste établi** de constitution de ressource (LEDGAR :
12 000 → 100 par fréquence ; GoEmotions [demszky2020goemotions] : 27 émotions regroupées par corrélation)
— mais toujours **par fréquence ou par corrélation**, jamais sous une contrainte externe au signal
d'accord ; (ii) la **triple annotation intégrale avec coefficient corrigé du hasard** est rare dans le
domaine contractuel (OPP-115 est le seul précédent comparable, sur des politiques de confidentialité).

## 3. Mesurer l'accord multi-label

- **Cadre.** α de Krippendorff (Krippendorff 2018, 4ᵉ éd.) [krippendorff2018content] ; revue de référence
  Artstein & Poesio (*CL* 34(4), 2008) [artstein2008intercoder] ; seuils 0,667 / 0,80 rappelés par
  Passonneau. Pour des **ensembles d'étiquettes**, la distance **MASI** (Passonneau, LREC 2006)
  [passonneau2006masi] est la pratique standard ; **Marchal et al. (COLING 2022)** [marchal2022multilabel]
  montrent que le multi-label change la probabilité d'accord fortuit et proposent un bootstrap du hasard —
  c'est l'argument théorique que **le coût du multi-label doit être mesuré, pas supposé**.
- **Prévalence extrême.** Gwet AC1 (BJMSP 61(1):29–48, 2008) [gwet2008ac1] comme garde-fou de κ/α sur les
  classes rares (nos DMCA/FEEDBACK : α 0,10–0,13 mais AC1 ≥ 0,98).
- **Facteurs de l'accord.** La méta-analyse de **Bayerl & Paul (*CL* 37(4):699–725, 2011)**
  [bayerl2011metaanalysis] — 96 études, 346 indices — identifie **sept facteurs**, dont le **nombre de
  catégories** (relation négative) et la **formation** des annotateurs ; les auteurs notent que κ a été
  inventé pour neutraliser le nombre de catégories et **laissent ouverte** la question de savoir si l'effet
  subsiste sur des coefficients corrigés du hasard, l'attribuant alors à la difficulté de distinguer des
  catégories voisines. **Notre E2.1 répond exactement à cette question** : sur α (corrigé du hasard),
  20 → 11 classes = +0,067 [0,058 ; 0,077], reproduit sur hold-out.

> **Ce qui est neuf.** Le coût du multi-label est **mesuré sur le même matériau** (α-MASI vs α nominal,
> Δ apparié par document : 0,0735 [0,061 ; 0,087]) et **constant à travers quatre granularités**
> (0,063–0,075, IC chevauchants). À notre connaissance, aucun travail ne sépare ainsi les deux effets
> (multi-label vs granularité) sur un corpus juridique.

## 4. Granularité, consolidation et désaccord en droit

- **Le droit efface le désaccord.** Braun (*AI & Law* 32:839–862, 2024, accepté 2023) [braun2024differ] :
  tous les jeux de données juridiques analysés **suppriment toute trace de désaccord** au lieu de
  l'exploiter. Notre protocole publie les votes, la cascade (accord strict 46,8 % / majorité 48,3 % /
  arbitrage 4,9 %) et les soft labels — réponse directe.
- **Consolidation sous contrainte.** La littérature consolide par fréquence (LEDGAR), par corrélation
  (GoEmotions) ou par confusion. **Le garde-fou des strates d'abusivité** — ne jamais fusionner deux thèmes
  de P(abusif | thème) opposées — est, à notre connaissance ⚠, sans précédent explicite : la contrainte
  vient de la tâche aval (détection d'abusivité, CLAUDETTE) et non du signal d'accord. L'exemple
  T10 vs T11 (LIMITATION_LIABILITY + WARRANTY_DISCLAIMER : −13 % d'AP pour +0,012 d'α) est la preuve
  que la contrainte n'est pas esthétique. ⚠ L'affirmation « purely statistical consolidation
  *systematically* violates » demande un baseline glouton propre (aperçu en session : première fusion
  trans-strate à la 5ᵉ des 9 fusions, dès 16 classes) ou une formulation plus prudente
  (*« a constraint that confusion-driven consolidation violates »*).
- **Catégories juridiques d'abusivité.** Micklitz, Pałka & Panagis (*J. Consumer Policy* 40:367–388, 2017)
  [micklitz2017empire] pour la typologie des clauses abusives dans les services en ligne, à l'origine des
  8 catégories CLAUDETTE (utile pour justifier le lien thème ↔ strate).

## 5. Variation humaine et plafond humain

- **La variation d'étiquetage n'est pas du bruit.** Plank (EMNLP 2022) [plank2022variation] ; revue
  Uma et al. (*JAIR* 72:1385–1470, 2021) [uma2021disagreement]. Nos 4,9 % de phrases nécessitant un
  arbitrage sont une **mesure d'ambiguïté irréductible**, pas un défaut.
- **Estimer un plafond humain comme on évalue un modèle.** Nangia & Bowman (ACL 2019)
  [nangia2019human] : estimation conservatrice de la performance humaine sur GLUE, en soumettant des
  humains à la procédure d'évaluation des modèles. Notre **référence leave-one-annotator-out**
  (exactitude 0,871, κ 0,859) transpose ce principe : un annotateur évalué contre le consensus de ses pairs.

## 6. LLM annotateurs et juges : ce que l'on sait

- **L'enthousiasme initial.** Gilardi, Alizadeh & Kubli (*PNAS* 120(30), 2023) [gilardi2023chatgpt] :
  ChatGPT dépasse les *crowd workers* ; Ziems et al. (*CL* 50(1), 2024) [ziems2024css] : utile mais pas un
  remplaçant. En droit : Savelka & Ashley (*Frontiers in AI* 6, 2023) [savelka2023unreasonable] —
  GPT-4 en zero-shot sur opinions, clauses et dispositions, avec **humain dans la boucle requis** dès que
  la tolérance à l'erreur est faible ; Schepers et al. (*AI & Law*, 2025) [schepers2025price] — GPT-4o
  au niveau humain sur les annotations *basiques* de décisions, en retrait sur les tâches complexes.
- **LLM-as-a-judge : les limites documentées.** Zheng et al. (NeurIPS 2023) [zheng2023judging] ont établi
  le paradigme (accord GPT-4/humains ≈ accord humain/humain sur MT-Bench) ; **Bavaresco et al. (ACL 2025,
  JUDGE-BENCH, 20 jeux, 11 LLM)** [bavaresco2025judges] concluent que les LLM **ne sont pas prêts à
  remplacer systématiquement les juges humains** (forte variance entre jeux) ; Mukherjee et al. (arXiv
  2606.03043, 2026) [mukherjee2026geometry] : **le consensus inter-LLM n'est pas l'alignement humain** —
  les juges s'accordent entre eux autant que les humains mais n'atteignent que 58–66 % de l'accord humain,
  sur un axe « que les humains ne pondèrent pas ». **Notre matrice 7×7 mesure exactement ce phénomène sur
  un vocabulaire juridique fermé** : humain↔humain κ 0,68–0,80, humain↔LLM ≤ 0,59, LLM↔LLM jusqu'à 0,80.
- **Ancrage du pré-remplissage.** Choi et al. (EMNLP 2024) [choi2024llmeffect] : avec suggestions LLM,
  l'accord experts↔LLM passe de 43,9 % à 71,5 % — **biais d'ancrage** mesuré. C'est la menace de validité
  à déclarer pour notre protocole (pré-annotation post-éditée) ; notre divergence de 39–49 % au juge le
  plus proche en est la **borne inférieure** (juge de seed non persisté), et E3.2 montre que le corpus
  n'est pas un décalque.

## 7. Encodeurs juridiques compacts contre LLM

- **Legal-BERT** (Chalkidis et al., Findings EMNLP 2020) [chalkidis2020legalbert] et son rang sur LexGLUE ;
  Jayakumar et al. (NLLP 2023) [jayakumar2023legal] : trois LLM généralistes en zero-shot (ChatGPT-3.5,
  LLaMA-70b, Falcon-180b) restent **jusqu'à 19,2 / 26,8 points de μ-F1 / m-F1 sous** les modèles compacts
  fine-tunés sur des provisions contractuelles (LEDGAR) ; *Text to Trust* [juttu2025texttotrust] et AGB-DE
  [braun2024agbde] confirment sur l'abusivité.
- **Nos chiffres** (E4.4, nuit du 13→14 sept., non encore dans `campaign.json`) : Legal-BERT κ 0,695
  (T20) / 0,720 (T11) contre 0,581 pour le meilleur juge et 0,859 pour le plafond humain — le modèle
  **bat tous les juges** et comble **~40–50 % de l'écart juge→humain**. Formulation recommandée :
  *« closes roughly half the gap between the best LLM judge and the human ceiling »* (plutôt que
  *« approaches »*).

## 8. Synthèse : affirmation ↔ références ↔ nouveauté

| Affirmation de l'abstract | À citer | Ce qui est neuf |
|---|---|---|
| CLAUDETTE ne dit rien du sujet des clauses | lippi2019claudette, chalkidis2022lexglue, galassi2024multilingual, panarelli2025worth, braun2024agbde | première couche thématique triple-annotée sur les 50 ToS |
| Plafond humain, juges « clearly below » | nangia2019human, bavaresco2025judges, mukherjee2026geometry, savelka2023unreasonable | plafond LOAO + matrice 7×7 à vocabulaire constant, même phrases |
| Coût du multi-label, indépendant de la granularité | passonneau2006masi, marchal2022multilabel, bayerl2011metaanalysis, artstein2008intercoder | Δ apparié sur le même matériau, constant sur 4 granularités |
| Consolidation récupère l'équivalent, sous contrainte de strates | tuggener2020ledgar, demszky2020goemotions, braun2024differ, micklitz2017empire | contrainte externe (aval juridique) à la fusion ; hold-out |
| Modèle compact > tous les juges, vers le plafond | chalkidis2020legalbert, jayakumar2023legal, juttu2025texttotrust | comparaison à un plafond humain mesuré, pas à un score absolu |
| Pré-annotation LLM post-éditée (limite) | choi2024llmeffect, plank2022variation, uma2021disagreement | divergence mesurée par annotateur (borne inférieure) |

## 9. Plan proposé pour la section 2 du papier (≈ 0,5 page, ~15 citations)

1. **Unfair-clause detection.** CLAUDETTE [1] → multilingue [2,3] → LexGLUE [4] → vague LLM [5,6] :
   tous étiquettent l'abusivité, aucun le sujet ; AGB-DE [7] porte des topics mais mono-annotateur.
2. **Clause-topic resources.** LEDGAR [8] (réduction par fréquence), Braun & Matthes [9] (23 topics,
   87 % brut, non publié), OPP-115 [10] (seul précédent en triple annotation avec κ).
3. **Multi-label agreement and granularity.** α/MASI [11,12], Marchal [13], Bayerl & Paul [14]
   (question ouverte sur les coefficients corrigés du hasard) ; Braun [15] sur l'effacement du désaccord.
4. **LLMs as annotators/judges.** Savelka & Ashley [16], Bavaresco [17], consensus inter-LLM ≠
   alignement humain [18], ancrage [19] ; encodeurs compacts vs LLM [20,21].

Numérotation indicative (Vancouver = ordre d'apparition) ; total ≈ 21 références, ce qui tient sur la
6ᵉ page hors décompte.

## 10. Références vérifiées (clé BibTeX · source de vérification)

| Clé | Référence | Vérifié via |
|---|---|---|
| lippi2019claudette | Lippi M, Pałka P, Contissa G, Lagioia F, Micklitz HW, Sartor G, Torroni P. CLAUDETTE: an automated detector of potentially unfair clauses in online terms of service. *AI & Law*. 2019;27(2):117–39. doi:10.1007/s10506-019-09243-2 | Springer, dblp |
| drawzeski2021corpus | Drawzeski K, Galassi A, Jabłonowska A, et al. A corpus for multilingual analysis of online terms of service. NLLP 2021. | ACL Anthology 2021.nllp-1.1 |
| ruggeri2022memory | Ruggeri F, Lagioia F, Lippi M, Torroni P. Detecting and explaining unfairness in consumer contracts through memory networks. *AI & Law*. 2022;30(1):59–92. | dossier jurix-2026 ⚠ DOI non vérifié |
| galassi2024multilingual | Galassi A, et al. Unfair clause detection in terms of service across multiple languages. *AI & Law*. 2024. doi:10.1007/s10506-024-09398-7 | Springer, GitHub nlp-unibo |
| lagioia2019deep | Lagioia F, Ruggeri F, Drazewski K, Lippi M, Micklitz HW, Torroni P, Sartor G. Deep learning for detecting and explaining unfairness in consumer contracts. JURIX 2019, FAIA 322, p. 43–52. doi:10.3233/FAIA190305 | dblp, IOS Press |
| grundler2024vague | Grundler G, Liepina R, Musicco M, Lagioia F, Galassi A, Sartor G, Torroni P. Detecting vague clauses in privacy policies: the analysis of data categories using BERT models and LLMs. JURIX 2024, p. 72–83. doi:10.3233/FAIA241235 | IOS Press ebooks, dblp |
| chalkidis2022lexglue | Chalkidis I, Jana A, Hartung D, Bommarito M, Androutsopoulos I, Katz DM, Aletras N. LexGLUE: a benchmark dataset for legal language understanding in English. ACL 2022, p. 4310–30. | ACL Anthology (connu) |
| panarelli2025worth | Panarelli M, Galassi A, Lagioia F, Liepiņa R, Lippi M, Pałka P, Sartor G. Is it worth using LLMs for unfair clause detection in terms of service? ICAIL 2025. doi:10.1145/3769126.3769218 | ACM DL (abstract inaccessible ⚠) |
| juttu2025texttotrust | Juttu NPP, Singireddy S, Gona S, Timilsina S. Text to Trust: evaluating fine-tuning and LoRA trade-offs in language models for unfair terms of service detection. arXiv:2510.22531; 2025. | arXiv |
| frasheri2024llm | Frasheri M, Bakhtiarnia A, Esterle L, Iosifidis A. Are LLM-based methods good enough for detecting unfair terms of service? arXiv:2409.00077; 2024. | arXiv |
| braun2024agbde | Braun D, Matthes F. AGB-DE: a corpus for the automated legal assessment of clauses in German consumer contracts. ACL 2024. | ACL Anthology 2024.acl-long.559, arXiv HTML (chiffres) |
| braun2022topics | Braun D, Matthes F. Clause topic classification in German and English standard form contracts. ECNLP 2022, p. 199–209. | ACL Anthology 2022.ecnlp-1.23, PDF (chiffres) |
| braun2024differ | Braun D. I beg to differ: how disagreement is handled in the annotation of legal machine learning data sets. *AI & Law*. 2024;32:839–62. doi:10.1007/s10506-023-09369-4 | Springer |
| tuggener2020ledgar | Tuggener D, von Däniken P, Peetz T, Cieliebak M. LEDGAR: a large-scale multi-label corpus for text classification of legal provisions in contracts. LREC 2020. | ACL Anthology 2020.lrec-1.155 (connu) |
| hendrycks2021cuad | Hendrycks D, Burns C, Chen A, Ball S. CUAD: an expert-annotated NLP dataset for legal contract review. NeurIPS Datasets and Benchmarks 2021. | connu ⚠ non re-vérifié ce jour |
| wilson2016opp115 | Wilson S, Schaub F, Dara AA, et al. The creation and analysis of a website privacy policy corpus. ACL 2016. | ACL Anthology P16-1126 ; κ 0,49–0,91 |
| aumiller2021segmentation | Aumiller D, Almasian S, Lackner S, Gertz M. Structural text segmentation of legal documents. ICAIL 2021. | dossier fusion-classes ⚠ DOI non re-vérifié |
| demszky2020goemotions | Demszky D, Movshovitz-Attias D, Ko J, Cowen A, Nemade G, Ravi S. GoEmotions: a dataset of fine-grained emotions. ACL 2020. | connu |
| passonneau2006masi | Passonneau RJ. Measuring agreement on set-valued items (MASI) for semantic and pragmatic annotation. LREC 2006. | ACL Anthology L06-1392 |
| marchal2022multilabel | Marchal M, Scholman M, Yung F, Demberg V. Establishing annotation quality in multi-label annotations. COLING 2022, p. 3659–68. | ACL Anthology 2022.coling-1.322 |
| artstein2008intercoder | Artstein R, Poesio M. Inter-coder agreement for computational linguistics. *Comput Linguist*. 2008;34(4):555–96. | connu |
| krippendorff2018content | Krippendorff K. Content analysis: an introduction to its methodology. 4th ed. Sage; 2018. | connu |
| gwet2008ac1 | Gwet KL. Computing inter-rater reliability and its variance in the presence of high agreement. *Br J Math Stat Psychol*. 2008;61(1):29–48. | connu |
| bayerl2011metaanalysis | Bayerl PS, Paul KI. What determines inter-coder agreement in manual annotations? A meta-analytic investigation. *Comput Linguist*. 2011;37(4):699–725. doi:10.1162/COLI_a_00074 | PDF intégral lu |
| micklitz2017empire | Micklitz HW, Pałka P, Panagis Y. The empire strikes back: digital control of unfair terms of online services. *J Consum Policy*. 2017;40:367–88. | connu ⚠ DOI non vérifié |
| plank2022variation | Plank B. The "problem" of human label variation: on ground truth in data, modeling and evaluation. EMNLP 2022. | connu |
| uma2021disagreement | Uma AN, Fornaciari T, Hovy D, Paun S, Plank B, Poesio M. Learning from disagreement: a survey. *JAIR*. 2021;72:1385–470. | connu |
| nangia2019human | Nangia N, Bowman SR. Human vs. Muppet: a conservative estimate of human performance on the GLUE benchmark. ACL 2019. | ACL Anthology P19-1449 |
| gilardi2023chatgpt | Gilardi F, Alizadeh M, Kubli M. ChatGPT outperforms crowd workers for text-annotation tasks. *PNAS*. 2023;120(30):e2305016120. | connu |
| ziems2024css | Ziems C, Held W, Shaikh O, Chen J, Zhang Z, Yang D. Can large language models transform computational social science? *Comput Linguist*. 2024;50(1):237–91. | connu |
| savelka2023unreasonable | Savelka J, Ashley KD. The unreasonable effectiveness of large language models in zero-shot semantic annotation of legal texts. *Front Artif Intell*. 2023;6:1279794. | Frontiers, SSRN |
| schepers2025price | Schepers I, Bruijn M, Wieling M, Vols M. The price of automated case law annotation: comparing the cost and performance of GPT-4o and student annotators. *AI & Law*. 2025. doi:10.1007/s10506-025-09495-1 | Springer, RUG |
| zheng2023judging | Zheng L, Chiang WL, Sheng Y, et al. Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. NeurIPS 2023. | connu |
| bavaresco2025judges | Bavaresco A, Bernardi R, Bertolazzi L, et al. LLMs instead of human judges? A large scale empirical study across 20 NLP evaluation tasks. ACL 2025 (short), p. 238–55. | ACL Anthology 2025.acl-short.20 |
| mukherjee2026geometry | Mukherjee S, Hamna H, Bali K, Sitaram S. The geometry of LLM-as-judge: why inter-LLM consensus is not human alignment. arXiv:2606.03043; 2026. | arXiv (preprint) |
| choi2024llmeffect | Choi AS, Akter SS, Singh JP, Anastasopoulos A. The LLM effect: are humans truly using LLMs, or are they being influenced by them instead? EMNLP 2024, p. 22032–54. | ACL Anthology 2024.emnlp-main.1230 |
| chalkidis2020legalbert | Chalkidis I, Fergadiotis M, Malakasiotis P, Aletras N, Androutsopoulos I. LEGAL-BERT: the muppets straight out of law school. Findings of EMNLP 2020, p. 2898–904. | connu |
| jayakumar2023legal | Jayakumar T, Farooqui F, Farooqui L. Large language models are legal but they are not: making the case for a powerful LegalLLM. NLLP 2023, p. 223–9. | ACL Anthology 2023.nllp-1.22 |
| eu1993directive | Council Directive 93/13/EEC of 5 April 1993 on unfair terms in consumer contracts. OJ L 95, 21.4.1993, p. 29–34. | connu |

**Non retenus (mais vus)** : *Terminators: ToS parsing and auditing agents* (arXiv 2505.11672, 2025) —
agents LLM, hors périmètre ; *Harmful Terms and Where to Find Them* (arXiv 2502.01798, 2025) — conditions
financières, hors périmètre ; *Just Put a Human in the Loop?* (arXiv 2507.15821, 2025) — annotation
assistée sur tâches subjectives, redondant avec Choi 2024 pour un short paper.
