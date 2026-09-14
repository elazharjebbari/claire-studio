# Structure recommandée — short paper JURIX 2026

> Plan opérationnel issu des analyses de [`00_GUIDE_REDACTION.md`](00_GUIDE_REDACTION.md).
> Chaque bloc porte son budget, son contenu, ses chiffres exacts et la formulation à tenir.
> **Tous les chiffres viennent de la campagne validée** (16/16 expériences, dataset
> `7116e627f528c557`, GOLD figé 50/50).

**Structure retenue : E — hybride ressource + argument.** Cinq sections, deux tableaux,
aucune figure. Budget : **1 800 mots de corps** + ~300 équivalents de flottants
(mesuré : 2 100 mots = limite des 5 pages).

---

## Vue d'ensemble

| # | Section | Mots | Rôle |
|---|---|---|---|
| — | Titre · résumé · mots-clés | 170 | Annoncer ressource **et** thèse |
| 1 | Introduction | 380 | Le manque, la couche, la question, les contributions |
| 2 | Background and Related Work | 280 | Ce qui est établi / ce qui reste ouvert |
| 3 | The Thematic Layer and Its Construction | 400 | La ressource, sa production, ses mesures |
| 4 | Results | 450 | **Un** résultat démontré + deux rapportés (Tables 1–2) |
| 5 | Discussion and Limitations | 250 | Implications + limites en paragraphe dense |
| 6 | Conclusion and Availability | 150 | Bilan + artefacts publiés |
| | **Total corps** | **1 910** | marge à reprendre sur §1 et §5 si dépassement |

---

## Frontmatter

**Titre retenu**
> *A Thematic Layer for CLAUDETTE: Separating the Cost of Multi-Label Annotation from the
> Effect of Taxonomy Granularity*

**Running title** : `A Thematic Layer for CLAUDETTE`

**Résumé — 150 mots, une phrase par fonction :**

1. *Le manque.* CLAUDETTE étiquette l'abusivité phrase par phrase, mais ne dit rien du sujet
   de la clause.
2. *Ce que nous ajoutons, chiffré.* 50 contrats, 9 414 phrases, 20 thèmes juridiques
   multi-label, 3 annotateurs formés indépendants, 4 juges LLM sur les mêmes phrases.
3. *Le résultat démontré.* Le coût du format multi-label (0.073) est constant selon la
   granularité ; consolider de 20 à 11 classes en récupère l'essentiel (+0.067), et le gain
   réplique sur 17 documents de validation.
4. *La contrainte juridique.* À condition qu'aucune fusion ne traverse les strates
   d'abusivité — celle qui le fait perd 13.2 % de signal pour +0.012 d'accord.
5. *Ce qui est publié.* Annotations, votes individuels, codebook, protocole, plateforme.

> ⚠ **Supprimer « approaches the human ceiling »** du résumé actuel : l'écart est de
> 0.139 de κ (0.720 contre 0.859). Écrire *« outperforms every LLM judge while remaining
> below the human ceiling »*.

**Mots-clés** : `unfair terms of service` · `CLAUDETTE` · `multi-label annotation` ·
`inter-annotator agreement` · `LLM-as-a-judge` · `legal language models` · `annotation platform`

---

## 1. Introduction — 380 mots

**Mouvement 1 — le manque (2 phrases, ~60 mots).** Attaquer directement, sans entonnoir :
CLAUDETTE enregistre *si* une phrase est abusive, jamais *de quoi* la clause traite. Les
ressources à thèmes existantes sont mono-annotées, non publiées, ou sans coefficient corrigé
du hasard.

**Mouvement 2 — la couche (~90 mots).** Ce que nous ajoutons, avec les volumes :
50 ToS, 9 414 phrases, 20 thèmes, multi-label, 3 annotateurs **indépendants**, 4 juges LLM
sur le même vocabulaire et les mêmes phrases, votes individuels conservés.

**Mouvement 3 — la question et sa réponse (~120 mots).** L'annotation multi-label est-elle
moins fiable *par nature*, ou parce que la taxonomie est trop fine ? La littérature confond
les deux. La couche permet de les séparer : le coût du format vaut 0.073 et **ne varie pas**
avec la granularité, tandis que consolider 20 → 11 classes rend +0.067 — un gain qui réplique
sur une partition de validation jamais utilisée pour concevoir les fusions.

**Mouvement 4 — contributions explicites (~110 mots).** Trois puces, ou une phrase
« we contribute » :
1. **une ressource** — première couche thématique multi-label triplement annotée sur le
   corpus de référence, publiée avec ses désaccords ;
2. **une séparation de deux effets** que la littérature confond, avec réplication sur
   hold-out ;
3. **une contrainte juridique sur la consolidation** — ne pas traverser les strates
   d'abusivité — avec son prix mesuré.

> **Piège à éviter.** Ne pas annoncer ici les juges LLM ni le modèle fine-tuné comme
> contributions : ils sont *rapportés*, pas démontrés. Les mettre dans la liste ferait
> attendre au relecteur une démonstration qui ne viendra pas.

---

## 2. Background and Related Work — 280 mots

**Paragraphe A — ce que la littérature établit (~160 mots, ~20 références en grappes).**
Quatre grappes, une phrase chacune : détection automatique de clauses abusives dans les ToS ;
encodeurs juridiques compacts, supérieurs aux LLM généralistes sur la classification de
clauses ; LLM comme annotateurs sémantiques en droit, avec leur biais d'ancrage ; accord
inter-annotateur multi-label et effet du nombre de catégories.

**Paragraphe B — ce qu'elle laisse ouvert (~120 mots).** C'est l'énoncé du gap, à écrire
presque tel quel :

> *Existing work on Terms of Service labels whether a sentence is unfair, not what the
> clause is about; where clause topics exist, they are single-annotated, unpublished, or
> reported without chance-corrected agreement. Whether the granularity of the taxonomy —
> rather than the multi-label format itself — is what limits reliability therefore remains
> unanswered on the reference benchmark.*

> La dernière phrase renvoie à la question ouverte de Bayerl & Paul : **la citer nommément**,
> c'est ce qui transforme une mesure en réponse à la littérature (critère `originality`).

---

## 3. The Thematic Layer and Its Construction — 400 mots

Trois blocs, **sans sous-titres numérotés** (ils coûtent et fragmentent).

**Bloc 1 — la couche (~130 mots).** 50 ToS de CLAUDETTE ; 9 414 phrases ; 20 thèmes
juridiques ; multi-label (un primaire, zéro à *n* secondaires) ; 3 annotateurs formés ;
4 juges LLM sur les mêmes phrases et le même vocabulaire ; **votes individuels conservés**,
jamais réduits au consensus.

**Bloc 2 — la construction (~150 mots).** Pré-annotation LLM **post-éditée** — dire le fait
et sa limite dans la même phrase. Politique d'indépendance : un annotateur ne voit pas les
annotations de ses pairs. Résolution du gold par cascade : **46.8 %** accord unanime,
**48.3 %** majorité ≥ 2/3, **4.9 %** arbitrage humain (462 phrases) — cette dernière part
**est** la mesure de l'ambiguïté résiduelle, à présenter comme telle et non comme un coût.

> **Phrase à ne pas omettre** (elle coupe l'objection d'évaluation circulaire) :
> *« LLM outputs are never parties to the gold: resolution is strictly inter-annotator, and
> judges are held out as an object of evaluation. »*

**Bloc 3 — les mesures (~120 mots).** α de Krippendorff avec distance MASI *contre* α
nominal — **l'écart entre les deux est le coût du multi-label**, c'est l'idée centrale du
papier et elle doit être énoncée explicitement. Seuils de Passonneau (0.667 / 0.8). Bootstrap
**apparié par document** (les taxonomies sont des projections du même jeu : la comparaison est
appariée par construction). Partition **conception 33 / validation 17**, avec sa réserve : le
hold-out est aveugle à la structure des fusions, non aux supports ni aux strates. Plafond
humain en **leave-one-annotator-out**.

---

## 4. Results — 450 mots + Tables 1 et 2

### Table 1 — le résultat démontré

| Taxonomy | Classes | α-MASI | α nominal | Δ vs T20 [95 % CI] | Unfairness-signal loss |
|---|---|---|---|---|---|
| T20 | 20 | 0.658 | 0.732 | — | — |
| T14 | 14 | 0.693 | 0.768 | +0.035 [0.030, 0.042] | 6.4 % |
| **T11** | 11 | **0.725** | 0.794 | **+0.067 [0.058, 0.077]** | **5.9 %** |
| T10 | 10 | 0.737 | 0.800 | +0.078 [0.068, 0.090] | **13.2 %** |

*Légende (au-dessus du tableau)* : α-MASI et α nominal par taxonomie ; l'écart entre les deux
colonnes est le coût du format multi-label. Δ apparié par document, 50 contrats,
9 414 phrases. T10 traverse les strates d'abusivité ; T14 et T11 ne les traversent pas.
Seuil d'acceptabilité de Passonneau (0.667) : atteint par T14, T11 et T10, **pas par T20**.

> **Argument à exploiter — T11 domine T14 sur les deux axes.** T11 gagne davantage d'accord
> (+0.067 contre +0.035) **et** perd moins de signal d'abusivité (5.9 % contre 6.4 %). T11
> n'est donc pas un compromis entre fiabilité et signal : c'est un optimum au sens de la
> dominance parmi les candidats testés. C'est le fait le plus convaincant du tableau — il
> mérite une phrase explicite, car un lecteur pressé lira « plus grossier = plus fiable mais
> moins informatif » et manquera la dominance.

### Table 2 — les résultats rapportés

| System | Reference | κ | Note |
|---|---|---|---|
| Human annotators (LOAO) | gold | **0.859** | plafond humain |
| Best LLM judge | gold | 0.581 | pré-annotations figées |
| Legal-BERT fine-tuned (T20) | gold | 0.695 | — |
| Legal-BERT fine-tuned (T11) | gold | **0.720** | — |

*Une seule référence de comparaison — le gold figé — pour les trois systèmes.*

### Les trois mouvements du texte

**(a) Le coût du format — la prémisse (~110 mots).** α-MASI 0.658 contre α nominal 0.732 :
le coût du multi-label vaut **0.073 [0.061, 0.087]**, et il est **constant** sur les quatre
taxonomies. Cette constance est ce qui autorise à traiter les deux effets séparément.

**(b) L'effet de granularité — le résultat démontré (~180 mots).** T11 gagne
**+0.067 [0.058, 0.077]** d'α-MASI sur T20 et franchit le seuil d'acceptabilité de Passonneau
(0.725 > 0.667) que T20 n'atteint pas — et il **domine T14** sur les deux axes à la fois
(plus d'accord gagné, moins de signal perdu), ce qui écarte la lecture en simple compromis.
Donner ici le protocole **complet** : delta apparié par document, bootstrap, et surtout la
**réplication sur les 17 documents de validation** (+0.069 contre +0.066 sur les 33 de
conception) — jamais utilisés pour concevoir les fusions. Terminer par ce que le résultat
**ne** tranche pas : le gain d'accord ne dit rien de la justesse juridique des catégories
fusionnées.

**(c) La contrainte juridique — ce qui rend le résultat juridique (~120 mots).** T10 gagne
+0.012 d'α de plus que T11, mais perd **13.2 %** de signal d'abusivité contre 5.9 %
(rendement 0.59 contre 1.13). Une consolidation purement statistique choisirait T10 ;
la contrainte de strates l'interdit. **Ne pas couper ce mouvement** : c'est lui qui distingue
l'article d'un exercice de statistique appliquée.

**(d) Les résultats rapportés (~40 mots, 3 phrases).** Plafond humain LOAO κ **0.859** ;
meilleur juge LLM κ **0.581** ; Legal-BERT fine-tuné κ **0.720** — au-dessus de tous les
juges, **sous** le plafond humain. Verbe : *we report*, pas *we show*.

---

## 5. Discussion and Limitations — 250 mots

**Implications (~150 mots), deux points seulement :**

1. **Pour la pratique d'annotation.** Le coût du multi-label ne se récupère pas en renonçant
   au multi-label : il se récupère en consolidant la taxonomie — à condition de le faire
   selon une contrainte externe au signal d'accord. Une fusion guidée par les seules grappes
   de confusion viole systématiquement les strates d'abusivité.
2. **Pour l'évaluation des juges LLM.** L'écart au plafond humain (0.859 contre 0.581) montre
   que les juges ne sont pas substituables aux annotateurs sur cette tâche ; un encodeur
   juridique compact fine-tuné les dépasse tous, à une fraction du coût.

**Paragraphe « Limitations » (~100 mots, non numéroté, une proposition par limite) :**

- pré-annotations **post-éditées** ; la divergence annotateur–juge (38.5–48.6 %) borne
  l'ancrage sans l'éliminer ;
- un seul système juridique, une seule langue ;
- pré-annotations LLM **figées** : le benchmark mesure une sortie historique, pas l'état de
  l'art courant ;
- un seul encodeur, arrêt précoce sur le pli de test — performance légèrement optimiste ;
- le jeu **agrégé** ne porte que **1.04 étiquette par phrase** : un score multi-label calculé
  dessus ne mesure pas la difficulté de la tâche telle qu'annotée.

---

## 6. Conclusion and Availability — 150 mots

**Deux phrases de bilan (~60 mots).** Ce que la couche établit, et ce qu'elle permet
désormais : évaluer des juges contre un plafond humain, mesurer l'effet d'une consolidation
sans confondre format et granularité.

**Disponibilité (~90 mots).** Annotations (votes individuels **et** gold figé), codebook,
protocole, plateforme d'annotation ouverte, instance de démonstration.

> ⚠ **Point ouvert à arbitrer avant envoi** : dépôt public, DOI et licence ne sont pas fixés,
> et la licence de CLAUDETTE doit être instruite. Repli acceptable :
> *« The layer, codebook, protocol and platform will be released under an open licence upon
> publication. »* Une promesse datée vaut mieux qu'une URL morte.

---

## Chiffres — source unique

Tous vérifiés dans la campagne validée. **À injecter via les macros `\newcommand` exportées
par la vue « Résultats expérimentaux », jamais saisis à la main.**

| Grandeur | Valeur | Origine |
|---|---|---|
| Contrats / phrases | 50 / 9 414 | dataset `7116e627f528c557` |
| α-MASI T20 / α nominal T20 | 0.658 / 0.732 | E1.1 |
| Coût du multi-label | 0.073 [0.061, 0.087] | E1.1 |
| α-MASI T14 / T11 / T10 | 0.693 / 0.725 / 0.737 | E2.1 |
| Δ T14 / T11 / T10 vs T20 | +0.035 / +0.067 / +0.078 | E2.1 |
| Perte de signal T14 | 6.4 % | E2.1 (AP 0.3914 vs 0.418) |
| Δ T11 — conception / validation | +0.066 / +0.069 | E2.2 |
| Perte de signal T11 / T10 | 5.9 % / 13.2 % | E2.3 |
| Rendement T11 / T10 | 1.13 / 0.59 | E2.3 |
| Cascade : unanime / majorité / arbitrage | 46.8 % / 48.3 % / 4.9 % | E1.4 |
| Plafond humain LOAO (κ / exactitude) | 0.859 / 0.871 | E1.5 |
| κ humain↔humain | 0.679–0.795 | E3.1 |
| κ humain↔LLM (max) | 0.594 | E3.1 |
| Meilleur juge vs gold (κ / exactitude) | 0.581 / 0.601 | E3.3 |
| Divergence au pré-remplissage | 38.5–48.6 % | E3.2 |
| Legal-BERT T20 (macro-F1 / κ) | 0.613 / 0.695 | E4.4 |
| Legal-BERT T11 (macro-F1 / κ) | 0.735 / 0.720 | E4.4 |
| Étiquettes par phrase (T11, agrégé) | 1.04 | E4.5 |

---

## Ordre de rédaction conseillé

Écrire dans l'ordre où les décisions se verrouillent, pas dans l'ordre de lecture :

1. **Tables 1 et 2** — elles fixent les chiffres et donc le texte des résultats.
2. **§4 Results** — le cœur ; si le budget explose, c'est ici qu'on le voit.
3. **§3 The Thematic Layer** — le protocole découle de ce qu'on a dû expliquer en §4.
4. **§1 Introduction** — s'écrit bien une fois les résultats posés.
5. **§5 Discussion** et **§6 Conclusion**.
6. **§2 Background** — en dernier : c'est la section dont le volume s'ajuste le plus
   facilement à la place restante.
7. **Résumé** — tout à la fin, comme condensé de ce qui est réellement écrit.
8. `bash tools/check_pages.sh`, puis coupes dans §1 et §5 en priorité.
