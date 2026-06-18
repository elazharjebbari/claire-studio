"""Role/project-based permissions (CONTRACT §3)."""

from rest_framework.permissions import SAFE_METHODS, BasePermission


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
    """Object-level: owner may edit; reviewers/admins may act on review."""

    def has_object_permission(self, request, view, obj):
        u = request.user
        if request.method in SAFE_METHODS:
            return True
        annotator_id = getattr(obj, "annotator_id", None)
        if annotator_id == u.id:
            return True
        return u.role in {"reviewer", "admin", "owner"} or u.is_superuser
