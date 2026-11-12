"""Inviting to the technical interview (FR-48, UC-09): the screening gate, the override, the context, the automatic invite."""
import pytest

from apps.common.choices import MemberRole
from apps.Module5_Foundation.models import ActivityEvent, OutboundEmail
from apps.Module7_Interviews.models import InterviewSession
from apps.Module7_Interviews.services import evaluation

from .conftest import answer_turns

pytestmark = pytest.mark.django_db
URL = "/api/applications/{}/interviews/"


def invite(client, application, **body):
    return client.post(URL.format(application.pk), {"kind": "technical", **body}, format="json")


@pytest.fixture
def interviewing(application):
    application.status = "interview"
    application.save()
    return application


class TestGate:
    def test_without_a_screening_it_is_409_screening_not_passed(self, clients, interviewing):
        response = invite(clients[MemberRole.RECRUITER], interviewing)
        assert response.status_code == 409 and response.json()["code"] == "screening_not_passed"
        assert not InterviewSession.objects.exists()

    @pytest.mark.parametrize("recommendation", ["hold", "not_recommended", None])
    def test_a_screening_that_did_not_advance_is_not_enough(self, clients, interviewing, passed_screening, recommendation):
        passed_screening(interviewing, recommendation=recommendation)
        assert invite(clients[MemberRole.RECRUITER], interviewing).status_code == 409

    def test_an_unevaluated_screening_is_not_enough(self, clients, interviewing, session_factory):
        session_factory(interviewing, kind="screening", status="completed")
        assert invite(clients[MemberRole.RECRUITER], interviewing).json()["code"] == "screening_not_passed"

    def test_only_the_latest_screening_counts(self, clients, interviewing, passed_screening, session_factory):
        passed_screening(interviewing)
        session_factory(interviewing, kind="screening", status="evaluated", recommendation="hold", token="newer")
        assert invite(clients[MemberRole.RECRUITER], interviewing).status_code == 409

    def test_an_advanced_screening_lets_a_recruiter_invite(self, clients, interviewing, passed_screening):
        passed_screening(interviewing)
        response = invite(clients[MemberRole.RECRUITER], interviewing)
        assert response.status_code == 201
        body = response.json()
        assert (body["kind"], body["status"], body["question_target"], body["warnings"]) == ("technical", "invited", 8, [])
        session = InterviewSession.objects.get(kind="technical")
        assert session.context["seniority_band"] == "mid" and session.context["competencies_to_cover"] == ["Python", "Django"]
        interviewing.refresh_from_db()
        assert interviewing.status == "interview"  # the status does not change
        assert "technical interview" in OutboundEmail.objects.get(kind="interview_invitation").subject.lower()

    def test_an_open_unevaluated_latest_screening_blocks_the_technical_invite(self, clients, interviewing, passed_screening, session_factory):
        passed_screening(interviewing)
        session_factory(interviewing, kind="screening", status="invited", token="open-screening")
        assert invite(clients[MemberRole.RECRUITER], interviewing).status_code == 409  # the latest screening is not evaluated advance

    def test_a_second_open_technical_is_409(self, clients, interviewing, passed_screening):
        passed_screening(interviewing)
        assert invite(clients[MemberRole.RECRUITER], interviewing).status_code == 201
        assert invite(clients[MemberRole.RECRUITER], interviewing).json()["code"] == "open_session_exists"


class TestOverride:
    def test_a_recruiter_cannot_override(self, clients, interviewing):
        response = invite(clients[MemberRole.RECRUITER], interviewing, override=True, note="Trust me")
        assert response.status_code == 403 and response.json()["code"] == "override_not_allowed"

    def test_an_override_needs_a_note(self, clients, interviewing):
        assert invite(clients[MemberRole.HR_MANAGER], interviewing, override=True).status_code == 400
        assert invite(clients[MemberRole.HR_MANAGER], interviewing, override=True, note=" ").json().get("note")

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER])
    def test_admin_and_hr_manager_can_override_with_a_note_and_it_is_recorded(self, clients, interviewing, role):
        assert invite(clients[role], interviewing, override=True, note="Referred by the CTO").status_code == 201
        assert ActivityEvent.objects.get(event_type="interview.invited").metadata["override"] is True

    def test_an_override_from_another_status_moves_the_application_to_interview(self, clients, application):
        assert application.status == "shortlisted"
        invite(clients[MemberRole.ADMIN], application, override=True, note="Skip screening")
        application.refresh_from_db()
        assert application.status == "interview"

    def test_viewers_cannot_invite(self, clients, interviewing):
        assert invite(clients[MemberRole.VIEWER], interviewing, override=True, note="x").status_code == 403


class TestContextAndWarnings:
    def test_a_job_without_required_skills_warns_hr(self, clients, interviewing, passed_screening):
        passed_screening(interviewing)
        interviewing.job.required_skills = []
        interviewing.job.save()
        body = invite(clients[MemberRole.RECRUITER], interviewing).json()
        assert len(body["warnings"]) == 1 and "no required skills" in body["warnings"][0]
        assert InterviewSession.objects.get(kind="technical").context["competencies_to_cover"] == []

    @pytest.mark.parametrize("min_years, band", [(0, "junior"), (1, "junior"), (2, "mid"), (4, "mid"), (5, "senior"), (10, "senior")])
    def test_the_seniority_band_comes_from_the_jobs_minimum_years(self, clients, interviewing, passed_screening, min_years, band):
        passed_screening(interviewing)
        interviewing.job.min_experience_years = min_years
        interviewing.job.save()
        invite(clients[MemberRole.RECRUITER], interviewing)
        assert InterviewSession.objects.get(kind="technical").context["seniority_band"] == band

    def test_a_cv_that_was_never_analysed_is_noted_in_the_context(self, clients, interviewing, passed_screening):
        passed_screening(interviewing)
        invite(clients[MemberRole.RECRUITER], interviewing)
        context = InterviewSession.objects.get(kind="technical").context
        assert context["cv_note"] == "CV not analysed" and context["cv_summary"] == {}


class TestAutomaticInvitation:
    def evaluated(self, session_factory, application, hooks, score):
        hooks.install().score = score
        screening = session_factory(application, kind="screening", status="completed", target=3, token="auto-screening")
        answer_turns(screening, 3)
        evaluation.evaluate(screening.pk)
        return screening

    def test_a_screening_that_advances_sends_the_technical_invitation(self, session_factory, application, hooks):
        self.evaluated(session_factory, application, hooks, 8.0)
        technical = InterviewSession.objects.get(kind="technical")
        assert technical.created_by is None and technical.status == "invited" and technical.application == application
        assert ActivityEvent.objects.get(event_type="interview.invited", metadata__kind="technical").metadata["automatic"] is True
        application.refresh_from_db()
        assert application.status == "interview"

    @pytest.mark.parametrize("score", [5.0, 2.0])
    def test_hold_and_not_recommended_send_nothing(self, session_factory, application, hooks, score):
        self.evaluated(session_factory, application, hooks, score)
        assert not InterviewSession.objects.filter(kind="technical").exists()

    def test_re_evaluating_does_not_send_a_second_invitation(self, session_factory, application, hooks):
        screening = self.evaluated(session_factory, application, hooks, 8.0)
        InterviewSession.objects.filter(pk=screening.pk).update(status="completed")
        evaluation.evaluate(screening.pk)
        assert InterviewSession.objects.filter(kind="technical").count() == 1

    def test_a_technical_evaluation_never_triggers_another_invitation(self, session_factory, application, hooks, technical):
        hooks.install().score = 9.0
        session = technical(application, status="completed", target=3)
        answer_turns(session, 3)
        evaluation.evaluate(session.pk)
        assert InterviewSession.objects.filter(kind="technical").count() == 1
