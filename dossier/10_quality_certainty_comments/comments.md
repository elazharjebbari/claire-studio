# Commentaires (justifier le choix)

> Périmètre : feature **F9** (commentaires). Entité : `Comment`. Endpoints :
> `GET/POST /api/v1/annotations/{id}/comments`, `POST /api/v1/comments/{id}/resolve`. Surface : fil
> dans l'inspecteur du workspace (raccourci `C`) et mode revue.

## 1. Modèle & ancrage

```
Comment(PK id, *FK annotation, FK clause?, FK sentence?, *FK author(User), *body:md,
        thread_root?, resolved[bool], created_at)
```

Un commentaire est **toujours rattaché à une `Annotation`**, et optionnellement **ancré** plus
finement :

| Ancrage | Champs | Sens |
|---|---|---|
| Annotation | `clause=null, sentence=null` | discussion générale sur l'annotation |
| Clause | `clause=<id>` | justifier/contester une frontière ou un thème précis |
| Phrase | `sentence=<id>` | pointer une phrase (ex. hésitation avant de poser une clause) |

Règles d'intégrité :

- Si `clause` est fourni, sa `Clause` appartient à l'`annotation` (sinon 400).
- Si `sentence` est fourni, sa `Sentence` appartient au document de l'`annotation` (sinon 400).
- `clause` et `sentence` sont **mutuellement exclusifs** (un commentaire vise l'un OU l'autre OU
  l'annotation globale).

## 2. Fils de discussion

- Un commentaire racine a `thread_root = null` ; une réponse porte `thread_root = id du racine`
  (fils à **un niveau** de réponses, pas d'arborescence profonde — lisibilité dans l'inspecteur
  étroit). Une réponse hérite de l'ancrage du racine (même `clause`/`sentence`).
- L'ancrage du fil reste stable même si la clause évolue : si la `Clause` ancre est supprimée
  (frontière retirée, `clause.deleted`), le fil **n'est pas détruit** ; il bascule en ancrage
  « phrase » (l'`anchor_sentence` de la clause supprimée) avec une note `anchor_migrated`, pour ne
  jamais perdre une justification. Tracé via `ActivityEvent`.

## 3. Corps (Markdown) & mentions

- `body` est en **Markdown** restreint (sous-ensemble sûr : gras, italique, listes, code inline, liens
  — pas de HTML brut ; assainissement côté serveur, cf. `12_security/security.md` XSS).
- **Mentions** : `@username` reconnu si l'utilisateur est **membre du projet** (`ProjectMembership`).
  Une mention émet une notification (cloche, `07_collaboration_versioning/activity_feed.md`) et est
  consignée dans le `payload` de `comment.posted` (`mentions: ["bob"]`). Mention d'un non-membre =
  texte simple, pas de notification (pas de fuite d'existence d'utilisateur hors projet).

## 4. Résolution

- `POST /api/v1/comments/{id}/resolve` marque le **fil** (racine + réponses) `resolved=true`. Réservé
  à l'auteur du racine, au reviewer, au `lead`/`admin`. Un fil résolu se replie dans l'UI mais reste
  consultable (jamais supprimé). Émet `comment.resolved`.
- Réouverture possible (`resolved=false`) par les mêmes rôles, tracée.
- Un reviewer qui demande des changements (`request_changes`, `review_rating.md`) crée typiquement des
  commentaires ancrés non résolus ; l'annotateur les résout en répondant/corrigeant — boucle de
  qualité explicite.

## 5. Permissions & visibilité

- **Commenter l'annotation d'autrui** dépend de `Project.settings.collaboration.peer_comment`
  (`disabled | after_submit | always`, cf. `07_collaboration_versioning/collaboration.md` §2). En
  mode `blind`, un annotateur ne commente pas les annotations des pairs avant soumission.
- Le reviewer commente toujours (rôle dédié). L'auteur commente toujours sa propre annotation.
- En mode anonymisé (IAA / compare), les auteurs de commentaires sont **pseudonymisés** comme les
  annotateurs (`collaboration.md` §4).

## 6. Relation aux autres features

- **Versioning** : les commentaires ne sont **pas** dans le `snapshot` d'`AnnotationVersion` (le
  snapshot est l'état d'annotation, pas la discussion) — ils vivent dans leur propre table, datés,
  donc replaçables sur la timeline d'historique.
- **Certitude** : un commentaire est le complément naturel d'une clause `certainty ≤ 1` (justifier le
  doute) ; l'UI suggère `C` après avoir posé une certitude faible.

## 7. Tests (CONTRACT §6)

- `pytest comments` : ancrage exclusif clause/sentence ; appartenance vérifiée ; fil 1 niveau ;
  résolution/réouverture tracées ; migration d'ancre à la suppression de clause.
- `pytest comment_mentions` : mention membre → notification + payload ; mention non-membre → texte
  simple ; assainissement Markdown (pas de HTML/XSS).
- `e2e comments.spec` : `C` ouvre un fil, mention, résolution, repli, boucle request_changes.
