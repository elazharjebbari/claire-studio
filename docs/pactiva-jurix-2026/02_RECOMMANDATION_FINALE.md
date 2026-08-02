# Recommandation finale — quel article soumettre à JURIX 2026 ?

> Analyse comparative des 12 propositions du tableau
> ([`01_CONTEXTE_ET_PROPOSITIONS.md`](01_CONTEXTE_ET_PROPOSITIONS.md) §B) et recommandation motivée,
> avec plan d'article, plan d'expériences, stratégie de soumission et rétroplanning jusqu'au
> **5 septembre 2026**.

---

## 1. En une page

> ## 🏆 Recommandation
>
> **Soumettre un *long paper* qui fusionne le résultat négatif et sa réponse constructive :**
>
> ### *« Calibration Is Not Validity : Why LLM-Only Annotation of Unfair Terms-of-Service Clauses Fails at Scale, and a Human-in-the-Loop Gold Protocol »*
>
> Le papier **(a)** établit empiriquement le **« mur du κ »** (P1) — trois protocoles d'annotation
> entièrement LLM s'effondrent de κ≈0,80–0,86 en calibration à κ≈0,32–0,45 à l'échelle sur les 50 ToS
> de CLAUDETTE — avec son **diagnostic** (biais de granularité inter-modèle P2 + anatomie du désaccord
> P3 : **≈18 % d'ambiguïté juridique irréductible**), puis **(b)** en tire la **réponse** : un
> **enrichissement clause-level en collaboration LLM ↔ experts humains** (P5) gouverné par un
> **protocole GOLD où les LLM sont référence, jamais juges** (P6).
>
> **Et, en parallèle, un *short paper* de couverture** — **P2 (biais de granularité inter-modèle)** —
> pour maximiser la probabilité d'acceptation (le track *short* est nettement moins sélectif que le
> *long* à ~19–23 %).

**Pourquoi cette combinaison.** Elle **maximise le fit JURIX** (ancrage juridique + lignée CLAUDETTE +
κ + human-in-the-loop + LLM sous évaluation critique + reproductibilité), **de-risque la faisabilité**
(le cœur — le mur du κ — est **déjà expérimenté**), et **met en valeur l'objet même du travail du
porteur** (la campagne d'annotation Pactiva) comme la *réponse* scientifiquement justifiée au verrou.
C'est l'« angle gagnant » identifié par la calibration JURIX.

---

## 2. Méthode de comparaison

Chaque proposition a été notée sur 6 dimensions (0–5, total /30) : ancrage juridique/fit JURIX ⚑,
nouveauté, rigueur empirique atteignable ⚑, faisabilité d'ici sept. 2026, réception communauté,
impact/différenciation (grille en §B.1 du document 1). Deux dimensions sont **quasi-éliminatoires** à
JURIX : sans **ancrage juridique** et sans **rigueur empirique (κ + analyse d'erreurs)**, un papier est
renvoyé au poster ou refusé. La comparaison ci-dessous croise ce score avec **une lecture de
portefeuille** (que soumettre *ensemble* pour maximiser le rendement).

---

## 3. Analyse comparative

### 3.1 Le peloton de tête (P1, P5, P4, P2, P3 — 25–29/30)

Ces cinq propositions partagent un atout décisif : **le socle expérimental existe déjà** (sauf la part
« gold mûr » de P5). Elles se répartissent en deux rôles complémentaires :

- **Le résultat négatif et son diagnostic (P1, P2, P3, P4)** — c'est la **matière la plus solide et la
  plus originale**. P1 est le récit-cadre (29/30, le plus haut) ; P2, P3, P4 en sont les mécanismes
  (biais de granularité, anatomie du désaccord, rôle-vs-position). Pris séparément, P2/P3/P4 font
  d'excellents *short* ; **réunis sous P1, ils font un *long* dense et mémorable.**
- **La réponse constructive (P5, P6)** — c'est ce qui **transforme une critique en contribution
  positive** et qui **valorise le travail réel du porteur** (l'atelier Pactiva). Leur seule faiblesse
  est la **dépendance à la maturité du gold humain** : pour un κ crédible, il faut un sous-corpus
  **réellement multi-annoté et arbitré** d'ici la deadline.

**Décision de fond :** ne pas choisir *entre* les deux rôles, mais les **articuler**. Un reviewer
JURIX accueille bien mieux « voici pourquoi le LLM seul échoue **et** voici le dispositif humain que
nous en déduisons » qu'un pur réquisitoire (P1 seul, qui peut sembler « sans contribution positive »)
ou qu'une pure annonce de ressource (P5 seul, fragile si le gold n'est pas mesuré). D'où la
**fusion recommandée**.

### 3.2 Le milieu de tableau (P7, P8, P9, P10 — 21–22/30)

Solides mais **plus étroits** ou **moins « juridiques »** :
- **P7 (transfert FR↔EN)** est le plus prometteur du groupe (multilinguisme valorisé, traductions
  prêtes) mais doit **construire ses expériences** et **se différencier de Galassi 2024** ; excellent
  **candidat pour un second papier** ou une extension.
- **P8/P9** sont des **trouvailles empiriques** intrigantes mais à risque de perception « ML sans
  insight juridique » ; parfaites en **compléments** ou en *short* si fortement recadrées.
- **P10** (critique du ratio d'abusivité) est juridiquement pertinent mais de **portée limitée** →
  *short/poster*.

### 3.3 La queue (P11, P12 — 16–19/30)

- **P12 (Wayback / perte typographique)** : joli message de reproductibilité mais **niche** (17/50
  docs) et ancrage juridique indirect → *poster* ou workshop.
- **P11 (segmentation de clauses)** : **risque maximal de rejet à JURIX** (« pur NLP »). À **réorienter
  vers un workshop NLLP/CEUR**, pas vers le track principal.

### 3.4 Verdict comparatif

| Rang | Proposition | /30 | Rôle recommandé |
|---|---|:--:|---|
| 1 | **P1** Calibration ≠ validité | 29 | **Colonne vertébrale du *long* phare** |
| 2 | **P5** CLAUDETTE++ | 26 | **Réponse constructive du *long*** (selon maturité gold) |
| 3 | **P4 / P2 / P3** (ex æquo) | 25 | **Mécanismes intégrés au *long*** (P3, P4) / ***short* de couverture** (P2) |
| 6 | **P6** GOLD human-in-the-loop | 24 | Section « gouvernance » du *long* (ou repli *poster/démo*) |
| 7 | **P7** Transfert FR↔EN | 22 | **Second papier / extension future** |
| 8–10 | P8, P9, P10 | 21 | Compléments / *short* opportunistes |
| 11–12 | P12, P11 | 16–19 | Poster / **workshop** |

---

## 4. La recommandation détaillée

### 4.1 L'article phare (*long paper*, ≤10 p., track II — « NLP & ML for Law / datasets »)

**Titre (proposition, EN pour JURIX) :**
> **Calibration Is Not Validity: Why LLM-Only Annotation of Unfair Terms-of-Service Clauses Fails at
> Scale, and a Human-in-the-Loop Gold Protocol.**

**Résumé (ébauche d'abstract).**
> Les grands modèles de langage sont de plus en plus utilisés pour annoter des corpus juridiques.
> Nous montrons, sur les 50 conditions d'utilisation de CLAUDETTE/UNFAIR-ToS, que **trois protocoles
> d'annotation entièrement pilotés par LLM** — structurel, thématique et à la clause — atteignent un
> accord inter-juges élevé en calibration (κ de Cohen 0,80–0,86 sur 3–10 documents) mais
> **s'effondrent au passage à l'échelle** (κ 0,32–0,45 sur les 50 documents). Nous diagnostiquons
> trois causes : (1) un **biais de granularité inter-modèle** stable et mesurable ; (2) une
> décomposition de l'accord révélant que **≈72 % des désaccords sont des artefacts de méthode
> corrigeables** mais **≈18 % relèvent d'une ambiguïté juridique irréductible** ; (3) l'**instabilité
> de l'auto-correction LLM-only**. Nous en déduisons un **protocole d'annotation human-in-the-loop**
> qui **enrichit** CLAUDETTE au niveau de la clause (frontières, taxonomie thématique, nature
> juridique, certitude, justification) via une **collaboration LLM ↔ experts humains** où les LLM
> **pré-annotent et routent** tandis que les humains **valident et arbitrent** (les LLM restant
> **référence, jamais partie au conflit**). Nous rapportons l'accord inter-annotateur humain, une
> analyse d'erreurs et un volet multilingue (français). Nous publions le protocole et les artefacts.

**Contributions (à énoncer explicitement).**
1. **Un résultat négatif rigoureux** : la démonstration reproductible que *calibration ≠ validité* en
   annotation juridique par LLM (3 effondrements indépendants).
2. **Un diagnostic outillé** : biais de granularité inter-modèle + anatomie du désaccord séparant
   artefacts corrigeables et **ambiguïté juridique incompressible** (où l'humain est requis).
3. **Un protocole d'annotation human-in-the-loop** enrichissant CLAUDETTE à la clause, avec **LLM en
   référence non-décisionnaire** et **résolution GOLD inter-annotateurs**.
4. **Des artefacts** : protocole, schéma d'annotation (≈20 thèmes + natures juridiques), *data
   statement*, et — selon maturité — un **sous-corpus gold** enrichi (EN + FR).

**Plan (sections, calibré 10 pages).**
1. Introduction — les ToS, la dir. 93/13, la limite « phrase » de CLAUDETTE, la tentation du LLM.
2. Related work — **lignée CLAUDETTE** (Lippi 2019, Lagioia 2019, Ruggeri 2022, Galassi 2024, Grundler
   2024) ; LLM-as-annotator / as-judge ; human-in-the-loop ; mesures d'accord.
3. Le mur du κ — dispositif (2–3 juges LLM, 50 ToS), 3 protocoles, résultats calibration→échelle.
4. Diagnostic — biais de granularité ; décomposition frontières/étiquetage ; lignes de faille
   (refuge/segmentation/ambiguïté) ; instabilité de l'auto-correction.
5. Le protocole human-in-the-loop — enrichissement clause-level, collaboration LLM↔humain, GOLD,
   métriques (κ, α, F1), analyse d'erreurs, volet FR.
6. Discussion — implications pour l'annotation juridique par LLM ; limites ; éthique (protection des
   annotateurs, pas de score nominatif).
7. Conclusion & artefacts publiés.

**Ce qui le différencie de la lignée CLAUDETTE (à écrire noir sur blanc).**
- vs **Lippi 2019** : passage de la **phrase à la clause** + taxonomie thématique + certitude.
- vs **Ruggeri 2022** (mémoire de rationales) : les rationales sont ici **produites et validées par des
  humains**, pas apprises ; l'objet est le **protocole d'annotation/gold**, pas un classifieur.
- vs **Galassi 2024** (multilingue) : le multilinguisme est un **volet**, pas la thèse ; l'apport est
  **méthodologique** (validité de l'annotation LLM) + **ressource enrichie**.
- vs **Grundler 2024** / **ICAIL 2025** (BERT vs LLM pour la détection) : nous ne mesurons pas une
  **détection** mais la **validité de l'annotation LLM** et la **conception du gold**.

**Plan d'expériences (à finaliser d'ici la deadline).**
- **[Déjà fait]** Rejouer/mettre au propre les κ des 3 protocoles (calibration vs 50 docs), le biais de
  granularité, la décomposition de l'accord, l'anatomie du désaccord. *Ajout conseillé :* un **3ᵉ juge
  LLM** (Gemini/Mistral) pour étayer la généralité du biais.
- **[À produire — jalon critique]** Un **échantillon gold humain** multi-annoté et **arbitré** sur la
  plateforme : viser un sous-ensemble **représentatif et stratifié** (p. ex. 10–20 ToS × ≥2
  annotateurs) pour rapporter **κ humain, α MASI, F1 frontières/thème, taux d'adoption LLM**, plus une
  **analyse d'erreurs qualitative**. C'est ce qui fait passer P5 de « annoncé » à « mesuré ».
- **[Bonus]** Volet FR : accord EN vs FR sur un échantillon (exploite les traductions prêtes).

### 4.2 Arbre de décision selon la maturité du gold humain

Le seul vrai risque est la **maturité de l'annotation humaine** à la deadline. D'où deux scénarios :

- **Scénario A — le gold est mûr (≥10–20 ToS multi-annotés et arbitrés vers mi-août).**
  → **Fusion complète** : le *long* porte P1 (motivation) **+** P5/P6 (ressource + protocole
  **mesurés**). C'est la version la plus forte. On publie le sous-corpus enrichi comme artefact.

- **Scénario B — le gold n'est pas prêt.**
  → **Repli maîtrisé** : le *long* reste porté par **P1 + diagnostic (P2/P3/P4)**, **entièrement
  faisable dès aujourd'hui** (29/30), et présente l'enrichissement human-in-the-loop comme le
  **dispositif conçu et sa validation préliminaire** (protocole + petit échantillon), la ressource
  complète devenant un **papier de suivi** (JURIX 2027 / *AI & Law* / workshop NLLP). On **ne
  sur-revendique pas** un gold non mesuré (piège reviewer).

> **Recommandation opérationnelle :** viser le **Scénario A**, mais **écrire le papier de sorte que le
> Scénario B soit un repli sans réécriture** (le mur du κ est la colonne vertébrale dans les deux cas).

### 4.3 Le *short paper* de couverture (hedge)

Soumettre **en parallèle** un *short* (≤5 p.) issu du même socle, **sans cannibaliser** le *long* :
- **Premier choix : P2 — biais de granularité inter-modèle** (généralisable au LLM-as-judge, autonome,
  déjà expérimenté). Cadrer « pourquoi les panels de juges LLM sont structurellement biaisés ».
- **Alternative : P4 — annoter le rôle, pas la position** (angle XAI/auditabilité, track III).

Le *short* augmente nettement la probabilité d'avoir **au moins une présentation** à Toulouse (le track
*short/poster* absorbe une large part des acceptations).

---

## 5. Stratégie de soumission

| Élément | Décision |
|---|---|
| **Venue** | JURIX 2026, Toulouse (IRIT), 8–10 déc. 2026 |
| **Deadlines** | Abstract **~28 août** · Papier **~5 sept. 2026 (AoE)** — *à revérifier sur irit.fr/jurix2026* |
| **Soumission** | EasyChair · gabarit **IOS Press FAIA** · **single-blind (non anonymisé)** → citer Pactiva, mettre l'URL, pas d'anonymisation à gérer |
| **Papier 1** | *Long* ≤10 p. — **P1 + P5/P6** (track II) |
| **Papier 2 (hedge)** | *Short* ≤5 p. — **P2** (ou P4) |
| **Repli si *long* refusé** | Rétrograder P1 en *short* très solide ; P5/P6 en *poster/démo* |
| **Extensions futures** | **P7 (FR↔EN)** pour JURIX 2027 / *AI & Law* ; **P11 (segmentation)** pour un **workshop NLLP** |
| **Artefacts** | Publier protocole + *data statement* + (si prêt) sous-corpus enrichi (Zenodo/HF, licence claire) — coche « reproductibilité » |

---

## 6. Rétroplanning jusqu'au 5 septembre 2026

| Fenêtre | Livrable |
|---|---|
| **Début août** | Geler le périmètre du *long* (Scénario A vs B) ; figer le schéma d'annotation (**≈20 thèmes**) et les définitions dans le *data statement* ; consolider les notebooks du mur du κ (chiffres finaux vérifiés). |
| **1ʳᵉ quinzaine août** | **Jalon gold** : pousser l'annotation multi-annotateur + arbitrage sur l'échantillon stratifié ; calculer κ/α/F1 humains ; (bonus) ajouter un 3ᵉ juge LLM pour le biais de granularité. |
| **~15–22 août** | Rédiger le *long* (sections 1–5) ; rédiger le *short* P2 en parallèle. Analyse d'erreurs qualitative. |
| **~23–27 août** | Relecture interne (encadrant) ; vérifier **toutes les citations IA & Droit** ; soigner le « related work » (delta explicite vs Ruggeri/Galassi/Grundler). |
| **~28 août** | **Soumettre les abstracts** (long + short) sur EasyChair. |
| **28 août → 4 sept.** | Finaliser figures/tableaux, *data statement*, dépôt d'artefacts ; relecture langue (EN). |
| **~5 sept.** | **Soumission des papiers complets.** |

---

## 7. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Gold humain pas assez mûr** à la deadline | Moyenne | Élevé | Écrire le *long* sur la colonne P1 (repli Scénario B sans réécriture) ; échantillon stratifié plutôt que 50 docs complets. |
| **« Résultat négatif = pas de contribution »** (reviewer) | Moyenne | Moyen | Ancrer la **contribution positive** (protocole + diagnostic actionnable + artefacts) ; cadre « garde-fou méthodologique ». |
| **Perçu « trop ML »** (ancrage juridique jugé faible) | Faible-moy. | Élevé (⚑) | Centrer sur protection consommateur (dir. 93/13), dialoguer avec la lignée CLAUDETTE, mettre l'humain-expert au cœur. |
| **α/κ trompeurs sur classes déséquilibrées** | Moyenne | Moyen | Rapporter **plusieurs mesures** (Cohen κ, Krippendorff α, **Gwet AC2**, corrélations de rang) + supports + dispersion. |
| **Doublonnage perçu avec Galassi 2024** (si volet FR trop mis en avant) | Faible | Moyen | Garder le FR comme **volet**, pas comme thèse ; différencier par le **grain clause + certitude + gold**. |
| **Long refusé (track ~20 %)** | Réelle | Moyen | Le *short* P2 assure une présence ; repli poster pour P5/P6. |

---

## 8. Ce qu'il reste à décider (avec le porteur / l'encadrant)

1. **Scénario A ou B ?** → dépend d'un **état des lieux de la campagne d'annotation** (combien de ToS
   sont multi-annotés et arbitrés aujourd'hui, et le débit réaliste d'ici mi-août).
2. **Ajouter un 3ᵉ juge LLM** (Gemini/Mistral) pour muscler le biais de granularité (P2) ? Peu coûteux,
   fort rendement pour le *long* et le *short*.
3. **Un ou deux papiers ?** Recommandé : **deux** (long P1+P5/P6 **et** short P2), mais un seul *long*
   très soigné reste défendable si le temps manque.
4. **Publier le sous-corpus enrichi** dès JURIX (licence, DOI Zenodo/HF) ou le réserver au papier de
   suivi ? Le publier **maximise le score de reproductibilité**.
5. **Le fil « détection d'anomalies » (contrats FR, Faster R-CNN/ACCO)** est **hors périmètre JURIX** :
   plutôt un **workshop d'analyse de documents** (CIFED/GREC-DAS) — à ne pas mélanger.

---

## Note de fiabilité

Scores et recommandations reposent sur l'analyse du dossier de thèse (`CLAIRE/docs/personnal/`), de la
plateforme (ce dépôt) et d'une calibration JURIX (CFP 2026, proceedings, lignée CLAUDETTE). **Les
dates, quotas et citations JURIX/ICAIL/*AI & Law* sont à revérifier à la source avant soumission**, et
les **chiffres κ/F1** à reconfirmer dans les notebooks d'expériences. La décision finale
Scénario A/B dépend d'un **état réel de la campagne d'annotation** à établir avec le porteur.
