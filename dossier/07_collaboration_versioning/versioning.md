# Versioning & historique des annotations

> Périmètre : feature **F3** (navigation fichiers + versioning + historique). Source de vérité :
> CONTRACT §2 (`AnnotationVersion`) et §3 (endpoints `/versions`, `/versions/{n}/diff`).
> Surface frontend : `/history/[annotationId]` (timeline + diff), `/compare` (comparaison).

## 1. Modèle de snapshot

```
AnnotationVersion(PK id, *FK annotation, *number, *snapshot:json, *FK author(User), label?, created_at)
```

- `number` est **monotone, contigu, par annotation**, démarrant à 1. Contrainte d'unicité
  `(annotation, number)`. Le numéro est alloué dans la même transaction que l'écriture (verrou de
  ligne sur l'`Annotation`) pour éviter les trous et les collisions.
- `snapshot` est l'**état complet** de l'annotation au format pivot « clause » (CONTRACT §4), pas un
  delta. Le snapshot est **immuable** : aucune route ne le mute après création. Ce choix privilégie
  la fiabilité de restauration et la simplicité du diff au prix d'un peu d'espace (un ToS = quelques
  dizaines de clauses, coût négligeable ; compression `jsonb` PostgreSQL).
- `author` = l'utilisateur ayant déclenché le snapshot (l'annotateur lui-même, ou un système lors
  d'une transition de statut). `label?` = étiquette libre optionnelle (« avant revue », « v2
  post-commentaires »).

Forme du `snapshot` (réutilise exactement le pivot §4, augmenté de métadonnées de version) :

```json
{
  "version": {"number": 3, "label": "avant soumission", "author": "alice",
              "created_at": "2026-06-18T10:32:00Z", "reason": "submit"},
  "doc": "Fitbit", "project": "claudette-gold-v1", "annotator": "alice",
  "schema": "claire-themes-v1", "status": "submitted", "global_certainty": 2,
  "clauses": [
    {"anchor_index": 0, "theme": "META", "legal_nature": null,
     "evidence_span": "we recently revised these terms", "rationale": "notice d'ouverture",
     "certainty": 3}
  ],
  "provenance": {"seeded_from": "preannotation:claude@v9.4", "edited": true}
}
```

## 2. Quand un snapshot est-il créé ?

Politique en couches, pour ne pas saturer l'historique tout en garantissant la traçabilité :

| Déclencheur | Création | `reason` | `ActivityEvent` |
|---|---|---|---|
| Snapshot manuel (⌘S, `POST /versions`) | toujours | `manual` | `version.created` |
| Transition de statut (`submit`, `approve`, `reject`, `archive`) | toujours | `<status>` | `annotation.<verb>` + `version.created` |
| Édition de clause | **autosave throttlé** (≥ 1 snapshot / N minutes d'activité, configurable `Project.settings.versioning.autosave_interval_min`, défaut 10) | `autosave` | — (l'événement d'édition suffit) |
| Restauration | snapshot du **nouvel état** appliqué | `restore_from:{n}` | `version.restored` |

Invariant (CONTRACT §2) : *toute transition de statut peut créer une `AnnotationVersion`* — ici
« peut » est rendu déterministe : transitions ⇒ snapshot systématique ; éditions ⇒ snapshot throttlé.

## 3. Diff entre versions

`GET /api/v1/annotations/{id}/versions/{n}/diff?against={m}` (défaut `against = n-1`).

Le diff est calculé sur la **liste de clauses indexée par `anchor_index`** (clé naturelle stable :
une seule clause start par phrase, invariant CONTRACT §2). Algorithme :

1. Aligner les clauses des deux snapshots par `anchor_index`.
2. Pour chaque ancre, classer en :
   - `added` : présente dans la cible, absente de la base (nouvelle frontière de clause) ;
   - `removed` : présente dans la base, absente de la cible (frontière supprimée) ;
   - `modified` : même ancre, changement sur `{theme, legal_nature, evidence_span, rationale,
     certainty}` — le diff liste les champs modifiés avec `from`/`to` ;
   - `unchanged` : identique.
3. Diffs scalaires d'en-tête : `status`, `global_certainty`, `schema`.

Réponse :

```json
{
  "base": {"number": 2}, "target": {"number": 3},
  "header": {"global_certainty": {"from": 1, "to": 2}},
  "clauses": {
    "added":    [{"anchor_index": 12, "theme": "TERMINATION"}],
    "removed":  [{"anchor_index": 7}],
    "modified": [{"anchor_index": 0,
                  "fields": {"certainty": {"from": 2, "to": 3}}}],
    "unchanged_count": 18
  },
  "summary": {"added": 1, "removed": 1, "modified": 1, "unchanged": 18}
}
```

Le diff de **frontières** (added/removed) est aussi consommé par l'IAA WindowDiff
(`inter_annotator_agreement.md`) — même primitive d'alignement par ancre.

## 4. Restauration

`POST /api/v1/annotations/{id}/versions` avec corps `{"restore_from": n}` (ou action dédiée
`POST .../versions/{n}/restore`) :

1. Vérifie permission (auteur de l'annotation, ou `lead`/`admin`).
2. Refuse (409) si l'annotation est `archived` sans déblocage explicite, ou si le `schema` du snapshot
   n'est plus compatible avec le `LabelScheme` actif du projet (thème disparu) → message guidé.
3. Applique le snapshot comme **nouvel état courant** (les clauses actuelles sont remplacées dans une
   transaction), puis **crée une nouvelle version** `reason=restore_from:{n}`. La restauration ne
   *réécrit jamais* l'historique : elle l'allonge (forward-only). On peut donc « annuler une
   restauration » en restaurant la version précédente.
4. Émet `ActivityEvent verb=version.restored payload={from_number, new_number}`.

## 5. Comparaison de versions vs comparaison d'annotations

Deux usages distincts, même primitive de diff :

- **Historique** (`/history/[id]`) : versions d'**une même** annotation (timeline verticale, chaque
  nœud = snapshot, clic = diff avec le précédent ou base sélectionnable).
- **Compare** (`/compare?doc=&a=&b=`) : deux annotations **différentes** (humain vs humain, ou humain
  vs pré-annotation LLM normalisée — cf. `08_import_export/import_preannotations.md`). Le diff
  s'applique sur leurs snapshots courants ; en mode anonymisé (`?anonymize=true`,
  `collaboration.md` §4) les libellés `a`/`b` sont pseudonymisés.

## 6. Tests (CONTRACT §6)

- `pytest versioning` : monotonie/contiguïté de `number` sous concurrence ; immuabilité du `snapshot` ;
  refus de restauration sur schéma incompatible.
- `pytest diff` : added/removed/modified/unchanged corrects sur cas tabulés ; symétrie
  `diff(a,b) == inverse(diff(b,a))`.
- `e2e history.spec` : timeline, diff, restauration, vérification que l'historique s'allonge.
