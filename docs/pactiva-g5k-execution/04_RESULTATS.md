# Résultats de la campagne Grid'5000

**Exécuté le 13–14 septembre 2026** · Site **lyon**, cluster **gemini** (Tesla V100-SXM2 32 Go)
· Dataset final `7116e627f528c557` (50 documents, 9 414 phrases)

Tous les chiffres ci-dessous sont reproductibles : chaque répertoire de `research/runs/`
porte un `_PROVENANCE.json` (identifiant de run, configuration complète, numéro de job OAR,
empreinte du dataset, date).

---

## 1. Ce qui a tourné

| Run | Tâche | Taxonomie | Machine | Durée | Job OAR |
|---|---|---|---|---|---|
| `tfidf_T11` | T1 mono-label | T11 | nancy (CPU) | 25 s | 6925504 |
| `legalbert_T20` | T1 mono-label | T20 | lyon, gemini (V100) | 36,9 min | 2066886 |
| `legalbert_T11` | T1 mono-label | T11 | lyon, gemini (V100) | 36,2 min | 2066889 |
| `legalbert_multilabel_T11` | T2 multi-label | T11 | lyon, gemini (V100) | 45,4 min | 2066893 |

Huit baselines CPU (positions, TF-IDF, courbe d'apprentissage) ont été **reconstituées sur
le serveur** plutôt que sur Grid'5000 : quelques secondes de calcul chacune, et la
documentation Grid'5000 déconseille explicitement de soumettre de nombreux petits jobs OAR.

---

## 2. Une preuve de reproductibilité obtenue en chemin

Les répertoires de runs ayant servi à la campagne publiée avaient disparu (ils vivaient
dans un répertoire temporaire). Les rejouer sur le dataset final a produit :

| Run | Campagne publiée | Réexécution | Écart |
|---|---|---|---|
| `position_T20` | 0,107802 | 0,107802 | 0 |
| `position_T11` | 0,144594 | 0,144594 | 0 |
| `tfidf_T20` | 0,483408 | 0,483408 | 0 |
| `tfidf_T11` | 0,596799 | 0,596799 (**sur Grid'5000**) | 0 |
| `lc_8` … `lc_32` | 0,537906 … 0,591616 | identiques | 0 |

Le cas `tfidf_T11` est le plus instructif : l'original avait tourné **localement**, la
réexécution sur un **nœud Grid'5000** — mêmes six décimales. La chaîne de calcul est donc
déterministe d'un environnement à l'autre, ce qui n'était jusqu'ici qu'une intention.

---

## 3. Résultat principal — E4.4 : la fusion tient sur un modèle capacitif

Même dataset, mêmes plis, même graine. **Seules les étiquettes changent.**

| | T20 (annotation) | T11 (fusionnée) |
|---|---|---|
| Classes | 20 | 11 |
| macro-F1 | 0,613 [0,576 ; 0,638] | **0,735** [0,710 ; 0,758] |
| micro-F1 | 0,719 | 0,754 |
| κ | 0,695 | **0,720** |
| Dispersion inter-plis | 0,028 | 0,022 |

**Ce que cela tranche.** L'écart T20→T11 observé sur les planchers lexicaux
(0,483 → 0,597 en TF-IDF) aurait pu n'être qu'un artefact de faible capacité : un modèle
pauvre souffre davantage de classes rares et de frontières contradictoires. Le fine-tuning
d'un encodeur juridique écarte cette explication — la fusion reste favorable.

**Ce que cela ne tranche pas, et qu'il faut dire.** Les deux macro-F1 ne sont pas la même
quantité : moyenne sur 20 classes contre moyenne sur 11, T20 étant mécaniquement pénalisée
par ses classes rares. Le κ est moins sensible à cet effet sans y échapper (l'accord
attendu par hasard dépend lui aussi de la distribution). **Le chiffre prudent à citer est
donc le gain en κ : +0,025**, très inférieur à ce que suggère la macro-F1 (+0,122).

**Écart au plafond humain.** Le fine-tuning réduit l'écart de **0,289 à 0,140 point de κ**
par rapport à la référence humaine (0,859) — il en comble donc un peu plus de la moitié.

---

## 4. Résultat négatif — E4.5 : l'agrégation a effacé la tâche multi-label

Hypothèse déclarée : la performance multi-label devait être *nettement inférieure* à la
performance mono-label. **Elle ne l'est pas** (0,754 contre 0,735). L'hypothèse est
réfutée, et la mesure qui l'explique a été faite exprès :

| Mesure | T20 | T11 |
|---|---|---|
| Étiquettes par phrase (moyenne) | 1,052 | **1,043** |
| Part des phrases à ≥ 2 étiquettes | 5,1 % | **4,2 %** |
| Maximum observé | 3 | 3 |

Le dataset **agrégé en consensus** ne porte quasiment plus de multi-étiquetage, alors que
les annotations individuelles en contiennent — c'est précisément ce que mesure E1.1 sur les
votes (α-MASI 0,658 < α nominal 0,732 en T20).

**Conséquence méthodologique, à ne pas contourner** : ce chiffre ne peut pas être présenté
comme « la performance du modèle sur la tâche réellement annotée ». Le mesurer exige un
dataset construit en agrégation souple (`aggregation='soft'`), qui conserve les étiquettes
concurrentes au lieu de trancher. Tant que ce dataset n'existe pas, l'affirmation n'est pas
soutenable — et la version actuelle de E4.5 le dit dans ses limites plutôt que de publier
un 0,754 flatteur.

---

## 5. État de la campagne

**16 expériences** (4 de plus qu'avant cette session), dont **12 validées** et 4
`preliminary`.

Les quatre en attente (E1.4, E2.1, E2.3, E3.3) sont bloquées par les contrôles
`gold_finalized` et `gold_complete` : **50 résolutions GOLD ouvertes, 0 finalisée**. Ce
n'est pas un défaut de la campagne, c'est son garde-fou qui fonctionne — ces expériences
basculeront en `validated` d'elles-mêmes une fois l'arbitrage terminé, en rejouant
`run_campaign.py`.

---

## 6. Ce qui reste ouvert

- **`encoders-comparison`** (Legal-BERT contre RoBERTa, DeBERTa, ModernBERT) : ~6 h GPU,
  non lancé. Ses checkpoints restent à pré-télécharger — le correctif du protocole Xet est
  en place mais n'a pas été rejoué.
- **Dataset en agrégation souple**, prérequis d'un vrai résultat multi-label (§4).
- **Finalisation du GOLD**, qui débloque les quatre expériences restantes (§5).
