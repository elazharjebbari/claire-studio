# Moteur de scoring (PUR, testable) — `claire/projects/gold_scoring.py` (+ miroir `lib/goldScoring.ts`)

## Entrées (par phrase)
- `annotator_votes`: [{primary: code|None, secondaries: [code]}] (None = phrase non couverte par cet annotateur).
- `llm_votes`: idem pour claude/codex/mistral (forward-fill côté construction des vecteurs).
- `config`: ResolutionConfig (pondérations + llm.role + seuils).

## Décision PRIMAIRE — électorat pondéré
- `weighted_tally`: somme de POIDS par thème (annotateur=`annotatorWeights[id]` défaut 3 ; LLM=`llm.weight` défaut 1) selon `llm.role` :
  - `ignore` : LLM non comptés.
  - `tiebreak` : LLM ne départagent QUE les ex-aequo humains.
  - `signal` : LLM comptés pour le signal/affichage, pas pour la décision.
  - `full` : LLM comptés avec leur poids.
- `human_block` = primaire majoritaire pondéré des **seuls** annotateurs ; `llm_block` = idem LLM.
- `human_dissent` = `human_block.primary != llm_block.primary` (deux présents) → `needs_human=True`, niveau plafonné, exclu de l'auto. **C'est le « signal fort » : une décision humaine ≠ LLM mérite attention.**

## Classification (`agreement_class`)
- `strict` : tous les annotateurs (couvrant la phrase) ont le **même** primaire ET le même set de secondaires.
- `majority` : majorité pondérée humaine sans unanimité.
- `divergence` : pas de majorité humaine (split).

## Scores
- `confidence = clamp01((w_top - w_second) / w_total) * reliability_kappa.get(primary, 0.5)`.
- `risk_band` : `high` si refuge/divergence OU `human_dissent` OU `confidence < seuil_bas` ; `low` si `strict` sans dissent ; `medium` sinon.

## Secondaires (multi-label)
- Un secondaire **s'auto-valide** s'il est porté par ≥2 annotateurs (ou couple/cluster reconnu) ; sinon `validate_set` (manuel). Aligné sur `ClauseTheme.role` + `validate_clause_theme_set`.

## Niveaux d'auto-résolution (politique DÉCLARATIVE `auto-resolution.yaml`)
1. `absolute_all` (strict + secondaires identiques) → **`auto_1click`**.
2. `llm_unanime>=3 AND annotators_majority>=2/3 AND risk=low AND NOT human_dissent` → **`auto`**.
3. sinon → **`manual`**.

## Sortie
`{primary, secondaries[], agreement_class, confidence, risk_band, human_dissent, human_block, llm_block, auto_level, tally}`.

> Séparation **scoring** (calcul) / **politique** (YAML versionné) : on peut durcir/assouplir
> l'auto-résolution sans toucher au barème. Parité TS/PY verrouillée par un golden partagé.
