from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.Module1_Authentication.models import User
from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.common.tests.helpers import link_in
from apps.Module2_CompanyManagement.models import CompanyMember, InvitationStatus, StaffInvitation
from apps.Module2_CompanyManagement.services.invitations import hash_token

pytestmark = pytest.mark.django_db
LIST = "/api/company/invitations/"
LOGIN = "/api/auth/login/"
PASSWORD = "Sunny-Day-4711"


def public(token, accept=False):
    return f"/api/public/invitations/{token}/" + ("accept/" if accept else "")


def invite_payload(**overrides):
    payload = {"email": "New.Hire@Example.com", "full_name": "New Hire", "role": "recruiter", "job_title": "Recruiter"}
    payload.update(overrides)
    return payload


@pytest.fixture
def admin(company_with_admin):
    return company_with_admin[1]


@pytest.fixture
def sent(admin, auth_client, django_capture_on_commit_callbacks):
    """Create an invitation through the API and return (response body, raw token)."""
    with django_capture_on_commit_callbacks(execute=True):
        response = auth_client(admin).post(LIST, invite_payload(), format="json")
    assert response.status_code == 201
    return response.json(), link_in(mail.outbox[-1])[1]["token"]


class TestCreate:
    def test_creates_pending_invitation_and_emails_a_link(self, admin, auth_client, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = auth_client(admin).post(LIST, invite_payload(), format="json")
        assert response.status_code == 201
        body = response.json()
        assert set(body) == {"id", "email", "full_name", "role", "job_title", "status", "created_at", "expires_at", "accepted_at"}
        assert body["email"] == "new.hire@example.com" and body["status"] == "pending" and body["accepted_at"] is None
        assert "token" not in str(body) and "hash" not in str(body)
        assert len(mail.outbox) == 1 and mail.outbox[0].to == ["new.hire@example.com"]
        url, query = link_in(mail.outbox[0])
        assert "/accept-invite" in url and query["token"]
        assert admin.company_membership.company.name in mail.outbox[0].subject

    def test_only_the_hash_is_stored_and_expiry_is_seven_days(self, sent):
        body, raw = sent
        stored = StaffInvitation.objects.get()
        assert stored.token_hash == hash_token(raw) != raw and len(stored.token_hash) == 64
        assert raw not in str(stored.__dict__.values())
        delta = stored.expires_at - stored.created_at
        assert timedelta(days=6, hours=23) < delta <= timedelta(days=7, minutes=1)

    @pytest.mark.parametrize("role", [MemberRole.HR_MANAGER, MemberRole.RECRUITER, MemberRole.VIEWER])
    def test_non_admins_cannot_invite(self, member_factory, auth_client, role):
        member = member_factory(role)
        assert auth_client(member).post(LIST, invite_payload(), format="json").status_code == 403
        assert auth_client(member).get(LIST).status_code == 403
        assert StaffInvitation.objects.count() == 0

    def test_anonymous_and_outsiders(self, api_client, auth_client, user_factory, platform_admin):
        assert api_client.post(LIST, invite_payload(), format="json").status_code == 401
        assert auth_client(user_factory()).post(LIST, invite_payload(), format="json").status_code == 403
        assert auth_client(platform_admin).post(LIST, invite_payload(), format="json").status_code == 403

    def test_suspended_company_cannot_invite(self, member_factory, auth_client):
        admin = member_factory(MemberRole.ADMIN, company_status=CompanyStatus.SUSPENDED)
        assert auth_client(admin).post(LIST, invite_payload(), format="json").status_code == 403

    @pytest.mark.parametrize(
        "overrides,field",
        [
            ({"email": "nope"}, "email"),
            ({"email": ""}, "email"),
            ({"full_name": ""}, "full_name"),
            ({"role": "owner"}, "role"),
            ({"role": ""}, "role"),
            ({"job_title": "x" * 101}, "job_title"),
        ],
    )
    def test_validation(self, admin, auth_client, overrides, field):
        response = auth_client(admin).post(LIST, invite_payload(**overrides), format="json")
        assert response.status_code == 400 and field in response.json()
        assert StaffInvitation.objects.count() == 0

    def test_email_with_existing_account_is_rejected(self, admin, auth_client, user_factory):
        user_factory(email="taken@example.com")
        response = auth_client(admin).post(LIST, invite_payload(email="TAKEN@example.com"), format="json")
        assert response.status_code == 400
        assert response.json()["email"] == ["This email already has an IntelliHire account."]

    def test_duplicate_pending_invitation_is_rejected(self, admin, auth_client, sent):
        response = auth_client(admin).post(LIST, invite_payload(email="new.hire@example.com"), format="json")
        assert response.status_code == 400
        assert response.json()["email"] == ["An invitation is already pending for this email."]
        assert StaffInvitation.objects.count() == 1

    def test_same_email_can_be_invited_by_two_companies(self, admin, auth_client, member_factory):
        other_admin = member_factory(MemberRole.ADMIN)
        assert auth_client(admin).post(LIST, invite_payload(), format="json").status_code == 201
        assert auth_client(other_admin).post(LIST, invite_payload(), format="json").status_code == 201

    def test_can_invite_again_after_revoke_or_expiry(self, admin, auth_client, sent):
        body, _ = sent
        client = auth_client(admin)
        assert client.post(f"{LIST}{body['id']}/revoke/").status_code == 200
        assert client.post(LIST, invite_payload(), format="json").status_code == 201
        StaffInvitation.objects.filter(status=InvitationStatus.PENDING).update(expires_at=timezone.now() - timedelta(minutes=1))
        assert client.post(LIST, invite_payload(), format="json").status_code == 201

    def test_job_title_is_optional(self, admin, auth_client):
        payload = invite_payload()
        del payload["job_title"]
        response = auth_client(admin).post(LIST, payload, format="json")
        assert response.status_code == 201 and response.json()["job_title"] == ""


class TestListResendRevoke:
    def test_list_newest_first_and_filter(self, admin, auth_client):
        client = auth_client(admin)
        first = client.post(LIST, invite_payload(email="a@example.com"), format="json").json()
        second = client.post(LIST, invite_payload(email="b@example.com"), format="json").json()
        client.post(f"{LIST}{first['id']}/revoke/")
        listing = client.get(LIST).json()
        assert [i["email"] for i in listing] == ["b@example.com", "a@example.com"]
        assert [i["id"] for i in client.get(LIST, {"status": "pending"}).json()] == [second["id"]]
        assert [i["id"] for i in client.get(LIST, {"status": "revoked"}).json()] == [first["id"]]
        assert client.get(LIST, {"status": "bogus"}).json() and len(client.get(LIST, {"status": "bogus"}).json()) == 2

    def test_expired_invitations_show_as_expired(self, admin, auth_client, sent):
        StaffInvitation.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        client = auth_client(admin)
        assert client.get(LIST).json()[0]["status"] == "expired"
        assert StaffInvitation.objects.get().status == InvitationStatus.EXPIRED
        assert len(client.get(LIST, {"status": "expired"}).json()) == 1

    def test_resend_rotates_token_and_expiry_and_invalidates_old_link(self, admin, auth_client, api_client, sent, django_capture_on_commit_callbacks):
        body, old_raw = sent
        before = StaffInvitation.objects.get()
        with django_capture_on_commit_callbacks(execute=True):
            response = auth_client(admin).post(f"{LIST}{body['id']}/resend/")
        assert response.status_code == 200 and response.json()["status"] == "pending"
        after = StaffInvitation.objects.get()
        assert after.token_hash != before.token_hash and after.expires_at >= before.expires_at
        new_raw = link_in(mail.outbox[-1])[1]["token"]
        assert new_raw != old_raw and len(mail.outbox) == 2
        old = api_client.get(public(old_raw))
        assert old.status_code == 400 and old.json()["code"] == "invalid_invitation"
        assert api_client.get(public(new_raw)).status_code == 200

    def test_resend_revives_an_expired_invitation(self, admin, auth_client, sent):
        body, _ = sent
        StaffInvitation.objects.update(expires_at=timezone.now() - timedelta(days=1))
        response = auth_client(admin).post(f"{LIST}{body['id']}/resend/")
        assert response.status_code == 200 and response.json()["status"] == "pending"

    def test_resend_expired_blocked_when_newer_invitation_pending(self, admin, auth_client, sent):
        body, _ = sent
        StaffInvitation.objects.update(expires_at=timezone.now() - timedelta(days=1))
        client = auth_client(admin)
        assert client.post(LIST, invite_payload(), format="json").status_code == 201
        response = client.post(f"{LIST}{body['id']}/resend/")
        assert response.status_code == 409 and response.json()["code"] == "newer_invitation_pending"

    def test_revoke(self, admin, auth_client, api_client, sent):
        body, raw = sent
        response = auth_client(admin).post(f"{LIST}{body['id']}/revoke/")
        assert response.status_code == 200 and response.json()["status"] == "revoked"
        link = api_client.get(public(raw))
        assert link.status_code == 400 and link.json()["code"] == "revoked"

    @pytest.mark.parametrize("final", [InvitationStatus.REVOKED, InvitationStatus.ACCEPTED])
    def test_cannot_resend_or_revoke_finished_invitations(self, admin, auth_client, sent, final):
        body, _ = sent
        StaffInvitation.objects.update(status=final)
        client = auth_client(admin)
        for action in ("resend", "revoke"):
            response = client.post(f"{LIST}{body['id']}/{action}/")
            assert response.status_code == 409 and response.json()["code"] == "invalid_state"

    def test_cannot_revoke_expired(self, admin, auth_client, sent):
        body, _ = sent
        StaffInvitation.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        assert auth_client(admin).post(f"{LIST}{body['id']}/revoke/").status_code == 409

    def test_other_companys_invitation_is_404(self, admin, auth_client, member_factory, sent):
        body, _ = sent
        outsider = member_factory(MemberRole.ADMIN)
        client = auth_client(outsider)
        assert client.post(f"{LIST}{body['id']}/resend/").status_code == 404
        assert client.post(f"{LIST}{body['id']}/revoke/").status_code == 404
        assert client.get(LIST).json() == []
        assert StaffInvitation.objects.get().status == InvitationStatus.PENDING

    def test_unknown_invitation_is_404_and_non_admin_forbidden(self, admin, auth_client, member_factory, sent):
        body, _ = sent
        assert auth_client(admin).post(f"{LIST}00000000-0000-0000-0000-000000000000/revoke/").status_code == 404
        member = member_factory(MemberRole.RECRUITER, company=admin.company_membership.company)
        assert auth_client(member).post(f"{LIST}{body['id']}/revoke/").status_code == 403


class TestPublicDetails:
    def test_valid_token_shows_invite_context_without_leaking(self, api_client, sent, admin):
        _, raw = sent
        response = api_client.get(public(raw))
        assert response.status_code == 200
        assert response.json() == {
            "company": {"name": admin.company_membership.company.name, "logo": None},
            "role": "recruiter",
            "email": "new.hire@example.com",
            "full_name": "New Hire",
        }

    def test_unknown_token(self, api_client):
        response = api_client.get(public("definitely-not-a-token"))
        assert response.status_code == 400 and response.json()["code"] == "invalid_invitation"

    def test_expired_token(self, api_client, sent):
        _, raw = sent
        StaffInvitation.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        response = api_client.get(public(raw))
        assert response.status_code == 400 and response.json()["code"] == "expired"

    def test_company_no_longer_approved(self, api_client, sent):
        _, raw = sent
        for status, extra in ((CompanyStatus.SUSPENDED, {"suspension_reason": "Policy violation review."}),):
            StaffInvitation.objects.get().company.__class__.objects.update(status=status, **extra)
        response = api_client.get(public(raw))
        assert response.status_code == 400 and response.json()["code"] == "company_unavailable"

    def test_endpoint_needs_no_auth_even_with_a_bad_bearer(self, api_client, sent):
        _, raw = sent
        api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
        assert api_client.get(public(raw)).status_code == 200


class TestAccept:
    def accept(self, client, raw, **overrides):
        payload = {"full_name": "New Hire", "password": PASSWORD, "confirm_password": PASSWORD}
        payload.update(overrides)
        return client.post(public(raw, accept=True), payload, format="json")

    def test_accept_creates_active_verified_member_who_can_log_in(self, api_client, sent):
        body, raw = sent
        response = self.accept(api_client, raw, full_name="Hira Khan")
        assert response.status_code == 201 and response.json() == {"email": "new.hire@example.com", "status": "active"}
        user = User.objects.get(email="new.hire@example.com")
        assert (user.role, user.status, user.email_verified, user.full_name) == (UserRole.HR, UserStatus.ACTIVE, True, "Hira Khan")
        member = CompanyMember.objects.get(user=user)
        assert (member.role, member.job_title, member.is_active) == ("recruiter", "Recruiter", True)
        assert member.invited_by is not None
        invitation = StaffInvitation.objects.get()
        assert invitation.status == InvitationStatus.ACCEPTED and invitation.accepted_at is not None
        login = api_client.post(LOGIN, {"email": "new.hire@example.com", "password": PASSWORD}, format="json")
        assert login.status_code == 200 and login.json()["user"]["role"] == "hr"

    def test_accepting_as_admin_role(self, api_client, admin, auth_client, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            auth_client(admin).post(LIST, invite_payload(role="admin"), format="json")
        raw = link_in(mail.outbox[-1])[1]["token"]
        assert self.accept(api_client, raw).status_code == 201
        assert User.objects.get(email="new.hire@example.com").role == UserRole.COMPANY_ADMIN

    def test_link_works_once(self, api_client, sent):
        _, raw = sent
        assert self.accept(api_client, raw).status_code == 201
        again = self.accept(api_client, raw)
        assert again.status_code == 400 and again.json()["code"] == "already_used"
        details = api_client.get(public(raw))
        assert details.status_code == 400 and details.json()["code"] == "already_used"
        assert User.objects.filter(email="new.hire@example.com").count() == 1

    def test_response_never_returns_tokens(self, api_client, sent):
        _, raw = sent
        text = self.accept(api_client, raw).content.decode()
        assert "access" not in text and "refresh" not in text and "password" not in text

    @pytest.mark.parametrize(
        "overrides,field",
        [
            ({"password": "short1A", "confirm_password": "short1A"}, "password"),
            ({"password": "password123", "confirm_password": "password123"}, "password"),
            ({"password": "1234567890", "confirm_password": "1234567890"}, "password"),
            ({"confirm_password": "Different-4711"}, "confirm_password"),
            ({"full_name": ""}, "full_name"),
            ({"password": "new.hire@example", "confirm_password": "new.hire@example"}, "password"),
            ({"full_name": "Hira Khan", "password": "hirakhan99", "confirm_password": "hirakhan99"}, "password"),
        ],
    )
    def test_validation_errors_leave_invitation_usable(self, api_client, sent, overrides, field):
        _, raw = sent
        response = self.accept(api_client, raw, **overrides)
        assert response.status_code == 400 and field in response.json()
        assert User.objects.filter(email="new.hire@example.com").count() == 0
        assert StaffInvitation.objects.get().status == InvitationStatus.PENDING

    @pytest.mark.parametrize(
        "mutate,code",
        [
            (lambda inv: inv.__class__.objects.update(status=InvitationStatus.REVOKED), "revoked"),
            (lambda inv: inv.__class__.objects.update(expires_at=timezone.now() - timedelta(seconds=1)), "expired"),
            (lambda inv: inv.company.__class__.objects.update(status=CompanyStatus.SUSPENDED, suspension_reason="Policy violation."), "company_unavailable"),
        ],
    )
    def test_unusable_invitations(self, api_client, sent, mutate, code):
        _, raw = sent
        mutate(StaffInvitation.objects.select_related("company").get())
        response = self.accept(api_client, raw)
        assert response.status_code == 400 and response.json()["code"] == code
        assert User.objects.filter(email="new.hire@example.com").count() == 0

    def test_unknown_token(self, api_client):
        response = self.accept(api_client, "nope")
        assert response.status_code == 400 and response.json()["code"] == "invalid_invitation"

    def test_email_registered_after_invitation_is_refused(self, api_client, sent, user_factory):
        _, raw = sent
        user_factory(email="new.hire@example.com")
        response = self.accept(api_client, raw)
        assert response.status_code == 400 and response.json()["code"] == "email_taken"
        assert CompanyMember.objects.filter(user__email="new.hire@example.com").count() == 0

    def test_accept_is_throttled(self, api_client, sent):
        _, raw = sent
        statuses = [self.accept(api_client, "nope").status_code for _ in range(12)]
        assert statuses[-1] == 429
