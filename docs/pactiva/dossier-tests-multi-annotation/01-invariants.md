# Invariants de données — ce qui ne doit JAMAIS casser

Chaque invariant est **testé** (cf. `tests/test_multi_annotation_battery.py`,
`tests/test_campaign_property.py`). Un échec = NO‑GO campagne.

| # | Invariant | Énoncé | Garanti par (code) | Test |
|---|---|---|---|---|
| **INV‑LOSS** | Zéro perte | Toute clause créée/validée par un annotateur est persistée et relue à l'identique (thème, nature, certitude, evidence, rationale, validated). | `Clause` + autosave + `add_clause` | property + lifecycle |
| **INV‑4** | Session unique | Au plus **une** `Annotation` par (project, document, annotator). | `UniqueConstraint` annotations/models | `test_invariants` + battery |
| **INV‑2** | 1 clause‑début/phrase | Au plus **une** clause par (annotation, anchor_sentence). | `UniqueConstraint` + Conflict 409 | battery |
| **INV‑IDEM** | Idempotence | Un même `client_op_id` réémis ne crée pas de doublon (retry réseau). | `add_clause` (client_op_id) | battery (retries dupliqués) |
| **INV‑OWN** | Écriture owner‑only | Personne (même admin/reviewer) n'édite le CONTENU de la session d'un pair → 403/404. | `IsAnnotationOwner` | battery (A édite B) |
| **INV‑READ** | Étanchéité lecture | Un annotateur non‑privilégié ne LIT que SES annotations/clauses ; `GET /annotations` et `/clauses` d'un pair → vide/404. | `AnnotationViewSet.get_queryset`, `ClauseViewSet` | battery + property |
| **INV‑COLLAB** | Collab non corruptrice | Un commentaire/review sur une clause/annotation N'ALTÈRE PAS les clauses (ni d'autrui ni les siennes) ; comptes de clauses inchangés. | `collaboration/*` (FK séparées) | battery |
| **INV‑COMMENT‑ISO** | Commentaires isolés | Un non‑privilégié ne voit que les commentaires des projets dont il est membre. | `CommentViewSet.get_queryset` | battery |
| **INV‑VER** | Versioning immuable | Chaque soumission crée un `AnnotationVersion` append‑only (numéros croissants, snapshot figé). | `transition_status` + `create_version` | battery + lifecycle |
| **INV‑FSM** | Transitions légales | Les statuts ne transitent que selon `ALLOWED_TRANSITIONS` (sinon 409). | `transition_status` | battery |
| **INV‑IAA** | IAA exact | κ pairwise calculé seulement sur SUBMITTED ; `per_theme`/`boundary` moyennés par paire (pas de double‑comptage N≥3) ; accord parfait → 1.0. | `projects/iaa.py` | property (N annotateurs) |
| **INV‑STATS** | Stats = vérité DB | `progress` (annotated/submitted/approved distincts), `annotators-progress` (assigned/started/submitted par annotateur) reflètent exactement la base. | `projects/views.py` | property + lifecycle |
| **INV‑DOC‑UNIQUE** | 1 doc / ligne | `GET /projects/{slug}/documents` renvoie ≤ 1 entrée par document ; `mySession` = ma session ; `sessions[]` admin only. | `ProjectViewSet.documents` | battery |
| **INV‑EXPORT** | Export intègre | L'export contient exactement les sessions du scope, attribuées par annotateur, sans perte (validated/source/order présents) ; failed persiste. | `exports/services.py` | battery + test_export(_async) |

## Méthode de vérification property‑based
Un *modèle de référence* (dict Python en mémoire : `{(annotator, doc): {anchor: clause}}`)
est maintenu en parallèle des appels API. À CHAQUE opération générée par hypothesis :
1. on applique l'op via l'API (avec le bon annotateur) ;
2. on met à jour le modèle ;
3. on **réconcilie** : l'état DB lu PAR CHAQUE annotateur == son sous‑modèle (et **rien**
   de l'autre) → INV‑READ + INV‑LOSS + INV‑OWN vérifiés en continu.
Tout écart = contre‑exemple minimal (hypothesis shrink).
