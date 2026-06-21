# Dossier — Intégration de Mistral (3ᵉ juge LLM) — Pactiva

> Dossier d'étude et d'exécution **niveau agence** (équipes senior backend /
> frontend / UI / UX / QA / ops). Objectif : intégrer **Mistral** comme **3ᵉ juge
> LLM** dans l'atelier d'annotation, à côté de **Claude** et **Codex**, en
> **généralisant** les surfaces aujourd'hui codées en dur (claude/codex) vers une
> **source unique de vérité** côté front et un import **idempotent** côté back.

## Périmètre

1. **Backend** — ajouter `Judge.MISTRAL`, importer les pré-annotations Mistral via
   la commande existante, **sans aucun changement de schéma au-delà de l'enum**.
2. **Frontend** — introduire `lib/llmJudges.ts` (liste ordonnée `{id,label,identityColor}`)
   comme **source unique**, puis rendre **data-driven** : le hook d'accord
   (`useLlmAgreement`), la **réglette** (3ᵉ piste), les **fantômes** (`ghostJudges[]`),
   les **options de pré-remplissage** et le **menu par phrase**.
3. **Tests** — pytest (enum, import idempotent, normalisation), vitest (config juges,
   ghosts, réglette 3 pistes), MSW (fixture + handler Mistral), Playwright (réglette
   montre 3 pistes, prefill Mistral).
4. **Livraison** — runbook : tests → build → `deploy-claire.sh` → `push-preannotations.sh`
   (mistral) → import prod → smoke prod.

> **Hors lot initial (suite documentée)** : le **mode COMPARE reste pairwise**
> (claude-vs-codex). La comparaison **N-way / matrice** est une feature séparée
> (`03-plan-developpement.md` §Suite). La **réglette** + le **menu par phrase**
> couvrent déjà le besoin « voir Mistral ».

## Décisions clés (résumé exécutif)

| # | Aspect | Décision retenue | Pourquoi (synthèse) |
|---|--------|------------------|---------------------|
| 1 | **Backend — enum** | `Judge.MISTRAL = "mistral", "Mistral"` (déjà présent, migration `0002`) | `judge` est déjà dans la clé d'unicité ; loaders/serializers/vues sont **agnostiques** au juge → zéro migration de données |
| 2 | **Backend — import** | Commande existante `import_preannotations --judges claude,codex,mistral` (défaut déjà à jour), layout `data/preannotations/mistral/<ext_id>_mistral.json` | Réutilise `normalize_v92` (segments `start_id`+`theme`) ; `ingest_preannotation` **idempotent** |
| 3 | **Frontend — SoT** | `lib/llmJudges.ts` = liste ordonnée `{id,label,initial,identityColor,testid}` + helpers (`JUDGES`, `judgeLabel`, `judgeColor`, type `JudgeId`) | Un seul endroit à éditer pour un futur juge ; supprime les littéraux `claude/codex` épars |
| 4 | **Frontend — accord** | `useLlmAgreement` expose `preByJudge: Record<id, PreAnnotation>` (+ garde `claudePre/codexPre/claudeByIndex/codexByIndex` pour compat) | Migration **sans casse** des consommateurs existants ; ajoute la lecture Mistral |
| 5 | **Frontend — réglette** | 3ᵉ piste Mistral, dérivée de la config ; `ModelBoundaryRail` est **déjà N-modèles** | Aucun refactor de la réglette ; on alimente `models[]` depuis `JUDGES` |
| 6 | **Frontend — fantômes** | `ghostJudges: string[]` (+ `toggleGhostJudge`) en remplacement de `showGhostClaude/Codex` | Générique N juges ; aligné sur `gutterModels: Record<string,boolean>` déjà data-driven |
| 7 | **Frontend — prefill** | `PREFILL_OPTIONS` et `LlmSourceSwitch` générés depuis `JUDGES` | Mistral apparaît automatiquement ; libellés/testids cohérents `…-mistral` |
| 8 | **Couverture** | Mistral = **sous-ensemble** du corpus (22/50 docs) | « **absence ≠ masquage** » : piste **grisée** si le doc n'a pas de Mistral (spéc Feature A §4) |
| 9 | **Compare** | **Reste pairwise** claude-vs-codex (hors lot) | La réglette + le menu couvrent « voir Mistral » ; le N-way est une feature à part entière |
| 10 | **Tests** | Pyramide pytest / vitest / MSW / Playwright, testids `…-${judge.id}` | Testids existants stables, ceux de Mistral arrivent « gratuitement » |

> Détail et justification de chaque décision dans les sous-documents (`02-architecture.md`,
> `03-plan-developpement.md`, `04-design-ux-ergonomie.md`).

## État de départ (constat factuel, vérifié dans le code)

Une partie du socle backend est **déjà posée** (commits du 21/06) ; ce dossier la
**vérifie, durcit et teste** plutôt que de la réinventer :

| Élément | Statut constaté | Référence |
|---------|-----------------|-----------|
| `Judge.MISTRAL` | ✅ présent | `backend/claire/imports/models.py:15` |
| Migration de l'enum | ✅ présente | `backend/claire/imports/migrations/0002_alter_preannotation_judge.py` |
| `--judges` défaut | ✅ `claude,codex,mistral` | `…/management/commands/import_preannotations.py:36` |
| Données Mistral copiées | ✅ 22 fichiers | `data/preannotations/mistral/*_mistral.json` (gitignoré) |
| Loaders v9.2 | ✅ agnostiques | `backend/claire/imports/loaders.py::normalize_v92` |
| `Judge` (type front) | ❌ `"claude"\|"codex"\|"other"` (manque `mistral`) | `frontend/src/types/contract.ts:25` |
| `lib/llmJudges.ts` | ❌ inexistant | à créer |
| Fantômes | ❌ `showGhostClaude/Codex` (binaire) | `frontend/src/store/workspace.ts:81-82` |
| `gutterAllModels` | ❌ 2 entrées en dur + hex inline | `frontend/src/components/workspace/DocumentPanel.tsx:194-200` |
| Fixture MSW Mistral | ❌ absente | `frontend/src/mocks/fixtures.ts` |

> Conséquence : le **lot L0** est surtout de la **vérification + tests + durcissement
> des seeders** (qui restent en dur claude/codex), pas une réécriture. Le gros de
> l'effort est **frontend** (L1→L3).

## Arborescence du dossier

```
dossier-mistral/
├── README.md                  ← ce fichier (index + résumé exécutif)
├── 00-audit.md                ← inventaire exhaustif des points LLM (front+back)
│   └── 00-inventaire-llm.csv  ← matrice : couche, fichier, symbole, hardcoded, action, risque
├── 01-conception.md           ← besoins, personas/JTBD, user stories
│   └── 01-user-stories.csv
├── 02-architecture.md         ← backend, frontend, contrat, diagrammes
│   ├── 02-api-contrat.yaml     ← endpoints (existant vs proposé)
│   ├── 02-sequence-mistral.puml← import → API → réglette/prefill
│   └── 02-composants.puml      ← carte des composants impactés
├── 03-plan-developpement.md   ← lots L0→L5 (objectif/fichiers/DoD/estimation)
├── 04-design-ux-ergonomie.md  ← identité couleurs, légende 3 pistes, a11y
├── 05-plan-tests.md           ← stratégie MSW/vitest/playwright/pytest
│   └── 05-cas-de-tests.csv     ← ≥ 20 cas
└── 06-runbook.md              ← exécution opérationnelle (commandes réelles)
```

## Conventions de format
- `.md` : spécifications, décisions, principes (lecture humaine).
- `.csv` : matrices, user stories, cas de test (tabulables, diff-ables).
- `.puml` : diagrammes PlantUML (séquence, composants).
- `.yaml` : contrats d'API (lisibles, diff-ables).

## Invariants à NE PAS violer (rappel)
- **INV-Schéma** : aucun changement de schéma au-delà de `Judge.MISTRAL` (déjà fait).
- **INV-Idempotence** : ré-exécuter l'import ne crée pas de doublon (clé `(project,
  document, judge, schema_version)`).
- **INV-Wire** : API en **camelCase** (djangorestframework-camel-case) ; `themeCode`
  **déjà normalisé en sortie** par `PreClauseSerializer`.
- **INV-Compat** : `useLlmAgreement` garde `claudePre/codexPre/claudeByIndex/codexByIndex`
  pendant la migration (ajout de `preByJudge`, pas de suppression brutale).
- **INV-Absence** : pas de Mistral pour un doc ⇒ piste **grisée**, jamais masquée.

## Statut
- 📋 **Conception + plan** (ce dossier). Le socle backend est partiellement posé
  (cf. tableau « État de départ ») ; **aucune** généralisation frontend n'est encore
  faite. L'exécution suit `03-plan-developpement.md` puis `06-runbook.md`.
