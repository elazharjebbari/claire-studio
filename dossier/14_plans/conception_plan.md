# Plan de conception détaillé

> Périmètre : conception de CLAIRE Studio (Django + Next.js/Tailwind, DB-centrique, exports
> fichiers). Source de vérité : `00_overview/CONTRACT.md` (entités, API, pivot), `vocabulary.yaml`,
> `navigation.md`, `feature_traceability.csv` (12 features F1–F12).

## 1. Vision & principes de conception

CLAIRE est un **atelier d'annotation juridique** (pas un site marketing) : profondeur ≤ 3 clics,
workspace 3 panneaux anti-fatigue, navigation clavier (navigation.md). Principes structurants :

1. **Le CONTRACT fait foi** : toute divergence backend/frontend/tests se tranche par le CONTRACT.
2. **Vocabulaire fermé & versionné** : `LabelScheme` rend la plateforme réutilisable multi-corpus
   (F11) ; jamais d'`OTHER_` libre.
3. **DB-centrique, sources/exports fichiers** : la vérité est en base ; les fichiers (import
   CLAUDETTE, pré-annotations auto-pull, traductions, exports) sont des **bords** contrôlés.
4. **Séparation stricte gold humain / pré-annotation LLM / référence CLAUDETTE** (CONTRACT §1).
5. **Audit comme source unique** du « qui a fait quoi » (`ActivityEvent`).
6. **Pivot clause unique** (CONTRACT §4) : import (v9.2/v9.4), versioning, diff, export en dérivent.

## 2. Architecture cible

```
Frontend Next.js (App Router, Tailwind)
  /  /login  /projects/[slug]  /annotate/[id]  /review/[id]  /compare  /history/[id]  /admin/*
        │  REST /api/v1/ (JWT RS256)
        ▼
Backend Django + DRF
  apps : corpora, schemes, projects, annotations, collaboration, imports, exports,
         translations, audit
        │
        ├── PostgreSQL (entités CONTRACT §2, jsonb pour snapshot/payload/manifest)
        ├── Workers (file de jobs) : imports, exports, sync traductions, IAA
        └── Système de fichiers confiné (racines : translations, preannotations, exports)

Observabilité : logs JSON, Prometheus /metrics, traces OTel (11_tracking_observability)
Sécurité : JWT, permissions object-level, path-safety (12_security)
```

## 3. Modèle de données (rappel mapping CONTRACT → apps)

| App | Entités | Features |
|---|---|---|
| `corpora` | Corpus, Document, Sentence, ReferenceLabel | F11, F12 |
| `schemes` | LabelScheme, Theme, LegalNature | F11 |
| `projects` | Project, ProjectMembership, Assignment | F4 |
| `annotations` | Annotation, Clause, AnnotationVersion | F1, F3, F10 |
| `collaboration` | Comment, Review | F9, F10 |
| `imports` | PreAnnotation, PreClause | F2, F12 |
| `exports` | ExportJob (+ manifeste) | F5 |
| `translations` | TranslationSet, Translation | F8 |
| `audit` | ActivityEvent | F4 |

Invariants durs (CONTRACT §2) implémentés en **contraintes DB + validation** et **testés un par un**
(CONTRACT §6) : contiguïté `Sentence.index`, un clause start par phrase, thème ∈ scheme, unicité
`(project,document,annotator)`, transitions de statut → événement (+ version).

## 4. Conception des flux clés

- **Annoter (F1)** : workspace 3 panneaux ; poser frontière (`B`), thème (`T`), certitude (`0–3`),
  commentaire (`C`) ; autosave throttlé + snapshot.
- **Pré-remplir (F2)** : seed depuis `PreAnnotation` (v9.2/v9.4 normalisés au pivot) → brouillon
  éditable, provenance tracée, fantôme des frontières non retenues.
- **Versionner/diff (F3)** : snapshot immuable, diff par `anchor_index`, restauration forward-only.
- **Collaborer/auditer (F4)** : `ActivityEvent`, cloche, dashboard, IAA, anonymisation.
- **Exporter (F5)** : 6 formats + manifeste explicatif, scope filtrable, anonymisation par défaut.
- **Réutiliser (F11)** : nouveau `Corpus` + nouveau `LabelScheme` sans toucher au code métier.

## 5. Conception frontend

- Shell : sidebar contextuelle, top bar (sélecteur projet, ⌘K, cloche, thème), zone admin séparée.
- Workspace : colonne lecture ~70ch, line-height 1.7, thème sombre doux (design system 06).
- État : data fetching typé sur `/api/v1/`, cache par requête, verrouillage optimiste (409 géré).
- Accessibilité : contraste AA (couleurs `vocabulary.yaml`), navigation clavier complète, axe a11y.

## 6. Stratégie de tests (conception → vérif)

- **Unitaires** : un test par invariant CONTRACT §2 ; loaders, normaliseurs, métriques IAA, agrégation
  certitude.
- **Intégration** : flux import→annotation→version→export ; permissions object-level.
- **E2E** (par feature, CONTRACT §6) : `annotate`, `prefill`, `history`, `collaboration`, `export`,
  `translations`, `comments`, `review`, `new-corpus`, `unfairness-overlay`.
- **Sécurité** : `security-review` CI sur diffs sensibles ; path-safety, authz, JWT.

## 7. Décisions de conception (ADR résumés)

| Décision | Choix | Raison |
|---|---|---|
| Snapshot vs delta | snapshot complet immuable | fiabilité restauration, simplicité diff ; coût négligeable (ToS courts) |
| Pivot unique clause | oui (CONTRACT §4) | une seule primitive import/diff/export, moins de bugs |
| File-based traductions/pré-annotations | pointeur + sync idempotent | réutilise les sorties pipeline sans dupliquer la vérité |
| Anonymisation par défaut | oui sur comparatif/IAA/export | RGPD + validité scientifique (anti-biais) |
| Audit append-only source unique | oui | traçabilité non répudiable, pas de doublon d'état |
