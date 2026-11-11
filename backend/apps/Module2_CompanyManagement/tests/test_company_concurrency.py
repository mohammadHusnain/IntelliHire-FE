"""Race-condition tests: real threads, real committed transactions."""
import threading

import pytest
from django.core import mail
from django.db import connection

from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.Module1_Authentication.models import User
from apps.Module2_CompanyManagement.models import Company, CompanyMember, StaffInvitation

pytestmark = pytest.mark.django_db(transaction=True)
PASSWORD = "Sunny-Day-4711"


def run_parallel(count, make_call):
    """Run `make_call(i)` in `count` threads released together; return results in order."""
    barrier = threading.Barrier(count)
    results = [None] * count

    def worker(index):
        try:
            barrier.wait(timeout=10)
            results[index] = make_call(index)
        except Exception as exc:  # surfaced to the asserting test
            results[index] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    return results


def test_concurrent_approve_and_reject_decide_exactly_once(auth_client, platform_admin, user_factory, company_factory):
    founder = user_factory(role=UserRole.COMPANY_ADMIN, status=UserStatus.PENDING_APPROVAL)
    company = company_factory(created_by=founder, status=CompanyStatus.PENDING)
    CompanyMember.objects.create(company=company, user=founder, role=MemberRole.ADMIN)
    base = f"/api/platform-admin/companies/{company.pk}/"

    def call(index):
        client = auth_client(platform_admin)
        if index % 2:
            return client.post(base + "reject/", {"reason": "Details could not be verified."}, format="json").status_code
        return client.post(base + "approve/").status_code

    codes = run_parallel(6, call)
    # Since D-075 an approval may overturn a rejection, so two orders are valid: the approval comes first (one 200,
    # every reject is refused) or a rejection comes first and the first approval then overturns it (two 200s).
    # Every other call is a clean 409, and the company always ends approved.
    assert codes.count(200) in (1, 2) and codes.count(200) + codes.count(409) == 6, codes
    company.refresh_from_db()
    assert company.status == CompanyStatus.APPROVED
    to_founder = [m.subject for m in mail.outbox if m.to == [founder.email]]
    assert sum("has been approved" in subject for subject in to_founder) == 1
    assert sum("was not approved" in subject for subject in to_founder) == codes.count(200) - 1


def test_concurrent_accepts_create_one_user(api_client_factory, member_factory, auth_client):
    admin = member_factory(MemberRole.ADMIN)
    response = auth_client(admin).post(
        "/api/company/invitations/", {"email": "race@example.com", "full_name": "Race", "role": "viewer"}, format="json"
    )
    assert response.status_code == 201
    from apps.common.tests.helpers import link_in

    raw = link_in(mail.outbox[-1])[1]["token"]

    def call(_):
        client = api_client_factory()
        return client.post(
            f"/api/public/invitations/{raw}/accept/",
            {"full_name": "Race", "password": PASSWORD, "confirm_password": PASSWORD},
            format="json",
        ).status_code

    codes = run_parallel(5, call)
    assert codes.count(201) == 1 and all(code in (201, 400) for code in codes), codes
    assert User.objects.filter(email="race@example.com").count() == 1
    assert CompanyMember.objects.filter(user__email="race@example.com").count() == 1
    assert StaffInvitation.objects.get().status == "accepted"


def test_two_admins_deactivating_each_other_never_leave_zero_admins(auth_client, member_factory):
    first = member_factory(MemberRole.ADMIN)
    company = first.company_membership.company
    second = member_factory(MemberRole.ADMIN, company=company)
    pairs = [(first, second), (second, first)]

    def call(index):
        actor, target = pairs[index]
        return auth_client(actor).patch(
            f"/api/company/members/{target.company_membership.pk}/", {"is_active": False}, format="json"
        ).status_code

    codes = run_parallel(2, call)
    active_admins = CompanyMember.objects.filter(company=company, role="admin", is_active=True).count()
    assert active_admins >= 1, codes
    assert 200 in codes
    # the loser is stopped either by the last-admin guard (400) or by losing access first (401/403)
    assert codes.count(200) == 1 and all(code in (200, 400, 401, 403) for code in codes), codes


def test_concurrent_duplicate_company_names_create_one_company(api_client_factory):
    def call(index):
        return api_client_factory().post(
            "/api/auth/register/company/",
            {
                "company_name": "Race Corp", "industry": "Software", "official_email": f"owner{index}@racecorp.example",
                "admin_full_name": "Owner", "admin_phone": "+92 300 1234567", "password": PASSWORD, "confirm_password": PASSWORD,
            },
            format="json",
        ).status_code

    codes = run_parallel(4, call)
    assert codes.count(201) == 1 and all(code in (201, 400) for code in codes), codes
    assert Company.objects.filter(name__iexact="race corp").count() == 1
    assert User.objects.filter(email__endswith="@racecorp.example").count() == 1
