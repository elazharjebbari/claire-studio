# ADR 0002 — Architecture DB-centrique avec exports fichiers

- Statut : **Accepté**
- Date : 2026-06-18
- Décideurs : architecte plateforme, lead backend, responsable données/recherche
- Contexte de référence : `00_overview/CONTRACT.md` §2/§4, `README.md`

## Contexte et problème

Les protocoles LLM antérieurs (V8/V9.2/V9.4) produisaient des **fichiers** (plans JSON par document) sans
état faisant foi unique, sans audit ni versioning cohérent — un facteur de l'effondrement à l'échelle
(κ ≈ 0,32–0,45). CLAIRE Studio doit fournir un gold **traçable, versionné, auditable**, tout en restant
**interopérable** avec l'écosystème fichiers (exports pour la recherche, traductions externes). Où placer
la **source de vérité** : dans des fichiers, ou dans une base de données ?

## Options envisagées

1. **DB-centrique** : PostgreSQL fait foi ; les fichiers sont des **exports dérivés** + des **sources
   externes pointées** (traductions).
2. **File-first** : des fichiers JSON par annotation/document font foi ; la DB n'est qu'un index/cache.
3. **Hybride symétrique** : double écriture DB↔fichiers avec synchronisation bidirectionnelle.

## Décision

Adopter l'**option 1 — DB-centrique**. PostgreSQL est la **source de vérité primaire** pour toutes les
entités du CONTRACT §2. Les **fichiers d'export** (jsonl/csv/conll/xml/md/huggingface) sont **dérivés à la
demande** via des `ExportJob` asynchrones produisant un **artefact + manifest**. Les **traductions**
(feature 8) sont l'**unique exception file-based** : la DB ne stocke que des **pointeurs** (`TranslationSet`)
et un état de synchronisation, le contenu restant en dossiers.

## Justification

- **Traçabilité / audit** : toute transition de statut émet un `ActivityEvent` (invariant CONTRACT §2) ;
  versions immuables (`AnnotationVersion`) ; commentaires et reviews liés. Impossible à garantir en file-first.
- **Invariants** : unicité, vocab fermé, contiguïté des index — exprimables en contraintes DB, illusoires
  sur des fichiers concurrents.
- **Concurrence** : multi-annotateur + reviewer → besoin de verrous/transactions et de gestion de conflit
  (HTTP 409, versioning) ; impraticable proprement en file-first ou en double-écriture.
- **Interopérabilité préservée** : le **format pivot clause** (CONTRACT §4) garantit que tout ce qui était
  fichier (v9.2/v9.4) entre par l'import (feature 2) et ressort par l'export (feature 5) — sans faire de
  fichier la vérité.
- **Reproductibilité recherche** : le manifest d'export (scope, format, comptes, hash) rend un gold export
  régénérable et citable.
- **Traductions en exception** : volumineuses, externes, peu mutables → file-based + pointeurs DB évite de
  gonfler la base et respecte la feature 8 ; le mapping (`/sync`) reste auditable.

## Conséquences

**Positives** : vérité unique, audit complet, invariants garantis, exports reproductibles, concurrence sûre.

**Négatives / coûts** : besoin de workers asynchrones (exports/imports) et d'un stockage d'artefacts ;
les consommateurs « fichiers » doivent passer par l'export (pas d'accès direct à un fichier source) ;
l'exception traductions introduit un chemin file-based à surveiller (état de sync, dérive possible) —
mitigée par `POST /translations/sets/{id}/sync` et un statut explicite.

**Règle d'or** : *on régénère un export, on ne réimporte jamais un export comme source de vérité.*

**Liens** : ADR-0001, ADR-0003, `ARCHITECTURE.md §3`, séquence `sequence_export.puml`.
