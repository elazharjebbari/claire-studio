# Spécification du format explicatif (manifeste d'export)

> Périmètre : feature **F5** (« formats explicatifs »). Chaque `ExportJob` produit, en plus de
> l'artefact de données, un **manifeste** auto-généré qui documente : colonnes/champs, vocabulaire,
> provenance, version de schéma, périmètre, checksums. Objectif : un export doit être **compréhensible
> et reproductible** sans accès à la base. Exemple concret : `sample_manifest.json`.

## 1. Rôle

Le manifeste est le « README machine + humain » de l'export. Il répond, pour quiconque reçoit le
fichier, aux questions : *qu'est-ce que c'est, d'où ça vient, comment lire chaque colonne, quel
vocabulaire, quelle version, est-ce anonymisé, est-ce complet ?* Il est :

- **généré automatiquement** à la fin du job (jamais rédigé à la main, jamais désynchronisé) ;
- **stocké dans `ExportJob.manifest:json`** (CONTRACT §2) et écrit à côté de l'artefact
  (`manifest.json`, et `README.md` pour le format `huggingface`) ;
- **versionné** par un `manifest_schema_version` propre, indépendant du `LabelScheme`.

## 2. Structure du manifeste (`manifest_schema_version: 1`)

```json
{
  "manifest_schema_version": 1,
  "export": {
    "id": 31, "format": "csv", "created_at": "2026-06-18T11:00:00Z",
    "requested_by": "admin (alice)", "tool": "CLAIRE Studio",
    "tool_version": "0.4.0", "artifact_path": "exports/claudette-gold-v1/2026-06-18/csv/",
    "artifact_checksum_sha256": "…", "row_count": 142
  },
  "provenance": {
    "corpus": {"slug": "CLAUDETTE-ToS", "license": "…", "source_url": "http://claudette.eui.eu/ToS.zip"},
    "project": {"slug": "claudette-gold-v1", "name": "CLAUDETTE Gold v1"},
    "scope": {"status": ["approved"], "documents": ["Fitbit"], "annotators": ["A"],
              "include_preannotations": false, "include_reference_labels": true},
    "anonymized": true,
    "data_sources": {"gold_human": true, "preannotations_llm": false, "reference_labels_claudette": true}
  },
  "schema": {
    "label_scheme": {"slug": "claire-themes-v1", "version": "1.0.0"},
    "pivot_format": "clause@CONTRACT-v1.0",
    "themes": [{"code": "META", "label": "Méta / dates / adresses"}, "…"],
    "legal_natures": [{"code": "OBLIGATION", "label": "Obligation"}, "…"],
    "certainty_scale": [{"value": 0, "label": "Incertain"}, "…"],
    "unfairness_categories": [{"code": "A", "label": "Arbitration"}, "…"],
    "unfairness_levels": [{"value": 1, "label": "clairement juste / faible"}, "…"]
  },
  "columns": [
    {"name": "doc", "type": "string", "desc": "Document.external_id"},
    {"name": "anchor_index", "type": "int", "desc": "Index de phrase début de clause (0-based)"},
    {"name": "theme", "type": "enum", "enum_ref": "schema.themes", "desc": "Thème (vocab fermé)"},
    {"name": "certainty", "type": "int", "enum_ref": "schema.certainty_scale",
     "desc": "Certitude 0-3 de la clause"},
    {"name": "evidence_span", "type": "string", "desc": "Extrait textuel justifiant la clause"}
  ],
  "integrity": {
    "row_count": 142, "document_count": 1, "annotation_count": 1,
    "files": [{"path": "data.csv", "sha256": "…", "bytes": 20481}]
  },
  "notes": [
    "Anonymisé : libellés annotateurs pseudonymisés et stables par projet.",
    "Données gold humaines uniquement ; pré-annotations LLM exclues du périmètre.",
    "Niveaux d'injustice CLAUDETTE inclus en colonnes ref_* (lecture seule, non gold)."
  ]
}
```

## 3. Sections obligatoires

| Section | Contenu | Pourquoi |
|---|---|---|
| `export` | id, format, date, demandeur, version outil, checksum artefact, n lignes | traçabilité & intégrité |
| `provenance` | corpus (+licence/URL), projet, `scope`, anonymisation, sources de données | reproductibilité, conformité licence |
| `schema` | `LabelScheme` (slug+version), vocab complet (thèmes, natures, certitude, injustice) | lecture autonome, vocab fermé documenté |
| `columns` | description typée de **chaque** colonne/champ, renvoi au vocab | comprendre le fichier sans la DB |
| `integrity` | comptages + checksums par fichier | détecter corruption/troncature |
| `notes` | mentions humaines (anonymisation, séparation gold/LLM/ref, splits) | éviter les méprises d'usage |

## 4. Adaptation par format

- `jsonl` : `columns` décrit les **champs du pivot** (CONTRACT §4) plutôt que des colonnes plates.
- `csv` : `columns` = colonnes plates (`export_formats.md` §3.2).
- `conll` : `columns` décrit les colonnes positionnelles + le schéma de tags **BIO** et la liste des
  tags possibles (`B-/I-/O` × thèmes).
- `xml` : `columns` est remplacé par `elements` (description des balises et attributs).
- `md` : manifeste minimal (l'artefact est déjà lisible) mais provenance/schema toujours présents.
- `huggingface` : le manifeste est **aussi** rendu en `README.md` (carte de dataset) + reflété dans
  `dataset_infos.json` (features typées). Les **splits** déclarés dans `scope` y figurent
  explicitement (principe CLAUDE.md : pas de fuite train/test silencieuse).

## 5. Garanties

- **Auto-cohérence** : `schema.themes` est exactement le vocab du `LabelScheme` du projet à l'instant
  de l'export ; aucun thème exporté hors de cette liste (invariant vocab fermé, CONTRACT §2).
- **Intégrité vérifiable** : recharger l'artefact + recalculer les checksums = validation hors-ligne.
- **Honnêteté des sources** : `data_sources` distingue toujours gold humain / pré-annotation LLM /
  référence CLAUDETTE (jamais de fusion implicite, CONTRACT §1).

## 6. Tests (CONTRACT §6)

- `pytest export_manifest` : présence des sections obligatoires ; `schema.themes == LabelScheme` ;
  checksums recalculables ; `columns` couvre toutes les colonnes effectives de l'artefact.
- `pytest export_manifest_hf` : `README.md` et `dataset_infos.json` cohérents avec le manifeste ;
  splits reflétés.
