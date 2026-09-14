# DATA_UNDERSTANDING — CLAUDETTE, la couche thématique et tout ce que l'annotation a produit

> Démarche *Data Understanding* (CRISP-DM) préalable à toute modélisation. Les chiffres proviennent de
> [`DATA_PROFILE.md`](DATA_PROFILE.md), régénéré par `src/profiling/profile_dataset.py` sur l'export
> Lab `7116e627…` (empreinte complète dans `data/processed/manifest.json`). Ce document interprète ; le
> profil mesure. Quand un fait vient d'ailleurs (archive XML originale, base de production), la source
> est indiquée.

---

## 1. Les trois strates de données

| Strate | Origine | Unité | Contenu | Fichier |
|---|---|---|---|---|
| **Texte** | 50 ToS CLAUDETTE (Lippi et al. 2019), redistribution LexGLUE re-alignée sur l'ordre original | phrase (9 414) | `text` tokenisé et `text_detok`, position relative, nombre de phrases du document | `sentences.jsonl` |
| **Référence d'abusivité** | annotation CLAUDETTE d'origine (juristes, adjudication) | phrase × catégorie (1 137 labels sur 1 032 phrases) | 8 catégories : A, CH, CR, J, LAW, LTD, TER, USE ; `level` de sévérité | `reference.jsonl` |
| **Couche thématique** (nôtre) | 3 annotateurs formés × 50 documents, pré-annotations de 4 LLM, cascade de résolution | phrase × annotateur (28 242 votes) ; phrase × juge (37 656) ; phrase gold (9 414) | thème primaire + secondaires (T20), frontières de clause, consensus, gold avec `tally`, `confidence`, `agreement_class`, `auto_level` | `votes.jsonl`, `judges.jsonl`, `gold.jsonl`, `sentences.jsonl` (consensus) |

Métadonnées d'ensemble : `manifest.json` (critères d'export : maturité `submitted`, agrégation
`consensus`, 150 annotations, 20 thèmes, taux multi-label consensus 5,1 %), `labels.json` (supports),
`splits.json` (5 plis groupés par document, graine 42) ; populations **conception (33) / validation
(17)** figées dans la spécification de taxonomie de la plateforme.

## 2. Structure du dataset CLAUDETTE et singularités

- **Unité d'annotation : la phrase.** L'abusivité est attachée à des phrases, pas à des clauses ni à des
  spans. Conséquence pour le graphe : la référence vit au niveau `Sentence` ; toute unité plus large
  (clause, norme) hérite d'une référence **agrégée** dont la règle de projection doit être déclarée
  (voir LEGAL_MODEL §5 et EVALUATION_PLAN §2).
- **Catégories** : 8, dérivées de l'annexe 93/13 et de la doctrine (Micklitz, Pałka & Panagis 2017).
  Distribution très déséquilibrée : LTD 296 (26 %), TER 236 (21 %), CH 188, CR 118, USE 117, LAW 70,
  J 68, **A 44 (3,9 %)**. Couverture documentaire élevée pour toutes (≥ 40 documents sur 50) sauf A (28).
- **Multi-catégorie** : 937 phrases à 1 catégorie, 85 à 2, 10 à 3. Paires dominantes CR+TER (39), CH+TER
  (30), LTD+TER (12) — la résiliation se combine avec le retrait de contenu et le changement unilatéral :
  premier indice de **compositionnalité** exploitable en graphe.
- **Sévérité** : l'export ne porte qu'un niveau (`[1]`), mais les documents originaux tagués
  (`data/claudette_tos/OriginalTaggedDocuments/*.xml`, balises `<ltd2>`, `<ter3>`…) sont dans le dépôt.
  **Réimportée le 15 septembre** par `src/graph/import_claudette_original.py` (alignement séquentiel des
  phrases, 0 divergence avec les fichiers `Labels_<CAT>` — les index de l'export coïncident exactement avec
  le corpus original) : **95.6 % des 1 137 labels** ont un niveau (491 phrases non
  alignées, niveau laissé nul). Distribution : LTD 2:264 · 3:11 ; TER 2:134 · **3:96** ; CH 2:178 · 3:4 ;
  CR 2:70 · 3:42 ; USE 2:112 ; LAW 2:68 ; J 2:1 · **3:65** ; A 2:40 · 3:2 — la juridiction et la résiliation
  concentrent les clauses « clairement abusives » (niveau 3). Anomalie : 9 spans `<a4>` hors référence
  (niveau 4 inexistant dans la nomenclature publiée) à signaler aux auteurs du corpus.
- **Sections** : l'export ne conserve pas les titres `* N. Title` ; le réimport les récupère depuis les XML,
  mais **seuls 3 documents sur 50 portent des marqueurs de section** dans les originaux (26 sections,
  dont 9gag 15). Le niveau `Section` du modèle D est donc **partiel par nature** ; les renvois
  internes (`REFERS_TO`) devront s'appuyer sur les intitulés cités dans le texte, pas sur une structure complète.
- **Trois redistributions publiques non équivalentes** (LexGLUE 9 414 phrases sans identité de document,
  HF multilingue 25 documents, XML original 50 documents avec sévérité et sections) : l'export utilisé
  a ré-établi l'identité et l'ordre des 50 documents ; tout chiffre comparé à LexGLUE doit le dire.
- **Ce que CLAUDETTE ne dit pas** : de quoi parle la phrase (d'où la couche thématique), qui agit, avec
  quelle modalité, sous quelle condition (d'où les templates), et **pourquoi** la phrase est abusive
  (pas de rattachement à un item de l'annexe dans les données — le rattachement est doctrinal, implicite
  dans la définition des catégories).

## 3. La couche thématique : ce qu'elle apporte, ce qu'elle vaut

- **Vocabulaire** : 20 thèmes (T20) à projections versionnées T14/T11/T10 (lecture, sans réécriture) ;
  T11 est la taxonomie de traitement recommandée (α-MASI 0,725 ≥ 0,667 ; toutes classes α ≥ 0,58).
- **Supports T20** : de LICENSE_IP (1 179 primaires) à PROMOTIONS (10) ; quatre thèmes sous 100 phrases
  (PROMOTIONS 10, DMCA 12, FEEDBACK 38, COMMUNICATIONS 68) — **non apprenables ni mesurables** isolément,
  d'où leur fusion sous T11.
- **Accord** : α-MASI 0,658 (jeux), α nominal 0,732 (primaire), coût du multi-label 0,073 ; κ par paire
  0,679–0,795 ; unanimité 3/3 sur 65,2 % des phrases, désaccord total (1-1-1) sur 4,9 % ; α par document
  de 0,52 à 0,87 (médiane 0,74) — l'accord **varie fortement par document**, ce que le graphe doit porter
  (propriété `agreement` sur `Document`, `confidence` sur chaque `HAS_THEME`).
- **Fiabilité par thème** (α binaire) : bimodale — ARBITRATION_DISPUTES 0,90, FEES_PAYMENT 0,86,
  MODIFICATION_OF_TERMS 0,81 … contre DMCA 0,10, FEEDBACK 0,13, COMMUNICATIONS 0,18, PROMOTIONS 0,24.
  Toute requête qui mentionne un thème peu fiable est **indécidable** : les règles ne doivent porter que
  sur des types dont la fiabilité est publiée (T11).
- **Confusions structurantes** : MISC_BOILERPLATE↔PREAMBLE_SCOPE (512 désaccords), LICENSE_IP↔USER_CONTENT
  (409), ACCEPTABLE_USE↔USER_CONTENT (225), DMCA↔LICENSE_IP (223), LIMITATION_LIABILITY↔WARRANTY_DISCLAIMER
  (177). Elles justifient les fusions de T11 — **sauf** la dernière, interdite par les strates
  d'abusivité (lift 3,4 contre 0,42).
- **Styles d'annotateurs** : deux annotateurs à ~9 % de multi-label, un à 31 % (3 233 secondaires) ;
  thème le plus posé LICENSE_IP pour deux, PREAMBLE_SCOPE pour le troisième ; nombre de frontières posées
  de 2 163 à 4 121. Le graphe doit conserver **les votes individuels** (nœud `Annotation`), pas seulement
  le consensus, sinon ces styles — qui sont une information — disparaissent (cf. Braun 2024).
- **Frontières de clause** : Jaccard reconstruit 0,37–0,47 entre annotateurs. La clause consensus (2 450
  clauses ; médiane 2 phrases, p90 9, **max 68**) est donc une unité **moins fiable que le thème** : le
  modèle doit permettre des clauses alternatives (par annotateur) et un re-découpage des clauses longues.

## 4. Lien thème ↔ abusivité : la stratification

| Strate (lift sur base 11,0 %) | Thèmes | Lecture |
|---|---|---|
| **Haute** (≥ 3) | GOVERNING_LAW 4,8 · MODIFICATION_OF_TERMS 4,5 · TERMINATION 3,9 · LIMITATION_LIABILITY 3,4 | 4 thèmes portent 688 des 1 032 phrases abusives ; ce sont les items (g)/(j)/(k)/(a)/(b)/(q) de l'annexe |
| Intermédiaire | DMCA 2,3 (12 phrases — non interprétable) | — |
| **Basse** (≤ 1) | ARBITRATION_DISPUTES 0,95 · USER_CONTENT 0,90 · PREAMBLE_SCOPE 0,88 … LICENSE_IP 0,30 | l'arbitrage n'est « abusif » que par le mécanisme imposé, pas par le thème |
| **Nulle** | FEEDBACK, META, PROMOTIONS 0 ; MISC_BOILERPLATE 0,09 ; COMMUNICATIONS 0,11 | cadrage : 5 phrases abusives au total, à auditer |

Concentration catégorie → thème : A → ARBITRATION_DISPUTES 98 % ; LAW → GOVERNING_LAW 90 % ; LTD →
LIMITATION_LIABILITY 65 % ; CH → MODIFICATION_OF_TERMS 61 % ; TER → TERMINATION 53 % ; **CR dispersé**
(USER_CONTENT 36 %, TERMINATION 23 %, ACCEPTABLE_USE 13 %) ; **USE partagé** entre PREAMBLE_SCOPE 50 % et
MODIFICATION_OF_TERMS 35 %. Deux conséquences : (i) le thème seul est déjà un détecteur (AP 0,404, 3,7 ×
le hasard) que toute méthode graphe doit battre ; (ii) CR et USE sont **intrinsèquement
multi-thèmes** — c'est là que la structure (acteur/action) doit apporter ce que le thème ne peut pas.

## 5. Ce que le processus d'annotation a produit indirectement (à porter dans le graphe)

| Information | Où elle existe | Propriété / nœud proposé |
|---|---|---|
| Votes individuels (primaire + secondaires) par annotateur | `votes.jsonl` | nœud `Annotation` {annotator, primary, secondaries, source=human} |
| Pré-annotations LLM (thème + début de segment) par juge | `judges.jsonl` | nœud `Annotation` {annotator=judge, source=llm, model, version} |
| Consensus (agrégation Lab) et `confidence` | `sentences.jsonl` | `HAS_THEME` {source=consensus, confidence} |
| Gold : `agreement_class`, `auto_level`, `risk_band`, `tally` (soft labels), `decided_primary`, `finalized` | `gold.jsonl` | nœud `GoldDecision` ; `tally` comme propriété map |
| Provenance de la couche (export, empreinte, version de taxonomie, critères) | `manifest.json`, spécification | nœud `Dataset`/`Activity` (PROV) |
| Population conception / validation | spécification de taxonomie | propriété `population` sur `Document` |
| Frontières de clause par annotateur | reconstructibles depuis `votes.jsonl` (changement de jeu) | nœud `Clause` {source=annotator\|consensus} |
| Divergence au juge le plus proche par annotateur (38–49 %) | calculable | propriété d'audit sur `Annotation` |
| Juge de pré-remplissage effectif | **non persisté** (V1.2 jamais faite) | limite déclarée ; pas dans le graphe |
| Sévérité 1/2/3 | archive XML originale | propriété `severity` sur `LABELED` (après réimport) |
| Sections | archive XML originale | nœud `Section` (après réimport) |
| Traductions FR | plateforme | propriété `text_fr` (hors périmètre scientifique) |

## 6. Cas limites, outliers, erreurs potentielles (du profil)

- **5 phrases abusives dans des thèmes de strate nulle** (FEEDBACK/META/MISC/PROMOTIONS) : erreur de
  thème ou label CLAUDETTE discutable → à auditer manuellement (liste dans `outliers.json`).
- **182 textes dupliqués** (phrases identiques, souvent boilerplate) : à traiter comme nœuds distincts
  (contexte différent) mais à signaler dans les analyses de similarité.
- **Clauses très longues** (Oculus 68 phrases FEES_PAYMENT, eBay 49 ARBITRATION_DISPUTES) : artefact de
  la définition « plage de même thème » sur des sections homogènes ; re-découpage nécessaire pour les
  templates (règle : ≤ 8 phrases ou changement de paragraphe/section).
- **Documents extrêmes** : Vimeo 4,9 % de phrases abusives, Twitter 22,5 % — le taux varie de 1 à 4,6 ;
  les métriques par document (bootstrap) sont indispensables.
- **Gold non finalisé** (0/50) et 261 phrases dont la décision gold diffère du consensus : le gold
  arbitre les 1-1-1 ; tant qu'il n'est pas figé, la couche « référence thématique » est le consensus,
  et le graphe doit stocker les deux.
- **Phrases courtes** : aucune < 4 tokens (déjà filtrées) ; médiane 27 tokens, p90 60, max 441 (une
  « phrase » de 441 tokens est un paragraphe non segmenté : cas à examiner).

## 7. Décisions que cette compréhension impose

1. **Deux unités, deux rôles** : `Sentence` = provenance et évaluation ; `Clause` = unité normative,
   avec frontières alternatives et re-découpage.
2. **Le graphe conserve le désaccord** : votes, juges, gold et consensus coexistent avec `source` et
   `confidence` ; aucune couche n'écrase l'autre.
3. **Les règles ne parlent que T11** (fiabilité publiée) ; T20 reste la vérité d'annotation.
4. **Réimport de l'archive XML originale** : fait pour la sévérité (95,6 %) ; sections partielles (voir §2).
5. **Séparation stricte** référence d'abusivité ↔ construction du graphe et des règles (pas de
   `LABELED` lisible par une règle ; contrôle automatique).
