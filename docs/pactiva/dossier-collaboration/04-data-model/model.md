# Modèle de données — Pactiva

> Source de vérité : `backend/claire/*/models.py`. Le diagramme de classes
> correspondant est `04-data-model/data-model.puml` (rendu PlantUML), qui colore
> les trois zones : **Identité & Campagne**, **VRAIE SESSION D'ANNOTATION
> (référence)** et **COLLABORATION (aide — jamais une référence)**.
>
> Vocabulaire : voir `01-besoins/glossaire.md`. Décision fondatrice :
> `02-architecture/decision-record.md` (ADR‑001).

## 1. Lecture en une phrase : « session » vs « collaboration »

Le modèle matérialise **dans la structure des tables** la frontière qui est au
cœur du produit :

- La **session d'annotation** = l'entité **`Annotation`**, unique par
  `(project, document, annotator)` (INV‑4). C'est le travail réel, isolé et
  **possédé** d'un annotateur sur un document. Son contenu (`Clause`) et ses
  instantanés (`AnnotationVersion`) sont **éditables par le seul propriétaire**
  et fondent la **référence** (gold) : seules les `Clause.validated == True`
  comptent.
- La **collaboration** = `Comment`, `Review`, `ShareLink`, `PreAnnotation`
  (+ comparaison N‑way et présence WebSocket, non persistées comme référence).
  Ces entités **aident** à converger mais **n'entrent jamais** dans une
  soumission ni dans un export en tant que donnée de l'annotateur (INV‑COLLAB).

Aucune table « Session » redondante n'existe : ce serait un doublon 1‑1 de
`Annotation` (ADR‑001, alternative B2 écartée). La notion de session est rendue
explicite par l'API (`GET /projects/{slug}/documents` → `mySession`) et par
l'UI, pas par une table.

## 2. Vue d'ensemble des entités

| Zone | Entité | Fichier | Rôle |
|---|---|---|---|
| Identité | `User` | `accounts/models.py` | Compte + rôle plateforme |
| Campagne | `Project` | `projects/models.py` | La campagne (corpus + schéma + membres) |
| Campagne | `ProjectMembership` | `projects/models.py` | Appartenance + rôle projet |
| Campagne | `Corpus` / `Document` / `Sentence` | `corpora/models.py` | Le texte à annoter |
| Campagne | `Assignment` | `projects/models.py` | Intention de travail |
| Vocabulaire | `LabelScheme` / `Theme` / `LegalNature` | `schemes/models.py` | Vocabulaire fermé et versionné |
| **Session** | **`Annotation`** | `annotations/models.py` | **La session (référence)** |
| Session | `Clause` | `annotations/models.py` | Une annotation de phrase |
| Session | `AnnotationVersion` | `annotations/models.py` | Instantané immuable |
| Collaboration | `Comment` | `collaboration/models.py` | Fil de discussion |
| Collaboration | `Review` | `collaboration/models.py` | Revue qualité |
| Collaboration | `ShareLink` | `collaboration/models.py` | Invitation révocable |
| Collaboration | `PreAnnotation` / `PreClause` | `imports/models.py` | Pré‑annotation LLM (seed) |
| Transverse | `ActivityEvent` | `audit/models.py` | Journal append‑only |
| Transverse | `ExportJob` | `exports/models.py` | Travail d'export |

---

## 3. Identité & Campagne

### `User` — `accounts/models.py:17`

- **Rôle métier** : compte authentifié. `role` (`accounts/models.py:20`) porte
  le rôle plateforme `annotator|reviewer|admin|owner` ; la propriété
  `is_admin_role` (`accounts/models.py:34`) factorise « admin/owner/superuser »
  et conditionne la supervision.
- **Champs clés** : `email` unique (`accounts/models.py:19`), `display_name`,
  `locale`, `is_email_verified` (vérification e‑mail, chantier E,
  `accounts/models.py:26`).
- **Relations** : 1‑N vers `ProjectMembership`, `Assignment`, `Annotation`
  (en tant qu'`annotator`), `Comment`, `Review`.

### `Project` (la **Campagne**) — `projects/models.py:22`

- **Rôle métier** : la campagne d'annotation (glossaire : « Campagne »). Lie un
  `Corpus`, un `LabelScheme`, des membres et des assignations.
- **Champs clés** : `slug` unique (`projects/models.py:23`), `status`
  (`active|paused|closed`), `visibility` (`private` par défaut — RGPD, chantier
  F, `projects/models.py:37`), `guidelines` (markdown), `settings` (JSON).
- **Relations** : FK `PROTECT` vers `Corpus` et `LabelScheme`
  (`projects/models.py:25-30`) — on ne supprime pas un corpus/schéma utilisé.
- **Contraintes** : pas de contrainte composite (slug unique suffit).

### `ProjectMembership` — `projects/models.py:57`

- **Rôle métier** : qui appartient à la campagne et avec quel rôle **projet**
  `annotator|reviewer|lead` (`projects/models.py:51`). Base de l'isolation
  projet (`common/permissions.py:6` `is_project_member`).
- **Contrainte** : `UniqueConstraint(project, user)` —
  `uniq_membership_project_user` (`projects/models.py:73`).

### `Corpus` / `Document` / `Sentence` — `corpora/models.py`

- **`Corpus`** (`corpora/models.py:12`) : ensemble documentaire (slug unique,
  licence, langue par défaut).
- **`Document`** (`corpora/models.py:28`) : un texte du corpus (un ToS
  CLAUDETTE). **Apparaît une seule fois** par campagne (INV‑DOC‑UNIQUE côté
  présentation).
  - **Champs clés** : `external_id`, `title`, `n_sentences`, `checksum`,
    `source_meta` (JSON).
  - **Contrainte** : `UniqueConstraint(corpus, external_id)` —
    `uniq_document_corpus_external` (`corpora/models.py:41`). C'est l'ancrage
    physique du « 1 document = 1 ligne ».
  - Helper `clauses_exist()` (`corpora/models.py:50`).
- **`Sentence`** (`corpora/models.py:59`) : phrase indexée (`index`,
  `raw_text`, `clean_text`, `char_start/end`). Unité d'annotation (C4 :
  annotation **par phrase**).
  - **Contrainte** : `UniqueConstraint(document, index)` —
    `uniq_sentence_document_index` (`corpora/models.py:72`) → INV‑1.
- **`ReferenceLabel`** (`corpora/models.py:82`) : label natif CLAUDETTE
  (catégorie/niveau d'iniquité) par phrase ; donnée de corpus, **pas** une
  annotation utilisateur. Contrainte `UniqueConstraint(sentence, category)`
  (`corpora/models.py:93`).

### `Assignment` (l'**Assignation**) — `projects/models.py:88`

- **Rôle métier** : **intention** de travail (« cet annotateur doit annoter ce
  document »). Optionnelle : on peut annoter sans assignation. **N'est pas** la
  session ni le contenu (glossaire).
- **Champs clés** : `status` (`pending|in_progress|done`), `due_at`.
- **Contrainte** : `UniqueConstraint(project, document, assignee)` —
  `uniq_assignment_project_doc_assignee` (`projects/models.py:107`).

---

## 4. Vocabulaire fermé — `schemes/models.py`

- **`LabelScheme`** (`schemes/models.py:11`) : schéma versionné (`slug` unique,
  `version`, `is_active`, `definition` JSON).
- **`Theme`** (`schemes/models.py:25`) : catégorie d'annotation (`code`,
  `label`, `color`, `definition`, `examples`, `order`).
  - **Contrainte** : `UniqueConstraint(scheme, code)` —
    `uniq_theme_scheme_code` (`schemes/models.py:38`).
- **`LegalNature`** (`schemes/models.py:48`) : nature juridique optionnelle.
  Contrainte `UniqueConstraint(scheme, code)` (`schemes/models.py:59`).

Le couplage `Theme → scheme` est la base de **INV‑3** : une `Clause` ne peut
porter qu'un thème **du schéma du projet** (vérifié au serializer ;
cf. `tests/test_invariants.py::test_inv3_*`).

---

## 5. VRAIE SESSION D'ANNOTATION (référence)

### `Annotation` — la **session** — `annotations/models.py:35`

- **Rôle métier** : le travail réel et **isolé** d'**un** annotateur sur **un**
  document, **lui appartenant** (glossaire : « Session d'annotation »). C'est
  l'unité éditable, la base de l'IAA et de l'export.
- **Champs clés** :
  - `project`, `document`, `annotator` (FK `CASCADE`,
    `annotations/models.py:36-45`) — le triplet qui définit la session.
  - `status` (`annotations/models.py:46`) : `draft → submitted → in_review →
    approved/rejected → archived` (machine d'états dans
    `annotations/services.py:22` `ALLOWED_TRANSITIONS`, INV‑5).
  - `global_certainty` 0..3 (`annotations/models.py:50`, INV‑6).
  - `source` (`annotations/models.py:54`) : `human` ou `preannotation_seed`.
    Trace si la session a été **amorcée** depuis un seed LLM ; reste **la
    session de l'humain** (la provenance n'en fait pas une référence externe).
- **Relations** : 1‑N vers `Clause`, `AnnotationVersion`, `Comment`, `Review`.
- **Contraintes** :
  - **`UniqueConstraint(project, document, annotator)`** —
    `uniq_annotation_project_doc_annotator` (`annotations/models.py:62`) →
    **INV‑4**. C'est l'ancrage du « 1 session par (annotateur, document) ».
  - `CheckConstraint` certitude ∈ {null,0,1,2,3} —
    `ck_annotation_global_certainty_range` (`annotations/models.py:67`).
- **Propriété (session vs collaboration)** : `annotator` est le **propriétaire
  exclusif** en écriture (`IsAnnotationOwner`, `common/permissions.py:60`).
  Même un admin ne peut éditer le contenu d'autrui (INV‑ISO).

### `Clause` — `annotations/models.py:79`

- **Rôle métier** : une annotation au niveau d'une phrase (thème + preuve +
  rationale + certitude). C'est la matière de la session.
- **Champs clés** :
  - `anchor_sentence` (FK `PROTECT`, `annotations/models.py:83`),
    `theme` (`PROTECT`), `legal_nature` (`SET_NULL`).
  - `evidence_span`, `rationale`, `certainty` 0..3, `order`.
  - **`validated`** (`annotations/models.py:103`) : validation **humaine
    explicite** (point d). **Seule une clause `validated=True` fait
    référence** : une pré‑annotation adoptée mais non revalidée ne compte pas.
  - `client_op_id` (`annotations/models.py:107`) : idempotence des écritures
    (chantier C) — un retry réseau ne crée pas de doublon.
- **Contraintes** :
  - `UniqueConstraint(annotation, anchor_sentence)` —
    `uniq_clause_annotation_anchor` (`annotations/models.py:112`) → **INV‑2**
    (un seul début de clause par phrase par session).
  - `UniqueConstraint(annotation, client_op_id)` **partielle** (op_id non vide)
    — `uniq_clause_client_op` (`annotations/models.py:118`).
  - `CheckConstraint` certitude — `ck_clause_certainty_range`
    (`annotations/models.py:124`, INV‑6).

### `AnnotationVersion` — `annotations/models.py:136`

- **Rôle métier** : instantané **immuable** (append‑only) d'une session, pris
  notamment à la soumission/approbation (`SNAPSHOTTING_TRANSITIONS`,
  `annotations/services.py:40`). Sert l'historique et le diff.
- **Champs clés** : `number`, `snapshot` (JSON produit par `build_snapshot`,
  `annotations/services.py:47` — inclut `source`, `validated`, `order`,
  `updated_at`), `author` (`PROTECT`), `label`.
- **Contrainte** : `UniqueConstraint(annotation, number)` —
  `uniq_version_annotation_number` (`annotations/models.py:153`).

---

## 6. COLLABORATION (aide — jamais une référence)

> Règle structurante (INV‑COLLAB) : ces entités **n'apparaissent jamais** comme
> donnée de référence d'une session ni dans un export d'annotateur. L'export ne
> lit que des `Annotation` (`exports/services.py:26` `_selected_annotations`),
> jamais un `Comment`/`Review`/`PreAnnotation`.

### `Comment` — `collaboration/models.py:14`

- **Rôle métier** : fil de discussion attaché à une session (`annotation`), et
  optionnellement à une `clause` ou une `sentence` (portée document/clause/
  phrase). `thread_root` (self‑FK) pour les réponses ; `resolved`.
- **Isolation** : `CommentViewSet.get_queryset` (`collaboration/views.py:19`)
  ne renvoie que les commentaires des **projets dont on est membre** (ou les
  siens) ; admin/reviewer ont la portée transverse.
- Pas de contrainte d'unicité (un fil peut avoir plusieurs messages).

### `Review` — `collaboration/models.py:50`

- **Rôle métier** : revue qualité d'une session par un reviewer (`score` 1..5,
  `decision` `approve|request_changes|reject`, `rubric` JSON, `body`).
- **Frontière session/collab** : le reviewer agit via `Review`/`Comment` et la
  machine d'états, **jamais** en éditant les `Clause` (cf. docstring
  `IsAnnotationOwner`, `common/permissions.py:64`).
- **Contrainte** : `CheckConstraint` score ∈ [1,5] — `ck_review_score_range`
  (`collaboration/models.py:69`).

### `ShareLink` — `collaboration/models.py:84`

- **Rôle métier** : invitation **persistée, révocable, expirable, à quota**
  (chantier D). À l'ouverture, l'utilisateur **authentifié** rejoint le projet
  (jamais d'accès anonyme).
- **Champs clés** : `token` unique (`collaboration/models.py:94`),
  `role_granted` (`annotator|reviewer`), `expires_at`, `max_uses`,
  `used_count`, `revoked`. Helpers `is_expired/is_exhausted/is_usable`
  (`collaboration/models.py:110-117`).

### `PreAnnotation` / `PreClause` — `imports/models.py`

- **`PreAnnotation`** (`imports/models.py:19`) : pré‑annotation LLM (seed),
  **append‑only, jamais mélangée au gold humain** (docstring `imports/models.py:1`).
  Sert de point de départ pré‑rempli (« fantôme » / comparaison N‑way).
  - **Champs clés** : `judge` (`claude|codex|mistral|other`,
    `imports/models.py:12`), `schema_version`, `raw` (JSON brut), `mapped`.
  - **Contrainte** : `UniqueConstraint(project, document, judge,
    schema_version)` — `uniq_preannotation_proj_doc_judge_version`
    (`imports/models.py:34`).
- **`PreClause`** (`imports/models.py:45`) : clauses du seed (`anchor_index`,
  `theme_code`, `evidence_span`, `rationale`, `order`). **Structure distincte
  de `Clause`** (codes/index bruts, non liés au schéma du projet) — preuve
  qu'une pré‑annotation n'est pas une donnée de référence.
- **Lien avec la session** : à l'ouverture, `createAnnotation({seed:
  preannotation:<judge>})` **copie** le seed dans une nouvelle `Annotation`
  `source=preannotation_seed` (`annotations/views.py:125`). L'humain doit
  ensuite **valider** (`Clause.validated`) pour que cela fasse référence.

---

## 7. Transverse

### `ActivityEvent` — `audit/models.py:7`

- **Rôle métier** : journal **append‑only** (`actor`, `verb`, `target_type`,
  `target_id`, `payload`). Émis par `transition_status` à chaque changement
  d'état (INV‑5).
- **Index** : `(target_type, target_id)` et `(verb)` (`audit/models.py:20`).
- **Isolation** : `ActivityEventViewSet.get_queryset` (`audit/views.py:18`)
  limite l'annotateur à l'activité de **ses** projets / ses propres actions.

### `ExportJob` — `exports/models.py:26`

- **Rôle métier** : un export multi‑format (`jsonl|csv|conll|xml|md|huggingface|
  iaa_matrix`, `exports/models.py:9`).
- **Champs clés** : `scope` (JSON : `statuses`, `documents`, **`annotators`**),
  `manifest` (JSON : `format_requested/format_effective/warnings`),
  `artifact_path`, `status`.
- **Frontière référence** : `_selected_annotations` (`exports/services.py:26`)
  ne sélectionne par défaut que les sessions **gold‑grade**
  (`submitted|in_review|approved`, `exports/services.py:37`) et le champ
  `validated` est tracé par clause (`exports/services.py:66`). Aucune table de
  collaboration n'est exportée.

---

## 8. Schéma relationnel (résumé)

```
User ─1─*─ ProjectMembership ─*─1─ Project ─1─ Corpus ─1─*─ Document ─1─*─ Sentence
                                      │  └─1─ LabelScheme ─1─*─ Theme / LegalNature
                                      ├─*─ Assignment ─(doc, assignee)
                                      │
                  ┌── SESSION ────────┤
                  │  Annotation ──(project,document,annotator) UNIQUE   [INV-4]
                  │   ├─*─ Clause ──(annotation,anchor_sentence) UNIQUE [INV-2]
                  │   └─*─ AnnotationVersion (immuable)
                  │
                  └── COLLABORATION (jamais référence) ── Comment / Review / ShareLink
                                      └─*─ PreAnnotation ─*─ PreClause (seed LLM)
```

Diagramme détaillé et colorisé : **`04-data-model/data-model.puml`**.
