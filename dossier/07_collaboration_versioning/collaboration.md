# Collaboration multi-annotateur

> Périmètre : feature **F4** (annotation collaborative, « qui a annoté quoi »). Source de vérité :
> `00_overview/CONTRACT.md` §1–§3. Entités : `User`, `ProjectMembership`, `Assignment`,
> `Annotation`, `ActivityEvent`.

## 1. Modèle de collaboration

CLAIRE Studio est **DB-centrique** : la collaboration ne passe jamais par des fichiers partagés ni
par des verrous OS. L'unité de travail est l'**Annotation**, unique par triplet
`(project, document, annotator)` (invariant dur, CONTRACT §2). Deux annotateurs sur le même document
produisent donc **deux annotations indépendantes** — c'est la base mécanique du calcul d'accord
inter-annotateur (voir `inter_annotator_agreement.md`).

Conséquences directes :

- Pas d'édition simultanée d'une même `Annotation` par deux personnes (un seul `annotator` FK).
- Le **double-codage** (multi-annotation d'un même document) est un choix de projet, pas un accident :
  il est piloté par les `Assignment` (plusieurs assignments du même `document` à des `assignee`
  différents dans le même `project`).
- Les commentaires (F9) et reviews (F10) sont les seuls objets *partagés* attachés à une annotation
  d'autrui ; ils ne mutent jamais la production de l'annotateur.

## 2. Rôles & permissions

Rôles globaux (`User.role`) et rôles projet (`ProjectMembership.role`) se composent. Le rôle projet
**restreint** dans le périmètre du projet ; le rôle global ouvre `/admin/*`.

| Capacité | annotator | reviewer | lead (projet) | admin / owner (global) |
|---|---|---|---|---|
| Créer/éditer **sa** annotation | ✅ | ✅ | ✅ | ✅ |
| Soumettre (`submit`) | ✅ | ✅ | ✅ | ✅ |
| Lire annotation d'autrui | selon politique projet | ✅ | ✅ | ✅ |
| Commenter annotation d'autrui (F9) | selon politique | ✅ | ✅ | ✅ |
| Reviewer / noter (F10) | ❌ | ✅ | ✅ | ✅ |
| Voir « qui a annoté quoi » nominatif | ❌ (anonymisé) | ✅ | ✅ | ✅ |
| Gérer membres & assignations | ❌ | ❌ | ✅ | ✅ |
| Accès `/admin/*`, schémas, corpus | ❌ | ❌ | ❌ | ✅ |

La politique « lecture/commentaire d'autrui » est portée par `Project.settings.collaboration` :

```json
{
  "collaboration": {
    "peer_visibility": "blind|after_submit|always",
    "peer_comment": "disabled|after_submit|always",
    "double_coding": true,
    "min_annotators_per_doc": 2
  }
}
```

- `peer_visibility: blind` → un annotateur ne voit jamais les autres annotations du même document
  tant que le projet est en phase d'annotation (anti-contagion, indispensable pour un IAA valide).
- `after_submit` → visibilité débloquée une fois sa propre annotation `submitted`.
- L'autorisation est évaluée côté DRF dans une permission `PeerVisibilityPermission` adossée à
  `ProjectMembership` + `Annotation.status`, jamais côté frontend seul.

## 3. « Qui a annoté quoi » via ActivityEvent

Le traçage de l'activité collaborative repose **entièrement** sur `ActivityEvent`
(`PK id, *FK actor, *verb, *target_type, *target_id, payload:json, created_at`). Aucun champ
« dernier modifié par » dispersé : l'audit trail est la **seule** source. Détail du modèle
d'événements dans `activity_feed.md`.

Vues dérivées (lecture seule, agrégées, jamais stockées en double) :

- **Tableau de bord projet** (`GET /api/v1/projects/{slug}/progress`) : pour chaque document, qui a
  une annotation, à quel statut, depuis quand, dernière activité. Calculé par agrégation
  `Annotation` × `ActivityEvent` filtrés `project`.
- **Cloche d'activité** (top bar, navigation.md §2) : flux récent `GET /api/v1/activity?project=` —
  les N derniers événements visibles par l'utilisateur courant (filtrés par sa visibilité).
- **Mes assignations** : `GET /api/v1/projects/{slug}/assignments` filtré `assignee=me`.

Règle de cohérence : **toute** transition de statut d'`Annotation` émet un `ActivityEvent` et peut
créer une `AnnotationVersion` (invariant dur CONTRACT §2). On ne reconstruit jamais l'historique
collaboratif à partir des timestamps `updated_at` — on lit le journal.

## 4. Anonymisation pour l'IAA

Le calcul d'accord inter-annotateur (`inter_annotator_agreement.md`) et toute restitution comparative
**doivent** pouvoir masquer l'identité réelle des annotateurs, pour deux raisons : (1) éviter le biais
de complaisance/autorité entre pairs, (2) conformité RGPD (cf. `12_security/rgpd_dpia.md`,
minimisation et pseudonymisation des données d'annotateurs).

Mécanisme :

- Chaque annotation reçoit un **alias stable par projet** : `pseudonym = HMAC(project_secret,
  user_id)` tronqué → libellé déterministe type `Annotateur A`, `Annotateur B` (mapping
  `pseudo_index` rangé par ordre d'arrivée dans le projet). Stable au sein d'un projet, **non
  ré-identifiable entre projets** (sel par projet).
- Le mode anonyme est un paramètre de requête `?anonymize=true` sur les endpoints comparatifs
  (`/compare`, `/progress`, exports IAA). Le backend substitue les libellés et **retire** `actor`
  nominatif des payloads `ActivityEvent` renvoyés.
- La table de correspondance `pseudo_index → user_id` n'est lisible que par `lead`/`admin` via un
  endpoint dédié journalisé (`ActivityEvent verb=reveal_identity`), jamais exposée à l'annotateur.
- Les exports IAA (cf. `export_formats.md`) sortent par défaut **pseudonymisés** ; la dé-anonymisation
  est un acte explicite tracé.

## 5. Concurrence & conflits

Comme une annotation n'a qu'un auteur, les conflits d'écriture inter-utilisateurs n'existent pas.
Restent deux cas :

- **Onglets multiples du même annotateur** : géré par verrouillage optimiste. `Annotation` et `Clause`
  portent un `updated_at` ; les `PATCH` envoient `If-Unmodified-Since`/`version` et reçoivent **409**
  en cas de conflit (CONTRACT §3). Le frontend propose alors un rechargement ou une fusion guidée.
- **Snapshot concurrent** : la création d'`AnnotationVersion` est atomique (numéro monotone, voir
  `versioning.md`) ; deux snapshots concurrents sont sérialisés par contrainte d'unicité
  `(annotation, number)`.

## 6. Tests (cf. CONTRACT §6)

- `pytest activity` : tout changement de statut crée exactement un `ActivityEvent`.
- `pytest peer_visibility` : `blind`/`after_submit`/`always` autorisent/interdisent la lecture.
- `pytest anonymize` : `pseudo_index` stable par projet, dé-anonymisation tracée.
- `e2e collaboration.spec` : deux annotateurs, double-codage, tableau de bord « qui a annoté quoi ».
