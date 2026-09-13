# 02 — Résultats expérimentaux

> Produits par `research/experiments/run_taxonomy_matrix.py` sur l'export Lab
> `7116e627f528c557` (50 documents, 9 414 phrases, 28 242 votes, 150 annotations soumises,
> agrégation `consensus` versionnée du Lab), spécification de taxonomie `v1`
> (empreinte `f6cdd2715df02177`), 1 000 rééchantillons bootstrap par document, graine 42.
>
> **Reproduction** : `python research/experiments/run_taxonomy_matrix.py <dataset> <sortie>`.
> Chaque cellule du JSON porte l'empreinte du dataset, celle de la spécification, la
> population et la source : un chiffre de ce dossier est rejouable sans ambiguïté.

## 1. Lecture des tableaux

- **α-MASI** : accord inter-annotateurs sur les JEUX de thèmes (multi-étiquettes), distance
  MASI. Seuils de Passonneau : ≥ 0,667 acceptable, ≥ 0,8 fiable.
- **α nominal** : le même accord sur le seul thème primaire (projection mono-label).
- **Δ apparié vs T20** : les deux α recalculés sur les MÊMES tirages bootstrap de
  documents — l'intervalle porte sur la différence, pas sur deux intervalles comparés à
  l'œil. « Signe stable » = part des tirages où le gain ne s'inverse pas.
- **Désaccords** : part des paires d'annotateurs qui divergent sur le thème primaire.
- **AP abusivité** : average precision, en validation leave-one-document-out, du prédicteur
  P(abusif | combinaison de thèmes), contre la référence CLAUDETTE — qui n'est jamais
  projetée. C'est le **coût** de la fusion : ce que l'on perd en pouvoir de détection.

## 2. Les tableaux

### Corpus complet — 50 documents

| Taxo | Classes | α-MASI | α nominal | Δ apparié vs T20 [IC 95 %] | Signe stable | Désaccords | AP abusivité (consensus) | AP abusivité (gold) |
|---|---|---|---|---|---|---|---|---|
| T20 | 20 | **0.6581** | 0.7315 | — | — | 24.8 % | 0.4038 | 0.4180 |
| T14 | 14 | **0.6932** | 0.7684 | **+0.0351** [0.0302 ; 0.0413] | 100 % | 21.0 % | 0.3760 | 0.3914 |
| T11 | 11 | **0.7250** | 0.7940 | **+0.0669** [0.0585 ; 0.0772] | 100 % | 18.0 % | 0.3757 | 0.3934 |
| T10 | 10 | **0.7365** | 0.7998 | **+0.0784** [0.0686 ; 0.0893] | 100 % | 17.4 % | 0.3531 | 0.3628 |

### Conception — 33 documents

| Taxo | Classes | α-MASI | α nominal | Δ apparié vs T20 [IC 95 %] | Signe stable | Désaccords | AP abusivité (consensus) | AP abusivité (gold) |
|---|---|---|---|---|---|---|---|---|
| T20 | 20 | **0.6536** | 0.7206 | — | — | 25.9 % | 0.4139 | 0.4129 |
| T14 | 14 | **0.6909** | 0.7614 | **+0.0373** [0.0301 ; 0.0475] | 100 % | 21.6 % | 0.3729 | 0.3720 |
| T11 | 11 | **0.7192** | 0.7861 | **+0.0657** [0.0548 ; 0.0785] | 100 % | 18.8 % | 0.3727 | 0.3707 |
| T10 | 10 | **0.7320** | 0.7926 | **+0.0784** [0.0659 ; 0.0940] | 100 % | 18.0 % | 0.3303 | 0.3369 |

### Validation (hold-out) — 17 documents

| Taxo | Classes | α-MASI | α nominal | Δ apparié vs T20 [IC 95 %] | Signe stable | Désaccords | AP abusivité (consensus) | AP abusivité (gold) |
|---|---|---|---|---|---|---|---|---|
| T20 | 20 | **0.6635** | 0.7455 | — | — | 23.4 % | 0.3873 | 0.3893 |
| T14 | 14 | **0.6957** | 0.7771 | **+0.0322** [0.0261 ; 0.0392] | 100 % | 20.2 % | 0.3819 | 0.3878 |
| T11 | 11 | **0.7322** | 0.8041 | **+0.0687** [0.0542 ; 0.0846] | 100 % | 17.0 % | 0.3822 | 0.3899 |
| T10 | 10 | **0.7420** | 0.8088 | **+0.0785** [0.0603 ; 0.0946] | 100 % | 16.5 % | 0.3714 | 0.3752 |
## 3. Ce que ces chiffres établissent

### 3.1 T20 n'atteint le seuil sur aucune population

0,654 / 0,658 / 0,663 selon la population : la taxonomie d'annotation reste **sous le seuil
d'acceptabilité** de Passonneau. Ce n'est pas un accident d'échantillonnage — le constat est
identique sur les trois populations.

### 3.2 Le gain de T11 se reproduit hors des données de conception

C'est le résultat qui autorise à publier une recommandation : **+0,0687 [0,0542 ; 0,0846]
sur les 17 documents de validation**, contre +0,0657 sur les 33 de conception. Le gain
n'est pas une propriété des données qui ont servi à calibrer les fusions. Le signe est
stable sur 100 % des 1 000 rééchantillons, sur les trois populations et pour les trois
schémas.

### 3.3 Le garde-fou des strates d'abusivité tient partout

T10 ne diffère de T11 que par UNE fusion supplémentaire (limitation de responsabilité +
exclusion de garantie). Son coût en signal d'abusivité est systématiquement le plus élevé :

| Population | Coût relatif T11 (consensus) | Coût relatif T10 (consensus) | Rapport |
|---|---|---|---|
| Corpus complet | −7,0 % | −12,6 % | 1,8 × |
| Conception | −10,0 % | −20,2 % | 2,0 × |
| Validation | −1,3 % | −4,1 % | 3,2 × |

Sur le hold-out, T11 ne coûte **presque rien** (−1,3 %) là où T10 coûte trois fois plus.
Le même ordre se retrouve sur le gold (T11 −5,9 %, T10 −13,2 % sur le corpus complet).
La règle « fusionner le long des confusions, jamais à travers les strates d'abusivité »
est donc vérifiée hors des données qui l'ont motivée.

### 3.4 Le gold suit les annotations

Le gold (9 414 phrases décidées : 4 406 accords stricts, 4 546 majorités, 462 arbitrages)
se projette comme les annotations, et son signal d'abusivité se dégrade dans le même ordre
(T20 0,418 → T11 0,393 → T10 0,363). La cascade elle-même est inchangée : la projection ne
touche ni les décisions, ni les niveaux d'auto-résolution.

### 3.5 L'apprenabilité progresse dans la même direction

| Taxonomie | Classes | Support minimal (consensus, 50 doc.) | Multi-label |
|---|---|---|---|
| T20 | 20 | **10** (PROMOTIONS) | 5,1 % |
| T14 | 14 | 78 (COMMUNICATIONS) | 5,0 % |
| **T11** | **11** | **260** (PRIVACY_DATA) | 4,2 % |
| T10 | 10 | 260 (PRIVACY_DATA) | 3,9 % |

Une classe à 10 phrases n'est ni apprenable ni mesurable ; T11 porte le plancher à 260.
La baisse du taux multi-label est une **résorption d'ambiguïté**, pas une perte : les jeux
{LICENSE_IP + USER_CONTENT} deviennent des singletons cohérents.

## 4. Trois limites, déclarées

1. **Le hold-out n'est que partiellement aveugle.** La structure des fusions (quels thèmes
   regrouper) dérive des désaccords entre annotateurs, qui n'existent que sur les documents
   multi-annotés au 24 août — les 17 n'ont fourni aucune paire. En revanche les supports et
   les strates d'abusivité ont été calculés sur les 50. **Vérification faite** : recalculés
   sur les 33 seuls, ils donnent la même décision (limitation de responsabilité lift 3,43
   contre exclusion de garantie 0,32 — rapport de 10× ; classes fusionnées à 993, 872, 871
   et 555 phrases, toutes au-dessus du seuil de 300). La contamination est documentée et
   sans effet sur le choix des mappings.
2. **Le hold-out n'a pas été annoté en aveugle.** Sur ces 17 documents, la deuxième et la
   troisième annotation sont postérieures à la conception (fin août, puis 12–13 septembre) :
   ils sont indépendants de la conception, mais n'ont pas été produits dans les mêmes
   conditions de rythme.
3. **L'AP LODO n'est pas l'AUC-PR d'un détecteur entraîné.** C'est une borne d'information
   (le mieux qu'un prédicteur par identité de combinaison puisse faire), utilisée ici en
   RELATIF entre taxonomies — la valeur absolue viendra des runs G2.
