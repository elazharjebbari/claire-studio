# Plan scientifique — apprentissage supervisé des thèmes de clauses

> Le protocole expérimental complet : ce qu'on cherche, comment on le mesure, ce qui doit être
> comparé à quoi, et pourquoi. Ce document est la **spécification fonctionnelle** du module
> d'expérimentation décrit dans [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md).

---

## 1. La tâche, définie sans ambiguïté

**Entrée.** Une phrase d'un document de conditions d'utilisation, avec son contexte
(les phrases voisines, la position relative dans le document).

**Sortie.** Un sous-ensemble non vide des **20 thèmes** du vocabulaire `claire-themes-v1`, dont
exactement un est marqué **primaire**.

Cela se décline en **trois tâches distinctes**, à ne pas confondre — et à évaluer séparément :

| Tâche | Formulation | Pourquoi elle compte |
|---|---|---|
| **T1 — Thème primaire** | classification **mono-label**, 20 classes | Comparable au κ humain (0,769) et aux juges LLM. C'est la tâche de référence. |
| **T2 — Ensemble de thèmes** | classification **multi-label**, 20 étiquettes | Comparable à α-MASI (0,635). C'est la tâche réelle du protocole d'annotation. |
| **T3 — Segmentation** | frontière de segment : la phrase *i* ouvre-t-elle un nouveau segment ? | C'est le point dur (Jaccard humain 0,39–0,63). Tâche binaire séquentielle. |

> **Erreur à ne pas commettre :** rapporter un seul F1 « de la tâche ». Les trois tâches ont des
> plafonds humains différents et des difficultés différentes. Les mélanger rend le résultat
> ininterprétable.

---

## 2. Questions de recherche

| # | Question | Ce qu'elle produit dans l'article |
|---|---|---|
| **Q1** | Un classifieur supervisé entraîné sur ce gold atteint-il le **plafond humain** ? | Le résultat principal : « oui à X % du plafond sur T1, non sur T2 » |
| **Q2** | Le **contexte** (phrases voisines, position) améliore-t-il l'étiquetage ? | Contribution originale : le thème d'une phrase juridique est largement positionnel |
| **Q3** | Quel **prétraitement** convient à un corpus juridique pré-tokenisé ? | Section méthodologique + garde-fou pour la communauté |
| **Q4** | Les **embeddings gelés** suffisent-ils, ou faut-il un *fine-tuning* ? | Arbitrage coût/performance, utile en pratique |
| **Q5** | Le modèle supervisé bat-il les **4 juges LLM** sur le même corpus ? | Ferme la boucle du « mur du κ » : humains > modèle supervisé > LLM ? |
| **Q6** | Combien de documents annotés faut-il pour atteindre un niveau utile ? | **Courbe d'apprentissage** — le résultat le plus actionnable pour la suite du projet |

**Q6 mérite un mot.** C'est la question que se pose tout projet d'annotation juridique : *quand
peut-on s'arrêter d'annoter ?* Avec une courbe d'apprentissage par nombre de documents (5, 10,
20, 30, 40…), on répond empiriquement. Aucune donnée nouvelle n'est requise — juste des
sous-échantillonnages. **C'est le meilleur rapport résultat/effort du plan.**

---

## 3. Protocole expérimental — les invariants non négociables

### 3.1 Split **par document**, jamais par phrase
Les phrases d'un même ToS partagent vocabulaire, style et structure. Un split aléatoire par
phrase place des phrases du même contrat en train et en test → **fuite**, scores gonflés de
plusieurs points, résultat non publiable.
→ **`GroupKFold` sur `document_id`**, 5 plis, **stratifié** autant que possible sur la
distribution thématique. Les plis sont **figés dans le dataset** (`splits.json`) et réutilisés
par **toutes** les expériences : deux modèles ne sont comparables que sur les mêmes plis.

### 3.2 Le **plafond humain** accompagne chaque métrique
Sur les documents multi-annotés, on calcule la performance d'**un annotateur pris comme
prédiction d'un autre**. C'est la borne supérieure réaliste.
→ Chaque tableau de résultats a une ligne `human_ceiling`. Un modèle à 0,72 de macro-F1 quand
le plafond est à 0,74 est un **excellent** résultat ; le même 0,72 présenté seul ne veut rien
dire.

### 3.3 Intervalles de confiance **par bootstrap au niveau document**
Rééchantillonnage des documents (pas des phrases), 1 000 tirages, IC à 95 %. Avec 30–50
documents, l'incertitude est réelle et doit être visible. **Un résultat sans IC ne va pas dans
l'article.**

### 3.4 Graine fixée, environnement capturé
Chaque run enregistre : graine, versions des bibliothèques, empreinte du dataset, empreinte de
la configuration. Deux runs de même empreinte doivent donner le même résultat — **c'est un test
automatisé**, pas une promesse.

### 3.5 Aucune sélection de modèle sur le test
Réglage des hyperparamètres en **validation interne** (split imbriqué ou pli de validation
dédié). Le test ne sert qu'une fois, à la fin. Toute violation invalide l'article.

---

## 4. Les données — versions d'avancement

Le module doit produire un dataset à **n'importe quel stade** de la campagne, selon des critères
explicites, et pas seulement sur les annotations soumises.

**Quatre niveaux de maturité d'une annotation** (du plus permissif au plus strict) :

| Niveau | Critère | Usage |
|---|---|---|
| `any` | toute annotation existante | exploration seulement |
| **`complete`** | **toutes les phrases portent une clause validée** (`validated=True`), quel que soit le statut | **le niveau utile** — capture le travail fini mais non soumis |
| `submitted` | statut ∈ {submitted, in_review, approved} | conforme au workflow |
| `gold` | phrase issue d'une `GoldResolution` **finalisée** | l'étalon final |

> **`complete` est la réponse à « les documents finis et pas seulement ceux soumis ».** Sur
> l'instantané du 11 août, il fait passer de 35 à **45 annotations** exploitables (les 10 de
> `fatima.ouali`, validées à 99,9 %, sont invisibles au filtre `submitted`).

**Trois politiques d'agrégation** quand plusieurs annotateurs couvrent un document :

- `single` — un annotateur désigné (analyse d'un annotateur, ou corpus mono-annoté) ;
- `consensus` — la cascade `gold_scoring` appliquée à la volée (accord strict/majorité) ;
- `soft` — distribution des votes conservée, pour l'apprentissage *perspectiviste* et la
  mesure de calibration.

**Le dataset est immuable et signé** : `dataset_id` = empreinte de (critères + contenu). Un
tableau de l'article cite un `dataset_id` ; on peut le régénérer à l'identique.

---

## 5. Prétraitement — les combinaisons à tester

Le corpus CLAUDETTE est **pré-tokenisé** : `« terms and conditions of use »`, `« you ' re »`,
espaces avant ponctuation. C'est un piège concret : les tokenizers de transformers modernes
sont entraînés sur du texte naturel, pas détokenisé. **La détokenisation est probablement le
prétraitement le plus rentable du lot** — et c'est une observation publiable.

| Axe | Options | Remarque |
|---|---|---|
| **Détokenisation** | `none` · `moses` · `regex_rules` | Restaure la ponctuation naturelle. **À tester en premier.** |
| **Casse** | `keep` · `lower` | Sans objet pour les modèles *cased* ; compte pour TF-IDF |
| **Normalisation juridique** | `none` · `mask_entities` (numéros de section, URL, montants, dates, noms de société) | Évite la mémorisation du nom du service |
| **Mots vides** | `none` · `english` · `legal_custom` | Uniquement pour les modèles sacs-de-mots |
| **Lemmatisation / racinisation** | `none` · `lemma` · `stem` | Idem ; nuit généralement aux transformers |
| **Contexte** | `none` · `prev1` · `prev2next1` · `window±3` · `section_header` · `doc_position` | **L'axe le plus prometteur (Q2)** |
| **Longueur** | troncature 64 / 128 / 256 jetons | Le contexte coûte des jetons |

**Stratégie de recherche.** Une grille complète est combinatoirement absurde. On procède en
**deux étages** : (1) un **criblage** sur un modèle rapide et peu coûteux (TF-IDF + régression
logistique) pour éliminer les axes sans effet ; (2) une **grille réduite** aux 2–3 axes
survivants, sur les modèles lourds. Le module doit rendre ce protocole explicite — pas
lancer 400 runs à l'aveugle.

---

## 6. Familles de modèles

### 6.1 Références indispensables (baselines)
Sans elles, aucun relecteur ne croira aux gains des gros modèles.

| Modèle | Rôle |
|---|---|
| **Majorité / a priori** | Plancher absolu |
| **TF-IDF + régression logistique** (One-vs-Rest) | La baseline honnête ; souvent redoutable en juridique |
| **TF-IDF + SVM linéaire** | Variante classique |
| **Position seule** (index relatif dans le document) | **Baseline diagnostique** : mesure ce que la structure seule prédit. Si elle est forte, Q2 est déjà à moitié répondue. |
| **Les 4 juges LLM** (fable, claude, codex, mistral) | **Baseline gratuite et déjà en base** — comparateur direct pour Q5 |

### 6.2 Encodeurs à *fine-tuner*
- **Legal-BERT** (`nlpaueb/legal-bert-base-uncased`) — spécialisé juridique, référence
  UNFAIR-ToS/LexGLUE.
- **RoBERTa-base**, **DeBERTa-v3-base** — références généralistes fortes.
- **ModernBERT-base** — encodeur récent, contexte long : pertinent pour l'axe contexte.
- *(optionnel)* **Legal-RoBERTa** / **CaseLaw-BERT** selon disponibilité.

Tête de classification : `sigmoid` + BCE pour T2 (multi-label), `softmax` + cross-entropy pour
T1. **Pondération des classes** obligatoire vu la longue traîne ; comparer avec **focal loss**.

### 6.3 Approches par embeddings (gelés)
Encoder chaque phrase une fois, puis entraîner un classifieur léger dessus. Peu coûteux,
excellent rapport qualité/prix, et **exécutable sans GPU**.

- **Sentence-Transformers** : `all-mpnet-base-v2`, `all-MiniLM-L6-v2`
- **E5** (`intfloat/e5-large-v2`), **BGE** (`BAAI/bge-large-en-v1.5`), **GTE** — têtes de
  classements MTEB
- **Legal-BERT en extraction de traits** (moyenne des états cachés) — pour isoler l'effet du
  *fine-tuning* de l'effet du domaine
- Têtes : régression logistique · SVM · **k-NN** (interprétable : « les 5 phrases les plus
  proches ») · MLP léger

> Le **k-NN sur embeddings** mérite une attention particulière : il fournit une **explication
> par l'exemple** (« cette phrase ressemble à celles-ci, étiquetées ainsi »), ce qui a une
> valeur propre en AI & Law et alimente l'atelier d'annotation en suggestions.

### 6.4 Modélisation de la structure
- **Étiquetage de séquence** au niveau document (BiLSTM-CRF ou transformer + CRF) : exploite le
  fait que les thèmes viennent **par blocs**. Traite T1 et T3 conjointement.
- **Chaînes de classifieurs** / **exploitation de la co-occurrence** des étiquettes pour T2 —
  et cela **rejoint directement l'objectif B** (hypergraphe de co-occurrence).

### 6.5 LLM en zero/few-shot
Déjà disponibles : les 4 juges. À **ne pas relancer** — les prédictions sont en base. Les
traiter comme une baseline figée, et documenter le prompt d'origine.

---

## 7. Métriques

| Famille | Métriques | Notes |
|---|---|---|
| **T1 mono-label** | accuracy · **macro-F1** · micro-F1 · F1 par classe · matrice de confusion · **κ vs gold** | κ permet la comparaison directe avec les humains et les LLM |
| **T2 multi-label** | **micro-F1** · **macro-F1** · F1 par étiquette · **LRAP** · ranking loss · Hamming · *subset accuracy* · **α-MASI vs gold** | L'écart micro/macro est le point de rigueur |
| **T3 frontières** | précision/rappel/F1 des frontières · **WindowDiff** · **Pk** · Jaccard | Métriques standard de segmentation de texte |
| **Calibration** | ECE · diagramme de fiabilité · courbe risque-couverture | Nécessaire si le modèle doit assister l'annotation |
| **Robustesse** | dispersion inter-plis · IC bootstrap par document · sensibilité à la graine | |
| **Coût** | temps d'entraînement, empreinte mémoire, énergie estimée | Attendu croissant dans les publications |

**Toujours rapporter conjointement :** le score, son IC à 95 %, le plafond humain, et le support
de l'étiquette. Une F1 de 0,4 sur `FEEDBACK` (support 31) n'a pas le même statut qu'une F1 de
0,4 sur `PREAMBLE_SCOPE` (support 1 163).

---

## 8. Ablations et analyses

| # | Ablation | Question |
|---|---|---|
| **A1** | Avec / sans contexte (chaque option de l'axe contexte) | Q2 |
| **A2** | Avec / sans détokenisation | Q3 |
| **A3** | Embeddings gelés vs *fine-tuning* complet | Q4 |
| **A4** | **Courbe d'apprentissage** : 5/10/20/30/40 documents, 5 tirages chacun | **Q6** |
| **A5** | Qualité du gold : entraîner sur `submitted` vs `complete` vs `gold` finalisé | Le gold arbitré vaut-il son coût ? |
| **A6** | Bruit d'étiquetage : dégrader volontairement le gold (5/10/20 %) | Borne de robustesse |
| **A7** | Étiquettes dures vs **soft labels** (votes préservés) | L'apprentissage perspectiviste aide-t-il ? |
| **A8** | Nombre d'annotateurs par document (1 vs 2 vs 3) | Quantifie le rendement de la redondance |

**A5 et A8 ont une valeur stratégique** : ils répondent à « faut-il continuer à sur-annoter ? »
avec des chiffres, pas des intuitions.

---

## 9. Analyse d'erreurs — la section qui fait la différence

Un article de qualité ne s'arrête pas au tableau de scores. Le module doit produire
**automatiquement** :

1. **Matrice de confusion des thèmes**, avec les paires les plus confondues → sont-elles les
   mêmes que celles où les humains divergent ? (croisement direct avec les données d'IAA)
2. **Les phrases où le modèle et les humains échouent tous** → l'**ambiguïté irréductible**,
   mesurée au lieu d'être postulée (le « 18 % » du dossier v1 devient un chiffre).
3. **Les phrases où le modèle a raison contre un annotateur** → alimente l'audit d'annotateurs.
4. **Performance par position** dans le document (début/milieu/fin).
5. **Performance par longueur** de phrase et par taille de segment.
6. **Croisement avec l'abusivité CLAUDETTE** : le modèle est-il moins bon sur les phrases
   abusives ? Ce serait un problème pratique majeur — et un résultat.

---

## 10. Plan de figures de l'article

Chaque figure est produite par le module, exportable en **SVG et PDF vectoriel**, jamais
reconstruite à la main.

| Fig. | Contenu | Source |
|---|---|---|
| **F1** | Matrice d'accord 7×7 (3 annotateurs + 4 LLM), κ et α-MASI | Analyse & Qualité |
| **F2** | Distribution des thèmes en longue traîne (échelle log) + accord par thème en second axe | Analyse & Qualité |
| **F3** | α-MASI vs α nominal, global et par thème — *le coût du multi-label* | Analyse & Qualité |
| **F4** | Accord thématique vs accord de frontière, par document | Analyse & Qualité |
| **F5** | **Courbe d'apprentissage** (macro-F1 selon le nb de documents) + plafond humain | Lab |
| **F6** | Scores par étiquette vs support (nuage log) — micro/macro expliqué visuellement | Lab |
| **F7** | Ablation contexte (barres + IC) | Lab |
| **F8** | Matrice de confusion du meilleur modèle | Lab |
| **F9** | Comparaison humains / modèle supervisé / 4 LLM sur T1 | Lab + Analyse |
| **F10** | Diagramme de calibration | Lab |
| **F11** | Cascade de résolution : part auto/majorité/arbitrage, et effet sur le gold | Analyse & Qualité |
| **F12** | Graphe de co-occurrence des thèmes, arêtes pondérées par le lift d'abusivité | Analyse & Qualité *(pont vers l'objectif B)* |

---

## 11. Risques scientifiques et parades

| Risque | Gravité | Parade |
|---|---|---|
| **Fuite par split** (phrases du même ToS des deux côtés) | 🔴 invalide l'article | `GroupKFold` par document **imposé par le code**, testé |
| **Contamination LLM** : les juges ont vu le corpus ; le gold en dérive partiellement | 🟠 | Rapporter les modèles supervisés **sans** trait issu des LLM ; traiter les juges comme baseline séparée |
| **Sur-ajustement au petit N** (30–50 documents) | 🟠 | IC bootstrap, dispersion inter-plis, préférer les modèles simples à performance égale |
| **Plafond de bruit** (α 0,635) pris pour une limite du modèle | 🟠 | Plafond humain sur chaque tableau |
| **Sélection sur le test** | 🔴 | Split imbriqué, test scellé, vérifié par test automatisé |
| **Effet annotateur** (90 % du corpus par une personne) | 🟠 | Rapporter les scores par annotateur ; ablation A8 |
| **Irreproductibilité** | 🟠 | Empreintes dataset+config, environnement capturé, test de déterminisme |

---

## 12. Ce que ce plan produit, concrètement

À la fin de la campagne, sans travail manuel :
- un **dataset citable** (`dataset_id`, manifeste, splits figés) ;
- un **tableau de résultats** T1/T2/T3 avec IC et plafond humain ;
- **huit ablations** chiffrées ;
- **douze figures** en vectoriel ;
- une **analyse d'erreurs** croisée avec l'IAA et l'abusivité ;
- un **paquet de reproductibilité** (configs + environnement + graines) publiable en annexe.
