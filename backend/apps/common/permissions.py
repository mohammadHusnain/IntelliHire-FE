from django.core.exceptions import ObjectDoesNotExist
from rest_framework.permissions import BasePermission

from .choices import CompanyStatus, MemberRole, UserRole

DENIED_MESSAGE = "Unauthorized access."


def get_membership(user):
    try:
        return user.company_membership
    except ObjectDoesNotExist:
        return None


class _RolePermission(BasePermission):
    message = DENIED_MESSAGE


class IsCandidate(_RolePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == UserRole.CANDIDATE)


class IsPlatformAdmin(_RolePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == UserRole.PLATFORM_ADMIN)


class IsCompanyUser(_RolePermission):
    """Company admin or HR with an active membership in an approved company."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.role in (UserRole.COMPANY_ADMIN, UserRole.HR)):
            return False
        membership = get_membership(user)
        return bool(membership and membership.is_active and membership.company.status == CompanyStatus.APPROVED)


def CompanyRole(*roles):
    """Permission class for company users whose member role is one of `roles`."""
    allowed = frozenset(roles)

    class _CompanyRole(IsCompanyUser):
        def has_permission(self, request, view):
            return super().has_permission(request, view) and get_membership(request.user).role in allowed

    _CompanyRole.__name__ = "CompanyRole_" + "_".join(sorted(allowed))
    return _CompanyRole


class IsCompanyAdmin(IsCompanyUser):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and get_membership(request.user).role == MemberRole.ADMIN
