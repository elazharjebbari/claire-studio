# 02 — Résultats par question de recherche

> Produits par `research/experiments/run_campaign.py` sur le dataset `7116e627…`
> (50 documents, 9 414 phrases, 150 annotations soumises, GOLD à 9 414 décisions dont 462
> humaines), spécification de taxonomie v1, 1 000 rééchantillons bootstrap par document,
> graine 42.
>
> **Statuts** : ✅ validé = toutes les portes de contrôle passent, citable tel quel ;
> ⏳ préliminaire = le calcul est bon mais une condition de publication manque (ici : le
> GOLD n'est pas figé).
>
> Reproduction : `python research/experiments/run_campaign.py <dataset> --gold-state <json>
> --model-runs <dir>`. Chaque chiffre est également consultable dans la vue
> **Résultats de l'article**, avec sa provenance complète.

## RQ1 — Fiabilité de l'annotation thématique

### E1.1 — Le coût du multi-étiquetage  ·  ✅ validé

**Question.** Que coûte, en accord inter-annotateurs, le passage d'une tâche mono-label à une tâche multi-label ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| α-MASI (corpus complet) — *seuil d'acceptabilité 0,667* | **0.6581** | — |
| α nominal (corpus complet) | **0.7315** | — |
| Coût du multi-label | **0.0735** | [0.0613 ; 0.0874] |

Annoter en multi-étiquettes coûte 0.073 point d'α par rapport à une tâche mono-label sur le MÊME matériau, et ce coût ne s'inverse sur aucun rééchantillon. Avec α-MASI = 0.658, la taxonomie d'annotation reste SOUS le seuil d'acceptabilité de Passonneau : c'est le point de départ de RQ2.

### E1.2 — Fiabilité thème par thème  ·  ✅ validé

**Question.** Quels thèmes sont réellement annotables, et lesquels s'effondrent ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Thèmes sous α = 0,40 | **4** | — |
| α minimal — *DMCA* | **0.1041** | — |
| α maximal — *ARBITRATION_DISPUTES* | **0.8977** | — |

La fiabilité est BIMODALE, pas uniformément basse : DMCA (0.10), FEEDBACK (0.13), COMMUNICATIONS (0.18) s'effondrent, quand MODIFICATION_OF_TERMS (0.81), FEES_PAYMENT (0.86), ARBITRATION_DISPUTES (0.90) s'annotent de façon fiable. Le « mur du κ » est donc LOCALISÉ — c'est ce qui rend une fusion ciblée pertinente plutôt qu'un abandon du multi-label.

### E1.3 — Accord sur les frontières de blocs  ·  ✅ validé

**Question.** Les annotateurs s'accordent-ils sur OÙ commence et finit une clause, et non seulement sur son thème ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Jaccard minimal | **0.3712** | — |
| Jaccard maximal | **0.4707** | — |

La frontière est le POINT DUR de la tâche : l'accord y est de 0.37–0.47 là où l'accord thématique dépasse 0,65. L'écart du nombre de frontières posées (de 2163 à 4121) montre que les annotateurs ne segmentent pas à la même granularité — un résultat à documenter, pas à corriger après coup.

### E1.4 — Cascade de résolution et ambiguïté résiduelle  ·  ⏳ préliminaire

**Question.** Quelle part du gold se résout automatiquement, et que reste-t-il d'irréductiblement ambigu ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Accord unanime (1 clic) | **0.4680** | — |
| Majorité ≥ 2/3 (auto) | **0.4829** | — |
| Arbitrage humain requis — *mesure directe de l'ambiguïté irréductible* | **0.0491** | — |

L'ambiguïté résiduelle de la tâche est de 4.9 % des phrases (462 sur 9414) : c'est la part que trois annotateurs ne parviennent pas à trancher par accord ou majorité, et qui a demandé une décision humaine explicite. Ce n'est pas un défaut du protocole — c'est une mesure de la difficulté intrinsèque du matériau juridique.

> **Ce qui bloque :** GOLD figé (résolutions finalisées) (0/50 résolutions finalisées — le gold reste modifiable, donc le chiffre peut changer)

### E1.5 — Référence humaine (leave-one-annotator-out)  ·  ✅ validé

**Question.** Quel score obtiendrait un annotateur humain évalué comme on évalue un modèle ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Exactitude humaine moyenne | **0.8705** | — |
| κ humain moyen | **0.8594** | — |

Évalué exactement comme un modèle, un annotateur humain obtient 0.871 d'exactitude et κ = 0.859 contre le consensus de ses pairs. C'est la borne à laquelle comparer les modèles et les juges LLM : un système qui l'approche a appris tout ce qui est apprenable de ce matériau, et un système qui la dépasserait signalerait un problème de protocole, pas une prouesse.


## RQ2 — Granularité de la taxonomie

### E2.1 — Comparaison T20 / T14 / T11 / T10  ·  ⏳ préliminaire

**Question.** Une taxonomie plus grossière rend-elle l'annotation significativement plus fiable, et à quel prix ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| α-MASI T20 | **0.6581** | — |
| α-MASI T11 — *Δ apparié contre T20* | **0.7250** | [0.0582 ; 0.0766] |
| Gain de T11 | **0.0669** | [0.0582 ; 0.0766] |
| Coût en signal d'abusivité | **0.0589** | — |

T11 fait franchir le seuil d'acceptabilité que T20 n'atteint pas (0.658 → 0.725, gain +0.0669 [0.0582 ; 0.0766]), pour une perte de signal d'abusivité de 5.9 %. T10 gagne un peu plus d'accord mais perd nettement plus de signal : c'est la preuve que le garde-fou des strates n'est pas un principe esthétique.

> **Ce qui bloque :** GOLD figé (résolutions finalisées) (0/50 résolutions finalisées — le gold reste modifiable, donc le chiffre peut changer)

### E2.2 — Validation des taxonomies sur le hold-out  ·  ✅ validé

**Question.** Le gain de fiabilité de T11 est-il un artefact des documents qui ont servi à concevoir les fusions ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Gain T11 — conception (33 doc.) | **0.0657** | [0.0544 ; 0.0786] |
| Gain T11 — validation (17 doc.) | **0.0687** | [0.0542 ; 0.0852] |

Le gain mesuré hors des données de conception (+0.0687 [0.0542 ; 0.0852]) est au moins aussi élevé que sur les données de conception (+0.0657). Aucun surajustement décelable : la fusion capture une propriété du matériau juridique, pas une particularité des 33 documents qui ont servi à la calibrer.

### E2.3 — Compromis fiabilité ↔ conservation du signal juridique  ·  ⏳ préliminaire

**Question.** Jusqu'où peut-on fusionner sans détruire le signal que la détection de clauses abusives exploite ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Rendement de T11 — *Δ accord par unité de signal perdu* | **1.1300** | — |
| Rendement de T10 | **0.5900** | — |
| Perte de signal T11 | **0.0590** | — |
| Perte de signal T10 | **0.1321** | — |

T11 et T10 gagnent des quantités d'accord comparables, mais T10 perd 2.2 fois plus de signal d'abusivité. La seule fusion qui les sépare — limitation de responsabilité avec exclusion de garantie — réunit deux thèmes aux profils d'abusivité opposés. Le compromis n'est donc pas monotone : il existe un point d'arrêt, et T11 est ce point.

> **Ce qui bloque :** GOLD figé (résolutions finalisées) (0/50 résolutions finalisées — le gold reste modifiable, donc le chiffre peut changer)


## RQ3 — Humains contre modèles de langue

### E3.1 — Matrice d'accord annotateurs × juges LLM  ·  ✅ validé

**Question.** Les modèles de langue s'accordent-ils avec les annotateurs humains autant que les humains entre eux ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| κ humain↔humain (min) | **0.6788** | — |
| κ humain↔humain (max) | **0.7949** | — |
| κ humain↔LLM (max) | **0.5936** | — |
| κ LLM↔LLM (max) | **0.8002** | — |

L'accord entre humains (0.679–0.795) domine strictement l'accord entre un humain et un modèle (au mieux 0.594). Deux modèles s'accordent entre eux jusqu'à 0.800 : les LLM partagent une façon de découper le contrat qui leur est propre et qui n'est pas celle des juristes. Ce n'est donc pas un simple écart de performance — c'est un écart de convention.

### E3.2 — Divergence au pré-remplissage  ·  ✅ validé

**Question.** Quelle part du travail d'annotation consiste à corriger la proposition du modèle ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Divergence minimale | **0.3854** | — |
| Divergence maximale | **0.4864** | — |

Même en la comparant au modèle qui lui ressemble le plus, chaque annotateur modifie 39 à 49 % des propositions. L'annotation assistée n'est donc pas une ratification du modèle : le travail humain reste déterminant, et le corpus n'est pas un décalque des sorties LLM.

### E3.3 — Benchmark des quatre juges contre le GOLD  ·  ⏳ préliminaire

**Question.** Quelle performance atteignent les modèles de langue quand on les évalue contre la référence arbitrée ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Meilleure exactitude (T20) — *fable* | **0.6014** | — |
| Meilleur κ (T20) — *fable* | **0.5805** | — |

Contre la référence arbitrée, le meilleur des quatre juges atteint 0.601 d'exactitude (κ = 0.581), très en dessous de la référence humaine mesurée en E1.5. Le classement des juges ne change pas entre T20 et T11 : la hiérarchie entre modèles n'est donc pas un artefact de granularité.

> **Ce qui bloque :** GOLD figé (résolutions finalisées) (0/50 résolutions finalisées — le gold reste modifiable, donc le chiffre peut changer)


## RQ4 — Modèles compacts

### E4.1 — Modèles compacts : planchers et effet de la taxonomie  ·  ✅ validé

**Question.** Un modèle compact apprend-il mieux la taxonomie fusionnée que la taxonomie d'annotation, et où se situe-t-il par rapport à un annotateur humain ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| macro-F1 TF-IDF (T20) | **0.4834** | [0.4636 ; 0.5082] |
| macro-F1 TF-IDF (T11) | **0.5968** | [0.5786 ; 0.6191] |
| κ TF-IDF (T11) | **0.5700** | — |
| κ référence humaine — *leave-one-annotator-out (E1.5)* | **0.8594** | — |
| Écart au plafond humain (κ) | **0.2894** | — |

Le plancher de position seule (0.108 en T20) confirme que la structure du document ne suffit pas : le texte est nécessaire. Un simple TF-IDF atteint 0.597 de macro-F1 en T11 contre 0.483 en T20 — la taxonomie fusionnée est nettement plus apprenable, ce qui était attendu (classes plus massives, frontières moins contradictoires) mais n'avait jamais été mesuré ici. Il reste néanmoins 0.2894 point de κ sous la référence humaine (0.859) : l'écart à combler est réel.

### E4.2 — Courbe d'apprentissage : combien de documents annoter ?  ·  ✅ validé

**Question.** À partir de combien de documents annotés le gain marginal devient-il négligeable ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| macro-F1 à 8 documents | **0.5379** | — |
| macro-F1 à 40 documents | **0.5968** | — |
| Gain marginal par document (fin de courbe) | **0.0006** | — |

Le gain marginal s'effondre : 0.00390 point de macro-F1 par document au début de la courbe contre 0.00065 à la fin. Passé une trentaine de documents, annoter davantage rapporte très peu à ce modèle — l'effort marginal se justifie mieux sur la QUALITÉ de l'annotation (double annotation, arbitrage) que sur sa quantité.

### E4.3 — Analyse des erreurs : où et pourquoi le modèle échoue  ·  ✅ validé

**Question.** Les erreurs du modèle se concentrent-elles là où les annotateurs eux-mêmes divergent ?

| Métrique | Valeur | IC 95 % |
|---|---|---|
| Taux d'erreur global | **0.3778** | — |
| Erreur — accord strict | **0.2685** | — |
| Erreur — divergence | **0.6688** | — |
| Erreur sur les phrases abusives — *phrases portant une étiquette CLAUDETTE* | **0.3285** | — |

Le modèle échoue 2.5 fois plus souvent sur les phrases où les annotateurs divergent que sur celles où ils sont unanimes (66.9% contre 26.8%). Ses erreurs ne sont donc pas arbitraires : elles se concentrent là où la tâche est objectivement ambiguë, ce qui suggère que la marge de progression réelle est plus étroite que le taux d'erreur global ne le laisse croire — une partie de ces « erreurs » sont des désaccords légitimes.

