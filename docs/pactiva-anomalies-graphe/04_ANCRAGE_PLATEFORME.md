# Ancrage plateforme — ce que Pactiva fournit réellement aux deux objectifs scientifiques

> **Objet.** Confronter les deux objectifs du dossier (**A** = ressource « CLAUDETTE-Themes » ·
> **B** = hypergraphe & anomalie de co-occurrence) au **code déployé** et aux **données de
> production**, mesurées le **11 août 2026** sur `campagne-pactiva`.
> Rien ici n'est estimé : chaque chiffre vient d'une requête sur la base de prod.

---

## 1. Le pipeline du dossier, brique par brique, face au code

| Brique (§A.2) | État plateforme | Où |
|---|---|---|
| **F0** — segmentation en clauses | ⚠️ **Non annotée** — 1 clause par phrase partout ; les segments se **reconstruisent** | `store/workspace.ts` (pré-remplissage « déplié PAR PHRASE ») |
| **F1a** — IAA multi-label α-MASI | ✅ **Déjà implémenté**, pur + testé, exposé dans l'API projet | `projects/masi.py`, `projects/iaa.py::project_iaa_detail` |
| **F1b** — classifieur supervisé (Legal-BERT) | ❌ Hors plateforme (à faire côté recherche) | — |
| **F2** — hypergraphe clause↔thèmes | ✅ **Matériau natif** : `ClauseTheme` (primaire + secondaires) | `annotations/models.py` |
| **F3** — anomalie de co-occurrence | ⚠️ Pas de module, mais **le signal est mesurable** (§4) | — |
| **F3-éval** — labels d'abusivité | ✅ `ReferenceLabel` par phrase, **50/50 documents couverts** | `corpora/models.py` |
| **F4** — audit des annotateurs | ⚠️ Redondance insuffisante (§3, É1) | — |
| **Gold / cascade tiérée** | ✅ **Déployée** (auto_1click / auto / manual, arbitrage tracé, gold figé) | `projects/gold_scoring.py`, app `gold/` |
| **Couche LLM de référence** | ✅ 4 juges × 50 docs (Fable, Claude, Codex, Mistral) — **jamais parties au conflit** | `imports/models.py::Judge` |

**Deux briques réputées « à faire » par le dossier sont déjà là** : l'α-MASI (avec son
sanity-check « mono ⇒ α nominal ») et la cascade de résolution. **Une brique réputée acquise ne
l'est pas** : la segmentation en clauses.

---

## 2. L'état réel de la campagne (prod, 11 août 2026)

```
Corpus       50 documents · 9 414 phrases · ReferenceLabel CLAUDETTE 1 137 sur 1 032 phrases (11,0 %)
Annotations  50 au total : 35 submitted · 15 draft
             zahra.boulaich 32 · fatima.ouali 10 · elazhar.jebbari 8
Couverture   36 documents touchés / 50
             docs à ≥2 annotateurs SOUMIS ......  4     ← le gisement multi-annotateur
             docs à ≥2 annotateurs (drafts inclus) 11
Clauses      9 148 · 12 199 étiquettes de thème · 2 731 clauses multi-thèmes (29,9 %)
             275 combinaisons de thèmes distinctes, dont 99 vues une seule fois
Gold         3 résolutions, aucune finalisée · 425 phrases (222 strict / 68 majorité / 42 divergence)
```

### Fiabilité mesurée — le résultat principal de l'objectif A existe déjà

| | Soumis (4 docs, 4 paires) | Drafts inclus (11 docs, 17 paires) |
|---|---:|---:|
| κ de Cohen (thème, par phrase) | **0,769** | 0,650 |
| **α de Krippendorff–MASI** (multi-label) | **0,635** | 0,503 |
| α nominal (mono-label, contrôle) | — | 0,701 |
| κ « frontières » tel que calculé aujourd'hui | 1,000 | 0,941 |

**Par thème** (soumis) : de **0,42** (`META`, support 9) à **0,89** (`PRIVACY_DATA`) ; le cœur du
vocabulaire est entre 0,68 et 0,84.

**Ce que ces chiffres disent, tout de suite :**

1. **Le contraste avec le « mur du κ » est acquis.** Le LLM seul plafonnait à **κ 0,32–0,45** ;
   les annotateurs formés sont à **κ 0,769**. La thèse fondatrice de F1 — *« peut-on obtenir des
   thèmes fiables autrement qu'avec un LLM ? »* — a **déjà sa réponse empirique : oui**.
2. **Le multi-label COÛTE de la fiabilité** : α-MASI **0,635** contre α nominal **0,701** sur le
   même matériau. On passe **sous le seuil « acceptable » de 0,667** (Passonneau) précisément en
   passant au multi-label. Ce n'est pas un échec — c'est **un résultat publiable**, et c'est
   surtout **le prérequis de B qui vacille** : l'hypergraphe se construit sur les secondaires,
   c'est-à-dire sur la partie la moins fiable de l'annotation.

---

## 3. Les six écarts entre le dossier et la plateforme

### É1 — Le gisement multi-annotateur est de **4 documents**, pas de 3 × 50
Le doc `03` pose « 3 annotateurs × 50 ToS disponibles courant août 2026 ». Au 11 août : **4
documents** à ≥2 annotateurs soumis (11 en comptant les brouillons), et **aucun** à 3 annotateurs
soumis. La charge est très inégale (32 / 10 / 8).
→ **Impact.** α-MASI reste calculable (1 911 unités) ; **A1 (audit d'annotateurs) est le plus
touché** : Cleanlab / MACE / CROWDLAB demandent de la redondance, et 4 documents n'en donnent pas.
→ **Levier.** Le dossier le prévoit déjà (« échantillon stratifié sur-annoté ») : **c'est la
décision opérationnelle la plus urgente**, avant toute écriture.

### É2 — La frontière de clause n'est pas annotée (et le κ de frontières est un artefact)
Sur **tous** les documents multi-annotés : `clauses = [139, 139, 139]` sur 139 phrases — **une
clause par phrase**, parce que le pré-remplissage d'un modèle est *déplié par phrase* avant
édition. D'où κ-frontières = **1,000**, qui ne mesure rien.
En **reconstruisant** les segments (plages de phrases consécutives de mêmes thèmes) :

```
7 508 phrases → 3 290 segments (compression ×2,28 ; ~94 segments/document)
Accord de frontières RECONSTRUITES (Jaccard) : 9gag 0,516 · Academia 0,403 · Airbnb 0,391 · Atlas 0,625
```

→ **Impact double.** (a) Le delta « unité = **clause** (frontières) » du tableau ressource
(doc `03` §1) **n'est pas vrai tel qu'écrit** : l'unité annotée est la phrase, exactement comme
CLAUDETTE ; la clause est *dérivée*. (b) Publier κ-frontières = 1,0 serait **faux** — le vrai
accord de segmentation est **0,39–0,63**, ce qui est un résultat honnête et intéressant (la
frontière est bien plus dure que le thème).
→ **Action plateforme.** Corriger `project_iaa_detail` : calculer `boundaryKappa` sur les
**frontières reconstruites**, pas sur les ancres. En l'état, la plateforme publie un indicateur
trompeur.

### É3 — Certitude, rationale et evidence-span sont des **résidus LLM**, pas du signal humain
```
certainty     : 0 → 6 697 clauses ; NULL → 2 451   (aucune autre valeur ; 0 = « Incertain »)
rationale     : 6 696 non vides   → exemples : « titre du document », « intro de bienvenue »
evidence_span : 6 696 non vides
```
La valeur 0 vient de `clampCertainty()` (défaut du pivot v9.2), et les rationales sont recopiés
depuis la pré-annotation par `seed_annotation_from_preannotation`. **Aucune variance ⇒ aucun
signal.**
→ **Impact.** Trois lignes du tableau « delta vs CLAUDETTE » (certitude 0–3 · rationale ·
span d'évidence) sont **aujourd'hui invendables**. Il faut soit les retirer de la promesse de
ressource, soit les **faire produire par les annotateurs** sur le sous-corpus sur-annoté.

### É4 — `legal_nature` : **0 / 9 148** ✅
Le point 1 du dossier (« la nature déontique n'est pas une donnée ») est **intégralement confirmé**,
code *et* données. C'est le seul des trois points correctifs qui soit validé sans réserve.
D1 (couche déontique prédite, en ablation) reste donc le bon traitement.

### É5 — La sévérité CLAUDETTE est absente : **les 1 137 labels sont tous de niveau 1**
Le loader sait lire `-1 / 1 / 2 / 3` (`corpora/loaders.py`), mais la source importée ne contient
que des `1`.
→ **Impact.** L'évaluation de B se fait sur de l'abusivité **binaire**, pas sur 3 niveaux — et le
dossier annonce « 8 catégories + 3 niveaux » (§00, §A.1). À **revérifier à la source**
(`ToS.zip` de l'EUI) avant de l'écrire dans un papier.
Répartition disponible : `LTD 296 · TER 236 · CH 188 · CR 118 · USE 117 · LAW 70 · J 68 · A 44`.

### É6 — L'export gold ne publie pas les votes bruts
`GoldSentence.tally` (masse de poids par thème) est **en base** mais absent de `gold_records()`.
→ La **« couche 2 » du protocole à deux couches** (soft labels / votes bruts — la réponse à
Braun 2023, différenciateur central du papier A) **n'est pas livrable en l'état**. Correctif petit
et bien localisé : ajouter `tally` + les votes par annotateur à l'export.

---

## 4. L'hypothèse centrale de l'objectif B, testée sur les données réelles

Le dossier pose (§A.5) : *« une clause abusive tend à cumuler une combinaison hétérogène/rare de
thèmes »*. Test direct, clauses soumises × `ReferenceLabel` :

**(a) La cardinalité ne prédit rien.**
```
clauses mono-thème  : 4 964 → 10,1 % abusives
clauses multi-thème : 2 544 → 11,0 % abusives      lift 1,09×   ← quasi nul
```

**(b) L'IDENTITÉ de la combinaison prédit très fortement.** (taux de base 10,4 %)
```
76,9 %  (10/13)   lift 7,4×   LICENSE_IP + TERMINATION
76,7 %  (23/30)   lift 7,4×   FEES_PAYMENT + MODIFICATION_OF_TERMS
75,0 %  ( 9/12)   lift 7,2×   ACCEPTABLE_USE + TERMINATION
56,2 %  ( 9/16)   lift 5,4×   MODIFICATION_OF_TERMS + TERMINATION
42,9 %  ( 9/21)   lift 4,1×   FEES_PAYMENT + LIMITATION_LIABILITY
31,6 %  (18/57)   lift 3,0×   ARBITRATION_DISPUTES + GOVERNING_LAW
 …
 0,0 %  ( 0/56)   lift 0,0×   ARBITRATION_DISPUTES + META
 0,0 %  ( 0/45)   lift 0,0×   META + PREAMBLE_SCOPE
```

**(c) La rareté seule est un mauvais détecteur** — exactement la vigilance annoncée, désormais
chiffrée :
```
support 1 (hapax) :  96 combinaisons,    96 clauses, 14,6 % abusives  (lift 1,40×)
support 2–4       :  81 combinaisons,   218 clauses, 18,3 %           (lift 1,76×)  ← le pic
support 5–19      :  60 combinaisons,   564 clauses, 16,1 %           (lift 1,55×)
support ≥20       :  30 combinaisons, 1 666 clauses,  8,2 %           (lift 0,78×)
```

**Lecture.** Le signal recherché **existe et il est fort** — mais il faut **reformuler
l'hypothèse** : ce n'est ni le nombre de thèmes, ni la rareté brute, c'est **quelles paires de
thèmes se rencontrent**. Les paires prédictives dessinent d'ailleurs un motif juridiquement
lisible : *le fournisseur se réserve un pouvoir unilatéral sur un engagement de l'utilisateur*
(résiliation × licence, modification × frais, résiliation × usage). C'est un **meilleur** résultat
que celui espéré, et il rend G2 (co-occurrence) plus solide que G1 (HGNN non supervisé) à petit N.

⚠️ Ces chiffres sont **préliminaires** : 35 annotations mono-annotateur pour l'essentiel, donc
une combinaison reflète le style d'un annotateur autant que le contrat. À rejouer **sur le gold**
quand les résolutions seront finalisées.

---

## 5. Conséquences sur le portefeuille

| Décision du dossier | Ce que les données imposent |
|---|---|
| **A (ressource) en *long*, flagship** | ✅ **Maintenu**, mais la promesse doit être **recalibrée** : retirer certitude / rationale / span (É3), reformuler « clause » en « segment reconstruit » (É2), et **publier le vrai accord de frontières** (0,39–0,63). Le résultat fort est ailleurs : **κ 0,77 humain vs 0,32–0,45 LLM**, et **le coût du multi-label** (α-MASI 0,635 < α nominal 0,701). |
| **B (graphe) en *short → long*** | ⚠️ **Recentrer sur G2** (co-occurrence interprétable, lift 7,4× déjà mesuré) et garder G1 (HGNN) en extension. À 275 combinaisons dont 99 hapax et 4 documents multi-annotés, un HGNN non supervisé n'a pas de quoi apprendre ; une **matrice de co-occurrence + test contre les labels** oui, tout de suite. |
| **A1 (audit annotateurs) en compagnon** | 🔴 **Le plus menacé** (É1). Sans sur-annotation ciblée d'ici fin août, il n'y a pas de redondance à auditer. Décision à prendre **cette semaine**, pas à mi-août. |
| **Valve mi-août** | Elle joue déjà : le repli « F1 + A1 en long » est **moins sûr** que prévu (A1 dépend d'É1), alors que **A + G2** est solide dès maintenant. |

---

## 6. Ce qu'il faudrait faire côté plateforme (petit, ciblé, indépendant des papiers)

1. **Corriger `boundaryKappa`** — le calculer sur les frontières **reconstruites** ; l'actuel vaut
   1,0 par construction et serait une erreur dans un papier. *(É2)*
2. **Exporter la couche « soft labels »** — ajouter `tally` + votes par annotateur à
   `gold/export.py::gold_records`. *(É6)*
3. **Exporter l'hypergraphe** — un scope `graph` produisant, par document,
   `clause → {thèmes}` + `ReferenceLabel` alignés : c'est l'artefact d'entrée de l'objectif B, et
   il n'existe pas encore.
4. **Un tableau de bord « prêt pour la science »** — par document : nb d'annotateurs soumis,
   α-MASI, statut gold. Aujourd'hui l'état d'É1 n'est visible qu'en interrogeant la base.
5. **Décider le sort de `certainty`** — soit la faire saisir (et ne plus la pré-remplir à 0), soit
   la retirer de la promesse de ressource. *(É3)*
6. **Revérifier la sévérité CLAUDETTE à la source** et ré-importer si les niveaux 2/3 existent. *(É5)*

---

## Note de fiabilité

Tous les chiffres de §2–§4 proviennent de requêtes exécutées le **11 août 2026** sur la base de
production (`campagne-pactiva`), via `manage.py shell`. Ils bougeront avec la campagne — le
tableau §2 est un **instantané**, pas un acquis. Les lifts de §4 portent sur des annotations
majoritairement mono-annotateur : ils indiquent une **direction**, pas une mesure définitive.
