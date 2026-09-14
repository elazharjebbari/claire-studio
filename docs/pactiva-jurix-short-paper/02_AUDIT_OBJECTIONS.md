# Audit de deux objections de relecture — vérification sur les données

> **Ce que fait ce document.** Il prend deux objections formulées contre le short paper,
> les confronte à ce que disent réellement nos données et notre code, et propose des
> remèdes chiffrés par coût. Chaque verdict s'appuie sur une mesure reproductible, pas sur
> une opinion.

---

## Résumé exécutif

| Objection | Verdict | Gravité |
|---|---|---|
| **1. Circularité pré-annotation → juges** | **Fondée, et plus grave que formulée** — une mesure nouvelle, faite pour cet audit, montre une signature d'ancrage que le taux de divergence global masquait | 🔴 à traiter avant soumission |
| **2. T11/T10 : d'où vient la contrainte légale ?** | **Partiellement fondée** — la contrainte est bien *a priori* et T10 est bien un contrefactuel, mais le papier sur-revendique sa nature juridique | 🟠 une phrase à corriger, une à ajouter |

Un troisième point, découvert en chemin : **des chiffres du dossier de conception ne
correspondent plus à ceux de la campagne finale** (§4).

---

## 1. Objection n° 1 — la circularité entre pré-annotation et juges

### 1.1 Ce que disent les faits

| Question | Réponse vérifiée |
|---|---|
| Qui sont les juges ? | Claude, Codex, Mistral, **Fable** (`Judge` dans `backend/claire/imports/models.py`) |
| Quel modèle a pré-annoté ? | **Non tracé.** Le protocole de E3.2 le déclare : « le juge ayant servi au pré-remplissage n'est pas persisté » |
| Peut-on l'inférer ? | Oui, indirectement — voir ci-dessous |

Divergence de chaque annotateur à chaque juge (E3.2, part de phrases au thème différent) :

| Annotateur | claude | codex | **fable** | mistral | Le plus proche |
|---|---|---|---|---|---|
| elazhar.jebbari | 0.442 | 0.697 | **0.385** | 0.626 | fable |
| fatima.ouali | 0.530 | 0.722 | **0.437** | 0.672 | fable |
| zahra.boulaich | **0.486** | 0.653 | 0.526 | 0.677 | claude |

Et le classement des juges contre le gold (E3.3, T20) :

| Rang | Juge | $\kappa$ |
|---|---|---|
| 1 | **fable** | 0.581 |
| 2 | claude | 0.515 |
| 3 | mistral | 0.327 |
| 4 | codex | 0.266 |

**Le classement des juges reproduit exactement l'ordre de proximité aux annotateurs.** Le
juge dont les humains sont le plus proches est celui qui gagne. C'est précisément la
configuration que l'objection décrit.

### 1.2 Le test qui départage ancrage et compétence

La coïncidence ci-dessus admet deux explications concurrentes :

- **compétence** — Fable est simplement le meilleur modèle, et les annotateurs le rejoignent
  parce qu'il a plus souvent raison ;
- **ancrage** — le gold porte une empreinte résiduelle des suggestions de Fable, ce qui
  gonfle son score.

Ces deux hypothèses font des prédictions **différentes et vérifiables**. Si c'est de la
compétence, l'avantage de Fable doit être présent partout, y compris là où les trois
annotateurs sont unanimes — ces phrases-là sont faciles, et un bon modèle y réussit. Si
c'est de l'ancrage, l'avantage doit se concentrer là où les humains ont hésité : c'est
là que la suggestion pèse, et le gold y est décidé à la majorité ou par arbitrage.

**Exactitude de chaque juge contre le gold, ventilée par classe d'accord humain** (mesure
faite pour cet audit sur le dataset `7116e627f528c557`) :

| Juge | Accord strict (n=4 406) | Majorité 2/3 (n=4 546) | Divergence (n=462) |
|---|---|---|---|
| **fable** | 0.607 | **0.636** | 0.212 |
| claude | 0.578 | 0.543 | 0.128 |
| mistral | 0.382 | 0.358 | 0.128 |
| codex | 0.347 | 0.285 | 0.108 |

Deux faits sautent aux yeux.

**(a) L'avantage de Fable est trois fois plus faible là où les humains sont unanimes.**
Face à Claude, il gagne $+0.029$ sur les phrases en accord strict, contre $+0.093$ sur les
phrases à majorité et $+0.084$ sur les divergences. Si Fable était simplement meilleur, son
avance ne s'effondrerait pas précisément sur les phrases les plus faciles.

**(b) Fable est le seul juge qui s'améliore quand les humains se divisent.** Les phrases à
majorité sont plus difficiles que les unanimes : Claude y perd 3,5 points, Mistral 2,4,
Codex 6,2. **Fable en gagne 2,9.** Aucun mécanisme de compétence n'explique qu'un modèle
réussisse *mieux* là où trois annotateurs formés ne parviennent pas à s'accorder — sauf si
ces phrases-là portent sa propre suggestion, conservée par deux annotateurs sur trois et
devenue la majorité qui fait le gold.

> **Verdict.** L'objection est fondée, et le test ci-dessus la rend quantitative. Ce n'est
> pas une preuve causale — le pré-annotateur n'étant pas tracé, aucune analyse ne peut
> l'être — mais c'est la signature attendue de l'ancrage, et elle est absente chez les
> trois autres juges.

### 1.3 Ce que l'objection voyait juste, et au-delà

L'objection anticipait que le taux de divergence global (38,5–48,6 %) est une défense
faible parce qu'il mesure la divergence **par phrase** et non l'ancrage **sur les cas
ambigus**. La mesure ci-dessus le confirme : l'ancrage se loge exactement là où le taux
global ne regarde pas.

### 1.4 Remèdes, par coût croissant

| # | Remède | Coût | Effet |
|---|---|---|---|
| **R1** | **Déclarer explicitement** dans la section « Construction » que le juge de pré-remplissage n'est pas tracé, et que Fable est le plus proche de 2 annotateurs sur 3 | 2 phrases | Transforme un angle mort en limite déclarée. **Indispensable.** |
| **R2** | **Publier l'analyse de sensibilité** : sans Fable, le meilleur juge est Claude ($\kappa$ 0.515 en T20, 0.531 en T11), et l'écart au plafond humain passe de 0.279 à 0.345 — la conclusion « les juges restent nettement sous le plafond humain » est *renforcée*, pas affaiblie | 1 ligne de tableau + 1 phrase | Neutralise l'objection : la thèse du papier survit à l'exclusion du juge suspect |
| **R3** | **Rapporter le test de ventilation** (§1.2) comme résultat, pas comme défense | 1 tableau (~150 équivalents mots) | Le plus solide scientifiquement — mais coûte un créneau de flottant sur 5 pages |
| **R4** | **Retirer Fable du tableau principal**, le mentionner en note | gratuit | Défensif, mais fait perdre un juge et paraît cacher quelque chose |
| **R5** | **Tracer le pré-annotateur** et rejouer | plusieurs semaines | La vraie solution — **hors de portée pour ce papier**, à faire pour le papier long |

**Recommandation : R1 + R2.** La combinaison est peu coûteuse et suffit : elle déclare le
risque et montre que la conclusion n'en dépend pas. R3 est meilleur mais ne tient pas dans
les 5 pages ; il a sa place dans le papier long.

> **Formulation proposée** (section « Construction », après la phrase sur la post-édition) :
> *« The judge used for pre-annotation was not recorded. Two of our three annotators are
> closest to Fable (38.5\% and 43.7\% divergence) and one to Claude (48.6\%), so an
> anchoring effect on the judge benchmark cannot be excluded. Excluding Fable leaves Claude
> as the best judge at $\kappa = 0.515$, which widens rather than narrows the gap to the
> human ceiling. »*

---

## 2. Objection n° 2 — d'où viennent T14 et T11 ?

### 2.1 Ce que disent les faits

L'objection redoutait que T11 soit une fusion purement statistique dont le respect du droit
serait une coïncidence constatée *a posteriori*. **Ce n'est pas le cas**, et la
spécification le dit noir sur blanc.

Le cadre de décision (`docs/pactiva-fusion-classes/02_ANALYSE_FUSION.md`) pose **quatre
critères et un garde-fou** :

| Critère | Nature |
|---|---|
| C1 Confusabilité | statistique |
| C2 Fiabilité déficiente | statistique |
| **C3 Cohérence juridique** | **jugement métier explicite** |
| C4 Support | statistique |
| **Garde-fou G** | **ne jamais fusionner deux thèmes de strates d'abusivité opposées** |

Et la spécification figée qualifie T10 sans ambiguïté : *« Sert de **TEST À CHARGE** du
garde-fou des strates. **N'est PAS destinée à être adoptée.** »*

> **Donc : la contrainte est bien appliquée à la conception, pas en validation, et T10 est
> bien un contrefactuel construit exprès.** Les deux craintes principales de l'objection
> tombent.

### 2.2 Mais le papier sur-revendique la nature de cette contrainte

Le manuscrit écrit actuellement :

> *« …placing clauses that the Directive treats differently \cite{eu1993directive,
> micklitz2017empire} into a single category. »*

Cette phrase suggère que les strates d'abusivité sont **dérivées du texte de la directive**.
Elles ne le sont pas. Elles sont opérationnalisées par une **mesure empirique** :
$P(\text{abusif} \mid \text{thème})$ calculé sur les étiquettes CLAUDETTE, avec un seuil de
lift ($\geq 3$ contre $\leq 1$). Les étiquettes CLAUDETTE encodent bien la directive — la
chaîne tient — mais elle compte **un maillon de plus** que ce que la phrase laisse entendre.

C'est le seul point réellement fragile, et un relecteur juriste de JURIX le verra.

### 2.3 Remèdes

| # | Remède | Coût | Effet |
|---|---|---|---|
| **R6** | **Corriger la sur-revendication** : dire que les strates sont opérationnalisées par le taux d'abusivité observé dans les étiquettes CLAUDETTE, elles-mêmes fondées sur la directive | reformulation | **Indispensable** — sinon la revendication est inexacte |
| **R7** | **Ajouter une phrase sur la conception** : le garde-fou est un critère de construction, T10 est un contrefactuel délibéré | 1 phrase | Coupe l'objection de circularité inversée |
| **R8** | **Nommer qui a appliqué C3** (« jugement métier explicite ») | 1 membre de phrase | Deux co-autrices sont juristes (Juristiadata, Faculté des sciences juridiques de Rabat) — **si elles ont validé les fusions, le dire ; sinon, ne pas le suggérer** |

> **Formulation proposée** (section « The Thematic Layer », bloc « Construction ») :
> *« \Tn{14} and \Tn{11} were designed under four criteria --- confusability, deficient
> reliability, contractual function, and support --- subject to one constraint fixed in
> advance: no merge may join two themes whose observed unfairness rates fall in opposite
> strata, as measured on the \corpus{} unfairness labels. \Tn{10} adds the single merge that
> this constraint forbids, and is included as a counterfactual rather than as a candidate. »*

⚠ **Point à trancher par vous seul (R8)** : les fusions ont-elles été validées par les
co-autrices juristes, ou appliquées par l'équipe informatique à partir de sa lecture du
droit ? Je ne peux pas le déterminer depuis le dépôt, et JURIX est sensible à la
distinction. **Ne l'écrivez que si c'est exact.**

---

## 3. Ce que l'objection n'avait pas vu : des chiffres périmés dans la spécification

Les `rationale` de la spécification figée portent des chiffres qui **ne correspondent plus**
à ceux de la campagne finale :

| Grandeur | Spécification (`taxonomies.json`) | Campagne finale (E2.3) |
|---|---|---|
| Perte de signal — T11 | 4,9 % | **5,9 %** |
| Perte de signal — T10 | 12,6 % | **13,2 %** |

L'écart s'explique : le dossier de conception a été rédigé avant la campagne finale (gold
non figé, périmètre différent). Aucun chiffre du papier n'en dépend — le manuscrit prend
ses valeurs dans la campagne. Mais la spécification étant **publiée avec la ressource**,
elle sera lue, et l'incohérence sera remarquée.

**Remède (R9)** : mettre à jour les deux `rationale`, ou y dater les chiffres
(« analyse de conception, août 2026 »). Coût : deux lignes. À faire avant la publication
des artefacts, pas avant la soumission.

---

## 4. Plan d'action

**Avant soumission** (~20 minutes de rédaction, ~60 mots à absorber dans les 5 pages) :

1. **R1** — déclarer que le pré-annotateur n'est pas tracé, avec les proximités mesurées.
2. **R2** — publier l'analyse de sensibilité sans Fable (elle *renforce* la thèse).
3. **R6** — corriger « the Directive treats differently » en une formulation exacte.
4. **R7** — dire que le garde-fou est un critère de conception et T10 un contrefactuel.
5. **R8** — trancher la question du rôle des juristes, et n'écrire que ce qui est exact.

**Avant publication des artefacts** :

6. **R9** — réaligner les chiffres de la spécification.

**Pour le papier long** :

7. **R3** — rapporter la ventilation par classe d'accord comme un résultat à part entière.
8. **R5** — tracer le juge de pré-remplissage et rejouer le benchmark ; c'est le seul moyen
   de transformer une signature en démonstration.

---

## Annexe — reproduire les mesures de ce document

La ventilation du §1.2 se recalcule depuis le dataset publié :

```python
# gold.jsonl fournit agreement_class et decided_primary ; judges.jsonl le thème par juge.
# Exactitude de chaque juge contre le gold, groupée par classe d'accord humain.
```

Toutes les autres valeurs proviennent de `frontend/src/features/paper/campaign.json`
(expériences E2.3, E3.2, E3.3), elles-mêmes régénérables par `run_campaign.py`.
