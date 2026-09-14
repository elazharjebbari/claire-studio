# État de l'art complet — « A Thematic Layer for CLAUDETTE » (short paper JURIX 2026)

> **Date : 14 septembre 2026.** Ce document fusionne (a) la carte de littérature du brouillon
> [`jurix2026_short_paper_state_of_art_positioning.md`](jurix2026_short_paper_state_of_art_positioning.md)
> (11 références, cadrage « segmentation thématique comme représentation intermédiaire »), (b) les revues
> déjà compilées dans `docs/pactiva-jurix-2026/01`, `docs/pactiva-anomalies-graphe/01` et
> `docs/pactiva-fusion-classes/04`, et (c) une recherche web ciblée (≈ 35 requêtes, 2024–2026 en priorité).
> Il **remplace** `docs/pactiva-etat-de-l-art-short-paper/00_ETAT_DE_L_ART.md`, qu'il étend.
>
> **Statut de vérification.** Chaque référence a été vérifiée à la source (éditeur, ACL Anthology, arXiv,
> dblp ou PDF intégral) pour le titre, les auteurs, le lieu et l'année. ⚠ signale un détail non vérifié
> (DOI, pages, volume). Les 11 références du brouillon sont **toutes confirmées** ; trois ont été précisées
> (Galassi 2024 : volume/pages à confirmer ; Lawma : publié à ICLR 2025 ; LAMUS : arXiv 2603.08286, le
> DOI de revue du brouillon n'a pas pu être confirmé).
>
> **Entrées BibTeX** : toutes les références numérotées [n] ci-dessous (59, dont 6 sur les plateformes d'annotation ajoutées à la demande de l'auteur) existent dans
> [`jurix2026-short-paper/references.bib`](../jurix2026-short-paper/references.bib) sous la clé indiquée
> en §11, et compilent avec le `vancouver.bst` d'IOS Press.

---

## 0. Comment lire ce document

| Vous cherchez… | Section |
|---|---|
| Le sujet et la réconciliation des deux cadrages (brouillon vs abstract) | §1 |
| La littérature par axe, avec les chiffres utiles | §2 (A → I) |
| La plateforme d'annotation comme artefact publié (ce que la communauté reçoit) | §2-I, §6 |
| Le tableau comparatif des ressources voisines | §3 |
| La matrice littérature → contribution | §4 |
| La lacune scientifique et l'énoncé du gap | §5 |
| Ce qui est neuf / ce qui ne l'est pas | §6 |
| L'ancrage de chaque phrase de l'abstract | §7 |
| Les risques méthodologiques que la littérature impose de déclarer | §8 |
| Le plan de la section *Related Work* (≤ 0,5 page) | §9 |
| Ce que la recherche n'a **pas** trouvé (et qui devient argument) | §10 |
| La bibliographie complète (59 entrées, clés BibTeX, statut) | §11 |

---

## 1. Le sujet, et les deux cadrages à réconcilier

**Le projet global** (brouillon §1–3) : détecter des *anomalies juridiques* dans les conditions d'utilisation
(ToS) — abusivité, non-conformité, incohérence, ou problème qui n'apparaît qu'en relation avec les
dispositions voisines — via une chaîne *phrase → segment logique/thématique → classification → extraction →
graphe → raisonnement*. Le short paper n'a pas à résoudre cette chaîne ; il en établit le **premier étage**.

**Deux formulations coexistent** :

| | Brouillon (`state_of_art_positioning.md`) | Abstract soumis |
|---|---|---|
| Objet | la **segmentation** en unités logiques pluri-phrastiques comme représentation intermédiaire | une **couche thématique** (20 thèmes multi-label) sur les 9 414 phrases de CLAUDETTE |
| Hypothèse | H1 : le segment est une meilleure unité que la phrase pour l'analyse aval | la couche soutient à la fois la **mesure** (plafond humain, coût du multi-label, granularité) et l'**entraînement** (Legal-BERT) |
| Résultat central | les humains identifient les segments de façon consistante ; des modèles les reproduisent | quatre résultats chiffrés : plafond humain 0,871/κ 0,859 ; juges LLM ≤ 0,60 ; coût du multi-label 0,074 constant sur 4 granularités ; T11 récupère +0,067 sous contrainte de strates ; Legal-BERT > tous les juges |
| Point dur des données | — | **la frontière** : Jaccard 0,37–0,47 entre annotateurs, contre κ 0,68–0,80 sur le thème |

**Réconciliation.** Les deux cadrages décrivent la même ressource : un segment thématique est, par
construction, une plage maximale de phrases contiguës portant le même jeu de thèmes (cf. `docs/pactiva-fusion-classes/05`).
Mais **les données tranchent l'ordre de présentation** : l'accord sur les *thèmes* est solide et
publiable (α-MASI 0,658 → 0,725, κ humain 0,68–0,80), l'accord sur les *frontières* est faible
(0,37–0,47) et les annotateurs ne segmentent pas à la même granularité (2 163 à 4 121 frontières). Un
papier centré sur la segmentation devrait défendre son point le plus fragile ; un papier centré sur la
couche thématique **rapporte la frontière comme résultat** (« la frontière est le point dur, pas le
thème ») et garde H1 pour le papier long. C'est le choix de l'abstract, et c'est celui que la littérature
ci-dessous étaye le mieux (§2-C : la segmentation juridique reste un problème ouvert ; §2-D : la
fiabilité thématique est mesurable et comparable). La phrase-pivot du brouillon reste valable, reformulée :

> *Before asking whether a provision is unfair, we ask what it is about — and how reliably humans and
> models can say so.*

---

## 2. Cartographie de la littérature

### A. Détection de clauses abusives dans les ToS — le terrain

**La lignée CLAUDETTE (Bologne/EUI).** Lippi et al. [1] fondent la tâche : 50 ToS, phrases étiquetées
selon 8 catégories de clauses potentiellement abusives (directive 93/13/CEE [2]) ; SVM, CNN, LSTM ;
c'est **le corpus même que nous ré-annotons**. Suivent le corpus multilingue (25 documents × 4 langues,
9 catégories ; Drawzeski et al. [3]), les réseaux à mémoire avec *rationales* — première prise au sérieux
de l'explication, par attention (Ruggeri et al. [4]) —, l'apprentissage multilingue (Galassi et al. [5]),
la présence continue à JURIX/ICAIL (Lagioia et al., JURIX 2019 [6] ; Grundler et al., JURIX 2024,
*honorable mention*, corpus de 30 politiques de confidentialité et nouvelles consignes d'annotation [7]).
UNFAIR-ToS est aussi l'une des sept tâches de **LexGLUE** [8] — 9 414 phrases, mais **identité de document,
ordre et sévérité perdus** —, où Legal-BERT atteint μ-F1 96,0 / m-F1 83,0.

**Hors CLAUDETTE, trois ressources récentes.** **AGB-DE** (Braun & Matthes, ACL 2024 [9]) : 3 764 clauses
de 93 contrats allemands, validité annotée par cinq juristes de la protection des consommateurs, mais
**une seule annotation par clause** (76 % d'accord brut sur un sous-ensemble initial) ; aucune approche
au-dessus de **F1 0,54** (BERT fine-tuné en tête, GPT-3.5 meilleur en rappel). **Löffler et al.** (*AI & Law*
2025 [10]) : 50 ToS chiliens, 5 209 clauses, schéma à **4 catégories / 20 classes d'abusivité** (illegal,
dark, gray + exigences formelles), **deux experts, « due to the expert review, we do not report agreement
measures »** ; macro-F1 détection 79–89 %, classification 60–70 %. Braun & Matthes 2022 [11] : voir §B.

**La vague LLM sur la même tâche (2024–2026).** Panarelli et al. (ICAIL 2025 [12]) comparent prompting et
BERT fine-tuné — les spécialisés restent compétitifs (⚠ abstract non accessible : citer prudemment).
*Text to Trust* (Juttu et al., 2025 [13]) : sur CLAUDETTE-ToS, **le fine-tuning complet de BERT garde le
meilleur équilibre précision/rappel** face à LoRA/QLoRA (TinyLlama, LLaMA 3B/7B, SaulLM) et au zero-shot
GPT-4o/o3-mini. Frasheri et al. (2024 [14]) : sur des questions de politiques de confidentialité, les LLM
font « à peine mieux que le hasard ».

**Ce que personne ne fournit.** Tous ces travaux étiquettent l'*abusivité* ; **aucun ne dit de quoi la clause
traite** sur CLAUDETTE. Quand des *topics* existent (AGB-DE, Braun 2022), c'est en mono-annotation ou sans
coefficient corrigé du hasard, ou sans publication du corpus.

### B. Taxonomies thématiques de clauses et ressources voisines

- **LEDGAR** (Tuggener et al., LREC 2020 [15]) : ~850 k provisions de contrats SEC, ~12 000 intitulés
  **réduits à 100 classes par fréquence** — le précédent direct de la réduction de taxonomie comme geste de
  constitution de ressource.
- **CUAD** (Hendrycks et al., NeurIPS D&B 2021 [16]) : 510 contrats, 41 types de clauses « à risque »
  annotés par experts pour la due diligence.
- **OPP-115** (Wilson et al., ACL 2016 [17]) : 115 politiques de confidentialité, 10 catégories de
  pratiques + attributs, **trois étudiants en droit par document, Fleiss κ 0,49–0,91 selon la catégorie** —
  le seul précédent comparable à notre protocole (triple annotation intégrale + coefficient).
- **Braun & Matthes** (ECNLP 2022 [11]) : > 6 000 clauses de > 170 CGV allemandes et anglaises,
  **taxonomie de 23 topics / 37 sous-topics construite avec des juristes**, multi-label, deux annotateurs
  (étudiant + auteurs) avec arbitrage par avocats, **87 % d'accord brut** (non corrigé) ; BERT F1 0,91 ;
  **corpus non publié** (droit d'auteur).
- **Survey** : Singh et al. (*AI Review* 2025 [18]) recensent sept tâches de classification contractuelle
  et quatorze jeux de données anglais — la classification thématique, l'abusivité et la modalité déontique
  en sont les trois axes ; utile comme cadrage large.
- Réductions de taxonomie hors droit : **GoEmotions** (Demszky et al., ACL 2020 [19]) regroupe 27 émotions
  par corrélation ; PDTB et autres schémas hiérarchiques rapportent classiquement un accord plus élevé au
  niveau grossier — **toujours par fréquence, corrélation ou hiérarchie a priori, jamais sous une contrainte
  externe** au signal d'accord (§5).

### C. Segmentation de documents juridiques et question de la granularité

C'est l'axe du brouillon (§27 : *legal document segmentation, clause boundary detection, topic
segmentation…*). Ce que la recherche établit :

- **Segmentation topique de ToS.** Aumiller et al. (ICAIL 2021 [20]) — le travail le plus proche —
  segmentent ~74 000 ToS en prédisant la cohérence topique de paragraphes consécutifs (RoBERTa,
  Sentence-RoBERTa) à partir d'annotations topiques hiérarchiques ; **la frontière thématique y reste le
  point dur**, cohérent avec notre Jaccard 0,37–0,47.
- **Segmentation fonctionnelle de décisions.** Savelka & Ashley (JURIX 2018 [21]) : sept parties
  fonctionnelles (Background, Analysis, Conclusions…) sur des décisions américaines, CRF ; Bhattacharya et
  al. (JURIX 2019 [22]) : rôles rhétoriques de phrases dans des jugements indiens — deux précédents d'un
  **étage intermédiaire entre phrase et document**, mais sur des décisions, pas des contrats.
- **La phrase comme unité n'est pas triviale non plus** : MultiLegalSBD (Brugger, Stürmer & Niklaus,
  ICAIL 2023 [23] ⚠) montre que la détection de frontières de phrases dans les textes juridiques exige
  des données dédiées.
- **Métriques et modèles génériques.** TextTiling (Hearst 1997 [24]), P_k (Beeferman et al. 1999 [25]),
  **WindowDiff** (Pevzner & Hearst 2002 [26]) — la métrique que nous rapportons (0,555 pour l'étiquetage de
  séquence) ; segmentation supervisée neuronale (Koshorek et al., NAACL 2018 [27]).
- **Contexte pour la détection d'abusivité.** À notre connaissance ⚠, aucun travail publié sur CLAUDETTE
  n'évalue systématiquement l'apport d'un contexte pluri-phrastique à la détection ; notre ablation interne
  (`ablation-context`, +0,002 macro-F1 avec ±1 phrase) suggère un gain faible au grain phrase — argument
  de plus pour traiter la granularité comme **objet de mesure** plutôt que comme prémisse.

**Lecture.** La littérature confirme qu'un étage intermédiaire existe pour d'autres genres juridiques, mais
qu'en contrats il est rare (Aumiller) et que la frontière y est difficile. Le brouillon peut donc affirmer
que **H1 n'a pas été testée sur les ToS** — et le short paper apporte la première mesure humaine de la
difficulté de frontière (Jaccard reconstruit) sans prétendre la résoudre.

### D. Mesurer l'accord : multi-label, granularité, prévalence

- **Cadre.** α de Krippendorff (Krippendorff 2018 [28]) ; revue de référence Artstein & Poesio (*CL* 2008
  [29]) ; seuils 0,667 / 0,80. Pour des **ensembles d'étiquettes**, la distance **MASI** (Passonneau, LREC
  2006 [30]) est la pratique standard.
- **Le multi-label change l'accord fortuit.** Marchal, Scholman, Yung & Demberg (COLING 2022 [31]) évaluent
  plusieurs métriques d'accord multi-label et proposent un bootstrap du hasard : l'argument théorique que
  **le coût du multi-label doit être mesuré, pas supposé**.
- **Prévalence extrême.** Gwet AC1 (BJMSP 2008 [32]) comme garde-fou de κ/α sur les classes rares — nos
  DMCA/FEEDBACK : α 0,10–0,13 mais AC1 ≥ 0,98, à rapporter ensemble.
- **Les déterminants de l'accord — la référence pivot.** Bayerl & Paul (*CL* 2011 [33]), méta-analyse de
  96 études et 346 indices : sept facteurs, dont le **nombre de catégories** (relation négative) et la
  **formation** des annotateurs. Les auteurs précisent que κ a été inventé pour neutraliser le nombre de
  catégories et **laissent explicitement ouverte** la question de savoir si l'effet subsiste sur des
  coefficients corrigés du hasard — l'attribuant, s'il subsiste, à la difficulté de distinguer des
  catégories voisines. **Notre E2.1 répond à cette question** : sur α (corrigé du hasard), 20 → 11 classes
  = +0,067 [0,058 ; 0,077], signe stable sur 100 % des rééchantillons, reproduit sur 17 documents de
  validation (+0,069).

### E. Désaccord, variation humaine, plafond humain

- **Le droit efface le désaccord.** Braun (*AI & Law* 2024 [34]) : tous les jeux de données juridiques
  analysés **suppriment toute trace de désaccord** au lieu de l'exploiter. Notre protocole publie les votes,
  la cascade (accord strict 46,8 % / majorité 48,3 % / arbitrage humain 4,9 %) et les soft labels.
- **La variation n'est pas du bruit.** Plank (EMNLP 2022 [35]) ; Uma et al. (*JAIR* 2021 [36]) ; Löffler
  et al. [10] et AGB-DE [9] illustrent en creux l'usage courant : un expert tranche, l'accord n'est pas
  mesuré.
- **Un plafond humain estimé comme on évalue un modèle.** Nangia & Bowman (ACL 2019 [37]) soumettent des
  humains à la procédure d'évaluation des modèles (GLUE) ; **Thalken et al. (EMNLP 2023 [38])** — titre
  explicite : *LM annotation at the edge of human agreement* — annotent des opinions de la Cour suprême par
  une équipe d'experts, montrent que **les modèles génératifs échouent avec le codebook des humains** et que
  **Legal-BERT fine-tuné est le meilleur système**. Notre référence *leave-one-annotator-out* (0,871 /
  κ 0,859) et notre comparaison juges ↔ Legal-BERT reproduisent ce schéma sur les contrats.

### F. LLM comme annotateurs, assistants et juges

- **L'enthousiasme initial et ses limites.** Gilardi et al. (*PNAS* 2023 [39]) : ChatGPT dépasse les
  *crowd workers* ; Ziems et al. (*CL* 2024 [40]) : utile, pas un remplaçant. En droit : Savelka & Ashley
  (*Frontiers in AI* 2023 [41]) — GPT-4 zero-shot sur opinions, clauses et dispositions, **humain dans la
  boucle requis** dès que la tolérance à l'erreur est faible ; Schepers et al. (*AI & Law* 2025 [42]) —
  GPT-4o au niveau humain sur les annotations basiques de décisions, en retrait sur les tâches complexes ;
  LAMUS (Wang, Pobbathi & Chen, 2026 [43]) — 2,9 M de phrases, annotation LLM + raffinement humain ciblé
  (κ 0,85 rapporté à la vérification), Llama-3-8B fine-tuné 85,3 % contre une baseline Legal-BERT.
- **Collaboration humain–LLM.** CoAnnotating (Li et al., EMNLP 2023 [44]) répartit le travail selon
  l'incertitude du modèle (+21 % sur l'allocation aléatoire) — le cadre où s'inscrit notre pré-annotation
  post-éditée.
- **L'ancrage — la menace à déclarer.** Choi et al. (EMNLP 2024 [45]) : avec suggestions LLM, l'accord
  experts ↔ LLM passe de **43,9 % à 71,5 %** ; biais d'ancrage mesuré. Notre divergence de **39–49 %** au
  juge le plus proche est la borne inférieure de l'édition réelle (juge de seed non persisté) ; elle exclut
  la ratification, pas l'influence.
- **LLM-as-a-judge.** Zheng et al. (NeurIPS 2023 [46]) établissent le paradigme (accord GPT-4/humains ≈
  humain/humain sur MT-Bench) ; **Bavaresco et al. (ACL 2025, JUDGE-BENCH : 20 jeux, 11 LLM [47])**
  concluent que les LLM **ne sont pas prêts à remplacer systématiquement les juges humains** ; Mukherjee et
  al. (arXiv 2606.03043, 2026 [48]) : **le consensus inter-LLM n'est pas l'alignement humain** — les juges
  s'accordent entre eux autant que les humains mais n'atteignent que 58–66 % de l'accord humain, sur un
  axe « que les humains ne pondèrent pas ». **Notre matrice 7 × 7 mesure ce phénomène sur un vocabulaire
  juridique fermé** : humain↔humain κ 0,68–0,80, humain↔LLM ≤ 0,59, LLM↔LLM jusqu'à 0,80.

### G. Spécialisation contre généralistes

- **Legal-BERT** (Chalkidis et al., Findings EMNLP 2020 [49]) et son rang sur LexGLUE [8].
- **Les généralistes en zero-shot restent loin** : Jayakumar et al. (NLLP 2023 [50]) — ChatGPT-3.5,
  LLaMA-70b, Falcon-180b jusqu'à **19,2 / 26,8 points de μ-F1 / m-F1 sous** les modèles compacts fine-tunés
  sur des provisions contractuelles ; **Lawma** (Dominguez-Olmedo et al., ICLR 2025 [51]) — 260 tâches de
  classification juridique : GPT-4.5 et Claude 3.7 Sonnet « non triviaux mais très variables », **des petits
  modèles légèrement fine-tunés les dépassent** ; Thalken [38], *Text to Trust* [13], AGB-DE [9], Panarelli
  [12] convergent.
- **Nos chiffres** (E4.4, nuit du 13 → 14 sept.) : Legal-BERT κ 0,695 (T20) / 0,720 (T11) contre 0,581
  pour le meilleur juge et 0,859 pour le plafond humain — **au-dessus de tous les juges, à mi-chemin du
  plafond** (formulation recommandée : *closes roughly half the gap*, pas *approaches*).

### H. En aval : structure, graphe, raisonnement (motivation, hors périmètre du short)

- **Contrats → graphes.** GRAPH-GRPO-LEX (Dechtiar et al., IEEE ICDMW 2025 [52] ⚠ DOI) : ontologie
  contrat → nœuds/arêtes, segmentation et extraction d'entités/relations par LLM + GRPO — la cible que
  des segments thématiques propres alimenteraient.
- **Explication par rationales** (Ruggeri et al. [4]) et **catégories juridiques** (Micklitz, Pałka &
  Panagis, *J. Consumer Policy* 2017 [53]) — le lien thème ↔ strate d'abusivité (LIMITATION_LIABILITY
  lift 3,4 ; MODIFICATION_OF_TERMS 4,5 ; TERMINATION 4,0 contre ≤ 1 pour le cadrage) a un fondement
  doctrinal : ce sont les catégories LTD/CH/TER de CLAUDETTE.
- **Nos mesures G2** (co-occurrence de thèmes : identité de combinaison AUC-PR 0,589, 3,2 × le hasard ;
  détecteurs non supervisés au niveau du hasard) : le signal aval existe et justifie la contrainte de strates.

### I. La plateforme d'annotation comme artefact scientifique

**Ce que nous mettons à disposition.** Outre les annotations, le codebook et le protocole, le papier annonce
la publication de **Pactiva**, la plateforme web avec laquelle la couche thématique a été produite : les
50 contrats CLAUDETTE y sont consultables avec, phrase par phrase, les étiquettes d'abusivité d'origine,
les trois annotations humaines et les quatre pré-annotations LLM (provenance marquée) ; on peut y
**visualiser** (plan du document, couverture, vue bilingue EN/FR, projection T20/T14/T11/T10 à la lecture),
**analyser** (α-MASI, α nominal, κ par paire, Jaccard de frontières, concordance humain ↔ juge, matrice
7 × 7), **arbitrer** (module gold : cascade accord strict / majorité / arbitrage, verrou exclusif, décision
tracée, réouverture), **exporter** (JSONL/CSV, votes bruts, soft labels, gold) et **enrichir** (nouveaux
annotateurs sous la même politique d'indépendance, nouveaux juges LLM sur le même vocabulaire, nouveaux
thèmes ou nouveaux corpus, campagnes versionnées, jeux de données et expériences reproductibles via le Lab).
Une instance de démonstration est en ligne ([pactiva.legal](https://pactiva.legal)) ; le code est publié
sous licence libre (⚠ licence, dépôt et DOI Zenodo à fixer avant la camera-ready).

**Où cela se situe dans la littérature.** Les plateformes d'annotation génériques sont des artefacts
reconnus : brat [54] (annotation web assistée), WebAnno [55] puis **INCEpTION** [56] (annotation
multi-utilisateur, curation/adjudication, suggestions par apprentissage actif), doccano [57], **POTATO**
[58] (annotation portable, suivi par annotateur). Toutes gèrent plusieurs annotateurs et une étape de
curation ; **aucune ne fournit nativement** (i) un mode « pré-annotations LLM sur vocabulaire fermé, avec
provenance par phrase et mesure de divergence par annotateur » [45], (ii) une cascade de résolution qui
**conserve** les votes et les soft labels [34], (iii) des projections de taxonomie versionnées appliquées à
la lecture (T20 → T11) sans réécrire les annotations, ni (iv) des tableaux de bord d'accord calculés en
continu sur l'annotation en cours. Côté juridique, l'outil CLAUDETTE lui-même est diffusé comme service
web d'*explication* de l'abusivité (Liepiņa et al., NLLP 2020 [59]) — un outil de lecture, pas
d'annotation ; le brouillon (§8) avait raison d'y voir un levier : **la plateforme fait de la ressource un
objet vivant** (extensible par la communauté) plutôt qu'un dépôt figé, et répond à la fois à Braun [34]
(désaccord préservé et consultable) et à la demande de reproductibilité des *resource papers*.

**Ce qu'il faut dire dans le papier (une phrase, §Conclusion ou §Data).** *The platform used to build the
layer is released with it: it exposes, sentence by sentence, the CLAUDETTE labels, the three human
annotations and the four LLM pre-annotations, computes the agreement statistics reported here, projects
the taxonomies, exports all layers, and supports further annotation under the same independence and
arbitration protocol.*

---

## 3. Tableau comparatif des ressources voisines

| Ressource | Unités | Taxonomie | Multi-label | Annotateurs / unité | Accord rapporté | Public |
|---|---|---|---|---|---|---|
| CLAUDETTE [1] | 50 ToS, 9 414 phrases (LexGLUE) | 8 catégories d'abusivité | oui (catégories) | juristes, adjudication | κ binaire ≈ 0,64 ⚠ (à revérifier dans [1]) | oui |
| Multilingue [3] | 25 doc. × 4 langues | 9 catégories | oui | juristes | — | oui |
| Löffler 2025 [10] | 50 ToS chiliens, 5 209 clauses | 4 catégories / 20 classes d'abusivité | oui | 2 experts | **non rapporté** (« due to the expert review ») | ⚠ |
| AGB-DE [9] | 3 764 clauses, 93 contrats DE | 23 topics / 37 sous-topics + validité | oui (30 clauses) | **1** juriste | 76 % brut (sous-ensemble) | oui |
| Braun & Matthes 2022 [11] | > 6 000 clauses, > 170 CGV | 23 topics / 37 sous-topics | oui | 2 + arbitrage | 87 % brut | **non** |
| LEDGAR [15] | ~850 k provisions | 100 classes (réduites de ~12 000) | oui | natif (pas d'annotation) | — | oui |
| CUAD [16] | 510 contrats, 13 k annotations | 41 types | — | experts | — | oui |
| OPP-115 [17] | 115 politiques, 23 k pratiques | 10 catégories + attributs | oui | **3** étudiants en droit | **Fleiss κ 0,49–0,91** | oui |
| Aumiller 2021 [20] | ~74 k ToS | topiques hiérarchiques | — | — | — | oui |
| **Cette couche** | 50 ToS CLAUDETTE, 9 414 phrases | 20 thèmes (T20) → 11 (T11), spécification versionnée | oui | **3** annotateurs formés + **4** juges LLM | **α-MASI 0,658 / 0,725**, α nominal, κ par paire, Jaccard frontières, IC bootstrap | annotations + codebook + protocole + **plateforme** (visualiser, analyser, arbitrer, exporter, enrichir) |

---

## 4. Matrice littérature → contribution (fusion des deux cartes)

| Travail | ToS | Abusivité / anomalie | Annotation humaine multiple | LLM | Thèmes / segments | Mesure de fiabilité | Ce qu'il apporte au papier |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| CLAUDETTE [1] | ✓ | ✓ | adjudication | ✗ | phrase | partielle | tâche aval fondatrice |
| Galassi 2024 [5] | ✓ | ✓ | ✓ | ✗ | phrase | — | transfert multilingue |
| Löffler 2025 [10] | ✓ | ✓ | 2 experts | limité | clause | **non** | ressource récente, 20 classes, sans accord |
| AGB-DE [9] | CGV | ✓ | 1 | GPT-3.5 | topics | brut | topics mais mono-annotation |
| Braun & Matthes 2022 [11] | CGV | ✗ | 2 | ✗ | **topics** | brut | taxonomie experte, non publiée |
| OPP-115 [17] | politiques | ✗ | **3** | ✗ | catégories | **κ** | protocole comparable |
| Aumiller 2021 [20] | ✓ | ✗ | ✗ | ✗ | **segments** | — | segmentation topique de ToS |
| Panarelli 2025 [12] | ✓ | ✓ | ✓ | ✓ | phrase | — | LLM vs spécialisés |
| Savelka & Ashley 2023 [41] | partiel | annotation | ✓ | ✓ | unités sémantiques | — | pré-annotation LLM en droit |
| CoAnnotating [44] | ✗ | ✗ | ✓ | ✓ | générique | — | flux humain–LLM |
| Choi 2024 [45] | ✗ | ✗ | experts | ✓ | topics | — | **ancrage mesuré** |
| Thalken 2023 [38] | droit | ✗ | experts | ✓ | phrase | ✓ | LLM au bord de l'accord humain ; Legal-BERT gagne |
| Lawma [51] | droit | classification | ✓ | ✓ | — | — | limites des généralistes |
| Bavaresco 2025 [47] / Mukherjee 2026 [48] | ✗ | ✗ | ✓ | ✓ | — | ✓ | juges LLM : variance, consensus ≠ alignement |
| Bayerl & Paul 2011 [33] | ✗ | ✗ | méta | ✗ | — | **✓** | nombre de catégories, formation ; question ouverte |
| Marchal 2022 [31] / Passonneau 2006 [30] | ✗ | ✗ | ✓ | ✗ | — | **✓** | accord multi-label |
| Braun 2024 [34] | droit | — | — | — | — | ✓ | le désaccord effacé |
| GRAPH-GRPO-LEX [52] | contrats | aval | limité | ✓ | clauses/relations | — | étage graphe futur |
| **Ce papier** | **✓** | **motivation aval** | **3 × 50 doc.** | **4 juges + pré-annotation** | **20 → 11 thèmes multi-label + frontières** | **α-MASI, κ, Jaccard, plafond LOAO** | **couche thématique fiable, mesurée, publiée** |

---

## 5. La lacune scientifique

La littérature établit que : (1) les clauses abusives des ToS se détectent automatiquement [1–14] ;
(2) les encodeurs compacts classent bien les clauses et battent les LLM généralistes [8, 38, 49–51] ;
(3) les LLM annotent sémantiquement des textes juridiques, avec des limites et un biais d'ancrage
[41–45] ; (4) l'accord multi-label et l'effet du nombre de catégories sont des objets d'étude
[30–33] ; (5) les contrats peuvent être structurés en graphes [52] ; (6) des plateformes d'annotation multi-utilisateur avec curation existent [54–58].

Ce qui manque : **une couche thématique fiable, mesurée et publiée sur le corpus de référence**, et, au-delà,
**une réponse à la question laissée ouverte par Bayerl & Paul** (l'effet de la granularité subsiste-t-il
sur un coefficient corrigé du hasard, et à quel prix pour la tâche aval ?). Les ressources à topics
existantes sont mono-annotées [9], non publiées [11] ou sans coefficient [10] ; aucune ne met humains et
LLM sur le même vocabulaire et les mêmes phrases, et aucune n'est livrée avec l'outil qui permet de la
consulter, la mesurer et la prolonger.

**Énoncé du gap (EN, pour le papier).**

> *Existing work on Terms of Service labels whether a sentence is unfair, not what the clause is about;
> where clause topics exist, they are single-annotated, unpublished, or reported without chance-corrected
> agreement. As a result, three questions remain unanswered on the reference benchmark: what reliability
> trained humans reach on multi-label topic annotation, how far LLM judges fall from that ceiling on the
> same vocabulary and sentences, and whether the granularity of the taxonomy — not the multi-label format —
> is what limits reliability.*

Le gap du brouillon (« quelle unité textuelle avant de détecter l'anomalie ? ») reste vrai et devient la
**motivation** ; il est traité ici par la mesure de frontière et renvoyé au papier long pour H1.

---

## 6. Ce qui est neuf — et ce qui ne l'est pas

**N'est pas neuf en soi** : fine-tuner Legal-BERT ; pré-annoter par LLM ; détecter des clauses abusives ;
faire valider par des humains ; réduire une taxonomie ; mesurer α-MASI.

**Est neuf (à revendiquer)** :

1. **La ressource** : première couche thématique multi-label sur les 50 ToS de CLAUDETTE, **triple
   annotation intégrale**, 4 juges LLM sur les mêmes phrases, votes et désaccords conservés [34].
2. **La séparation de deux effets** que la littérature confond : coût du **format** multi-label
   (0,074, constant sur 4 granularités) vs effet de la **granularité** (+0,067 de 20 → 11 classes, hold-out
   +0,069) — réponse directe à [33].
3. **La contrainte de strates d'abusivité** sur la consolidation : une règle **externe** au signal d'accord,
   issue de la tâche aval, avec son prix mesuré (T10 : −13 % d'AP pour +0,012 d'α). Sans précédent
   explicite trouvé (§10).
4. **Le plafond humain LOAO** comme référence de toutes les comparaisons (juges, modèles) — transposition
   de [37, 38] aux contrats.
5. **La mesure de frontière** (Jaccard reconstruit 0,37–0,47 ; 2 163 à 4 121 frontières) comme résultat
   sur la granularité, plutôt que comme prémisse.
6. **La ressource livrée avec son outil** : la plateforme Pactiva (visualiser, analyser, arbitrer, exporter,
   enrichir), qui rend la couche thématique extensible par la communauté sous le même protocole — là où les
   ressources voisines sont figées [9, 10, 17], non publiées [11], ou diffusées sans outil d'annotation [59].

---

## 7. Ancrage de chaque phrase de l'abstract

| Phrase de l'abstract | Références | Statut de la preuve interne |
|---|---|---|
| CLAUDETTE « labels unfairness sentence by sentence and records nothing about what each clause is about » | [1, 8, 5, 12, 9, 10] | ✅ établi (§A) |
| 9 414 phrases, 3 annotateurs formés, 20 thèmes, 4 LLM | [17] (précédent OPP-115), [11] (taxonomie experte) | ✅ dataset `7116e627…` |
| « human ceiling … judges … remain clearly below » | [37, 38, 47, 48, 41] | ✅ E1.5 ; ⏳ E3.3 (gold à figer) |
| « reliability cost of multi-label annotation … independent of taxonomy granularity » | [30, 31, 33, 29] | ✅ E1.1 ; Δ par taxonomie en annexe d'audit (à mettre en enveloppe) |
| « consolidating … recovers an equivalent amount … provided no merge crosses unfairness strata » | [15, 19, 34, 53] | ✅ E2.1/E2.2 ; ⚠ « purely statistical … systematically violates » sans baseline dédié |
| « compact legal language model … outperforms every judge » | [49, 50, 51, 38, 13] | ✅ E4.4 (κ 0,695/0,720 vs 0,581) ; « approaches the human ceiling » à adoucir |
| « We release the annotations, the codebook, the protocol and the annotation platform » | [34] (désaccord préservé), [17] (codebook), [54–59] (plateformes) | ⚠ codebook anglais à packager ; licence du code, dépôt public et DOI Zenodo à fixer ; licence CLAUDETTE à instruire ; instance de démo : pactiva.legal |
| (limite) pré-annotation LLM post-éditée | [45, 44, 41] | ✅ E3.2 divergence 39–49 % (borne inférieure) |

---

## 8. Risques méthodologiques que la littérature impose de déclarer

| Risque (brouillon §20) | Ce que dit la littérature | Réponse dans le papier |
|---|---|---|
| **Ancrage du pré-remplissage** | Choi 2024 [45] : 43,9 → 71,5 % d'accord avec le LLM sous suggestion | divergence 39–49 % par annotateur ; « labelled independently *of one another*, post-editing LLM pre-annotations » ; juge de seed non persisté = limite |
| **Évaluation circulaire** | Thalken [38], Savelka [41] : le gold doit être humain | les LLM ne sont **jamais** parties au gold (résolution inter-annotateurs seulement) |
| **Désaccord effacé** | Braun 2024 [34] | votes, cascade et soft labels publiés ; 4,9 % d'arbitrage = mesure d'ambiguïté |
| **Références hétérogènes** (modèle vs consensus, juges vs gold, humain LOAO) | Nangia & Bowman [37] : une procédure unique | une table, une référence (le gold figé), même procédure pour humains, juges et modèle |
| **Nombre de catégories ↔ accord** | Bayerl & Paul [33] : effet partiellement statistique | Δ **apparié** sur les mêmes tirages, coefficients corrigés du hasard, hold-out |
| **Rythme d'annotation** (39 documents en 2 jours pour un annotateur) | [33] : formation et procédure comptent | déclaré ; divergence au juge 38,5 % pour cet annotateur |
| **Un seul encodeur, arrêt précoce sur le pli de test** | [51] : variance entre tâches | limite déclarée dans l'enveloppe E4.4 |

---

## 9. Plan de la section *Background and Related Work* (≈ 0,5 page, ~20 citations)

1. **Unfair-clause detection in ToS.** CLAUDETTE [1] → multilingue [3, 5] → LexGLUE [8] → LLM era
   [12, 13] : tous étiquettent l'abusivité, aucun le sujet ; AGB-DE [9] et Löffler [10] portent des classes
   mais sans accord multi-annotateur.
2. **Clause-topic resources and taxonomy size.** LEDGAR [15] (réduction par fréquence), Braun & Matthes
   [11] (23 topics, 87 % brut, non publié), OPP-115 [17] (triple annotation, κ) ; segmentation topique de
   ToS [20].
3. **Measuring multi-label agreement.** α/MASI [28, 30], Marchal [31], Gwet [32] ; Bayerl & Paul [33] et
   leur question ouverte ; Braun [34] sur le désaccord effacé.
4. **LLMs as annotators and judges, compact models.** Savelka & Ashley [41], Bavaresco [47], consensus
   inter-LLM ≠ alignement humain [48], ancrage [45] ; Thalken [38], Lawma [51], Jayakumar [50].
5. *(une phrase, si la place le permet)* **Annotation tooling.** INCEpTION [56], POTATO [58] et l'outil
   CLAUDETTE [59] ; ce que la plateforme publiée ajoute (pré-annotation LLM tracée, désaccord conservé,
   projections de taxonomie) — sinon, renvoyer cette phrase à la section Data ou à la conclusion.

Phrase de clôture : *« None of these works measures, on the same sentences and vocabulary, how reliably
trained humans assign clause topics, how far LLM judges fall from that ceiling, and what part of the gap
is granularity rather than disagreement. »*

---

## 10. Ce que la recherche n'a pas trouvé (et qui devient argument)

Recherches lancées sur les pistes du brouillon §27 (*legal document segmentation, contract segmentation,
clause boundary detection, topic segmentation contracts, multi-sentence legal classification,
context-aware unfair clause detection, cross-sentence legal reasoning, ToS clause segmentation*) :

- **Aucun travail** ne teste H1 (unité pluri-phrastique vs phrase) sur la détection de clauses abusives ;
  le plus proche est la segmentation topique non supervisée de ToS [20].
- **Aucune consolidation de taxonomie** contrainte par un signal aval (juridique ou autre) : les réductions
  publiées sont par fréquence [15], corrélation [19] ou hiérarchie a priori.
- **Aucune ressource contractuelle à topics** avec triple annotation et coefficient corrigé du hasard ;
  OPP-115 [17] est le seul analogue, sur des politiques de confidentialité.
- **Aucune matrice humains × juges LLM** à vocabulaire constant sur des textes juridiques ; les études de
  juges [47, 48] portent sur l'évaluation de générations, pas sur l'annotation de clauses.

À formuler prudemment (*to the best of our knowledge*), car l'absence de résultat de recherche n'est pas
une preuve d'absence — mais c'est la base honnête de la revendication de nouveauté (§6).

---

## 11. Bibliographie complète (59 entrées)

Format NLM abrégé ; **clé BibTeX** ; statut : ✅ vérifié à la source · ⚠ détail à confirmer.

| # | Référence | Clé | Statut |
|---|---|---|---|
| 1 | Lippi M, Pałka P, Contissa G, Lagioia F, Micklitz HW, Sartor G, Torroni P. CLAUDETTE: an automated detector of potentially unfair clauses in online terms of service. *AI & Law*. 2019;27(2):117–39. doi:10.1007/s10506-019-09243-2 | `lippi2019claudette` | ✅ |
| 2 | Council Directive 93/13/EEC on unfair terms in consumer contracts. OJ L 95, 21.4.1993. | `eu1993directive` | ✅ |
| 3 | Drawzeski K, Galassi A, Jabłonowska A, et al. A corpus for multilingual analysis of online terms of service. NLLP 2021. doi:10.18653/v1/2021.nllp-1.1 | `drawzeski2021corpus` | ✅ |
| 4 | Ruggeri F, Lagioia F, Lippi M, Torroni P. Detecting and explaining unfairness in consumer contracts through memory networks. *AI & Law*. 2022;30(1):59–92. | `ruggeri2022memory` | ⚠ DOI |
| 5 | Galassi A, Lagioia F, Jabłonowska A, Lippi M. Unfair clause detection in terms of service across multiple languages. *AI & Law*. 2024 (en ligne) ; ⚠ vol. 33:641–89 selon le brouillon. doi:10.1007/s10506-024-09398-7 | `galassi2024multilingual` | ✅ / ⚠ vol. |
| 6 | Lagioia F, Ruggeri F, Drazewski K, Lippi M, Micklitz HW, Torroni P, Sartor G. Deep learning for detecting and explaining unfairness in consumer contracts. JURIX 2019, FAIA 322:43–52. doi:10.3233/FAIA190305 | `lagioia2019deep` | ✅ |
| 7 | Grundler G, Liepina R, Musicco M, Lagioia F, Galassi A, Sartor G, Torroni P. Detecting vague clauses in privacy policies: the analysis of data categories using BERT models and LLMs. JURIX 2024:72–83. doi:10.3233/FAIA241235 | `grundler2024vague` | ✅ |
| 8 | Chalkidis I, Jana A, Hartung D, Bommarito M, Androutsopoulos I, Katz DM, Aletras N. LexGLUE: a benchmark dataset for legal language understanding in English. ACL 2022:4310–30. | `chalkidis2022lexglue` | ✅ |
| 9 | Braun D, Matthes F. AGB-DE: a corpus for the automated legal assessment of clauses in German consumer contracts. ACL 2024. doi:10.18653/v1/2024.acl-long.559 | `braun2024agbde` | ✅ |
| 10 | Löffler C, Martínez Freile A, Rey Pizarro T. Predicting potentially abusive clauses in Chilean terms of services with natural language processing. *AI & Law*. 2025. doi:10.1007/s10506-025-09462-w | `loffler2025chilean` | ✅ |
| 11 | Braun D, Matthes F. Clause topic classification in German and English standard form contracts. ECNLP 2022:199–209. doi:10.18653/v1/2022.ecnlp-1.23 | `braun2022topics` | ✅ |
| 12 | Panarelli M, Galassi A, Lagioia F, Liepina R, Lippi M, Pałka P, Sartor G. Is it worth using LLMs for unfair clause detection in terms of service? ICAIL 2025. doi:10.1145/3769126.3769218 | `panarelli2025worth` | ✅ (abstract ⚠) |
| 13 | Juttu NPP, Singireddy S, Gona S, Timilsina S. Text to Trust: evaluating fine-tuning and LoRA trade-offs in language models for unfair terms of service detection. arXiv:2510.22531; 2025. | `juttu2025texttotrust` | ✅ |
| 14 | Frasheri M, Bakhtiarnia A, Esterle L, Iosifidis A. Are LLM-based methods good enough for detecting unfair terms of service? arXiv:2409.00077; 2024. | `frasheri2024llm` | ✅ |
| 15 | Tuggener D, von Däniken P, Peetz T, Cieliebak M. LEDGAR: a large-scale multi-label corpus for text classification of legal provisions in contracts. LREC 2020:1235–41. | `tuggener2020ledgar` | ✅ |
| 16 | Hendrycks D, Burns C, Chen A, Ball S. CUAD: an expert-annotated NLP dataset for legal contract review. NeurIPS Datasets & Benchmarks 2021. | `hendrycks2021cuad` | ✅ |
| 17 | Wilson S, Schaub F, Dara AA, et al. The creation and analysis of a website privacy policy corpus. ACL 2016:1330–40. doi:10.18653/v1/P16-1126 | `wilson2016opp115` | ✅ |
| 18 | Singh A, Joshi A, Jiang J, Paik H. A survey of classification tasks and approaches for legal contracts. *Artif Intell Rev*. 2025;58:380. doi:10.1007/s10462-025-11359-8 | `singh2025survey` | ✅ |
| 19 | Demszky D, Movshovitz-Attias D, Ko J, Cowen A, Nemade G, Ravi S. GoEmotions: a dataset of fine-grained emotions. ACL 2020:4040–54. | `demszky2020goemotions` | ✅ |
| 20 | Aumiller D, Almasian S, Lackner S, Gertz M. Structural text segmentation of legal documents. ICAIL 2021:2–11. doi:10.1145/3462757.3466085 | `aumiller2021segmentation` | ✅ |
| 21 | Savelka J, Ashley KD. Segmenting U.S. court decisions into functional and issue specific parts. JURIX 2018, FAIA 313:111–20. | `savelka2018segmenting` | ✅ (⚠ DOI) |
| 22 | Bhattacharya P, Paul S, Ghosh K, Ghosh S, Wyner A. Identification of rhetorical roles of sentences in Indian legal judgments. JURIX 2019, FAIA 322:3–12. | `bhattacharya2019rhetorical` | ✅ (⚠ DOI) |
| 23 | Brugger T, Stürmer M, Niklaus J. MultiLegalSBD: a multilingual legal sentence boundary detection dataset. ICAIL 2023. arXiv:2305.01211 | `brugger2023multilegalsbd` | ⚠ lieu |
| 24 | Hearst MA. TextTiling: segmenting text into multi-paragraph subtopic passages. *Comput Linguist*. 1997;23(1):33–64. | `hearst1997texttiling` | ✅ |
| 25 | Beeferman D, Berger A, Lafferty J. Statistical models for text segmentation. *Mach Learn*. 1999;34(1–3):177–210. | `beeferman1999segmentation` | ✅ |
| 26 | Pevzner L, Hearst MA. A critique and improvement of an evaluation metric for text segmentation. *Comput Linguist*. 2002;28(1):19–36. | `pevzner2002windowdiff` | ✅ |
| 27 | Koshorek O, Cohen A, Mor N, Rotman M, Berant J. Text segmentation as a supervised learning task. NAACL 2018:469–73. | `koshorek2018segmentation` | ✅ |
| 28 | Krippendorff K. Content analysis: an introduction to its methodology. 4th ed. Sage; 2018. | `krippendorff2018content` | ✅ |
| 29 | Artstein R, Poesio M. Inter-coder agreement for computational linguistics. *Comput Linguist*. 2008;34(4):555–96. | `artstein2008intercoder` | ✅ |
| 30 | Passonneau RJ. Measuring agreement on set-valued items (MASI) for semantic and pragmatic annotation. LREC 2006. | `passonneau2006masi` | ✅ |
| 31 | Marchal M, Scholman M, Yung F, Demberg V. Establishing annotation quality in multi-label annotations. COLING 2022:3659–68. | `marchal2022multilabel` | ✅ |
| 32 | Gwet KL. Computing inter-rater reliability and its variance in the presence of high agreement. *Br J Math Stat Psychol*. 2008;61(1):29–48. | `gwet2008ac1` | ✅ |
| 33 | Bayerl PS, Paul KI. What determines inter-coder agreement in manual annotations? A meta-analytic investigation. *Comput Linguist*. 2011;37(4):699–725. doi:10.1162/COLI_a_00074 | `bayerl2011metaanalysis` | ✅ (PDF lu) |
| 34 | Braun D. I beg to differ: how disagreement is handled in the annotation of legal machine learning data sets. *AI & Law*. 2024;32:839–62. doi:10.1007/s10506-023-09369-4 | `braun2024differ` | ✅ |
| 35 | Plank B. The "problem" of human label variation: on ground truth in data, modeling and evaluation. EMNLP 2022:10671–82. | `plank2022variation` | ✅ |
| 36 | Uma AN, Fornaciari T, Hovy D, Paun S, Plank B, Poesio M. Learning from disagreement: a survey. *JAIR*. 2021;72:1385–470. | `uma2021disagreement` | ✅ |
| 37 | Nangia N, Bowman SR. Human vs. Muppet: a conservative estimate of human performance on the GLUE benchmark. ACL 2019:4566–75. | `nangia2019human` | ✅ |
| 38 | Thalken R, Stiglitz EH, Mimno D, Wilkens M. Modeling legal reasoning: LM annotation at the edge of human agreement. EMNLP 2023:9252–65. | `thalken2023legal` | ✅ |
| 39 | Gilardi F, Alizadeh M, Kubli M. ChatGPT outperforms crowd workers for text-annotation tasks. *PNAS*. 2023;120(30):e2305016120. | `gilardi2023chatgpt` | ✅ |
| 40 | Ziems C, Held W, Shaikh O, Chen J, Zhang Z, Yang D. Can large language models transform computational social science? *Comput Linguist*. 2024;50(1):237–91. | `ziems2024css` | ✅ |
| 41 | Savelka J, Ashley KD. The unreasonable effectiveness of large language models in zero-shot semantic annotation of legal texts. *Front Artif Intell*. 2023;6:1279794. | `savelka2023unreasonable` | ✅ |
| 42 | Schepers I, Bruijn M, Wieling M, Vols M. The price of automated case law annotation: comparing the cost and performance of GPT-4o and student annotators. *AI & Law*. 2025. doi:10.1007/s10506-025-09495-1 | `schepers2025price` | ✅ |
| 43 | Wang S, Pobbathi L, Chen H. LAMUS: a large-scale corpus for legal argument mining from U.S. caselaw using LLMs. arXiv:2603.08286; 2026. | `wang2026lamus` | ✅ (⚠ DOI revue du brouillon non confirmé) |
| 44 | Li M, Shi T, Ziems C, Kan MY, Chen NF, Liu Z, Yang D. CoAnnotating: uncertainty-guided work allocation between human and large language models for data annotation. EMNLP 2023:1487–505. | `li2023coannotating` | ✅ |
| 45 | Choi AS, Akter SS, Singh JP, Anastasopoulos A. The LLM effect: are humans truly using LLMs, or are they being influenced by them instead? EMNLP 2024:22032–54. | `choi2024llmeffect` | ✅ |
| 46 | Zheng L, Chiang WL, Sheng Y, et al. Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. NeurIPS 2023 (Datasets & Benchmarks). | `zheng2023judging` | ✅ |
| 47 | Bavaresco A, Bernardi R, Bertolazzi L, et al. LLMs instead of human judges? A large scale empirical study across 20 NLP evaluation tasks. ACL 2025 (short):238–55. | `bavaresco2025judges` | ✅ |
| 48 | Mukherjee S, Hamna H, Bali K, Sitaram S. The geometry of LLM-as-judge: why inter-LLM consensus is not human alignment. arXiv:2606.03043; 2026. | `mukherjee2026geometry` | ✅ (preprint) |
| 49 | Chalkidis I, Fergadiotis M, Malakasiotis P, Aletras N, Androutsopoulos I. LEGAL-BERT: the muppets straight out of law school. Findings of EMNLP 2020:2898–904. | `chalkidis2020legalbert` | ✅ |
| 50 | Jayakumar T, Farooqui F, Farooqui L. Large language models are legal but they are not: making the case for a powerful LegalLLM. NLLP 2023:223–9. | `jayakumar2023legal` | ✅ |
| 51 | Dominguez-Olmedo R, Nanda V, Abebe R, Bechtold S, Engel C, Frankenreiter J, Gummadi K, Hardt M, Livermore M. Lawma: the power of specialization for legal annotation. ICLR 2025. arXiv:2407.16615 | `dominguezolmedo2025lawma` | ✅ |
| 52 | Dechtiar M, Katz DM, Sundaresan M, Jaume S, Wang H. GRAPH-GRPO-LEX: contract graph modeling and reinforcement learning with group relative policy optimization. IEEE ICDMW 2025. arXiv:2511.06618 | `dechtiar2025graphgrpolex` | ✅ (⚠ DOI IEEE du brouillon) |
| 53 | Micklitz HW, Pałka P, Panagis Y. The empire strikes back: digital control of unfair terms of online services. *J Consum Policy*. 2017;40:367–88. | `micklitz2017empire` | ⚠ DOI |
| 54 | Stenetorp P, Pyysalo S, Topić G, Ohta T, Ananiadou S, Tsujii J. brat: a web-based tool for NLP-assisted text annotation. EACL 2012 (demos):102–7. | `stenetorp2012brat` | ✅ |
| 55 | Yimam SM, Gurevych I, Eckart de Castilho R, Biemann C. WebAnno: a flexible, web-based and visually supported system for distributed annotations. ACL 2013 (demos):1–6. | `yimam2013webanno` | ✅ |
| 56 | Klie JC, Bugert M, Boullosa B, Eckart de Castilho R, Gurevych I. The INCEpTION platform: machine-assisted and knowledge-oriented interactive annotation. COLING 2018 (system demonstrations):5–9. | `klie2018inception` | ✅ |
| 57 | Nakayama H, Kubo T, Kamura J, Taniguchi Y, Liang X. doccano: text annotation tool for human. 2018. Logiciel, https://github.com/doccano/doccano | `nakayama2018doccano` | ✅ |
| 58 | Pei J, Ananthasubramaniam A, Wang X, Zhou N, Sargent J, Dedeloudis A, Jurgens D. POTATO: the portable text annotation tool. EMNLP 2022 (system demonstrations). | `pei2022potato` | ✅ (⚠ pages) |
| 59 | Liepiņa R, Ruggeri F, Lagioia F, Lippi M, Drazewski K, Torroni P. Explaining potentially unfair clauses to the consumer with the CLAUDETTE tool. NLLP 2020, CEUR-WS vol. 2645. | `liepina2020claudettetool` | ✅ |

**Non retenues (vues)** : *Terminators* (arXiv 2505.11672, agents LLM) ; *Harmful Terms and Where to Find
Them* (arXiv 2502.01798, conditions financières) ; *Just Put a Human in the Loop?* (arXiv 2507.15821,
redondant avec [45]) ; ACORD (ACL 2025, recherche de clauses) et ContractEval (2025) — pertinents pour le
papier long (aval), pas pour le short.
