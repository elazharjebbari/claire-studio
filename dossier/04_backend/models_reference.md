# Models Reference

> Reflète exactement CONTRACT §2. Toutes les contraintes d'unicité et CHECK sont en base.

## accounts
- **User** (AbstractUser) : `username*`, `email*` unique, `role[annotator|reviewer|admin|owner]`,
  `display_name?`, `locale`. `is_admin_role` = admin/owner/superuser.

## corpora
- **Corpus** : `slug*` unique, `name*`, `description`, `source_url`, `license`, `default_language`.
- **Document** : FK `corpus*`, `external_id*`, `title*`, `language`, `n_sentences`,
  `source_meta:json`, `checksum`. Unique `(corpus, external_id)`. Helper `clauses_exist()`.
- **Sentence** : FK `document*`, `index*`, `raw_text*`, `clean_text`, `char_start?`, `char_end?`.
  **Unique `(document, index)`** (INV-1).
- **ReferenceLabel** : FK `sentence*`, `category*` (A|CH|CR|J|LAW|LTD|TER|USE), `level*[1|2|3]`,
  `source`. Unique `(sentence, category)`.

## schemes (vocab fermé versionné)
- **LabelScheme** : `slug*` unique, `name*`, `version*`, `is_active`, `definition:json`.
- **Theme** : FK `scheme*`, `code*`, `label*`, `color`, `definition`, `examples:json`, `order`.
  Unique `(scheme, code)`.
- **LegalNature** : FK `scheme*`, `code*`, `label*`, `definition`, `order`. Unique `(scheme, code)`.

## projects
- **Project** : `slug*` unique, `name*`, FK `corpus*` (PROTECT), FK `scheme*` (PROTECT),
  `guidelines:md`, `status[active|paused|closed]`, `settings:json`.
- **ProjectMembership** : FK `project*`, FK `user*`, `role[annotator|reviewer|lead]`, `joined_at`.
  Unique `(project, user)`.
- **Assignment** : FK `project*`, FK `document*`, FK `assignee*`, `status`, `due_at?`.
  Unique `(project, document, assignee)`.

## annotations
- **Annotation** : FK `project*`, FK `document*`, FK `annotator*`,
  `status[draft|submitted|in_review|approved|rejected|archived]`, `global_certainty[0..3]?`,
  `source[human|preannotation_seed]`, timestamps.
  **Unique `(project, document, annotator)`** (INV-4) ; CHECK `global_certainty in (0,1,2,3)` (INV-6).
- **Clause** : FK `annotation*`, FK `anchor_sentence*` (PROTECT), FK `theme*` (PROTECT),
  FK `legal_nature?`, `evidence_span`, `rationale`, `certainty[0..3]?`, `order`.
  **Unique `(annotation, anchor_sentence)`** (INV-2) ; CHECK certitude (INV-6).
- **AnnotationVersion** (immuable, append-only) : FK `annotation*`, `number*`, `snapshot:json*`,
  FK `author*`, `label?`, `created_at`. Unique `(annotation, number)`.

## collaboration
- **Comment** : FK `annotation*`, FK `clause?`, FK `sentence?`, FK `author*`, `body:md*`,
  `thread_root?` (self), `resolved`, timestamps.
- **Review** : FK `annotation*`, FK `reviewer*`, `score[1..5]*` (CHECK), `decision[approve|request_changes|reject]`,
  `rubric:json`, `body:md`, `created_at`.

## imports (append-only, jamais mélangé au gold)
- **PreAnnotation** : FK `project*`, FK `document*`, `judge[claude|codex|other]*`, `schema_version*`,
  `raw:json`, `imported_at`, `mapped`. Unique `(project, document, judge, schema_version)`.
- **PreClause** : FK `preannotation*`, `anchor_index*`, `theme_code*`, `evidence_span`,
  `rationale`, `order`.

## translations
- **TranslationSet** : FK `corpus*`, `name*`, `target_language*`, `folder_path*`,
  `mapping_strategy`, `status`.
- **Translation** : FK `translation_set*`, FK `document*`, FK `sentence?`, `text*`, `provenance`.
  Unique `(translation_set, document, sentence)`.

## exports
- **ExportJob** : FK `project*`, `format[jsonl|csv|conll|xml|md|huggingface]*`, `scope:json`,
  `status[pending|running|done|failed]`, `artifact_path?`, `manifest:json`, FK `requested_by*`,
  `created_at`.

## audit
- **ActivityEvent** (append-only) : FK `actor*`, `verb*`, `target_type*`, `target_id*`,
  `payload:json`, `created_at`. Index sur `(target_type, target_id)` et `verb`.

## Format pivot d'échange (CONTRACT §4)
`build_snapshot()` / exports produisent :
```json
{"doc","project","annotator","schema","status","global_certainty",
 "clauses":[{"anchor_index","theme","legal_nature","evidence_span","rationale","certainty"}]}
```
