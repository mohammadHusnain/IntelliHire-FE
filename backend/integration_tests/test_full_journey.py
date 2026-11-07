"""One complete story, HTTP only, across all four modules (TC-01 to TC-22 in a single flow)."""
import csv
import io
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.common.tests.helpers import link_in
from apps.Module4_ApplicationManagement.tests.helpers import form, pdf

pytestmark = pytest.mark.django_db
PASSWORD = "Sunny-Day-4711"
_ips = iter(range(1, 250))


def actor():
    """A client with its own IP, so the per-IP throttles of one actor never affect another."""
    return APIClient(REMOTE_ADDR=f"10.9.0.{next(_ips)}")


def sign_in(client, email, password=PASSWORD):
    response = client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
    assert response.status_code == 200, response.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return response.json()


def last_mail(subject_part):
    return next(m for m in reversed(mail.outbox) if subject_part in m.subject)


def test_the_whole_platform_end_to_end(auth_client, user_factory, django_capture_on_commit_callbacks):
    capture = lambda: django_capture_on_commit_callbacks(execute=True)  # noqa: E731
    platform = auth_client(user_factory(role="platform_admin", email="root@intellihire.example"))

    # ---- Module 1: a candidate signs up and verifies (TC-01) ----
    candidate = actor()
    with capture():
        assert candidate.post("/api/auth/register/candidate/", {"full_name": "Sara Malik", "email": "Sara@Example.com", "password": PASSWORD, "confirm_password": PASSWORD}, format="json").status_code == 201
    duplicate = candidate.post("/api/auth/register/candidate/", {"full_name": "Sara", "email": "sara@example.COM", "password": PASSWORD, "confirm_password": PASSWORD}, format="json")
    assert duplicate.status_code == 400 and "Email already registered." in str(duplicate.json())  # TC-02
    before_verification = candidate.post("/api/auth/login/", {"email": "sara@example.com", "password": PASSWORD}, format="json")
    assert before_verification.status_code == 403 and before_verification.json()["code"] == "pending_verification"
    assert candidate.post("/api/auth/verify-email/", {"token": link_in(last_mail("Verify"))[1]["token"]}, format="json").status_code == 200
    session = sign_in(candidate, "sara@example.com")
    assert session["user"]["role"] == "candidate" and session["user"]["status"] == "active"
    assert candidate.patch("/api/auth/profile/", {"headline": "Backend engineer", "skills": ["Python", "SQL"]}, format="json").status_code == 200
    assert candidate.get("/api/company/dashboard/").status_code == 403  # TC-07

    # ---- Module 2: a company registers, is reviewed and approved (TC-03) ----
    boss = actor()
    registration = {"company_name": "Acme Software", "industry": "Software", "official_email": "hr@acme.example", "admin_full_name": "Ali Khan",
                    "admin_phone": "+92 300 1234567", "password": PASSWORD, "confirm_password": PASSWORD}
    with capture():
        assert boss.post("/api/auth/register/company/", registration, format="json").status_code == 201
    assert boss.post("/api/auth/verify-email/", {"token": link_in(last_mail("Verify"))[1]["token"]}, format="json").status_code == 200
    pending = boss.post("/api/auth/login/", {"email": "hr@acme.example", "password": PASSWORD}, format="json")
    assert pending.status_code == 403 and pending.json()["code"] == "pending_approval"
    queue = platform.get("/api/platform-admin/companies/").json()["results"]
    assert [c["name"] for c in queue] == ["Acme Software"]
    with capture():
        assert platform.post(f"/api/platform-admin/companies/{queue[0]['id']}/approve/").status_code == 200
    assert "approved" in last_mail("approved").subject
    sign_in(boss, "hr@acme.example")
    assert boss.patch("/api/company/profile/", {"headquarters": "Lahore", "website": "https://acme.example", "company_size": "11-50"}, format="json").json()["profile_completion"] == 60

    # ---- Module 2: staff invitations with roles ----
    staff = {}
    for role, email in (("recruiter", "rec@acme.example"), ("viewer", "view@acme.example")):
        with capture():
            assert boss.post("/api/company/invitations/", {"email": email, "full_name": role.title(), "role": role}, format="json").status_code == 201
        token = link_in(last_mail("invited"))[1]["token"]
        client = actor()
        assert client.post(f"/api/public/invitations/{token}/accept/", {"full_name": role.title(), "password": PASSWORD, "confirm_password": PASSWORD}, format="json").status_code == 201
        sign_in(client, email)
        staff[role] = client

    # ---- Module 3: the recruiter builds and publishes a job (TC-14, TC-15) ----
    deadline = (timezone.now() + timedelta(days=5)).replace(microsecond=0)
    job = staff["recruiter"].post("/api/jobs/", {
        "title": "Backend Developer", "department": "Engineering", "description": "Build the APIs.", "employment_type": "full_time",
        "work_mode": "hybrid", "location": "Lahore", "required_skills": ["Python", "Django"], "deadline": deadline.isoformat(),
    }, format="json").json()
    assert job["status"] == "draft"
    assert staff["viewer"].post("/api/jobs/", {"title": "x", "department": "y"}, format="json").status_code == 403
    job_url = f"/api/jobs/{job['id']}/"
    for body in ({"label": "LinkedIn Profile URL", "field_type": "url"}, {"label": "Level", "field_type": "single_choice", "options": ["Junior", "Senior"], "required": True}):
        assert staff["recruiter"].post(job_url + "fields/", body, format="json").status_code == 201
    preview = staff["viewer"].get(job_url + "form-preview/").json()
    assert [f["key"] for f in preview["fields"]][-2:] == ["linkedin_profile_url", "level"] and preview["accepting"] is False
    published = staff["recruiter"].post(job_url + "publish/").json()
    assert published["status"] == "open" and published["share_url"].endswith(f"/apply/{published['form_slug']}")
    anonymous = actor()
    public = anonymous.get(f"/api/public/jobs/{published['form_slug']}/").json()
    assert public["accepting"] is True and public["fields"] == staff["viewer"].get(job_url + "form-preview/").json()["fields"]

    # ---- Module 4: applications (TC-17 to TC-21) ----
    apply_url = f"/api/public/jobs/{published['form_slug']}/apply/"
    answers = {"linkedin_profile_url": "https://linkedin.com/in/sara", "level": "Senior"}
    with capture():
        submitted = candidate.post(apply_url, form(email="sara@example.com", full_name="Sara Malik", resume=pdf("Sara CV.pdf", "sara resume"), **answers), format="multipart")
    assert submitted.status_code == 201
    reference = submitted.json()["reference"]
    confirmation = last_mail("Application received")
    assert confirmation.to == ["sara@example.com"] and reference in confirmation.body and "Backend Developer" in confirmation.body and "Acme Software" in confirmation.body
    again = anonymous.post(apply_url, form(email="SARA@example.com", **answers), format="multipart")
    assert again.status_code == 400 and again.json()["email"] == ["You have already applied for this position with this email."]
    assert anonymous.post(apply_url, form(email="bad@example.com", level="Lead", resume=None), format="multipart").json().keys() == {"level", "resume"}
    assert anonymous.post(apply_url, form(email="second@example.com", full_name="Omar Farooq", **answers), format="multipart").status_code == 201

    # ---- HR reviews (TC-18, TC-22) ----
    listing = staff["viewer"].get(job_url + "applications/").json()
    assert listing["count"] == 2 and listing["status_counts"]["submitted"] == 2
    sara = next(r for r in listing["results"] if r["reference"] == reference)
    detail = staff["viewer"].get(f"/api/applications/{sara['id']}/").json()
    assert [a["label"] for a in detail["answers"]] == ["LinkedIn Profile URL", "Level"] and detail["resume"]["name"] == "Sara CV.pdf"
    download = staff["viewer"].get(f"/api/applications/{sara['id']}/resume/")
    assert download.status_code == 200 and "Sara CV.pdf" in download["Content-Disposition"] and b"sara resume" in b"".join(download.streaming_content)
    assert staff["viewer"].patch(f"/api/applications/{sara['id']}/status/", {"status": "shortlisted"}, format="json").status_code == 403
    changed = staff["recruiter"].patch(f"/api/applications/{sara['id']}/status/", {"status": "shortlisted", "note": "Strong profile"}, format="json").json()
    assert [(h["from_status"], h["to_status"]) for h in changed["status_history"]] == [(None, "submitted"), ("submitted", "shortlisted")]

    rival = actor()
    with capture():
        rival.post("/api/auth/register/company/", {**registration, "company_name": "Rival Co", "official_email": "hr@rival.example"}, format="json")
    rival.post("/api/auth/verify-email/", {"token": link_in(last_mail("Verify"))[1]["token"]}, format="json")
    rival_id = next(c["id"] for c in platform.get("/api/platform-admin/companies/").json()["results"] if c["name"] == "Rival Co")
    platform.post(f"/api/platform-admin/companies/{rival_id}/approve/")
    sign_in(rival, "hr@rival.example")
    assert rival.get(f"/api/applications/{sara['id']}/").status_code == 404 and rival.get(f"/api/applications/{sara['id']}/resume/").status_code == 404
    assert rival.get(job_url).status_code == 404 and rival.get("/api/applications/").json()["count"] == 0

    # ---- the dashboard sees all of it (TC-12) ----
    board = staff["viewer"].get("/api/company/dashboard/").json()
    assert board["jobs"] == {"open": 1, "draft": 0, "closed": 0}
    assert board["applicants"] == {"total": 2, "new_last_7_days": 2}
    assert board["pipeline"]["shortlisted"] == 1 and board["pipeline"]["submitted"] == 1
    assert [c["title"] for c in board["closing_soon"]] == ["Backend Developer"] and board["closing_soon"][0]["application_count"] == 2
    assert {r["candidate_name"] for r in board["recent_applications"]} == {"Sara Malik", "Omar Farooq"}
    assert board["team"] == {"active_members": 3, "pending_invitations": 0}
    assert rival.get("/api/company/dashboard/").json()["applicants"]["total"] == 0

    # ---- export, edit, close (TC-16), reopen ----
    exported = staff["viewer"].get(job_url + "applications/export/")
    rows = list(csv.reader(io.StringIO(b"".join(exported.streaming_content).decode("utf-8-sig"))))
    assert len(rows) == 3 and rows[0][-2:] == ["LinkedIn Profile URL", "Level"]
    assert staff["recruiter"].patch(job_url, {"title": "Senior Backend Developer"}, format="json").status_code == 200
    assert staff["recruiter"].patch(job_url, {"department": "Sales"}, format="json").status_code == 409
    locked_field = published["custom_fields"][1]["id"]
    assert staff["recruiter"].delete(job_url + f"fields/{locked_field}/").status_code == 409  # locked once applications exist
    assert boss.post(job_url + "close/").status_code == 200
    assert anonymous.post(apply_url, form(email="late@example.com", **answers), format="multipart").status_code == 410
    assert anonymous.get(f"/api/public/jobs/{published['form_slug']}/").json()["accepting"] is False
    assert staff["viewer"].get("/api/company/dashboard/").json()["jobs"] == {"open": 0, "draft": 0, "closed": 1}
    assert boss.post(job_url + "reopen/", {"deadline": (timezone.now() + timedelta(days=9)).isoformat()}, format="json").status_code == 200
    assert anonymous.post(apply_url, form(email="back@example.com", **answers), format="multipart").status_code == 201

    # ---- sessions end properly (TC-04, TC-07) ----
    tokens = actor().post("/api/auth/login/", {"email": "hr@acme.example", "password": PASSWORD}, format="json").json()
    fresh = actor()
    refreshed = fresh.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json")
    assert refreshed.status_code == 200 and fresh.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code == 401
    fresh.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.json()['access']}")
    assert fresh.post("/api/auth/logout/", {"refresh": refreshed.json()["refresh"]}, format="json").status_code == 205
    assert fresh.post("/api/auth/token/refresh/", {"refresh": refreshed.json()["refresh"]}, format="json").status_code == 401
