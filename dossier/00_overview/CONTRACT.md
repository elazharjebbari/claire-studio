# CONTRACT — Source de vérité partagée

> **Tout module (backend, frontend, tests, seeders) DOIT respecter ce contrat.** En cas de
> divergence, ce fichier fait foi. Versionné : `v1.0` (2026-06-18).

## 1. Glossaire & concepts

- **Corpus** : un jeu de données (ex. `CLAUDETTE-ToS`). Rend la plateforme réutilisable (feature 11).
- **Document** : une pièce du corpus (ex. `Fitbit`). Composé de **phrases** ordonnées.
- **Sentence (phrase)** : unité atomique indexée (`index` 0..N-1), texte tokenisé + texte « propre ».
- **LabelScheme (schéma d'annotation)** : vocabulaire **fermé et versionné** des `themes` et
  `legal_natures`. Configurable par l'admin, attaché à un projet. Cœur de la réutilisabilité.
- **Project (campagne)** : associe un sous-ensemble de documents d'un corpus + un LabelScheme +
  des consignes + des membres. Toute l'annotation se fait dans un projet.
- **Assignment** : attribution d'un document à un annotateur dans un projet.
- **Annotation** : production d'**un** annotateur pour **un** document dans **un** projet (statut +
  certitude globale). Contient des **clauses**.
- **Clause** : segment d'annotation = `{anchor_sentence, theme, legal_nature?, evidence_span,
  rationale, certainty}`. La segmentation dérive des ancres (monotone, comme v9.4).
- **PreAnnotation** : annotation produite par un LLM (`claude`/`codex`), importée (feature 2),
  jamais mélangée au gold humain, utilisable comme **point de départ pré-rempli**.
- **ReferenceLabel** : label natif CLAUDETTE d'injustice (catégorie + niveau) par phrase (feature 12).
- **AnnotationVersion** : snapshot immuable d'une annotation (feature 3 : versioning/historique).
- **Comment** : fil de discussion ancré sur clause/phrase/annotation (feature 9).
- **Review / Rating** : évaluation qualité d'une annotation par un reviewer (feature 10).
- **TranslationSet** : pointeur file-based vers un dossier de traductions (feature 8).
- **ActivityEvent** : entrée d'audit trail (feature 4 + tracking).

## 2. Modèle de données (entités & champs clés)

Notation : `PK`=clé primaire, `FK`=clé étrangère, `*`=obligatoire, `?`=optionnel.

```
User(PK id, *username, *email, *role[annotator|reviewer|admin|owner], display_name?, locale)
Corpus(PK id, *slug, *name, description, source_url, license, default_language)
Document(PK id, *FK corpus, *external_id, *title, language, n_sentences, source_meta:json, checksum)
Sentence(PK id, *FK document, *index, *raw_text, clean_text, char_start?, char_end?)
ReferenceLabel(PK id, *FK sentence, *category[A|CH|CR|J|LAW|LTD|TER|USE|...], *level[1|2|3], source)
LabelScheme(PK id, *slug, *name, *version, is_active, definition:json)   # vocab fermé versionné
Theme(PK id, *FK scheme, *code, *label, color, definition, examples:json, order)
LegalNature(PK id, *FK scheme, *code, *label, definition, order)
Project(PK id, *slug, *name, *FK corpus, *FK scheme, guidelines:md, status, settings:json)
ProjectMembership(PK id, *FK project, *FK user, *role[annotator|reviewer|lead], joined_at)
Assignment(PK id, *FK project, *FK document, *FK assignee(User), status, due_at?)
Annotation(PK id, *FK project, *FK document, *FK annotator(User),
           *status[draft|submitted|in_review|approved|rejected|archived],
           global_certainty[0..3]?, source[human|preannotation_seed], created_at, updated_at)
Clause(PK id, *FK annotation, *FK anchor_sentence(Sentence), *FK theme,
       FK legal_nature?, evidence_span, rationale, certainty[0..3]?, order)
PreAnnotation(PK id, *FK project, *FK document, *judge[claude|codex|other], *schema_version,
              raw:json, imported_at, mapped[bool])
PreClause(PK id, *FK preannotation, *anchor_index, *theme_code, evidence_span, rationale)
AnnotationVersion(PK id, *FK annotation, *number, *snapshot:json, *FK author(User), label?, created_at)
Comment(PK id, *FK annotation, FK clause?, FK sentence?, *FK author(User), *body:md,
        thread_root?, resolved[bool], created_at)
Review(PK id, *FK annotation, *FK reviewer(User), *score[1..5], decision[approve|request_changes|reject],
       rubric:json, body:md, created_at)
TranslationSet(PK id, *FK corpus, *name, *target_language, *folder_path, mapping_strategy, status)
Translation(PK id, *FK translation_set, *FK document, FK sentence?, *text, provenance)
ActivityEvent(PK id, *FK actor(User), *verb, *target_type, *target_id, payload:json, created_at)
ExportJob(PK id, *FK project, *format[jsonl|csv|conll|xml|md|huggingface], scope:json,
          status, artifact_path?, manifest:json, *FK requested_by(User), created_at)
```

**Invariants durs** (testés) :
- `Sentence.index` unique par document, contigu de 0 à `n_sentences-1`.
- `Clause.anchor_sentence` ∈ document de l'annotation ; **un seul clause start par phrase** par annotation.
- `Clause.theme` ∈ themes du `LabelScheme` du projet (vocab fermé — pas de `OTHER_` libre).
- `Annotation` unique par `(project, document, annotator)`.
- Toute transition de statut d'`Annotation` émet un `ActivityEvent` et peut créer une `AnnotationVersion`.
- `certainty` ∈ {0:incertain, 1:plutôt, 2:confiant, 3:certain} (échelle intuitive, feature 10).

## 3. Contrat d'API (REST `/api/v1/`, DRF, JWT)

Conventions : pagination `?page=&page_size=`, filtres `?project=&document=&status=`, tri `?ordering=`.
Codes : 200/201/204 succès, 400 validation, 401 non auth, 403 interdit, 404, 409 conflit (versioning).

```
POST   /api/v1/auth/login            → {access, refresh}
POST   /api/v1/auth/refresh
GET    /api/v1/me

GET    /api/v1/corpora                          # liste corpus
GET    /api/v1/corpora/{slug}/documents         # documents d'un corpus
GET    /api/v1/documents/{id}                   # doc + phrases (+ reference_labels en include)
GET    /api/v1/documents/{id}/sentences

GET    /api/v1/schemes                           # label schemes
GET    /api/v1/schemes/{slug}                    # themes + legal_natures
POST   /api/v1/schemes                           # admin : créer/cloner un schéma

GET    /api/v1/projects                          # projets visibles par l'utilisateur
POST   /api/v1/projects                          # admin
GET    /api/v1/projects/{slug}
GET    /api/v1/projects/{slug}/assignments       # mon plan de travail
GET    /api/v1/projects/{slug}/progress          # avancement + IAA

GET    /api/v1/annotations?project=&document=&annotator=
POST   /api/v1/annotations                       # créer (option seed=preannotation:claude)
GET    /api/v1/annotations/{id}
PATCH  /api/v1/annotations/{id}                  # statut, certitude
POST   /api/v1/annotations/{id}/submit
POST   /api/v1/annotations/{id}/clauses          # ajouter une clause
PATCH  /api/v1/clauses/{id}
DELETE /api/v1/clauses/{id}

GET    /api/v1/annotations/{id}/versions          # historique
POST   /api/v1/annotations/{id}/versions          # snapshot manuel
GET    /api/v1/annotations/{id}/versions/{n}/diff  # diff entre versions

GET    /api/v1/annotations/{id}/comments
POST   /api/v1/annotations/{id}/comments
POST   /api/v1/comments/{id}/resolve

POST   /api/v1/annotations/{id}/reviews           # reviewer
GET    /api/v1/annotations/{id}/reviews

POST   /api/v1/projects/{slug}/preannotations/import   # feature 2 (upload ou pull auto)
GET    /api/v1/preannotations?project=&document=&judge=

GET    /api/v1/projects/{slug}/translations             # feature 8
POST   /api/v1/translations/sets                        # déclarer un dossier source
POST   /api/v1/translations/sets/{id}/sync              # mapping file-based

POST   /api/v1/projects/{slug}/exports                  # feature 5
GET    /api/v1/exports/{id}                             # statut + lien artefact

GET    /api/v1/activity?project=&actor=&verb=           # feature 4 + tracking
```

## 4. Format d'échange « clause » (pivot interne & export)

```json
{
  "doc": "Fitbit",
  "project": "claudette-gold-v1",
  "annotator": "alice",
  "schema": "claire-themes-v1",
  "status": "submitted",
  "global_certainty": 2,
  "clauses": [
    {"anchor_index": 0, "theme": "META", "legal_nature": null,
     "evidence_span": "we recently revised these terms", "rationale": "notice d'ouverture",
     "certainty": 3}
  ],
  "provenance": {"seeded_from": "preannotation:claude@v9.4", "edited": true}
}
```

Ce format est **compatible** avec les pré-annotations existantes : v9.4 (`plan.clauses[].anchor_id`
→ `anchor_index`, `open_span` → `evidence_span`) et v9.2 (`document_plan.segments[].start_id`).
L'import (feature 2) normalise les deux vers ce pivot.

## 5. Vocabulaire (résumé — détail dans `vocabulary.yaml`)

Thèmes (échantillon, vocab fermé v1) : `META, PREAMBLE_SCOPE, PRIVACY_DATA, ELIGIBILITY_ACCOUNT,
ACCEPTABLE_USE, USER_CONTENT, LICENSE_IP, MODIFICATION_OF_TERMS, TERMINATION, WARRANTY_DISCLAIMER,
LIMITATION_LIABILITY, ARBITRATION_DISPUTES, GOVERNING_LAW, THIRD_PARTY_SERVICES, FEES_PAYMENT,
COMMUNICATIONS, FEEDBACK, PROMOTIONS, DMCA, MISC_BOILERPLATE`.

Injustice CLAUDETTE (ReferenceLabel.category) : `A` (arbitration), `CH` (unilateral change),
`CR` (content removal), `J` (jurisdiction), `LAW` (choice of law), `LTD` (limitation of liability),
`TER` (unilateral termination), `USE` (contract by using). Niveaux 1/2/3.

## 6. Conventions de nommage & qualité

- Backend : `snake_case`, apps Django par domaine (`corpora`, `schemes`, `projects`, `annotations`,
  `collaboration`, `imports`, `exports`, `translations`, `audit`).
- Frontend : `PascalCase` composants, `camelCase` hooks/utils, App Router Next.js.
- API : `kebab/snake` cohérent, sérialiseurs versionnés `/api/v1/`.
- Tests : un test par invariant du §2 ; E2E couvrant chaque feature 1→12.
- Qualités cibles : robuste, fiable, évolutif, débogable, modulaire, optimal, fonctionnel, sécurisé
  (déclinées en exigences vérifiables dans `dossier/14_plans/quality_requirements.csv`).
