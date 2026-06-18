# ARCHITECTURE — CLAIRE Studio

> Vue d'ensemble de l'architecture. Source de vérité des entités/endpoints : `00_overview/CONTRACT.md`.
> Ce document explique **comment** le système est structuré et **pourquoi**. Les décisions structurantes
> sont consignées en ADR (`adr/`). Les vues C4 et les séquences sont les `.puml` de ce dossier.

## 1. Vue d'ensemble

CLAIRE Studio est une application web **client-serveur** :

- **Frontend** : Next.js (App Router) + TypeScript + Tailwind. SPA-like avec rendu hybride, consomme
  l'API REST. Cœur : le **workspace 3 panneaux** (`/annotate/[id]`).
- **Backend** : Django + Django REST Framework (DRF), authentification **JWT**, API versionnée
  `/api/v1/`. Découpé en **apps par domaine** (CONTRACT §6) : `corpora`, `schemes`, `projects`,
  `annotations`, `collaboration`, `imports`, `exports`, `translations`, `audit`.
- **Base de données** : PostgreSQL, **source de vérité primaire** (architecture DB-centrique, ADR-0002).
- **Exports fichiers** : artefacts dérivés (jsonl/csv/conll/xml/md/huggingface) produits **à la demande**
  par des `ExportJob` ; les fichiers ne sont jamais l'état faisant foi (ADR-0002).
- **Traductions** : système **file-based** (feature 8) — la DB garde des **pointeurs** (`TranslationSet`)
  vers des dossiers ; le contenu vit en fichiers, synchronisé par mapping.

```
┌──────────────┐    HTTPS/JWT     ┌─────────────────────────────┐     ┌──────────────┐
│ Next.js SPA  │  ───REST v1───▶  │ Django + DRF (apps domaine) │ ──▶ │ PostgreSQL    │ (vérité)
│ (workspace)  │  ◀──JSON──────   │  services métier            │     └──────────────┘
└──────────────┘                  │  + workers async (exports)  │ ──▶  Fichiers exports (dérivés)
                                   │  + lecteurs file-based      │ ◀──  Dossiers traductions (sources)
                                   └─────────────────────────────┘
```

## 2. Choix Django + Next (voir ADR-0001)

- **Django/DRF** : ORM mûr pour un **modèle relationnel riche** (16 entités, invariants durs, contraintes
  d'unicité, FK), migrations, admin intégré pour le bootstrap, écosystème d'auth/permissions robuste.
  Les invariants du CONTRACT §2 (unicité `(project, document, annotator)`, 1 clause-start/phrase, vocab
  fermé) se prêtent à des contraintes DB + validations DRF.
- **Next.js** : App Router pour une IA riche au clavier, streaming/rendu partiel, et un workspace
  interactif performant. Tailwind + design tokens (`06_design_system`) pour l'ergonomie anti-fatigue.
- **Séparation nette** : le frontend ne connaît que le **contrat d'API** (`CONTRACT §3`) ; il peut évoluer
  indépendamment. C'est aussi ce qui permet le **format pivot clause** (CONTRACT §4) comme frontière stable.

## 3. DB-centrique + exports (voir ADR-0002)

- **La base fait foi.** Toute annotation, version, commentaire, review, événement d'audit est en DB.
- **Les exports sont dérivés** : `POST /projects/{slug}/exports` crée un `ExportJob` traité en arrière-plan
  (file d'attente), qui matérialise un artefact + un **manifest** (scope, format, comptes, hash) garant de
  **reproductibilité** et de **traçabilité**. On peut régénérer un export ; on ne réimporte jamais un export
  comme source de vérité.
- **Pourquoi pas file-first ?** Les protocoles LLM passés ont échoué en partie faute de traçabilité et de
  cohérence d'état. Une vérité relationnelle unique + audit trail (`ActivityEvent`) résout ce verrou.
- **Exception assumée** : les **traductions** sont file-based (feature 8, ADR-0002 §conséquences) car ce
  sont des sources externes volumineuses ; la DB n'en garde que des pointeurs et un état de sync.

## 4. Modularité

- **Backend par domaine** (CONTRACT §6) : chaque app possède modèles, serializers, vues, services, tests.
  Les dépendances vont des apps « feuilles » (`corpora`, `schemes`) vers les apps « métier »
  (`annotations`, `collaboration`) puis « périphériques » (`imports`, `exports`, `translations`, `audit`).
- **Couche services** : la logique métier (transition de statut, seed depuis pré-annotation, calcul IAA,
  génération d'export) vit dans des **services** testables, pas dans les vues — débogabilité et réutilisation.
- **Vocab fermé comme module** (`schemes`, ADR-0003) : isolant la réutilisabilité multi-corpus (feature 11).
- **Frontend par feature** : composants du `06_design_system` (ClauseChip, CertaintyPicker, DiffView…)
  réutilisés ; routes alignées sur `navigation.md` ; state local optimiste + cache de requêtes.

## 5. Scalabilité

- **Lecture** : pagination (`?page=&page_size=`), filtres serveur, index DB sur les FK chaudes
  (`Annotation(project, document, annotator)`, `Clause(annotation)`, `Sentence(document, index)`).
- **Écriture d'annotation** : éditions de clause atomiques (`POST/PATCH/DELETE clauses`), auto-save
  optimiste côté client, conflits gérés en 409 (versioning, ADR-0002).
- **Tâches lourdes asynchrones** : exports et imports de pré-annotations en workers, sans bloquer la requête.
- **Corpus volumineux** : un document = liste de phrases indexées chargée en une fois (`GET /documents/{id}`),
  rendu virtualisé côté client pour les longs ToS.
- **Multi-corpus / multi-projet** : isolation par `LabelScheme` et `Project` ; aucune table « globale »
  partagée de thèmes libres (ADR-0003) → pas de contention transverse.

## 6. Observabilité & qualité (transverse, lien dossiers 11–13)

- **Audit trail** (`ActivityEvent`, feature 4) : toute transition de statut émet un événement (invariant
  CONTRACT §2) → journal global `/admin/audit`, cloche d'activité, calcul d'avancement/IAA.
- **Reproductibilité des exports** : manifest signé (hash du périmètre).
- **Tests** (CONTRACT §6) : un test par invariant §2 ; E2E par feature 1→12 ; séquences ci-dessous
  servent de spec exécutable pour `sequence_*.spec`.

## 7. Index des vues de ce dossier

| Fichier | Vue |
|---|---|
| `c4_context.puml` | C4 niveau 1 — contexte (acteurs ↔ système ↔ sources LLM/fichiers) |
| `c4_container.puml` | C4 niveau 2 — conteneurs (SPA, API, DB, workers, fichiers) |
| `c4_component_backend.puml` | C4 niveau 3 — composants des apps Django |
| `sequence_prefill_llm.puml` | Séquence feature 2 — pré-remplissage depuis LLM |
| `sequence_submit_review.puml` | Séquence features 1/10 — soumission puis revue |
| `sequence_export.puml` | Séquence feature 5 — export asynchrone |
| `adr/0001` | Stack Django + Next |
| `adr/0002` | DB-centrique avec exports fichiers |
| `adr/0003` | Schéma de labels fermé et versionné |
