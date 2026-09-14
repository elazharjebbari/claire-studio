# Guide de rédaction — short paper JURIX 2026

> **Document de méthode.** Il ne rédige pas l'article : il fixe les contraintes réelles,
> établit le budget mesuré, compare les structures possibles et recommande, section par
> section, une manière d'écrire. La structure retenue est reprise seule, prête à l'emploi,
> dans [`01_STRUCTURE_RECOMMANDEE.md`](01_STRUCTURE_RECOMMANDEE.md).

---

## ⚠ Avertissement de calendrier — à lire avant tout le reste

| Jalon | Date officielle | Statut au 14 septembre 2026, 02 h 45 (Paris) |
|---|---|---|
| Soumission | **13 septembre 2026 (AoE)** — repoussée du 5 | **≈ 9 h restantes** (AoE = UTC−12 : la limite tombe le 14 septembre à 11 h 59 UTC) |
| Notification | 8 octobre 2026 | — |
| Camera-ready | 15 octobre 2026 | — |
| Conférence | 9–10 décembre 2026, Toulouse | — |

Source : <https://www.irit.fr/jurix2026/important-dates/> (consulté le 14 septembre 2026).

**Ce que cela change pour ce guide.** Un guide de rédaction « idéal » suppose des jours de
réécriture. Il en reste quelques heures. Toutes les recommandations qui suivent sont donc
doublement filtrées : par ce qui fait un bon article, et par ce qui est **écrivable en une
seule passe sans réécriture structurelle**. Les options élégantes mais coûteuses sont
signalées comme telles et écartées, avec leur raison.

Si la soumission vise en réalité une autre échéance (JURIX 2027, un atelier, une revue), le
filtre temporel saute et plusieurs arbitrages de ce document changent — ils sont marqués
**[arbitrage lié au délai]** pour être révisés facilement.

---

## 1. Les contraintes officielles, et ce qu'elles imposent vraiment

| Contrainte | Énoncé officiel | Conséquence rédactionnelle |
|---|---|---|
| Longueur | *« Short papers should not exceed 5 pages (excluding acknowledgements and references) »* | Le budget est en **pages composées**, pas en mots : un tableau mal calibré coûte autant qu'un paragraphe |
| Nature | *« descriptions of preliminary results or an innovative idea »* | **Décisif** — voir §2 |
| Format | IOS Press *Book Article* (classe v1.20) | Times 10 pt, légendes de tableau **au-dessus**, de figure **en dessous**, références Vancouver numériques |
| Relecture | **single-blind** | Les noms restent ; on peut écrire « our platform », citer ses propres travaux au style normal, et nommer l'instance publique |
| Dépôt | EasyChair `jurix2026` | — |
| Éthique | politiques Sage, **y compris IA** | Une phrase de déclaration d'usage d'outils est attendue si des outils génératifs ont servi à rédiger |

Sources : [call for papers](https://www.irit.fr/jurix2026/call-for-papers/), [instructions IOS Press](https://www.iospress.com/book-article-instructions).

### 1.1 Les critères de notation, et où se gagnent les points

JURIX annonce noter : *relevance, originality, technical quality, significance, literature
review, presentation, reviewer's confidence, overall evaluation*.

Deux d'entre eux sont sous-estimés par les auteurs et décident pourtant beaucoup :

- **`reviewer's confidence`** — un relecteur qui n'est pas sûr de comprendre note bas *et*
  se déclare peu confiant, ce qui affaiblit sa défense du papier en discussion. Tout ce qui
  réduit l'effort de lecture (une seule référence de comparaison, une notation constante,
  des tableaux auto-suffisants) achète directement ce critère.
- **`literature review`** — sur 5 pages, la tentation est de sabrer l'état de l'art. C'est
  un critère noté séparément : il faut **peu de lignes mais beaucoup de références**, ce
  qui impose une écriture par grappes (« X [1–4] ») plutôt que par phrases-par-référence.

---

## 2. Ce qu'est un short paper JURIX — et ce que ce n'est pas

> *« Short papers: descriptions of preliminary results or an innovative idea. »*

C'est la phrase la plus importante de tout ce document. Elle dit qu'un short paper JURIX
n'est **pas** un long paper comprimé, et cela a trois conséquences fortes.

**(a) Un résultat partiel bien mesuré vaut mieux qu'un panorama complet.** Comprimer sept
résultats en cinq pages produit un texte où chacun tient en deux phrases sans protocole ni
incertitude — le lecteur ne peut rien vérifier, et `technical quality` s'effondre. La
littérature sur l'évaluation par les pairs est constante là-dessus : le défaut le plus
fréquemment reproché aux short papers est la sur-compression, pas le manque d'ambition.

**(b) « Preliminary » n'est pas un aveu de faiblesse, c'est un genre.** Déclarer qu'un
résultat appelle une confirmation est ici conforme au format, et protège contre le reproche
de sur-revendication. La formulation gagnante est *« we report a first measurement of X;
the effect replicates on a held-out partition, and we defer Y to future work »* — pas
*« we solve X »*.

**(c) La ressource est un genre reconnu chez JURIX.** Un short paper qui **publie une
ressource** (annotations, codebook, protocole, outil) coche `relevance` et `significance`
sans avoir à démontrer un gain de performance. C'est notre cas, et cela oriente la structure.

---

## 3. Le budget de pages — mesuré, pas estimé

La limite est en pages composées ; la compter en mots exige un calibrage. Je l'ai fait **en
compilant la classe officielle** (`IOS-Book-Article.cls` v1.20, `mathptmx`, frontmatter
réaliste : titre long, trois auteurs, résumé de ~150 mots, trois mots-clés).

| Mots de corps | Pages obtenues |
|---|---|
| 1 556 | 4 |
| 1 800 | **5** |
| 2 070 | **5** |
| 2 248 | 6 |
| 2 456 | 6 |
| 3 074 | 7 |

**Budget retenu : ~2 100 mots de corps** pour tenir en 5 pages, *avant* de réserver la place
des flottants. En pratique :

| Poste | Coût en « équivalent mots » | Remarque |
|---|---|---|
| Page pleine de texte | ≈ 450–500 mots | mesuré |
| Tableau compact (6–8 lignes, `booktabs`) | ≈ 120–150 | légende comprise |
| Tableau dense (12 lignes, 6 colonnes) | ≈ 250–300 | à éviter sur 5 pages |
| Figure demi-colonne | ≈ 250 | |
| Titre de section | ≈ 15 | |

**Budget opérationnel recommandé** (2 tableaux compacts, aucune figure) :

> corps rédigé ≈ **1 800 mots**, flottants ≈ 300 équivalents, marge de sécurité ≈ 100.

Vérification avant envoi : `tools/check_pages.sh` lit le `\label{end:body}` déjà posé dans
`main.tex` et donne la dernière page du corps, références exclues. **Le lancer avant toute
réécriture de confort** : sur 5 pages, chaque phrase ajoutée en pousse une autre dehors.

---

## 4. Écrire : le mot juste, l'enchaînement, la mesure

Cette section est la partie « style » demandée. Elle est prescriptive à dessein : sur un
format court, les choix d'écriture ne sont pas des préférences, ils décident de la place.

### 4.1 Les temps et les personnes

| Contexte | Temps | Exemple |
|---|---|---|
| Ce que fait l'article | présent | *« We add a thematic layer to the 50 contracts. »* |
| Ce qui a été exécuté | passé | *« Three annotators labelled each sentence independently. »* |
| Ce que montre un résultat (fait établi) | présent | *« Agreement drops by 0.073 under multi-label scoring. »* |
| Ce que dit la littérature | présent | *« Bayerl and Paul report that… »* |
| Limites et suites | présent / futur modal | *« This remains to be confirmed on a second legal system. »* |

**`we` est correct et recommandé** en relecture single-blind. Le passif systématique
(*« it was observed that »*) allonge et affaiblit : il coûte des mots qu'on n'a pas.

### 4.2 Le mot juste — un lexique de la mesure

Les mots ci-dessous ne sont pas interchangeables. Les confondre est le premier signal d'un
papier faible pour un relecteur méthodologiquement attentif.

| Écrire | Ne pas écrire | Pourquoi |
|---|---|---|
| *agreement*, *reliability* | *accuracy* (entre annotateurs) | l'accord n'est pas une exactitude : il n'y a pas de vérité de référence |
| *chance-corrected agreement* | *agreement* seul, quand on rapporte α ou κ | la correction du hasard est l'information |
| *human ceiling* / *human reference* | *ground truth* (pour les humains) | un plafond est une performance, pas une vérité |
| *consolidating / merging the taxonomy* | *simplifying*, *reducing* | « simplifier » suggère une perte d'information juridique |
| *judges*, *LLM judges* | *annotators* (pour les LLM) | garder humain et machine lexicalement séparés est un argument en soi |
| *pre-annotation, post-edited* | *assisted annotation* | la post-édition est le fait exact, et la limite |
| *does not replicate* / *we do not observe* | *fails*, *proves* | *prove* est faux en sciences empiriques |
| *associated with*, *consistent with* | *causes*, *explains* | sans dispositif causal |
| *we report*, *we measure* | *we demonstrate*, *we show that X is true* | calibrage de la revendication |

**Verbes de contribution, par force décroissante** — choisir consciemment :
*establish* > *measure*, *quantify* > *report*, *document* > *suggest*, *indicate*.
Un short paper « preliminary results » vit surtout dans la bande *measure / quantify / report*.

### 4.3 Chiffres : une seule convention, tenue jusqu'au bout

- **Trois décimales** pour α, κ, F1 (`0.725`), **jamais** de zéro initial omis.
- Toujours l'**intervalle de confiance** au premier énoncé d'un résultat principal :
  `+0.067 [0.058, 0.077]`. Un delta sans IC est invérifiable — c'est le reproche le plus
  facile à formuler contre un papier de mesure.
- **Séparateur décimal anglais** (point) dans le texte anglais, y compris dans les tableaux.
- Un chiffre qui apparaît dans le texte **et** dans un tableau doit être identique au
  dernier chiffre près. Dans notre cas, la campagne exporte des macros LaTeX (`\newcommand`)
  précisément pour rendre cette faute impossible : **s'en servir**.
- Les effectifs en toutes lettres jusqu'à dix hors contexte technique (*« three annotators »*),
  en chiffres au-delà (*« 9,414 sentences »*).

### 4.4 Enchaînement : la règle de l'information connue d'abord

Chaque phrase commence par ce que le lecteur sait déjà et finit par l'information neuve ;
la phrase suivante reprend cette information neuve comme point de départ. C'est ce qui
produit la sensation de « ça coule », sans aucun connecteur.

> *Agreement drops by 0.073 when secondary themes are scored. **This drop** is constant
> across the four taxonomies. **That constancy** separates two effects the literature
> conflates: the cost of the multi-label format, and the effect of granularity.*

**Corollaire pour les connecteurs** : `however`, `moreover`, `furthermore` sont presque
toujours le symptôme d'un enchaînement manqué — et coûtent des mots. Les garder pour les
vraies ruptures logiques.

### 4.5 Présenter un résultat : le triplet obligatoire

Tout résultat principal s'énonce en **trois temps, dans cet ordre**, en une à trois phrases :

1. **Le fait chiffré, avec son incertitude** — *« T11 raises α-MASI by 0.067 [0.058, 0.077]. »*
2. **Ce qu'il tranche** — *« The gain therefore exceeds the multi-label penalty of 0.073… »*
3. **Ce qu'il ne tranche pas** — *« …though macro-F1 across 20 and 11 classes is not the
   same quantity, so the comparison is one of learnability, not of performance. »*

Le temps 3 est ce qui distingue un papier de mesure crédible d'un papier promotionnel. Il
coûte une proposition subordonnée et rapporte sur `technical quality`.

### 4.6 Tableaux et figures : autonomes ou inutiles

- Un tableau doit se lire **sans le corps du texte** : légende explicite, unités, taille de
  l'échantillon, ce qui est comparé à quoi.
- **Une seule référence de comparaison** dans tout l'article (ici : le plafond humain). Un
  papier qui compare tantôt au consensus, tantôt au gold, tantôt entre modèles perd le
  lecteur et son `confidence`.
- Renvois par `Table~1` / `Figure~1`, **jamais** « the table above » (la classe déplace les
  flottants).
- **[arbitrage lié au délai]** Sur 5 pages et en quelques heures : deux tableaux, zéro
  figure. Une figure demande un rendu, un calibrage de police et une relecture visuelle —
  coût élevé, gain faible quand les résultats sont des scalaires avec IC.

### 4.7 Ce qu'il faut dire de soi — la déclaration de limites

Un short paper **doit** déclarer ses limites, et c'est un gain, pas une concession : les
limites déclarées désarment les objections que le relecteur formulerait sinon lui-même.
Formuler chaque limite en **une proposition** — pas un paragraphe d'excuses :

> *« Pre-annotations were post-edited rather than produced from scratch; annotator–judge
> divergence (38.5–48.6 %) bounds, but does not eliminate, the anchoring risk. »*

---

## 5. Analyse comparative des structures possibles

Cinq structures sont crédibles pour ce matériau. Chacune est évaluée sur les critères de
notation JURIX, sur la tenue dans 5 pages, et sur le coût de rédaction **dans le temps
restant**.

### Structure A — IMRaD classique (celle du gabarit actuel)

`Introduction · Background & Related Work · Data and Method · Results · Discussion · Conclusion`

| | |
|---|---|
| **Forces** | Attendue par tout relecteur ; aucune charge cognitive ; le gabarit est déjà découpé ainsi (six `\input` prêts) ; `presentation` acquis d'office |
| **Faiblesses** | Six titres de section coûtent ~90 mots de pur appareil ; `Discussion` et `Conclusion` se recouvrent inévitablement sur 5 pages ; la méthode prend structurellement trop de place pour un short |
| **Pertinence** | Élevée, mais c'est la structure d'un **long paper**. Appliquée à 5 pages, elle produit mécaniquement des sections de 300 mots où rien n'est développé |
| **Coût** | **Nul** (déjà en place) |

### Structure B — Ressource d'abord

`Introduction · The Thematic Layer (ressource : corpus, protocole, codebook, artefacts) · What the Layer Measures (résultats) · Limitations and Availability`

| | |
|---|---|
| **Forces** | Épouse la nature réelle de la contribution (une ressource publiée) ; `relevance` et `significance` immédiats ; quatre sections seulement ; met en avant l'artefact, ce que JURIX valorise |
| **Faiblesses** | Risque d'être lu comme un *data paper* sans résultat ; l'état de l'art n'a pas de section propre → `literature review` en danger ; le lecteur cherchant « la contribution scientifique » doit attendre la page 3 |
| **Pertinence** | Forte **si** l'état de l'art est absorbé dans l'introduction sans perdre les références |
| **Coût** | Moyen — réécriture du découpage, mais le contenu existe |

### Structure C — Par question de recherche

`Introduction · Method · RQ1 Reliability · RQ2 Granularity · RQ3 Judges · Discussion`

| | |
|---|---|
| **Forces** | Chaque résultat porte sa question, donc son protocole et son incertitude ; excellente `technical quality` ; correspond exactement à l'organisation de notre campagne (RQ1–RQ4) |
| **Faiblesses** | Trois sections de résultats sur 5 pages = ~350 mots chacune, protocole compris : intenable ; répétition du même appareil trois fois ; fragmente le fil narratif |
| **Pertinence** | C'est la structure du **papier long**, pas du court |
| **Coût** | Élevé |

### Structure D — Argument unique (« one-claim paper »)

`Introduction · Background · Data and Method · Results (un seul résultat, complet) · Discussion & Limitations`

Le papier ne défend qu'**une** thèse — par exemple : *le coût du multi-label et l'effet de
granularité sont deux effets distincts, et la consolidation doit respecter les strates
d'abusivité* — le reste devenant contexte ou travaux futurs.

| | |
|---|---|
| **Forces** | La forme la plus adaptée au genre « preliminary results » ; place pour un protocole complet, des IC, un hold-out et des limites ; `technical quality` maximale ; mémorable |
| **Faiblesses** | **Sacrifie** la ressource, le plafond humain et le benchmark des juges — c'est-à-dire la majeure partie du travail réellement accompli ; un relecteur connaissant CLAUDETTE peut trouver la contribution étroite |
| **Pertinence** | Excellente sur le plan rhétorique, coûteuse sur le plan stratégique : nous n'aurons pas deux occasions de publier la ressource |
| **Coût** | Moyen |

### Structure E — Hybride ressource + argument (contribution annoncée, résultat démontré)

`Introduction (avec contributions explicites) · Background and Related Work · The Thematic Layer and Its Construction · Results · Discussion and Limitations · Conclusion & Availability`

La ressource est **annoncée et décrite** (elle vaut pour elle-même) ; **un** résultat est
démontré complètement (protocole, IC, hold-out) ; les autres sont donnés en une ligne
chacun dans un tableau de synthèse, sans prétendre les démontrer.

| | |
|---|---|
| **Forces** | Ne sacrifie ni la ressource ni la rigueur ; le tableau de synthèse donne la richesse sans coûter la place d'une démonstration ; l'état de l'art garde sa section (`literature review`) ; s'écrit **directement dans le gabarit existant** en fusionnant deux sections |
| **Faiblesses** | Demande une discipline stricte : la tentation de démontrer un deuxième résultat fera exploser les 5 pages ; le tableau de synthèse doit être irréprochable, car il porte des chiffres non démontrés dans le texte |
| **Pertinence** | Élevée : c'est la seule structure qui rende compte de ce que le travail **est** (une ressource mesurée) sans renoncer à ce qui le rend **publiable** (un résultat net) |
| **Coût** | **Faible** — le gabarit s'y ramène en supprimant un `\input` |

### 5.1 Comparaison synthétique

| Critère (poids JURIX) | A · IMRaD | B · Ressource | C · Par RQ | D · Argument | E · Hybride |
|---|---|---|---|---|---|
| Relevance | ●●● | ●●●● | ●●● | ●●● | ●●●● |
| Originality | ●● | ●●● | ●●● | ●●●● | ●●●● |
| Technical quality | ●● | ●● | ●●●● | ●●●●● | ●●●● |
| Significance | ●●● | ●●●● | ●●● | ●●● | ●●●● |
| Literature review | ●●● | ● | ●● | ●●● | ●●●● |
| Presentation | ●●●● | ●●● | ●● | ●●●● | ●●●● |
| Reviewer's confidence | ●●● | ●● | ●● | ●●●●● | ●●●● |
| **Tenue en 5 pages** | ✗ | ○ | ✗✗ | ✓✓ | ✓ |
| **Coût dans le délai** | nul | moyen | élevé | moyen | **faible** |

### 5.2 Recommandation argumentée — **Structure E**

Trois raisons, par ordre de poids.

**1. Elle correspond à ce que le travail est réellement.** La contribution centrale n'est
pas un gain de performance : c'est une **couche thématique triplement annotée sur le corpus
de référence**, avec sa mesure de fiabilité et son outil. La structure D, la plus élégante,
obligerait à taire cela ; or une ressource ne se publie qu'une fois, et la taire ici la
condamne à n'exister que dans le papier long.

**2. Elle protège le seul critère que la compression détruit.** Sur 5 pages, ce qui saute
en premier est l'incertitude : IC, hold-out, limites. La structure E n'en démontre qu'un
seul résultat, mais **complètement** — protocole, IC bootstrap par document, réplication sur
les 17 documents de validation. Les autres résultats sont **rapportés** dans un tableau,
avec le mot juste (*we report*), sans prétendre les démontrer. C'est honnête et c'est
exactement ce que la catégorie « preliminary results » autorise.

**3. Elle est écrivable dans le temps restant.** Le gabarit est déjà découpé en six
sections ; E se obtient en fusionnant `Discussion` et `Conclusion` et en réorientant
`Data and Method` vers « la couche et sa construction ». Aucune réécriture structurelle,
aucun nouveau flottant à produire.

**Le résultat à démontrer complètement — recommandation.** Parmi les candidats :

| Candidat | Force de la démonstration | Risque |
|---|---|---|
| Coût du multi-label **vs** effet de granularité (E1.1 + E2.1 + E2.2) | Répond directement à une question ouverte de la littérature (Bayerl & Paul) ; delta apparié, IC, **réplication sur hold-out** | Aucun majeur — c'est le mieux étayé |
| Plafond humain vs juges LLM (E1.5 + E3.3) | Spectaculaire (κ 0.859 contre 0.581) | Repose sur des pré-annotations figées : « mesure une sortie historique » |
| Legal-BERT bat tous les juges (E4.4) | Net (κ 0.720 contre 0.581) | Un seul encodeur, arrêt précoce sur le pli de test — limite déclarée |

→ **Démontrer la séparation des deux effets** (ligne 1), et **rapporter** les deux autres
dans le tableau de synthèse. C'est le résultat dont l'incertitude est la mieux maîtrisée et
le seul qui réponde à une question explicitement laissée ouverte par la littérature — ce qui
achète `originality` sans sur-revendication.

---

## 6. Section par section : trois manières d'écrire, et celle qu'on retient

Pour chaque section de la structure E : trois options réelles, leur comparaison, la
recommandation. Les budgets en mots sont fermes — leur somme est 1 800.

---

### 6.1 Titre, résumé, mots-clés (frontmatter — ~170 mots)

Le titre actuel — *« A Thematic Layer for CLAUDETTE: Multi-Label Theme Annotation of Online
Terms of Service by Trained Annotators and LLM Judges »* — fait 18 mots.

**Option 1 — Titre-ressource (l'actuel).** Annonce l'artefact et sa méthode.
*Force* : informatif, trouvable, honnête sur la nature du travail. *Faiblesse* : long, et
« by Trained Annotators and LLM Judges » décrit le procédé, pas le résultat.

**Option 2 — Titre-résultat.** *« Multi-Label Format or Taxonomy Granularity? Separating Two
Effects on Annotation Reliability in Terms of Service »*.
*Force* : annonce la thèse, aligné sur la structure E ; accroche le lecteur méthodologique.
*Faiblesse* : **efface la ressource** du titre, donc de l'indexation — un chercheur cherchant
une couche thématique sur CLAUDETTE ne trouvera pas l'article.

**Option 3 — Titre mixte, deux-points.** *« A Thematic Layer for CLAUDETTE: Separating the
Cost of Multi-Label Annotation from the Effect of Taxonomy Granularity »*.
*Force* : la ressource **et** la thèse, dans l'ordre où on veut être lu ; 16 mots ;
« CLAUDETTE » reste le mot trouvable. *Faiblesse* : perd la mention des juges LLM — qui
reste dans le résumé et les mots-clés.

| | Trouvabilité | Annonce la thèse | Longueur | Fidélité au contenu |
|---|---|---|---|---|
| 1 · ressource | ●●●● | ● | 18 mots | ●●●● |
| 2 · résultat | ●● | ●●●● | 17 mots | ●●● |
| 3 · mixte | ●●●● | ●●●● | 16 mots | ●●●● |

→ **Option 3.** Un titre à deux-points est la norme du domaine, et c'est le seul des trois
qui serve les deux objectifs sans en sacrifier un.

**Le résumé** (~150 mots, structure fixe, une phrase par fonction) : (i) le manque, (ii) ce
qu'on a construit, chiffré, (iii) le résultat démontré avec son chiffre, (iv) un résultat
rapporté, (v) ce qui est publié. Le résumé actuel du gabarit fait 215 mots et enchaîne cinq
revendications : **le resserrer**, en supprimant « approaches the human ceiling » (l'écart
est de 0.139 de κ — « approaches » ne tient pas).

---

### 6.2 Introduction (~380 mots)

**Option 1 — Entonnoir classique.** Importance des ToS → détection automatique → CLAUDETTE →
ce qui manque → ce que nous faisons.
*Force* : familier, sans risque. *Faiblesse* : les deux premiers mouvements sont connus de
tout lecteur JURIX ; ~120 mots dépensés à convaincre d'un intérêt que personne ne conteste.

**Option 2 — Attaque par le manque.** Première phrase = la lacune. *« CLAUDETTE records
whether a sentence is unfair, but nothing about what the clause is about. »*
*Force* : entre dans le sujet en une ligne ; libère ~100 mots ; pose le contraste
(abusivité/thème) qui porte tout l'article. *Faiblesse* : suppose le lecteur familier de
CLAUDETTE — hypothèse raisonnable à JURIX, risquée ailleurs.

**Option 3 — Attaque par le paradoxe méthodologique.** Partir de la question ouverte :
l'annotation multi-label est-elle moins fiable par nature, ou parce que la taxonomie est
trop fine ?
*Force* : met la thèse en avant dès la première ligne. *Faiblesse* : le lecteur ne sait pas
encore de quel corpus ni de quelle tâche on parle — l'abstraction avant le concret coûte en
`reviewer's confidence`.

| | Économie de mots | Clarté immédiate | Met en valeur | Risque |
|---|---|---|---|---|
| 1 · entonnoir | ● | ●●●● | le domaine | faible |
| 2 · manque | ●●●● | ●●●● | la ressource | faible à JURIX |
| 3 · paradoxe | ●●● | ●● | la thèse | moyen |

→ **Option 2**, avec la thèse (option 3) en troisième mouvement. Plan en quatre temps :
(i) le manque, en deux phrases ; (ii) ce que nous ajoutons, chiffré — 50 contrats,
9 414 phrases, 3 annotateurs, 20 thèmes, 4 juges ; (iii) la question que la couche permet de
trancher, et la réponse en une phrase avec son chiffre ; (iv) **liste explicite des
contributions** (trois puces courtes ou une phrase « we contribute… »), qui achète
`significance` à coût nul et sert de plan.

---

### 6.3 Background and Related Work (~280 mots)

**Option 1 — Par thèmes, un paragraphe chacun.** Détection ToS ; taxonomies de clauses ;
mesure d'accord ; LLM juges ; encodeurs juridiques. Cinq paragraphes courts.
*Force* : couvre large, facile à écrire depuis l'état de l'art déjà rédigé. *Faiblesse* :
cinq paragraphes de 55 mots ne disent rien d'autre que « ces travaux existent » ; aucun ne
positionne.

**Option 2 — Par grappes citées, deux paragraphes.** Un paragraphe « ce que la littérature
établit » (quatre à cinq grappes, ~20 références), un paragraphe « ce qu'elle laisse ouvert »
qui énonce le manque.
*Force* : densité de citations maximale par mot dépensé — exactement ce que note
`literature review` ; le second paragraphe **est** l'énoncé du gap. *Faiblesse* : les
grappes (« X [1–6] ») sont peu informatives prises une à une — acceptable si le second
paragraphe fait le travail.

**Option 3 — Positionnement par contraste tabulaire.** Un petit tableau ressource-par-
ressource (CLAUDETTE, LEDGAR, CUAD, la nôtre) × propriétés (multi-label ? accord publié ?
outil ?).
*Force* : le positionnement devient visuel et incontestable ; très efficace pour une
ressource. *Faiblesse* : **coûte ~150 équivalents mots**, soit près d'un tiers du budget de
la section, et nous n'avons droit qu'à deux tableaux.

| | Densité de références | Force du positionnement | Coût |
|---|---|---|---|
| 1 · thèmes | ●●● | ● | 280 mots |
| 2 · grappes | ●●●● | ●●●● | 280 mots |
| 3 · tableau | ●● | ●●●●● | 130 mots + 150 équiv. |

→ **Option 2.** Le tableau comparatif (option 3) est meilleur *en soi*, mais les deux
créneaux de flottants sont déjà pris par les résultats — et sur ce format, un tableau de
positionnement se remplace par une phrase : *« Existing clause-topic resources are
single-annotated [9], unpublished [11], or reported without chance-corrected agreement [10]. »*
**[arbitrage lié au délai]** — à rouvrir pour le papier long.

---

### 6.4 The Thematic Layer and Its Construction (~400 mots)

C'est la section « Data and Method » réorientée : elle décrit **la ressource** et, dans la
foulée, le protocole de mesure.

**Option 1 — Méthode d'abord, ressource ensuite.** Protocole d'annotation → mesures → ce que
contient la ressource.
*Force* : ordre logique de production. *Faiblesse* : le lecteur attend page 3 pour savoir ce
qu'est l'artefact — or c'est la contribution.

**Option 2 — Ressource d'abord, protocole ensuite.** Ce que contient la couche (chiffres,
formats, disponibilité) → comment elle a été produite → comment elle est mesurée.
*Force* : la contribution est immédiatement tangible ; les chiffres de volume font le travail
d'argumentation ; le protocole se lit ensuite comme une garantie de qualité.
*Faiblesse* : demande de la discipline pour ne pas transformer la description en catalogue.

**Option 3 — Fusionner ressource et résultats.** Décrire chaque élément de la couche au
moment où on l'utilise, sans section dédiée.
*Force* : économie maximale. *Faiblesse* : **dissout la ressource** — elle n'apparaît plus
comme une contribution mais comme un moyen ; exactement l'inverse de l'effet recherché.

| | Met en valeur la ressource | Lisibilité | Économie |
|---|---|---|---|
| 1 · méthode d'abord | ●● | ●●● | ●●● |
| 2 · ressource d'abord | ●●●● | ●●●● | ●●● |
| 3 · fusion | ● | ●● | ●●●● |

→ **Option 2**, en trois blocs sans sous-titres numérotés (les sous-titres coûtent et
fragmentent sur 5 pages) :

1. **La couche** — 50 ToS de CLAUDETTE, 9 414 phrases, 20 thèmes juridiques, multi-label
   (primaire + secondaires), 3 annotateurs formés **indépendants**, 4 juges LLM sur les mêmes
   phrases et le même vocabulaire. Votes individuels conservés.
2. **La construction** — pré-annotation LLM **post-éditée** (dire le fait et sa limite dans
   la même phrase), politique d'indépendance, résolution du gold **strictement
   inter-annotateurs : les LLM n'y sont jamais parties** (point à mettre en valeur — il coupe
   l'objection d'évaluation circulaire), cascade unanime / majorité / arbitrage humain.
3. **Les mesures** — α de Krippendorff avec distance MASI *contre* α nominal (l'écart **est**
   le coût du multi-label), seuils de Passonneau (0.667 / 0.8), bootstrap **apparié par
   document**, partition conception (33) / validation (17), plafond humain LOAO.

---

### 6.5 Results (~450 mots, 2 tableaux)

Le cœur. La règle : **un résultat démontré, les autres rapportés.**

**Option 1 — Un tableau unique, tout-en-un.** Une grande table à double entrée
(taxonomies × mesures) plus quelques lignes de commentaire.
*Force* : compacité. *Faiblesse* : un tableau dense coûte ~280 équivalents et se lit mal en
10 pt ; il mélange le résultat démontré et les résultats rapportés, ce qui brouille le
statut de preuve de chacun.

**Option 2 — Deux tableaux, deux statuts.** **Table 1** = le résultat démontré (α-MASI et α
nominal par taxonomie, Δ apparié vs T20 **avec IC**, coût du multi-label, perte de signal
d'abusivité) ; **Table 2** = la synthèse rapportée (plafond humain, meilleur juge, modèle
fine-tuné, avec une colonne « what it is compared to »).
*Force* : la séparation démontré/rapporté devient **visible**, ce qui est exactement
l'honnêteté que demande le genre ; chaque table tient en 6–8 lignes.
*Faiblesse* : consomme les deux créneaux de flottants.

**Option 3 — Un tableau + une figure.** Table du résultat principal, figure de la courbe
fiabilité/signal par taxonomie.
*Force* : la figure montre le compromis d'un coup d'œil. *Faiblesse* : coût de production
élevé, et quatre points ne font pas une courbe — une figure à quatre points est un tableau
déguisé, ce qu'un relecteur remarque.

| | Clarté du statut de preuve | Coût en place | Coût de production |
|---|---|---|---|
| 1 · table unique | ● | ●●● | faible |
| 2 · deux tables | ●●●● | ●● | faible |
| 3 · table + figure | ●●● | ● | **élevé** |

→ **Option 2.** Rédaction en trois mouvements, chacun appliquant le triplet du §4.5 :

- **Le coût du format** — α-MASI 0.658 contre α nominal 0.732 : **0.073 [0.061, 0.087]**, et
  ce coût est **constant** sur les quatre taxonomies. C'est la prémisse.
- **L'effet de granularité** — T11 gagne **+0.067 [0.058, 0.077]** sur T20, et le gain
  **réplique sur les 17 documents de validation** (+0.069) jamais utilisés pour concevoir les
  fusions. C'est le résultat démontré : il faut ici le protocole complet et l'IC.
- **La contrainte juridique** — la fusion doit respecter les strates d'abusivité : T10, qui
  les traverse, gagne +0.012 d'α supplémentaire mais perd **13.2 %** de signal d'abusivité
  contre 5.9 % pour T11 (rendement 0.59 contre 1.13). C'est ce qui rend le résultat
  spécifiquement juridique plutôt que statistique — **à ne pas couper**.

Puis, en trois phrases sobres renvoyant à Table 2 : plafond humain LOAO **κ 0.859**, meilleur
juge LLM **κ 0.581**, Legal-BERT fine-tuné **κ 0.720** — donc au-dessus de tous les juges et
**sous** le plafond humain.

---

### 6.6 Discussion and Limitations (~250 mots)

**Option 1 — Discussion puis section « Limitations » séparée.** Deux blocs distincts.
*Force* : les limites sont visibles, donc créditées. *Faiblesse* : deux titres de section de
plus, et la discussion tend à répéter les résultats.

**Option 2 — Discussion intégrant les limites au fil.** Chaque implication est suivie de sa
réserve.
*Force* : économique, et évite le ton d'auto-flagellation d'une liste de limites.
*Faiblesse* : les limites deviennent moins repérables — un relecteur pressé peut ne pas
créditer l'honnêteté.

**Option 3 — Implications d'abord, paragraphe de limites dense en fin de section.** Un
paragraphe « Limitations » **non numéroté**, en fin de section, où chaque limite tient en une
proposition.
*Force* : visibilité des limites sans coût de titre ; le paragraphe dense se lit comme une
liste de garanties. *Faiblesse* : aucune notable sur ce format.

| | Visibilité des limites | Coût | Ton |
|---|---|---|---|
| 1 · section séparée | ●●●● | ●● | neutre |
| 2 · au fil | ●● | ●●●● | fluide |
| 3 · paragraphe dense | ●●●● | ●●●● | **maîtrisé** |

→ **Option 3.** Les limites à déclarer, une proposition chacune : pré-annotation post-éditée
(avec la divergence 38.5–48.6 % comme borne mesurée de l'ancrage) ; un seul système juridique
et une seule langue ; pré-annotations LLM figées — « mesure une sortie historique, pas l'état
de l'art courant » ; un seul encodeur, arrêt précoce sur le pli de test ; et — **à ne pas
omettre** — le fait que le multi-étiquetage est quasi absent du jeu agrégé (1.04 étiquette
par phrase), de sorte qu'un score multi-label sur ce jeu ne mesure pas la difficulté de la
tâche annotée.

---

### 6.7 Conclusion et disponibilité (~150 mots)

**Option 1 — Conclusion classique.** Rappel des contributions + perspectives.
*Faiblesse* : sur 5 pages, répète l'introduction presque mot pour mot.

**Option 2 — Conclusion supprimée, disponibilité en fin de discussion.**
*Force* : économise ~120 mots et un titre. *Faiblesse* : un article sans conclusion surprend
et laisse le lecteur sans dernière impression ; les artefacts publiés y perdent en visibilité.

**Option 3 — « Conclusion and Availability » fusionnées.** Deux phrases de bilan, puis la
liste des artefacts publiés avec leurs conditions d'accès.
*Force* : transforme la section la plus redondante en section la plus **utile** — pour une
contribution de type ressource, la disponibilité est un résultat ; achète `significance`.
*Faiblesse* : impose d'avoir réglé licence, dépôt et DOI **avant** soumission.

→ **Option 3**, sous réserve d'un point ouvert : le dépôt public, le DOI et la licence ne
sont pas encore fixés (l'état de l'art le note). Formulation de repli acceptable si rien
n'est arbitré à temps : *« The layer, codebook, protocol and platform will be released under
an open licence upon publication »* — une promesse datée vaut mieux qu'une URL morte.

---

## 7. Listes de contrôle

### 7.1 Avant d'écrire (10 minutes)

- [ ] Vider `references.bib` de ses trois entrées fictives `example_*` et y verser les
      entrées réellement citées (l'état de l'art en recense 59).
- [ ] Supprimer `tables/example-table.tex` et `figures/example-figure.*` des `\input`.
- [ ] Décider le titre (§6.1) et le figer — il conditionne le résumé.
- [ ] Exporter les macros `\newcommand` de chiffres depuis la vue « Résultats
      expérimentaux » et les inclure : **aucun chiffre saisi à la main dans le `.tex`**.

### 7.2 Pendant la rédaction

- [ ] Un résultat = fait chiffré + ce qu'il tranche + ce qu'il ne tranche pas (§4.5).
- [ ] Toute revendication principale porte son IC.
- [ ] Une seule référence de comparaison dans tout l'article (le plafond humain).
- [ ] Aucun `grep TODO` restant.
- [ ] Verbes calibrés : *measure / quantify / report*, jamais *prove* ni *demonstrate*.

### 7.3 Avant l'envoi

- [ ] `bash tools/check_pages.sh` → corps ≤ 5 pages, références exclues.
- [ ] Compilation par `latexmk -pdf` **avec `bibtex`** (pas `biber`).
- [ ] Légendes : tableaux **au-dessus**, figures **en dessous**.
- [ ] Aucune commande de mise en page ajoutée (marges, interligne, police).
- [ ] Renvois `Table~1` / `Figure~1`, jamais « above »/« below ».
- [ ] Chiffres du texte identiques à ceux des tableaux (macros).
- [ ] Affiliations et adresse de correspondance complètes ; ORCID si disponible.
- [ ] Déclaration d'usage d'outils d'IA si des outils génératifs ont servi (politique Sage).
- [ ] Dépôt sur EasyChair `jurix2026` **avant la limite AoE**.

---

## 8. Ce que ce guide écarte délibérément

| Écarté | Raison |
|---|---|
| Une figure | Coût de production élevé pour quatre points scalaires ; les deux créneaux de flottants servent mieux en tableaux **[arbitrage lié au délai]** |
| Le tableau de positionnement des ressources | Excellent pour une ressource, mais consommerait un créneau de flottant ; remplacé par une phrase dense en §6.3 |
| Les résultats multi-label du modèle (E4.5) | Hypothèse réfutée : l'agrégation a effacé le multi-étiquetage. Le chiffre serait flatteur et trompeur — il va en **limite**, pas en résultat |
| Le détail de la plateforme | Un paragraphe suffit ; la plateforme est un artefact annoncé, pas l'objet du papier |
| La segmentation / le graphe déontique | Motivation, renvoyée au papier long — l'annoncer sans la mesurer affaiblirait `technical quality` |
