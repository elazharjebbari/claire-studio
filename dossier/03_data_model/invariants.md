# Invariants durs — CLAIRE Studio

> Les invariants ci-dessous sont **exactement** ceux du CONTRACT §2 (« Invariants durs (testés) »),
> explicités, justifiés, et reliés à leur **mécanisme d'application** (DB / API / service) et à leur
> **test** (CONTRACT §6 : « un test par invariant du §2 »). Aucun invariant n'est inventé hors contrat.

## Principe

Chaque invariant est défendu en **trois couches** :
1. **DB** (contraintes PostgreSQL) — le dernier rempart, infranchissable même en cas de bug applicatif.
2. **Service/API** (validation DRF, transactions) — rejette tôt avec un code clair (400/409).
3. **Frontend** — empêche en amont (palette fermée, désactivation de boutons) pour l'ergonomie, **sans**
   être la source d'autorité.

---

## INV-1 — Index de phrase unique et contigu

> `Sentence.index` unique par document, contigu de 0 à `n_sentences-1`.

- **Pourquoi** : la phrase est l'unité atomique ; l'ancrage des clauses (`anchor_index`/`anchor_sentence`)
  et la compatibilité pivot (CONTRACT §4) supposent une indexation dense, sans trou ni doublon.
- **Application** :
  - DB : contrainte d'unicité `(document_id, index)`.
  - Service : le loader CLAUDETTE (feature 12) vérifie `count(sentences) == n_sentences` et l'ensemble
    `{index} == {0..n_sentences-1}` à l'import (transaction atomique, rollback sinon).
- **Test** : `pytest claudette_loader` — refuse un document avec trou/dup d'index ; vérifie la contiguïté.

## INV-2 — Ancre de clause valide et unique par phrase

> `Clause.anchor_sentence` ∈ document de l'annotation ; **un seul clause-start par phrase** par annotation.

- **Pourquoi** : la segmentation est **monotone** et dérive des ancres (CONTRACT §1) ; deux clauses ne
  peuvent pas démarrer sur la même phrase, et une ancre doit appartenir au bon document.
- **Application** :
  - DB : unicité `(annotation_id, anchor_sentence_id)` ; FK `anchor_sentence` vers `Sentence`.
  - Service : validation que `anchor_sentence.document == annotation.document` (sinon 400).
  - Frontend : poser `B` sur une phrase déjà ancre **déplace/édite** la clause existante, ne crée pas de doublon.
- **Test** : `unit clause-editor` + `pytest` invariant — refuse une 2ᵉ clause-start sur la même phrase ;
  refuse une ancre hors document.

## INV-3 — Thème dans le vocabulaire fermé du schéma (ADR-0003)

> `Clause.theme` ∈ themes du `LabelScheme` du projet (vocab fermé — pas de `OTHER_` libre).

- **Pourquoi** : condition de l'accord inter-annotateur et de la mesurabilité du κ (ADR-0003) ; garantit
  l'isolation multi-corpus (feature 11).
- **Application** :
  - DB : `Theme.scheme` FK ; `Clause.theme` FK vers `Theme` (impossible de référencer un thème inexistant).
  - Service : valide `clause.theme.scheme == annotation.project.scheme` (sinon 400/409).
  - Frontend : la palette de thèmes n'expose **que** les thèmes du scheme du projet ; aucun champ libre.
- **Test** : `pytest scheme_isolation` — un thème d'un autre scheme est rejeté ; aucun thème ne fuit entre projets.

## INV-4 — Unicité de l'annotation par triplet

> `Annotation` unique par `(project, document, annotator)`.

- **Pourquoi** : un annotateur produit **une** annotation par document dans un projet (CONTRACT §1) ;
  base du calcul d'IAA par paire (deux annotateurs distincts du même document).
- **Application** :
  - DB : contrainte d'unicité `(project_id, document_id, annotator_id)`.
  - Service : `POST /annotations` est **idempotent** sur ce triplet — renvoie l'annotation existante
    (ou 409) plutôt que d'en créer une seconde ; le seed (feature 2) respecte la même règle.
- **Test** : `pytest` invariant — double création sur le même triplet refusée.

## INV-5 — Toute transition de statut est tracée (et peut versionner)

> Toute transition de statut d'`Annotation` émet un `ActivityEvent` et peut créer une `AnnotationVersion`.

- **Pourquoi** : traçabilité complète (DB-centrique, ADR-0002), alimentation de l'activité (feature 4),
  de l'avancement et de l'IAA ; protection du gold par snapshots immuables (feature 3).
- **Application** :
  - Service : la transition passe par un **service unique** (`annotations.state_machine`) qui, dans la
    **même transaction**, met à jour `status`, insère un `ActivityEvent` (append-only) et, selon la
    transition, une `AnnotationVersion` (immuable). Pas de transition « hors service ».
  - State machine autorisée : voir `state_machines.puml` (transitions illégales rejetées en 409).
- **Test** : `pytest activity` + `pytest versioning` — chaque transition crée l'événement attendu ;
  les transitions interdites sont refusées ; `AnnotationVersion`/`ActivityEvent` jamais mutés.

## INV-6 — Échelle de certitude bornée et intuitive

> `certainty` ∈ {0:incertain, 1:plutôt, 2:confiant, 3:certain} (feature 10).

- **Pourquoi** : échelle commune, mesurable, partagée par `Clause.certainty` et `Annotation.global_certainty`
  (vocabulary.yaml : emojis + raccourcis 0–3).
- **Application** :
  - DB : `CHECK certainty IN (0,1,2,3)` (et `global_certainty` idem), nullable autorisé (optionnel).
  - Frontend : sélecteur à 4 valeurs + raccourcis clavier `0–3` ; aucune autre valeur saisissable.
- **Test** : `pytest reviews/certainty` — valeur hors {0,1,2,3} refusée ; agrégation globale cohérente.

---

## Invariants dérivés / supports (cohérents avec le contrat, non additionnels)

Ces points ne sont pas de nouveaux invariants mais des **conditions d'application** des six ci-dessus :

- **Immuabilité append-only** de `AnnotationVersion`, `ActivityEvent`, `PreAnnotation`/`PreClause` :
  pas d'UPDATE/DELETE (support de INV-5 et de la non-contamination du gold par les pré-annotations).
- **Atomicité d'import** (corpus, pré-annotations) : tout ou rien (support de INV-1, INV-3).
- **Cohérence de scope d'export** : un `ExportJob` lit l'état faisant foi dans une transaction de lecture
  cohérente ; le manifest fige le périmètre (support de la reproductibilité, ADR-0002).

## Tableau de traçabilité invariant → test

| Invariant | Mécanisme principal | Test (feature_traceability) |
|---|---|---|
| INV-1 index contigu | unicité DB + loader | `pytest claudette_loader` (F12) |
| INV-2 ancre unique/valide | unicité DB + validation | `unit clause-editor`, invariant (F1) |
| INV-3 thème ∈ scheme | FK + validation scheme | `pytest scheme_isolation` (F11) |
| INV-4 annotation unique | unicité DB + idempotence | invariant annotations (F1/F7) |
| INV-5 transition tracée | service state machine + tx | `pytest activity`, `pytest versioning` (F3/F4) |
| INV-6 certitude bornée | CHECK DB + UI | `pytest reviews/certainty` (F10) |
