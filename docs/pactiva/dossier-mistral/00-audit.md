# 00 — Audit : où apparaissent les juges LLM (front + back)

> Inventaire **exhaustif** des points où un juge LLM (`claude`, `codex`, et demain
> `mistral`) apparaît dans le code. Pour chaque point : **fichier**, **rôle**, **ce
> qui est codé en dur**, **action** (généraliser / ajouter / aucune), **risque**.
> La matrice complète et triable est dans `00-inventaire-llm.csv`.
>
> Méthode : lecture du code (pas de supposition). Références = `chemin:ligne`.

## 0. Vue d'ensemble

```
                         ┌───────────────────────────────────────────────┐
  data/preannotations/   │  BACKEND (agnostique au juge, à 95 %)          │
   ├ claude/  (50)       │  Judge enum ─ PreAnnotation/PreClause ─ loaders│
   ├ codex/   (50)  ───► │  ─ serializers ─ views (?judge=) ─ commande    │
   └ mistral/ (22)  rsync│  import_preannotations (idempotent)            │
                         └───────────────────────┬───────────────────────┘
                                                 │  GET /api/v1/preannotations (camelCase)
                                                 ▼
                         ┌───────────────────────────────────────────────┐
                         │  FRONTEND (codé en dur claude/codex, à généraliser)
                         │  contract.Judge ─ useLlmAgreement (claudePre/  │
                         │  codexPre) ─ workspace store (ghosts binaires)  │
                         │  ─ DocumentPanel (gutterAllModels=[2]) ─ menus  │
                         │  ─ prefill/switch (options en dur)              │
                         │  ── ModelBoundaryRail = DÉJÀ N-modèles ✅       │
                         └───────────────────────────────────────────────┘
```

**Constat clé** : le **backend est presque entièrement agnostique** (le `judge` est
une simple valeur de champ, traversée verbatim) ; le **frontend** concentre le
codage en dur (`claude`/`codex`) dans 4 foyers — `hooks.ts`, `workspace.ts`,
`DocumentPanel.tsx`, et les littéraux d'options/libellés. La réglette
`ModelBoundaryRail.tsx` et le store `ui.ts` sont **déjà** data-driven.

---

## 1. Backend

### 1.1 Modèles & enum

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `backend/claire/imports/models.py:12-16` | `Judge(TextChoices)` | Énumération des juges | **Déjà à jour** : `CLAUDE/CODEX/MISTRAL/OTHER` | Aucune (vérifier) | Faible |
| `…/models.py:19-42` | `PreAnnotation` | 1 ligne / `(project,document,judge,schema_version)` | `judge` dans la clé d'unicité (lignes 32-38) | Aucune | Faible |
| `…/models.py:45-59` | `PreClause` | Clause pivot (`anchor_index`, `theme_code`, `evidence_span`, `rationale`) | Rien | Aucune | Faible |
| `…/migrations/0002_alter_preannotation_judge.py` | `AlterField` | Migration de l'enum (ajout `mistral`) | **Déjà présente** | Aucune (sera appliquée par `migrate`) | Faible |
| `…/migrations/0001_initial.py:21` | choices historiques | enum d'origine (sans mistral) | Historique | **Ne pas éditer** | Faible |

> `judge` étant dans la clé d'unicité, un même document porte simultanément
> claude + codex + mistral, chacun versionné — **aucune migration de données**.

### 1.2 Normalisation & pipeline (agnostiques)

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `backend/claire/imports/loaders.py:82-107` | `normalize_v92` | segments `start_id`+`theme` → pivot | **Aucun** (ne lit jamais `judge`) | Aucune | Faible |
| `…/loaders.py:55-79` | `normalize_v94` | `plan.clauses` (`anchor_id`) → pivot | Aucun | Aucune | Faible |
| `…/loaders.py:22-38` | `detect_schema_version` | v9.2 (`document_plan`) / v9.4 (`plan`) | Aucun | Aucune | Faible |
| `backend/claire/imports/theme_mapping.py:32-43` | `normalize_theme_code` | codes legacy → vocabulaire fermé | Aucun (alias de **thèmes**, pas de juges) | Aucune | Faible |
| `backend/claire/imports/services.py:26-71` | `ingest_preannotation` | upsert **idempotent** `(proj,doc,judge,ver)` | Aucun (`judge` = paramètre) | Aucune | Faible |

> Les JSON Mistral portent `judge:"mistral"` et `document_plan.segments[*]` =
> `{start_id, theme, rationale, evidence_span}` → **exactement** la forme attendue
> par `normalize_v92`. Vérifié sur `9gag_mistral.json` (38 segments).

### 1.3 Serializers & vues (agnostiques)

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `backend/claire/imports/serializers.py:14-26` | `PreClauseSerializer` | `themeCode` **normalisé en sortie** (`get_theme_code`) | Aucun | Aucune | Faible |
| `…/serializers.py:29-59` | `PreAnnotationSerializer` | expose `judge` verbatim, `clauses`, `rationaleGlobal`, `estimatedNBlocks` | Aucun | Aucune | Faible |
| `backend/claire/imports/views.py:10-41` | `PreAnnotationViewSet` (RO) | `GET /api/v1/preannotations` ; `?project=`,`?document=`,`?version=`,`?judge=` | Aucun (`filterset_fields=["judge"]`) | Aucune | Faible |
| `backend/config/api_urls.py:50` | route | `register("preannotations", …)` | Aucun | Aucune | Faible |
| `backend/claire/projects/views.py:290-311` | `import_preannotations` (action) | `POST …/projects/{slug}/preannotations/import` | Aucun (`item["judge"]`) | Aucune | Faible |
| `backend/claire/annotations/views.py:112-143` | `AnnotationViewSet.create` | seed `preannotation:<judge>` | Aucun (split `:`) | Aucune | Moyen |
| `backend/claire/corpora/views.py:58-79` | `annotation_versions` | `GET …/documents/{id}/annotation-versions` (groupe par juge) | Aucun | Aucune | Faible |

### 1.4 Commande d'import (cœur du lot L0)

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `…/management/commands/import_preannotations.py:36` | `--judges` | défaut `claude,codex,mistral` | **Déjà à jour** | Vérifier | Faible |
| `…/import_preannotations.py:46-50` | `--dir` | racine `…/data/preannotations` | chemin par défaut (pas `settings.PREANNOTATIONS_DIR`) | Aligner (cosmétique) | Faible |
| `…/import_preannotations.py:58-61` | boucle | layout `<root>/<judge>/<ext_id>_<judge>.json` | Aucun (générique) | Aucune | Faible |

### 1.5 Seeders & archive — **restent en dur claude/codex** (à décider)

> Ces points n'empêchent **pas** l'import Mistral (qui passe par la commande), mais
> si l'on veut Mistral dans les **données de démo / seed local**, il faut les éditer.

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `backend/claire/corpora/management/commands/feed_db.py:285-288` | `_load_preannotations` | seed prod/local | liste `[(CLAUDE,…),(CODEX,…)]` | **Ajouter** `(MISTRAL,"mistral","_mistral.json")` | Moyen |
| `…/feed_db.py:324-339` | `_seed_annotations` | seeds par annotateur | références `Judge.CLAUDE/CODEX` | Optionnel | Faible |
| `backend/claire/corpora/management/commands/seed_demo.py:226-229` | `_load_preannotations` | données démo | `sources=[(CLAUDE,…),(CODEX,…)]` | Optionnel (démo) | Faible |
| `backend/fixtures/preannotations_fallback.json` | fixture | repli démo | que claude/codex | Optionnel | Faible |
| `…/commands/import_annotations_archive.py:28,64-65` | `FOLDER_RE` + mapping | import archive multi-versions | regex `(claude|codex|gemini)`, `gemini`→`other` | **Ajouter** `mistral` (sinon collapsé `other`) | Moyen |

### 1.6 Réglages & déploiement

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `backend/config/settings/base.py:53-55` | `PREANNOTATIONS_DIR` | racine données | Aucun (juge) | Aucune | Faible |
| `.gitignore:51-52` | `/data/preannotations/` | données non versionnées | — | Aucune (rsync) | Faible |
| `deploy/push-preannotations.sh` | script | rsync `data/preannotations/` → VPS + import prod | défaut projet `campagne-pactiva` | Aucune (mistral suit) | Faible |
| `deploy/deploy-claire.sh:54-63` | script | pull + `migrate` + build + restart + health + rollback | — | Aucune (migrate applique 0002) | Faible |

### 1.7 Tests backend existants

| Fichier:ligne | Couvre | Impact Mistral |
|---|---|---|
| `backend/tests/test_loaders.py` | `normalize_v92/v94`, dispatch, theme alias, seed dedup | `judge="claude"` en dur, mais **aucune** assertion d'exclusivité → ne casse pas |
| `backend/tests/test_correctifs.py:12-47` | commande `import_preannotations` (+ idempotence) | sous-dir `claude/` uniquement → **ajouter** un cas `mistral/` |
| `backend/tests/test_import_api.py` | endpoint import + seed `preannotation:claude` | ne casse pas |
| `backend/tests/test_feed_db.py:69-72` | juges seedés (`{"claude","codex"} <= …`) | `<=` (sous-ensemble) → ne casse pas (mais n'affirme pas Mistral) |

---

## 2. Frontend

### 2.1 Contrat de types

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `frontend/src/types/contract.ts:25` | `Judge` | type wire du juge | `"claude"\|"codex"\|"other"` (**manque `mistral`**) | **Ajouter** `"mistral"` | Faible |
| `…/contract.ts:286-291` | `PreClause` | `anchorIndex/themeCode/evidenceSpan/rationale` | Aucun | Aucune | Faible |
| `…/contract.ts:293-306` | `PreAnnotation` | `judge: Judge`, `clauses`, … | Aucun (clé `judge`) | Aucune | Faible |

### 2.2 Source unique de vérité (à créer)

| Fichier | Symbole | Rôle | Action | Risque |
|---|---|---|---|---|
| `frontend/src/lib/llmJudges.ts` *(nouveau)* | `JUDGES`, `JudgeId`, `judgeLabel`, `judgeColor`, `judgeInitial` | **SoT** ordonnée `{id,label,initial,identityColor,testid}` | **Créer** | Faible (additif) |

### 2.3 Données & logique

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `frontend/src/lib/api/hooks.ts:268-299` | `useLlmAgreement` | dérive `claudePre/codexPre`, `claude/codexByIndex`, `agreementPct/kappa` | `results.find(p=>p.judge==='claude'\|'codex')` ; champs nommés | **Généraliser** : ajouter `preByJudge: Record<id,PreAnnotation>` (+ garder l'existant) | **Élevé** (consommé partout) |
| `frontend/src/lib/llmAgreement.ts:27-38,96-123` | `agreement`, `AgreementResult` | accord **pairwise** + κ Cohen | sortie `claudeByIndex/codexByIndex` | Garder pairwise ; ré-utiliser `themeByIndex`/`cohenKappa` (déjà génériques) | Moyen |
| `frontend/src/lib/divergence.ts:23-76` | `isDivergent`, `divergence*` | divergence **pairwise** | params `claude/codexByIndex` | Renommer en `a/b` (cosmétique) ; nav déjà générique | Faible |
| `frontend/src/lib/runs.ts:199-209` | `judgeThemeAt` | thème d'un juge à un index | `judge: string` | Aucune (déjà générique) | Faible |

### 2.4 Store

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `frontend/src/store/workspace.ts:16` | `LlmSource` | `"human"\|"claude"\|"codex"\|"compare"` | union binaire | **Élargir** : `"human"\|JudgeId\|"compare"` | Moyen |
| `…/workspace.ts:19` | `PrefillJudge` | `"claude"\|"codex"\|null` | union binaire | Élargir à `JudgeId\|null` | Faible |
| `…/workspace.ts:53` | `DraftClause.resolvedFrom` | provenance résolution | `"claude"\|"codex"\|null` | Élargir à `JudgeId\|null` | Faible |
| `…/workspace.ts:81-82,275-276` | `showGhostClaude/Codex` | état fantômes (binaire) | 2 booléens | **Remplacer** par `ghostJudges: string[]` | Moyen |
| `…/workspace.ts:177,667-672` | `toggleGhost` | bascule fantôme | branche claude/codex | **Réécrire** `toggleGhostJudge(id)` (push/pull) | Moyen |
| `…/workspace.ts:162` | `resolveDivergence` | `judge:"claude"\|"codex"` | union | Élargir à `JudgeId` | Faible |
| `frontend/src/store/ui.ts:20,29,50-51` | `gutterModels`, `toggleGutterModel` | visibilité réglette par id | **Aucun** (`Record<string,boolean>`) | Aucune (déjà data-driven) | Faible |

### 2.5 Composants atelier

| Fichier:ligne | Symbole | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|---|
| `frontend/src/components/workspace/DocumentPanel.tsx:194-200` | `gutterAllModels` | **construit `models[]`** pour la réglette | 2 entrées + **hex inline** `#94A3B8`/`#A78BFA` | **Généraliser** : `JUDGES.map(...)`, segments depuis `preByJudge` | **Élevé** |
| `…/DocumentPanel.tsx:102-103,164,171` | lecture ghosts | rendu fantômes | `showGhostClaude/Codex` | Lire `ghostJudges` | Moyen |
| `…/DocumentPanel.tsx:135-142,184-191` | `claude/codexDetailByAnchor`, `claude/codexRuns` | maps + runs par juge | nommés claude/codex | Dériver de `preByJudge` | Moyen |
| `…/DocumentPanel.tsx:221-229,438-453,766-815` | sélection source, projection phrase, `computeBadge` | rendu selon `llmSource` ; compare pairwise | ternaires claude/codex | Lookup générique ; **compare reste pairwise** (hors lot) | Moyen |
| `…/DocumentPanel.tsx:240-272,549` | `adoptAtFocus`, raccourcis, voyant résolu | adopter claude/codex | `judge:"claude"\|"codex"` | Élargir adopt à `JudgeId` ; voyant via `judgeLabel` | Moyen |
| `frontend/src/components/workspace/SentenceMenu.tsx:44-56,78-81,180-201,226-307` | `claude/codexDetail`, `JudgeBlock` | menu par phrase | 2 `<JudgeBlock>` + `judge==="claude"?"Claude":"Codex"` | **Généraliser** : `details: Record<id,JudgeDetail>` + `.map` | Moyen |
| `frontend/src/components/workspace/WorkspaceToolbar.tsx:147-151,280-285` | `PREFILL_OPTIONS`, dialogue | options de prefill | littéral `[null,claude,codex]` ; ternaire dialogue | **Générer** depuis `JUDGES` ; libellé via `judgeLabel` | Faible |
| `frontend/src/components/workspace/LlmSourceSwitch.tsx:19-24` | `OPTIONS` | switch source | littéral `[human,claude,codex,compare]` | **Générer** `[human, …JUDGES, compare]` | Faible |
| `frontend/src/components/workspace/ComparePanel.tsx:35-60,118-253` | `agreementSegments`, rails | **compare pairwise** | labels Claude/Codex, props claude/codex | **Hors lot** : reste pairwise ; data-driver les labels via SoT (option) | Faible |
| `frontend/src/components/workspace/ModelBoundaryRail.tsx:23-30,40-187` | `GutterModel`, strip, legend | **réglette N-modèles** | **Aucun** (`models: GutterModel[]`) | Aucune (✅ déjà N) | Faible |
| `frontend/src/components/workspace/BoundaryEvidence.tsx:20-160` | preuves frontières | aperçu claude/codex | props claude/codex detail | Généraliser via map (suit DocumentPanel) | Faible |
| `frontend/src/components/workspace/InspectorJudgeCompare.tsx:17-60` | comparateur inspecteur | claude vs codex | pairwise | **Hors lot** (suit Compare) | Faible |
| `frontend/src/components/workspace/TocPanel.tsx:20-22,93-105` | sommaire | « Fantôme LLM · claude/codex » | libellés + ids | Itérer `JUDGES` | Faible |
| `frontend/src/components/workspace/useDivergenceShortcuts.ts:7,26-69` | raccourcis | `onAdoptClaude/Codex` (touches 1/2) | callbacks binaires | Générique `onAdopt(judgeId)` ; touches 1..N | Moyen |

### 2.6 Pages & secondaire

| Fichier:ligne | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|
| `frontend/src/app/(app)/compare/page.tsx:24,43-55` | page comparaison | `find(judge==='claude')`, libellés | **Hors lot** (pairwise) | Faible |
| `frontend/src/app/(app)/admin/preannotations/page.tsx:18` | admin | `<Badge>{p.judge}</Badge>` | **Aucun** (rend tout juge) | Aucune | Faible |
| `frontend/src/lib/tour/workspaceTour.ts:66-170` | visite guidée | copy + `toggle-ghost-claude` | Mettre à jour si testid renommé | Faible |
| `frontend/src/app/page.tsx:147` | landing (marketing) | « Mistral, EuroLLM » | Aucune (texte) | Faible |

### 2.7 Mocks & tests frontend

| Fichier:ligne | Rôle | Codé en dur | Action | Risque |
|---|---|---|---|---|
| `frontend/src/mocks/fixtures.ts:272-322` | `FIXTURE_PREANNOTATIONS` | 2 entrées (claude/codex) | **Ajouter** `FIXTURE_PREANNOTATION_MISTRAL` (3ᵉ entrée) | Faible |
| `frontend/src/mocks/handlers.ts:438-461` | handlers `/preannotations`, import, versions | **Aucun** (itère la fixture) | Aucune (mistral coule tout seul) | Faible |
| `frontend/tests/modelBoundaryRail.test.tsx` | réglette N-modèles | claude+codex | **Ajouter** cas 3 pistes | Faible |
| `frontend/tests/workspaceStore.test.ts` | store (seed, resolvedFrom) | claude/codex | Ajouter cas `mistral` (ghosts/prefill) | Faible |
| `frontend/tests/divergence.test.ts` | divergence pairwise | arrays claude/codex | Aucune (logique pairwise conservée) | Faible |
| `frontend/tests/workspaceTour.test.ts:41` | sélecteurs visite | `toggle-ghost-claude` | Aligner si testid change | Faible |
| `frontend/e2e/prefill.spec.ts` | prefill + ghost | `prefill-claude`, `toggle-ghost-claude` | **Ajouter** spec `prefill-mistral` | Faible |
| `frontend/e2e/llm-compare.spec.ts` | divergence/compare/boundary | testids claude/codex | Conserver (pairwise) ; vérifier non-régression | Moyen |

---

## 3. Foyers de risque (synthèse priorisée)

1. **`useLlmAgreement` (hooks.ts)** — consommé par DocumentPanel, InspectorJudgeCompare,
   page compare. Migration **additive** (garder l'existant) obligatoire pour éviter une
   cascade de casses. → **Élevé**.
2. **`gutterAllModels` (DocumentPanel.tsx)** — point unique où la liste des modèles de
   la réglette est figée à 2 + hex inline. → **Élevé** mais **localisé**.
3. **Ghosts binaires (workspace.ts)** — bascule de 2 booléens vers `string[]` ; toucher
   le store impacte autosave/undo indirectement → tester. → **Moyen**.
4. **Testids** — beaucoup de tests E2E pointent `…-claude`/`…-codex`. Générer les testids
   en `…-${judge.id}` garde l'existant **stable** et fait apparaître Mistral « gratis ».
   → **Moyen** (procédural).
5. **Compare pairwise** — laissé **hors lot** ; ne pas le « casser » en généralisant à la
   va-vite. → **Moyen** (discipline de périmètre).

## 4. Conclusion

Le **backend est prêt** au sens « agnostique au juge » : l'enum, la migration, la
commande et les données Mistral sont déjà en place ; le lot L0 se réduit à **vérifier,
tester et (optionnellement) étendre les seeders**. L'effort réel est **frontend** :
introduire `lib/llmJudges.ts` puis rendre **data-driven** les 4 foyers (hook, store
ghosts, `gutterAllModels`, options/libellés), la réglette `ModelBoundaryRail` n'ayant
**aucun** changement structurel à subir. La feature **compare N-way** est explicitement
**reportée**. Détail des actions et estimations : `03-plan-developpement.md`.
