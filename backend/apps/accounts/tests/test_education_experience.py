import pytest

from apps.accounts.models import CandidateProfile, Education, Experience

pytestmark = pytest.mark.django_db
EDU = "/api/auth/profile/education/"
EXP = "/api/auth/profile/experience/"


@pytest.fixture
def candidate(user_factory):
    user = user_factory()
    CandidateProfile.objects.create(user=user)
    return user


EDU_DATA = {"institution": "NUST", "degree": "BS", "field_of_study": "Computer Science", "start_year": 2018, "end_year": 2022, "grade": "3.6"}
EXP_DATA = {"company": "Acme", "position": "Developer", "start_date": "2022-01-01", "end_date": "2023-06-30", "description": "Built things."}


class TestEducation:
    def test_create_list_update_delete(self, auth_client, candidate):
        client = auth_client(candidate)
        created = client.post(EDU, EDU_DATA, format="json")
        assert created.status_code == 201
        row = created.json()
        assert row["institution"] == "NUST" and "id" in row and "profile" not in row

        assert client.get(EDU).json() == [row]
        patched = client.patch(f"{EDU}{row['id']}/", {"grade": "3.9"}, format="json")
        assert patched.status_code == 200 and patched.json()["grade"] == "3.9"
        assert client.delete(f"{EDU}{row['id']}/").status_code == 204
        assert client.get(EDU).json() == []

    def test_ongoing_education_has_no_end_year(self, auth_client, candidate):
        data = {k: v for k, v in EDU_DATA.items() if k not in ("end_year", "grade")}
        response = auth_client(candidate).post(EDU, data, format="json")
        assert response.status_code == 201 and response.json()["end_year"] is None

    @pytest.mark.parametrize(
        "change,field",
        [
            ({"end_year": 2017}, "end_year"),
            ({"start_year": 1900}, "start_year"),
            ({"start_year": 2999}, "start_year"),
            ({"institution": ""}, "institution"),
            ({"degree": "x" * 151}, "degree"),
        ],
    )
    def test_invalid_rows_are_field_errors(self, auth_client, candidate, change, field):
        response = auth_client(candidate).post(EDU, {**EDU_DATA, **change}, format="json")
        assert response.status_code == 400 and field in response.json()

    def test_required_fields(self, auth_client, candidate):
        assert set(auth_client(candidate).post(EDU, {}, format="json").json()) == {"institution", "degree", "field_of_study", "start_year"}

    def test_patching_the_end_year_is_checked_against_the_stored_start_year(self, auth_client, candidate):
        client = auth_client(candidate)
        row = client.post(EDU, EDU_DATA, format="json").json()
        assert client.patch(f"{EDU}{row['id']}/", {"end_year": 2010}, format="json").status_code == 400

    def test_a_candidate_cannot_see_or_touch_another_candidates_rows(self, auth_client, candidate, user_factory):
        row = auth_client(candidate).post(EDU, EDU_DATA, format="json").json()
        other = user_factory()
        client = auth_client(other)
        assert client.get(EDU).json() == []
        assert client.patch(f"{EDU}{row['id']}/", {"grade": "hacked"}, format="json").status_code == 404
        assert client.delete(f"{EDU}{row['id']}/").status_code == 404
        assert Education.objects.get(pk=row["id"]).grade == "3.6"

    def test_unknown_row_is_404(self, auth_client, candidate):
        assert auth_client(candidate).patch(f"{EDU}999999/", {"grade": "x"}, format="json").status_code == 404

    def test_the_number_of_rows_is_capped(self, auth_client, candidate):
        profile = CandidateProfile.objects.get(user=candidate)
        Education.objects.bulk_create(
            Education(profile=profile, institution=f"U{i}", degree="BS", field_of_study="CS", start_year=2000) for i in range(50)
        )
        response = auth_client(candidate).post(EDU, EDU_DATA, format="json")
        assert response.status_code == 400
        assert response.json() == {"detail": "You can add at most 50 entries.", "code": "limit_reached"}

    def test_access_rules_and_methods(self, api_client, auth_client, candidate, member_factory):
        assert api_client.get(EDU).status_code == 401
        assert auth_client(member_factory(role="admin")).get(EDU).status_code == 403
        client = auth_client(candidate)
        row = client.post(EDU, EDU_DATA, format="json").json()
        assert client.put(f"{EDU}{row['id']}/", EDU_DATA, format="json").status_code == 405
        assert client.get(f"{EDU}{row['id']}/").status_code == 405

    def test_profile_embeds_the_rows(self, auth_client, candidate):
        client = auth_client(candidate)
        client.post(EDU, EDU_DATA, format="json")
        assert [e["institution"] for e in client.get("/api/auth/profile/").json()["education"]] == ["NUST"]


class TestExperience:
    def test_create_list_update_delete(self, auth_client, candidate):
        client = auth_client(candidate)
        created = client.post(EXP, EXP_DATA, format="json")
        assert created.status_code == 201
        row = created.json()
        assert client.get(EXP).json() == [row]
        patched = client.patch(f"{EXP}{row['id']}/", {"position": "Senior Developer"}, format="json")
        assert patched.status_code == 200 and patched.json()["position"] == "Senior Developer"
        assert client.delete(f"{EXP}{row['id']}/").status_code == 204
        assert Experience.objects.count() == 0

    def test_a_current_position_has_no_end_date(self, auth_client, candidate):
        client = auth_client(candidate)
        ok = client.post(EXP, {**EXP_DATA, "is_current": True, "end_date": None}, format="json")
        assert ok.status_code == 201
        bad = client.post(EXP, {**EXP_DATA, "is_current": True}, format="json")
        assert bad.status_code == 400
        assert bad.json() == {"end_date": ["End date must be empty for a current position."]}

    def test_a_past_position_needs_an_end_date_after_the_start(self, auth_client, candidate):
        client = auth_client(candidate)
        missing = client.post(EXP, {k: v for k, v in EXP_DATA.items() if k != "end_date"}, format="json")
        assert missing.json() == {"end_date": ["End date is required for a past position."]}
        for end in ("2022-01-01", "2021-12-31"):
            response = client.post(EXP, {**EXP_DATA, "end_date": end}, format="json")
            assert response.json() == {"end_date": ["End date must be after the start date."]}

    def test_patch_rules_use_the_stored_values(self, auth_client, candidate):
        client = auth_client(candidate)
        row = client.post(EXP, EXP_DATA, format="json").json()
        url = f"{EXP}{row['id']}/"
        assert client.patch(url, {"is_current": True}, format="json").status_code == 400
        assert client.patch(url, {"is_current": True, "end_date": None}, format="json").status_code == 200
        assert client.patch(url, {"is_current": False}, format="json").status_code == 400
        assert client.patch(url, {"is_current": False, "end_date": "2024-01-01"}, format="json").status_code == 200

    def test_required_fields_and_formats(self, auth_client, candidate):
        client = auth_client(candidate)
        assert set(client.post(EXP, {}, format="json").json()) >= {"company", "position", "start_date"}
        assert "start_date" in client.post(EXP, {**EXP_DATA, "start_date": "yesterday"}, format="json").json()

    def test_isolation_and_limits(self, auth_client, candidate, user_factory):
        row = auth_client(candidate).post(EXP, EXP_DATA, format="json").json()
        other = auth_client(user_factory())
        assert other.get(EXP).json() == []
        assert other.patch(f"{EXP}{row['id']}/", {"company": "X"}, format="json").status_code == 404
        assert other.delete(f"{EXP}{row['id']}/").status_code == 404

        profile = CandidateProfile.objects.get(user=candidate)
        Experience.objects.bulk_create(
            Experience(profile=profile, company="C", position="P", start_date="2020-01-01", end_date="2021-01-01") for _ in range(49)
        )
        assert auth_client(candidate).post(EXP, EXP_DATA, format="json").json()["code"] == "limit_reached"
