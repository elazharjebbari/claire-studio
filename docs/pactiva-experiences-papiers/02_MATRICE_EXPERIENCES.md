# Matrice exhaustive des expériences — chaque chiffre des papiers, sa source, son statut

> Convention de statut : **✅ acquis** (expérience validée sur `d22e8722`, résultat exploitable) ·
> **🔧 à implémenter** (ce dossier) · **▶ à exécuter** (implémenté, lancement sur données
> actuelles) · **⏳ conditionnel** (dépend d'une action humaine : V0, V2, finalisation gold).
> Toute ligne « source » désigne un artefact versionné : run Lab (dataset figé + config + seed)
> ou fichier du dataset daté.

---

## 1. Papier LONG — *From Reliable Multi-Label Clause Themes to Hypergraph-Based Detection of Unfair Clauses*

### Section 3 — Corpus & annotation (fiabilité)

| Élément du papier | Expérience | Source du chiffre | Statut | Dépendances |
|---|---|---|---|---|
| Tableau 1 — corpus (50 ToS, 9 414 phrases, 20 thèmes, 29,9 % multi-thèmes, distribution) | manifeste du dataset | `manifest.json` + `labels.json` du dataset | ✅ (recalcul au build) | — |
| Tableau 2 — accord : κ 0,769 vs mur LLM 0,32–0,45 ; α-MASI 0,635 vs α nominal 0,701 (+IC doc-bootstrap, test apparié MASI vs nominal) | **M1_agreement** | run M1 sur dataset `submitted` | 🔧 ▶ | V0 pour les valeurs finales (3 paires) |
| Figure F8 — α par thème avec supports (0,42 `META` → 0,89 `PRIVACY_DATA`) + Gwet AC1 | **M1_agreement** | idem (volet `per_theme`) | 🔧 ▶ | — |
| Frontières : Jaccard reconstruit 0,39–0,63 (jamais le κ=1,0 artefactuel) | **M1_agreement** | idem (volet `boundaries`) | 🔧 ▶ | correctif plateforme V1.1 (indicateur public) |

### Section 4 — Le classifieur supervisé [F1]

| Élément du papier | Expérience (preset) | Source | Statut | Dépendances |
|---|---|---|---|---|
| Tableau 3 (résultats T1) ligne planchers | `baseline-fast`, `position-only` | runs validés `d22e8722` | ✅ | re-run post-V0 |
| Tableau 3 ligne juges (figure F9) | `llm-judges-baseline` (sweep 4 juges) | runs validés | ✅ | — |
| Tableau 3 lignes embeddings/fine-tuning + « % du plafond humain approximé » | `embeddings-frozen`, `legal-bert-finetune` | runs validés (Palier 6 réel G5K : +0,02 macro-F1, non significatif) | ✅ | — |
| Comparaison d'encodeurs (juridique paie-t-il ?) | `encoders-comparison` | runs validés (deberta fp16 corrigé) | ✅ | — |
| **Tableau 4 (résultat principal T2)** : micro/macro-F1 + **LRAP**, contre plafond α-MASI | `multilabel-finetune` | runs validés | ✅ | re-run post-V0 |
| Figure F5 — courbe d'apprentissage + extrapolation puissance (cap 2,5×) | `learning-curve` (25 runs) | runs validés | ✅ | — |
| Figure F7 — ablation contexte (thème positionnel ?) | `ablation-context` (6 runs) | runs validés | ✅ | — |
| Méthodo — axes de prétraitement survivants | `screening-preprocess` (48 runs) | runs validés | ✅ | — |
| Figure « fiabilité humaine vs apprenabilité par thème » (α↔F1 par thème) | assemblage M1 × `per_label` des runs T1/T2 | vue de résultats (aucun calcul lourd) | 🔧 | M1 |
| Tableau T3 frontières vs fourchette humaine | `sequence-boundary` | runs validés | ✅ | — |

### Section 5 — L'hypergraphe et l'anomalie de co-occurrence [G2]

| Élément du papier | Expérience | Source | Statut | Dépendances |
|---|---|---|---|---|
| Artefact hypergraphe : segment → {thèmes} + abusivité, par document | **G2_cooccurrence** (artefact `hypergraph.json`) | run G2 | 🔧 ▶ | — |
| Statistiques de structure : 3 290 segments, ×2,28, 275 combinaisons dont 99 hapax | **G2_cooccurrence** (volet `structure`) | run G2 | 🔧 ▶ | — |
| **Tableau 5 — détection** : AUC-PR / precision@k / lift@k par scorer (rareté, NPMI min, LOF, IF, OCSVM) + contrôles négatifs (cardinalité, rareté brute) + référence supervisée `combo_identity` ; CV 5 plis par document ; IC bootstrap par document | **G2_cooccurrence** | run G2 | 🔧 ▶ | annotations mono-annotateur : aperçu, à rejouer sur gold |
| Figure — top combinaisons anormales, avec lift et exemples (LICENSE_IP+TERMINATION 76,9 %…) | **G2_cooccurrence** (volet `combinations`) | run G2 | 🔧 ▶ | — |
| Par catégorie CLAUDETTE (LTD/TER/CH/CR/USE/LAW/J/A) : où le signal porte | **G2_cooccurrence** (volet `per_category`) | run G2 | 🔧 ▶ | — |
| Extension G1 (HGNN) : déclarée, non exécutée (275 combinaisons = trop peu) | — (texte) | 01_ANALYSE §1 | ✅ décidé | programme 2027 |

### Section 6 — Ablations [D1, G5]

| Élément du papier | Expérience | Source | Statut | Dépendances |
|---|---|---|---|---|
| D1 — coût de la couche déontique prédite : G2 avec/sans tag déontique (proxy à règles, déclaré) | **G2_cooccurrence** `deontic: none\|rule_based` (sweep) | 2 runs G2 | 🔧 ▶ | classifieur LexDeMod-style = extension |
| G5 — stabilité des anomalies sous bruit de thèmes (0 → 0,35 de corruption, ≃ macro-F1 0,83→0,60) | **G2_cooccurrence** `label_noise` (sweep, répétitions) | runs G2 | 🔧 ▶ | — |
| G5 (versant classifieur) — robustesse du F1 au bruit du gold | `ablation-label-noise` | runs validés | ✅ | — |

---

## 2. Papier COURT — *How Much Does Multi-Label Cost?*

| Élément du papier | Expérience | Source | Statut | Dépendances |
|---|---|---|---|---|
| **E1** — α-MASI vs α nominal, global + par thème, IC doc-bootstrap, test apparié de la différence (le multi-label franchit le seuil 0,667 vers le bas) | **M1_agreement** | run M1 (`submitted`) | 🔧 ▶ | **V0** pour 3 paires |
| **E2** — matrice 7×7 (3 annotateurs × 4 juges) : accord brut, κ, Jaccard des jeux de thèmes ; lecture « le mur du κ est une limite des modèles » | **M1_agreement** (volet `matrix`) | run M1 | 🔧 ▶ | — |
| **E3** — thème vs frontière : Jaccard reconstruit par paire/document vs κ thème | **M1_agreement** (volet `boundaries`) | run M1 | 🔧 ▶ | V1.1 pour l'indicateur plateforme |
| **E4** — divergence au seed par annotateur et par thème (aperçu : divergence au juge le plus proche = borne inférieure ; limite déclarée : seed non persisté) | **M1_agreement** (volet `divergence`) | run M1 | 🔧 ▶ | **V1.2** pour la mesure exacte (prospectif) |
| **E5** — cascade : parts auto_1click/auto/manual, ce que l'arbitrage change vs majorité, ambiguïté résiduelle | **M2_gold_cascade** | run M2 | 🔧 ▶ | ⏳ finalisation de ≥3 résolutions pour les chiffres définitifs |
| Transverse — Gwet AC1 par thème (garde-fou de prévalence) | **M1_agreement** | run M1 | 🔧 ▶ | — |
| Transverse — micro vs macro (longue traîne : `FEEDBACK` 0,34 %, `META` 0,82 %) | **M1_agreement** + `multilabel-finetune` | runs | 🔧 ▶ / ✅ | — |
| Écho R2 — les 4 juges sous protocole identique | `llm-judges-baseline` | runs validés | ✅ | — |
| Écho R1 — micro/macro T2 contre plafond α-MASI | `multilabel-finetune` | runs validés | ✅ | — |
| Contribution 3 — frontière point dur (modèle aussi : T3 vs fourchette humaine) | `sequence-boundary` + M1 | runs | ✅ / 🔧 | — |
| Écho E5 — la qualité du gold paie-t-elle ? (`submitted` vs `complete` [vs `gold`]) | `ablation-gold-quality` sur 2 (puis 3) datasets | runs | ▶ partiel | ⏳ maturité `gold` après finalisation |
| Sensibilité — mesures brouillons-inclus (drafts) vs soumis-seuls | **M1_agreement** sur dataset `any` | run M1 (`any`) | 🔧 ▶ | — |

---

## 3. Correctifs plateforme adjacents (gates de publication, hors expériences)

| # | Correctif | Bloque | Statut |
|---|---|---|---|
| V1.1 | `boundaryKappa` sur frontières **reconstruites** (l'actuel vaut 1,0 par construction) | E3 (indicateur public trompeur) | 🔧 planifié (03_PLAN §6) |
| V1.2 | Persister le juge de pré-remplissage (`seeded_from`) | E4 exact + papier ancrage 2027 | 🔧 planifié (prospectif — ne corrige pas le passé) |
| V1.3 | Export gold : publier `tally` + votes (soft labels — réponse à Braun 2023) | contribution 4 du court, ressource 2027 | 🔧 planifié |
| V1.4 | Revérifier la sévérité CLAUDETTE à la source (tous les labels importés = niveau 1) | formulation « 3 niveaux » | action externe (EUI) |

---

## 4. Vue d'ensemble des exécutions « aperçu » (données en l'état)

| Ordre | Expérience | Dataset | Coût | Produit |
|---|---|---|---|---|
| 1 | rebuild datasets (avec `votes.jsonl` + `gold.jsonl`) | `complete/consensus` (39 docs) · `submitted` · `any` | ~1 min | 3 exports datés |
| 2 | **M1_agreement** | `submitted` puis `any` (sensibilité) | ~1 min CPU | E1/E2/E3/E4 + F8 (aperçu) |
| 3 | **M2_gold_cascade** | `complete` | ~10 s CPU | E5 (aperçu, non finalisé) |
| 4 | **G2_cooccurrence** (run pivot : tous scorers) | `complete` | ~2 min CPU | Tableau 5 + hypergraphe + combinaisons |
| 5 | **G2** sweep D1 (deontic none/rule_based) | `complete` | ~4 min CPU | ablation D1 |
| 6 | **G2** sweep G5 (label_noise 0/0,1/0,2/0,35 ×3 répétitions) | `complete` | ~10 min CPU | ablation G5-détection |
| 7 | `ablation-gold-quality` | `submitted` vs `complete` | ~40 min CPU | écho E5 partiel |

Aucun GPU requis : les 🔧 sont toutes CPU. Les presets GPU (✅) ne sont **pas** relancés — leurs
runs validés du 15 août font foi jusqu'au re-calcul post-V0.
