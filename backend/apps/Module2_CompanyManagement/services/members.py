from django.db import transaction
from rest_framework.exceptions import NotFound

from apps.Module1_Authentication.auth_tokens import revoke_all_refresh_tokens
from apps.common.choices import MemberRole, UserRole
from apps.common.errors import ApiError

from ..models import CompanyMember


def members_of(company):
    return CompanyMember.objects.filter(company=company).select_related("user").order_by("joined_at", "pk")


def update_member(*, actor_membership, member_id, role=None, job_title=None, is_active=None):
    """Change a member's role, job title or active flag.

    Admins cannot change their own role or active flag, and the company must keep at
    least one active admin. All admin rows are locked in a fixed order so two admins
    acting on each other at the same moment cannot both succeed.
    """
    company = actor_membership.company
    with transaction.atomic():
        admins = list(
            CompanyMember.objects.select_for_update()
            .filter(company=company, role=MemberRole.ADMIN, is_active=True)
            .order_by("pk")
        )
        try:
            target = CompanyMember.objects.select_for_update().select_related("user").get(
                pk=member_id, company=company
            )
        except CompanyMember.DoesNotExist:
            raise NotFound("Member not found.")

        new_role = target.role if role is None else role
        new_active = target.is_active if is_active is None else is_active
        changes_access = (new_role, new_active) != (target.role, target.is_active)

        if changes_access and target.pk == actor_membership.pk:
            raise ApiError("You cannot change your own role or active status.", "cannot_modify_self")
        was_active_admin = any(admin.pk == target.pk for admin in admins)
        remains_active_admin = new_role == MemberRole.ADMIN and new_active
        others = [admin for admin in admins if admin.pk != target.pk]
        if was_active_admin and not remains_active_admin and not others:
            raise ApiError("The company must keep at least one active admin.", "last_admin")

        target.role, target.is_active = new_role, new_active
        if job_title is not None:
            target.job_title = job_title
        target.save()

        user_role = UserRole.COMPANY_ADMIN if new_role == MemberRole.ADMIN else UserRole.HR
        if target.user.role != user_role:
            target.user.role = user_role
            target.user.save(update_fields=["role"])
        if not new_active:
            revoke_all_refresh_tokens(target.user)
    return target
