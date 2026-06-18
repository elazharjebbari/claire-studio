# Formats d'export

> Périmètre : feature **F5** (export multi-format + formats explicatifs). Entité : `ExportJob`.
> Endpoints : `POST /api/v1/projects/{slug}/exports`, `GET /api/v1/exports/{id}`. Surface :
> `/admin/exports`. Formats : `jsonl | csv | conll | xml | md | huggingface` (CONTRACT §2).
> Le **format explicatif** (manifeste) est décrit dans `export_explainer_spec.md`.

## 1. Cycle de vie d'un export

```
POST /projects/{slug}/exports  {format, scope}        → 201 {id, status: "queued"}
GET  /exports/{id}                                     → {status, artifact_path, manifest}
```

- **Asynchrone** : l'export est un `ExportJob` traité par worker. `status ∈
  {queued, running, completed, failed}`. `ActivityEvent` `export.requested` puis `export.completed`.
- **`scope`** filtre ce qui est exporté (cohérent avec les filtres d'API, CONTRACT §3) :
  ```json
  {"status": ["approved"], "documents": ["Fitbit", "Spotify"],
   "annotators": ["alice"], "include_preannotations": false,
   "include_reference_labels": true, "anonymize": true}
  ```
- L'artefact écrit (DB-centrique avec **exports fichiers**) sous
  `exports/<project>/<date>/<format>/…` + le **manifeste** (`export_explainer_spec.md`). `anonymize`
  par défaut `true` pour tout export comparatif/IAA (cf. `collaboration.md` §4).
- Source des données : annotations gold (`Annotation` + `Clause`), projetées sur les phrases ; les
  `ReferenceLabel` CLAUDETTE et les pré-annotations LLM sont **optionnels** et clairement séparés.

## 2. Unité d'export & projection

Chaque format dérive du **pivot clause** (CONTRACT §4) et, pour les formats par token/phrase, de sa
**projection par phrase** : chaque `Sentence.index` reçoit le `theme` de sa clause couvrante
(segmentation monotone). C'est la même projection que l'IAA (`inter_annotator_agreement.md` §1),
garantissant la cohérence entre métriques internes et exports.

## 3. Détail par format

### 3.1 `jsonl` — une annotation par ligne (fidèle au pivot)
Le format **canonique**, sans perte. Une ligne JSON = un objet pivot complet (CONTRACT §4) augmenté
des identifiants d'export. Idéal pour ré-import, archivage, traitement programmatique. Voir
`sample_export.jsonl`.

### 3.2 `csv` — tabulaire par clause
Une ligne **par clause**, colonnes plates pour tableur/analyse rapide. Multi-valeurs aplaties.
Colonnes : `doc, project, annotator, schema, status, global_certainty, anchor_index, theme,
legal_nature, certainty, evidence_span, rationale, seeded_from, edited`. Échappement RFC 4180
(guillemets doublés, séparateur `,`, UTF-8 avec BOM optionnel). Voir `sample_export.csv`.

### 3.3 `conll` — par token/phrase, étiquetage de séquence
Format orienté NLP (séquence labelling), une **phrase par ligne** (ou un token par ligne en variante
`conll-token`), schéma **BIO** sur les frontières de clause :
```
# doc = Fitbit
# annotator = A
0    we recently revised these terms    B-META
1    ...                                I-META
6    fitbit designs products            B-LICENSE_IP
```
`B-` à l'`anchor_index` (début de clause), `I-` pour les phrases internes, `O` pour les phrases
hors-clause. Colonne 1 = `Sentence.index`, colonne 2 = `clean_text`, colonne 3 = tag BIO. Compatible
fine-tuning d'un classifieur de segmentation/étiquetage. En option, colonnes supplémentaires
`refA refCH …` pour les niveaux d'injustice CLAUDETTE si `include_reference_labels`.

### 3.4 `xml` — structure documentaire (proche source CLAUDETTE)
Document structuré, fidèle à la logique « document → phrases → clauses » :
```xml
<document id="Fitbit" project="claudette-gold-v1" annotator="A" schema="claire-themes-v1">
  <clause anchor_index="0" theme="META" certainty="3">
    <evidence_span>we recently revised these terms</evidence_span>
    <rationale>notice d'ouverture</rationale>
    <sentences><s index="0">we recently revised these terms</s></sentences>
  </clause>
</document>
```
Utile pour interopérer avec des outils XML et pour rapprocher du format `OriginalTaggedDocuments`
CLAUDETTE. Échappement XML strict, encodage UTF-8, déclaration `<?xml version="1.0"?>`.

### 3.5 `md` — lecture humaine
Rendu Markdown lisible : titre = document, sections = clauses (badge thème, certitude, span en
citation, rationale). Pour relecture, annexes de rapport, partage non technique. Non destiné au
ré-import (lossy).

### 3.6 `huggingface` — `datasets`-ready
Dossier exportable chargeable par `datasets.load_dataset` : `data-00000-of-*.parquet` (ou JSONL) +
`dataset_infos.json` (features typées) + `README.md` (= le manifeste explicatif, cf.
`export_explainer_spec.md`). Features : `sentence_index:int`, `clean_text:string`,
`theme:ClassLabel(names=<thèmes du scheme>)`, `legal_nature:ClassLabel`, `certainty:int`,
`is_clause_start:bool`, et splits stables si définis dans `scope`. Respecte le principe CLAUDE.md
« ne pas mélanger train/test silencieusement » : les splits sont explicites et journalisés dans le
manifeste.

## 4. Tableau de synthèse

| Format | Granularité | Lossless | Usage principal |
|---|---|---|---|
| `jsonl` | annotation | ✅ | ré-import, archivage, pivot |
| `csv` | clause | partiel | tableur, stats rapides |
| `conll` | phrase/token (BIO) | partiel | entraînement séquence labelling |
| `xml` | document/clause | ✅ | interop XML, rapprochement CLAUDETTE |
| `md` | document | ❌ | relecture humaine |
| `huggingface` | phrase (+features) | partiel | datasets ML, splits stables |

## 5. Cohérence & garanties

- **Vocab fermé** : tout `theme`/`legal_nature` exporté ∈ `LabelScheme` du projet (CONTRACT §2).
- **Séparation gold / LLM / référence** : jamais de fusion silencieuse ; `include_preannotations` et
  `include_reference_labels` sont des choix explicites, et le manifeste documente leur présence.
- **Anonymisation** : libellés annotateurs pseudonymisés si `anonymize` (défaut sur exports IAA).
- **Reproductibilité** : chaque export embarque un manifeste (schéma, vocab, provenance, version,
  checksum) — `export_explainer_spec.md`.

## 6. Tests (CONTRACT §6)

- `pytest export_formats` : round-trip `jsonl` (export→ré-import = identité) ; BIO `conll` correct ;
  XML valide (schéma) ; CSV RFC 4180 ; HF chargeable par `datasets`.
- `pytest export_scope` : filtres `status/documents/annotators` respectés ; `anonymize` effectif.
- `e2e export.spec` : lancement, suivi de statut, téléchargement artefact + manifeste.
