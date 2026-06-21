# 02 — Architecture : backend, frontend, contrat

> Décrit **comment** Mistral s'intègre, en respectant les décisions du brief (à ne
> pas remettre en cause). Contrat d'API : `02-api-contrat.yaml`. Diagrammes :
> `02-sequence-mistral.puml` (import → API → réglette/prefill), `02-composants.puml`.

## 0. Principes directeurs

1. **Le backend ne change pas de schéma** (au-delà de `Judge.MISTRAL`, déjà migré).
   Le `judge` est une valeur de champ, traversée verbatim du loader à l'API.
2. **Le frontend gagne une source unique** (`lib/llmJudges.ts`) ; les surfaces
   deviennent **data-driven** par itération sur cette liste.
3. **Migration additive** : on **ajoute** `preByJudge` / `ghostJudges`, on **garde**
   `claudePre/codexPre`, `claudeByIndex/codexByIndex` le temps de migrer les
   consommateurs (puis on pourra les retirer, hors lot).
4. **Compare gelé** : pairwise claude-vs-codex (non-objectif N1).

---

## 1. Backend

### 1.1 Enum `Judge`

État (déjà en place — `backend/claire/imports/models.py:12-16`) :

```python
class Judge(models.TextChoices):
    CLAUDE = "claude", "Claude"
    CODEX = "codex", "Codex"
    MISTRAL = "mistral", "Mistral"   # ← présent
    OTHER = "other", "Other"
```

Migration `0002_alter_preannotation_judge.py` : `AlterField` cosmétique (les `choices`
sont une contrainte applicative, pas une contrainte SQL pour SQLite/Postgres) — mais
garde `makemigrations` propre et sera **appliquée automatiquement** par `migrate` au
deploy. **Aucune** autre migration.

### 1.2 Flux de données (data flow)

```
data/preannotations/mistral/<ext_id>_mistral.json   (v9.2, judge:"mistral")
        │
        │  manage.py import_preannotations --project <slug> --judges claude,codex,mistral
        ▼
  Command.handle  (import_preannotations.py)
        │  pour chaque doc du corpus : <root>/mistral/<ext_id>_mistral.json
        ▼
  ingest_preannotation(project, document, "mistral", raw)   [services.py, @atomic]
        │  detect_schema_version(raw) → "v9.2"
        │  normalize_v92(raw) → [{anchor_index, theme, evidence_span, rationale, order}]
        │  get_or_create PreAnnotation(proj,doc,judge="mistral",schema_version="v9.2")
        │  delete+recreate PreClause (idempotent)
        ▼
  Base : PreAnnotation(judge="mistral") + PreClause[*]
        │
        │  GET /api/v1/preannotations?project=&document=
        ▼
  PreAnnotationSerializer → JSON camelCase
        {judge:"mistral", schemaVersion:"v9.2",
         clauses:[{anchorIndex, themeCode (NORMALISÉ), evidenceSpan, rationale}]}
```

**Points clés vérifiés** :
- Les JSON Mistral ont `document_plan.segments[*] = {start_id, theme, rationale,
  evidence_span}` → exactement ce que lit `normalize_v92` (loaders.py:82-107).
  `start_id` → `anchor_index` ; `theme` (brut) → `theme_code` (DB) → **normalisé** en
  sortie par `PreClauseSerializer.get_theme_code` (serializers.py:25-26).
- **Idempotence** : clé d'unicité `(project, document, judge, schema_version)` +
  delete/recreate des `PreClause` (services.py:47-66). Re-run = 0 doublon.
- **Aucun endpoint nouveau** : `PreAnnotationViewSet` filtre déjà par `?judge=`,
  `?project=`, `?document=`, `?version=` (views.py:21-37).

### 1.3 Couverture documentaire (22/50)

Le corpus de la campagne = **50 documents** ; Mistral = **22 fichiers**. La commande
itère `project.corpus.documents.all()` et **saute** les docs sans fichier
(compteur `missing`). Conséquence côté API : pour 28 docs, `?judge=mistral` ne renvoie
**rien** → le front rend la piste **grisée** (cf. §2.5). C'est un état **attendu**,
pas une erreur.

### 1.4 Seeders (optionnel, L0) — points en dur à étendre

Pour disposer de Mistral en **seed local** (pas nécessaire pour l'import prod) :
- `feed_db.py:285-288` : ajouter `(Judge.MISTRAL, "mistral", "_mistral.json")` à la liste.
- `import_annotations_archive.py:28,64-65` (Could) : ajouter `mistral` à la regex et au
  mapping (sinon un dossier `…_mistral` serait collapsé en `other`).

---

## 2. Frontend

### 2.1 Source unique de vérité — `lib/llmJudges.ts` (à créer)

Liste **ordonnée**, typée, + helpers. Forme cible (spécification, pas du code livré) :

```ts
// frontend/src/lib/llmJudges.ts
import type { Judge } from "@/types/contract";

export type JudgeId = Exclude<Judge, "other">;   // "claude" | "codex" | "mistral"

export interface JudgeConfig {
  id: JudgeId;            // = valeur wire (PreAnnotation.judge)
  label: string;         // "Claude" | "Codex" | "Mistral"
  initial: string;       // en-tête réglette : "C" | "Cx" | "M"
  identityColor: string; // teinte d'IDENTITÉ (≠ thème), daltonisme-safe
  testid: string;        // base testids : "claude" | "codex" | "mistral"
}

export const JUDGES: readonly JudgeConfig[] = [
  { id: "claude",  label: "Claude",  initial: "C",  identityColor: "#94A3B8", testid: "claude" },
  { id: "codex",   label: "Codex",   initial: "Cx", identityColor: "#A78BFA", testid: "codex" },
  { id: "mistral", label: "Mistral", initial: "M",  identityColor: "#5EEAD4", testid: "mistral" },
] as const;

export const JUDGE_IDS = JUDGES.map((j) => j.id);
export const judgeById   = (id: string) => JUDGES.find((j) => j.id === id);
export const judgeLabel  = (id: string) => judgeById(id)?.label ?? id;
export const judgeColor  = (id: string) => judgeById(id)?.identityColor;
export const judgeInitial= (id: string) => judgeById(id)?.initial ?? id.slice(0, 2);
```

> Cette liste **absorbe** les hex aujourd'hui inline dans `DocumentPanel.tsx:196-197`.
> Couleurs : voir `04-design-ux-ergonomie.md` (choix daltonisme).

### 2.2 Hook d'accord — `useLlmAgreement` (généralisé, **compat préservée**)

Aujourd'hui (`lib/api/hooks.ts:277-297`) :
```ts
const claudePre = results.find((p) => p.judge === "claude");
const codexPre  = results.find((p) => p.judge === "codex");
const res = agreement(toJudge(claudePre), toJudge(codexPre), n);
return { claudePre, codexPre, claudeByIndex: res.claudeByIndex, codexByIndex: res.codexByIndex,
         agreementPct, kappa, support, nSentences, isLoading };
```

Cible (additif) :
```ts
// projection par juge, dérivée de la SoT
const preByJudge: Record<string, PreAnnotation | undefined> =
  Object.fromEntries(JUDGE_IDS.map((id) => [id, results.find((p) => p.judge === id)]));
const byIndexByJudge: Record<string, (string | null)[]> =
  Object.fromEntries(JUDGE_IDS.map((id) => [id, themeByIndex(toJudge(preByJudge[id]), n)]));

// COMPAT (inchangé) — claude/codex restent dérivés du même calcul pairwise :
const res = agreement(toJudge(preByJudge.claude), toJudge(preByJudge.codex), n);

return {
  preByJudge,                 // ← NOUVEAU (Record keyé par JudgeId)
  byIndexByJudge,             // ← NOUVEAU (projection thème/phrase par juge)
  claudePre: preByJudge.claude, codexPre: preByJudge.codex,        // compat
  claudeByIndex: res.claudeByIndex, codexByIndex: res.codexByIndex, // compat (pairwise)
  agreementPct: res.agreementPct, kappa: res.kappa, support: res.support,
  nSentences: n, isLoading,
};
```

- `themeByIndex` et `cohenKappa` (`lib/llmAgreement.ts:48-90`) sont **déjà génériques**
  et réutilisés tels quels.
- `agreement(claude, codex, n)` **reste pairwise** (alimente le mode compare gelé).
- Mistral entre par `preByJudge.mistral` / `byIndexByJudge.mistral`.

### 2.3 Réglette — alimentée depuis la SoT (composant inchangé)

`ModelBoundaryRail.tsx` est **déjà N-modèles** (`GutterModel[]`, `models.map`). Le seul
point figé est `gutterAllModels` dans `DocumentPanel.tsx:194-200`. Cible :

```ts
const runsByJudge = useMemo(
  () => Object.fromEntries(JUDGE_IDS.map((id) =>
    [id, computeRuns(judgeAnchors(llm.preByJudge[id]?.clauses), n)])),
  [llm.preByJudge, n],
);
const gutterAllModels = useMemo<GutterModel[]>(
  () => JUDGES.map((j) => ({
    id: j.id, label: j.label, initial: j.initial,
    segments: segmentsFromRuns(runsByJudge[j.id]),
    hasData: !!llm.preByJudge[j.id]?.clauses?.length,
    identityColor: j.identityColor,        // ← plus d'hex inline
  })),
  [runsByJudge, llm.preByJudge],
);
```

`gutterVisibleModels` (filtrage par `ui.gutterModels`) et le rendu sont **inchangés**.
`store/ui.ts::gutterModels` est `Record<string, boolean>` → accepte `"mistral"` sans
modification.

### 2.4 Fantômes — `ghostJudges: string[]` (remplace les booléens)

Avant (`store/workspace.ts:81-82,667-672`) :
```ts
showGhostClaude: boolean; showGhostCodex: boolean;
toggleGhost: (judge: "claude"|"codex") => void;  // branche claude/codex
```
Après :
```ts
ghostJudges: string[];                              // ex. ["claude","mistral"]
toggleGhostJudge: (id: string) =>
  set((s) => ({ ghostJudges: s.ghostJudges.includes(id)
    ? s.ghostJudges.filter((x) => x !== id)
    : [...s.ghostJudges, id] }));
```
`DocumentPanel.tsx` lit `ghostJudges.includes(g.judge)` au lieu des deux booléens.
`ghostClauses` est **déjà** `Array<{anchorIndex; theme; judge: string}>` (générique).

### 2.5 État « absence » (piste grisée)

`hasData = !!preByJudge[id]?.clauses?.length`. Si `false` ⇒ `ModelBoundaryRail` rend la
piste **grisée** (`disabledOpacity`, en-tête barré) et la case de légende
`aria-disabled` — comportement **déjà implémenté** (Feature A). Pour Mistral, ceci
couvre nativement les 28 docs sans données. **Absence ≠ masquage** : la piste reste
visible (grisée), elle n'est pas retirée de la grille.

### 2.6 Prefill, switch, menu — générés depuis la SoT

| Surface | Avant | Après |
|---|---|---|
| `WorkspaceToolbar.PREFILL_OPTIONS` | `[null, claude, codex]` | `[{value:null,…}, ...JUDGES.map(j => ({value:j.id, label:j.label, testid:'prefill-'+j.id}))]` |
| `LlmSourceSwitch.OPTIONS` | `[human, claude, codex, compare]` | `[{human}, ...JUDGES.map(...'llm-'+j.id), {compare}]` |
| `SentenceMenu` (JudgeBlock x2) | 2 blocs littéraux | `JUDGES.map(j => <JudgeBlock judge={j.id} detail={details[j.id]} />)` |
| `JudgeBlock.name` | `judge==="claude"?"Claude":"Codex"` | `judgeLabel(judge)` |
| Dialogue prefill / voyant résolu | ternaires binaires | `judgeLabel(...)` |

Les actions `setPrefill`, l'effet de seeding fantôme et `seedFromPreAnnotation` sont
**déjà génériques sur `judge: string`** → Mistral coule sans modification de logique.

### 2.7 Types élargis

- `contract.ts:25` : `Judge = "claude" | "codex" | "mistral" | "other"`.
- `workspace.ts` : `LlmSource = "human" | JudgeId | "compare"` ;
  `PrefillJudge = JudgeId | null` ; `resolvedFrom?: JudgeId | null` ;
  `resolveDivergence(judge: JudgeId, …)`.

### 2.8 Ce qui ne bouge PAS (garde-fous périmètre)

- `ModelBoundaryRail.tsx`, `store/ui.ts` (déjà data-driven).
- `ComparePanel.tsx`, `InspectorJudgeCompare.tsx`, `compare/page.tsx` → **pairwise**,
  gelés (option : data-driver seulement les **libellés** via `judgeLabel`, sans changer
  la sémantique 2-juges).
- `lib/divergence.ts`, `lib/llmAgreement.ts::agreement` → restent pairwise (réutilisés
  par compare). Seuls `themeByIndex`/`cohenKappa` sont mutualisés.

---

## 3. Contrat d'API (résumé ; détail YAML)

Tous les endpoints concernés **existent déjà** ; Mistral n'en ajoute **aucun**.

| Endpoint | Méthode | Statut | Rôle vis-à-vis de Mistral |
|---|---|---|---|
| `/api/v1/preannotations?project=&document=&version=&judge=` | GET | **existant** | renvoie Mistral via `?judge=mistral` (ou tous juges du doc) |
| `/api/v1/projects/{slug}/preannotations/import` | POST | **existant** | accepte `{document, judge:"mistral", raw}` |
| `/api/v1/documents/{id}/annotation-versions` | GET | **existant** | liste les versions/juges (groupe par `judge`) |
| `/api/v1/annotations` (seed) | POST | **existant** | `seed:"preannotation:mistral"` |
| `/api/v1/health` | GET | **existant** | smoke prod post-deploy |

> Détail des schémas (camelCase), exemples Mistral, et marquage **existant/proposé**
> dans `02-api-contrat.yaml`. **Proposé** côté front uniquement (types/SoT), **rien**
> de proposé côté HTTP.

---

## 4. Diagrammes

- `02-sequence-mistral.puml` — séquence **import → DB → API → réglette/prefill**, avec
  le cas « doc sans Mistral → piste grisée ».
- `02-composants.puml` — carte des composants : SoT au centre, surfaces data-driven,
  zones gelées (compare).

## 5. Impacts non-fonctionnels

- **Perf** : un mémo `runsByJudge` remplace `claudeRuns`+`codexRuns` (même coût, ×N/2).
  La réglette ne recalcule rien de plus (dépendances inchangées).
- **Bundle** : `lib/llmJudges.ts` est négligeable (< 1 ko) ; supprime des littéraux.
- **Compat données** : aucun changement wire ; un client front ancien ignore simplement
  une pré-annotation `mistral` supplémentaire (clé `judge` inconnue → non rendue).
