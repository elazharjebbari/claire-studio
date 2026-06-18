# Modèle de données — CLAIRE Studio

> Description détaillée de chaque entité du **CONTRACT §2** (source de vérité). Aucune entité ni champ
> n'est ajouté hors contrat. Pour chaque entité : rôle, champs clés, relations, cycle de vie, invariants
> associés (détaillés dans `invariants.md`), feature couverte. Le schéma relationnel visuel est `erd.puml` ;
> la machine à états du statut d'annotation est `state_machines.puml`.

## Vue d'ensemble des relations

```
Corpus 1─* Document 1─* Sentence 1─* ReferenceLabel
LabelScheme 1─* Theme            LabelScheme 1─* LegalNature
Project *─1 Corpus   Project *─1 LabelScheme   Project 1─* ProjectMembership *─1 User
Project 1─* Assignment *─1 Document   Assignment *─1 User(assignee)
Project 1─* Annotation *─1 Document   Annotation *─1 User(annotator)
Annotation 1─* Clause *─1 Sentence(anchor)   Clause *─1 Theme   Clause *─0..1 LegalNature
Project 1─* PreAnnotation 1─* PreClause
Annotation 1─* AnnotationVersion   Annotation 1─* Comment   Annotation 1─* Review
Corpus 1─* TranslationSet 1─* Translation *─1 Document
User 1─* ActivityEvent      Project 1─* ExportJob
```

---

## 1. Référentiel de corpus (features 11, 12)

### Corpus
- **Rôle** : jeu de données réutilisable (`CLAUDETTE-ToS`, CUAD…). Pilier de l'agnosticité corpus (feature 11).
- **Champs clés** : `slug*`, `name*`, `description`, `source_url`, `license`, `default_language`.
- **Relations** : 1─* `Document`, 1─* `TranslationSet`.
- **Cycle de vie** : créé par admin (`/admin/corpora`) ; immuable côté contenu une fois les documents
  importés ; suppression réservée à l'`owner` (ADR liée : permissions).

### Document
- **Rôle** : une pièce du corpus (ex. `Fitbit`), composée de phrases ordonnées.
- **Champs clés** : `FK corpus*`, `external_id*`, `title*`, `language`, `n_sentences`, `source_meta:json`,
  `checksum`.
- **Relations** : *─1 `Corpus` ; 1─* `Sentence`. Référencé par `Assignment`, `Annotation`, `PreAnnotation`,
  `Translation`.
- **Cycle de vie** : importé (loader CLAUDETTE, feature 12) ; `checksum` garantit l'intégrité ;
  `n_sentences` borne la contiguïté des index (invariant).

### Sentence
- **Rôle** : **unité atomique** indexée du document. Toute la segmentation s'ancre dessus.
- **Champs clés** : `FK document*`, `index*` (0..N-1), `raw_text*` (tokenisé), `clean_text` (« propre »),
  `char_start?`, `char_end?`.
- **Relations** : *─1 `Document` ; 1─* `ReferenceLabel` ; cible d'ancre de `Clause`.
- **Invariants** : `index` unique par document, **contigu de 0 à `n_sentences-1`** (cf. `invariants.md`).

### ReferenceLabel (feature 12)
- **Rôle** : label natif CLAUDETTE d'injustice par phrase, affiché en **surimpression** (overlay).
- **Champs clés** : `FK sentence*`, `category*` (`A|CH|CR|J|LAW|LTD|TER|USE|…`), `level*` (1|2|3), `source`.
- **Relations** : *─1 `Sentence`.
- **Cycle de vie** : importé avec le corpus ; **lecture seule** pour l'annotateur (aide au repérage, n'impose
  aucun choix — navigation.md §3).

---

## 2. Référentiel d'annotation (vocab fermé, ADR-0003, feature 11)

### LabelScheme
- **Rôle** : **vocabulaire fermé et versionné** des thèmes et natures juridiques. Cœur de la réutilisabilité.
- **Champs clés** : `slug*`, `name*`, `version*`, `is_active`, `definition:json`.
- **Relations** : 1─* `Theme`, 1─* `LegalNature` ; attaché à un `Project`.
- **Cycle de vie** : créé/cloné par admin (`POST /schemes`) ; **évolution = nouvelle version**, jamais
  édition en place d'un schéma actif lié à des annotations (ADR-0003).

### Theme
- **Champs clés** : `FK scheme*`, `code*`, `label*`, `color`, `definition`, `examples:json`, `order`.
- **Relations** : *─1 `LabelScheme` ; référencé par `Clause.theme`.
- **Invariant** : `Clause.theme` ∈ themes du scheme du projet — **pas de `OTHER_` libre** (ADR-0003).
  Valeurs v1 : voir `vocabulary.yaml` (20 thèmes, couleurs pensées thème sombre AA).

### LegalNature
- **Champs clés** : `FK scheme*`, `code*`, `label*`, `definition`, `order`.
- **Relations** : *─1 `LabelScheme` ; référencé **optionnellement** par `Clause.legal_nature`.
- **Cycle de vie** : feature avancée, dérivable hors-prompt (vocabulary.yaml : 6 natures).

---

## 3. Campagnes & attribution (features 4, 11)

### Project
- **Rôle** : campagne d'annotation = `Corpus` (sous-ensemble de documents) + `LabelScheme` + consignes + membres.
- **Champs clés** : `slug*`, `name*`, `FK corpus*`, `FK scheme*`, `guidelines:md`, `status`, `settings:json`.
- **Relations** : *─1 `Corpus`, *─1 `LabelScheme` ; 1─* `ProjectMembership`, `Assignment`, `Annotation`,
  `PreAnnotation`, `ExportJob`.
- **Cycle de vie** : créé par admin (`/admin/projects`) ; toute l'annotation se fait **dans un projet**.

### ProjectMembership
- **Rôle** : appartenance d'un `User` à un `Project` avec un **rôle projet** (`annotator|reviewer|lead`).
- **Champs clés** : `FK project*`, `FK user*`, `role*`, `joined_at`.
- **Relations** : *─1 `Project`, *─1 `User`. Gouverne les permissions **dans** le projet (distinct du
  `User.role` système — cf. `personas.md`).

### Assignment
- **Rôle** : attribution d'un `Document` à un annotateur dans un projet (plan de travail).
- **Champs clés** : `FK project*`, `FK document*`, `FK assignee(User)*`, `status`, `due_at?`.
- **Relations** : *─1 `Project`, *─1 `Document`, *─1 `User`.
- **Cycle de vie** : créé par le `lead`/admin ; visible via `GET /projects/{slug}/assignments`.

---

## 4. Annotation (cœur — features 1, 2, 10)

### Annotation
- **Rôle** : production d'**un** annotateur pour **un** document dans **un** projet.
- **Champs clés** : `FK project*`, `FK document*`, `FK annotator(User)*`,
  `status*` (`draft|submitted|in_review|approved|rejected|archived`), `global_certainty[0..3]?`,
  `source` (`human|preannotation_seed`), `created_at`, `updated_at`.
- **Relations** : *─1 `Project`, *─1 `Document`, *─1 `User` ; 1─* `Clause`, `AnnotationVersion`,
  `Comment`, `Review`.
- **Invariants** : **unique par `(project, document, annotator)`** ; toute transition de statut émet un
  `ActivityEvent` et peut créer une `AnnotationVersion`.
- **Cycle de vie** : voir `state_machines.puml` — `draft → submitted → in_review → approved|rejected →
  archived`.

### Clause
- **Rôle** : segment d'annotation, ancré sur une phrase. La segmentation **dérive des ancres** (monotone, v9.4).
- **Champs clés** : `FK annotation*`, `FK anchor_sentence(Sentence)*`, `FK theme*`, `FK legal_nature?`,
  `evidence_span`, `rationale`, `certainty[0..3]?`, `order`.
- **Relations** : *─1 `Annotation`, *─1 `Sentence` (ancre), *─1 `Theme`, *─0..1 `LegalNature`.
- **Invariants** : `anchor_sentence` ∈ document de l'annotation ; **un seul clause-start par phrase** par
  annotation ; `theme` ∈ scheme du projet ; `certainty` ∈ {0,1,2,3}.

---

## 5. Pré-annotations LLM (feature 2)

### PreAnnotation
- **Rôle** : annotation produite par un LLM (`claude|codex|other`), importée, **jamais mélangée** au gold.
- **Champs clés** : `FK project*`, `FK document*`, `judge*`, `schema_version*`, `raw:json`, `imported_at`,
  `mapped[bool]`.
- **Relations** : *─1 `Project`, *─1 `Document` ; 1─* `PreClause`.
- **Cycle de vie** : importée (`/admin/preannotations`) ; **immuable** ; sert de seed à une `Annotation`
  (`source=preannotation_seed`) sans être altérée.

### PreClause
- **Champs clés** : `FK preannotation*`, `anchor_index*`, `theme_code*`, `evidence_span`, `rationale`.
- **Rôle** : clause LLM normalisée vers le **pivot** (v9.2 `start_id` / v9.4 `anchor_id → anchor_index`,
  `open_span → evidence_span`).

---

## 6. Collaboration & versioning (features 3, 9, 10)

### AnnotationVersion (feature 3)
- **Rôle** : **snapshot immuable** d'une annotation (versioning/historique).
- **Champs clés** : `FK annotation*`, `number*`, `snapshot:json*`, `FK author(User)*`, `label?`, `created_at`.
- **Cycle de vie** : créée à chaque transition de statut (auto) ou via `⌘S` (manuel) ; jamais modifiée.
  Diff entre versions : `GET .../versions/{n}/diff`.

### Comment (feature 9)
- **Rôle** : fil de discussion ancré (clause / phrase / annotation) pour **justifier un choix**.
- **Champs clés** : `FK annotation*`, `FK clause?`, `FK sentence?`, `FK author(User)*`, `body:md*`,
  `thread_root?`, `resolved[bool]`, `created_at`.
- **Cycle de vie** : créé puis éventuellement `resolved` (`POST /comments/{id}/resolve`).

### Review (feature 10)
- **Rôle** : évaluation qualité d'une annotation par un reviewer.
- **Champs clés** : `FK annotation*`, `FK reviewer(User)*`, `score[1..5]*`, `decision`
  (`approve|request_changes|reject`), `rubric:json`, `body:md`, `created_at`.
- **Cycle de vie** : créée en mode revue ; la décision pilote la transition de statut de l'annotation.

---

## 7. Traductions, audit, export (features 8, 4, 5)

### TranslationSet / Translation (feature 8)
- **TranslationSet** : pointeur **file-based** vers un dossier. Champs : `FK corpus*`, `name*`,
  `target_language*`, `folder_path*`, `mapping_strategy`, `status`. Sync via `POST .../sync`.
- **Translation** : `FK translation_set*`, `FK document*`, `FK sentence?`, `text*`, `provenance`.
- **Cycle de vie** : déclaré (`/admin/translations`), synchronisé (mapping), affiché en overlay langue.

### ActivityEvent (feature 4 + tracking)
- **Rôle** : entrée d'**audit trail**. Champs : `FK actor(User)*`, `verb*`, `target_type*`, `target_id*`,
  `payload:json`, `created_at`.
- **Cycle de vie** : émis sur chaque transition/action significative ; **append-only**, jamais modifié.

### ExportJob (feature 5)
- **Rôle** : tâche d'export asynchrone. Champs : `FK project*`, `format`
  (`jsonl|csv|conll|xml|md|huggingface`), `scope:json`, `status`, `artifact_path?`, `manifest:json`,
  `FK requested_by(User)*`, `created_at`.
- **Cycle de vie** : `pending → running → done|failed` ; produit artefact dérivé + manifest reproductible
  (ADR-0002).

---

## Cycle de vie résumé par grande entité

| Entité | Création | Mutation | Fin de vie |
|---|---|---|---|
| Corpus/Document/Sentence/ReferenceLabel | import admin | immuable | suppression owner |
| LabelScheme/Theme/LegalNature | admin (clone) | nouvelle **version** | désactivation (`is_active=false`) |
| Annotation | 1er edit / seed | statut + clauses | `archived` |
| Clause | dans une annotation | PATCH/DELETE | supprimée |
| PreAnnotation/PreClause | import LLM | **immuable** | — |
| AnnotationVersion/ActivityEvent | auto/manuel | **immuable (append-only)** | — |
| Comment | sur clause/phrase | `resolved` | — |
| Review | mode revue | — | — |
| ExportJob | requête export | statut | artefact régénérable |
