# DATA_PROFILE — export `7116e627…` (généré par `src/profiling/profile_dataset.py`)

> Régénéré automatiquement ; ne pas éditer à la main. Chiffres calculés sur `data/processed/`.

## 1. Vue d'ensemble

| Mesure | Valeur |
|---|---|
| fingerprint_manifest | 7116e627f528c5572457e79d9e53d2e71bfc21e3a20aacb43e9d3072cfb70e2e |
| n_documents | 50 |
| n_sentences | 9414 |
| n_annotations | 150 |
| n_votes | 28242 |
| n_judge_predictions | 37656 |
| n_reference_labels | 1137 |
| n_unfair_sentences | 1032 |
| base_rate_unfair | 0.1096 |
| sentence_tokens | {'min': 6, 'median': 27.0, 'mean': 32.7044, 'p90': 60, 'max': 441} |
| multi_label_rate_consensus | 0.0509 |
| populations | {'designSet': 33, 'holdout': 17} |
| severity_levels_present | [1] |
| severity_reimported | {'coverage_of_reference': 0.956, 'by_category': {'A': {2: 40, 3: 2}, 'CH': {2: 178, 3: 4}, 'CR': {2: 70, 3: 42}, 'J': {2: 1, 3: 65}, 'LAW': {2: 68}, 'LTD': {2: 264, 3: 11}, 'TER': {2: 134, 3: 96}, 'USE': {2: 112}}, 'source': 'data/claudette_tos/OriginalTaggedDocuments (src/graph/import_claudette_original.py)'} |

## 2. Catégories CLAUDETTE (référence d'abusivité)

| Catégorie | Phrases | Documents | Part | Thèmes dominants | Concentration top-1 |
|---|---|---|---|---|---|
| A | 44 | 28 | 0.0387 | ARBITRATION_DISPUTES:43;GOVERNING_LAW:1 | 0.9773 |
| CH | 188 | 49 | 0.1653 | MODIFICATION_OF_TERMS:115;FEES_PAYMENT:32;TERMINATION:9;ELIGIBILITY_ACCOUNT:8 | 0.6117 |
| CR | 118 | 45 | 0.1038 | USER_CONTENT:43;TERMINATION:27;ACCEPTABLE_USE:15;ELIGIBILITY_ACCOUNT:10 | 0.3644 |
| J | 68 | 40 | 0.0598 | ARBITRATION_DISPUTES:38;GOVERNING_LAW:30 | 0.5588 |
| LAW | 70 | 47 | 0.0616 | GOVERNING_LAW:63;ARBITRATION_DISPUTES:6;FEES_PAYMENT:1 | 0.9 |
| LTD | 296 | 49 | 0.2603 | LIMITATION_LIABILITY:192;THIRD_PARTY_SERVICES:24;WARRANTY_DISCLAIMER:17;TERMINATION:16 | 0.6486 |
| TER | 236 | 48 | 0.2076 | TERMINATION:124;LICENSE_IP:22;ELIGIBILITY_ACCOUNT:20;MODIFICATION_OF_TERMS:20 | 0.5254 |
| USE | 117 | 48 | 0.1029 | PREAMBLE_SCOPE:59;MODIFICATION_OF_TERMS:41;PRIVACY_DATA:9;FEES_PAYMENT:3 | 0.5043 |

Phrases portant plusieurs catégories : {1: 937, 2: 85, 3: 10} ; paires les plus fréquentes : CR+TER (39), CH+TER (30), LTD+TER (12), CH+LTD (8), CR+LTD (8).

## 3. Thèmes (couche thématique) : supports, strates d'abusivité, fiabilité binaire

| Thème | Primaire | Tout | Votes | Docs | Abusives | P(abusif) | Lift | Strate | α binaire | Catégories |
|---|---|---|---|---|---|---|---|---|---|---|
| GOVERNING_LAW | 167 | 168 | 611 | 47 | 89 | 0.5298 | 4.8325 | high | 0.632 | LAW:64;J:30;A:1 |
| MODIFICATION_OF_TERMS | 361 | 387 | 1250 | 49 | 189 | 0.4884 | 4.455 | high | 0.8133 | CH:134;USE:41;TER:22 |
| TERMINATION | 373 | 416 | 1415 | 50 | 179 | 0.4303 | 3.9251 | high | 0.7485 | TER:150;CR:36;LTD:21 |
| LIMITATION_LIABILITY | 507 | 613 | 2067 | 49 | 231 | 0.3768 | 3.4375 | high | 0.7275 | LTD:229;TER:3;CH:2 |
| DMCA | 12 | 12 | 182 | 7 | 3 | 0.25 | 2.2805 | mid | 0.1041 | TER:3;CR:1 |
| ARBITRATION_DISPUTES | 857 | 858 | 2691 | 43 | 89 | 0.1037 | 0.9462 | low | 0.8977 | A:43;J:39;LAW:7 |
| USER_CONTENT | 535 | 615 | 2302 | 46 | 61 | 0.0992 | 0.9048 | low | 0.5989 | CR:45;LTD:17;TER:6 |
| PREAMBLE_SCOPE | 665 | 665 | 2547 | 50 | 64 | 0.0962 | 0.8779 | low | 0.6086 | USE:59;CH:6;TER:2 |
| THIRD_PARTY_SERVICES | 434 | 450 | 1593 | 41 | 28 | 0.0622 | 0.5676 | low | 0.7366 | LTD:25;USE:1;CH:1 |
| FEES_PAYMENT | 1043 | 1075 | 3344 | 40 | 61 | 0.0567 | 0.5176 | low | 0.864 | CH:33;TER:14;LTD:12 |
| WARRANTY_DISCLAIMER | 529 | 560 | 1914 | 49 | 26 | 0.0464 | 0.4235 | low | 0.7344 | LTD:23;CH:3;TER:2 |
| ELIGIBILITY_ACCOUNT | 804 | 808 | 2440 | 50 | 35 | 0.0433 | 0.3951 | low | 0.7555 | TER:20;CR:10;CH:8 |
| PRIVACY_DATA | 260 | 269 | 1026 | 43 | 11 | 0.0409 | 0.373 | low | 0.6197 | USE:9;LTD:1;CH:1 |
| ACCEPTABLE_USE | 927 | 1000 | 3410 | 50 | 39 | 0.039 | 0.3558 | low | 0.6802 | TER:24;CR:19;LTD:3 |
| LICENSE_IP | 1179 | 1216 | 3743 | 50 | 40 | 0.0329 | 0.3001 | low | 0.7718 | TER:24;CR:8;CH:5 |
| COMMUNICATIONS | 68 | 80 | 360 | 26 | 1 | 0.0125 | 0.114 | low | 0.1841 | TER:1 |
| MISC_BOILERPLATE | 522 | 522 | 1495 | 49 | 5 | 0.0096 | 0.0874 | low | 0.5332 | LTD:2;CH:2;TER:1 |
| FEEDBACK | 38 | 38 | 124 | 20 | 0 | 0.0 | 0.0 | low | 0.1252 |  |
| META | 123 | 140 | 645 | 46 | 0 | 0.0 | 0.0 | low | 0.5113 |  |
| PROMOTIONS | 10 | 11 | 95 | 3 | 0 | 0.0 | 0.0 | low | 0.2396 |  |

## 4. Accord inter-annotateurs

- α-MASI (jeux de thèmes) : **0.6581** ; α nominal (primaire) : **0.7315** ; coût du multi-label : 0.0735
- Unanimité (3/3) : 0.6522 ; désaccord total (1-1-1) : 0.0491 ; α nominal par document : min 0.5226, médiane 0.7407999999999999, max 0.8689

| Paire | Phrases | Accord brut | κ |
|---|---|---|---|
| elazhar.jebbari ↔ fatima.ouali | 9414 | 0.8102 | 0.7949 |
| elazhar.jebbari ↔ zahra.boulaich | 9414 | 0.7427 | 0.7217 |
| fatima.ouali ↔ zahra.boulaich | 9414 | 0.7025 | 0.6788 |

Confusions primaires les plus fréquentes : MISC_BOILERPLATE↔PREAMBLE_SCOPE (512), LICENSE_IP↔USER_CONTENT (409), ACCEPTABLE_USE↔USER_CONTENT (225), DMCA↔LICENSE_IP (223), ACCEPTABLE_USE↔LICENSE_IP (218), ACCEPTABLE_USE↔ELIGIBILITY_ACCOUNT (188), LIMITATION_LIABILITY↔WARRANTY_DISCLAIMER (177), LICENSE_IP↔PREAMBLE_SCOPE (176).

| Annotateur | Votes | Taux multi-label | Secondaires posés | Entropie primaire (bits) | Thème le plus posé |
|---|---|---|---|---|---|
| elazhar.jebbari | 9414 | 0.09 | 881 | 3.8192 | LICENSE_IP |
| fatima.ouali | 9414 | 0.0921 | 898 | 3.9662 | LICENSE_IP |
| zahra.boulaich | 9414 | 0.3088 | 3233 | 3.8223 | PREAMBLE_SCOPE |

## 5. Juges LLM (pré-annotations, même vocabulaire)

| judge | n | accuracy_vs_consensus | kappa_vs_consensus | kappa_vs_elazhar | kappa_vs_fatima | kappa_vs_zahra | n_segment_starts | top_theme | share_top_theme |
|---|---|---|---|---|---|---|---|---|---|
| claude | 9414 | 0.5442 | 0.5199 | 0.5335 | 0.4436 | 0.4881 | 1404 | LICENSE_IP | 0.1241 |
| codex | 9414 | 0.3039 | 0.2647 | 0.2646 | 0.2388 | 0.3001 | 1917 | PREAMBLE_SCOPE | 0.2493 |
| fable | 9414 | 0.6009 | 0.5797 | 0.5936 | 0.5411 | 0.4468 | 1728 | LICENSE_IP | 0.1309 |
| mistral | 9414 | 0.3616 | 0.3303 | 0.342 | 0.2969 | 0.2911 | 1521 | ACCEPTABLE_USE | 0.1071 |

κ juge ↔ juge : claude↔codex 0.4361, claude↔fable 0.8002, claude↔mistral 0.5403, codex↔fable 0.4476, codex↔mistral 0.2964, fable↔mistral 0.5264.

## 6. Gold (cascade de résolution)

```json
{
 "n": 9414,
 "agreement_class": {
  "majority": 4546,
  "strict": 4406,
  "divergence": 462
 },
 "auto_level": {
  "auto": 4546,
  "auto_1click": 4406,
  "manual": 462
 },
 "risk_band": {
  "medium": 4546,
  "low": 4406,
  "high": 462
 },
 "decided": 9414,
 "finalized": 0,
 "confidence": {
  "mean": 0.8677,
  "share_lt_0.67": 0.3478
 },
 "changed_vs_consensus": 261
}
```

## 7. Cas limites, outliers, incohérences potentielles

- Clauses (plages de même jeu de thèmes) : {'n_clauses': 2450, 'median': 2.0, 'p90': 9, 'max': 68}
- Phrases < 4 tokens : 0 ; textes dupliqués : 182
- Documents les moins/plus abusifs : [('Vimeo', 0.0491), ('Microsoft', 0.0547), ('Nintendo', 0.0585), ('Airbnb', 0.0639), ('Spotify', 0.0683)] / [('Betterpoints_UK', 0.2035), ('Supercell', 0.2057), ('TrueCaller', 0.2143), ('Atlas', 0.2167), ('Twitter', 0.225)]
- Phrases abusives dont le thème est de strate nulle ['FEEDBACK', 'META', 'MISC_BOILERPLATE', 'PROMOTIONS'] : **5** (à auditer : erreur de thème ou de label ?)
- Phrases unanimes (3/3) sur un thème peu fiable ['COMMUNICATIONS', 'DMCA', 'FEEDBACK', 'PROMOTIONS'] : 0
- Clauses les plus longues : Oculus (68 phr., FEES_PAYMENT), eBay (49 phr., ARBITRATION_DISPUTES), LinkedIn (48 phr., ACCEPTABLE_USE), LindenLab (45 phr., LICENSE_IP), Skype (44 phr., FEES_PAYMENT)

## 8. Fichiers produits

`documents.csv`, `themes.csv`, `categories.csv`, `theme_x_category.csv`, `theme_cooccurrence.csv`, `annotator_pairs.csv`, `annotator_confusion.csv`, `annotator_style.csv`, `agreement.json`, `agreement_by_document.csv`, `judges.csv`, `judge_pairs.csv`, `gold_cascade.json`, `outliers.json`, `overview.json`.
