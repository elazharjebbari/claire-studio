# Étude comparative des solutions (par composant)

Pour chaque composant du système, on compare les options selon **4 critères** :
**force**, **faiblesse**, **pertinence** (vis-à-vis du protocole), **qualité d'expérience
utilisateur (UX)**. Le scoring pondéré est dans `03-matrice-decision.csv`. Le choix retenu
est marqué ✅.

---

## A. Moteur de triage (où s'applique la logique C1–C5)
| Option | Force | Faiblesse | Pertinence | UX |
|---|---|---|---|---|
| **A1. Backend only** (file pré-calculée, service Python) | autorité unique, batch facile, mesure α MASI native | round-trip pour chaque changement de version/juge ; latence ; pas réactif | bonne (miroir du script) | moyenne (pas instantané) |
| **A2. Frontend pur** (moteur TS sur `preByJudge`) | **réactif/instantané**, réutilise toute l'infra N-way, testable (pur) | duplique la logique si pas partagée ; pas d'oracle serveur | bonne | **excellente** (fluide) |
| **A3. Hybride** ✅ : règles YAML uniques → moteur TS (front, réactif) + miroir Python (batch/oracle) | une seule source de règles ; UX front fluide **et** oracle/mesure côté back ; cohérence garantie | 2 implémentations du moteur (mais pilotées par la même spec + tests de parité) | **excellente** | **excellente** |

**Retenu : A3.** La spec YAML (`moteur/07-regles-routage.yaml`) est la **source unique** ;
le front l'embarque comme constante (réactivité), le back la lit (batch/oracle). Un test de
**parité** (mêmes entrées → même niveau/proposition) verrouille la cohérence.

---

## B. Modèle multi-label (comment stocker primaire + secondaires)
| Option | Force | Faiblesse | Pertinence | UX |
|---|---|---|---|---|
| **B1. M2M `Clause.themes`** | relationnel propre | rôle (primary/secondary) sur la table de liaison → migrations + requêtes plus lourdes | bonne | n/a |
| **B2. Table enfant `ClauseTheme`** ✅ (clause_id, label, role, support, order) | exprime **1 primaire + N secondaires**, validateurs simples (exactly-one-primary, refuge≠secondary), **rétro-compatible** (mono = 1 ligne) | une table de plus | **excellente** (colle au SCHEMA.md) | n/a |
| **B3. JSON `themes` sur `Clause`** | zéro migration relationnelle | pas de contrainte SQL (validation applicative seulement), requêtes/IAA plus dures | moyenne | n/a |

**Retenu : B2.** Conserve **INV-2** (1 clause/phrase) ; le multi-label vit *dans* la clause.
Mono-label = exactement 1 `ClauseTheme` `primary` ⇒ migration triviale du legacy.

---

## C. Niveau de confiance C1–C5 vs certitude 0–3
| Option | Force | Faiblesse | Pertinence | UX |
|---|---|---|---|---|
| **C1. Remplacer 0–3 par C1–C5** | un seul axe | **viole le protocole** (confiance = accord, pas auto-déclaration) ; casse INV-6 + historique | **faible** | confusion (2 sens mélangés) |
| **C2. Deux axes orthogonaux** ✅ : `triage_level` (C1–C5, dérivé de l'accord) **+** `certainty` (0–3, subjective humaine) | respecte le protocole, n'altère pas l'existant | un champ de plus | **excellente** | claire (niveau = vigilance ; certitude = confiance perso) |

**Retenu : C2.** `triage_level` est **dérivé** (et stocké pour audit), la certitude 0–3 reste.

---

## D. Frontière dure/molle
| Option | Force | Faiblesse | Pertinence | UX |
|---|---|---|---|---|
| **D1. Dérivée seule** (jamais stockée) | zéro migration | pas d'audit, pas de « validated_by », recalcul permanent | moyenne | ok |
| **D2. Stockée hard/soft + support** ✅ | audit, fusion/scission tracées, conforme SCHEMA.md | migration | **excellente** | **excellente** (fusion/scission 1 clic, état persistant) |

**Retenu : D2.** Frontière proposée dérivée de l'accord N-way sur `is_block_start`, puis
**figée** (hard/soft + validated_by) à la validation.

---

## E. Expérience d'annotation (le « comment »)
| Option | Force | Faiblesse | Pertinence | UX |
|---|---|---|---|---|
| **E1. Inline seulement** (badges/cartes dans le document) | reste dans le contexte | pas d'accélération de masse (pas de lot, pas de flux clavier) | moyenne | bonne mais lente sur C1/C2 |
| **E2. File de triage dédiée** (inbox par niveau, clavier) | **vide C1+C2 en secondes**, flux focalisé par niveau | sort du document (contexte) | bonne | rapide mais peut désancrer |
| **E3. Hybride** ✅ : **File de triage** (accélérateur, clavier-first) **+** carte de suggestion **inline** (édition en contexte) | le meilleur des deux : vitesse de masse **et** édition ancrée | 2 surfaces à concevoir (cohérentes) | **excellente** | **excellente** |

**Retenu : E3.** La File est l'accélérateur ; la carte inline garde l'ancrage documentaire.
Les deux partagent **le même moteur** et **les mêmes gestes** (cf. `ux/`).

---

## F. Explication de la suggestion (contexte / décision / logique)
| Option | Force | Faiblesse | Pertinence | UX |
|---|---|---|---|---|
| **F1. Templates statiques par niveau** | simple | générique, ne dit pas *pourquoi ce cas* | faible | pauvre |
| **F2. Explication générée par LLM** | naturelle | coût/latence, **non déterministe**, non traçable (anti-protocole) | faible | jolie mais lente/risquée |
| **F3. Explication dérivée de la règle** ✅ : structurée `{context: votes K juges, decision: set+frontière, logic: règle qui s'applique}` | **déterministe, traçable, instantanée**, journalisable | gabarits à rédiger | **excellente** (= audit du protocole) | **excellente** |

**Retenu : F3.** L'explication EST la sortie du moteur (la règle qui a routé la phrase),
donc gratuite, exacte et réversible. Ex. : *« Override anti-refuge : 2 juges PAYMENT_BILLING,
1 juge MISC (refuge, κ=0,27) → on impose le précis. Annulable. »*

---

## G. Écriture en lot (C1 batch_accept)
| Option | Force | Faiblesse | Pertinence | UX |
|---|---|---|---|---|
| **G1. Boucle d'`add_clause` unitaires** | zéro back | N requêtes, pas atomique, lent | faible | lent |
| **G2. Endpoint batch transactionnel** ✅ `POST …/clauses:batch` (idempotent par `client_op_id`) | **1 requête atomique**, rapide, journalisé | un endpoint de plus | **excellente** | **excellente** (lot instantané) |

**Retenu : G2.**

---

## Synthèse des choix retenus
A3 (hybride règles-uniques) · B2 (`ClauseTheme`) · C2 (deux axes) · D2 (frontière stockée) ·
E3 (file + inline) · F3 (explication dérivée de la règle) · G2 (batch transactionnel).
Scoring détaillé : `03-matrice-decision.csv`.
