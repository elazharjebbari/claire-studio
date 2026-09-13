# Audit complet — matériel, annotations, expérimentations, reste-à-faire

> **Date de l'audit : 13 septembre 2026.** Toutes les données proviennent d'une
> consultation **en lecture seule** de la base de production (`pactiva.legal`,
> projet `campagne-pactiva`) et des artefacts du Lab. Les chiffres d'accord ont été
> **recalculés sur le corpus complet** pour cet audit (annexes reproductibles).
>
> **Le fait majeur : l'annotation est TERMINÉE.** 50 documents × 3 annotateurs =
> 150 annotations, toutes soumises et verrouillées. Conséquence directe : **tous les
> résultats d'expérimentation existants sont périmés** — ils ont été calculés sur
> des instantanés partiels (39 documents, et seulement **12 documents
> multi-annotés** pour les mesures d'accord).

---

## 1. État des lieux du matériel

### 1.1 Corpus et références

| Élément | Quantité | Détail |
|---|---|---|
| Corpus | 1 | `claudette-tos` — CLAUDETTE ToS (UNFAIR-ToS) |
| Documents | **50** | 9 414 phrases au total (min 60, médiane 152, max 548) |
| Étiquettes d'abusivité CLAUDETTE | 1 137 sur 1 032 phrases | taux de base **11,0 %** |
| Répartition par catégorie | LTD 296 · TER 236 · CH 188 · CR 118 · USE 117 · LAW 70 · J 68 · A 44 | les 8 catégories du gold de référence |
| Traductions FR | disponibles | `data/translations` |

### 1.2 Annotations humaines — **campagne complète**

| Annotateur | Documents | Clauses | Validées | Secondaires posées | Frontières « molles » |
|---|---|---|---|---|---|
| zahra.boulaich | 50 / 50 | 9 414 | 100 % | 3 233 | 85 |
| fatima.ouali | 50 / 50 | 9 414 | 100 % | 898 | 275 |
| elazhar.jebbari | 50 / 50 | 9 414 | 100 % | 881 | 1 152 |
| **Total** | **150 annotations** | **28 242 votes** | toutes `submitted` + verrouillées | 5 012 | — |

- **Couverture : 50 documents sur 50 en triple annotation** (contre 12 multi-annotés
  et 3 triples à l'aperçu du 16 août, 33 multi-annotés au 24 août).
- Chronologie des créations : zahra du 23 juin au 27 août (rythme régulier),
  fatima du 31 juillet au 27 août, elazhar en deux temps (juin, puis **39 documents
  les 12–13 septembre**). 311 versions d'annotation tracées.
- Source déclarée : `human` pour les 150 ; aucune annotation de type
  `preannotation_seed`.
- **Contrôle de qualité sur la dernière ligne droite** : la divergence d'elazhar au
  juge LLM le plus proche est de **38,5 %** (§3.3) — ce n'est donc pas une
  ratification du pré-remplissage, mais le rythme (39 documents en 2 jours) justifie
  l'audit par annotateur A1 prévu au papier court.

### 1.3 Pré-annotations LLM (baseline figée)

200 pré-annotations = **4 juges × 50 documents** : `claude`, `codex`, `fable`,
`mistral` (37 656 prédictions phrase-à-phrase après projection par segment).

### 1.4 Gold (arbitrage)

| Mesure | Valeur |
|---|---|
| Résolutions ouvertes | 3 (`9gag`, `Academia`, `Google`) |
| Phrases de gold | 425 |
| **Finalisées** | **0** |
| Décisions humaines enregistrées | 0 (`ArbitrationEvent` = 0) |
| Classes d'accord | strict 174 · majorité 128 · divergence 30 · vide 93 |
| Étages de cascade | `auto_1click` 174 (40,9 %) · `auto` 128 (30,1 %) · `manual` 123 (28,9 %) |

→ **Le gold est le seul chantier humain encore ouvert.** Tant qu'aucune résolution
n'est finalisée, E5 reste un « chiffre d'aperçu » et le dataset gold n'est pas citable.

### 1.5 Datasets versionnés du Lab

8 datasets, tous `ready`. Les plus significatifs :

| Créé | Empreinte | Portée | Contenu |
|---|---|---|---|
| 13 sept 02:18 | `815a0996…` | `min_annotators=3` | 24 docs / 4 676 phrases (**construit avant la fin du travail d'elazhar — déjà périmé**) |
| 24 août 21:37 | `f68c4e9e…` | tous soumis | 50 docs / 9 414 phrases / 15 984 votes |
| 24 août 21:36 | `13aa1fbf…` | `min_annotators=2` | 33 docs / 5 336 phrases |
| 16 août | `ae7e7923…`, `ee4541b6…`, `8076730…` | aperçu papiers | 39 docs / 7 621 phrases |

### 1.6 Infrastructure

| Brique | État |
|---|---|
| Production `pactiva.legal` | en ligne ; 4 services actifs (API, frontend, worker Lab, worker Analyse) |
| Base | PostgreSQL |
| Stockage Lab | 8,1 Go, 261 dossiers de runs |
| **Compte Grid'5000** | **opérationnel** — identifiant `ejebbari`, dernier test **OK le 14 août** (12 sites joignables, SSH établi) |
| Sites G5K utilisés | **lyon** (cluster `gemini`, GPU V100) et **nancy** (`grouille`, CPU) |
| Documentation | 13 dossiers dans `docs/` (papiers, Lab, G5K, fusion de classes, plateforme) |

---

## 2. Expérimentations réalisées — 261 runs

| Statut | Nombre |
|---|---|
| Réussis | **238** |
| Échoués | 20 (18 `result_missing`, 2 `g5k_unreachable`) |
| Annulés | 2 |
| Partiels | 1 |

Répartition par lieu d'exécution : **VPS local 218** · **Grid'5000 GPU 15** ·
**Grid'5000 CPU 6** · environnement non capturé 22.
Toute l'activité se concentre sur **août 2026** (rien depuis le 16 août).

### 2.1 Ce qui a tourné sur Grid'5000

21 runs réels, avec identifiants de jobs OAR (2058813, 2059773–2059801 côté lyon ;
6852543–6853020 côté nancy) :

| Preset | Runs | Ressource | Résultat principal |
|---|---|---|---|
| `legal-bert-finetune` | 3 | V100 `gemini`, 3 h | **macro-F1 0,515** [0,482 ; 0,558], micro 0,634, κ 0,601 |
| `ablation-context` | 6 | V100 | **macro-F1 0,517** [0,479 ; 0,566] — meilleur score global |
| `encoders-comparison` | 4 (+3 échecs) | V100 | RoBERTa-base 0,504 [0,476 ; 0,546] |
| `multilabel-finetune` | 1 | V100 | macro-F1 0,515, subset-accuracy 0,639, hamming 0,036 |
| `sequence-boundary` | 1 (+2 échecs) | V100 | macro-F1 0,352, **WindowDiff 0,555** |
| `baseline-fast` + divers | 6 | CPU nancy | plancher TF-IDF 0,448 |

### 2.2 Ce qui a tourné en local (VPS)

| Preset | Runs | Résultat principal |
|---|---|---|
| `screening-preprocess` | 48 | criblage des axes de prétraitement ; meilleur TF-IDF 0,476 |
| `learning-curve` | 25 | courbe d'apprentissage (meilleur point 0,472) |
| `embeddings-frozen` | 16 | **0,495** [0,460 ; 0,540] — le meilleur rapport qualité/coût |
| `cooccurrence-*` (G2) | 12 | voir §2.4 |
| `llm-judges-baseline` | 4 | **macro-F1 0,317**, κ 0,455 — la référence zéro-shot |
| `ablation-label-noise` | 4 | robustesse au bruit d'étiquettes |
| `ablation-gold-quality` | 3 | 0,469 |
| `baseline-fast`, `position-only`, `knn-explainable` | 7 | planchers : position seule **0,089** (κ 0,155) |
| `iaa-mesure`, `gold-cascade` | 3 | mesures E1–E5 (périmées, §3) |

### 2.3 Lecture d'ensemble des modèles (sur l'instantané à 39 documents)

```
position seule    0,089  ▏
juges LLM         0,317  ▎▎▎
TF-IDF            0,448  ▍▍▍▍
kNN explicable    0,457  ▍▍▍▍
embeddings gelés  0,495  ▌▌▌▌▌   ← plafond humain approximé du run : 0,495
Legal-BERT        0,515  ▌▌▌▌▌
+ contexte        0,517  ▌▌▌▌▌
```

Trois enseignements acquis, indépendants de l'effectif : le **fine-tuning ne gagne
que ~0,02 macro-F1** sur des embeddings gelés (pour un coût GPU sans commune
mesure) ; les **juges LLM sont très loin** derrière tout modèle entraîné
(0,317 contre 0,448 pour un simple TF-IDF) ; la **position seule ne suffit pas**
(0,089), ce qui valide l'intérêt du texte.

### 2.4 La partie graphe (G2, locale)

| Mesure | `source: aggregated` | `source: votes` |
|---|---|---|
| Taux de base | 0,282 | 0,186 |
| Segments | 1 824 | 4 384 |
| Meilleur détecteur **non supervisé** | IsolationForest 0,319 | IsolationForest 0,189 |
| Référence **supervisée** (identité de combinaison) | **0,610** | **0,589** |

Conclusion déjà solide : **rare ≠ abusif** (les détecteurs non supervisés restent au
niveau du taux de base), mais l'**identité de la combinaison de thèmes porte un vrai
signal supervisé** (3,2 × le hasard) — c'est le socle de l'hypergraphe du papier long.

---

## 3. Chiffres d'accord ACTUALISÉS sur le corpus complet

Recalculés pour cet audit sur les 28 242 votes bruts (50 docs × 3 annotateurs),
IC bootstrap par document, 1 000 tirages. **À comparer aux valeurs publiées, qui
reposaient sur 12 documents.**

### 3.1 E1 — le coût du multi-label (chiffre-titre du papier court)

| Source | Docs | α-MASI | α nominal | Δ (coût) [IC 95 %] | Stabilité du signe |
|---|---|---|---|---|---|
| Run du 16 août (publié) | 12 | 0,625 | 0,688 | 0,063 [0,031 ; 0,086] | 100 % |
| **Audit, corpus complet** | **50** | **0,658 [0,626 ; 0,691]** | **0,732** | **0,0735 [0,0613 ; 0,0874]** | **100 %** |

Le coût du multi-label **se confirme et se resserre** : l'IC passe de 0,055 de large
à 0,026. L'α-MASI monte de 0,625 à **0,658** — mais reste **juste sous le seuil
d'acceptabilité de Passonneau (0,667)**, l'IC le chevauchant.

### 3.2 E2 — matrice annotateurs × juges (κ de Cohen, thème primaire)

|  | elazhar | fatima | zahra | claude | codex | fable | mistral |
|---|---|---|---|---|---|---|---|
| **elazhar** | — | **0,795** | **0,722** | 0,533 | 0,265 | 0,594 | 0,342 |
| **fatima** | 0,795 | — | **0,679** | 0,444 | 0,239 | 0,541 | 0,297 |
| **zahra** | 0,722 | 0,679 | — | 0,488 | 0,300 | 0,447 | 0,291 |
| claude | 0,533 | 0,444 | 0,488 | — | 0,436 | *0,800* | 0,540 |

**Le résultat central du papier court tient et se renforce** : accord humain↔humain
**0,679–0,795**, accord humain↔LLM **jamais au-dessus de 0,594**. Détail notable :
`claude` et `fable` s'accordent entre eux à 0,800 — les LLM se ressemblent plus
entre eux qu'ils ne ressemblent aux humains.

### 3.3 E3 et E4 — frontières et divergence au pré-remplissage

| Mesure | Valeur (corpus complet) |
|---|---|
| Jaccard des frontières reconstruites | **0,371 – 0,471** (elazhar↔fatima 0,471 · fatima↔zahra 0,442 · elazhar↔zahra 0,371) |
| Nombre de frontières posées | elazhar 2 163 · fatima 3 083 · zahra 4 121 |
| Divergence au juge le plus proche | elazhar **38,5 %** (fable) · fatima **43,7 %** (fable) · zahra **48,6 %** (claude) |

La frontière reste **le point dur** (0,37–0,47 contre 0,68–0,80 sur le thème), et
l'écart de granularité entre annotateurs (2 163 vs 4 121 frontières) est en soi un
résultat à documenter.

### 3.4 Fiabilité par thème — les 4 classes non exploitables

| Thème | α | AC1 | Votes |
|---|---|---|---|
| DMCA | **0,104** | 0,988 | 182 |
| FEEDBACK | **0,125** | 0,992 | 124 |
| COMMUNICATIONS | **0,184** | 0,979 | 360 |
| PROMOTIONS | **0,240** | 0,995 | 95 |
| … (16 autres) | 0,511 → 0,898 | | |

Le haut du classement : ARBITRATION_DISPUTES 0,898 · FEES_PAYMENT 0,864 ·
MODIFICATION_OF_TERMS 0,813 · LICENSE_IP 0,772.

### 3.5 La fusion de classes, revérifiée sur le corpus complet

Le dossier `docs/pactiva-fusion-classes/` (25 août) concluait à T11 sur 33 documents.
**Rejoué sur les 50 documents, le verdict se renforce** :

| Schéma | α-MASI [IC 95 %] | Δ apparié vs T20 | Désaccords | AP abusivité (combo) |
|---|---|---|---|---|
| T20 (statu quo) | 0,658 [0,626 ; 0,691] | — | 24,8 % | 0,413 |
| T14 | 0,693 [0,663 ; 0,727] | +0,035 [+0,030 ; +0,042] | 21,0 % | 0,384 |
| **T11** | **0,725 [0,691 ; 0,760]** | **+0,067 [+0,057 ; +0,077]** | 18,0 % | **0,384** |
| T10 | 0,737 [0,703 ; 0,771] | +0,078 [+0,068 ; +0,090] | 17,4 % | 0,357 |

**T11 place la ressource à 0,725, très au-dessus du seuil de 0,667** (que T20
n'atteint pas), pour −6,9 % d'AP d'abusivité, quand T10 en coûte −13,5 %. Le
garde-fou des strates d'abusivité est confirmé sur données complètes.

---

## 4. Ce qu'il reste à faire pour le papier court

### 4.1 Le schéma

```
   ÉTAT AU 13 SEPT                    CE QU'IL RESTE                       LIVRABLE PAPIER
   ═══════════════                    ══════════════                       ═══════════════

   ✅ 50 docs × 3 annotateurs    ──►  ① Reconstruire le dataset      ──►  dataset daté + empreinte
      150 annotations soumises          (1 clic, ~2 min)                    = l'annexe citable
                                        min_annotators=3, submitted
                                              │
   ⚠️  Tous les runs de mesure               ▼
      datent du 16 août sur     ──►  ② Rejouer `iaa-mesure`         ──►  E1 Δ=0,074 [0,061;0,087]
      12 documents                      (~10 min, local)                   E2 matrice 7×7
                                              │                            E3 frontières 0,37–0,47
                                              │                            E4 divergence 38–49 %
                                              ▼                            + α par thème (20)
   🆕 Fusion T11 validée         ──►  ③ Implémenter l'axe            ──►  LE résultat neuf :
      (simulée, hors Lab)              `theme_map` (~1 j)                  « granularité vs fiabilité »
                                        puis 4 runs `iaa-mesure`           0,658 → 0,725 (+0,067)
                                              │
   ❌ Gold : 0 finalisé                       ▼
      3 résolutions ouvertes    ──►  ④ Arbitrer + finaliser         ──►  E5 réel (cascade + coût)
      123 phrases `manual`             ≥ 3 documents (humain)              « ambiguïté résiduelle »
                                              │
                                              ▼
   ✅ Juges LLM en base          ──►  ⑤ Rejouer `llm-judges-baseline` ──► écho R2 : le mur du κ
      4 × 50 docs                      + `sequence-boundary` (GPU)         écho contribution 3
                                              │
                                              ▼
                                       ⑥ Rédaction (4 pages)
```

### 4.2 Le détail, par ordre d'exécution

| # | Action | Qui | Coût | Bloquant pour |
|---|---|---|---|---|
| **①** | Construire un dataset `submitted` + `min_annotators=3` sur les 50 documents | Lab, 1 clic | ~2 min | tout le reste |
| **②** | Rejouer `iaa-mesure` sur ce dataset | Lab, local | ~10 min | E1, E2, E3, E4 |
| **③** | Implémenter l'axe `data.theme_map` (protocole `docs/pactiva-fusion-classes/03`) puis 4 runs `iaa-mesure` (T20/T14/T11/T10) | dev | ~1 j + 40 min | le résultat neuf du papier |
| **④** | **Arbitrer les 123 phrases `manual` des 3 résolutions et les finaliser** | humain (vous) | ~2–3 h | E5 réel, maturité de la ressource |
| **⑤** | Rejouer `gold-cascade` après ④, puis `llm-judges-baseline` et `sequence-boundary` sur le dataset complet | Lab (local + 1 job GPU ~4 h) | ~5 h | échos R2 et contribution 3 |
| **⑥** | Audit par annotateur A1 : un run `iaa-mesure` suffit (volet `divergence.annotators`) | Lab | inclus dans ② | la section « qualité de la ressource » |

### 4.3 Ce qui est DÉJÀ acquis pour le papier court

- Le **corpus est complet et homogène** (50 documents, 3 annotateurs, aucun document
  partiel) — c'est la condition que le papier de mesure ne pouvait pas remplir en août.
- Les **quatre résultats structurants** sont établis et se renforcent sur données
  complètes : coût du multi-label (Δ 0,074), mur du κ (humains 0,68–0,80 vs LLM
  ≤ 0,59), difficulté des frontières (0,37–0,47), divergence au pré-remplissage
  (38–49 %).
- Un **résultat neuf et publiable** est en réserve : la courbe granularité ↔ fiabilité
  (T20 → T11), avec sa contrainte de non-destruction du signal d'abusivité.
- La **baseline LLM** (4 juges × 50 documents) est en base, gratuite à rejouer.

### 4.4 Les risques à traiter explicitement

1. **α-MASI à 0,658 sous T20** : sous le seuil de 0,667. Deux options honnêtes —
   publier la mesure telle quelle (c'est un papier de mesure, le constat a de la
   valeur) **et** montrer que T11 la fait passer à 0,725. La seconde est la plus forte.
2. **Rythme de la dernière ligne droite** (39 documents en 2 jours par elazhar) : à
   traiter par l'audit A1 (divergence par annotateur, déjà mesurée à 38,5 % — le
   travail d'édition est réel) et à mentionner comme limite de protocole.
3. **Gold non finalisé** : sans ④, E5 reste un aperçu et la ressource ne peut pas
   être annoncée comme arbitrée.
4. **18 runs `result_missing`** (encoders-comparison, sequence-boundary) : à
   diagnostiquer avant de relancer la campagne GPU.

---

## Annexes reproductibles

`annexes/` contient les sorties JSON de cet audit et les deux scripts de calcul :

| Fichier | Contenu |
|---|---|
| `etat_prod.json` | instantané de la base prod (annotations, gold, datasets, 261 runs) |
| `explore_full.json` | statistiques du corpus complet (supports, confusions, α par thème, CLAUDETTE) |
| `e1_results.json` | E1 (coût du multi-label) pour les 4 schémas de taxonomie |
| `e234_results.json` | matrice κ 7×7, Jaccard des frontières, divergence par annotateur |
| `simulate_full.json`, `paired_full.json` | fusion de classes rejouée sur le corpus complet |
| `e1.py`, `e234.py` | scripts (lecture seule, pur Python + `pactiva_lab`) |

Les scripts de fusion réutilisés sont ceux de `docs/pactiva-fusion-classes/scripts/`.
