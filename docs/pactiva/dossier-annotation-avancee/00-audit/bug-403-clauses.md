# Bug bloquant — 403 sur PATCH/DELETE /clauses (corrigé)

## Symptômes (rapportés)
- `GET /api/v1/annotations/5/presence` → 404 (transitoire, avant chargement)
- `PATCH /api/v1/clauses/2` → **403** en boucle ; `DELETE /api/v1/clauses/5` → **403**
  en boucle (tempête réseau, ~1 req/1,3 s).

## Données (prod)
- `annotation 5` (doc 9gag, projet campagne-pactiva) appartient à **elazhar.jebbari**
  (id 5, owner/superuser).
- `clause 2` **et** `clause 5` appartiennent à **annotation 5** → donc à **elazhar**.
- `presence` annotation 5 → **200** (la session VOIT bien son annotation) ; mais
  `PATCH/DELETE /clauses` → **403**.
- Indice décisif : `add_clause` (POST) **fonctionnait** (l'annotation est passée de
  3 à 5 clauses), seul `PATCH/DELETE` échouait.

## Cause racine
`ClauseViewSet.permission_classes = [IsAnnotationOwner]` (correctif R1). Or DRF
(`GenericAPIView.get_object`) appelle `check_object_permissions(request, obj)` sur
l'**objet du queryset** — ici la **Clause** — *avant* le check explicite sur
l'annotation. `IsAnnotationOwner.has_object_permission` testait
`getattr(obj, "annotator_id", None) == request.user.id`. Une **Clause n'a pas**
d'attribut `annotator_id` → `None` → **403, même pour le propriétaire**.
- `add_clause` passait car il est porté par `AnnotationViewSet` → l'objet vérifié EST
  l'**Annotation** (qui a `annotator_id`).
- L'ancienne permission `IsAnnotationOwnerOrReviewer` masquait le défaut via son
  **fallback de rôle** (`owner`/`admin`/`reviewer`) — supprimé par R1 pour
  l'intégrité IAA, révélant le bug.

## Correctif (déployé, commit `bdb14ca`)
`IsAnnotationOwner.has_object_permission` remonte au propriétaire depuis une **Clause
ou** une **Annotation** :
```python
owner_id = getattr(obj, "annotator_id", None)
if owner_id is None:
    owner_id = getattr(getattr(obj, "annotation", None), "annotator_id", None)
return owner_id is not None and owner_id == request.user.id
```
+ **Test de régression** : le propriétaire PATCH **et** DELETE sa propre clause (200/204) ;
non-propriétaire (admin inclus) → 403.
+ **Frontend** : `isMine` **sûr par défaut** (lecture seule tant que `me`/annotation
non confirmés) → plus d'écriture sous identité incertaine.

## Dette résiduelle (à traiter dans le plan)
- **Autosave** : ne doit PAS réessayer sur 401/403 (erreurs terminales) → afficher un
  état clair (« non autorisé / session expirée ») et stopper. Cf. `06`/`07`.
- Généraliser les tests d'objets-permission (clause vs annotation) à tous les
  ViewSets dérivés.
