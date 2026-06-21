# 03 — Plan de développement (lots, DoD, estimations)

> Découpage en lots **livrables et testables indépendamment**, du backend/données
> jusqu'au déploiement. Chaque lot : **objectif**, **fichiers**, **DoD** (Definition
> of Done), **estimation**. Ordre = ordre d'exécution recommandé.
>
> Convention estimation : j = jour-homme senior. Total indicatif **≈ 7,5 j** (hors
> aléas). Les lots front L1→L3 sont séquentiels (dépendance forte à la SoT) ; L0 peut
> se faire en parallèle.

## Vue d'ensemble

| Lot | Titre | Dépend de | Estimation | Risque |
|-----|-------|-----------|------------|--------|
| **L0** | Backend + données (vérifier/durcir/tester) | — | 1,0 j | Faible |
| **L1** | SoT `llmJudges.ts` + types + hook `preByJudge` | L0 (données) | 1,5 j | **Élevé** |
| **L2** | Réglette 3 pistes (data-driven) | L1 | 1,0 j | Moyen |
| **L3** | Prefill + fantômes + menu + switch | L1 | 1,5 j | Moyen |
| **L4** | Tests (pytest/vitest/MSW/Playwright) | L0–L3 | 1,5 j | Moyen |
| **L5** | Deploy + prod (rsync, import, smoke) | L4 | 1,0 j | Moyen |

> **Gel de périmètre** : le mode **compare** reste pairwise (non touché). La
> comparaison N-way est dans « Suite » (fin de document), **hors** de ces lots.

---

## L0 — Backend + données

**Objectif.** Garantir (et tester) que l'import Mistral fonctionne de bout en bout,
sans changement de schéma. Le socle existe déjà ; ce lot **vérifie**, **durcit** les
seeders (optionnel) et **ajoute la couverture de tests**.

**Fichiers.**
- (Vérifier) `backend/claire/imports/models.py:12-16` — `Judge.MISTRAL` présent.
- (Vérifier) `backend/claire/imports/migrations/0002_alter_preannotation_judge.py`.
- (Vérifier) `…/management/commands/import_preannotations.py:36` — `--judges` défaut.
- (Vérifier) `data/preannotations/mistral/*_mistral.json` — 22 fichiers présents.
- (Optionnel) `backend/claire/corpora/management/commands/feed_db.py:285-288` — ajouter
  `(Judge.MISTRAL, "mistral", "_mistral.json")`.
- (Optionnel, Could) `…/import_annotations_archive.py:28,64-65` — ajouter `mistral`.
- (Tests) `backend/tests/test_correctifs.py` — nouveau cas import `mistral/` idempotent ;
  `backend/tests/test_loaders.py` — cas `normalize_v92` sur un payload Mistral réel.

**DoD.**
- `python manage.py makemigrations --check` → **aucune** migration manquante.
- `import_preannotations --project <slug> --judges mistral --dir <tmp>` crée N
  `PreAnnotation(judge="mistral")` ; **re-run = 0 doublon** (assertion pytest).
- `normalize_v92` mappe correctement `start_id→anchor_index`, `theme`, `evidence_span`,
  `rationale` sur un échantillon Mistral.
- `GET /preannotations?judge=mistral` (test API) renvoie le juge avec `themeCode`
  **normalisé** (camelCase).
- `pytest -q` vert (aucune régression).

**Estimation.** 1,0 j (dont 0,6 j de tests).

---

## L1 — Source unique de vérité + types + hook

**Objectif.** Poser `lib/llmJudges.ts` (liste ordonnée + helpers), élargir le type
`Judge`, et **généraliser** `useLlmAgreement` en mode **additif** (`preByJudge`,
`byIndexByJudge`) sans casser les consommateurs claude/codex.

**Fichiers.**
- **Nouveau** `frontend/src/lib/llmJudges.ts` — `JUDGES[]`, `JudgeId`, `judgeLabel/
  judgeColor/judgeInitial`, `JUDGE_IDS` (cf. `02-architecture.md` §2.1).
- `frontend/src/types/contract.ts:25` — `Judge += "mistral"`.
- `frontend/src/lib/api/hooks.ts:268-299` — ajouter `preByJudge` + `byIndexByJudge`
  (itération `JUDGE_IDS`) ; **garder** `claudePre/codexPre/claudeByIndex/codexByIndex`.
- `frontend/src/lib/llmAgreement.ts` — **aucune** modif structurelle (réutiliser
  `themeByIndex`/`cohenKappa`, garder `agreement` pairwise).

**DoD.**
- `lib/llmJudges.ts` est l'**unique** endroit définissant la liste/labels/couleurs des
  juges ; les hex `#94A3B8/#A78BFA/#5EEAD4` n'apparaissent plus ailleurs.
- `useLlmAgreement(...).preByJudge.mistral` est défini quand la fixture/API le fournit.
- `tsc --noEmit` vert ; les consommateurs existants (DocumentPanel, InspectorJudgeCompare)
  compilent **sans modification** grâce à la compat.
- Test unitaire `llmJudges` (ordre, helpers) vert.

**Estimation.** 1,5 j. **Risque élevé** (hook transverse) → migration additive + revue.

---

## L2 — Réglette 3 pistes (data-driven)

**Objectif.** Faire afficher la 3ᵉ piste Mistral dans la réglette, en alimentant
`gutterAllModels` depuis la SoT — **sans toucher** `ModelBoundaryRail.tsx` (déjà N).

**Fichiers.**
- `frontend/src/components/workspace/DocumentPanel.tsx:184-204` — remplacer
  `claudeRuns/codexRuns` + `gutterAllModels` (2 entrées + hex) par `runsByJudge`
  (mémo) + `gutterAllModels = JUDGES.map(...)` (cf. `02-architecture.md` §2.3).
- (Inchangé) `frontend/src/components/workspace/ModelBoundaryRail.tsx`.
- (Inchangé) `frontend/src/store/ui.ts` (`gutterModels: Record<string,boolean>`).

**DoD.**
- Réglette affiche **3 pistes** (C / Cx / M) alignées aux phrases.
- Doc **sans** Mistral → piste M **grisée** + en-tête barré (case `aria-disabled`),
  **pas** retirée (absence ≠ masquage).
- Tooltip M : « Mistral | `<thème> (<abbr>)` | phrases a–b ».
- `toggleGutterModel("mistral")` masque/affiche la piste ; persistance localStorage.
- Aucun recalcul superflu (mémos conservés) ; pas de hex inline restant.
- vitest `modelBoundaryRail` étendu (3 pistes + piste vide grisée) vert.

**Estimation.** 1,0 j.

---

## L3 — Prefill + fantômes + menu + switch

**Objectif.** Rendre Mistral utilisable : pré-remplissage, fantôme, menu par phrase,
sélection de source — tout généré depuis la SoT.

**Fichiers.**
- `frontend/src/store/workspace.ts` — `showGhostClaude/Codex → ghostJudges: string[]`
  + `toggleGhost → toggleGhostJudge(id)` ; élargir `LlmSource/PrefillJudge/resolvedFrom`
  à `JudgeId`.
- `frontend/src/components/workspace/DocumentPanel.tsx` — lire `ghostJudges.includes(...)` ;
  généraliser `adoptAtFocus(judgeId)` + voyant résolu via `judgeLabel`.
- `frontend/src/components/workspace/WorkspaceToolbar.tsx:147-151,280-285` —
  `PREFILL_OPTIONS` depuis `JUDGES` ; dialogue via `judgeLabel`.
- `frontend/src/components/workspace/SentenceMenu.tsx:180-307` — `JUDGES.map` sur
  `details: Record<JudgeId, JudgeDetail|null>` ; `JudgeBlock.name = judgeLabel(judge)`.
- `frontend/src/components/workspace/LlmSourceSwitch.tsx:19-24` — `OPTIONS` depuis
  `[human, …JUDGES, compare]`.
- `frontend/src/components/workspace/TocPanel.tsx` + `useDivergenceShortcuts.ts` —
  itérer `JUDGES` (libellés, ids) ; raccourcis adopt 1..N.
- (Aligner) `frontend/src/lib/tour/workspaceTour.ts` — si testids ghost renommés.

**DoD.**
- Prefill propose **Mistral** ; sélectionner Mistral seede le brouillon avec
  provenance `preannotation:mistral`.
- Fantôme Mistral : `ghostJudges` contient `"mistral"` ; cellules fantômes rendues ;
  toggle réversible.
- Menu par phrase : bloc Mistral (puce/rationale/evidence) + **adopter** ;
  `resolveDivergence(anchor, "mistral", theme)` → voyant « résolu Mistral ».
- Switch source : « Mistral » sélectionnable ; vue document = `mistralRuns`.
- Testids générés en `prefill-mistral`, `llm-mistral`, `menu-llm-mistral`,
  `toggle-ghost-mistral` ; **testids claude/codex inchangés**.
- vitest store (ghosts/prefill mistral) vert ; `tsc --noEmit` vert.

**Estimation.** 1,5 j.

---

## L4 — Tests (pyramide complète)

**Objectif.** Verrouiller le comportement Mistral et **prouver la non-régression**
claude/codex (dont compare pairwise).

**Fichiers.**
- **pytest** : `backend/tests/test_correctifs.py` (import `mistral/` idempotent),
  `test_loaders.py` (normalize v9.2 Mistral), `test_import_api.py` (GET `?judge=mistral`).
- **vitest** : `frontend/tests/llmJudges.test.ts` (config + helpers),
  `frontend/tests/modelBoundaryRail.test.tsx` (3 pistes, piste vide grisée),
  `frontend/tests/workspaceStore.test.ts` (ghostJudges toggle, prefill mistral,
  resolvedFrom mistral).
- **MSW** : `frontend/src/mocks/fixtures.ts` (`FIXTURE_PREANNOTATION_MISTRAL`),
  handler inchangé (vérifier que `?judge=mistral` renvoie la fixture).
- **Playwright** : `frontend/e2e/prefill.spec.ts` (ajout `prefill-mistral` +
  `ghost-mistral-0`), nouveau/étendu spec « réglette montre 3 pistes » ;
  `frontend/e2e/llm-compare.spec.ts` rejoué tel quel (garde-fou pairwise).

**DoD.**
- ≥ 20 cas couverts (cf. `05-cas-de-tests.csv`).
- `pytest -q`, `vitest run`, `playwright test` **verts**.
- Couverture explicite : import idempotent, réglette 3 pistes, piste vide grisée,
  ghostJudges, prefill Mistral, **non-régression** claude/codex + compare.

**Estimation.** 1,5 j.

---

## L5 — Deploy + prod

**Objectif.** Livrer en production : code + données Mistral + import + smoke, avec
rollback automatique.

**Fichiers / outils.**
- `deploy/deploy-claire.sh` (gate tests → push → pull/migrate/build/restart → health →
  rollback auto).
- `deploy/push-preannotations.sh` (rsync `data/preannotations/` → VPS + import prod).
- Aucune édition de script attendue (Mistral suit le flux existant).

**DoD.**
- `deploy-claire.sh` : gate vert, `migrate` applique `0002`, health **200**, services
  actifs ; rollback **prouvé** déclenchable (health ≠ 200 → `reset --hard PREV_SHA`).
- `push-preannotations.sh campagne-pactiva` : rsync OK, import prod
  `imported=22/missing=28/errors=0`.
- Smoke prod : réglette **3 pistes**, prefill **Mistral** OK, **aucun 400**, autosave
  sans boucle (pas de tempête réseau).

**Estimation.** 1,0 j (dont fenêtre de surveillance post-deploy).

---

## Séquencement & parallélisation

```
L0 (back+data) ───────────────┐
                              ├─► L4 (tests) ─► L5 (deploy)
L1 (SoT+hook) ─► L2 (réglette)┤
              └─► L3 (prefill/ghost/menu/switch)┘
```
- L0 en parallèle de L1.
- L2 et L3 dépendent de L1 ; peuvent se chevaucher (fichiers majoritairement distincts,
  attention au point commun `DocumentPanel.tsx`).
- L4 consolide ; L5 clôt.

## Risques de lot & parades

| Lot | Risque | Parade |
|-----|--------|--------|
| L1 | Casse des consommateurs du hook | Migration **additive** (garder claude/codex) + revue + `tsc` |
| L2/L3 | Conflits sur `DocumentPanel.tsx` | Séquencer L2 puis L3, ou découper par zones (réglette vs ghosts) |
| L3 | Régression testids E2E | Générer testids `…-${judge.id}` (claude/codex stables) |
| L4 | Faux positifs E2E (timing) | Réutiliser les patterns existants de `llm-compare.spec.ts` |
| L5 | Données absentes en prod | `push-preannotations.sh` **avant** smoke ; vérifier compteurs import |

---

## Suite (hors lot initial) — feuille de route N-way

> Documentée ici pour cadrage ; **non incluse** dans L0–L5.

1. **S1 — Compare N-way / matrice** : remplacer le pairwise par une matrice d'accord
   (κ par paire) + sélecteur « quels juges comparer ». Touche `ComparePanel.tsx`,
   `InspectorJudgeCompare.tsx`, `compare/page.tsx`, `lib/llmAgreement.ts`
   (`agreementMatrix`), `lib/divergence.ts` (variante N).
2. **S2 — IAA backend à N raters** : étendre `projects/iaa.py` pour inclure Mistral
   comme 3ᵉ rater (Fleiss/krippendorff ou paires).
3. **S3 — Retrait de la compat** : supprimer `claudePre/codexPre/byIndex` une fois tous
   les consommateurs migrés vers `preByJudge`.
