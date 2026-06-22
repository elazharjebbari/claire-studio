# Intégration dans claire-studio — état & analyse d'écart

Carte d'intégration relevée sur le code (chemins absolus sous `/Users/elazhar/PycharmProjects/claire-studio/`).

## 1. Ce qui se réutilise TEL QUEL (forte économie)
| Brique | Emplacement | Réutilisation |
|---|---|---|
| Source unique des juges (N-way) | `frontend/src/lib/llmJudges.ts` (`LLM_JUDGES`) | claude/codex/mistral + couleurs |
| Pré-annotations par juge | `frontend/src/lib/api/hooks.ts` `useLlmAgreement` → **`preByJudge`** | votes par juge déjà indexés |
| Accord par phrase N-way | `frontend/src/lib/llmAgreement.ts` **`agreementNway`** | base du calcul d'accord thème |
| Runs & frontières | `frontend/src/lib/runs.ts` (`computeRuns`, `coalesceRuns`, `conflictZones`, `nextBoundaryFrom`) | base des frontières & zones de désaccord |
| Carte de suggestion par phrase | `frontend/src/components/workspace/SentenceMenu.tsx` (section « Propositions LLM ») | réceptacle direct |
| Carte d'arbitrage par frontière | `frontend/src/components/workspace/BoundaryEvidence.tsx` (onglets par juge + Choisir) | réceptacle direct |
| Adoption / validation | store `resolveDivergence(Range)`, `setValidated`/`validateClauses`, provenance `seededFrom`/`resolvedFrom` | « l'humain valide la suggestion » déjà là |
| Prefill commutable N-modèles | store `replacePrefill`, toolbar `prefill-switch` | brouillon éditable par juge |
| Palette de thèmes (20 codes) | back `imports/theme_mapping.py` `CANONICAL_THEMES` ; front `design-tokens.json` + `lib/tokens.ts` | thèmes + couleurs alignés, **refuges présents** |

## 2. Ce qui doit être ÉTENDU (l'écart réel)
| Axe | État actuel | Cible protocole | Impact |
|---|---|---|---|
| **Étiquetage** | **mono** : `Clause.theme` FK scalaire + **INV-2** (1 clause/phrase) | **multi** : 1 primaire + N secondaires | table enfant `ClauseTheme` ; `contract.ts theme:string→themes[]` ; `DraftClause.theme→themes` ; rendu badge/palette |
| **Niveau** | certitude **0–3** (subjective) | **C1–C5** (dérivé de l'accord) | **nouveau** champ `triage_level`, **distinct** de la certitude (ne pas écraser 0–3) |
| **Frontière** | binaire (début de run), pas stockée | **dure/molle** + support | champ `boundary_type`/`boundary_support` ; rendu + fusion/scission |
| **File de triage** | absente | file par doc/niveau | nouvel objet `QueueItem` (dérivé live et/ou pré-calculé) |
| **Écriture en lot** | `add_clause` **unitaire** | accept par lot (C1) | endpoint batch + action store `batchAccept` |
| **Explication** | absente (carte LLM brute) | contexte/décision/logique dérivés de la règle | moteur qui retourne `explanation` structurée |

## 3. Réconciliation du vocabulaire (point d'attention)
Les **codes de thème** du protocole (`VOCABULAIRE.md`) et ceux du scheme de l'app
diffèrent par leur libellé : ex. `DISPUTE_ARBITRATION` (protocole) ↔ `ARBITRATION_DISPUTES`
(app), `PAYMENT_BILLING` ↔ `FEES_PAYMENT`, `LIABILITY_LIMITATION` ↔ `LIMITATION_LIABILITY`,
`SUBSCRIPTION_RENEWAL`/`INDEMNIFICATION`/`DEFINITIONS`/`THIRD_PARTY` à mapper sur les codes
app (`PROMOTIONS`?/`THIRD_PARTY_SERVICES`/…). **Décision** : une **table de mapping**
versionnée (`moteur/07-regles-routage.yaml` → `theme_aliases`) traduit les codes du
protocole vers les codes canoniques du scheme app au moment du triage. Les **refuges**
(`PREAMBLE_SCOPE`, `MISC_BOILERPLATE`) existent des deux côtés ✅.

## 4. Décision d'architecture : où vit le moteur de triage ?
- **Front (retenu pour la réactivité)** : un **moteur pur TS** consomme `preByJudge` +
  `agreementNway` + `runs` (déjà calculés) et produit, **en direct et sans round-trip**,
  l'item de triage par phrase (niveau, proposition, frontière, explication). C'est ce qui
  rend l'UX **fluide** (recalcul instantané quand on change de version/juges).
- **Back (miroir, pour le batch & l'oracle)** : un service Python (calqué sur
  `triage_v9_2_confidence.py`) peut **pré-calculer** une file persistée et **consolider**
  les clauses multi-label validées (oracle + audit). Utile pour l'export et la mesure α MASI.
- **Source unique des règles** : un fichier **`07-regles-routage.yaml`** (refuges,
  clusters, préséance, priorité, aliases) — généré en constante TS pour le front et lu par
  le Python. **Un seul endroit à versionner** (= `VOCABULAIRE.md` rendu exécutable).

→ Détail des choix et de leurs alternatives dans `comparatif/`. Architecture cible dans
`architecture/`. Le moteur et ses règles dans `moteur/`.

## 5. Invariants existants à préserver
- **INV-2** (1 clause par phrase d'ancre) : **conservé** — le multi-label vit *dans* la
  clause (table enfant), pas en multipliant les clauses. ✅
- **INV-4** (1 session par (projet, doc, annotateur)), **owner-only writes**,
  idempotence `client_op_id` : inchangés.
- Certitude 0–3 (INV-6) : **inchangée** ; C1–C5 est un champ **distinct** dérivé.
