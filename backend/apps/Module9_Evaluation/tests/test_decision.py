"""HR decisions (FR-57, FR-58, TC-38): append-only, one transaction with the status change, emails after commit."""
import threading

import pytest
from django.db import IntegrityError, connection, transaction

from apps.common.choices import MemberRole
from apps.Module4_ApplicationManagement.models import ApplicationStatusChange
from apps.Module5_Foundation.models import ActivityEvent, Notification, OutboundEmail

from ..models import AppendOnlyError, CandidateEvaluation, HRDecision

pytestmark = pytest.mark.django_db
URL = "/api/applications/{}/decision/"


def decide(client, application, decision="selected", **body):
    return client.post(URL.format(application.pk), {"decision": decision, **body}, format="json")


def make_ready(application, recommendation):
    CandidateEvaluation.objects.filter(application=application).update(report_status="ready", report={"recommendation": recommendation})


class TestRecording:
    def test_a_decision_is_one_row_and_one_status_change(self, clients, application, team, django_capture_on_commit_callbacks):
        _, users = team
        with django_capture_on_commit_callbacks(execute=True):
            response = decide(clients[MemberRole.RECRUITER], application, "selected", note="Great interview")
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "selected" and body["decision"]["decision"] == "selected" and body["decision"]["note"] == "Great interview"
        assert body["decision"]["decided_by"] == {"id": str(users[MemberRole.RECRUITER].pk), "full_name": users[MemberRole.RECRUITER].full_name}
        row = HRDecision.objects.get()
        assert (row.application, row.job, row.decided_by) == (application, application.job, users[MemberRole.RECRUITER])
        application.refresh_from_db()
        assert application.status == "selected"
        change = ApplicationStatusChange.objects.filter(application=application).order_by("changed_at", "id").last()
        assert (change.to_status, change.source, change.note, change.changed_by) == ("selected", "hr", "Great interview", users[MemberRole.RECRUITER])
        event = ActivityEvent.objects.get(event_type="decision.recorded")
        assert event.metadata == {"decision": "selected", "overrode_ai": False, "reference": application.reference}

    def test_the_candidate_is_emailed_after_commit_without_any_score_or_note(self, clients, application, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            decide(clients[MemberRole.ADMIN], application, "rejected", note="Internal: weak maths, CV score 41")
        email = OutboundEmail.objects.get(kind="application_decision")
        assert email.to_email == application.email and application.job.title in email.subject
        assert "decided not to move forward" in email.body_text and "careful consideration" in email.body_text
        for private in ("weak maths", "41", "score", "Internal"):
            assert private not in email.body_text, private
        assert HRDecision.objects.get().notified_candidate is True

    @pytest.mark.parametrize("decision, phrase", [("selected", "pleased to let you know"), ("on_hold", "on hold")])
    def test_each_decision_has_its_own_plain_wording(self, clients, application, decision, phrase, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            decide(clients[MemberRole.ADMIN], application, decision)
        assert phrase in OutboundEmail.objects.get(kind="application_decision").body_text

    def test_notify_false_sends_nothing(self, clients, application, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            decide(clients[MemberRole.ADMIN], application, "on_hold", notify=False)
        assert not OutboundEmail.objects.filter(kind="application_decision").exists() and HRDecision.objects.get().notified_candidate is False

    def test_a_candidate_with_an_account_also_gets_a_notification(self, clients, application, user_factory, django_capture_on_commit_callbacks):
        candidate = user_factory()
        application.candidate_user = candidate
        application.save()
        with django_capture_on_commit_callbacks(execute=True):
            decide(clients[MemberRole.ADMIN], application, "selected")
        notification = Notification.objects.get(user=candidate, kind="application_decision")
        assert "selected" in notification.body and notification.link == ""

    def test_a_rolled_back_decision_sends_nothing(self, application, team):
        _, users = team
        from ..services import decision

        with pytest.raises(RuntimeError), transaction.atomic():
            decision.record_locked(application, user=users[MemberRole.ADMIN], decision="selected", company=team[0])
            raise RuntimeError("boom")
        assert not HRDecision.objects.exists() and not OutboundEmail.objects.filter(kind="application_decision").exists()

    def test_the_same_decision_twice_is_409_but_a_different_one_is_fine(self, clients, application):
        assert decide(clients[MemberRole.ADMIN], application, "selected").status_code == 201
        again = decide(clients[MemberRole.ADMIN], application, "selected")
        assert again.status_code == 409 and again.json()["code"] == "same_decision"
        assert decide(clients[MemberRole.ADMIN], application, "on_hold").status_code == 201
        assert HRDecision.objects.count() == 2

    def test_deciding_the_same_thing_again_after_moving_the_status_elsewhere_is_allowed(self, clients, application):
        decide(clients[MemberRole.ADMIN], application, "selected")
        clients[MemberRole.ADMIN].patch(f"/api/applications/{application.pk}/status/", {"status": "interview"}, format="json")
        assert decide(clients[MemberRole.ADMIN], application, "selected").status_code == 201

    def test_history_is_newest_first_and_the_newest_is_current(self, clients, application):
        for decision in ("on_hold", "selected", "rejected"):
            decide(clients[MemberRole.ADMIN], application, decision)
        rows = clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/decisions/").json()
        assert [r["decision"] for r in rows] == ["rejected", "selected", "on_hold"]

    @pytest.mark.parametrize("body", [{"decision": "maybe"}, {"decision": "interview"}, {}, {"decision": "selected", "note": "x" * 1001}])
    def test_anything_else_is_400(self, clients, application, body):
        assert clients[MemberRole.ADMIN].post(URL.format(application.pk), body, format="json").status_code == 400
        assert not HRDecision.objects.exists()

    def test_a_note_of_exactly_1000_characters_is_fine(self, clients, application):
        assert decide(clients[MemberRole.ADMIN], application, "selected", note="x" * 1000).status_code == 201

    def test_the_hint_says_whether_the_openings_are_filled_and_the_job_stays_open(self, clients, application, application_factory, job):
        assert job.openings == 1
        response = decide(clients[MemberRole.ADMIN], application, "selected").json()
        assert response["hint"] == {"openings": 1, "selected": 1, "filled": True}
        job.refresh_from_db()
        assert job.status == "open"


class TestAiOverride:
    @pytest.mark.parametrize(
        "recommendation, decision, overrode",
        [("no", "selected", True), ("maybe", "selected", False), ("strong_yes", "rejected", True), ("yes", "rejected", True),
         ("maybe", "rejected", False), ("no", "rejected", False), ("strong_yes", "selected", False), ("no", "on_hold", False)],
    )  # fmt: skip
    def test_overrides_are_recorded(self, clients, scored, evaluation, recommendation, decision, overrode):
        make_ready(scored, recommendation)
        decide(clients[MemberRole.ADMIN], scored, decision)
        row = HRDecision.objects.get()
        assert row.ai_recommendation == recommendation and row.overrode_ai is overrode

    def test_a_failed_or_missing_report_stores_an_empty_ai_recommendation(self, clients, scored, evaluation):
        CandidateEvaluation.objects.filter(application=scored).update(report_status="failed")
        assert decide(clients[MemberRole.ADMIN], scored, "selected").status_code == 201
        assert HRDecision.objects.get().ai_recommendation == "" and HRDecision.objects.get().overrode_ai is False

    def test_an_unevaluated_candidate_can_still_be_decided_on(self, clients, application):
        assert decide(clients[MemberRole.ADMIN], application, "rejected").status_code == 201


class TestAppendOnly:
    @pytest.fixture
    def row(self, clients, application):
        decide(clients[MemberRole.ADMIN], application, "selected")
        return HRDecision.objects.get()

    def test_the_model_refuses_to_change_or_delete_a_row(self, row):
        row.note = "edited"
        with pytest.raises(AppendOnlyError):
            row.save()
        with pytest.raises(AppendOnlyError):
            row.delete()

    @pytest.mark.parametrize("sql", ["UPDATE evaluation_hrdecision SET note = 'x'", "DELETE FROM evaluation_hrdecision"])
    def test_the_database_itself_refuses_raw_updates_and_deletes(self, row, sql):
        with pytest.raises(IntegrityError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(sql)
        assert HRDecision.objects.count() == 1

    def test_queryset_update_and_delete_are_refused_too(self, row):
        with pytest.raises(IntegrityError), transaction.atomic():
            HRDecision.objects.update(decision="rejected")
        with pytest.raises(IntegrityError), transaction.atomic():
            HRDecision.objects.all().delete()

    def test_an_application_with_decisions_cannot_be_deleted(self, row, application):
        from django.db.models import ProtectedError

        with pytest.raises(ProtectedError), transaction.atomic():
            application.delete()

    def test_the_admin_offers_no_way_to_edit_or_delete(self, row):
        from django.contrib import admin

        model_admin = admin.site._registry[HRDecision]
        assert not (model_admin.has_add_permission(None) or model_admin.has_change_permission(None) or model_admin.has_delete_permission(None))


class TestOldStatusEndpoint:
    def patch(self, client, application, status, **extra):
        return client.patch(f"/api/applications/{application.pk}/status/", {"status": status, **extra}, format="json")

    @pytest.mark.parametrize("status", ["selected", "rejected", "on_hold"])
    def test_it_still_works_for_decisions_and_now_writes_a_row_without_emailing(self, clients, application, status, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = self.patch(clients[MemberRole.RECRUITER], application, status, note="by the board")
        assert response.status_code == 200 and response.json()["status"] == status
        row = HRDecision.objects.get()
        assert row.decision == status and row.note == "by the board" and row.notified_candidate is False
        assert not OutboundEmail.objects.filter(kind="application_decision").exists()
        assert ApplicationStatusChange.objects.filter(application=application, to_status=status).count() == 1  # one history row, not two

    def test_other_statuses_do_not_create_decisions(self, clients, application):
        self.patch(clients[MemberRole.RECRUITER], application, "interview")
        assert not HRDecision.objects.exists()

    def test_the_old_same_status_error_is_unchanged(self, clients, application):
        self.patch(clients[MemberRole.RECRUITER], application, "rejected")
        assert self.patch(clients[MemberRole.RECRUITER], application, "rejected").status_code == 400

    def test_viewers_are_still_refused(self, clients, application):
        assert self.patch(clients[MemberRole.VIEWER], application, "rejected").status_code == 403
        assert not HRDecision.objects.exists()


class TestAccess:
    def test_viewers_cannot_decide_but_can_read_the_history(self, clients, application):
        assert decide(clients[MemberRole.VIEWER], application).status_code == 403
        assert clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/decisions/").status_code == 200

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER])
    def test_admin_hr_manager_and_recruiter_can_decide(self, clients, application_factory, job, role):
        assert decide(clients[role], application_factory(job)).status_code == 201

    def test_another_companys_application_is_404_whatever_the_body(self, application, member_factory, auth_client):
        outsider = auth_client(member_factory(MemberRole.ADMIN))
        assert decide(outsider, application).status_code == 404
        assert outsider.post(URL.format(application.pk), {}, format="json").status_code == 404
        assert outsider.get(f"/api/applications/{application.pk}/decisions/").status_code == 404
        assert not HRDecision.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_two_people_deciding_at_once_both_get_a_row_in_order(application, team, auth_client, ensure_bank):
    _, users = team
    barrier, codes = threading.Barrier(2), {}

    def person(name, decision, role):
        try:
            barrier.wait(timeout=10)
            codes[name] = decide(auth_client(users[role]), application, decision).status_code
        finally:
            connection.close()

    threads = [
        threading.Thread(target=person, args=("a", "selected", MemberRole.RECRUITER)),
        threading.Thread(target=person, args=("b", "rejected", MemberRole.HR_MANAGER)),
    ]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    assert codes == {"a": 201, "b": 201}
    rows = list(application.decisions.order_by("decided_at", "id"))
    application.refresh_from_db()
    assert application.status == rows[-1].decision  # the last write stands, and the whole history is kept
