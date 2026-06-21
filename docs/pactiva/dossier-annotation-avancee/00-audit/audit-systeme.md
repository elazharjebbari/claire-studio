# Audit système — Annotation (état des lieux)

## 1. Modèle d'annotation actuel
- **Unité** : `Clause` ancrée sur une phrase (`anchor_sentence`), `theme` (vocab fermé
  du schéma), `legal_nature`, `evidence_span`, `rationale`, `certainty`. INV-4 :
  une annotation unique par (projet, document, annotateur).
- **Rendu (frontend)** : `lib/runs.ts::computeRuns`. Depuis le correctif **C4**, les
  runs **humains** sont calculés en mode `perSentence` (une clause = sa phrase, pas
  de débordement) ; les **segments LLM** gardent le forward-fill (spans), car la
  donnée LLM est par segments (`start_id` + thème).
- **IAA (backend)** : `projects/iaa.py::_theme_vector` en **par phrase** depuis C4
  (phrase non étiquetée = `None`). κ de Cohen pairwise + détail par thème/frontières.

## 2. Sources de découpage (humain vs LLM)
- **Humain** : clauses par phrase (store `workspace.ts`, autosave incrémental
  `useAutosave`).
- **LLM** : `PreAnnotation`/`PreClause` (`imports/`), **span-based** (`segments`).
  Claude + Codex importés en prod (100 pré-annotations, cf. C2). Mistral = futur juge
  (extensible : `Judge` est une `TextChoices`).
- **Comparaison** : `DocumentPanel` calcule `claudeRuns`/`codexRuns` (forward-fill),
  `lib/runs.ts::judgeThemeAt`, et l'accord par phrase (`lib/llmAgreement`).

## 3. Constats ergonomiques (motivant A & B)
- **A** : pour comparer où chaque modèle place ses frontières, il faut basculer la
  *source* du document (human/claude/codex) une à une → pas de **vue simultanée**
  des frontières de tous les modèles. Manque une **réglette de frontières** lisible
  d'un coup d'œil, togglable, non intrusive, avec catégorie optionnelle.
- **B** : l'annotation est désormais par phrase (C4) — précis mais **fastidieux**
  pour étiqueter une longue suite de phrases identiques. Il manque une gestion
  **bloc/phrase** ergonomique : appliquer un thème à une plage, puis **surcharger**
  une phrase isolée sans tout refaire, et inversement.

## 4. Composants impactés (inventaire)
Voir `etat-des-lieux.csv`. Cœur : `DocumentPanel.tsx`, `lib/runs.ts`,
`store/workspace.ts`, `SentenceMenu.tsx`, `SelectionToolbar.tsx`, `InspectorPanel.tsx`
(frontend) ; `annotations/`, `imports/`, `projects/iaa.py` (backend).

## 5. Dette / risques identifiés
- Autosave : **réessaie en boucle** sur erreurs terminales (401/403) → tempête réseau
  (observée lors du bug 403). À durcir (cf. `06-plan-tests` & `07-runbook`).
- Couverture de tests : aucun test ne couvrait **PATCH/DELETE clause par le
  propriétaire** (d'où la régression non détectée). À combler (fait pour le bug ;
  à généraliser).
- `isMine` était permissif par défaut (édition sous identité incertaine) → durci
  (sûr par défaut) dans le hotfix.

## 6. Conclusion
Le socle (par phrase + LLM spans) est sain et suffit pour A & B **sans migration de
schéma**. A = couche de **visualisation** ; B = couche d'**interaction/regroupement**
au-dessus des clauses par phrase. Détails : sous-dossiers 02 et 03.
