# Modèle de données — extension multi-label, frontière, niveau

Principe : **additif et rétro-compatible**. On n'altère pas la certitude 0–3 ni INV-2 ;
on ajoute le multi-label *dans* la clause (table enfant), la frontière dure/molle, et le
niveau de triage dérivé.

## 1. Backend (Django) — diffs de modèle
### `Clause` (existant) — ajouts
```python
class BoundaryType(models.TextChoices):
    HARD = "hard", "Frontière dure"
    SOFT = "soft", "Frontière molle"

class Clause(models.Model):
    # … champs existants (anchor_sentence, certainty 0–3, evidence_span, rationale, validated, …)
    boundary_type    = models.CharField(max_length=4, choices=BoundaryType.choices, default=BoundaryType.HARD)
    boundary_support = models.PositiveSmallIntegerField(default=1)   # nb de juges concordants
    triage_level     = models.CharField(max_length=2, blank=True, default="")  # C1..C5 (dérivé, audit)
    # `theme` (FK scalaire) CONSERVÉ = miroir du primaire (rétro-compat / scripts legacy)
```
> `theme` (FK scalaire) reste le **miroir du thème primaire** pour la compatibilité
> ascendante (scripts `derive_legal_nature`, `validate_v9_2`, exports legacy). La vérité
> multi-label vit dans `ClauseTheme`.

### `ClauseTheme` (nouveau, table enfant)
```python
class ClauseRole(models.TextChoices):
    PRIMARY = "primary", "Primaire"
    SECONDARY = "secondary", "Secondaire"

class ClauseTheme(models.Model):
    clause   = models.ForeignKey(Clause, related_name="theme_tags", on_delete=models.CASCADE)
    theme    = models.ForeignKey("schemes.Theme", on_delete=models.PROTECT)
    role     = models.CharField(max_length=9, choices=ClauseRole.choices)
    support  = models.PositiveSmallIntegerField(default=0)  # nb de juges ayant proposé ce thème
    order    = models.PositiveSmallIntegerField(default=0)
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["clause", "theme"], name="uniq_clause_theme"),
        ]
```

### Invariants applicatifs (validés en `save`/serializer)
- **exactly-one-primary** : exactement 1 `ClauseTheme.role == primary` par clause.
- **refuge≠secondary** : aucun `theme.code ∈ {PREAMBLE_SCOPE, MISC_BOILERPLATE}` en `secondary`.
- **mono = multi de taille 1** : une clause mono-label a 1 seul `ClauseTheme` (primary).
- `Clause.theme` (scalaire) == le `ClauseTheme` primary (maintenu en cohérence).
- **couverture** : clauses contiguës et couvrantes (toute phrase ∈ exactement 1 clause) — déjà garanti par INV-2 + ancres.
- `boundary_type == soft` ⇒ fusion/scission possible tant que `validated == false`.

### Migration des données existantes
`0004_clausetheme.py` : pour chaque `Clause` existante, créer 1 `ClauseTheme(theme=clause.theme, role=primary, support=0)`. Réversible.

## 2. Frontend (types) — diffs
```ts
// contract.ts
export type ClauseRole = "primary" | "secondary";
export type BoundaryKind = "hard" | "soft";
export interface ThemeTag { label: string; role: ClauseRole; support?: number; }

export interface Clause {            // était: theme: string
  anchorIndex: number;
  themes: ThemeTag[];                // 1 primary + N secondary ; mono = [{primary}]
  boundary?: { type: BoundaryKind; support: number };
  triageLevel?: "C1"|"C2"|"C3"|"C4"|"C5";
  legalNature?: string | null;
  evidenceSpan?: string; rationale?: string;
  certainty?: Certainty;             // 0–3 INCHANGÉ (orthogonal au niveau)
  order: number; validated?: boolean; seededFrom?: string;
}
```
Helper de compat : `primaryOf(c) = c.themes.find(t=>t.role==="primary")?.label`.

## 3. Objets de triage (non persistés par défaut — calculés live)
- **`QueueItem`** (sortie du moteur, entrée des surfaces) : cf. `05-queue-item.schema.json`.
  Identique en forme à `SCHEMA.md §1` du protocole (`confidence_level`, `human_action`,
  `disagreement_type`, `proposal{boundary,label_mode,labels,candidates,override?}`,
  `needs_human`). Peut être **pré-calculé et persisté** (option batch back) pour l'export.
- **`Clause validée`** (oracle) : cf. `05-clause-multilabel.schema.json` (≡ `SCHEMA.md §2`).

## 4. Compatibilité ascendante (garanties)
- Lecture legacy : un client qui lit `theme` (scalaire) obtient toujours le **primaire**.
- Mesure : bascule `compute_iaa_v9_2_multi` (κ mono) → `iaa_multilabel` (α MASI) — coïncident
  sur le mono (α = κ).
- Exports existants : inchangés sur le primaire ; un export multi-label additif liste `themes[]`.
