# 02 — Modèle de données

On **étend** l'existant (Annotation, Clause, AnnotationVersion, Comment, Review,
ActivityEvent, PreAnnotation, Project, Membership) plutôt que de le refondre. Voir
`data-model.puml` (ERD) et `entities.json` (schéma machine).

## Entités existantes (rappel, inchangées sauf mention)

- **Project** ‹slug, name, scheme, members…› — porte le scoping multi-annotateurs.
- **Membership** ‹project, user, role∈{owner,reviewer,annotator}, color› — couleur =
  identité visuelle de l'annotateur dans le collaboratif.
- **Annotation** ‹project, document, annotator, status∈{draft,submitted,validated}›.
- **Clause** ‹annotation, anchor_index, theme, legal_nature, evidence_span,
  rationale, certainty, order›.
- **AnnotationVersion** ‹annotation, number, label, created_by, created_at›.
- **Comment** ‹annotation, clause?, sentence_index?, body, author, resolved,
  thread_root?›.
- **Review** ‹annotation, score, decision, body, reviewer›.
- **ActivityEvent** ‹project, actor, verb, target, payload(JSON), created_at›.

## Extensions / nouvelles entités

### AnnotationVersion (étendue) — point 2 & 6
Ajouts :
- `name` (texte court, requis à la soumission), `description` (texte long, optionnel).
- `snapshot` (JSONB) : capture immuable de toutes les clauses + champs à l'instant T.
- `parent_version` (FK self, nullable) : chaîne de versions.
- `kind` ∈ {snapshot_manuel, soumission, auto}.
- `stats` (JSONB) : #clauses, #par thème, certitude moyenne (figés pour comparaison).

> Le `snapshot` rend chaque version **rejouable et diffable** sans dépendre de l'état
> courant. La comparaison de versions (point 6) lit deux snapshots.

### ActivityEvent (pivot de l'historique) — points 2, 3, 4a, 6
Append-only. C'est la **colonne vertébrale** de l'historique, de l'attribution, de
l'undo/redo serveur et de l'analytics. Champs clés :
- `verb` ∈ taxonomie (`event-types.csv`) : `clause.create`, `clause.retheme`,
  `clause.delete`, `clause.set_certainty`, `clause.set_evidence`, `divergence.adopt`,
  `prefill.apply`, `version.submit`, `comment.add`, …
- `target_type` ∈ {document, clause, sentence, annotation, comment}.
- `sentence_index` (nullable) : permet l'**historique au niveau de la phrase** (point 6).
- `before` / `after` (JSON) : valeurs avant/après → diff lisible + base d'undo serveur.
- `client_op_id` (idempotence), `session_id` (corrélation collaborative).

### CollaborationSession — points 4b, 7
‹id, project, document, started_at, ended_at?, participants(JSON: user→{color,joinedAt})›.
Reflet persistant d'une salle WS (la présence vive est dans Redis ; la session trace
qui a collaboré et quand).

### ShareLink — points 4b
‹token(HMAC signé), project, role_granted, created_by, expires_at, max_uses?,
used_count, revoked›. À l'ouverture par un utilisateur **authentifié**, crée/active la
`Membership` correspondante. Jamais d'accès anonyme aux données.

### SentenceHistory (vue dérivée, non matérialisée par défaut) — point 6
Projection des `ActivityEvent` filtrés par (`document`, `sentence_index`) ordonnés dans
le temps : « comment l'annotation de CETTE phrase a évolué, par qui, à travers les
versions ». Peut être matérialisée si volumétrie l'exige.

### AnalyticsSnapshot (matérialisée) — point 5
Agrégats par projet et par document : couvertures, κ inter-annotateurs, distributions
de thèmes, temps d'annotation, #commentaires, #conflits. Rafraîchie par tâche
planifiée + invalidation à la soumission.

## Contraintes & intégrité

- `AnnotationVersion` : `unique(annotation, number)`, `number` monotone.
- `ActivityEvent` : **append-only** (pas d'UPDATE/DELETE ; révocation logique via un
  nouvel event `*.revert`).
- `Clause` : `unique(annotation, anchor_index)` (une ancre = une clause).
- `ShareLink.token` : indexé unique ; vérif HMAC + expiration + quota à chaque usage.
- Cascade : suppression d'`Annotation` → versions/clauses/commentaires liés ; l'audit
  est **conservé** (rattaché au projet, pas supprimé).

## Indices

- `ActivityEvent(project, created_at)`, `ActivityEvent(document, sentence_index, created_at)`,
  `ActivityEvent(actor, created_at)` — pour historique, attribution, analytics.
- `AnnotationVersion(annotation, number)`.
- `Comment(annotation, clause)`, `Comment(annotation, sentence_index)`.
