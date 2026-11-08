import pytest

from apps.common.choices import CompanyStatus, MemberRole

from .helpers import future

pytestmark = pytest.mark.django_db
URL = "/api/jobs/departments/"


class TestAccess:
    def test_anonymous_and_outsiders(self, api_client, auth_client, user_factory):
        assert api_client.get(URL).status_code == 401
        assert auth_client(user_factory()).get(URL).status_code == 403

    @pytest.mark.parametrize("role", MemberRole.values)
    def test_every_member_may_read_it(self, clients, role):
        assert clients[role].get(URL).status_code == 200

    def test_a_suspended_company_is_refused_like_every_other_jobs_call(self, team, clients):
        company, _ = team
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy breach here"
        company.save()
        assert clients[MemberRole.ADMIN].get(URL).status_code == 403


class TestContent:
    def test_empty_company_gets_an_empty_list(self, clients):
        assert clients[MemberRole.ADMIN].get(URL).json() == []

    def test_distinct_sorted_and_case_insensitive(self, team, clients, job_factory):
        company, users = team
        admin = users[MemberRole.ADMIN]
        for title, department in [("a", "Engineering"), ("b", "engineering"), ("c", "Engineering"), ("d", "Design"), ("e", "data science")]:
            job_factory(company, admin, title=title, department=department)
        assert clients[MemberRole.ADMIN].get(URL).json() == ["data science", "Design", "Engineering"]

    def test_covers_every_status(self, team, clients, job_factory):
        company, users = team
        admin = users[MemberRole.ADMIN]
        job_factory(company, admin, department="Drafts")
        job_factory(company, admin, status="open", department="Live", deadline=future(5))
        job_factory(company, admin, status="closed", department="Old")
        assert clients[MemberRole.VIEWER].get(URL).json() == ["Drafts", "Live", "Old"]

    def test_another_companys_departments_never_appear(self, team, clients, job_factory, member_factory):
        company, users = team
        job_factory(company, users[MemberRole.ADMIN], department="Mine")
        other = member_factory(MemberRole.ADMIN)
        job_factory(other.company_membership.company, other, department="Secret Skunkworks")
        assert clients[MemberRole.ADMIN].get(URL).json() == ["Mine"]

    def test_the_most_used_spelling_wins(self, team, clients, job_factory):
        company, users = team
        admin = users[MemberRole.ADMIN]
        for title, department in [("a", "QA"), ("b", "Qa"), ("c", "Qa")]:
            job_factory(company, admin, title=title, department=department)
        assert clients[MemberRole.ADMIN].get(URL).json() == ["Qa"]

    def test_is_not_confused_with_a_job_id(self, clients):
        assert clients[MemberRole.ADMIN].get(URL).status_code == 200
