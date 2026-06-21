# Plan de raffinement — Gestion d'annotation (R1 → R4)

> Suite du plan de gestion d'annotation (`plan-gestion-annotation.md`, lots L1→L6 livrés).
> Ce document cadre **4 raffinements** ciblant la **fiabilité** et l'**intégrité du
> multi-annotateur**, puis leur mise en œuvre. Principe directeur rappelé par le
> commanditaire : *« chacun annote seul, sur sa session ; l'admin visualise
> l'avancement ; la multi-annotation sert l'accord (IAA) et la discussion, jamais
> l'édition croisée. »*

## Synthèse des 4 raffinements

| # | Raffinement | Pourquoi | Surface |
|---|-------------|----------|---------|
| **R1** | Lecture seule **stricte** sur l'annotation d'autrui | Intégrité IAA : une annotation doit rester l'œuvre **unique** de son auteur. Personne (même admin/reviewer) n'édite le contenu d'un tiers. | Backend (permissions) + Frontend (UX non-modifiable) |
| **R2** | Synchronisation `Assignment.status` ↔ état de l'`Annotation` | La file de travail (« Mes annotations ») et l'avancement admin doivent refléter la **réalité** (à faire / en cours / terminé) sans action manuelle. | Backend (signaux) |
| **R3** | Matrice IAA **paire-à-paire par document** + export CSV | Diagnostiquer *où* l'accord chute (quel document, quelle paire) et exporter pour analyse externe. | Backend (endpoint) + Frontend (tableau + export) |
| **R4** | Auto-sélection du projet courant | La nav projet-dépendante (file de travail, breadcrumbs) doit résoudre sans friction dès la connexion. | Frontend (store/TopBar) |

---

## R1 — Lecture seule stricte sur l'annotation d'autrui

### État des lieux (audit du code)
`IsAnnotationOwnerOrReviewer` (appliqué à `AnnotationViewSet` et `ClauseViewSet`)
autorise déjà l'écriture **uniquement** au propriétaire **OU** à un
`reviewer`/`admin`/`owner`. Conséquence :
- ✅ un **annotateur pair** ne peut **pas** modifier l'annotation d'un autre (403) — déjà garanti ;
- ⚠️ mais un **admin/reviewer/owner** *peut* éditer le contenu (clauses) d'un tiers — ce qui **corromprait l'IAA** (l'annotation ne serait plus l'œuvre d'une seule personne).

Côté UI, le bandeau « Lecture seule » existe (P7) mais les contrôles d'édition
restent **actifs** : un clic part vers un 403, expérience trompeuse.

### Décision
Le **contenu** d'une annotation (clauses, soumission, statut, certitude) est
**modifiable par le seul propriétaire**, sans dérogation de rôle. Les
reviewers/admins conservent : la **lecture** intégrale, les **commentaires**
(discussion), et les **actions de revue** (endpoint `reviews`, déjà `IsReviewerOrAdmin`)
qui pilotent la machine à états *sans* toucher aux clauses.

### Mise en œuvre
**Backend**
- Nouvelle permission `IsAnnotationOwner` (`common/permissions.py`) : objet
  modifiable **ssi** `annotator_id == user.id` ; lecture ouverte (l'isolation
  projet est gérée par le `get_queryset`). Aucune dérogation de rôle.
- `AnnotationViewSet.get_permissions()` : renvoie `IsAnnotationOwner` pour les
  actions d'écriture `{update, partial_update, destroy, submit, add_clause}` ;
  défaut `IsAnnotationOwnerOrReviewer` ailleurs (lecture, versions, comments,
  attribution, presence). L'action `reviews` garde son `IsReviewerOrAdmin`
  (déclaré sur le `@action`, propagé via `super().get_permissions()`).
- `ClauseViewSet.permission_classes = [IsAnnotationOwner]` (PATCH/DELETE clause
  réservés au propriétaire ; GET reste ouvert).

**Frontend**
- Store workspace : champ **`readOnly`** posé par `init`. Les mutateurs de contenu
  (`setBoundary`, `removeBoundary`, `updateDraft`, `setCertainty`,
  `resolveDivergence`, `replacePrefill`, `seedFromPreAnnotation`, `undo`, `redo`)
  **no-op** si `readOnly`. Comme les champs de l'Inspecteur sont *contrôlés*
  (`value` lié au draft), un mutateur no-op les rend naturellement non éditables.
- `AnnotationWorkspace` : `init({ ..., readOnly: !isMine })` ; **autosave désactivé**
  si `!isMine` (`useAutosave(isMine ? id : null)`) → zéro 403 parasite.
- `WorkspaceToolbar` : en lecture seule, désactive Soumettre, Snapshot, la
  certitude globale et le commutateur de pré-remplissage (actions serveur directes).

### Vérification
- pytest : un annotateur B reçoit **403** sur `PATCH /clauses/{id}` et
  `POST /annotations/{id}/clauses` d'une annotation de A ; un **admin** aussi sur
  le **contenu** ; le **propriétaire** reste 200. Reviewer garde l'accès `reviews`.
- vitest : `init({readOnly:true})` → `setBoundary`/`updateDraft` ne changent pas `draftClauses`.

---

## R2 — Synchronisation `Assignment.status` ↔ `Annotation`

### Problème
`Assignment.status` (pending/in_progress/done) ne bougeait pas tout seul : la file
« Mes annotations » regroupait tout en « À faire » même après travail.

### Décision — signaux Django (découplé, couvre **tous** les chemins d'écriture, y compris l'autosave)
`claire/projects/signals.py` :
- `recompute_assignment_status(annotation)` : retrouve l'`Assignment(project,
  document, assignee=annotator)` et applique :
  - `done` si `status ∈ {submitted, in_review, approved}` ;
  - sinon `in_progress` si l'annotation a ≥ 1 clause ;
  - sinon `pending`.
  Écrit seulement si le statut change (`update_fields=["status"]`).
- Receivers : `post_save(Annotation)`, `post_save(Clause)`, `post_delete(Clause)`
  (dernière clause retirée → retour `pending`).
- Enregistrement dans `ProjectsConfig.ready()` (`from . import signals`).

Coût négligeable : `clauses.exists()` (EXISTS) + au plus un `UPDATE` ; les
recomputes successifs de l'autosave convergent (no-op dès `in_progress`).

### Vérification
pytest : créer assignment pending → créer annotation (reste pending) → ajouter
clause (→ in_progress) → submit (→ done) → supprimer la clause d'un brouillon
(→ pending).

---

## R3 — Matrice IAA paire-à-paire par document + export CSV

### État des lieux
`project_iaa(project)` calcule **déjà** `pairs = [{document, annotator_a,
annotator_b, kappa, n_sentences}]` mais l'endpoint `progress` n'expose que la
moyenne (`mean_kappa`) et `iaa_detail` (par thème). Les paires ne sont pas
remontées.

### Mise en œuvre
**Backend** — action `iaa` sur `ProjectViewSet` :
`GET /projects/{slug}/iaa` → `{ mean_kappa, pairs, detail }` (réutilise
`project_iaa` + `project_iaa_detail`).

**Frontend**
- `endpoints.getProjectIaa(slug)` + `hooks.useProjectIaa(slug)` ; types
  `ProjectIaa { meanKappa, pairs, detail }` et `IaaPair { document, annotatorA,
  annotatorB, kappa, nSentences }` (camelCase via le pont DRF).
- `IaaTab` : sous les cartes existantes (κ global / frontières / paires) et le
  tableau par thème, ajoute un **tableau paire-à-paire groupé par document**
  (coloration κ < 0,4 danger / < 0,6 warning / ≥ 0,6 success) + bouton
  **« Exporter CSV »** (génération client-side : `Blob` → téléchargement
  `iaa-{slug}.csv`, colonnes document, annotateur A, annotateur B, kappa, n_phrases).

### Vérification
pytest : 2 annotations soumises d'un même document → `GET .../iaa` renvoie ≥ 1
paire avec `kappa`. tsc : types alignés.

---

## R4 — Auto-sélection du projet courant

### Problème
`useCurrentProjectSlug` retombe sur le 1er projet mais **ne persiste pas** ce
choix ; le sélecteur de la TopBar pouvait afficher « Sélectionner un projet… »
alors qu'un projet effectif existait, et la file de travail restait muette.

### Mise en œuvre (frontend)
- `TopBar` : effet — si `currentProjectSlug` est nul et que des projets sont
  chargés, sélectionner (et persister) le **premier** (`setCurrentProject`).
- `AnnotationWorkspace` : à l'ouverture d'une annotation, aligner
  `currentProject = annotation.projectSlug` (la nav projet-dépendante suit le
  document réellement ouvert).

### Vérification
Manuelle/e2e : connexion → un projet est sélectionné d'office → « Mes
annotations » liste les documents sans manipulation.

---

## Ordre d'exécution & runbook
1. R1 backend (permissions) → R2 (signaux) → R3 backend (endpoint).
2. R1/R3/R4 frontend (store, workspace, toolbar, topbar, IaaTab, endpoints/hooks/types).
3. `pytest` (backend), `npm run typecheck` + `vitest` + `build` (frontend), e2e.
4. Déploiement `./deploy/deploy-claire.sh` ; vérif prod : 403 d'édition croisée,
   file de travail correctement groupée, onglet IAA paire-à-paire + export.

**Rollback** : les 4 raffinements sont additifs et indépendants ; revert ciblé
par commit si besoin. Aucune migration de schéma (R2 n'ajoute pas de champ ;
les statuts existent déjà).
