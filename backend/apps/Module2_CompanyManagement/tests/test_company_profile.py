import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.common.choices import CompanyStatus, MemberRole
from apps.common.tests.helpers import make_image
from apps.Module2_CompanyManagement.models import Company

pytestmark = pytest.mark.django_db
URL = "/api/company/profile/"


def png(name="logo.png"):
    return SimpleUploadedFile(name, make_image("PNG"), content_type="image/png")


class TestAccess:
    def test_anonymous_is_401(self, api_client):
        assert api_client.get(URL).status_code == 401
        assert api_client.patch(URL, {}, format="json").status_code == 401

    def test_candidate_and_platform_admin_are_forbidden(self, auth_client, user_factory, platform_admin):
        assert auth_client(user_factory()).get(URL).status_code == 403
        assert auth_client(platform_admin).get(URL).status_code == 403

    @pytest.mark.parametrize("status", [CompanyStatus.PENDING, CompanyStatus.REJECTED, CompanyStatus.SUSPENDED])
    def test_unapproved_company_members_are_forbidden(self, member_factory, auth_client, status):
        # a pending/rejected founder cannot log in, but a stale token must not work either
        user = member_factory(MemberRole.ADMIN, company_status=status)
        assert auth_client(user).get(URL).status_code == 403

    @pytest.mark.parametrize("role", MemberRole.values)
    def test_every_active_member_can_read(self, member_factory, auth_client, role):
        assert auth_client(member_factory(role)).get(URL).status_code == 200

    @pytest.mark.parametrize("role", [MemberRole.HR_MANAGER, MemberRole.RECRUITER, MemberRole.VIEWER])
    def test_only_admin_can_edit(self, member_factory, auth_client, role):
        member = member_factory(role)
        response = auth_client(member).patch(URL, {"website": "https://x.example"}, format="json")
        assert response.status_code == 403
        assert response.json()["detail"] == "Unauthorized access."

    def test_deactivated_admin_is_locked_out(self, company_with_admin, auth_client):
        company, admin = company_with_admin
        membership = admin.company_membership
        membership.is_active = False
        membership.save()
        assert auth_client(admin).get(URL).status_code == 403


class TestRead:
    def test_shape_and_zero_completion(self, company_with_admin, auth_client):
        company, admin = company_with_admin
        body = auth_client(admin).get(URL).json()
        assert set(body) == {
            "id", "name", "slug", "industry", "official_email", "contact_phone", "website",
            "description", "headquarters", "logo", "company_size", "status", "profile_completion",
        }
        assert body["profile_completion"] == 0 and body["status"] == "approved" and body["logo"] is None

    def test_completion_counts_filled_optional_fields(self, company_with_admin, auth_client):
        company, admin = company_with_admin
        client = auth_client(admin)
        response = client.patch(URL, {"website": "https://acme.example", "description": "We build.", "headquarters": "Lahore"}, format="json")
        assert response.json()["profile_completion"] == 60
        response = client.patch(URL, {"company_size": "51-200"}, format="json")
        assert response.json()["profile_completion"] == 80
        response = client.patch(URL, {"logo": png()}, format="multipart")
        assert response.json()["profile_completion"] == 100


class TestEdit:
    def test_admin_edits_fields(self, company_with_admin, auth_client):
        company, admin = company_with_admin
        payload = {
            "industry": "Fintech", "contact_phone": "+92 300 1112233", "website": "https://acme.example",
            "description": "We hire well.", "headquarters": "Karachi", "company_size": "11-50",
        }
        response = auth_client(admin).patch(URL, payload, format="json")
        assert response.status_code == 200
        company.refresh_from_db()
        assert (company.industry, company.headquarters, company.company_size) == ("Fintech", "Karachi", "11-50")

    @pytest.mark.parametrize("field", ["official_email", "status", "slug", "id"])
    def test_read_only_fields_are_ignored(self, company_with_admin, auth_client, field):
        company, admin = company_with_admin
        before = getattr(company, field)
        auth_client(admin).patch(URL, {field: "hacked@example.com" if field == "official_email" else "pending" if field == "status" else "hacked" if field == "slug" else "11111111-1111-1111-1111-111111111111"}, format="json")
        company.refresh_from_db()
        assert getattr(company, field) == before

    @pytest.mark.parametrize(
        "payload,field",
        [
            ({"company_size": "huge"}, "company_size"),
            ({"website": "not a url"}, "website"),
            ({"contact_phone": "abc"}, "contact_phone"),
            ({"name": ""}, "name"),
            ({"description": "x" * 2001}, "description"),
            ({"industry": ""}, "industry"),
        ],
    )
    def test_invalid_input_is_400(self, company_with_admin, auth_client, payload, field):
        _, admin = company_with_admin
        response = auth_client(admin).patch(URL, payload, format="json")
        assert response.status_code == 400 and field in response.json()

    def test_rename_regenerates_slug(self, company_with_admin, auth_client):
        company, admin = company_with_admin
        response = auth_client(admin).patch(URL, {"name": "Brand New Name"}, format="json")
        assert response.status_code == 200 and response.json()["slug"] == "brand-new-name"

    def test_same_name_keeps_slug(self, company_with_admin, auth_client):
        company, admin = company_with_admin
        slug = company.slug
        response = auth_client(admin).patch(URL, {"name": company.name, "headquarters": "Lahore"}, format="json")
        assert response.status_code == 200 and response.json()["slug"] == slug

    def test_name_must_be_unique_case_insensitively(self, company_with_admin, company_factory, auth_client):
        _, admin = company_with_admin
        company_factory(name="Taken Name")
        response = auth_client(admin).patch(URL, {"name": "taken NAME"}, format="json")
        assert response.status_code == 400
        assert response.json()["name"] == ["A company with this name is already registered."]

    def test_case_only_rename_of_own_company_is_allowed(self, company_with_admin, auth_client):
        company, admin = company_with_admin
        response = auth_client(admin).patch(URL, {"name": company.name.upper()}, format="json")
        assert response.status_code == 200

    def test_edit_affects_only_own_company(self, company_with_admin, company_factory, auth_client):
        _, admin = company_with_admin
        other = company_factory(name="Bystander", status=CompanyStatus.APPROVED)
        auth_client(admin).patch(URL, {"headquarters": "Lahore"}, format="json")
        other.refresh_from_db()
        assert other.headquarters == ""

    def test_put_and_delete_not_allowed(self, company_with_admin, auth_client):
        _, admin = company_with_admin
        client = auth_client(admin)
        assert client.put(URL, {}, format="json").status_code == 405
        assert client.delete(URL).status_code == 405


class TestLogo:
    def test_upload_and_replace_deletes_old_file(self, company_with_admin, auth_client, django_capture_on_commit_callbacks):
        company, admin = company_with_admin
        client = auth_client(admin)
        with django_capture_on_commit_callbacks(execute=True):
            first = client.patch(URL, {"logo": png("a.png")}, format="multipart")
        assert first.status_code == 200 and first.json()["logo"]
        company.refresh_from_db()
        first_path = company.logo.path
        assert os.path.exists(first_path)
        with django_capture_on_commit_callbacks(execute=True):
            assert client.patch(URL, {"logo": png("b.png")}, format="multipart").status_code == 200
        company.refresh_from_db()
        assert company.logo.path != first_path and os.path.exists(company.logo.path)
        assert not os.path.exists(first_path)

    def test_remove_logo(self, company_with_admin, auth_client, django_capture_on_commit_callbacks):
        company, admin = company_with_admin
        client = auth_client(admin)
        with django_capture_on_commit_callbacks(execute=True):
            client.patch(URL, {"logo": png()}, format="multipart")
        company.refresh_from_db()
        path = company.logo.path
        with django_capture_on_commit_callbacks(execute=True):
            response = client.patch(URL, {"logo": None}, format="json")
        assert response.status_code == 200 and response.json()["logo"] is None
        assert not os.path.exists(path)

    @pytest.mark.parametrize(
        "name,content",
        [("x.png", b"not an image"), ("x.exe", make_image("PNG")), ("x.png", b"")],
    )
    def test_invalid_logo_is_400(self, company_with_admin, auth_client, name, content):
        _, admin = company_with_admin
        response = auth_client(admin).patch(URL, {"logo": SimpleUploadedFile(name, content, content_type="image/png")}, format="multipart")
        assert response.status_code == 400 and "logo" in response.json()

    def test_oversized_logo_is_400(self, company_with_admin, auth_client):
        _, admin = company_with_admin
        big = make_image("PNG", size=(10, 10)) + b"0" * (3 * 1024 * 1024)
        response = auth_client(admin).patch(URL, {"logo": SimpleUploadedFile("big.png", big, content_type="image/png")}, format="multipart")
        assert response.status_code == 400 and "logo" in response.json()
