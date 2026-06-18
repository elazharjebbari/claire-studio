# Flux d'activité & modèle d'événements

> Périmètre : feature **F4** + tracking (`11_tracking_observability/tracking.md`). Entité :
> `ActivityEvent`. Endpoint : `GET /api/v1/activity?project=&actor=&verb=`. Surface : cloche
> d'activité (top bar) + tableau de bord projet. `ActivityEvent` est la **source unique** du
> « qui a fait quoi ».

## 1. Modèle

```
ActivityEvent(PK id, *FK actor(User), *verb, *target_type, *target_id, payload:json, created_at)
```

Principes :

- **Append-only** : aucune route ne modifie ni ne supprime un `ActivityEvent`. C'est un journal, pas
  un état. (La purge éventuelle relève de la rétention, `10_quality_certainty_comments/archival.md`
  et `12_security/rgpd_dpia.md`.)
- **Verbe au passé, objet typé** : `(actor) (verb) (target_type:target_id)` se lit comme une phrase.
- **Payload structuré mais borné** : le `payload` contient le strict nécessaire pour rendre l'item
  sans requête supplémentaire (dénormalisation de lecture contrôlée), jamais de texte intégral de
  clause ni de données personnelles superflues (minimisation RGPD).
- **Idempotence** : chaque écriture métier émet **au plus un** événement par transition ; clé
  d'idempotence optionnelle dans `payload._idem` pour les producteurs (imports, exports asynchrones).

## 2. Vocabulaire des verbes (fermé, versionné)

Les verbes forment un vocabulaire fermé (comme les thèmes). Ajout = changement versionné, jamais de
verbe libre.

| Verbe | target_type | Émis par | Sens |
|---|---|---|---|
| `annotation.created` | `annotation` | F1 | Annotation initialisée (vierge ou seedée) |
| `annotation.submitted` | `annotation` | F1 | Passage `draft → submitted` |
| `annotation.approved` | `annotation` | F10 | Décision review `approve` |
| `annotation.changes_requested` | `annotation` | F10 | Décision `request_changes` |
| `annotation.rejected` | `annotation` | F10 | Décision `reject` |
| `annotation.archived` | `annotation` | F10 | Archivage (`archival.md`) |
| `annotation.restored` | `annotation` | F10 | Désarchivage |
| `clause.added` | `clause` | F1 | Frontière de clause posée |
| `clause.updated` | `clause` | F1 | Thème/nature/span/rationale/certitude modifiés |
| `clause.deleted` | `clause` | F1 | Frontière supprimée |
| `version.created` | `annotation_version` | F3 | Snapshot (manuel/auto/statut) |
| `version.restored` | `annotation_version` | F3 | Restauration d'une version |
| `comment.posted` | `comment` | F9 | Nouveau commentaire dans un fil |
| `comment.resolved` | `comment` | F9 | Fil marqué résolu |
| `review.posted` | `review` | F10 | Notation/décision d'un reviewer |
| `preannotation.imported` | `preannotation` | F2 | Import LLM (upload ou pull auto) |
| `preannotation.applied` | `annotation` | F2 | Pré-remplissage appliqué comme brouillon |
| `export.requested` | `export_job` | F5 | Export lancé |
| `export.completed` | `export_job` | F5 | Artefact prêt |
| `translation.synced` | `translation_set` | F8 | Sync file-based exécutée |
| `assignment.created` | `assignment` | F4 | Document assigné à un annotateur |
| `reveal_identity` | `project` | F4 | Dé-anonymisation IAA (acte sensible, tracé) |
| `member.added` | `project` | F4 | Ajout d'un membre projet |

## 3. Schémas de payload (par verbe)

Le `payload` est validé par un schéma Pydantic dédié au verbe (côté backend) :

```json
// annotation.submitted
{"project": "claudette-gold-v1", "document": "Fitbit", "n_clauses": 14,
 "global_certainty": 2, "from_status": "draft", "to_status": "submitted"}

// clause.updated
{"annotation_id": 102, "anchor_index": 6,
 "changed": {"theme": {"from": "MISC_BOILERPLATE", "to": "LICENSE_IP"}}}

// version.restored
{"annotation_id": 102, "from_number": 2, "new_number": 5}

// comment.posted
{"annotation_id": 102, "comment_id": 88, "thread_root": 80,
 "anchor": {"type": "clause", "anchor_index": 6}, "excerpt": "pourquoi LICENSE_IP ?"}

// preannotation.imported
{"project": "claudette-gold-v1", "document": "Fitbit", "judge": "claude",
 "schema_version": "v9.4", "n_clauses": 11, "source": "auto_pull"}

// export.completed
{"export_id": 31, "format": "huggingface", "scope": {"status": "approved"},
 "artifact": "exports/claudette-gold-v1/2026-06-18/hf/", "n_annotations": 120}

// reveal_identity  (sensible)
{"project": "claudette-gold-v1", "context": "iaa_report", "revealed_pseudonyms": ["A", "B"]}
```

`excerpt` est tronqué (≤ 140 car.) ; jamais le corps complet, jamais d'identifiant personnel hors
`actor`/`assignee` déjà légitimes.

## 4. Lecture & filtrage

`GET /api/v1/activity?project=&actor=&verb=&target_type=&since=&page=&page_size=` :

- Tri par défaut `-created_at`. Pagination obligatoire (`page_size` plafonné, défaut 50).
- **Filtrage de visibilité** appliqué côté serveur : un annotateur ne voit que les événements
  compatibles avec sa `peer_visibility` (`collaboration.md` §2). Les événements `reveal_identity`,
  `member.added`, `assignment.created` ne sont visibles que `lead`/`admin`.
- Mode anonyme `?anonymize=true` : `actor` remplacé par le pseudonyme projet ; payloads expurgés des
  identifiants nominatifs.

### Cloche d'activité (top bar)
Flux temps quasi-réel : polling court (ou SSE/WebSocket si dispo) sur `GET /activity?project=` +
`since=` du dernier vu. Badge = nombre d'événements non lus pertinents pour l'utilisateur. Clic →
panneau déroulant groupé par document.

### Tableau de bord projet
`GET /projects/{slug}/progress` agrège `ActivityEvent` (dernière activité par document, vélocité) +
`Annotation` (statuts) + bloc `iaa` (`inter_annotator_agreement.md` §5).

## 5. Garanties & relation au tracking

- L'`ActivityEvent` est l'**audit trail produit** (orienté utilisateur, affichable). Les logs
  techniques structurés et les métriques Prometheus relèvent de l'observabilité
  (`11_tracking_observability/observability.md`) et ne dupliquent pas ce journal.
- Le catalogue `11_tracking_observability/metrics_catalog.csv` référence les métriques dérivées du
  flux (vélocité d'annotation, délai de revue) avec `ActivityEvent` comme source.

## 6. Tests (CONTRACT §6)

- `pytest activity` : append-only ; un seul événement par transition ; payload valide par verbe.
- `pytest activity_visibility` : filtrage `peer_visibility` et restriction des verbes sensibles.
- `e2e collaboration.spec` : la cloche reflète les actions d'un autre annotateur en temps quasi-réel.
