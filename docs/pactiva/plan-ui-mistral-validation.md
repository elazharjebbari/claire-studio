# Plan — Correctifs UI Mistral + workflow de validation (a → f)

Audit, plan d'action et d'exécution pour 6 points. Découpage en **2 vagues** :
Vague 1 = complétion UI Mistral + ergonomie (a, b, c, f) ; Vague 2 = workflow de
validation (d) + comparaison N-way (e). Chaque vague : tests + déploiement + smoke prod.

## Audit (état constaté)
- **(a)** `SentenceMenu` n'affiche que Claude/Codex (`claudeDetail`/`codexDetail` + 2
  `JudgeBlock`) → impossible de voir/adopter la proposition **Mistral**.
- **(b)** `LlmSourceSwitch` OPTIONS = {human, claude, codex, compare} en dur ; le rendu
  source `DocumentPanel` (ligne `runs = llmSource==="claude"?…:"codex"?…:humanRuns`) ignore
  Mistral.
- **(c)** Badge de provenance `resolved-{i}` codé `claude`/`codex` (`✓ Claude/Codex`) →
  pas de Mistral, et pas de badge pour l'**humain** (auteur) ; il doit apparaître **sur
  chaque phrase**.
- **(d)** Aucun état de **validation** par phrase : on ne distingue pas ce que l'humain a
  explicitement validé ; rien ne **bloque la soumission** tant que tout n'est pas validé.
  Les pré-annotations ne doivent JAMAIS faire référence — seule la validation humaine compte.
- **(e)** `ComparePanel` est **pairwise** (Claude vs Codex) en dur ; pas de Mistral, pas de
  choix des modèles (2 ou 3 parmi 3), conflits limités à la paire.
- **(f)** L'`aside` Inspecteur (droite) n'est pas repliable (le panneau Comparer l'est déjà
  via `showComparePanel`). Besoin de gagner de l'espace.

## Vague 1 — a, b, c, f (livrée + déployée)
- **(a)** `SentenceMenu` : liste de juges générée depuis `LLM_JUDGES` ; un `JudgeBlock` par
  juge présent (Claude/Codex/Mistral), avec adoption (`resolveDivergence`). Détails par juge
  construits génériquement (`detailByJudge`).
- **(b)** `LlmSourceSwitch` : options = `human` + `LLM_JUDGES` + `compare` ; `LlmSource`
  élargi (id de juge) ; `DocumentPanel` calcule `runsByJudge` et sélectionne la source.
- **(c)** Badge provenance par phrase : `✓ {label juge}` pour tout `resolvedFrom`
  (Mistral inclus, via `llmJudgeLabel`), et `✎ moi` pour une clause **humaine** (ni seedée
  ni adoptée). Toujours visible (pas derrière un toggle).
- **(f)** Inspecteur repliable : toggle store `inspectorOpen` + poignée d'ouverture/fermeture
  sur le bord droit (gain d'espace), persisté (store UI).

## Vague 2 — d, e (lots suivants)
- **(d) Workflow de validation** : champ `Clause.validated` (backend + migration +
  serializer + autosave) ; piste « validation » dans le rail gauche (validé / annoté-non-
  validé / non couvert) ; action « Valider » (phrase/bloc) ; **soumission bloquée** tant que
  toutes les phrases ne portent pas une clause **validée** (les pré-annotations ne comptent
  pas). Tests pytest (gate) + vitest.
- **(e) Comparaison N-way** : `ComparePanel` paramétré par une **sélection de modèles**
  (2–3 parmi Claude/Codex/Mistral) ; N colonnes + bande d'accord/zones de conflit N-way
  (réutilise `conflictZones(models,n)`), navigation des désaccords. Sélecteur dans la barre.

## Exécution
1. Vague 1 → tsc/vitest/MSW, build, deploy, smoke (Mistral menu+source+badge, inspecteur repliable).
2. Vague 2 → migration + tests pytest, vitest/playwright, deploy, smoke (gate de soumission, compare 3 modèles).

**Rollback** : correctifs indépendants ; (d) seul ajoute une migration (réversible).
