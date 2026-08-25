# 01 — Statistiques factuelles des données

Tous les chiffres proviennent de l'**export daté du 24 août 2026** construit par le
Lab sur le projet `campagne-pactiva` en production :

| Export | Critères | Empreinte | Contenu |
|---|---|---|---|
| principal | `submitted`, consensus, 5 plis, seed 42 | `f68c4e9e…` | 50 documents, 9 414 phrases agrégées, 15 984 votes bruts |
| contrôle | idem + `min_annotators=2` | `13aa1fbf…` | 33 documents, 5 336 phrases, 11 906 votes |

Aucun chiffre de ce dossier ne provient d'une requête ad hoc : tout est recalculable
par les scripts de l'annexe [`scripts/`](scripts/) sur ces exports.

## 1. Couverture d'annotation

| Mesure | Valeur |
|---|---|
| Documents soumis | 50 / 50 (corpus CLAUDETTE) |
| Documents mono-annotés | 17 |
| Documents **double**-annotés | 25 |
| Documents **triple**-annotés | 8 |
| Phrases multi-annotées | 5 336 (matière des mesures d'accord) |
| Paires d'annotateurs comparables (phrase × paire) | 7 804 |
| Votes par annotateur | zahra.boulaich 9 236 · fatima.ouali 5 514 · elazhar.jebbari 1 234 |

Progression notable depuis l'aperçu du 16 août : 12 → **33 documents multi-annotés**,
3 → **8 triples**. Le critère « ≥ 3 annotateurs sur un sous-ensemble » du papier
court est atteint.

## 2. Supports par thème (agrégé, thème primaire) — le déséquilibre

| Thème | n | % | | Thème | n | % |
|---|---|---|---|---|---|---|
| LICENSE_IP | 1 054 | 11,2 | | TERMINATION | 364 | 3,9 |
| FEES_PAYMENT | 970 | 10,3 | | MODIFICATION_OF_TERMS | 329 | 3,5 |
| ACCEPTABLE_USE | 969 | 10,3 | | PRIVACY_DATA | 218 | 2,3 |
| PREAMBLE_SCOPE | 924 | 9,8 | | GOVERNING_LAW | 144 | 1,5 |
| ARBITRATION_DISPUTES | 910 | 9,7 | | COMMUNICATIONS | 100 | 1,1 |
| ELIGIBILITY_ACCOUNT | 869 | 9,2 | | META | 94 | 1,0 |
| LIMITATION_LIABILITY | 517 | 5,5 | | DMCA | 61 | 0,6 |
| USER_CONTENT | 509 | 5,4 | | FEEDBACK | 60 | 0,6 |
| THIRD_PARTY_SERVICES | 452 | 4,8 | | PROMOTIONS | 33 | 0,4 |
| WARRANTY_DISCLAIMER | 444 | 4,7 | | MISC_BOILERPLATE | 393 | 4,2 |

**Indicateurs de déséquilibre** :

| Indicateur | Valeur | Lecture |
|---|---|---|
| Ratio de déséquilibre (max/min) | **31,9** | LICENSE_IP pèse 32 fois PROMOTIONS |
| Entropie normalisée | 0,901 | distribution étalée mais tête lourde |
| Indice de Gini | 0,414 | concentration modérée-forte |
| Part des 5 premiers thèmes | 51,3 % | la moitié du corpus dans un quart des classes |
| Thèmes sous 300 phrases | **7 / 20** | PRIVACY_DATA, GOVERNING_LAW, COMMUNICATIONS, META, DMCA, FEEDBACK, PROMOTIONS |
| Thèmes sous 100 phrases | 4 / 20 | META, DMCA, FEEDBACK, PROMOTIONS |

Conséquence directe pour l'apprentissage : en validation croisée à 5 plis, un thème
à 60 phrases n'offre que ~12 exemples de test par pli — la macro-F1 y est dominée
par du bruit d'échantillonnage, et la courbe d'apprentissage (learning-curve) montre
que ces classes sont loin de leur asymptote.

## 3. Multi-étiquettes

| Mesure | Valeur |
|---|---|
| Taux multi-label (votes bruts) | **23,3 %** |
| Taux multi-label (agrégé consensus) | 2,4 % (artefact d'aplatissement connu — V1.3) |
| Cardinalités des votes | 1 : 12 258 · 2 : 3 385 · 3 : 326 · 4 : 13 · 5 : 2 |
| Segments reconstruits (agrégé) | 2 496 |
| Combinaisons de thèmes distinctes | 79, dont **30 hapax** |

## 4. Accord inter-annotateurs — global et par thème

Global (33 documents multi-annotés, IC bootstrap par document, 1 000 tirages) :

| Mesure | Valeur |
|---|---|
| α-MASI (jeux de thèmes) | **0,613** [0,567 ; 0,670] |
| α nominal (thème primaire) | 0,680 |
| Paires en désaccord de primaire | 2 316 / 7 804 = **29,7 %** |

Par thème — α binaire un-contre-tous (présence du thème dans le jeu), AC1 de Gwet,
supports (votes) ; tri par α croissant :

| Thème | α | AC1 | Votes | Lecture |
|---|---|---|---|---|
| **FEEDBACK** | **0,099** | 0,992 | 108 | classe inutilisable telle quelle |
| **DMCA** | **0,240** | 0,989 | 141 | idem — paradoxe de prévalence (α bas, AC1 haut) |
| **COMMUNICATIONS** | **0,328** | 0,980 | 270 | idem |
| MISC_BOILERPLATE | 0,455 | 0,948 | 680 | frontière floue avec PREAMBLE_SCOPE |
| USER_CONTENT | 0,495 | 0,912 | 1 410 | frontière floue avec LICENSE_IP |
| META | 0,535 | 0,976 | 459 | |
| PREAMBLE_SCOPE | 0,561 | 0,884 | 1 769 | |
| PRIVACY_DATA | 0,578 | 0,959 | 647 | |
| GOVERNING_LAW | 0,587 | 0,982 | 385 | confusion avec ARBITRATION_DISPUTES |
| ACCEPTABLE_USE | 0,654 | 0,910 | 2 119 | |
| LIMITATION_LIABILITY | 0,668 | 0,956 | 1 306 | |
| THIRD_PARTY_SERVICES | 0,681 | 0,953 | 1 006 | |
| ELIGIBILITY_ACCOUNT | 0,699 | 0,948 | 1 485 | |
| WARRANTY_DISCLAIMER | 0,745 | 0,959 | 1 115 | |
| TERMINATION | 0,775 | 0,977 | 852 | |
| LICENSE_IP | 0,790 | 0,944 | 2 058 | |
| PROMOTIONS | 0,796 | 0,998 | 85 | rare mais bien identifiée |
| MODIFICATION_OF_TERMS | 0,813 | 0,983 | 701 | |
| FEES_PAYMENT | 0,850 | 0,964 | 1 882 | |
| ARBITRATION_DISPUTES | 0,858 | 0,973 | 1 590 | |

**Le fait central** : la fiabilité n'est pas uniformément basse — elle est **bimodale**.
Les thèmes « institutionnels » du contrat (arbitrage, paiement, modification,
résiliation) s'annotent à α ≥ 0,77 ; la queue rare et les zones de recouvrement
sémantique (feedback/contenu, DMCA/licence, boilerplate/préambule) s'effondrent
sous 0,50. Le « mur du κ » du dossier JURIX v1 est localisé, pas diffus.

## 5. Structure des désaccords — les grappes de confusion

Top des paires de thèmes en désaccord de primaire (paires d'annotateurs, non
ordonnées) et **indice de confusabilité** C(i,j) = désaccords{i,j} / (accords_i +
accords_j + désaccords{i,j}) :

| Paire | Désaccords | C(i,j) |
|---|---|---|
| MISC_BOILERPLATE ↔ PREAMBLE_SCOPE | 143 | 0,177 |
| LICENSE_IP ↔ USER_CONTENT | 114 | 0,120 |
| DMCA ↔ LICENSE_IP | 92 | 0,129 |
| ACCEPTABLE_USE ↔ ELIGIBILITY_ACCOUNT | 90 | 0,083 |
| ACCEPTABLE_USE ↔ USER_CONTENT | 77 | 0,100 |
| FEES_PAYMENT ↔ PREAMBLE_SCOPE | 77 | 0,066 |
| FEES_PAYMENT ↔ TERMINATION | 67 | 0,070 |
| LIMITATION_LIABILITY ↔ WARRANTY_DISCLAIMER | 66 | 0,088 |
| ARBITRATION_DISPUTES ↔ GOVERNING_LAW | 45 | 0,059 |
| FEEDBACK ↔ USER_CONTENT | 38 | 0,145 |
| META ↔ MISC_BOILERPLATE | 38 | 0,140 |
| COMMUNICATIONS ↔ FEEDBACK | 4 | **0,235** |

Cinq **grappes** concentrent l'essentiel de la confusabilité (analyse au fascicule 02) :

1. **Cadrage** : PREAMBLE_SCOPE · MISC_BOILERPLATE · META · COMMUNICATIONS · PROMOTIONS
2. **Contenu & PI** : LICENSE_IP · USER_CONTENT · DMCA · FEEDBACK
3. **Compte & usage** : ELIGIBILITY_ACCOUNT · ACCEPTABLE_USE
4. **Risque** : LIMITATION_LIABILITY · WARRANTY_DISCLAIMER
5. **Litiges & droit** : ARBITRATION_DISPUTES · GOVERNING_LAW

La paire FEES_PAYMENT ↔ TERMINATION (67 désaccords) est la seule grosse confusion
**hors grappe** : elle vient des clauses de résiliation d'abonnement (remboursement),
sémantiquement biface — on ne la fusionne pas (voir 02 §4).

## 6. Lien thème → abusivité (référence CLAUDETTE)

1 032 phrases portent au moins une étiquette d'abusivité CLAUDETTE — **taux de base
11,0 %**. Information mutuelle : I(thème primaire ; abusif) = 0,067 nat,
I(combinaison ; abusif) = 0,076 nat, pour H(abusif) = 0,346 nat.

| Thème | n | P(abusif \| thème) | Lift | Catégories dominantes |
|---|---|---|---|---|
| MODIFICATION_OF_TERMS | 334 | **0,488** | 4,5 | CH 114 · USE 39 · TER 25 |
| GOVERNING_LAW | 145 | **0,434** | 4,0 | LAW 54 |
| TERMINATION | 376 | **0,386** | 3,5 | TER 125 · CR 27 |
| LIMITATION_LIABILITY | 576 | **0,385** | 3,5 | LTD 219 |
| ARBITRATION_DISPUTES | 911 | 0,125 | 1,1 | J 57 · A 43 · LAW 16 |
| USER_CONTENT | 536 | 0,095 | 0,9 | CR 39 |
| PREAMBLE_SCOPE | 924 | 0,088 | 0,8 | USE 60 |
| FEES_PAYMENT | 995 | 0,062 | 0,6 | CH 36 |
| THIRD_PARTY_SERVICES | 462 | 0,058 | 0,5 | LTD 24 |
| PRIVACY_DATA | 222 | 0,054 | 0,5 | USE 8 |
| ACCEPTABLE_USE | 997 | 0,040 | 0,4 | TER 23 · CR 14 |
| **WARRANTY_DISCLAIMER** | 461 | **0,039** | 0,4 | LTD 16 |
| ELIGIBILITY_ACCOUNT | 871 | 0,036 | 0,3 | TER 20 |
| LICENSE_IP | 1 068 | 0,035 | 0,3 | TER 19 |
| DMCA | 61 | 0,082 | 0,8 | |
| MISC_BOILERPLATE | 393 | 0,010 | 0,1 | |
| COMMUNICATIONS | 110 | 0,009 | 0,1 | |
| META | 107 | 0,000 | 0,0 | |
| FEEDBACK | 60 | 0,000 | 0,0 | |
| PROMOTIONS | 34 | 0,088 | 0,8 | |

Deux lectures structurantes :

- **L'abusivité est stratifiée** : quatre thèmes (modification, loi applicable,
  résiliation, limitation de responsabilité) portent un lift ≥ 3,5 ; le reste est au
  taux de base ou dessous. Le mapping thème → catégorie CLAUDETTE est presque
  diagonal (CH→modification, TER→résiliation, LTD→responsabilité, LAW→loi,
  J/A→arbitrage, CR→contenu, USE→cadrage).
- **Le garde-fou de fusion en découle** : fusionner deux thèmes de strates opposées
  (ex. LIMITATION_LIABILITY 0,385 avec WARRANTY_DISCLAIMER 0,039) dilue
  mécaniquement P(abusif | classe) et détruit du signal de détection — c'est mesuré
  au fascicule 02 §5.

## 7. Accord humain ↔ juges LLM (contexte)

Exactitude du thème primaire agrégé contre chaque prédiction de juge (4 juges,
toutes phrases) : **41,2 %** sous T20. Ce chiffre remonte mécaniquement sous les
schémas fusionnés (47,7 % sous T11) — une partie de l'écart humain↔LLM du papier
court est donc de la **granularité**, pas du désaccord de fond (voir 02 §5).
