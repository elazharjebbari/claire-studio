# Chaîne de données `legal_nature` LLM (Lot 2)

> Axe 2 / objectif B3.b : « nature juridique **consultable par LLM** ». Source d'audit :
> `00-audit/audit-uiux.json`, axes `legal-nature` et `inspector-refactor`.
> **Donnée vérifiée sur le corpus réel** : `data/annotations_archive/v9_2_session1_claude/Fitbit_claude.json`
> (et tous les `v9_2*/*.json`).
>
> Constat central (sévérité **blocker** dans l'audit) : la nature juridique LLM **existe à la
> source** mais est **jetée à l'ingestion**. Ce document décrit exactement *où* elle se perd,
> *ce qu'il faut conserver* dans `loaders.py` / `PreClause` / `JudgeDetail`, et le **fallback
> dérivé thème → nature**.

---

## 1. Où la donnée existe (et sous quelle forme)

Les fichiers LLM `v9.2` (`version: "v9.2-nature-derived"`) ont **deux tableaux** au premier niveau :

```jsonc
{
  "doc": "Fitbit", "judge": "claude", "version": "v9.2-nature-derived",
  "document_plan": {
    "estimated_n_blocks": ..., "rationale_global": "...",
    "segments": [                       // ← lu par le loader (normalize_v92)
      { "start_id": 0,  "theme": "MODIFICATION_OF_TERMS", "rationale": "...", "evidence_span": "..." },
      { "start_id": 16, "theme": "ELIGIBILITY_ACCOUNT",   "rationale": "...", "evidence_span": "..." },
      ...
    ]
  },
  "annotations": [                      // ← IGNORÉ par le loader (donnée perdue)
    { "id": 0,  "theme": "...", "block_id": 0, "is_block_start": true,
      "rationale": "...", "rationale_codes": {...},
      "legal_nature": "UNKNOWN",          "legal_nature_marker": "" },
    { "id": 16, "theme": "...", "block_id": ..., "is_block_start": true,
      "rationale": "...", "rationale_codes": {...},
      "legal_nature": "GOVERNANCE",       "legal_nature_marker": "jurisdiction" },
    ...                                   // 158 entrées (une par phrase) sur Fitbit
  ]
}
```

**Point clé (erreur load-bearing corrigée par le verdict d'audit) :** `legal_nature` n'est
**PAS** dans `document_plan.segments[]`. Il vit dans le tableau **séparé** `annotations[]`,
**une entrée par phrase**, clé `id`. La proposition naïve « `s.get("legal_nature")` dans
`normalize_v92` » est donc **fausse** : il faut une **jointure**
`segment.start_id == annotation.id`.

### 1.1 Sémantique de jointure (vérifiée)

J'ai vérifié sur `Fitbit_claude.json` :

```
n segments = 30
seg.start_id=0  → annotation.id=0  : legal_nature="UNKNOWN",   is_block_start=true
seg.start_id=16 → annotation.id=16 : legal_nature="GOVERNANCE", is_block_start=true, marker="jurisdiction"
…
all segment starts are is_block_start == true   ✅  (invariant confirmé)
```

→ La nature d'un **segment** (clause LLM) = `legal_nature` de l'annotation **dont
`id == segment.start_id`** (qui est toujours un `is_block_start`). C'est la nature de la
**phrase d'ancre** du bloc — exactement le point d'arbitrage qu'on veut exposer.

### 1.2 Vocabulaire LLM ≠ vocabulaire humain (divergence à gérer)

Les valeurs `legal_nature` observées sur tout le corpus `v9.2` (Claude/Codex/Mistral) :

```
DEFINITION, GOVERNANCE, LIMITATION_DISCLAIMER, META, OBLIGATION,
PROHIBITION, RIGHT_GRANT, RISK_ALLOCATION, SCOPE_APPLICABILITY, UNKNOWN   (10 valeurs)
```

Le vocabulaire **humain fermé** (`vocabulary.yaml:33-39`) n'en compte que **6** :

```
OBLIGATION, PROHIBITION, PERMISSION, DEFINITION, DECLARATION, PROCEDURE
```

| LLM (`v9.2-nature-derived`) | Recouvrement humain |
|---|---|
| `OBLIGATION` | = `OBLIGATION` |
| `PROHIBITION` | = `PROHIBITION` |
| `DEFINITION` | = `DEFINITION` |
| `RIGHT_GRANT` | ≈ `PERMISSION` |
| `GOVERNANCE` | ≈ `PROCEDURE` |
| `LIMITATION_DISCLAIMER` | ≈ `DECLARATION` (atténuation / déclaration de portée) |
| `RISK_ALLOCATION` | ≈ `DECLARATION` (répartition de risque) |
| `SCOPE_APPLICABILITY` | ≈ `DECLARATION` (champ d'application) |
| `META` | (hors-scheme — affiché, non adoptable) |
| `UNKNOWN` | (hors-scheme — affiché « — / indéterminé », non adoptable) |

**Conséquence de conception :** on **conserve la valeur LLM brute** (audit, fidélité) et on
**ne mappe vers le vocab humain que pour l'adoption** (`Reprendre`), via une table de
réconciliation **calquée sur le précédent `theme_mapping.normalize_theme_code`**
(`backend/claire/imports/theme_mapping.py`). Une valeur LLM hors-table (`UNKNOWN`, `META`)
est **affichée** mais **non adoptable** (jamais injectée dans l'annotation humaine → INV-3).

---

## 2. Où la donnée se perd aujourd'hui (chaîne complète)

| Étape | Fichier:ligne | État | Verdict |
|-------|---------------|------|---------|
| Source JSON | `data/.../v9_2*/*.json` | `annotations[].legal_nature` présent | ✅ donnée existe |
| **Loader** | `loaders.py:82-107` (`normalize_v92`) | ne lit que `start_id/theme/rationale/evidence_span` ; **n'ouvre jamais `annotations[]`** | ❌ **perdue ici** |
| Loader v9.4 | `loaders.py:55-79` (`normalize_v94`) | `plan.clauses[]` n'a **aucune** nature | ⚠️ chemin v9.4 sans nature (acceptable, voir §5) |
| Persistance | `services.py:54-64` (`PreClause.objects.bulk_create`) | ne pose pas `legal_nature` | ❌ rien à poser (loader vide) |
| Modèle | `models.py:45-53` (`PreClause`) | **aucune colonne `legal_nature`** | ❌ pas de stockage |
| Serializer | `serializers.py:14-26` (`PreClauseSerializer`) | `fields = [anchor_index, theme_code, evidence_span, rationale]` | ❌ pas exposé |
| Type front | `contract.ts:316-321` (`PreClause`) | pas de `legalNature` | ❌ pas typé |
| Pivot | `pivot.ts:114` (`preClausesToPivot`) | force `legal_nature: null` | ❌ écrasé |
| Détail menu | `SentenceMenu.tsx:28-36` (`JudgeDetail`) | pas de `legalNature` | ❌ pas affichable |
| Comparateur | `InspectorJudgeCompare.tsx:51-62` | ne lit qu'`evidence/rationale` | ❌ pas comparé |

Côté **humain**, à l'inverse, **rien à ajouter** : `Clause.legalNature` (`contract.ts:291`),
`PivotClause.legal_nature` (`:628`), `addClause/patchClause(legal_nature)` (`endpoints.ts:301,317`),
le diff (`versionDiff.ts:21`), le verbe d'historique `clause.set_legalNature` (`HistoryPanel.tsx:36`),
et le chemin de prefill (`store/workspace.ts:760` lit déjà `seg.legal_nature`) **existent déjà**.
La chaîne humaine est complète ; **seul le volet LLM est à brancher.**

---

## 3. Ce qu'il faut conserver — modifications backend

### 3.1 `loaders.py` — jointure `annotations[]` (correction de l'erreur naïve)

`normalize_v92` doit lire la table `annotations` et joindre par `start_id`. Conserver aussi
`legal_nature_marker` (utile pour expliquer *pourquoi* le juge a dérivé cette nature).

```python
def normalize_v92(raw: dict) -> list[dict]:
    """v9.2 document_plan.segments[] -> pivot clauses, avec nature jointe."""
    plan = raw.get("document_plan", {})
    segments = plan.get("segments", [])
    if not isinstance(segments, list):
        raise PreAnnotationFormatError("v9.2 'document_plan.segments' must be a list.")

    # Index nature par id de phrase (annotations[] = 1 entrée / phrase, clé `id`).
    nature_by_id: dict[int, dict] = {}
    for a in raw.get("annotations", []) or []:
        if isinstance(a, dict) and a.get("id") is not None:
            try:
                nature_by_id[int(a["id"])] = a
            except (TypeError, ValueError):
                continue

    out: list[dict] = []
    for i, s in enumerate(segments):
        if not isinstance(s, dict):
            raise PreAnnotationFormatError(
                f"v9.2 segment #{i} must be an object, got {type(s).__name__}."
            )
        anchor = _coerce_anchor(
            s.get("start_id"), where="v9.2 document_plan.segments", position=i,
        )
        ann = nature_by_id.get(anchor, {})           # jointure start_id == id
        out.append({
            "anchor_index": anchor,
            "theme": s.get("theme", ""),
            "evidence_span": s.get("evidence_span", ""),
            "rationale": s.get("rationale", ""),
            # NOUVEAU — valeur LLM BRUTE (vocab v9.2, pas normalisée). "" si absente.
            "legal_nature": (ann.get("legal_nature") or "") if isinstance(ann, dict) else "",
            "legal_nature_marker": (ann.get("legal_nature_marker") or "") if isinstance(ann, dict) else "",
            "order": i,
        })
    return out
```

`normalize_v94` (`:55-79`) ajoute par cohérence de schéma `"legal_nature": "", "legal_nature_marker": ""`
(v9.4 n'a pas de nature — chaîne vide propre, pas `KeyError` en aval).

### 3.2 `models.py` — colonne `PreClause.legal_nature` (+ migration)

```python
class PreClause(models.Model):
    ...
    rationale = models.TextField(blank=True)
    # NOUVEAU — nature LLM brute (vocab v9.2 : OBLIGATION/GOVERNANCE/UNKNOWN/…),
    # NON normalisée (audit/fidélité). Vide si le juge ne l'a pas dérivée.
    legal_nature = models.CharField(max_length=40, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
```

Migration `0003_preclause_legal_nature.py` (`AddField`, `default=""`). Pas de back-fill
automatique : la valeur n'apparaît qu'à la **ré-ingestion** des pré-annotations (cf. §6).
Optionnel : `legal_nature_marker` en seconde colonne si l'on veut afficher le déclencheur.

### 3.3 `services.py` — persistance (étape omise par l'audit, ajoutée ici)

`ingest_preannotation` (`services.py:54-64`) doit poser la nouvelle colonne :

```python
PreClause.objects.bulk_create([
    PreClause(
        preannotation=pre,
        anchor_index=c["anchor_index"],
        theme_code=c["theme"],
        evidence_span=c["evidence_span"],
        rationale=c["rationale"],
        legal_nature=c.get("legal_nature", ""),   # NOUVEAU
        order=c["order"],
    )
    for c in pivot
])
```

> Sans cette ligne, la colonne et le serializer resteraient vides même après correction du
> loader — c'est l'étape « manquante » signalée par le verdict d'audit.

### 3.4 `serializers.py` — exposition camelCase

`PreClauseSerializer.Meta.fields` (`:23`) += `"legal_nature"`. Le pont
`djangorestframework_camel_case` (déjà installé) le sérialise en **`legalNature`** sans
aliasing manuel. La forme de sortie devient :
`{anchorIndex, themeCode, legalNature, evidenceSpan, rationale}`.

> **Décision de design — pas de normalisation côté serializer.** Contrairement à
> `theme_code` (normalisé via `SerializerMethodField`, `serializers.py:19-26`), la nature LLM
> est exposée **brute**. La réconciliation vers le vocab humain se fait **à l'adoption** dans
> l'UI (`mapLlmNatureToHuman`), pas en sortie d'API : on veut afficher la vraie proposition du
> juge (y compris `RIGHT_GRANT`, `META`, `UNKNOWN`) sans la déformer.

---

## 4. Ce qu'il faut conserver — modifications frontend

| Fichier:ligne | Changement |
|---|---|
| `types/contract.ts:316` | `PreClause` += `legalNature?: string \| null` |
| `lib/pivot.ts:114` | `preClausesToPivot` : `legal_nature: p.legalNature ?? null` (au lieu de `null` figé) → débloque `store/workspace.ts:760` qui lit déjà `seg.legal_nature` |
| `components/workspace/SentenceMenu.tsx:28-36` | `JudgeDetail` += `legalNature: string \| null` ; badge nature dans `JudgeBlock` (`:269-283`), à côté du badge thème, via `getLegalNatureToken` |
| `components/workspace/DocumentPanel.tsx:904-940` | `buildJudgeDetailMap` pose `legalNature: c.legalNature ?? null` ; `detailAt` le propage depuis l'ancre du run (comme `theme`/`rationale`) |
| `components/workspace/InspectorJudgeCompare.tsx` | Affiche la nature LLM du juge sélectionné + bouton « Reprendre » nature (via `mapLlmNatureToHuman`, grisé si hors-table) |
| `lib/llmNatureMap.ts` | **Création** — `mapLlmNatureToHuman(code): string \| null` (table §1.2) |

### 4.1 `lib/llmNatureMap.ts` (réconciliation LLM → humain)

```ts
/** Réconciliation nature LLM (vocab v9.2-nature-derived) → vocab humain fermé.
 *  Calquée sur backend/imports/theme_mapping.normalize_theme_code. */
const LLM_NATURE_TO_HUMAN: Record<string, string> = {
  OBLIGATION: "OBLIGATION",
  PROHIBITION: "PROHIBITION",
  DEFINITION: "DEFINITION",
  RIGHT_GRANT: "PERMISSION",
  GOVERNANCE: "PROCEDURE",
  LIMITATION_DISCLAIMER: "DECLARATION",
  RISK_ALLOCATION: "DECLARATION",
  SCOPE_APPLICABILITY: "DECLARATION",
  // META, UNKNOWN : volontairement absents → null (affichés, non adoptables).
};

export function mapLlmNatureToHuman(code: string | null | undefined): string | null {
  if (!code) return null;
  return LLM_NATURE_TO_HUMAN[code.trim().toUpperCase()] ?? null;
}
```

Affichage : le comparateur montre la **nature brute du juge** (label lisible) ; le bouton
« Reprendre » écrit la **nature humaine mappée** (`mapLlmNatureToHuman`) ou est **désactivé**
si le mapping renvoie `null` (`UNKNOWN`/`META`). Indiquer en tooltip « nature LLM non
transposable au vocabulaire fermé » pour la transparence.

---

## 5. Fallback dérivé thème → nature

**Couverture réelle de la donnée LLM** (sur Fitbit) : `UNKNOWN` = 97/158 (≈ 61 %). La nature
LLM est donc **souvent indéterminée**, même quand elle est présente. Pour que la colonne
nature soit **utile** sans **inventer** une proposition LLM (rejet de l'heuristique « nature
fabriquée présentée comme venant de Claude », audit option C), on prévoit un **fallback
dérivé thème → nature**, clairement **étiqueté comme dérivé** (≠ « proposé par le juge »).

### 5.1 Principe

- **Source 1 (préféré)** — `legalNature` LLM réel (jointure `annotations[]`), quand ≠
  `UNKNOWN`/`META`/vide. Badge **« nature (Claude) »**.
- **Source 2 (fallback)** — nature **dérivée du thème** de la clause via une table
  `THEME_TO_NATURE` (ex. `LIMITATION_LIABILITY → DECLARATION`, `FEES_PAYMENT → OBLIGATION`,
  `ARBITRATION_DISPUTES → PROCEDURE`, `PRIVACY_DATA → DECLARATION`, …). Badge **« nature
  (dérivée du thème) »**, visuellement distinct (style `ghost`/pointillé, comme
  `ClauseChip ghost`).
- **Source 3 (rien)** — ni LLM ni dérivable → `—`.

Cette distinction d'origine répond directement à l'acceptation B2 : *« son origine (humaine
vs dérivée) est claire »*. Le `seededFrom`/`resolvedFrom` du store porte déjà la provenance
de la clause ; on ajoute un **drapeau d'origine de nature** au point d'affichage (pas en base).

### 5.2 Où placer la dérivation

- **Option recommandée — frontend, à l'affichage uniquement.** Un helper
  `deriveNatureFromTheme(themeCode): string | null` dans `lib/llmNatureMap.ts`, consommé par
  le `NaturePicker` (mode lecture) et le comparateur **uniquement pour suggérer**, jamais
  écrit silencieusement dans la clause. Avantage : zéro impact base/migration, pas de
  pollution de la donnée d'audit, et le caractère « dérivé » reste explicite à l'écran.
- **Ne pas** dériver côté backend dans `PreClause.legal_nature` : cela ferait passer une
  heuristique pour une proposition LLM (perte de confiance — audit). La colonne backend ne
  contient **que** la nature réelle du juge (ou vide).

### 5.3 Étiquetage UI du fallback

```tsx
// NaturePicker / comparateur, badge nature :
const llm = mapLlmNatureToHuman(judge.legalNature);          // nature réelle, transposée
const derived = llm ? null : deriveNatureFromTheme(judge.theme);
// → badge "Obligation · Claude" (réel) ou "Procédure · dérivée" (fallback, style ghost)
```

L'utilisateur peut adopter une nature **dérivée** (c'est une suggestion d'aide à la saisie),
mais le badge porte la mention « dérivée », sans jamais prétendre que le juge l'a émise.

---

## 6. Déploiement & ré-ingestion

1. Migration `0003_preclause_legal_nature` appliquée en prod (`pactiva.legal`,
   VPS OLS — cf. mémoire `deploiement-prod-pactiva`). Sûre (`AddField default=""`).
2. La colonne reste **vide** pour les pré-annotations déjà importées tant qu'on ne **ré-ingère**
   pas. `ingest_preannotation` est **idempotent par clé** (`services.py:38-52` : il supprime et
   recrée les `preclauses`) → relancer l'import des `v9_2*` recrée les clauses **avec** la
   nature. Prévoir une commande/management task de ré-import ciblé `v9.2`.
3. v9.4 : aucune nature à la source → reste vide ; le fallback dérivé thème prend le relais
   à l'affichage. Pas de ré-ingestion nécessaire pour v9.4.

---

## 7. Récapitulatif des fichiers (Lot 2)

**Backend**
- `backend/claire/imports/loaders.py` — `normalize_v92` : jointure `annotations[]` (+ `normalize_v94` chaîne vide).
- `backend/claire/imports/models.py` — `PreClause.legal_nature` (CharField).
- `backend/claire/imports/migrations/0003_preclause_legal_nature.py` — **création**.
- `backend/claire/imports/services.py` — `ingest_preannotation` pose `legal_nature` (étape ajoutée).
- `backend/claire/imports/serializers.py` — `PreClauseSerializer.fields += "legal_nature"`.
- `dossier/00_overview/vocabulary.yaml` — `definition` des 6 natures (pour le tooltip `NaturePicker`).

**Frontend**
- `frontend/src/types/contract.ts` — `PreClause.legalNature`.
- `frontend/src/lib/pivot.ts` — `preClausesToPivot` propage `legal_nature`.
- `frontend/src/lib/llmNatureMap.ts` — **création** : `mapLlmNatureToHuman` + `deriveNatureFromTheme`.
- `frontend/src/lib/tokens.ts` — `getLegalNatureToken` (couleurs des 6 natures, partagé avec le `NaturePicker`).
- `frontend/src/components/workspace/SentenceMenu.tsx` — `JudgeDetail.legalNature` + badge nature dans `JudgeBlock`.
- `frontend/src/components/workspace/DocumentPanel.tsx` — `buildJudgeDetailMap`/`detailAt` portent la nature.
- `frontend/src/components/workspace/InspectorJudgeCompare.tsx` — nature affichée + adoptable (mappée).

**Données / vérif**
- Source de vérité : `data/annotations_archive/v9_2_session1_claude/Fitbit_claude.json`
  (`annotations[].legal_nature`, jointure `start_id == id`, vocab 10 valeurs).
