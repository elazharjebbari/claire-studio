# Résultats de la campagne « aperçu » — 16 août 2026, données en l'état

> Tous les chiffres sortent de runs Lab versionnés (dataset `74c33b45` / empreinte
> `807673044897…`, 39 documents, 7 621 phrases, 9 805 votes bruts, 425 phrases gold),
> exécutés le 16 août 2026. **Fait majeur constaté au lancement : V0 a eu lieu** —
> fatima.ouali a soumis 18 annotations ; la campagne compte **12 documents multi-annotés
> soumis, dont 3 triples** (9gag, Academia, Atlas) et **3 paires d'annotateurs réelles**.
> Les chiffres ci-dessous remplacent l'instantané mono-paire du 11 août.

---

## 1. E1 — Le coût du multi-label (M1, le résultat central du papier court)

| Mesure | Valeur | IC 95 % (bootstrap par document) |
|---|---:|---|
| α-MASI (ensembles de thèmes) | **0,625** | [0,552 ; 0,694] |
| α nominal (thème primaire) | **0,688** | [0,599 ; 0,765] |
| **Δ (coût du multi-label)** | **0,063** | **[0,031 ; 0,086]** — différence APPARIÉE |
| Stabilité du signe | **Δ > 0 sur 100 % des 1 000 tirages** | |

3 paires · 12 documents · 1 792 unités multi-annotées. Le point α-MASI reste sous le
seuil d'acceptabilité 0,667 quand l'α nominal le dépasse — et surtout **l'IC de la
différence exclut largement 0** : le coût du multi-label n'est plus un constat
mono-paire, c'est une mesure stable au rééchantillonnage des documents.
*Formulation article : « the shift to multi-label costs 0.063 α points on identical
material (95 % CI [0.031 ; 0.086], document-level paired bootstrap). »*

κ par paire (jamais un global seul) : elazhar↔zahra **0,732** (783 u, 4 docs) ·
elazhar↔fatima **0,697** (392 u, 3 docs) · fatima↔zahra **0,661** (1 401 u, 11 docs).
Les trois paires convergent dans 0,66–0,73 — l'effet annotateur existe mais reste borné.

## 2. E2 — La matrice 7×7 (accord brut sur le primaire)

| | elazhar | fatima | zahra | claude | codex | fable | mistral |
|---|--:|--:|--:|--:|--:|--:|--:|
| **elazhar** | · | 0,72 | 0,75 | 0,59 | 0,31 | 0,52 | 0,42 |
| **fatima** | | · | 0,69 | 0,51 | 0,33 | 0,55 | 0,32 |
| **zahra** | | | · | 0,48 | 0,35 | 0,43 | 0,29 |
| **claude** | | | | · | 0,48 | 0,80 | 0,56 |
| **codex** | | | | | · | 0,49 | 0,34 |
| **fable** | | | | | | · | 0,55 |

Lecture : **humain↔humain 0,69–0,75 ≫ humain↔meilleur juge 0,48–0,59** ; les juges
entre eux 0,29–0,80 (claude↔fable 0,80, quasi redondants). Le « mur du κ » est une
limite des modèles, pas de la tâche — désormais mesuré sur 3 annotateurs.

## 3. Par thème — le paradoxe de prévalence chiffré (F8)

Cœur du vocabulaire (support ≥ 200) : α binaire 0,65–0,86 (FEES_PAYMENT 0,86,
ARBITRATION 0,85, ELIGIBILITY 0,80) ; USER_CONTENT décroche à **0,44**.
Queue : COMMUNICATIONS 0,34 · FEEDBACK 0,10 · **DMCA −0,32** — pendant que
**Gwet AC1 reste ≥ 0,89 partout** (≥ 0,98 sur la queue). C'est exactement le point de
rigueur annoncé : sur prévalence extrême, α/κ s'effondrent mécaniquement et AC1 sert de
garde-fou — les deux se rapportent ensemble, jamais l'un sans l'autre.

## 4. E3 — Frontières reconstruites & E4 — divergence aux juges

- Jaccard des frontières par paire : **0,43 / 0,48 / 0,56** (moyenne 0,49) — la
  fourchette historique 0,39–0,63 tient sur 3 paires : la frontière reste le point dur
  (0,49 contre 0,69–0,75 d'accord thématique).
- Divergence au juge le plus proche : elazhar **41,3 %** (claude) · fatima **44,8 %**
  (fable) · zahra **52,1 %** (claude). La post-édition n'est pas une ratification —
  borne INFÉRIEURE de l'édition réelle (seed non persisté, V1.2 prospectif).

## 5. E5 — La cascade gold (M2, aperçu)

425 phrases gold (3 résolutions) : **40,9 % auto_1click · 30,1 % auto · 28,9 % manual**
→ ~71 % se résolvent sans humain, l'arbitrage ne porte que sur les vrais conflits.
**0 phrase décidée, 0 résolution finalisée** : les volets « ce que l'arbitrage change »
et l'écho A5 sur maturité `gold` attendent la finalisation (action humaine, plan V2).
Écho A5 (embeddings e5 + logreg, gold-quality) : macro-F1 0,469 [0,442 ; 0,512] —
un seul point tant que les maturités ne diffèrent pas réellement (post-V0, `submitted`
= `complete` ; le troisième point viendra du gold finalisé).

## 6. G2 — Co-occurrence ↔ abusivité (source `votes`, 54 couches annotateur)

Structure : 7 621 phrases → **4 384 segments** (×1,74), **300 combinaisons** dont 110
hapax, **42,3 % de segments multi-thèmes**, taux de base 18,6 %.
(La couche consensus, elle, aplatit les secondaires — 3,9 % de multi-thèmes — et ne
permet pas de tester l'hypothèse : rapportée en variante de comparaison.)

**Tableau 5 (aperçu)** — AUC-PR contre les labels CLAUDETTE, CV 5 plis par document :

| Scorer | Type | AUC-PR [IC 95 %] | ROC | P@20 (lift) | P@50 |
|---|---|---|--:|--:|--:|
| rarity | non supervisé | 0,182 [0,161 ; 0,213] | 0,51 | 10 % (0,5×) | 14 % |
| npmi_min | non supervisé | 0,186 [0,163 ; 0,213] | 0,49 | 15 % (0,8×) | 12 % |
| LOF / IF / OCSVM | non supervisés | 0,178–0,189 | 0,49–0,52 | 15–20 % | 16–22 % |
| cardinality | contrôle négatif | 0,176 [0,155 ; 0,204] | 0,46 | 35 % (1,9×) | 20 % |
| **combo_identity** | **référence supervisée** | **0,589 [0,525 ; 0,658]** | **0,835** | **70 % (3,8×)** | **76 %** |

**La lecture scientifique — l'inflexion à assumer dans le papier long :**
1. **L'anomalie NON supervisée de co-occurrence ne détecte pas l'abusivité** : tous les
   détecteurs restent au niveau du taux de base (AUC-PR ≈ 0,18 ≈ base 0,186). C'est la
   vigilance « rare ≠ abusif » du dossier, désormais chiffrée avec contrôles — un
   résultat négatif propre et publiable.
2. **L'IDENTITÉ des combinaisons porte un signal fort** : P(abusif | combinaison)
   apprise sur train généralise à AUC-PR 0,589 (3,2× le taux de base), P@50 76 %.
   La section graphe se recentre donc sur la co-occurrence comme **signal supervisé
   faible** (weak supervision par la structure thématique), pas comme détection
   d'anomalies non supervisée.
3. **D1 (déontique prédite, proxy à règles) : POSITIF** — combo_identity passe de
   0,589 à **0,637** [0,582 ; 0,699] (P@20 85 %, P@50 94 %, ROC 0,855) ; les
   détecteurs non supervisés ne bougent pas. La couche déontique bruitée AJOUTE du
   signal discriminant à l'identité de combinaison : la contribution méthodologique D1
   a un résultat, et il est positif.
4. **G5 (bruit de thèmes) : dégradation douce** — combo_identity 0,589 → 0,583 (10 %)
   → 0,557 (20 %) → 0,506 (35 % de corruption) : à une dégradation simulant un
   classifieur amont à ~0,60 de macro-F1, le signal conserve 86 % de son AUC-PR.
   La borne de fiabilité opérationnelle du pipeline est mesurée.

**Combinaisons les plus prédictives** (descriptif, tout corpus — MODIFICATION_OF_TERMS
est le pivot du motif « pouvoir unilatéral ») : FEES+MODIFICATION **91,3 %** d'abusives
(23 segments, lift 4,9×) · MODIFICATION+PREAMBLE 76,9 % · ACCEPTABLE_USE+TERMINATION et
LICENSE_IP+TERMINATION 73,3 % · ACCEPTABLE_USE+TERMINATION+USER_CONTENT 100 % (5 seg.).
Par catégorie CLAUDETTE : le signal porte surtout sur **CH** (changement unilatéral,
AUC-PR 0,464 un-contre-tous) — cohérence parfaite avec le pivot MODIFICATION_OF_TERMS.

## 7. Caveats (à reprendre tels quels dans les papiers)

1. Aperçu sur annotations en l'état : les couches `votes` mêlent 1 à 3 annotateurs par
   document — une combinaison reflète aussi un style d'annotateur ; à rejouer sur le
   gold arbitré.
2. IC larges (12 documents multi-annotés) — déclarés, jamais lissés.
3. E4 = borne inférieure (juge de seed non persisté) ; E5 = aperçu (0 finalisée).
4. La couche déontique est un proxy à règles ; un classifieur LexDeMod-style reste
   l'extension propre.

## 8. Identifiants de reproduction

Datasets : complete `74c33b45` · submitted `2543d44f` · any `5dccdafa` (contenu
identique post-V0, empreintes distinctes par critères).
Expériences (16 août) : M1 soumis `70de297e` · M1 brouillons `3fc2435e` · M2 `6811271a` ·
G2 consensus `82157c2a` / D1 `a4557056` / G5 `5c3b7e2d` · **G2 votes** pivot `3f925105`
(run `5616c77f`) / D1 `1665be4e` / G5 `b2960e98` · A5 `5c9e26d5` + `369d4ab8`.
