import pytest
from django.core import mail

from apps.common.choices import CompanyStatus, MemberRole, UserStatus

pytestmark = pytest.mark.django_db
BASE = "/api/platform-admin/companies/"
LOGIN = "/api/auth/login/"
REASON = "The submitted details could not be verified."


def url(company, action=""):
    return f"{BASE}{company.pk}/{action + '/' if action else ''}"


class TestPermissions:
    @pytest.mark.parametrize("method,suffix", [("get", ""), ("get", "x"), ("post", "approve"), ("post", "reject"), ("post", "suspend"), ("post", "reactivate")])
    def test_anonymous_is_401(self, api_client, pending_company, method, suffix):
        path = BASE if suffix == "" else (url(pending_company) if suffix == "x" else url(pending_company, suffix))
        assert getattr(api_client, method)(path).status_code == 401

    @pytest.mark.parametrize("role", ["candidate", "company_admin", "hr"])
    def test_other_roles_are_forbidden(self, auth_client, user_factory, member_factory, pending_company, role):
        user = member_factory(MemberRole.ADMIN) if role == "company_admin" else (
            member_factory(MemberRole.RECRUITER) if role == "hr" else user_factory()
        )
        client = auth_client(user)
        assert client.get(BASE).status_code == 403
        assert client.get(url(pending_company)).status_code == 403
        assert client.post(url(pending_company, "approve")).status_code == 403
        assert client.post(url(pending_company, "reject"), {"reason": REASON}, format="json").status_code == 403
        assert client.post(url(pending_company, "suspend"), {"reason": REASON}, format="json").status_code == 403
        assert client.post(url(pending_company, "reactivate")).status_code == 403
        pending_company.refresh_from_db()
        assert pending_company.status == CompanyStatus.PENDING

    def test_forbidden_message(self, auth_client, user_factory):
        response = auth_client(user_factory()).get(BASE)
        assert response.json()["detail"] == "Unauthorized access."


class TestListAndDetail:
    def test_default_lists_only_pending_newest_first(self, admin_client, company_factory):
        old = company_factory(name="Old Co")
        new = company_factory(name="New Co")
        company_factory(name="Done Co", status=CompanyStatus.APPROVED)
        response = admin_client.get(BASE)
        assert response.status_code == 200
        assert [c["name"] for c in response.json()["results"]] == ["New Co", "Old Co"]
        assert {c["id"] for c in response.json()["results"]} == {str(old.pk), str(new.pk)}

    def test_list_items_expose_admin_summary_and_no_secrets(self, admin_client, pending_company):
        item = admin_client.get(BASE).json()["results"][0]
        assert set(item) == {"id", "name", "industry", "official_email", "contact_phone", "status", "created_at", "admin"}
        assert set(item["admin"]) == {"id", "full_name", "email", "email_verified", "status", "date_joined"}
        assert "password" not in str(item)

    @pytest.mark.parametrize("wanted,expected", [("approved", {"B"}), ("rejected", {"C"}), ("suspended", {"D"}), ("pending", {"A"}), ("all", {"A", "B", "C", "D"})])
    def test_status_filter(self, admin_client, company_factory, wanted, expected):
        company_factory(name="A")
        company_factory(name="B", status=CompanyStatus.APPROVED)
        company_factory(name="C", status=CompanyStatus.REJECTED, rejection_reason=REASON)
        company_factory(name="D", status=CompanyStatus.SUSPENDED, suspension_reason=REASON)
        response = admin_client.get(BASE, {"status": wanted})
        assert {c["name"] for c in response.json()["results"]} == expected

    def test_list_is_paginated(self, admin_client, company_factory):
        for _ in range(3):
            company_factory()
        body = admin_client.get(BASE, {"page_size": 2}).json()
        assert body["count"] == 3 and len(body["results"]) == 2 and body["next"]

    def test_invalid_status_is_400(self, admin_client):
        assert admin_client.get(BASE, {"status": "bogus"}).status_code == 400

    def test_search_matches_name_or_official_email_case_insensitively(self, admin_client, company_factory):
        company_factory(name="Zeta Labs", official_email="people@zeta.example")
        company_factory(name="Other", official_email="hr@acme.example")
        assert [c["name"] for c in admin_client.get(BASE, {"search": "zeta"}).json()["results"]] == ["Zeta Labs"]
        assert [c["name"] for c in admin_client.get(BASE, {"search": "ACME.EXAMPLE"}).json()["results"]] == ["Other"]
        assert admin_client.get(BASE, {"search": "nothing-like-this"}).json()["results"] == []

    def test_detail_has_full_record(self, admin_client, pending_company):
        body = admin_client.get(url(pending_company)).json()
        assert body["id"] == str(pending_company.pk) and body["status"] == "pending"
        assert {"description", "website", "headquarters", "rejection_reason", "suspension_reason", "reviewed_by", "reviewed_at", "admin"} <= set(body)
        assert body["reviewed_by"] is None and body["admin"]["email"] == pending_company.created_by.email

    def test_unknown_company_is_404(self, admin_client):
        assert admin_client.get(BASE + "00000000-0000-0000-0000-000000000000/").status_code == 404
        assert admin_client.post(BASE + "00000000-0000-0000-0000-000000000000/approve/").status_code == 404

    def test_malformed_id_is_404(self, admin_client):
        assert admin_client.get(BASE + "not-a-uuid/").status_code == 404


class TestApprove:
    def test_approve_activates_company_and_founder_and_emails_them(self, admin_client, platform_admin, pending_company, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = admin_client.post(url(pending_company, "approve"))
        assert response.status_code == 200 and response.json()["status"] == "approved"
        pending_company.refresh_from_db()
        assert pending_company.status == CompanyStatus.APPROVED
        assert pending_company.reviewed_by == platform_admin and pending_company.reviewed_at is not None
        assert pending_company.created_by.status == UserStatus.ACTIVE
        assert [m.to for m in mail.outbox] == [[pending_company.created_by.email]]
        assert "approved" in mail.outbox[0].subject and "/login" in mail.outbox[0].body

    def test_founder_can_log_in_only_after_approval(self, api_client, admin_client, pending_company):
        creds = {"email": pending_company.created_by.email, "password": "Str0ng!pass-123"}
        before = api_client.post(LOGIN, creds, format="json")
        assert before.status_code == 403 and before.json()["code"] == "pending_approval"
        admin_client.post(url(pending_company, "approve"))
        assert api_client.post(LOGIN, creds, format="json").status_code == 200

    def test_approving_with_unverified_founder_keeps_pending_verification(self, admin_client, pending_company):
        founder = pending_company.created_by
        founder.email_verified, founder.status = False, UserStatus.PENDING_VERIFICATION
        founder.save()
        admin_client.post(url(pending_company, "approve"))
        founder.refresh_from_db()
        assert founder.status == UserStatus.PENDING_VERIFICATION

    @pytest.mark.parametrize("status", [CompanyStatus.APPROVED, CompanyStatus.SUSPENDED])
    def test_cannot_approve_an_approved_or_suspended_company(self, admin_client, company_factory, status):
        extra = {"suspension_reason": REASON} if status == CompanyStatus.SUSPENDED else {}
        company = company_factory(status=status, **extra)
        response = admin_client.post(url(company, "approve"))
        assert response.status_code == 409 and response.json()["code"] == "already_reviewed"
        assert response.json()["detail"] == "Company has already been reviewed."

    def test_approving_a_rejected_company_overturns_the_rejection(self, api_client, admin_client, platform_admin, pending_company, django_capture_on_commit_callbacks):
        admin_client.post(url(pending_company, "reject"), {"reason": REASON}, format="json")
        founder = pending_company.created_by
        founder.refresh_from_db()
        assert founder.status == UserStatus.REJECTED
        mail.outbox.clear()
        with django_capture_on_commit_callbacks(execute=True):
            response = admin_client.post(url(pending_company, "approve"))
        assert response.status_code == 200 and response.json()["status"] == "approved"
        pending_company.refresh_from_db()
        founder.refresh_from_db()
        assert pending_company.status == CompanyStatus.APPROVED
        assert pending_company.rejection_reason == "" and pending_company.reviewed_by == platform_admin
        assert founder.status == UserStatus.ACTIVE
        assert [m.to for m in mail.outbox] == [[founder.email]]
        login = api_client.post(LOGIN, {"email": founder.email, "password": "Str0ng!pass-123"}, format="json")
        assert login.status_code == 200

    def test_an_overturned_rejection_cannot_be_approved_twice(self, admin_client, pending_company):
        admin_client.post(url(pending_company, "reject"), {"reason": REASON}, format="json")
        assert admin_client.post(url(pending_company, "approve")).status_code == 200
        assert admin_client.post(url(pending_company, "approve")).status_code == 409

    def test_double_approve_sends_one_email(self, admin_client, pending_company, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            assert admin_client.post(url(pending_company, "approve")).status_code == 200
            assert admin_client.post(url(pending_company, "approve")).status_code == 409
        assert len(mail.outbox) == 1


class TestReject:
    def test_reject_stores_reason_marks_founder_and_emails_reason(self, admin_client, platform_admin, pending_company, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = admin_client.post(url(pending_company, "reject"), {"reason": REASON}, format="json")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "rejected" and body["rejection_reason"] == REASON
        pending_company.refresh_from_db()
        assert pending_company.reviewed_by == platform_admin
        assert pending_company.created_by.status == UserStatus.REJECTED
        assert REASON in mail.outbox[0].body and "/resubmit-company" in mail.outbox[0].body

    @pytest.mark.parametrize("payload", [{}, {"reason": ""}, {"reason": "   "}, {"reason": "too short"}])
    def test_reason_is_required_with_minimum_length(self, admin_client, pending_company, payload):
        response = admin_client.post(url(pending_company, "reject"), payload, format="json")
        assert response.status_code == 400 and "reason" in response.json()
        pending_company.refresh_from_db()
        assert pending_company.status == CompanyStatus.PENDING

    def test_reason_too_long_is_400(self, admin_client, pending_company):
        assert admin_client.post(url(pending_company, "reject"), {"reason": "x" * 2001}, format="json").status_code == 400

    def test_rejected_founder_login_is_blocked(self, api_client, admin_client, pending_company):
        admin_client.post(url(pending_company, "reject"), {"reason": REASON}, format="json")
        response = api_client.post(LOGIN, {"email": pending_company.created_by.email, "password": "Str0ng!pass-123"}, format="json")
        assert response.status_code == 403 and response.json()["code"] == "rejected"

    def test_cannot_reject_twice_or_after_approval(self, admin_client, pending_company):
        admin_client.post(url(pending_company, "approve"))
        response = admin_client.post(url(pending_company, "reject"), {"reason": REASON}, format="json")
        assert response.status_code == 409 and response.json()["code"] == "already_reviewed"


class TestSuspendReactivate:
    def test_suspend_blocks_company_endpoints_and_reactivate_restores_them(self, admin_client, auth_client, company_with_admin):
        company, admin = company_with_admin
        client = auth_client(admin)
        assert client.get("/api/company/profile/").status_code == 200
        response = admin_client.post(url(company, "suspend"), {"reason": REASON}, format="json")
        assert response.status_code == 200 and response.json()["status"] == "suspended"
        assert response.json()["suspension_reason"] == REASON
        assert client.get("/api/company/profile/").status_code == 403
        response = admin_client.post(url(company, "reactivate"))
        assert response.status_code == 200 and response.json()["status"] == "approved"
        assert response.json()["suspension_reason"] == ""
        assert client.get("/api/company/profile/").status_code == 200

    def test_suspend_requires_reason(self, admin_client, company_with_admin):
        company, _ = company_with_admin
        assert admin_client.post(url(company, "suspend"), {}, format="json").status_code == 400
        assert admin_client.post(url(company, "suspend"), {"reason": "short"}, format="json").status_code == 400
        company.refresh_from_db()
        assert company.status == CompanyStatus.APPROVED

    @pytest.mark.parametrize("status", [CompanyStatus.PENDING, CompanyStatus.REJECTED, CompanyStatus.SUSPENDED])
    def test_only_approved_can_be_suspended(self, admin_client, company_factory, status):
        extra = {"rejection_reason": REASON} if status == CompanyStatus.REJECTED else {"suspension_reason": REASON} if status == CompanyStatus.SUSPENDED else {}
        company = company_factory(status=status, **extra)
        response = admin_client.post(url(company, "suspend"), {"reason": REASON}, format="json")
        assert response.status_code == 409 and response.json()["code"] == "invalid_state"

    @pytest.mark.parametrize("status", [CompanyStatus.PENDING, CompanyStatus.APPROVED, CompanyStatus.REJECTED])
    def test_only_suspended_can_be_reactivated(self, admin_client, company_factory, status):
        extra = {"rejection_reason": REASON} if status == CompanyStatus.REJECTED else {}
        company = company_factory(status=status, **extra)
        response = admin_client.post(url(company, "reactivate"))
        assert response.status_code == 409 and response.json()["code"] == "invalid_state"

    def test_suspended_company_can_still_log_in_but_company_endpoints_are_403(self, api_client, admin_client, company_with_admin):
        company, admin = company_with_admin
        admin_client.post(url(company, "suspend"), {"reason": REASON}, format="json")
        login = api_client.post(LOGIN, {"email": admin.email, "password": "Str0ng!pass-123"}, format="json")
        assert login.status_code == 200
