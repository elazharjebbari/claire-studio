# Import des pré-annotations LLM (v9.2 & v9.4 → pivot clause)

> Périmètre : feature **F2** (charger/récupérer les pré-annotations LLM). Entités : `PreAnnotation`,
> `PreClause`. Endpoints : `POST /api/v1/projects/{slug}/preannotations/import`,
> `GET /api/v1/preannotations?project=&document=&judge=`. Surface : `/admin/preannotations` +
> bouton « Pré-remplir depuis Claude/Codex » dans le workspace (overlay fantôme).
> Cible de normalisation : **format pivot « clause »** du CONTRACT §4.

## 1. Les deux formats d'entrée

Le pipeline de recherche produit des pré-annotations sous deux schémas historiques ; les deux sont
acceptés et normalisés vers le même pivot.

### Format v9.4 (`plan.clauses`)
```json
{
  "doc": "Fitbit", "judge": "claude", "schema_version": "v9.4",
  "plan": {
    "clauses": [
      {"clause_id": "c1", "theme": "META", "anchor_id": 0,
       "open_span": "we recently revised these terms"},
      {"clause_id": "c2", "theme": "LICENSE_IP", "anchor_id": 6,
       "open_span": "fitbit designs products"}
    ]
  }
}
```
Mapping : `anchor_id → anchor_index`, `open_span → evidence_span`, `theme → theme_code`,
`clause_id` conservé dans `PreClause` (référence interne LLM, utile pour le diff fantôme).

### Format v9.2 (`document_plan.segments`)
```json
{
  "doc": "Fitbit", "judge": "codex", "schema_version": "v9.2",
  "document_plan": {
    "segments": [
      {"start_id": 0, "theme": "META", "rationale": "notice d'ouverture",
       "evidence_span": "we recently revised these terms"},
      {"start_id": 6, "theme": "LICENSE_IP", "rationale": "déclaration de propriété",
       "evidence_span": "fitbit designs products"}
    ]
  }
}
```
Mapping : `start_id → anchor_index`, `evidence_span → evidence_span`, `rationale → rationale`,
`theme → theme_code`.

## 2. Format pivot cible (CONTRACT §4)

Les deux formats convergent vers la liste de clauses du pivot :

```json
{
  "doc": "Fitbit", "project": "claudette-gold-v1", "judge": "claude",
  "schema_version": "v9.4",
  "clauses": [
    {"anchor_index": 0, "theme": "META", "evidence_span": "we recently revised these terms",
     "rationale": null, "source_clause_id": "c1"},
    {"anchor_index": 6, "theme": "LICENSE_IP", "evidence_span": "fitbit designs products",
     "rationale": null, "source_clause_id": "c2"}
  ]
}
```

Stockage : `PreAnnotation(project, document, judge, schema_version, raw:json, imported_at, mapped)`
conserve le **JSON brut** (`raw`) pour reproductibilité/audit ; les `PreClause(preannotation,
anchor_index, theme_code, evidence_span, rationale)` portent la forme normalisée.

## 3. Règles de normalisation & validation

Validation Pydantic au moment de l'import (échec = rejet du document, raison journalisée) :

1. **`judge` ∈ {claude, codex, other}** (CONTRACT §2). Inconnu → `other` avec libellé conservé.
2. **`anchor_index` valide** : entier ≥ 0, `< Document.n_sentences`, et appartenant au document.
   Hors borne → `AnchorOutOfRangeError` (le LLM a halluciné un index).
3. **Une seule clause start par phrase** (invariant pivot/CONTRACT §2) : doublons d'`anchor_index`
   dans une même pré-annotation → on conserve la première et on journalise les écartées
   (`payload.dropped_duplicates`).
4. **`theme_code` mapping vers le `LabelScheme` du projet** :
   - code identique à un `Theme.code` du schéma → accepté ;
   - code inconnu → tentative via une **table d'alias** `Project.settings.preannotation.theme_aliases`
     (ex. ancien libellé LLM → code v1) ;
   - sinon, marqué `unmapped` (la clause est importée mais signalée ; **jamais** d'`OTHER_` libre,
     conformément au vocab fermé). L'admin résout les `unmapped` dans `/admin/preannotations`.
5. **Monotonie** : les clauses sont triées par `anchor_index` croissant (segmentation monotone dérivée
   des ancres, comme v9.4). La couverture d'une clause = de son ancre à l'ancre suivante.
6. `mapped=true` une fois toutes les clauses soit mappées soit explicitement résolues.

## 4. Auto-pull vs upload

`POST /api/v1/projects/{slug}/preannotations/import` accepte deux modes (champ `mode`) :

| Mode | Déclencheur | Source | Cas d'usage |
|---|---|---|---|
| `upload` | l'admin dépose un/des fichier(s) JSON (v9.2 ou v9.4) | corps multipart | lot ponctuel, fichiers locaux |
| `auto_pull` | l'admin pointe un dossier/URI déclaré dans `Project.settings.preannotation.source` | dossier file-based (par doc, par judge) | rafraîchissement régulier depuis la sortie du pipeline |

`auto_pull` (file-based, cohérent avec l'approche traductions, `09_translations/`) :

- `source` décrit un dossier organisé par `judge` puis par `doc` :
  `preann/<judge>/<Doc>.json`. Le sync apparie `Document.external_id == <Doc>`.
- Détection de version automatique par sniff de schéma (`plan.clauses` ⇒ v9.4 ;
  `document_plan.segments` ⇒ v9.2).
- Détection de changement par checksum ; ré-import = nouvelle `PreAnnotation` (on **n'écrase pas** ;
  versions de pré-annotation conservées, la plus récente proposée par défaut au pré-remplissage).
- Émet `ActivityEvent verb=preannotation.imported payload={judge, schema_version, source}`.

## 5. Usage downstream : pré-remplissage & fantôme

- **Pré-remplir** (workspace, navigation.md §3) : `POST /api/v1/annotations` avec
  `seed=preannotation:claude` (ou la `PreAnnotation` la plus récente du judge) crée une `Annotation`
  `source=preannotation_seed`, clauses copiées comme **brouillon éditable**. `provenance.seeded_from =
  "preannotation:claude@v9.4"`, `edited=false` initialement (CONTRACT §4).
- **Fantôme** : les frontières LLM **non retenues** par l'humain restent affichées en surimpression
  « fantôme » pour comparaison (overlay `LLM claude` / `LLM codex` togglable). Le diff humain↔LLM
  réutilise la primitive d'alignement par `anchor_index` (`07_collaboration_versioning/versioning.md`
  §3 et `/compare`).
- Le gold humain n'est **jamais** mélangé aux pré-annotations (CONTRACT §1) : `PreAnnotation` et
  `Annotation` sont des tables disjointes ; seul le seeding copie, avec provenance tracée.

## 6. Tests (CONTRACT §6)

- `pytest import_v92` / `pytest import_v94` : mapping de champs exact vers le pivot ; sniff de version.
- `pytest preann_validation` : `anchor` hors borne rejeté ; doublons d'ancre dédupliqués ; thème
  inconnu → `unmapped` (jamais d'`OTHER_`) ; alias appliqués.
- `pytest preann_autopull` : appariement dossier↔document, idempotence checksum, versions conservées.
- `e2e prefill.spec` : seeding → brouillon éditable + provenance ; fantôme des frontières non retenues.
