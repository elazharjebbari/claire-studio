# Stratégie scientifique — comment obtenir un résultat publiable à JURIX 2026

> Fondé sur [`01_MATERIAU.md`](01_MATERIAU.md). Fenêtre : ~25 jours.

---

## 1. Le problème stratégique, posé net

Un papier « ressource » se juge sur **trois critères** que JURIX applique sans indulgence :
la ressource est-elle **disponible** (licence, DOI) ? est-elle **fiable** (IAA sur redondance
réelle) ? apporte-t-elle un **delta** mesurable sur l'existant (ici CLAUDETTE) ?

| Critère | État Pactiva | Verdict |
|---|---|---|
| Disponible | Corpus CLAUDETTE sous licence tierce ; enrichissement publiable | ⚠️ à instruire |
| Fiable | **1 paire** d'annotateurs, 4 documents | 🔴 **rédhibitoire** |
| Delta vs CLAUDETTE | 3 des 4 deltas annoncés sont vides (§`01` 5) | 🔴 **affaibli** |

**Conclusion : ne pas soumettre un papier dont la ressource est la contribution principale.**
Le corpus n'est pas mûr, et il le sera pour 2027 — l'y forcer en 2026 grille la carte.

**Mais** le travail d'annotation a produit autre chose, qui est mûr : **des mesures que
personne d'autre n'est en position de faire**, parce qu'elles exigent d'avoir simultanément
(a) des annotateurs humains formés, (b) quatre LLM sur le *même* vocabulaire et le *même*
corpus, (c) la trace phrase à phrase des deux. Pactiva a les trois.

---

## 2. Trois angles candidats

### Angle A — « La ressource CLAUDETTE-Themes » *(le plan initial)*
Publier le dataset enrichi + protocole de gold + IAA + baselines.
- **Pour :** valorise directement l'effort ; JURIX aime les ressources.
- **Contre :** 🔴 la redondance manque (§`01` 2–3) ; 3 deltas sur 4 sont vides ; 25 jours ne
  suffisent pas à produire le gold finalisé **et** les baselines Legal-BERT.
- **Verdict : reporté à 2027.** C'est le bon papier, au mauvais moment.

### Angle B — « Ce que coûte le multi-label, et où s'arrête le LLM » ✅ **recommandé**
Un papier de **mesure**, pas de ressource : quantifier le prix de fiabilité du multi-label, et
situer les LLM par rapport à des humains formés, sur un vocabulaire juridique fermé.
- **Pour :** les trois résultats (R1, R2, R3) sont **déjà mesurés** ; aucune donnée nouvelle
  n'est requise ; le protocole est outillé et reproductible ; la question intéresse
  directement AI & Law (qualité de preuve, place de l'automatisation dans l'annotation).
- **Contre :** contribution « méthode + mesure », moins citée qu'une ressource ; N modeste.
- **Verdict : c'est le papier de 2026.** Il *prépare* la ressource de 2027 au lieu de la brûler.

### Angle C — « Le biais d'ancrage du pré-remplissage LLM en annotation juridique »
Mesurer si partir d'une proposition LLM déforme le jugement de l'annotateur.
- **Pour :** très original, très JURIX, et Pactiva a le matériau.
- **Contre :** 🔴 le juge de pré-remplissage **n'est pas persisté** (§`01` 7) ; sans design
  contrôlé (même document, seeds différents), la mesure reste corrélationnelle.
- **Verdict : section du papier B en 2026** (les 48–60 % d'accord excluent l'ancrage total),
  **papier à part entière en 2027** si l'on instrumente un protocole contrôlé dès maintenant.

---

## 3. Le papier recommandé

**Titre de travail (EN) :**
> **How Much Does Multi-Label Cost? Sentence-Level Theme Annotation of Terms of Service by
> Trained Annotators and LLM Judges.**

**Format :** *short paper* JURIX 2026 (≤ 6 p.). Bascule possible en *long* — voir §6.

**Question de recherche.** Pour enrichir un corpus juridique en thèmes, trois choix se
présentent : mono-label ou multi-label ; humains formés ou LLM ; annotation *ex nihilo* ou
post-édition assistée. **Que coûte et que rapporte chacun de ces choix, mesuré sur le même
corpus, le même vocabulaire et les mêmes phrases ?**

**Résumé (ébauche).**
> L'enrichissement thématique de corpus juridiques se heurte à deux décisions rarement
> quantifiées : faut-il autoriser plusieurs étiquettes par unité, et peut-on déléguer
> l'étiquetage à des LLM ? Nous annotons **9 414 phrases de 50 conditions d'utilisation**
> (corpus CLAUDETTE) selon un vocabulaire fermé de **20 thèmes multi-label**, avec des
> annotateurs formés et **quatre LLM juges** appliqués au même schéma. Nous rapportons trois
> mesures. **(i)** Le passage au multi-label **dégrade la fiabilité** : α de Krippendorff avec
> distance MASI **0,635**, contre **0,701** en distance nominale sur le même matériau — le
> multi-label fait franchir le seuil d'acceptabilité **vers le bas**. **(ii)** Les annotateurs
> formés s'accordent **bien plus entre eux** (κ **0,769**, ~80 % d'accord brut) qu'avec le
> meilleur LLM (**48–60 %**), tandis que les LLM ne s'accordent entre eux qu'à **34–81 %** : le
> plafond d'accord observé avec les LLM est une limite des modèles, non de la tâche.
> **(iii)** L'annotation assistée n'est pas une ratification : **48–50 %** des phrases
> s'écartent du modèle le plus proche. Nous rapportons enfin l'accord de **segmentation**
> (Jaccard **0,39–0,63**), très inférieur à l'accord thématique, et publions le protocole de
> résolution de conflits ainsi que le schéma d'annotation.

**Contributions revendiquées (4, toutes défendables aujourd'hui) :**
1. Une **quantification du coût du multi-label** en annotation juridique — chiffre que la
   littérature suppose sans le mesurer.
2. Une **comparaison à vocabulaire constant** humains formés / 4 LLM / LLM entre eux, qui
   requalifie le « mur du κ » en limite des modèles.
3. La **décomposition thème vs frontière** : la segmentation est le vrai point dur
   (0,39–0,63 contre 0,77).
4. Un **protocole de gold outillé, traçable et reproductible** (cascade auto/comité, désaccord
   préservé), publié comme artefact — l'amorce de la ressource 2027.

---

## 4. Les cinq expériences

| # | Expérience | Entrée | Sortie attendue | Statut |
|---|---|---|---|---|
| **E1** | **Coût du multi-label** : α-MASI vs α nominal, global et **par thème**, sur le même matériau | annotations soumises | tableau + courbe par thème ; test de significativité par bootstrap sur les documents | 🟡 chiffres bruts acquis, à re-calculer après V0 |
| **E2** | **Humains vs LLM à vocabulaire constant** : κ/α humain↔humain, humain↔LLM, LLM↔LLM | + 4 juges × 50 docs | matrice 7×7 (3 annotateurs + 4 juges) ; le résultat central | 🟡 acquis, à consolider après V0 |
| **E3** | **Thème vs frontière** : accord thématique vs Jaccard des frontières **reconstruites** | segments reconstruits | tableau par document ; discussion « ce qui est dur » | 🔴 exige le correctif `boundaryKappa` (V1) |
| **E4** | **Post-édition ≠ ratification** : taux de divergence au seed, par annotateur et par thème | clauses validées | montre le travail humain réel ; borne l'ancrage | 🟡 acquis ; propre **seulement** après persistance du juge de seed (V1) |
| **E5** | **Coût de la cascade** : part auto_1click / auto / manual, et ce que l'arbitrage change | résolutions gold | rentabilité du protocole ; contribution 4 | 🔴 exige des résolutions **finalisées** (V2) |

**Analyses transverses à ne pas oublier :**
- **micro vs macro** sur les 20 thèmes : la longue traîne (`FEEDBACK` 0,34 %, `META` 0,82 %)
  est là où tout se dégrade — c'est le point de rigueur central, à rapporter systématiquement.
- **Gwet AC1/AC2** en complément de κ : la prévalence est très déséquilibrée, κ y est
  instable (`META` κ 0,42 sur support 9 — non interprétable seul).
- **Intervalles de confiance par bootstrap au niveau document**, pas au niveau phrase : les
  phrases d'un même ToS ne sont pas indépendantes. Avec 7 documents, c'est indispensable et
  cela doit être dit.

---

## 5. Menaces de validité — à traiter frontalement, pas à cacher

| Menace | Traitement dans le papier |
|---|---|
| **Effectif** : 3 annotateurs, ~1 000 phrases multi-annotées | L'assumer comme *study*, pas comme *resource* ; IC bootstrap par document ; ne jamais extrapoler au corpus complet |
| **Biais d'ancrage** du pré-remplissage LLM | **En faire une mesure (E4)** : 48–60 % d'accord exclut la ratification. Déclarer l'absence de condition contrôlée comme limite explicite |
| **Une seule paire** dominante dans l'IAA actuel | Résolu par **V0** (3 paires, 3 documents triples). Sans V0, le papier n'est pas soumettable |
| **Charge déséquilibrée** (90 % zahra) | Rapporter les κ **par paire**, jamais un κ global seul ; discuter l'effet annotateur |
| **Sévérité CLAUDETTE absente** (tous niveaux à 1) | Ne pas mentionner « 3 niveaux » ; parler d'abusivité **binaire**, ou revérifier à l'EUI (V1) |
| **La segmentation n'est pas annotée** | En faire la contribution 3, pas un impensé : dire que l'unité est la phrase et que le segment est dérivé |

> **Règle de conduite :** chaque chiffre du papier doit être reproductible par un script versionné
> exécuté sur un export daté. Aucun chiffre saisi à la main.

---

## 6. Bascule vers un *long* — condition unique

Le passage en *long* devient défendable **si, et seulement si**, à J+10 on dispose de :
- **≥ 12 documents multi-annotés** dont **≥ 5 en triple** (V0 en donne 7 dont 3 triples ; V2
  doit fournir le reste), **et**
- **≥ 3 résolutions gold finalisées** (permet E5 et la contribution « protocole »).

Alors on ajoute une section « ressource » (schéma + protocole + soft labels publiés) et le
papier devient *« … with a Disagreement-Preserving Gold Protocol »*. **Décision à prendre à
J+10, pas plus tard** — au-delà, il n'y a plus le temps d'écrire 4 pages de plus.

---

## 7. Ce qui va en 2027

- **La ressource complète** (Angle A) : 50 ToS, redondance réelle, gold finalisé, soft labels
  publiés, baselines Legal-BERT, volet FR.
- **Le biais d'ancrage en design contrôlé** (Angle C) : même document, annotateurs assignés à
  des seeds différents (ou sans seed) — exige d'instrumenter la plateforme **dès maintenant**
  pour que les données existent dans un an.
- **Le papier graphe** (objectif B), recentré sur la co-occurrence (G2), qui consommera le gold
  finalisé.
