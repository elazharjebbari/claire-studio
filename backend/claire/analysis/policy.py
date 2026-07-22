"""Politique d'accès centralisée du module Analysis."""

from dataclasses import dataclass

from claire.projects.models import MembershipRole


@dataclass(frozen=True)
class AnalysisAccess:
    personal_only: bool
    may_include_other_drafts: bool
    may_create_project_artifact: bool


def access_for(user, project) -> AnalysisAccess:
    if user.is_admin_role:
        return AnalysisAccess(False, True, True)
    membership = project.memberships.filter(user=user).first()
    if membership is None:
        raise PermissionError("project_membership_required")
    if membership.role == MembershipRole.LEAD:
        return AnalysisAccess(False, True, True)
    if membership.role == MembershipRole.REVIEWER:
        return AnalysisAccess(False, False, True)
    return AnalysisAccess(True, True, False)


def can_read_artifact(user, artifact) -> bool:
    if user.is_admin_role or artifact.created_by_id == user.id:
        return True
    membership = artifact.project.memberships.filter(user=user).first()
    if membership is None:
        return False
    visibility = getattr(artifact, "visibility", None)
    return visibility == "project" and membership.role in {
        MembershipRole.REVIEWER,
        MembershipRole.LEAD,
    }
