# Seeding — flux de peuplement de la base

> Décrit qui appelle quoi pour peupler une base CLAIRE Studio déterministe, comment réinitialiser
> et pourquoi le seed est **idempotent** (Q-ROB-02). Référence : `scripts/seed_all.sh`,
> `Makefile` (cible `seed`), `dossier/00_overview/CONTRACT.md` (entités §2).

## 1. Chaîne d'appel

```
make seed
   └─> scripts/seed_all.sh                 (orchestration racine, set -euo pipefail)
         ├─ attend que Postgres soit prêt (pg_isready / healthcheck)
         ├─ make migrate                    (s'assure que le schéma est à jour)
         └─ (cd backend && make seed)       (contrat d'orchestration backend)
               └─> commandes Django de seed (management commands), p.ex. :
                     seed_users        → alice, bob (annotator), carol (reviewer), admin (owner)
                     seed_corpus       → Corpus CLAUDETTE-ToS (mini) + Documents + Sentences
                     seed_reference    → ReferenceLabel d'injustice (catégorie + niveau) (F12)
                     seed_scheme       → LabelScheme claire-themes-v1 (Theme + LegalNature, vocab fermé)
                     seed_project      → Project claudette-gold-v1 + ProjectMembership + Assignments
                     seed_preann       → PreAnnotation claude@v9.4 + codex@v9.2 (+ PreClause)  (F2)
                     seed_annotations  → quelques Annotation/Clause d'exemple (draft/submitted)
```

> Le **détail des management commands** appartient au backend (produit par un autre agent). Ce
> document fixe le **contrat** : `cd backend && make seed` doit produire l'état décrit ci-dessous,
> de façon idempotente, sans dépendre d'un ordre d'exécution externe.

## 2. État cible après seed

| Entité | Contenu seedé |
|---|---|
| `User` | `alice`, `bob` (annotator) ; `carol` (reviewer) ; `admin` (owner). Mots de passe de dev. |
| `Corpus` | `CLAUDETTE-ToS` (slug), licence + source_url renseignés. |
| `Document` + `Sentence` | 2–3 documents (ex. `Fitbit`), phrases indexées 0..n-1 contiguës. |
| `ReferenceLabel` | labels d'injustice par phrase (catégorie A/CH/CR/J/LAW/LTD/TER/USE, niveau 1-3). |
| `LabelScheme` | `claire-themes-v1` actif, `Theme` + `LegalNature` (vocab fermé du CONTRACT §5). |
| `Project` | `claudette-gold-v1` (corpus + scheme + guidelines + membres). |
| `Assignment` | quelques documents assignés à alice/bob. |
| `PreAnnotation`/`PreClause` | claude@v9.4 et codex@v9.2 pour au moins un document (F2). |
| `Annotation`/`Clause` | exemples en `draft` et `submitted` (pour history/review/IAA). |

Cet état suffit à faire passer les 12 specs E2E (`e2e_scenarios.md`) et les tests d'intégration.

## 3. Idempotence (Q-ROB-02)

Le seed est **rejouable sans effet de bord** :

- Chaque entité est créée via `get_or_create` / `update_or_create` sur une clé naturelle
  (`slug`, `external_id`, `(project, document, annotator)`, etc.).
- Les fichiers sources (corpus, pré-annotations) sont identifiés par **checksum** : un ré-import
  d'un fichier inchangé = 0 mutation.
- Conséquence vérifiable : **deux exécutions consécutives de `make seed` laissent la DB
  identique** (0 ligne créée/modifiée au 2e passage). C'est testé par `seed-check.yml` (CI
  optionnelle) et coché dans la check-list `RUNBOOK.md §10`.

Vérification manuelle rapide :

```bash
make seed
# noter le nombre d'objets (ex. via un compte SQL ou la sortie du seed)
make seed        # 2e passage
# le décompte doit être strictement identique
```

## 4. Réinitialisation & ré-exécution

| Besoin | Commande |
|---|---|
| Re-seed sur DB existante (idempotent) | `make seed` |
| Repartir d'une DB vierge puis seed | `docker compose down -v && docker compose up -d postgres && make migrate && make seed` |
| Seed dédié aux tests E2E | géré par `scripts/e2e.sh` (DB/segment de test, seed avant Playwright) |

## 5. Données de test vs seed de démo

- **Seed de démo** (`make seed`) : pour le dev local et la démo encadrant — volontairement petit
  et lisible.
- **Fixtures pytest** (`factory_boy`, fichiers bruts CLAUDETTE/pré-annotations) : pour les tests
  unitaires/intégration, indépendantes du seed de démo (cf. `testing_strategy.md §5`).
- **Fixtures partagées API** (`fixtures/api/*.json`) : pour MSW + contract testing
  (cf. `msw_strategy.md`).

Ne pas confondre les trois : aucune fuite de données de test dans le seed de démo, ni
inversement (principe « pas de mélange train/test silencieux » de CLAUDE.md, transposé ici à la
séparation gold humain / pré-annotation LLM / reference labels).
