"""Role/project-based permissions (CONTRACT §3)."""

from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_project_member(user, project) -> bool:
    """True if ``user`` is an admin/owner or a member of ``project``.

    Centralises the project-isolation rule (security.md §2, A01): annotators
    only ever touch projects they belong to; admins/owners have full reach.
    """
    if not (user and user.is_authenticated):
        return False
    if getattr(user, "is_admin_role", False):
        return True
    return project.memberships.filter(user=user).exists()


class IsAdminRole(BasePermission):
    """Admin/owner role (or superuser) required for write; read open to authed."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return bool(request.user and request.user.is_authenticated
                    and request.user.is_admin_role)


class IsReviewerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return u.role in {"reviewer", "admin", "owner"} or u.is_superuser


class IsAnnotationOwnerOrReviewer(BasePermission):
    """Object-level: owner may edit; reviewers/admins may act on review.

    A view-level `has_permission` is REQUIRED here: without it, BasePermission's
    default returns True and anonymous requests reach `get_queryset`, which filters
    on `request.user` (AnonymousUser) and raises a 500 instead of a clean 401.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        u = request.user
        if request.method in SAFE_METHODS:
            return True
        annotator_id = getattr(obj, "annotator_id", None)
        if annotator_id == u.id:
            return True
        return u.role in {"reviewer", "admin", "owner"} or u.is_superuser


class IsAnnotationOwner(BasePermission):
    """Object-level: only the annotation's OWNER may write its CONTENT.

    Intégrité IAA (raffinement R1) : une annotation doit rester l'œuvre UNIQUE de
    son auteur. Contrairement à `IsAnnotationOwnerOrReviewer`, il n'y a AUCUNE
    dérogation de rôle — même un admin/reviewer ne peut éditer les clauses, la
    soumission, le statut ou la certitude d'un tiers (cela fausserait l'accord
    inter-annotateurs). Les reviewers agissent via les endpoints de revue
    (`reviews`, `comments`), jamais en modifiant le contenu.

    Lecture ouverte (l'isolation projet est assurée par `get_queryset`).
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return getattr(obj, "annotator_id", None) == request.user.id
