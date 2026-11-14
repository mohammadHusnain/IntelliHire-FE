"""Following an application without an account: the private link, the lost-link request, linking on email verification (P2-7)."""
import re
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import CompanyStatus
from apps.Module1_Authentication import services as auth_services
from apps.Module1_Authentication import tokens
from apps.Module1_Authentication.models import User
from apps.Module4_ApplicationManagement.models import Application
from apps.Module4_ApplicationManagement.services import tracking_token
from apps.Module4_ApplicationManagement.tests.helpers import apply_url, form
from apps.Module5_Foundation.models import OutboundEmail
from apps.Module7_Interviews.models import InterviewSession

from ..services import linking, lost_links

pytestmark = pytest.mark.django_db
TRACK = "/api/public/track/{}/"
REQUEST = "/api/public/track/request-link/"


def link_in(email):
    return re.search(r"/track/([\w-]+)", email.body_text).group(1)


class TestAtSubmission:
    def test_every_application_gets_a_private_link_in_its_confirmation_email(self, api_client, job):
        response = api_client.post(apply_url(job), form(), format="multipart")
        assert response.status_code == 201
        application = Application.objects.get()
        email = OutboundEmail.objects.get(kind="application_received")
        raw = link_in(email)
        assert len(raw) == 32 and application.tracking_token_hash == tracking_token.hash_token(raw) and raw not in application.tracking_token_hash
        assert email.sensitive is True and "no account needed" in email.body_text and "private" in email.body_text

    def test_the_link_opens_the_application_without_a_login(self, api_client, job):
        api_client.post(apply_url(job), form(), format="multipart")
        raw = link_in(OutboundEmail.objects.get(kind="application_received"))
        body = api_client.get(TRACK.format(raw)).json()
        assert body["status_label"] == "Submitted" and body["job_title"] == job.title and body["current_stage"] == "cv"

    def test_two_applications_never_share_a_token(self, api_client, job_factory, team):
        company, users = team
        for n in range(2):
            api_client.post(apply_url(job_factory(company, users["admin"], status="open")), form(), format="multipart")
        hashes = list(Application.objects.values_list("tracking_token_hash", flat=True))
        assert len(set(hashes)) == 2 and all(len(h) == 64 for h in hashes)

    def test_company_users_never_see_the_token_or_its_hash(self, clients, application):
        for url in (f"/api/applications/{application.pk}/", f"/api/jobs/{application.job_id}/applications/"):
            assert "tracking" not in clients["admin"].get(url).content.decode().lower()


class TestPublicTrack:
    def test_a_valid_link_shows_the_same_view_as_a_signed_in_candidate(self, api_client, tracked):
        application, raw = tracked()
        body = api_client.get(TRACK.format(raw)).json()
        assert body["id"] == str(application.pk) and set(body) >= {"stages", "timeline", "decision", "pending_invitation", "status_label"}

    @pytest.mark.parametrize("token", ["nope", "x" * 300, "../x", "track-token-0002"])
    def test_an_unknown_token_is_404(self, api_client, tracked, token):
        tracked()
        assert api_client.get(TRACK.format(token)).status_code == 404

    def test_a_stale_login_token_cannot_break_the_public_link(self, api_client, tracked):
        _, raw = tracked()
        api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
        assert api_client.get(TRACK.format(raw)).status_code == 200

    def test_one_link_reads_one_application_only(self, api_client, tracked, application_factory, job):
        _, raw = tracked()
        other = application_factory(job, email="other@example.com")
        assert api_client.get(TRACK.format(raw)).json()["id"] != str(other.pk)

    def test_the_interview_link_can_be_reissued_from_the_tracking_page(self, api_client, tracked, session_factory):
        application, raw = tracked()
        session = session_factory(application, kind="screening", status="invited")
        old = session.raw_token
        response = api_client.post(TRACK.format(raw) + "invitation/link/")
        assert response.status_code == 200
        new = response.json()["url"].rsplit("/", 1)[1]
        assert api_client.get(f"/api/public/interviews/{old}/").status_code == 404 and api_client.get(f"/api/public/interviews/{new}/").status_code == 200

    def test_a_wrong_token_cannot_reissue_anything(self, api_client, tracked, session_factory):
        application, _ = tracked()
        session = session_factory(application, status="invited")
        assert api_client.post(TRACK.format("nope") + "invitation/link/").status_code == 404
        assert InterviewSession.objects.get(pk=session.pk).token_hash

    def test_a_suspended_company_hides_the_interview_but_keeps_the_status(self, api_client, tracked, session_factory):
        application, raw = tracked()
        session_factory(application, status="invited")
        company = application.job.company
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        body = api_client.get(TRACK.format(raw)).json()
        assert body["pending_invitation"] is None and body["status_label"]


class TestLostLink:
    def test_the_answer_is_identical_whether_or_not_the_address_applied(self, api_client, application):
        known = api_client.post(REQUEST, {"email": application.email}, format="json")
        unknown = api_client.post(REQUEST, {"email": "nobody@example.com"}, format="json")
        assert known.status_code == unknown.status_code == 200 and known.json() == unknown.json()

    def test_fresh_links_for_every_application_of_that_address_replace_the_old_ones(self, api_client, tracked, application_factory, job_factory, team):
        company, users = team
        first, raw_one = tracked(email="sara@example.com")
        second = application_factory(job_factory(company, users["admin"], status="open"), email="sara@example.com")
        application_factory(job_factory(company, users["admin"], status="open"), email="someone.else@example.com")
        api_client.post(REQUEST, {"email": "  Sara@Example.com "}, format="json")
        email = OutboundEmail.objects.get(kind="tracking_links")
        assert email.to_email == "sara@example.com" and email.sensitive and email.body_text.count("/track/") == 2
        assert first.reference in email.body_text and second.reference in email.body_text
        assert api_client.get(TRACK.format(raw_one)).status_code == 404  # the old link died
        for raw in re.findall(r"/track/([\w-]+)", email.body_text):
            assert api_client.get(TRACK.format(raw)).status_code == 200

    def test_an_unknown_address_sends_nothing(self, api_client, application):
        api_client.post(REQUEST, {"email": "nobody@example.com"}, format="json")
        assert not OutboundEmail.objects.filter(kind="tracking_links").exists()

    def test_one_address_cannot_be_flooded_with_these_emails(self, api_client, application, settings):
        for _ in range(5):
            api_client.post(REQUEST, {"email": application.email}, format="json")
        assert OutboundEmail.objects.filter(kind="tracking_links").count() == settings.TRACKING_LINKS_PER_EMAIL_PER_HOUR

    @pytest.mark.parametrize("body", [{}, {"email": "not-an-email"}, {"email": ""}])
    def test_a_bad_request_is_400(self, api_client, body):
        assert api_client.post(REQUEST, body, format="json").status_code == 400

    def test_the_request_is_limited_to_three_per_hour_per_address_of_the_caller(self, api_client, application):
        codes = [api_client.post(REQUEST, {"email": application.email}, format="json").status_code for _ in range(4)]
        assert codes == [200, 200, 200, 429]

    def test_it_works_for_a_logged_in_stale_token_too(self, api_client, application):
        api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
        assert api_client.post(REQUEST, {"email": application.email}, format="json").status_code == 200

    def test_the_service_returns_how_many_links_it_made(self, application, application_factory, job):
        application_factory(job, email="second@example.com")
        assert lost_links.request_links("second@example.com") == 1 and lost_links.request_links("") == 0


class TestLinkingOnVerification:
    def candidate(self, user_factory, email):
        return user_factory(email=email, email_verified=False, status="pending_verification")

    def test_verifying_the_email_attaches_earlier_applications_and_their_interviews(self, application_factory, job, session_factory, user_factory):
        user = self.candidate(user_factory, "late@example.com")
        mine = application_factory(job, email="late@example.com")
        session = session_factory(mine, status="invited")
        auth_services.verify_email(user.email, tokens.make_verification_otp(user))
        mine.refresh_from_db()
        session.refresh_from_db()
        assert mine.candidate_user == user and session.candidate_user == user

    def test_an_application_already_tied_to_another_account_is_left_alone(self, application_factory, job, user_factory):
        user, other = self.candidate(user_factory, "late@example.com"), user_factory(email="other@example.com")
        taken = application_factory(job, email="late@example.com", candidate_user=other)
        auth_services.verify_email(user.email, tokens.make_verification_otp(user))
        taken.refresh_from_db()
        assert taken.candidate_user == other

    def test_only_candidates_are_linked(self, application_factory, job, member_factory):
        recruiter = member_factory()
        application_factory(job, email=recruiter.email)
        assert linking.link_applications(recruiter) == 0

    def test_a_failing_listener_never_blocks_verification(self, user_factory, monkeypatch):
        monkeypatch.setattr(linking, "link_applications", lambda user: 1 / 0)
        user = self.candidate(user_factory, "late@example.com")
        _, changed = auth_services.verify_email(user.email, tokens.make_verification_otp(user))
        assert changed is True and User.objects.get(pk=user.pk).email_verified

    def test_the_one_time_backfill_links_existing_accounts(self, application_factory, job, user_factory):
        from django.apps import apps as django_apps

        import importlib

        migration = importlib.import_module("apps.Module10_Tracking.migrations.0001_link_existing_applications")
        verified = user_factory(email="old@example.com")
        unverified = user_factory(email="new@example.com", email_verified=False, status="pending_verification")
        a, b = application_factory(job, email="old@example.com"), application_factory(job, email="new@example.com")
        migration.link(django_apps, None)
        a.refresh_from_db()
        b.refresh_from_db()
        assert a.candidate_user == verified and b.candidate_user is None and unverified
