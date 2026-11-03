from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.models import ApplicationField, JobPosting

from .helpers import job_url

pytestmark = pytest.mark.django_db
LOCK = "apps.Module3_JobPosting.services.fields.has_applications"


@pytest.fixture
def job(team, job_factory):
    company, users = team
    return job_factory(company, users[MemberRole.ADMIN], title="With fields")


def fields_url(job, suffix=""):
    return job_url(job, "fields" + (f"/{suffix}" if suffix else ""))


def add(client, job, **body):
    data = {"label": "LinkedIn Profile URL", "field_type": "url"}
    data.update(body)
    return client.post(fields_url(job), data, format="json")


@pytest.fixture
def applied():
    """Pretend the first application has arrived (Module 4 supplies the real check)."""
    with mock.patch(LOCK, return_value=True):
        yield


class TestAddAndList:
    def test_add_generates_the_key_and_order(self, clients, job):
        first = add(clients[MemberRole.RECRUITER], job)
        assert first.status_code == 201
        body = first.json()
        assert body["key"] == "linkedin_profile_url" and body["order"] == 0
        assert (body["label"], body["field_type"], body["required"], body["options"]) == ("LinkedIn Profile URL", "url", False, [])
        second = add(clients[MemberRole.ADMIN], job, label="Why us?", field_type="long_text", required=True, help_text="Be brief", max_length=500)
        assert second.json()["order"] == 1 and second.json()["max_length"] == 500 and second.json()["required"] is True

    @pytest.mark.parametrize(
        "labels,keys",
        [
            (["Portfolio", "Portfolio", "Portfolio"], ["portfolio", "portfolio_2", "portfolio_3"]),
            (["Email", "Phone Number", "Resume", "Full name"], ["email_2", "phone_number", "resume_2", "full_name_2"]),
            (["Graduation Year!", "Institution"], ["graduation_year_2", "institution_2"]),
            (["???", "!!!"], ["field", "field_2"]),
            (["Naïve  café Test"], ["naive_cafe_test"]),
            (["C++ / C# skills"], ["c_c_skills"]),
        ],
    )
    def test_key_generation_and_clash_suffixes(self, clients, job, labels, keys):
        got = [add(clients[MemberRole.ADMIN], job, label=label, field_type="short_text").json()["key"] for label in labels]
        assert got == keys

    def test_very_long_labels_still_produce_a_valid_key(self, clients, job):
        key = add(clients[MemberRole.ADMIN], job, label="a" * 150, field_type="short_text").json()["key"]
        assert 0 < len(key) <= 150

    def test_the_key_never_changes_when_the_label_is_edited(self, clients, job):
        created = add(clients[MemberRole.ADMIN], job).json()
        updated = clients[MemberRole.ADMIN].patch(fields_url(job, created["id"]), {"label": "LinkedIn"}, format="json").json()
        assert updated["label"] == "LinkedIn" and updated["key"] == "linkedin_profile_url"

    def test_list_is_ordered_and_open_to_every_member(self, clients, job):
        add(clients[MemberRole.ADMIN], job, label="B", field_type="short_text")
        add(clients[MemberRole.ADMIN], job, label="A", field_type="short_text")
        for role in MemberRole.values:
            response = clients[role].get(fields_url(job))
            assert response.status_code == 200 and [f["label"] for f in response.json()] == ["B", "A"]

    def test_viewer_cannot_change_fields(self, clients, job):
        assert add(clients[MemberRole.VIEWER], job).status_code == 403
        created = add(clients[MemberRole.ADMIN], job).json()
        viewer = clients[MemberRole.VIEWER]
        assert viewer.patch(fields_url(job, created["id"]), {"label": "x"}, format="json").status_code == 403
        assert viewer.delete(fields_url(job, created["id"])).status_code == 403
        assert viewer.post(fields_url(job, "reorder"), {"field_ids": [created["id"]]}, format="json").status_code == 403
        assert ApplicationField.objects.count() == 1

    def test_anonymous_is_401(self, api_client, job):
        assert api_client.get(fields_url(job)).status_code == 401
        assert api_client.post(fields_url(job), {}, format="json").status_code == 401

    def test_limit_of_30_fields(self, clients, job):
        for index in range(30):
            ApplicationField.objects.create(job=job, label=f"F{index}", key=f"f{index}", field_type="short_text", order=index)
        response = add(clients[MemberRole.ADMIN], job)
        assert response.status_code == 400 and response.json()["code"] == "limit_reached"

    def test_each_job_has_its_own_fields(self, clients, job, team, job_factory):
        company, _ = team
        other = job_factory(company)
        add(clients[MemberRole.ADMIN], job)
        assert clients[MemberRole.ADMIN].get(fields_url(other)).json() == []
        assert add(clients[MemberRole.ADMIN], other).json()["key"] == "linkedin_profile_url"


class TestValidation:
    @pytest.mark.parametrize(
        "body,field",
        [
            ({"label": ""}, "label"),
            ({"label": "x" * 151}, "label"),
            ({"field_type": "video"}, "field_type"),
            ({"field_type": ""}, "field_type"),
            ({"field_type": "single_choice"}, "options"),
            ({"field_type": "single_choice", "options": ["Only one"]}, "options"),
            ({"field_type": "multiple_choice", "options": ["A", "a"]}, "options"),
            ({"field_type": "single_choice", "options": ["A", ""]}, "options"),
            ({"field_type": "single_choice", "options": [f"o{i}" for i in range(21)]}, "options"),
            ({"field_type": "short_text", "options": ["A", "B"]}, "options"),
            ({"field_type": "number", "max_length": 10}, "max_length"),
            ({"field_type": "short_text", "max_length": 0}, "max_length"),
            ({"field_type": "short_text", "max_length": 5001}, "max_length"),
            ({"help_text": "x" * 501}, "help_text"),
        ],
    )
    def test_invalid_definitions_are_rejected(self, clients, job, body, field):
        response = add(clients[MemberRole.ADMIN], job, **body)
        assert response.status_code == 400 and field in response.json()
        assert ApplicationField.objects.count() == 0

    def test_label_and_type_are_required(self, clients, job):
        response = clients[MemberRole.ADMIN].post(fields_url(job), {}, format="json")
        assert response.status_code == 400 and {"label", "field_type"} <= set(response.json())

    @pytest.mark.parametrize("count", [2, 20])
    def test_choice_fields_accept_two_to_twenty_options(self, clients, job, count):
        response = add(clients[MemberRole.ADMIN], job, label=f"Choice {count}", field_type="multiple_choice", options=[f"opt{i}" for i in range(count)])
        assert response.status_code == 201 and len(response.json()["options"]) == count

    def test_options_are_trimmed(self, clients, job):
        body = add(clients[MemberRole.ADMIN], job, label="Pick", field_type="single_choice", options=[" Yes ", "No"]).json()
        assert body["options"] == ["Yes", "No"]

    @pytest.mark.parametrize("field_type", ["short_text", "long_text", "number", "email", "url", "date", "file"])
    def test_every_non_choice_type_is_accepted(self, clients, job, field_type):
        assert add(clients[MemberRole.ADMIN], job, label=field_type, field_type=field_type).status_code == 201


class TestUpdate:
    def test_edit_label_help_required_and_options_before_any_application(self, clients, job):
        created = add(clients[MemberRole.ADMIN], job, label="Level", field_type="single_choice", options=["A", "B", "C"]).json()
        response = clients[MemberRole.RECRUITER].patch(
            fields_url(job, created["id"]),
            {"label": "Seniority", "help_text": "Pick one", "required": True, "options": ["A", "B"]},
            format="json",
        )
        assert response.status_code == 200
        assert (response.json()["label"], response.json()["required"], response.json()["options"]) == ("Seniority", True, ["A", "B"])

    def test_type_can_change_while_unlocked_but_must_stay_consistent(self, clients, job):
        created = add(clients[MemberRole.ADMIN], job, label="Pick", field_type="single_choice", options=["A", "B"]).json()
        path = fields_url(job, created["id"])
        assert clients[MemberRole.ADMIN].patch(path, {"field_type": "short_text"}, format="json").status_code == 400
        assert clients[MemberRole.ADMIN].patch(path, {"field_type": "short_text", "options": []}, format="json").status_code == 200

    def test_options_cannot_be_dropped_below_two(self, clients, job):
        created = add(clients[MemberRole.ADMIN], job, label="Pick", field_type="single_choice", options=["A", "B"]).json()
        response = clients[MemberRole.ADMIN].patch(fields_url(job, created["id"]), {"options": ["A"]}, format="json")
        assert response.status_code == 400 and "options" in response.json()

    def test_unknown_field_is_404(self, clients, job):
        assert clients[MemberRole.ADMIN].patch(fields_url(job, "99999"), {"label": "x"}, format="json").status_code == 404
        assert clients[MemberRole.ADMIN].delete(fields_url(job, "99999")).status_code == 404

    def test_a_field_of_another_job_is_404(self, clients, job, team, job_factory):
        company, _ = team
        other = job_factory(company)
        created = add(clients[MemberRole.ADMIN], other).json()
        assert clients[MemberRole.ADMIN].patch(fields_url(job, created["id"]), {"label": "x"}, format="json").status_code == 404
        assert clients[MemberRole.ADMIN].delete(fields_url(job, created["id"])).status_code == 404

    def test_delete_removes_the_field(self, clients, job):
        created = add(clients[MemberRole.ADMIN], job).json()
        assert clients[MemberRole.ADMIN].delete(fields_url(job, created["id"])).status_code == 204
        assert ApplicationField.objects.count() == 0


class TestLockedAfterApplications:
    """Doc §3.3: once the first application arrives, existing answers must stay valid."""

    @pytest.fixture
    def field(self, clients, job):
        return add(clients[MemberRole.ADMIN], job, label="Level", field_type="single_choice", options=["A", "B"]).json()

    def locked(self, response):
        assert response.status_code == 409 and response.json()["code"] == "field_locked", response.content

    def test_a_field_cannot_be_deleted(self, clients, job, field, applied):
        self.locked(clients[MemberRole.ADMIN].delete(fields_url(job, field["id"])))
        assert ApplicationField.objects.filter(pk=field["id"]).exists()

    def test_its_type_cannot_change(self, clients, job, field, applied):
        self.locked(clients[MemberRole.ADMIN].patch(fields_url(job, field["id"]), {"field_type": "multiple_choice"}, format="json"))

    def test_an_optional_field_cannot_become_required(self, clients, job, field, applied):
        self.locked(clients[MemberRole.ADMIN].patch(fields_url(job, field["id"]), {"required": True}, format="json"))

    def test_options_cannot_be_removed_or_renamed(self, clients, job, applied):
        field = add(clients[MemberRole.ADMIN], job, label="Pick", field_type="single_choice", options=["A", "B", "C"]).json()
        path = fields_url(job, field["id"])
        self.locked(clients[MemberRole.ADMIN].patch(path, {"options": ["A", "B"]}, format="json"))
        self.locked(clients[MemberRole.ADMIN].patch(path, {"options": ["A", "B", "Cee"]}, format="json"))
        assert ApplicationField.objects.get(pk=field["id"]).options == ["A", "B", "C"]

    def test_a_new_required_field_cannot_be_added(self, clients, job, applied):
        self.locked(add(clients[MemberRole.ADMIN], job, label="New", field_type="short_text", required=True))

    def test_allowed_changes_still_work(self, clients, job, field, applied):
        client = clients[MemberRole.ADMIN]
        path = fields_url(job, field["id"])
        assert client.patch(path, {"label": "Seniority", "help_text": "Pick"}, format="json").status_code == 200
        assert client.patch(path, {"options": ["A", "B", "C"]}, format="json").json()["options"] == ["A", "B", "C"]
        assert client.patch(path, {"options": ["C", "B", "A"]}, format="json").status_code == 200  # reordering options removes none
        assert add(client, job, label="Extra", field_type="short_text").status_code == 201
        assert client.patch(path, {"field_type": "single_choice"}, format="json").status_code == 200  # same type is not a change

    def test_a_required_field_may_be_relaxed_to_optional(self, clients, job, applied):
        field = ApplicationField.objects.create(job=job, label="Req", key="req", field_type="short_text", required=True)
        response = clients[MemberRole.ADMIN].patch(fields_url(job, field.pk), {"required": False}, format="json")
        assert response.status_code == 200 and response.json()["required"] is False

    def test_reorder_is_allowed(self, clients, job, applied):
        a = ApplicationField.objects.create(job=job, label="A", key="a", field_type="short_text", order=0)
        b = ApplicationField.objects.create(job=job, label="B", key="b", field_type="short_text", order=1)
        response = clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), {"field_ids": [b.pk, a.pk]}, format="json")
        assert response.status_code == 200 and [f["key"] for f in response.json()] == ["b", "a"]


class TestJobStateGate:
    def test_closed_job_fields_are_read_only(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="closed", fields=[{"label": "X", "key": "x", "field_type": "short_text"}])
        field_id = job.custom_fields.get().pk
        client = clients[MemberRole.ADMIN]
        responses = [
            add(client, job),
            client.patch(fields_url(job, field_id), {"label": "y"}, format="json"),
            client.delete(fields_url(job, field_id)),
            client.post(fields_url(job, "reorder"), {"field_ids": [field_id]}, format="json"),
        ]
        assert all(r.status_code == 409 and r.json()["code"] == "job_closed" for r in responses)
        assert client.get(fields_url(job)).status_code == 200

    def test_open_job_past_its_deadline_is_read_only(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open")
        JobPosting.objects.filter(pk=job.pk).update(deadline=timezone.now() - timedelta(minutes=1))
        response = add(clients[MemberRole.ADMIN], job)
        assert response.status_code == 409 and response.json()["code"] == "deadline_passed"

    def test_open_job_before_its_deadline_accepts_field_changes(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open")
        assert add(clients[MemberRole.ADMIN], job).status_code == 201


class TestReorder:
    @pytest.fixture
    def three(self, job):
        return [ApplicationField.objects.create(job=job, label=n, key=n.lower(), field_type="short_text", order=i) for i, n in enumerate("ABC")]

    def test_reorder_rewrites_the_order(self, clients, job, three):
        a, b, c = three
        response = clients[MemberRole.RECRUITER].post(fields_url(job, "reorder"), {"field_ids": [c.pk, a.pk, b.pk]}, format="json")
        assert response.status_code == 200
        assert [(f["key"], f["order"]) for f in response.json()] == [("c", 0), ("a", 1), ("b", 2)]
        assert [f["key"] for f in clients[MemberRole.ADMIN].get(fields_url(job)).json()] == ["c", "a", "b"]

    def test_a_bare_list_is_accepted_too(self, clients, job, three):
        a, b, c = three
        response = clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), [b.pk, c.pk, a.pk], format="json")
        assert response.status_code == 200 and [f["key"] for f in response.json()] == ["b", "c", "a"]

    @pytest.mark.parametrize("make", [
        lambda ids: ids[:-1],
        lambda ids: ids + [999999],
        lambda ids: [ids[0], ids[0], ids[1]],
        lambda ids: [],
    ])
    def test_ids_must_match_the_jobs_fields_exactly(self, clients, job, three, make):
        ids = [f.pk for f in three]
        response = clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), {"field_ids": make(ids)}, format="json")
        assert response.status_code == 400 and "field_ids" in response.json()
        assert [f["key"] for f in clients[MemberRole.ADMIN].get(fields_url(job)).json()] == ["a", "b", "c"]

    def test_ids_from_another_job_are_refused(self, clients, job, three, team, job_factory):
        company, _ = team
        other = job_factory(company)
        foreign = ApplicationField.objects.create(job=other, label="Z", key="z", field_type="short_text")
        ids = [three[0].pk, three[1].pk, foreign.pk]
        assert clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), {"field_ids": ids}, format="json").status_code == 400
        assert ApplicationField.objects.get(pk=foreign.pk).order == 0

    def test_non_integer_ids_are_400(self, clients, job, three):
        assert clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), {"field_ids": ["a", "b", "c"]}, format="json").status_code == 400
        assert clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), {}, format="json").status_code == 400

    def test_an_empty_job_reorders_to_an_empty_list(self, clients, job):
        assert clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), {"field_ids": []}, format="json").json() == []

    def test_new_fields_go_to_the_end_after_a_reorder(self, clients, job, three):
        a, b, c = three
        clients[MemberRole.ADMIN].post(fields_url(job, "reorder"), {"field_ids": [c.pk, b.pk, a.pk]}, format="json")
        assert add(clients[MemberRole.ADMIN], job).json()["order"] == 3
