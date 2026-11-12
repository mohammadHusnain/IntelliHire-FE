"""Inviting a candidate (FR-42, UC-08 preconditions): checks, the private link, the move to `interview`, automatic invitations."""
import json
import threading

import pytest
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module4_ApplicationManagement.services.review import set_status_if
from apps.Module5_Foundation.models import ActivityEvent, Notification, OutboundEmail
from apps.Module6_CVAnalysis.models import CVAnalysis, JobScreeningConfig

from ..models import InterviewSession
from ..services import invite as invite_service
from ..services import links

pytestmark = pytest.mark.django_db
URL = "/api/applications/{}/interviews/"


def post(client, application, **body):
    return client.post(URL.format(application.pk), body, format="json")


@pytest.fixture
def fixed_token(monkeypatch):
    monkeypatch.setattr(links, "new_token", lambda: "fixed-raw-token")
    return "fixed-raw-token"


class TestInvite:
    def test_a_shortlisted_application_is_invited(self, clients, application, team, fixed_token):
        _, users = team
        response = post(clients[MemberRole.RECRUITER], application)
        assert response.status_code == 201
        body = response.json()
        assert (body["kind"], body["status"], body["role_title"], body["question_target"]) == ("screening", "invited", "Backend Developer", 6)
        assert body["created_by"]["id"] == str(users[MemberRole.RECRUITER].pk) and body["application"]["reference"] == application.reference
        assert fixed_token not in json.dumps(body)  # the raw token never comes back through the API
        session = InterviewSession.objects.get()
        assert session.token_hash == links.hash_token(fixed_token) and fixed_token not in str(session.__dict__)
        assert 6.9 < (session.expires_at - timezone.now()).total_seconds() / 86400 <= 7

    def test_the_application_moves_to_interview_and_the_history_says_who(self, clients, application, team):
        _, users = team
        post(clients[MemberRole.RECRUITER], application)
        application.refresh_from_db()
        assert application.status == "interview"
        last = application.status_history.order_by("changed_at", "id").last()
        assert (last.from_status, last.to_status, last.source, last.changed_by_id) == ("shortlisted", "interview", "hr", users[MemberRole.RECRUITER].pk)

    def test_the_candidate_gets_one_email_with_the_private_link(self, clients, application, fixed_token, settings):
        post(clients[MemberRole.RECRUITER], application)
        email = OutboundEmail.objects.get(kind="interview_invitation")
        assert email.to_email == application.email and email.sensitive is True
        assert f"{settings.FRONTEND_URL}/interview/{fixed_token}" in email.body_text
        assert "Backend Developer" in email.subject and "minutes" in email.body_text and "AI" in email.body_text

    def test_a_candidate_with_an_account_is_also_notified_without_the_link(self, clients, application, user_factory, fixed_token):
        candidate = user_factory()
        application.candidate_user = candidate
        application.save()
        post(clients[MemberRole.RECRUITER], application)
        notification = Notification.objects.get(user=candidate, kind="interview_invited")
        assert fixed_token not in json.dumps([notification.title, notification.body, notification.link, notification.payload])
        assert InterviewSession.objects.get().candidate_user == candidate

    def test_the_snapshot_is_frozen_has_no_contact_details_and_ignores_later_job_edits(self, clients, application, job):
        post(clients[MemberRole.RECRUITER], application)
        session = InterviewSession.objects.get()
        snapshot = json.dumps(session.context)
        for private in (application.email, application.phone, application.full_name):
            assert private not in snapshot
        assert session.context["job_title"] == "Backend Developer" and session.context["required_skills"] == ["Python", "Django"]
        assert session.context["seniority_band"] == "mid"
        job.title, job.required_skills = "Renamed", ["Rust"]
        job.save()
        session.refresh_from_db()
        assert session.context["job_title"] == "Backend Developer" and session.role_title == "Backend Developer"

    def test_the_cv_summary_is_in_the_snapshot_and_redacted(self, clients, application):
        CVAnalysis.objects.create(
            application=application, status="completed",
            parsed={
                "technical_skills": ["Python"], "soft_skills": [], "education": [{"degree": "BS CS", "level": "bachelor"}],
                "experience": [{"role": "Developer", "summary": f"Built APIs. Contact {application.email} or +92 300 1234567."}],
                "total_experience_years": 4,
            },
        )  # fmt: skip
        post(clients[MemberRole.RECRUITER], application)
        summary = InterviewSession.objects.get().context["cv_summary"]
        assert summary["technical_skills"] == ["Python"] and summary["total_experience_years"] == 4
        assert application.email not in json.dumps(summary) and "1234567" not in json.dumps(summary)

    def test_an_application_without_a_finished_analysis_has_an_empty_cv_summary(self, clients, application):
        post(clients[MemberRole.RECRUITER], application)
        assert InterviewSession.objects.get().context["cv_summary"] == {}

    def test_the_event_holds_ids_and_codes_only(self, clients, application):
        post(clients[MemberRole.RECRUITER], application)
        event = ActivityEvent.objects.get(event_type="interview.invited")
        assert event.metadata == {"kind": "screening", "application_id": str(application.pk), "override": False, "automatic": False}
        assert application.email not in json.dumps([event.summary, event.metadata])

    def test_an_application_already_at_interview_can_be_invited_without_a_status_change(self, clients, application):
        application.status = "interview"
        application.save()
        assert post(clients[MemberRole.RECRUITER], application).status_code == 201
        assert application.status_history.count() == 1

    def test_the_deadline_can_be_chosen_between_1_and_14_days(self, clients, application):
        response = post(clients[MemberRole.RECRUITER], application, expires_in_days=14)
        assert response.status_code == 201
        expires = InterviewSession.objects.get().expires_at
        assert 13.9 < (expires - timezone.now()).total_seconds() / 86400 <= 14

    @pytest.mark.parametrize("days", [0, 15, -1, "x", 2.5])
    def test_a_bad_deadline_is_400(self, clients, application, days):
        response = post(clients[MemberRole.RECRUITER], application, expires_in_days=days)
        assert response.status_code == 400 and "expires_in_days" in response.json()

    @pytest.mark.parametrize("kind, status", [("mock", 400), ("nonsense", 400)])
    def test_only_kinds_with_rules_can_be_sent(self, clients, application, kind, status):
        assert post(clients[MemberRole.RECRUITER], application, kind=kind).status_code == status
        assert not InterviewSession.objects.exists()

    def test_a_kind_without_rules_is_refused_with_its_own_code_by_the_service(self, application):
        with pytest.raises(Exception) as caught:
            invite_service.invite(application, kind="mock")
        assert caught.value.status_code == 400 and caught.value.detail.code == "kind_not_available"


class TestPrerequisites:
    @pytest.mark.parametrize("status", ["submitted", "under_review", "rejected", "on_hold", "selected"])
    def test_other_statuses_need_an_override(self, clients, application_factory, job, status):
        application = application_factory(job, status=status)
        response = post(clients[MemberRole.RECRUITER], application)
        assert response.status_code == 409 and response.json()["code"] == "prerequisite_missing"
        assert not InterviewSession.objects.exists()

    def test_an_override_needs_a_note(self, clients, application_factory, job):
        application = application_factory(job, status="under_review")
        assert post(clients[MemberRole.RECRUITER], application, override=True).status_code == 400
        assert post(clients[MemberRole.RECRUITER], application, override=True, note="  ").json().get("note")

    def test_an_override_with_a_note_invites_records_the_note_and_the_event(self, clients, application_factory, job):
        application = application_factory(job, status="under_review")
        assert post(clients[MemberRole.RECRUITER], application, override=True, note="Referred by the CTO").status_code == 201
        application.refresh_from_db()
        assert application.status == "interview"
        assert application.status_history.order_by("changed_at", "id").last().note == "Referred by the CTO"
        assert ActivityEvent.objects.get(event_type="interview.invited").metadata["override"] is True

    def test_a_suspended_company_cannot_be_invited_for(self, application):
        company = application.job.company
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        with pytest.raises(Exception) as caught:
            invite_service.invite(application)
        assert caught.value.status_code == 409


class TestOneOpenInterview:
    def test_a_second_invitation_while_one_is_open_is_409(self, clients, application):
        assert post(clients[MemberRole.RECRUITER], application).status_code == 201
        response = post(clients[MemberRole.RECRUITER], application)
        assert response.status_code == 409 and response.json()["code"] == "open_session_exists"
        assert InterviewSession.objects.count() == 1

    @pytest.mark.parametrize("status", ["invited", "in_progress", "interrupted"])
    def test_every_open_status_blocks_a_new_invitation(self, clients, application, session_factory, status):
        session_factory(application, status=status)
        assert post(clients[MemberRole.RECRUITER], application).status_code == 409

    @pytest.mark.parametrize("status", ["completed", "evaluated", "expired", "cancelled", "incomplete", "evaluation_failed"])
    def test_a_closed_interview_does_not_block_a_new_one(self, clients, application, session_factory, status):
        session_factory(application, status=status)
        assert post(clients[MemberRole.RECRUITER], application).status_code == 201

    def test_the_database_itself_refuses_two_open_sessions(self, application, session_factory):
        session_factory(application, status="invited")
        with pytest.raises(IntegrityError), transaction.atomic():
            session_factory(application, status="interrupted", token="another-token")


class TestAccess:
    def test_viewers_cannot_invite_but_can_read(self, clients, application):
        assert post(clients[MemberRole.VIEWER], application).status_code == 403
        assert clients[MemberRole.VIEWER].get(URL.format(application.pk)).status_code == 200

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER])
    def test_admin_hr_manager_and_recruiter_can_invite(self, clients, application_factory, job, role):
        assert post(clients[role], application_factory(job)).status_code == 201

    def test_another_companys_application_is_404(self, application, member_factory, auth_client):
        outsider = auth_client(member_factory(MemberRole.ADMIN))
        assert post(outsider, application).status_code == 404
        assert outsider.get(URL.format(application.pk)).status_code == 404
        assert not InterviewSession.objects.exists()

    def test_anonymous_and_candidate_are_refused(self, api_client, application, auth_client, user_factory):
        assert post(api_client, application).status_code == 401
        assert post(auth_client(user_factory()), application).status_code == 403


# --- Automatic invitation (D-103) -------------------------------------------------------------------------------
class TestInviteOnShortlist:
    def turn_on(self, job):
        JobScreeningConfig.objects.update_or_create(job=job, defaults={"invite_on_shortlist": True})

    def test_shortlisting_sends_the_invitation_when_the_job_asks_for_it(self, application_factory, job):
        self.turn_on(job)
        application = application_factory(job, status="under_review")
        assert set_status_if(application.pk, expected="under_review", new_status="shortlisted") is True
        session = InterviewSession.objects.get()
        assert session.created_by is None and session.application == application
        application.refresh_from_db()
        assert application.status == "interview"
        assert ActivityEvent.objects.get(event_type="interview.invited").metadata["automatic"] is True
        assert application.status_history.order_by("changed_at", "id").last().source == "system"

    def test_manual_shortlisting_triggers_it_too(self, clients, application_factory, job):
        self.turn_on(job)
        application = application_factory(job, status="under_review")
        clients[MemberRole.RECRUITER].patch(f"/api/applications/{application.pk}/status/", {"status": "shortlisted"}, format="json")
        assert InterviewSession.objects.filter(application=application).count() == 1

    def test_nothing_is_sent_when_the_setting_is_off(self, application_factory, job):
        application = application_factory(job, status="under_review")
        set_status_if(application.pk, expected="under_review", new_status="shortlisted")
        assert not InterviewSession.objects.exists()

    def test_an_existing_open_interview_is_not_duplicated_and_shortlisting_still_succeeds(self, application_factory, job, session_factory):
        self.turn_on(job)
        application = application_factory(job, status="under_review")
        session_factory(application, status="invited")
        assert set_status_if(application.pk, expected="under_review", new_status="shortlisted") is True
        assert InterviewSession.objects.count() == 1

    def test_a_broken_invitation_never_undoes_the_shortlisting(self, application_factory, job, monkeypatch):
        self.turn_on(job)
        monkeypatch.setattr("apps.Module7_Interviews.services.notices.send_invitation", lambda *a, **k: 1 / 0)
        application = application_factory(job, status="under_review")
        assert set_status_if(application.pk, expected="under_review", new_status="shortlisted") is True
        application.refresh_from_db()
        assert application.status == "shortlisted" and not InterviewSession.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_two_invitations_at_once_create_one_interview(application, team, auth_client, ensure_bank):
    _, users = team
    for _ in range(3):
        InterviewSession.objects.all().delete()
        type(application).objects.filter(pk=application.pk).update(status="shortlisted")
        barrier, codes = threading.Barrier(2), []

        def invite_now():
            try:
                barrier.wait(timeout=10)
                codes.append(post(auth_client(users[MemberRole.RECRUITER]), application).status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=invite_now) for _ in range(2)]
        [t.start() for t in threads]
        [t.join(timeout=30) for t in threads]
        assert sorted(codes) == [201, 409], codes
        assert InterviewSession.objects.count() == 1
