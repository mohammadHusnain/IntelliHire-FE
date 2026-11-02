from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from apps.Module1_Authentication.models import User
from apps.Module2_CompanyManagement.models import Company, CompanyMember, StaffInvitation

pytestmark = pytest.mark.django_db


class TestCompany:
    def test_slug_is_generated_from_the_name_and_kept_on_resave(self, company_factory):
        company = company_factory(name="Acme Software Ltd.")
        assert company.slug == "acme-software-ltd"
        company.industry = "Other"
        company.save()
        assert Company.objects.get(pk=company.pk).slug == "acme-software-ltd"

    def test_clashing_slugs_get_a_numeric_suffix(self, company_factory):
        assert company_factory(name="Acme!").slug == "acme"
        assert company_factory(name="ACME?").slug == "acme-2"

    def test_name_without_letters_falls_back_to_a_default_slug(self, company_factory):
        assert company_factory(name="!!!").slug == "company"

    def test_defaults(self, company_factory):
        company = company_factory()
        assert company.status == Company.Status.PENDING
        assert company.company_size == "" and company.rejection_reason == ""
        assert len(str(company.pk)) == 36

    def test_name_is_unique_regardless_of_case(self, company_factory):
        company_factory(name="Acme")
        with pytest.raises(IntegrityError), transaction.atomic():
            company_factory(name="ACME")

    def test_rejected_company_must_have_a_reason(self, company_factory):
        company = company_factory()
        company.status = Company.Status.REJECTED
        with pytest.raises(IntegrityError), transaction.atomic():
            company.save()
        company.rejection_reason = "Incomplete registration details."
        company.save()

    def test_database_rejects_unknown_status_and_size(self, company_factory):
        company = company_factory()
        with pytest.raises(IntegrityError), transaction.atomic():
            Company.objects.filter(pk=company.pk).update(status="deleted")
        with pytest.raises(IntegrityError), transaction.atomic():
            Company.objects.filter(pk=company.pk).update(company_size="huge")
        Company.objects.filter(pk=company.pk).update(company_size="201-1000")

    def test_founding_user_cannot_be_deleted_while_company_exists(self, company_factory):
        company = company_factory()
        with pytest.raises(ProtectedError):
            company.created_by.delete()

    def test_reviewer_link_is_cleared_if_the_reviewer_is_deleted(self, company_factory, user_factory):
        reviewer = user_factory(role=User.Role.PLATFORM_ADMIN)
        company = company_factory(reviewed_by=reviewer)
        reviewer.delete()
        company.refresh_from_db()
        assert company.reviewed_by is None


class TestCompanyMember:
    def test_a_user_belongs_to_one_company_only(self, company_factory, user_factory):
        user = user_factory(role=User.Role.HR)
        CompanyMember.objects.create(company=company_factory(), user=user, role=CompanyMember.Role.RECRUITER)
        with pytest.raises(IntegrityError), transaction.atomic():
            CompanyMember.objects.create(company=company_factory(), user=user, role=CompanyMember.Role.VIEWER)

    def test_relations_and_defaults(self, company_factory, user_factory):
        company = company_factory()
        user = user_factory(role=User.Role.HR)
        member = CompanyMember.objects.create(company=company, user=user, role=CompanyMember.Role.HR_MANAGER)
        assert member.is_active and member.invited_by is None and member.joined_at
        assert user.company_membership == member
        assert list(company.members.all()) == [member]

    def test_database_rejects_unknown_role(self, company_factory, user_factory):
        member = CompanyMember.objects.create(
            company=company_factory(), user=user_factory(role=User.Role.HR), role=CompanyMember.Role.VIEWER
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            CompanyMember.objects.filter(pk=member.pk).update(role="owner")

    def test_membership_is_deleted_with_its_user(self, company_factory, user_factory):
        user = user_factory(role=User.Role.HR)
        CompanyMember.objects.create(company=company_factory(), user=user, role=CompanyMember.Role.VIEWER)
        user.delete()
        assert CompanyMember.objects.count() == 0


class TestStaffInvitation:
    def invite(self, company, inviter, **overrides):
        fields = {
            "company": company,
            "email": "new.hire@example.com",
            "full_name": "New Hire",
            "role": StaffInvitation.Role.RECRUITER,
            "invited_by": inviter,
            "expires_at": timezone.now() + timedelta(days=7),
        }
        fields.update(overrides)
        fields.setdefault("token_hash", f"{StaffInvitation.objects.count():064d}")
        return StaffInvitation.objects.create(**fields)

    def test_email_is_lowercased_and_status_defaults_to_pending(self, company_factory):
        company = company_factory()
        invitation = self.invite(company, company.created_by, email="  New.Hire@Example.COM ")
        assert invitation.email == "new.hire@example.com"
        assert invitation.status == StaffInvitation.Status.PENDING

    def test_only_one_pending_invitation_per_company_and_email(self, company_factory):
        company = company_factory()
        self.invite(company, company.created_by)
        with pytest.raises(IntegrityError), transaction.atomic():
            self.invite(company, company.created_by)

    @pytest.mark.parametrize("status", ["accepted", "revoked", "expired"])
    def test_a_new_invitation_is_allowed_after_the_old_one_is_closed(self, company_factory, status):
        company = company_factory()
        old = self.invite(company, company.created_by)
        old.status = status
        old.save()
        self.invite(company, company.created_by)

    def test_same_email_can_be_invited_by_different_companies(self, company_factory):
        first, second = company_factory(), company_factory()
        self.invite(first, first.created_by)
        self.invite(second, second.created_by)

    def test_token_hash_is_unique(self, company_factory):
        company = company_factory()
        self.invite(company, company.created_by, token_hash="a" * 64)
        with pytest.raises(IntegrityError), transaction.atomic():
            self.invite(company, company.created_by, email="other@example.com", token_hash="a" * 64)

    def test_database_rejects_non_lowercase_email_unknown_role_and_status(self, company_factory):
        company = company_factory()
        invitation = self.invite(company, company.created_by)
        for change in ({"email": "UP@example.com"}, {"role": "boss"}, {"status": "lost"}):
            with pytest.raises(IntegrityError), transaction.atomic():
                StaffInvitation.objects.filter(pk=invitation.pk).update(**change)
