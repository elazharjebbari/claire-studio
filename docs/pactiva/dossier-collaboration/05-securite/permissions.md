# Sécurité — Matrice de permissions & isolation

Ce document décrit le **modèle d'autorisation** réellement implémenté dans le
backend Pactiva (DRF) et la **politique d'indépendance des sessions** retenue par
l'ADR‑001. Le vocabulaire est celui du
[glossaire](../01-besoins/glossaire.md) : *Campagne* (`Project`), *Document*,
*Assignation* (`Assignment`), *Session* (`Annotation` + ses `Clause`),
*Collaboration* (`Comment`, `Review`, comparaison N‑way, pré‑annotations),
*Référence/gold* (clauses `validated`).

Toutes les citations renvoient au code source vérifié.

---

## 0. Rôles & primitives d'autorisation

Le rôle vit sur l'utilisateur (`backend/claire/accounts/models.py:10-35`) :
`annotator | reviewer | admin | owner`. Le raccourci métier
`User.is_admin_role` (`accounts/models.py:33-35`) vaut vrai pour `admin`, `owner`
et tout superuser.

Les permissions DRF (`backend/claire/common/permissions.py`) :

| Classe | Fichier:ligne | Rôle |
|---|---|---|
| `is_project_member(user, project)` | `permissions.py:6-16` | Helper d'isolation projet : admin/owner → toujours vrai ; sinon teste `project.memberships`. |
| `IsAdminRole` | `permissions.py:19-26` | Écriture réservée admin/owner ; **lecture (SAFE_METHODS) ouverte à tout authentifié**. |
| `IsReviewerOrAdmin` | `permissions.py:29-36` | Lecture ouverte ; écriture réservée `reviewer/admin/owner/superuser`. |
| `IsAnnotationOwnerOrReviewer` | `permissions.py:39-57` | Lecture ouverte ; écriture par le **propriétaire** OU `reviewer/admin/owner`. |
| `IsAnnotationOwner` | `permissions.py:60-87` | Écriture du **contenu** réservée au **seul propriétaire**, **sans aucune dérogation de rôle** (intégrité IAA). Gère aussi le cas `Clause` en remontant à `clause.annotation.annotator_id` (`permissions.py:84-87`). |

> **Note `IsAdminRole`** — c'est une permission « **écriture** admin, **lecture**
> authentifiée » (`permissions.py:22-26`). La confidentialité réelle des données
> sensibles repose donc sur le **`get_queryset`** de chaque vue (filtrage par
> appartenance), pas sur la seule classe de permission. C'est le point soulevé par
> le finding `admin-only-reads-actually-open` (audit, minor) : assumé et documenté
> ici.

---

## 1. Matrice rôle × action

Quatre rôles vus depuis une ressource donnée :

- **Propriétaire** = l'annotateur dont c'est *Ma session* (`annotation.annotator == me`).
- **Pair** = un autre annotateur, **membre du même projet**, mais qui n'est pas le propriétaire.
- **Reviewer** = rôle qualité transverse (`role == "reviewer"`).
- **Admin/Owner** = `is_admin_role` (admin/owner/superuser).

Légende : ✅ autorisé · 🟡 lecture seule (supervision) · ❌ refusé / non exposé.

### 1.1 Session d'annotation (`Annotation`) — `AnnotationViewSet`

`backend/claire/annotations/views.py:38-109`

| Action | Propriétaire | Pair | Reviewer | Admin/Owner | Mécanisme |
|---|---|---|---|---|---|
| Lire SA session (`retrieve`/`list`) | ✅ | ❌ | 🟡 | 🟡 | `get_queryset` filtre `annotator=user` sauf admin/reviewer (`views.py:86-91`) |
| Lire la session d'un **pair** | — | ❌ | 🟡 | 🟡 | idem ; un pair non privilégié est exclu du queryset → 404/403 |
| `create` (ouvrir Ma session) | ✅ | ✅ (la sienne) | ✅ | ✅ | `create` idempotent `get_or_create(project,document,annotator=request.user)` (`views.py:138-142`) — **toujours sa propre** session |
| `update`/`partial_update` (statut, certitude) | ✅ | ❌ | ❌ | ❌ | `_OWNER_ONLY_ACTIONS` → `IsAnnotationOwner` (`views.py:55-60`) |
| `submit` | ✅ | ❌ | ❌ | ❌ | idem `_OWNER_ONLY_ACTIONS` (`views.py:55, 158-162`) |
| `destroy` | ✅ | ❌ | ❌ | ❌ | idem |
| `versions` (GET/POST) | ✅ | ❌ | 🟡 (lecture) | 🟡 (lecture) | défaut `IsAnnotationOwnerOrReviewer` + filtrage queryset |
| `comments` (GET/POST) | ✅ | ❌ (queryset) | ✅ | ✅ | rattaché à l'annotation (`views.py:290-304`) |
| `reviews` (GET/POST) | ❌ (écriture) | ❌ | ✅ | ✅ | `permission_classes=[IsReviewerOrAdmin]` sur l'`@action` (`views.py:351-354`) |
| `attribution` / `presence` | ✅ | ❌ (queryset) | 🟡 | 🟡 | lecture, bornée par `get_queryset` |

Point clé : l'écriture du **contenu** d'une session est verrouillée par
`IsAnnotationOwner` **sans dérogation de rôle** (`permissions.py:60-71`) — même un
admin/owner ne peut éditer les clauses, le statut, la soumission ou la certitude
d'autrui. La supervision admin se fait via les `reviews`/`comments`, jamais en
écrivant dans la session.

### 1.2 Clause (`Clause`) — `ClauseViewSet`

`backend/claire/annotations/views.py:384-423`

| Action | Propriétaire | Pair | Reviewer | Admin/Owner | Mécanisme |
|---|---|---|---|---|---|
| Lire les clauses de SA session | ✅ | ❌ | 🟡 | 🟡 | `get_queryset` → `annotation__annotator=user` sauf admin/reviewer (`views.py:395-402`) |
| Lire les clauses d'un **pair** | — | ❌ | 🟡 | 🟡 | exclu du queryset pour un non‑privilégié |
| `partial_update` (PATCH) | ✅ | ❌ | ❌ | ❌ | `permission_classes=[IsAnnotationOwner]` + `get_object` re‑vérifie sur l'annotation parente (`views.py:392, 404-408`) |
| `delete` | ✅ | ❌ | ❌ | ❌ | idem ; `http_method_names` limité à `get/patch/delete` (`views.py:393`) |

### 1.3 Commentaire (`Comment`) — `CommentViewSet`

`backend/claire/collaboration/views.py:11-37`

| Action | Propriétaire (de la session liée) | Pair **membre projet** | Reviewer | Admin/Owner | Mécanisme |
|---|---|---|---|---|---|
| Lire les commentaires | ✅ | ✅ (membre du projet OU auteur) | ✅ | ✅ | `get_queryset` : `Q(annotation__project__memberships__user=user) | Q(author=user)` sauf admin/reviewer (`views.py:19-30`) |
| Créer (POST) | ✅ | ✅ | ✅ | ✅ | `IsAuthenticated` (`views.py:16`) |
| `resolve` (POST) | ✅ | ✅ | ✅ | ✅ | `@action resolve` (`views.py:32-37`) |

> La collaboration (commentaire) est, elle, **visible entre membres du même
> projet** : c'est voulu — c'est l'espace de convergence (B). Elle ne dévoile
> jamais le contenu de la session d'un pair (ce sont des objets distincts).

### 1.4 Review (`Review`) — action `reviews`

`backend/claire/annotations/views.py:351-381`

| Action | Propriétaire | Pair | Reviewer | Admin/Owner | Mécanisme |
|---|---|---|---|---|---|
| Lire les reviews | 🟡 | ❌ | ✅ | ✅ | `IsReviewerOrAdmin` (lecture ouverte) + bornage queryset annotation |
| Créer une review (approve/reject) | ❌ | ❌ | ✅ | ✅ | `IsReviewerOrAdmin` write (`permissions.py:29-36`) ; pilote la machine d'états (`views.py:364-376`) |

### 1.5 Assignation (`Assignment`) — `ProjectViewSet`

`backend/claire/projects/views.py:47-149`

| Action | Annotateur (membre) | Reviewer | Admin/Owner | Mécanisme |
|---|---|---|---|---|
| Lister MES assignations | ✅ (filtre `assignee=request.user`) | ✅ (filtre) | ✅ (toutes) | `assignments` GET (`views.py:70-76`) |
| Lister CELLES d'autrui | ❌ | ❌ | ✅ | filtre `if not is_admin_role: qs.filter(assignee=request.user)` (`views.py:73-74`) |
| Créer (POST) / `assignments/bulk` | ❌ (403) | ❌ | ✅ | garde explicite `is_admin_role` (`views.py:51-55`) / `IsAdminRole` (`views.py:89-90`) |
| `delete_assignment` | ❌ | ❌ | ✅ | `permission_classes=[IsAdminRole]` (`views.py:81`) |
| `annotators-progress` (supervision) | ❌ | ❌ | ✅ | `permission_classes=[IsAdminRole]` (`views.py:200-201`) |

### 1.6 Documents (document‑centré, ADR‑001) — action `documents`

`backend/claire/projects/views.py:227-330`

| Champ exposé | Annotateur (membre) | Reviewer | Lead | Admin/Owner |
|---|---|---|---|---|
| `document` (résumé) | ✅ | ✅ | ✅ | ✅ |
| `my_session` (MA session) | ✅ | ✅ | ✅ | ✅ |
| `sessions[]` + `sessions_summary` (matrice document×annotateur) | ❌ | ❌ | ✅ | ✅ |

La matrice des sessions d'autrui n'est exposée qu'aux **superviseurs**
(`is_supervisor = is_admin_role OR rôle LEAD`, `views.py:251-256`) et
**uniquement** si l'on n'a pas forcé la vue annotateur via `?mine=1`
(`expose_sessions`, `views.py:256, 320-327`). Un annotateur pair ne reçoit que
`my_session` (jamais les sessions des collègues) — c'est la traduction
« présentation » de l'invariant d'indépendance. Conforme au finding
`annotator-sees-others-sessions` (major) et à `INV-DOC-UNIQUE`.

### 1.7 Export (`ExportJob`) — `ProjectViewSet.exports` + `ExportJobViewSet`

`backend/claire/projects/views.py:610-626`, `backend/claire/exports/views.py:14-36`

| Action | Annotateur | Reviewer | Admin/Owner | Mécanisme |
|---|---|---|---|---|
| Déclencher un export (POST) | ❌ | ❌ | ✅ | `@action exports permission_classes=[IsAdminRole]` (`projects/views.py:610`) |
| Lire le statut/manifeste d'un job | 🟡 (lecture authentifiée — voir §4) | 🟡 | ✅ | `ExportJobViewSet permission_classes=[IsAdminRole]` (lecture ouverte) (`exports/views.py:19`) |
| Télécharger l'artefact (`download`) | 🟡 (lecture) | 🟡 | ✅ | `download` confiné à `EXPORTS_DIR` (`exports/views.py:21-36`) |

### 1.8 Activité (`ActivityEvent`) — `ActivityEventViewSet`

`backend/claire/audit/views.py:9-58`

| Action | Annotateur (membre) | Reviewer | Admin/Owner | Mécanisme |
|---|---|---|---|---|
| Lire le journal d'activité | ✅ (SES projets / ses actions) | ✅ (transverse) | ✅ (transverse) | `get_queryset` : `Q(actor=user) | Q(target=annotations de mes projets)` sauf admin/reviewer (`views.py:42-57`) |
| Écrire | ❌ (ReadOnly) | ❌ | ❌ | `ReadOnlyModelViewSet` (`views.py:9`) |

---

## 2. Politique d'INDÉPENDANCE des sessions (décision ADR‑001)

### 2.1 Politique retenue — *isolation stricte du contenu, supervision en lecture*

> **Un annotateur non privilégié ne lit QUE ses propres sessions** (annotation +
> clauses). Il ne voit jamais le **contenu** (clauses, `rationale`, `certainty`,
> statut) de la session d'un **pair**. Seuls **admin/owner** et **reviewer**
> (rôle qualité transverse) **supervisent en lecture**. Personne — pas même un
> admin — n'**édite** la session d'autrui.

Implémentation :

- Annotation : `get_queryset` filtre `annotator=user` sauf admin/reviewer
  (`annotations/views.py:86-91`).
- Clause : `get_queryset` filtre `annotation__annotator=user` sauf admin/reviewer
  (`annotations/views.py:395-402`).
- Écriture verrouillée par `IsAnnotationOwner`, **sans dérogation de rôle**
  (`permissions.py:60-87`, `_OWNER_ONLY_ACTIONS` `annotations/views.py:55`).
- Verrouillé par test : un pair, **même devenu membre du projet**, reçoit 403/404
  en lecture de la session d'autrui, tandis qu'un admin reçoit 200
  (`backend/tests/test_security_m9.py:96-114`).

### 2.2 Justification — anti‑contamination IAA

La concordance inter‑annotateurs (κ de Cohen pairwise, `projects/iaa.py`) n'a de
valeur que si les sessions sont produites **indépendamment**. Si un annotateur
pouvait lire le brouillon d'un pair (ses clauses, son `rationale`, sa
`certainty`), il s'aligne consciemment ou non sur lui : l'accord mesuré devient
**artificiellement gonflé** et perd sa valeur de signal qualité. C'est l'invariant
`INV-COLLAB` (ADR‑001 §Invariants) : *aucune donnée de collaboration ni session
d'autrui ne compte comme référence pour ma soumission*. La convergence légitime
passe par la **zone de collaboration** (commentaires, comparaison humain↔LLM),
pas par la lecture brute du travail d'un pair.

### 2.3 Alternative ÉCARTÉE (laissée à l'arbitrage du PO)

> **Alternative : visibilité des sessions des pairs *après soumission*** (gate sur
> `status`).
>
> *Principe* — tant que MA session n'est pas `submitted`, je ne vois aucune session
> de pair ; une fois MA propre session soumise (donc figée pour l'IAA), on
> m'ouvrirait en lecture les sessions des autres déjà soumises, pour discuter les
> désaccords.
>
> *Avantages* — convergence d'équipe plus riche en phase d'adjudication ; les
> annotateurs comprennent les divergences sur le même document.
>
> *Risques* — (a) contamination résiduelle si un annotateur soumet vite puis
> **rouvre/modifie** sa session après avoir vu les autres (il faudrait alors
> **geler** la session post‑soumission, ce que la machine d'états autorise
> aujourd'hui à rouvrir) ; (b) complexité du `get_queryset` (filtre conditionnel
> par statut croisé entre sessions) ; (c) impact direct sur la validité de l'IAA si
> le gel n'est pas strict.
>
> *Statut* — **écartée par défaut** au profit de l'isolation stricte (§2.1), mais
> **documentée pour arbitrage product owner**. Bascule possible sans casser le
> contrat : il suffirait d'élargir le `get_queryset` de l'`AnnotationViewSet`
> (`annotations/views.py:86-91`) à `Q(annotator=user) | Q(status__in=SUBMITTED, ... )`
> **et** d'ajouter un gel de la session post‑soumission. Tant que ce gel n'existe
> pas, on conserve l'isolation stricte.

---

## 3. Corrections d'isolation Comment / Activity (audit M9)

Deux fuites « tout authentifié » ont été corrigées. Avant correction, `Comment` et
`ActivityEvent` exposaient **toute la plateforme** à n'importe quel compte
authentifié.

| Ressource | Finding (audit) | Avant | Après — `get_queryset` |
|---|---|---|---|
| Commentaires | `comments-no-project-isolation` (major) | tous les commentaires de la plateforme | `Q(annotation__project__memberships__user=user) | Q(author=user)`, sauf admin/reviewer transverse (`collaboration/views.py:19-30`) |
| Activité | `activity-no-project-isolation` (minor) | journal global | `Q(actor=user) | Q(target = annotations de mes projets)`, sauf admin/reviewer ; `?project` borné aux annotations du projet (`audit/views.py:24-57`) |

Détails :

- **Comment** (`collaboration/views.py:19-30`) — un utilisateur ne voit que les
  commentaires des projets dont il est **membre** (jointure `annotation__project__
  memberships__user`) **ou** dont il est **auteur**. `admin/reviewer` gardent la
  portée transverse. `.distinct()` évite les doublons de jointure m2m.
- **ActivityEvent** (`audit/views.py:42-57`) — ReadOnly ; pour un non‑privilégié,
  intersection avec `Q(actor=user) | Q(target_type="annotations.annotation",
  target_id ∈ annotations de mes projets)`. Le filtre `?project` (`views.py:23-35`)
  ne révèle que les événements ciblant des annotations du projet demandé.

---

## 4. Checklist OWASP‑light

### A01 — Broken Access Control (contrôle d'accès)

- [x] **Deny‑by‑default par appartenance projet** : `is_project_member`
  (`permissions.py:6-16`) ; chaque `get_queryset` filtre sur l'utilisateur sauf
  admin/reviewer (annotations `views.py:86-91`, clauses `views.py:395-402`,
  comments `collaboration/views.py:19-30`, activity `audit/views.py:42-57`,
  assignations `projects/views.py:73-74`).
- [x] **Object‑level enforcement** : `IsAnnotationOwner.has_object_permission`
  (`permissions.py:76-87`) ; `ClauseViewSet.get_object` re‑vérifie sur l'annotation
  parente (`annotations/views.py:404-408`).
- [x] **Pas d'IDOR de modification** : écriture du contenu owner‑only sans
  dérogation de rôle (`_OWNER_ONLY_ACTIONS` `views.py:55`, `IsAnnotationOwner`
  `permissions.py:60-71`). Couvert par test (`test_permissions.py:34-46`,
  `test_security_m9.py:72-114`).
- [x] **Non‑divulgation** : un objet hors périmètre n'est pas distingué de
  « inexistant » (403 **ou** 404 ; `test_security_m9.py:81,94,106`). Les projets
  publics renvoient 404 indistinct privé/inexistant (`projects/views.py:695-700`).
- [⚠️] **`IsAdminRole` = lecture authentifiée ouverte** (`permissions.py:22-26`) :
  pour les ressources « admin » (corpus, schemes, imports, **export jobs**), la
  confidentialité **dépend du `get_queryset`**. Finding `admin-only-reads-actually-open`
  (minor) : à confirmer côté PO si la lecture des jobs d'export d'autres projets
  doit être restreinte (aujourd'hui lisible par tout authentifié via
  `ExportJobViewSet`).

### A07 — Identification & Authentication Failures

- [x] **Rejet propre des anonymes** : `has_permission` explicite sur les
  permissions object‑level pour renvoyer 401 et non 500 (`permissions.py:42-48,
  73-74`).
- [x] **Rate‑limit login** + **rotation/blacklist JWT** (refresh consommé rejeté
  au replay) : `test_security_m9.py:37,118-140`.
- [x] **Vérification e‑mail** (`accounts/models.py:26`, chantier E).
- [x] **En‑têtes de sécurité / HSTS en prod** : `test_security_m9.py:212-219`.

### A01/A05 — Exposition d'artefacts d'export (confinement disque)

- [x] **Download confiné à `EXPORTS_DIR`** (anti path‑traversal) : `download`
  résout les chemins réels et **refuse tout fichier hors du dossier d'exports**
  via `os.path.commonpath([exports_dir, real]) == exports_dir` + `os.path.isfile`
  (`exports/views.py:28-31`). `EXPORTS_DIR` défini dans
  `backend/config/settings/base.py:65`.
- [x] **`artifact_path` jamais renvoyé brut** : seule l'action `download`
  (FileResponse `as_attachment`, `exports/views.py:32-36`) sert le fichier ;
  `filename` réduit à `basename` (pas de divulgation d'arborescence serveur).
  Corrige le finding `no-download-endpoint` (blocker).
- [x] **Déclenchement réservé admin** : POST exports `IsAdminRole`
  (`projects/views.py:610`).

---

## 5. Synthèse des invariants de sécurité

| Invariant | Énoncé | Garant (code) |
|---|---|---|
| **INV‑ISO** | Seul le propriétaire écrit le contenu de sa session ; aucune dérogation de rôle. | `IsAnnotationOwner` (`permissions.py:60-87`) + `_OWNER_ONLY_ACTIONS` (`annotations/views.py:55-60`) |
| **Indépendance lecture** | Un pair ne lit pas la session d'un autre ; admin/reviewer supervisent en lecture. | `get_queryset` annotation/clause (`annotations/views.py:86-91, 395-402`) ; test `test_security_m9.py:96-114` |
| **Isolation projet** | On ne touche/voit que les projets dont on est membre (sauf admin/reviewer). | `is_project_member` + `get_queryset` (comments/activity/assignations) |
| **INV‑DOC‑UNIQUE** | 1 document = 1 ligne ; sessions d'autrui masquées au pair. | `documents` action (`projects/views.py:251-327`) |
| **Confinement export** | L'artefact servi est strictement dans `EXPORTS_DIR`. | `download` (`exports/views.py:28-31`) |
