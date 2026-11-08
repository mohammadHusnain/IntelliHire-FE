import pytest

from apps.common.choices import MemberRole
from apps.Module4_ApplicationManagement.models import Application, ApplicationNote

from .helpers import APPLICATIONS, app_url, apply_url, form

pytestmark = pytest.mark.django_db


@pytest.fixture
def application(api_client, open_job):
    response = api_client.post(apply_url(open_job), form(), format="multipart")
    assert response.status_code == 201
    return Application.objects.get(reference=response.json()["reference"])


def post(client, application, text="Spoke to her on the phone"):
    return client.post(app_url(application, "notes"), {"text": text}, format="json")


class TestAccess:
    def test_anonymous_and_outsiders(self, api_client, auth_client, user_factory, application):
        assert api_client.get(app_url(application, "notes")).status_code == 401
        assert post(api_client, application).status_code == 401
        outsider = auth_client(user_factory())
        assert outsider.get(app_url(application, "notes")).status_code == 403
        assert post(outsider, application).status_code == 403

    @pytest.mark.parametrize("role", MemberRole.values)
    def test_every_member_reads(self, clients, application, role):
        assert clients[role].get(app_url(application, "notes")).status_code == 200

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER])
    def test_editors_write(self, clients, application, role):
        assert post(clients[role], application).status_code == 201

    def test_the_viewer_cannot_write(self, clients, application):
        response = post(clients[MemberRole.VIEWER], application)
        assert response.status_code == 403 and response.json()["detail"] == "Unauthorized access."
        assert ApplicationNote.objects.count() == 0

    def test_another_companys_application_is_404_for_read_and_write(self, application, member_factory, auth_client):
        other = auth_client(member_factory(MemberRole.ADMIN))
        assert other.get(app_url(application, "notes")).status_code == 404
        assert post(other, application).status_code == 404
        assert ApplicationNote.objects.count() == 0

    def test_unknown_application_is_404(self, clients):
        assert clients[MemberRole.ADMIN].get(f"{APPLICATIONS}00000000-0000-0000-0000-000000000000/notes/").status_code == 404


class TestNotes:
    def test_a_note_is_stored_with_its_author_and_returned_newest_first(self, team, clients, application):
        _, users = team
        first = post(clients[MemberRole.RECRUITER], application, "First call").json()
        second = post(clients[MemberRole.ADMIN], application, "Second round").json()
        assert first["text"] == "First call"
        assert first["author"] == {"id": str(users[MemberRole.RECRUITER].pk), "full_name": users[MemberRole.RECRUITER].full_name}
        listed = clients[MemberRole.VIEWER].get(app_url(application, "notes")).json()
        assert [n["text"] for n in listed] == ["Second round", "First call"]
        assert listed[0]["id"] == second["id"] and listed[0]["created_at"]

    def test_the_detail_carries_the_notes_too(self, clients, application):
        post(clients[MemberRole.ADMIN], application, "Strong portfolio")
        body = clients[MemberRole.VIEWER].get(app_url(application)).json()
        assert [n["text"] for n in body["notes"]] == ["Strong portfolio"]

    def test_a_note_does_not_change_the_status_or_the_history(self, clients, application):
        post(clients[MemberRole.ADMIN], application)
        application.refresh_from_db()
        assert application.status == "submitted" and application.status_history.count() == 1

    def test_text_is_trimmed_and_required(self, clients, application):
        assert post(clients[MemberRole.ADMIN], application, "  hello  ").json()["text"] == "hello"
        for text in ["", "   ", None]:
            response = clients[MemberRole.ADMIN].post(app_url(application, "notes"), {"text": text}, format="json")
            assert response.status_code == 400 and "text" in response.json()
        assert clients[MemberRole.ADMIN].post(app_url(application, "notes"), {}, format="json").status_code == 400

    def test_the_length_limit(self, clients, application):
        assert post(clients[MemberRole.ADMIN], application, "x" * 2000).status_code == 201
        response = post(clients[MemberRole.ADMIN], application, "x" * 2001)
        assert response.status_code == 400 and "text" in response.json()

    def test_formula_like_text_is_stored_as_typed(self, clients, application):
        assert post(clients[MemberRole.ADMIN], application, "=SUM(A1)").json()["text"] == "=SUM(A1)"

    def test_at_most_100_notes_per_application(self, team, clients, application):
        _, users = team
        ApplicationNote.objects.bulk_create(ApplicationNote(application=application, author=users[MemberRole.ADMIN], text=f"n{i}") for i in range(100))
        response = post(clients[MemberRole.ADMIN], application)
        assert response.status_code == 400 and response.json()["code"] == "limit_reached"
        assert ApplicationNote.objects.filter(application=application).count() == 100

    def test_notes_are_per_application(self, api_client, open_job, clients, application):
        other = api_client.post(apply_url(open_job), form(email="other@example.com"), format="multipart")
        other_app = Application.objects.get(reference=other.json()["reference"])
        post(clients[MemberRole.ADMIN], application, "Only for the first")
        assert clients[MemberRole.ADMIN].get(app_url(other_app, "notes")).json() == []

    def test_a_deleted_author_leaves_the_note_without_a_name(self, team, clients, application):
        _, users = team
        post(clients[MemberRole.RECRUITER], application, "Left behind")
        users[MemberRole.RECRUITER].delete()
        assert clients[MemberRole.ADMIN].get(app_url(application, "notes")).json()[0]["author"] is None

    def test_notes_and_status_notes_are_separate(self, clients, application):
        clients[MemberRole.ADMIN].patch(app_url(application, "status"), {"status": "under_review", "note": "Moved"}, format="json")
        post(clients[MemberRole.ADMIN], application, "A free note")
        body = clients[MemberRole.ADMIN].get(app_url(application)).json()
        assert [n["text"] for n in body["notes"]] == ["A free note"]
        assert body["status_history"][-1]["note"] == "Moved"
