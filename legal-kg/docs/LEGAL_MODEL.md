# LEGAL_MODEL — la directive 93/13/CEE rendue exploitable dans le graphe

> Objet : représenter les critères d'abusivité de la directive 93/13/CEE et de son annexe sous une
> forme **exécutable** (règles/contraintes sur le graphe) et **traçable** (chaque signalement cite son
> fondement). Représentation machine : [`ontology/directive_93_13.yaml`](../ontology/directive_93_13.yaml).
> ⚠ Ce document est une modélisation d'ingénierie du texte de la directive ; il doit être **relu et
> validé par les co-autrices juristes** avant d'être cité comme analyse juridique. Les renvois à la
> jurisprudence sont indicatifs (arrêts connus : *Océano Grupo* C-240/98 à C-244/98 sur la clause
> attributive de juridiction ; *Invitel* C-472/10 et *RWE Vertrieb* C-92/11 sur les clauses de
> modification unilatérale, transparence, raison valable et droit de résiliation ; *Aziz* C-415/11 sur
> le déséquilibre significatif et la bonne foi) et à vérifier paragraphe par paragraphe.

---

## 1. Architecture normative de la directive (ce qui est modélisable)

| Article | Contenu | Modélisation | Exploitable par le graphe ? |
|---|---|---|---|
| Art. 1–2 | champ : contrats professionnel ↔ consommateur ; définitions | contexte du corpus (ToS B2C) | oui, comme prémisse (tous nos documents sont dans le champ) |
| **Art. 3(1)** | **test général** : clause non négociée individuellement, qui, en dépit de la bonne foi, crée un **déséquilibre significatif** des droits et obligations au détriment du consommateur | `GeneralTest {not_negotiated, good_faith, significant_imbalance}` | **partiellement** : « déséquilibre » ≈ asymétrie observable (droit du fournisseur sans réciproque, obligation du consommateur sans contrepartie) ; « bonne foi » non observable |
| Art. 3(2) | présomption de non-négociation pour les contrats pré-rédigés | prémisse vraie pour les ToS | oui (constante) |
| **Art. 3(3) + Annexe** | liste **indicative et non exhaustive** des clauses qui **peuvent** être abusives (17 items) | `AnnexItem (a)…(q)` + `AnnexScope` (§2 de l'annexe) | **oui — cœur du modèle** (items structurels) |
| Art. 4(1) | appréciation au regard de la nature des biens/services, des circonstances, des **autres clauses** | contexte documentaire ; **composition** entre clauses | oui pour « autres clauses » (famille F3) ; non pour les circonstances |
| Art. 4(2) | pas d'appréciation de l'objet principal ni du prix si rédigés de façon claire | exclusion : ne pas juger `FEES_PAYMENT` sur l'adéquation du prix | oui (exclusion de portée) |
| **Art. 5** | rédaction **claire et compréhensible** ; doute → interprétation favorable au consommateur | `Transparency` (vague, renvois, incompréhensible) | partiellement (indicateurs de vagueness, cf. Grundler et al. 2024) — hors périmètre initial |
| Art. 6 | la clause abusive ne lie pas le consommateur | conséquence, pas un critère | non (effet juridique) |
| Art. 7 | moyens de cessation ; actions collectives | — | non |
| Art. 8 | harmonisation **minimale** : les États peuvent être plus stricts (listes noires/grises nationales, ex. Code de la consommation FR R.212-1/R.212-2) | `Jurisdiction`-dependent overlays | extension (phase ultérieure) |

**Conséquence de conception** : le graphe **n'affirme jamais** qu'une clause est abusive (jugement d'art. 3(1)
in concreto) ; il établit qu'une clause **correspond** à un item de l'annexe (`MATCHES_ITEM`), avec
l'évidence, et laisse le jugement au juriste — exactement la nature indicative de la liste.

## 2. L'annexe : 17 items → règles, conditions, acteurs, effets, exceptions

Structure commune d'un item : *une clause ayant pour objet ou pour effet de* `⟨effet⟩` *par* `⟨acteur⟩`
*sur* `⟨objet⟩` *sous* `⟨conditions⟩`, *sans* `⟨contrepartie/recours⟩`. Chaque item est encodé avec :
`actor`, `modality`, `action`, `object`, `condition_pattern`, `missing_element` (ce dont l'absence est
constitutive : préavis, raison, réciprocité, droit de résiliation), `exceptions` (annexe §2), `risk_class`
(strate observée sur CLAUDETTE), `claudette_categories`, `clause_themes` (T11), `expressibility`.

| Item | Effet visé (résumé) | Élément constitutif absent | Exceptions (annexe §2) | Cat. CLAUDETTE | Thème T11 | Expr. |
|---|---|---|---|---|---|---|
| (a) | exclure/limiter la responsabilité en cas de **décès ou dommage corporel** | — | — | LTD | LIMITATION_LIABILITY | S |
| (b) | exclure/limiter les droits légaux du consommateur en cas d'inexécution (dont compensation) | — | — | LTD | LIMITATION_LIABILITY, WARRANTY_DISCLAIMER | S |
| (c) | engager le consommateur alors que l'exécution du professionnel dépend de sa seule volonté | — | — | — | FRAMEWORK | — |
| (d) | retenir les sommes versées si le consommateur renonce, sans réciprocité | réciprocité | — | — | FEES_PAYMENT | S |
| (e) | indemnité **disproportionnée** à la charge du consommateur défaillant | — | — | — | FEES_PAYMENT | Q (seuil déclaré) |
| (f) | résiliation **discrétionnaire** par le professionnel sans réciprocité ; rétention pour services non fournis | réciprocité | — | TER, CR | TERMINATION, CONTENT_IP | S |
| (g) | résilier un contrat à durée indéterminée **sans préavis raisonnable**, sauf motif grave | préavis | §2(a) services financiers, motif valable + information immédiate | TER | TERMINATION, ACCOUNT_USE | S |
| (h) | prorogation automatique d'un contrat à durée déterminée avec **délai de dénonciation trop éloigné** | délai raisonnable | — | — | FEES_PAYMENT | Q |
| (i) | engager irrévocablement le consommateur à des clauses qu'il n'a pas pu connaître | opportunité de prise de connaissance | — | USE | FRAMEWORK | P (proxy : acceptation par usage) |
| (j) | modifier unilatéralement les clauses **sans raison valable spécifiée** | raison valable spécifiée | §2(b) services financiers (taux, information + résiliation) ; contrats à durée indéterminée avec préavis raisonnable et liberté de résilier | CH | MODIFICATION_OF_TERMS | S |
| (k) | modifier unilatéralement les **caractéristiques** du produit/service sans raison valable | raison valable | — | CH | MODIFICATION_OF_TERMS | S |
| (l) | prix fixé à la livraison ou **augmentation sans droit de résiliation** | droit de résiliation | §2(c) valeurs mobilières/devises ; §2(d) indexation licite explicitement décrite | CH | FEES_PAYMENT, MODIFICATION_OF_TERMS | S |
| (m) | le professionnel seul juge de la conformité ou **interprète exclusif** des clauses | — | — | — | FRAMEWORK, WARRANTY_DISCLAIMER | S |
| (n) | limiter l'engagement du professionnel pour ses **mandataires** ; formalité | — | — | — | THIRD_PARTY_SERVICES | — |
| (o) | obliger le consommateur à exécuter alors que le professionnel n'exécute pas | réciprocité | — | — | — | — |
| (p) | **cession** du contrat sans accord du consommateur, si réduction des garanties | accord du consommateur | — | — | FRAMEWORK | S |
| (q) | supprimer/entraver le recours en justice : **arbitrage** non couvert par la loi, limitation des preuves, **charge de la preuve** inversée | — | — | A, J | DISPUTES_LAW | S |

Légende : S structurel (exprimable sur champs fermés), Q quantitatif (seuil déclaré), P proxy
procédural, — non exprimable depuis le texte de la clause. Les catégories LAW (choix de loi) et J
(juridiction) n'ont pas d'item propre : J se rattache à (q) (entrave au recours) et LAW **à aucun** — la
détection de LAW par règle repose sur la doctrine et la jurisprudence (*Océano* pour le for), non sur
l'annexe. C'est un résultat attendu de l'évaluation, pas un défaut à masquer.

## 3. Des items aux règles : trois niveaux d'exécution

| Niveau | Forme | Ce qu'il exige du graphe | Exemple |
|---|---|---|---|
| **R1 — Présence** d'une configuration | conjonction de conditions sur un énoncé normatif | `Norm{actor, modality, action, condition, notice, remedy}` | (g) : actor=provider ∧ modality∈{permission,power} ∧ action∈{terminate,suspend} ∧ condition∈{discretion,none_stated} ∧ notice∈{none,not_stated} |
| **R2 — Absence** d'un élément attendu | schéma de clause + négation | schémas par thème (slots attendus) | (j) : clause MODIFICATION_OF_TERMS sans `reason` ni `notice` ni `right_to_cancel` |
| **R3 — Composition / asymétrie** (art. 3(1), 4(1)) | motif sur plusieurs énoncés ou clauses du même document | graphe entier du document | droit de résiliation du fournisseur sans droit symétrique du consommateur (f) ; exclusion de responsabilité + exclusion de garantie + indemnisation à la charge de l'utilisateur |
| **R4 — Incohérence** | permission et interdiction du même acte, renvoi brisé | `Norm` × `Norm`, `REFERS_TO` | permission de résilier « à tout moment » et obligation de préavis de 30 jours dans une autre clause |

Les niveaux R1–R2 sont des **règles dures** (haute précision, lisibles une à une) ; R3 est le lieu où
le graphe apporte ce qu'aucune classification de phrase ne peut voir ; R4 est exploratoire. Format
déclaratif : [`graph/rules/grey_list_queries.yaml`](../graph/rules/grey_list_queries.yaml) ; exécution
Cypher : [`graph/cypher/02_detection_queries.cypher`](../graph/cypher/02_detection_queries.cypher).

## 4. Catégories de risque et strates

Le lien item → catégorie CLAUDETTE → thème permet une **catégorie de risque** par thème, observée sur
le corpus (DATA_UNDERSTANDING §4) : haute (GOVERNING_LAW, MODIFICATION_OF_TERMS, TERMINATION,
LIMITATION_LIABILITY), basse (les autres), nulle (cadrage). Cette stratification est **une contrainte
sur les fusions de taxonomie** (jamais à travers les strates) et **un prior** pour la détection
(baseline « thème seul »), jamais une règle en soi.

## 5. Règles de projection et d'évaluation (à figer avant toute expérience)

1. **Unité de jugement** : l'énoncé normatif (`Norm`) porté par une clause ; **unité d'évaluation** : la
   phrase (référence CLAUDETTE). Un `Norm` signalé marque ses phrases d'évidence (`EVIDENCED_BY`),
   pas toute la clause.
2. **Correspondance item → catégories** : celle du tableau §2 ; les items sans catégorie sont évalués
   contre « toute catégorie » et surtout par audit.
3. **Exceptions de l'annexe §2** : encodées comme conditions négatives (`unless`) dans les règles (g),
   (j), (l) ; leur absence d'application dans les ToS (services non financiers) est vérifiée, pas
   supposée.
4. **Seuils** pour (e) et (h) : déclarés dans le YAML (`threshold`), jamais ajustés après évaluation.
5. **Séparation** : les règles ne lisent jamais `LABELED` ; un test automatique (lint des requêtes)
   l'interdit.

## 6. Extensions (hors périmètre initial, prévues dans le modèle)

- **Listes nationales** (noire/grise, art. 8) : `AnnexItem` généralisé en `LegalGround {source, jurisdiction,
  bindingness}` — les items français R.212-1 (irréfragable) et R.212-2 (présomption simple) se
  branchent sans changer le schéma.
- **Transparence (art. 5)** : indicateurs de vagueness/renvois comme propriétés de `Clause`, en lien
  avec les travaux de Bologne sur les politiques de confidentialité.
- **Jurisprudence** : nœud `Case` relié aux items (`INTERPRETS`) pour documenter l'interprétation
  retenue par une règle (ex. *RWE* pour (j)).
