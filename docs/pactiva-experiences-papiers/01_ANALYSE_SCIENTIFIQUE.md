# Analyse scientifique des deux papiers — ce qu'ils affirment, ce qu'il faut prouver, ce qui existe

> Fondé sur la lecture intégrale des deux dossiers stratégiques
> ([`pactiva-anomalies-graphe/`](../pactiva-anomalies-graphe/00_README.md) et
> [`pactiva-papier-ressource/`](../pactiva-papier-ressource/00_README.md)) et sur l'inventaire
> du code (Lab, package `pactiva_lab`, `projects/masi.py`, module gold). Chiffres de campagne :
> instantané du 11 août sur `campagne-pactiva`.

---

## 1. Le portefeuille, clarifié une fois pour toutes

Les dossiers successifs ont fait évoluer le montage. **État faisant foi au 16 août :**

| Papier | Titre de travail | Cœur | Statut stratégique |
|---|---|---|---|
| **LONG** | *From Reliable Multi-Label Clause Themes to Hypergraph-Based Detection of Unfair Clauses* | **F1** (fiabilité humaine + classifieur supervisé sans LLM) + **G2** (anomalie de co-occurrence de thèmes ↔ abusivité), G1 (HGNN) en extension ; ablations **D1** (déontique prédite) et **G5** (bruit d'étiquettes) | Recommandation du dossier anomalies-graphe, **recalibrée** par l'ancrage plateforme : « recentrer sur G2, garder G1 en extension » (04 §5) |
| **COURT** | *How Much Does Multi-Label Cost? Sentence-Level Theme Annotation of ToS by Trained Annotators and LLM Judges* | Papier de **MESURE** : E1 (coût du multi-label), E2 (humains vs LLM à vocabulaire constant), E3 (thème vs frontière), E4 (post-édition ≠ ratification), E5 (coût de la cascade) | Recommandation du dossier papier-ressource (Angle B) ; le papier **ressource** (Angle A) est reporté à 2027 |

**Tension résolue n°1 — quel est le « short » ?** `02_RECOMMANDATION` (anomalies-graphe, 1ᵉʳ août)
proposait A1 (audit d'annotateurs) comme short compagnon. `04_ANCRAGE` (11 août, données réelles)
constate qu'**A1 est le papier le plus menacé** : Cleanlab/MACE/CROWDLAB exigent de la redondance,
et le gisement multi-annotateur soumis est de **4 documents**. Le dossier papier-ressource (11 août,
postérieur et fondé sur le même inventaire) arrête le short sur la **mesure** (Angle B), dont les
trois résultats sont **déjà acquis**. → **Le short est le papier de mesure.** A1 est rétrogradé en
**section « qualité du gold » du papier long** (versant faisable sans redondance : criblage des
étiquettes suspectes par confident-learning sur les prédictions cross-validées) + programme 2027.
C'est ce que reflètent les programmes du Lab (`papier-court` = échos E1–E5), et c'est cohérent.

**Tension résolue n°2 — G1 (HGNN) vs G2 (co-occurrence).** L'hypothèse centrale a été **testée**
sur les données réelles (04 §4) et le résultat impose la hiérarchie :
- cardinalité multi-label → lift **1,09×** (nul) ;
- rareté brute → lift max **1,76×** (faible, non monotone) ;
- **identité de la combinaison** → lift jusqu'à **7,4×** (LICENSE_IP+TERMINATION 76,9 %,
  FEES_PAYMENT+MODIFICATION_OF_TERMS 76,7 %).

À 275 combinaisons distinctes dont 99 hapax, un HGNN non supervisé n'a pas de quoi apprendre ;
une matrice de co-occurrence + scores d'anomalie de combinaison + test contre les labels, si.
→ **G2 est le cœur exécutable de la partie graphe** ; G1 reste une extension déclarée (et un
argument de programme 2027). Le papier long garde le mot « hypergraph » à bon droit : la clause
multi-thèmes **est** un hyperarc, et l'artefact hypergraphe (clause → {thèmes} + abusivité) est
produit et publié ; c'est le *détecteur profond* qui est différé, pas la représentation.

**Tension résolue n°3 — l'unité d'annotation.** L'unité réelle est la **phrase** (une clause par
phrase, dépliage du pré-remplissage) ; les « clauses » sont des **segments reconstruits** (plages
de phrases consécutives au même jeu de thèmes ; 7 508 phrases → 3 290 segments, ×2,28). Les deux
papiers l'assument : le long construit l'hypergraphe sur les segments reconstruits ; le court en
fait la contribution 3 (la frontière est le vrai point dur, Jaccard 0,39–0,63 vs κ thème 0,769).
**Interdit d'écrire** : « unité = clause annotée », « κ de frontières 1,0 » (artefact), « certitude
0–3 » et « rationales humains » (résidus LLM, É3).

---

## 2. Papier LONG — analyse contribution par contribution

**Thèse.** *(i)* Des annotateurs formés produisent des thèmes multi-label fiables là où le LLM seul
échoue (mur du κ) ; *(ii)* un classifieur supervisé sans LLM à l'inférence apprend ces thèmes à un
niveau utile, mesuré contre le plafond humain ; *(iii)* la structure multi-label ainsi fiabilisée
porte un signal d'abusivité : les **combinaisons de thèmes** rares/typées détectent les clauses
abusives CLAUDETTE — l'anomalie contractuelle est relationnelle, pas phrastique.

### C1 — La fiabilité humaine (le prérequis, section « annotation »)

| Preuve requise | État | Expérience |
|---|---|---|
| κ humain 0,769 vs mur LLM 0,32–0,45 (même vocabulaire, même corpus) | mesuré ad hoc (11/08) | **M1** (nouvelle) : recalcul versionné sur export daté + IC bootstrap par document |
| α-MASI 0,635 < α nominal 0,701 (le multi-label coûte) | mesuré ad hoc | **M1** |
| Par thème : 0,42 (`META`) → 0,89 (`PRIVACY_DATA`) ; Gwet AC en garde-fou de prévalence | partiel (pas de Gwet) | **M1** |
| Accord de frontières reconstruites 0,39–0,63 (Jaccard) | mesuré ad hoc ; l'indicateur plateforme (κ=1,0) est un artefact | **M1** + correctif plateforme V1.1 |

**Risque.** Sur données actuelles, ces chiffres reposent sur **1 paire** (zahra↔elazhar, 4 docs).
L'aperçu doit l'écrire ; les valeurs finales exigent **V0** (soumission des 10 brouillons de
fatima.ouali → 3 paires, 3 triples) — action humaine, hors de portée du code.

### C2 — Le classifieur supervisé [F1] (la section « apprentissage »)

Preuves requises et état — **c'est la partie la plus mûre** : les 11 presets du programme
`papier-long` sont **tous validés** sur le dataset `d22e8722` (39 docs, 7 621 phrases, campagne du
15 août, 118 runs) :

| Résultat du papier | Preset (validé) | Lecture attendue |
|---|---|---|
| Plancher TF-IDF / position seule | `baseline-fast`, `position-only` | première ligne du tableau ; diagnostic Q2 |
| Les 4 juges sous le même protocole (F9) | `llm-judges-baseline` | le supervisé bat-il le zéro-shot figé ? |
| Axes de prétraitement survivants | `screening-preprocess` (48 runs) | méthodologie |
| Embeddings gelés vs fine-tuning (Q4) | `embeddings-frozen`, `legal-bert-finetune` | acquis Palier 6 : fine-tuning +0,02 macro-F1, **non significatif** — les deux ≈ plafond humain approximé |
| Courbe d'apprentissage (F5) | `learning-curve` | « quand peut-on arrêter d'annoter ? » — ajustement F1(n)=a−b·n^(−c) |
| Ablation contexte (F7) | `ablation-context` | le thème est-il positionnel ? |
| **T2 multi-label : micro/macro-F1 + LRAP vs plafond α-MASI** | `multilabel-finetune` | **LE** classifieur du papier phare |
| Robustesse au bruit d'étiquettes (G5, versant classifieur) | `ablation-label-noise` | borne de fiabilité |
| T3 frontières vs fourchette humaine | `sequence-boundary` | le point dur |

**Manque identifié.** L'écart **micro ≫ macro** (le point de rigueur central : fragilité des thèmes
rares) est calculé mais doit être **mis en regard, thème par thème, de l'α par thème de M1** — la
figure « fiabilité humaine vs apprenabilité machine par thème » (corrélation α↔F1) n'existe pas
encore : elle sort de M1 + des `per_label` des runs existants (à assembler dans l'interface de
résultats, pas de nouveau calcul lourd).

### C3 — L'anomalie de co-occurrence [G2] (la section « graphe », le cœur inventif)

**Hypothèse reformulée** (imposée par les données, 04 §4) : *ce n'est ni le nombre de thèmes ni la
rareté brute, c'est **quelles combinaisons de thèmes se rencontrent** qui prédit l'abusivité — le
motif juridiquement lisible « le fournisseur se réserve un pouvoir unilatéral sur un engagement de
l'utilisateur »*.

| Preuve requise | État | Expérience |
|---|---|---|
| Hypergraphe clause–thèmes (artefact d'entrée : segment → {thèmes} + abusivité) | matériau natif dans le dataset Lab (`themes`, `unfair` alignés par phrase) ; **aucun artefact d'export** | **G2** (nouvelle tâche) produit `hypergraph.json` |
| Scores d'anomalie **non supervisés** de combinaison (rareté, PMI/NPMI min intra-combo) + baselines peu profondes (LOF / IsolationForest / OCSVM sur multi-hot) + contrôles négatifs (cardinalité, rareté brute) | rien | **G2** |
| Évaluation **contre les labels** (rare ≠ abusif) : AUC-PR, precision@k, lift@k, **CV par document** (jamais de fuite), IC bootstrap par document | rien | **G2** |
| Référence supervisée assumée : P(abusif \| combinaison) estimé sur train (l'identité de combinaison, lift 7,4×) — borne haute de ce que la structure seule peut donner | mesuré ad hoc, non versionné | **G2** (scorer `combo_identity`, étiqueté « supervisé ») |
| Table qualitative des combinaisons les plus anormales avec exemples | rien | **G2** (artefact) |
| Par famille CLAUDETTE (LTD 296 · TER 236 · CH 188 · …) : où le signal porte | rien | **G2** (AUC-PR un-contre-tous par catégorie) |

### C4 — Les ablations d'honnêteté [D1, G5]

- **D1 (déontique prédite).** `legal_nature` = 0/9 148 : la nature déontique n'est **pas** une
  donnée — c'est confirmé. Le papier la traite en **couche prédite bruitée évaluée en ablation**.
  Pour l'aperçu : un **taggeur déontique à règles** (modaux : *shall/must/may/may not/shall not…*
  → obligation/permission/interdiction/constat), déclaré comme proxy du classifieur LexDeMod-style
  (macro-F1 ~0,6), injecté dans l'identité de combinaison de G2 → **avec/sans**, effet mesuré.
  La contribution est la *méthode de mesure du coût* — un résultat négatif est publiable.
- **G5 (bruit d'étiquettes, versant détection).** Le preset existant dégrade le *train du
  classifieur* ; le roadmap demande aussi la **stabilité des anomalies détectées** quand les thèmes
  se dégradent (macro-F1 0,83 → 0,60 ≃ corruption de 10–35 % des affectations). → axe
  `label_noise` **dans G2** (sweep), corruption déterministe SHA-256, sur train seulement.

---

## 3. Papier COURT — analyse expérience par expérience

**Thèse.** Trois choix d'enrichissement (mono/multi-label ; humains formés/LLM ; ex nihilo/
post-édition) ont un **coût mesurable**, quantifié sur le même corpus, le même vocabulaire fermé
(20 thèmes) et les mêmes phrases. Format : *short* (≤ 6 p.), bascule *long* selon V2 (décision à
J+10 du plan opérationnel).

| # | Expérience du papier | Ce qu'il faut produire | État au 16 août | Expérience Lab |
|---|---|---|---|---|
| **E1** | Coût du multi-label | α-MASI vs α nominal, **global et par thème**, IC bootstrap par document ; test apparié de la différence | chiffres bruts acquis (0,635 vs 0,701), non versionnés, 1 paire | **M1** |
| **E2** | Humains vs LLM à vocabulaire constant | matrice 7×7 (3 annotateurs + 4 juges) : accord brut + κ + Jaccard des jeux de thèmes | mesuré ad hoc (48–60 % humain↔LLM ; 34–81 % LLM↔LLM) | **M1** |
| **E3** | Thème vs frontière | Jaccard des frontières **reconstruites** par paire et par document, contre κ thème | mesuré ad hoc (0,39–0,63) ; indicateur plateforme faux (κ=1,0) | **M1** (+ correctif V1.1) |
| **E4** | Post-édition ≠ ratification | taux de divergence au seed par annotateur et par thème | **le juge de seed n'est pas persisté** (V1.2) → l'aperçu mesure la divergence au **juge le plus proche** (borne inférieure de l'édition réelle : 38–50 %), limite déclarée | **M1** (volet divergence) |
| **E5** | Coût de la cascade | parts auto_1click / auto / manual ; ce que l'arbitrage change vs vote majoritaire ; ambiguïté résiduelle | 3 résolutions existent (425 phrases : 222 strict / 68 majorité / 42 divergence), **aucune finalisée** ; l'export gold ne publie pas `tally` (V1.3) | **M2** (nouvelle) |

**Analyses transverses exigées par le dossier** (§4 de `02_STRATEGIE`) — toutes intégrées à M1 :
- **micro vs macro sur les 20 thèmes** : α et accord par thème avec supports (la longue traîne
  `FEEDBACK` 0,34 %, `META` 0,82 % est là où tout se dégrade) ;
- **Gwet AC1** en complément de κ (prévalence déséquilibrée ; `META` κ 0,42 sur support 9 n'est
  pas interprétable seul) ;
- **IC bootstrap au niveau document, jamais phrase** (les phrases d'un ToS ne sont pas
  indépendantes) — avec 4 documents aujourd'hui, l'IC sera large : c'est un fait à montrer, pas à
  masquer.

**Échos Lab du papier court** (programme `papier-court`, tous validés sauf le dernier) :
`llm-judges-baseline` (R2), `multilabel-finetune` (R1), `sequence-boundary` (contribution 3),
`ablation-gold-quality` (E5 — exige des datasets de maturités différentes ; la maturité `gold`
n'existera qu'après finalisation de résolutions : aperçu sur `submitted` vs `complete`).

---

## 4. Menaces de validité — traitement commun (à écrire, pas à cacher)

| Menace | Traitement dans les papiers | Traitement dans les expériences |
|---|---|---|
| **1 paire dominante** (90 % des phrases soumises = zahra) | κ **par paire**, jamais un global seul ; « study », pas « resource » | M1 rapporte par paire + par annotateur ; variante drafts-inclus pour sensibilité |
| **Petit N documents** (4 multi-annotés soumis ; 39 au total) | IC bootstrap par document ; pas d'extrapolation | déjà la règle du framework stats (03_STATS) ; permutation exacte à petit N |
| **Ancrage du pré-remplissage** | E4 borne l'ancrage (divergence ≫ 0) ; absence de condition contrôlée = limite explicite | M1 divergence vs chaque juge ; V1.2 requis pour la version propre |
| **Rare ≠ abusif** | évaluer contre labels (AUC-PR, precision@k), contrôles négatifs | G2 : cardinalité et rareté brute rapportées comme contrôles |
| **Annotations mono-annotateur dans G2** | les combinaisons reflètent aussi le style d'un annotateur | G2 rejouée après V0/gold ; l'aperçu le déclare |
| **Sévérité CLAUDETTE absente** (tous niveaux = 1) | abusivité **binaire**, jamais « 3 niveaux » | rien à faire côté code ; V1.4 = vérification à la source |
| **LLM ≠ vérité terrain** | juges = référence figée, jamais gold | acquis partout (invariant du module gold) |

**Phrasés verrouillés** (hérités de `docs/pactiva-lab-resultats/`) : « X % du plafond humain
**approximé** » (jamais « bat l'humain ») ; « différence non significative au seuil α=0,05 par
test apparié par document » ; « aperçu sur données en l'état (annotation en cours) ».

---

## 5. La valve mi-août — état au 16 août, et le chemin critique

La valve du roadmap (« si G1 pas prêt mi-août → repli F1+A1 en long ») est **arrivée à échéance**.
État des faits :
- Le repli F1+A1 est **affaibli** (A1 exige la redondance qui manque — É1) ;
- **F1+G2 est solide** : le signal de co-occurrence est fort (lift 7,4×), mesurable **aujourd'hui**,
  et G2 est implémentable en CPU sans HGNN ;
- → **La voie est : long = F1+G2 (+G1 en extension déclarée), court = mesure.** C'est la
  combinaison que ce dossier outille.

**Chemin critique (20 jours restants) :**
1. **V0 — humain, urgentissime, coût nul** : soumission des 10 brouillons de fatima.ouali
   (décision Endomondo 59/498 : terminer ou exclure). Sans V0, le papier court reste « 1 paire ».
   *Aucun code ne peut s'y substituer.*
2. **Aperçu automatisé — ce dossier** : toutes les expériences implémentées et exécutées sur les
   données en l'état → matériel de rédaction immédiat, chiffres re-calculables en un clic après V0.
3. **Re-calcul post-V0** : reconstruire les datasets (nouvelle empreinte), relancer M1/M2/G2 et
   les presets sensibles → chiffres finaux des papiers.
4. **V2 (sur-annotation ciblée) et finalisation gold** : conditionnent la bascule short→long du
   papier de mesure et la maturité `gold` d'`ablation-gold-quality`.
