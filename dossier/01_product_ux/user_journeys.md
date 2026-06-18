# User Journeys — CLAIRE Studio

> Quatre parcours canoniques, chacun tracé jusqu'aux endpoints du CONTRACT §3 et aux features
> (feature_traceability.csv). Chaque étape note : acteur, surface (route), action UI, appel API,
> effet de données (entités CONTRACT §2), invariant déclenché. Les `ActivityEvent` sont émis à chaque
> transition de statut (invariant CONTRACT §2).

---

## J1 — Annoter un document **de zéro** (feature 1)

**Acteur** : Salma (annotator). **Objectif** : produire une `Annotation` `submitted` propre.

| # | Surface | Action | API | Effet données |
|---|---|---|---|---|
| 1 | `/` | « Reprendre » ou choisir un projet | `GET /me`, `GET /projects` | — |
| 2 | `/projects/[slug]` | Voir ses assignations | `GET /projects/{slug}/assignments` | lit `Assignment` |
| 3 | `/projects/[slug]/docs` | Ouvrir un doc non commencé | `GET /documents/{id}` (+ `reference_labels` en include) | charge `Document`+`Sentence[]`+`ReferenceLabel[]` |
| 4 | `/annotate/[id]` | Création implicite de l'annotation au 1er edit | `POST /annotations` (`source=human`) | crée `Annotation` `status=draft` → `ActivityEvent(verb=created)` |
| 5 | workspace | `j/k` lecture, `B` sur la phrase d'ancre | local (optimiste) | sélection ancre |
| 6 | workspace | `T` → palette de thèmes colorée, frappe au clavier | `POST /annotations/{id}/clauses` | crée `Clause{anchor_sentence, theme, order}` — **invariant : 1 seul start/phrase, theme ∈ scheme** |
| 7 | inspecteur | nature juridique (optionnel), `evidence_span` (sélection texte), `rationale` | `PATCH /clauses/{id}` | enrichit `Clause` |
| 8 | inspecteur | certitude `0–3` au clavier | `PATCH /clauses/{id}` (`certainty`) | maj `Clause.certainty` |
| 9 | workspace | répète 5–8 ; segmentation **monotone** dérivée des ancres | — | `Clause[]` ordonnées |
| 10 | top bar | `⌘S` snapshot manuel (optionnel) | `POST /annotations/{id}/versions` | `AnnotationVersion` immuable |
| 11 | workspace | « Soumettre » | `POST /annotations/{id}/submit` | `Annotation.status: draft→submitted` + `ActivityEvent` + `AnnotationVersion` auto |
| 12 | `g d` | document suivant | retour étape 3 | — |

**Garde-fous** : le vocab fermé empêche un thème hors-scheme (409/400). La certitude globale
(`Annotation.global_certainty`) peut être posée à la soumission ou agrégée des clauses (feature 10).
**État vide** : 1er document → tour guidé léger non bloquant (navigation.md §5).

```
draft ──(POST submit)──▶ submitted
  ▲ auto-save clauses        │
  └── édition libre          └── snapshot auto (version)
```

---

## J2 — **Pré-remplir depuis un LLM** puis corriger (feature 2)

**Acteur** : Salma (annotator). **Pré-requis** : l'admin a importé des `PreAnnotation` (J4 / `/admin/preannotations`).

| # | Surface | Action | API | Effet données |
|---|---|---|---|---|
| 1 | `/annotate/[id]` | Bouton « Pré-remplir depuis Claude / Codex » | `POST /annotations` (`seed=preannotation:claude`) | crée `Annotation` `source=preannotation_seed`, clauses dérivées des `PreClause` |
| 2 | backend | mapping pivot : `PreClause.anchor_index → Clause.anchor_sentence`, `theme_code → theme`, `evidence_span`, `rationale` | (serveur) | clauses **brouillon éditables**, provenance `seeded_from` |
| 3 | workspace | les frontières LLM non retenues restent en **fantôme** (overlay) | `GET /preannotations?judge=` | rendu fantôme (lecture) |
| 4 | inspecteur | l'annotatrice **accepte / corrige / supprime** chaque clause | `PATCH /clauses/{id}`, `DELETE /clauses/{id}`, `POST .../clauses` | provenance `edited=true` dès modification |
| 5 | inspecteur | « Diff vs LLM » montre ce qui a changé | (calcul client + `GET /preannotations`) | aide à la décision |
| 6 | workspace | soumission | `POST /annotations/{id}/submit` | comme J1 ; provenance conservée dans le snapshot |

**Invariant clé** : pré-annotation **jamais mélangée** au gold humain (CONTRACT §1). Le seed crée des
`Clause` humaines tracées (`source=preannotation_seed`, `provenance.seeded_from`), les `PreAnnotation`
restent immuables côté import. Compatibilité v9.2 (`document_plan.segments[].start_id`) et v9.4
(`plan.clauses[].anchor_id → anchor_index`, `open_span → evidence_span`) normalisée à l'import.

```
PreAnnotation(claude@v9.4)  ──seed──▶  Annotation(source=preannotation_seed)
        │ immuable                          │ éditable → edited=true
        └── reste en overlay "fantôme"      └── submit → gold humain
```

---

## J3 — **Réviser** une annotation soumise (features 9, 10)

**Acteur** : Marc (reviewer).

| # | Surface | Action | API | Effet données |
|---|---|---|---|---|
| 1 | `/projects/[slug]` | file des annotations `submitted` | `GET /annotations?project=&status=submitted` | liste |
| 2 | `/review/[id]` | lecture seule du workspace + certitudes + rationales | `GET /annotations/{id}` | lit `Annotation`+`Clause[]` |
| 3 | (option) passe `submitted→in_review` à l'ouverture | `PATCH /annotations/{id}` (`status=in_review`) | `ActivityEvent` |
| 4 | inspecteur | comparer à la pré-annotation / autre annotateur | `GET .../versions/{n}/diff`, `/compare` | diff |
| 5 | clause litigieuse | `C` commentaire ancré | `POST /annotations/{id}/comments` (`clause` FK) | crée `Comment` (fil, `thread_root`) |
| 6 | formulaire review | score `1–5` + décision + rubrique + corps md | `POST /annotations/{id}/reviews` | crée `Review` |
| 7a | décision `approve` | | `PATCH /annotations/{id}` (`status=approved`) | `in_review→approved` + `ActivityEvent` + version |
| 7b | décision `request_changes` | | `PATCH` (`status=rejected`) ou retour `draft` selon politique | boucle vers annotateur |
| 8 | fil | l'annotateur répond, le reviewer résout | `POST /comments/{id}/resolve` | `Comment.resolved=true` |

**Boucle fermée** : `request_changes/reject` renvoie l'annotation à l'annotateur (notification cloche,
`ActivityEvent`), qui corrige et re-soumet. Le reviewer **ne segmente jamais** (navigation.md §4).

---

## J4 — **Importer un corpus, configurer, exporter** (features 11, 5, 12, 2)

**Acteur** : Karim (admin/owner). Parcours de bout en bout pour rendre la plateforme opérationnelle.

| # | Surface | Action | API | Effet données |
|---|---|---|---|---|
| 1 | `/admin/corpora` | importer CLAUDETTE-ToS | (loader, feature 12) | `Corpus`, `Document[]`, `Sentence[]`, `ReferenceLabel[]` |
| 2 | `/admin/schemes` | créer/cloner `LabelScheme` (vocab **fermé versionné**) | `POST /schemes` | `LabelScheme`+`Theme[]`+`LegalNature[]` |
| 3 | `/admin/projects` | créer la campagne (corpus + scheme + consignes + membres) | `POST /projects` | `Project`, `ProjectMembership[]`, `Assignment[]` |
| 4 | `/admin/preannotations` | importer pré-annotations LLM v9.2/v9.4 | `POST /projects/{slug}/preannotations/import` | `PreAnnotation`+`PreClause[]`, `mapped=true` |
| 5 | `/admin/translations` | déclarer dossier de traductions (file-based) | `POST /translations/sets` + `POST .../sync` | `TranslationSet`+`Translation[]` |
| 6 | (annotation) | les annotateurs/reviewers font J1–J3 | — | `Annotation[]` gold |
| 7 | `/projects/[slug]` | suivre avancement + IAA (κ) | `GET /projects/{slug}/progress` | lit `ActivityEvent`, agrège |
| 8 | `/admin/exports` | exporter (jsonl/csv/conll/xml/md/huggingface) | `POST /projects/{slug}/exports` | crée `ExportJob` (async) |
| 9 | `/admin/exports` | suivre le job + récupérer l'artefact | `GET /exports/{id}` | `ExportJob.status`, `artifact_path`, `manifest` |
| 10 | `/admin/audit` | journal global | `GET /activity?project=&actor=&verb=` | lit `ActivityEvent[]` |

**Réutilisabilité (feature 11)** : un nouveau corpus = répéter 1→3 avec un autre `Corpus` et un
`LabelScheme` cloné/versionné, **sans toucher au code**. L'isolation scheme garantit qu'un `Theme` d'un
projet n'apparaît jamais dans un autre.

---

## Carte d'enchaînement des journeys

```
       J4 (admin: corpus + scheme + projet + preannotations)
                 │
        ┌────────┴─────────┐
        ▼                  ▼
  J1 (annoter de zéro)  J2 (pré-remplir LLM)
        │                  │
        └────────┬─────────┘   submit
                 ▼
         J3 (revue + notation)
                 │ approve
                 ▼
       J4.8 (export gold multi-format)
```

## Émotions & points de friction à surveiller (UX research)

- **J1 étape 6–8** : si poser thème+certitude demande la souris, on perd le power-user → tout au clavier.
- **J2 étape 4** : l'annotatrice doit *sentir* qu'elle reste maîtresse (le LLM est un brouillon, pas une vérité).
- **J3 étape 5–6** : le reviewer veut commenter et trancher dans le même écran, sans aller-retour.
- **J4 étape 8–9** : l'export doit être **traçable** (manifest) et reproductible, jamais une boîte noire.
