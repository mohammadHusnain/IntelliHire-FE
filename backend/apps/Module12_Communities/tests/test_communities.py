"""Talent communities (FR-64 to FR-70, UC-12, TC-42, TC-43): eligibility, staff management, discovery, requests, invitations, members, posts."""
import io
import threading
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.db import connection
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module5_Foundation.models import ActivityEvent, Notification, NotificationPreference, OutboundEmail

from .. import tasks
from ..models import Community, CommunityInvitation, CommunityJoinRequest, CommunityMembership, CommunityPost
from ..services import core, eligibility, posts
from .conftest import CAND, STAFF

pytestmark = pytest.mark.django_db


def join(client, community, **body):
    return client.post(f"{CAND}communities/{community.pk}/join/", body, format="json")


def make_member(community, user):
    return core.add_member(community, user, "request")


def opt_into_community_emails(users):
    NotificationPreference.objects.bulk_create([NotificationPreference(user=user, email_communities=True) for user in users])


class TestEligibility:
    def community(self, **filters):
        return Community(name="c", description="d", mission="m", **filters)

    def test_an_empty_filter_restricts_nothing(self, make_candidate):
        assert eligibility.check_eligibility(make_candidate(institution=None), self.community()) == {"eligible": True, "reasons": []}

    def test_universities_match_as_case_insensitive_substrings(self, make_candidate):
        user = make_candidate(institution="National University of FAST, Lahore")
        assert eligibility.check_eligibility(user, self.community(filter_universities=["fast"]))["eligible"]
        result = eligibility.check_eligibility(user, self.community(filter_universities=["MIT"]))
        assert not result["eligible"] and "MIT" in result["reasons"][0]

    def test_degrees_match_the_degree_or_the_field(self, make_candidate):
        user = make_candidate(degree="BSc")
        assert eligibility.check_eligibility(user, self.community(filter_degrees=["computer science"]))["eligible"]
        assert not eligibility.check_eligibility(user, self.community(filter_degrees=["law"]))["eligible"]

    def test_graduation_years_use_the_end_year_and_the_current_year_when_ongoing(self, make_candidate):
        user = make_candidate(end_year=2025)
        assert eligibility.check_eligibility(user, self.community(filter_grad_year_from=2024, filter_grad_year_to=2026))["eligible"]
        result = eligibility.check_eligibility(user, self.community(filter_grad_year_from=2027, filter_grad_year_to=2028))
        assert result["reasons"] == ["Requires graduation between 2027 and 2028."]
        user.candidate_profile.education.update(end_year=None)
        year = timezone.now().year
        assert eligibility.check_eligibility(user, self.community(filter_grad_year_from=year, filter_grad_year_to=year))["eligible"]

    def test_one_sided_year_ranges(self, make_candidate):
        user = make_candidate(end_year=2025)
        assert eligibility.check_eligibility(user, self.community(filter_grad_year_from=2025))["eligible"]
        assert eligibility.check_eligibility(user, self.community(filter_grad_year_to=2024))["reasons"] == ["Requires graduation in 2024 or earlier."]

    def test_skills_all_or_any_case_insensitively(self, make_candidate):
        user = make_candidate(skills=["python", "SQL"])
        assert eligibility.check_eligibility(user, self.community(filter_skills=["Python", "Go"], filter_skill_mode="any"))["eligible"]
        result = eligibility.check_eligibility(user, self.community(filter_skills=["Python", "Go"], filter_skill_mode="all"))
        assert not result["eligible"] and "all of" in result["reasons"][0]

    def test_every_failed_filter_is_explained(self, make_candidate):
        user = make_candidate(institution="Other", skills=[])
        result = eligibility.check_eligibility(user, self.community(filter_universities=["FAST"], filter_skills=["Go"], filter_grad_year_from=2030))
        assert len(result["reasons"]) == 3


class TestStaff:
    body = {"name": "Skill Group", "description": "People who code.", "mission": "Learn together.", "join_mode": "request", "filter_skills": ["Python"]}

    def test_admin_and_hr_manager_create_and_others_cannot(self, clients):
        assert clients[MemberRole.ADMIN].post(STAFF, self.body, format="json").status_code == 201
        assert clients[MemberRole.HR_MANAGER].post(STAFF, {**self.body, "name": "Another"}, format="json").status_code == 201
        for role in (MemberRole.RECRUITER, MemberRole.VIEWER):
            assert clients[role].post(STAFF, {**self.body, "name": f"X {role}"}, format="json").status_code == 403

    def test_creation_stores_the_filters_and_writes_an_event(self, clients):
        response = clients[MemberRole.ADMIN].post(STAFF, {**self.body, "filter_grad_year_from": 2024, "filter_grad_year_to": 2026, "filter_universities": [" FAST ", ""]}, format="json")
        body = response.json()
        assert body["filters"]["universities"] == ["FAST"] and body["filters"]["grad_year_from"] == 2024 and body["member_count"] == 0 and body["status"] == "active"
        assert ActivityEvent.objects.filter(event_type="community.created").count() == 1

    @pytest.mark.parametrize("change", [{"description": ""}, {"mission": ""}, {"mission": "x" * 501}, {"name": "  "}, {"join_mode": "secret"}, {"filter_grad_year_from": 2030, "filter_grad_year_to": 2020}, {"filter_skill_mode": "some"}, {"filter_skills": "Python"}, {"filter_grad_year_from": 1800}])
    def test_bad_input_is_400(self, clients, change):
        assert clients[MemberRole.ADMIN].post(STAFF, {**self.body, **change}, format="json").status_code == 400

    def test_the_name_is_unique_within_the_company_case_insensitively_but_not_across_companies(self, clients, community, member_factory, auth_client):
        assert clients[MemberRole.ADMIN].post(STAFF, {**self.body, "name": "fast ALUMNI"}, format="json").json()["name"]
        other = auth_client(member_factory(MemberRole.ADMIN))
        assert other.post(STAFF, {**self.body, "name": "FAST Alumni"}, format="json").status_code == 201

    def test_the_duplicate_name_is_400(self, clients, community):
        response = clients[MemberRole.ADMIN].post(STAFF, {**self.body, "name": "fast alumni"}, format="json")
        assert response.status_code == 400 and "name" in response.json()

    def test_an_unapproved_company_cannot_create(self, team):
        company, users = team
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        with pytest.raises(Exception):
            core.create(company, users[MemberRole.ADMIN], {"name": "x", "description": "d", "mission": "m"})

    def test_editing_does_not_remove_existing_members(self, clients, community, make_candidate):
        member = make_candidate()
        make_member(community, member)
        response = clients[MemberRole.HR_MANAGER].patch(f"{STAFF}{community.pk}/", {"filter_universities": ["MIT"]}, format="json")
        assert response.status_code == 200 and response.json()["member_count"] == 1
        assert CommunityMembership.objects.get(user=member).status == "active"

    def test_another_companys_community_is_404_on_every_staff_endpoint(self, community, member_factory, auth_client):
        outsider = auth_client(member_factory(MemberRole.ADMIN))
        base = f"{STAFF}{community.pk}/"
        for method, tail in (("get", ""), ("patch", ""), ("delete", ""), ("post", "archive/"), ("get", "members/"), ("get", "invitations/"), ("get", "join-requests/"), ("get", "posts/")):
            assert getattr(outsider, method)(base + tail, {}, format="json").status_code == 404, (method, tail)

    def test_viewers_read_and_cannot_write(self, clients, community):
        assert clients[MemberRole.VIEWER].get(f"{STAFF}{community.pk}/").status_code == 200
        assert clients[MemberRole.VIEWER].get(f"{STAFF}{community.pk}/members/").status_code == 200
        assert clients[MemberRole.VIEWER].post(f"{STAFF}{community.pk}/archive/").status_code == 403
        assert clients[MemberRole.RECRUITER].get(f"{STAFF}{community.pk}/join-requests/").status_code == 403

    def test_archive_hides_it_and_stops_new_joins_but_keeps_members_and_posts(self, clients, community, me):
        candidate, client = me
        make_member(community, candidate)
        post = posts.create(community, clients and community.created_by, {"kind": "announcement", "title": "Hello", "body": "Welcome"})
        assert clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/archive/").json()["status"] == "archived"
        assert clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/archive/").status_code == 409
        assert community.name not in [c["name"] for c in client.get(f"{CAND}communities/").json()["results"]]
        assert client.get(f"{CAND}communities/{community.pk}/feed/").json()["results"][0]["id"] == str(post.pk)  # members can still read
        assert join(client, community).status_code == 409 or join(client, community).status_code == 404

    def test_removing_marks_it_removed_emails_each_member_once_and_deletes_nothing(self, clients, community, make_candidate):
        members = [make_candidate() for _ in range(2)]
        opt_into_community_emails(members)
        for m in members:
            make_member(community, m)
        assert clients[MemberRole.ADMIN].delete(f"{STAFF}{community.pk}/", {"reason": "Closing the programme"}, format="json").status_code == 204
        community.refresh_from_db()
        assert community.status == "removed" and CommunityMembership.objects.count() == 2
        assert OutboundEmail.objects.filter(kind="community_removed").count() == 2 and ActivityEvent.objects.filter(event_type="community.removed").count() == 1
        assert clients[MemberRole.ADMIN].delete(f"{STAFF}{community.pk}/", {"reason": "again"}, format="json").status_code == 409
        assert clients[MemberRole.ADMIN].get(STAFF).json()["count"] == 0

    def test_removing_needs_a_reason(self, clients, community):
        assert clients[MemberRole.ADMIN].delete(f"{STAFF}{community.pk}/", {}, format="json").status_code == 400


class TestDiscovery:
    def test_a_request_mode_community_shows_with_eligibility_and_state(self, me, community):
        candidate, client = me
        row = client.get(f"{CAND}communities/").json()["results"][0]
        assert row["name"] == "FAST Alumni" and row["company"]["name"] and row["eligibility"] == {"eligible": True, "reasons": []} and row["state"] == "none" and row["member_count"] == 0

    def test_an_ineligible_candidate_sees_the_reasons(self, make_candidate, auth_client, community):
        row = auth_client(make_candidate(institution="Other", skills=[])).get(f"{CAND}communities/").json()["results"][0]
        assert row["eligibility"]["eligible"] is False and len(row["eligibility"]["reasons"]) >= 2

    def test_invite_only_never_appears_unless_invited(self, me, invite_only, clients):
        candidate, client = me
        assert client.get(f"{CAND}communities/").json()["count"] == 0
        assert client.get(f"{CAND}communities/{invite_only.pk}/").status_code == 404
        candidate.candidate_profile  # discoverable by default in the fixture
        clients[MemberRole.ADMIN].post(f"{STAFF}{invite_only.pk}/invitations/", {"user_id": str(candidate.pk)}, format="json")
        body = client.get(f"{CAND}communities/").json()["results"]
        assert [r["name"] for r in body] == ["Hidden Circle"] and body[0]["state"] == "invited"

    def test_search_and_company_filter(self, me, community):
        _, client = me
        assert client.get(f"{CAND}communities/", {"q": "alumni"}).json()["count"] == 1 and client.get(f"{CAND}communities/", {"q": "zzz"}).json()["count"] == 0
        assert client.get(f"{CAND}communities/", {"company": str(community.company_id)}).json()["count"] == 1

    def test_a_suspended_company_disappears_from_discovery_and_the_feed(self, me, community):
        candidate, client = me
        make_member(community, candidate)
        company = community.company
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        assert client.get(f"{CAND}communities/").json()["count"] == 0 and client.get(f"{CAND}communities/{community.pk}/feed/").status_code == 404
        assert client.get(f"{CAND}communities/mine/").json()["count"] == 0

    def test_the_member_list_is_never_part_of_a_candidate_view(self, me, community):
        _, client = me
        body = client.get(f"{CAND}communities/{community.pk}/").json()
        assert "members" not in body and "memberships" not in str(body)

    def test_company_users_cannot_use_the_candidate_endpoints(self, clients, community):
        assert clients[MemberRole.ADMIN].get(f"{CAND}communities/").status_code == 403


class TestJoin:
    def test_an_eligible_candidate_creates_a_pending_request_and_staff_are_told(self, me, community, team):
        candidate, client = me
        response = join(client, community, message="Hello")
        assert response.status_code == 201 and response.json()["status"] == "pending"
        assert Notification.objects.filter(kind="community_join_request").count() == 2  # admin and HR manager
        assert client.get(f"{CAND}communities/").json()["results"][0]["state"] == "pending_request"

    def test_join_request_creates_a_platform_admin_notification(self, me, community, user_factory):
        platform_admin = user_factory(role="platform_admin")
        join(me[1], community)
        notification = Notification.objects.get(user=platform_admin, kind="community_join_request")
        assert notification.link == "/admin/communities" and str(community.pk) == notification.payload["community_id"]

    def test_an_ineligible_candidate_gets_200_and_the_stored_reasons(self, make_candidate, auth_client, community):
        client = auth_client(make_candidate(institution="Other"))
        response = join(client, community)
        assert response.status_code == 200 and response.json()["status"] == "auto_rejected" and response.json()["eligibility"]["reasons"]
        assert CommunityJoinRequest.objects.get().status == "auto_rejected" and not Notification.objects.filter(kind="community_join_request").exists()

    def test_a_second_request_while_waiting_and_a_request_from_a_member_are_409(self, me, community):
        candidate, client = me
        join(client, community)
        assert join(client, community).status_code == 409
        make_member(community, candidate)
        assert join(client, community).json()["code"] == "already_member"

    def test_an_invite_only_community_is_404_without_an_invitation_and_points_to_the_invitation_with_one(self, me, invite_only, clients):
        candidate, client = me
        assert join(client, invite_only).status_code == 404
        clients[MemberRole.ADMIN].post(f"{STAFF}{invite_only.pk}/invitations/", {"user_id": str(candidate.pk)}, format="json")
        assert join(client, invite_only).json()["code"] == "accept_invitation"

    def test_leaving_and_rejoining(self, me, community):
        candidate, client = me
        make_member(community, candidate)
        assert client.post(f"{CAND}communities/{community.pk}/leave/").status_code == 204
        community.refresh_from_db()
        assert community.member_count == 0 and client.post(f"{CAND}communities/{community.pk}/leave/").status_code == 404
        assert join(client, community).status_code == 201


class TestReview:
    def pending(self, me, community):
        join(me[1], community, message="Please")
        return CommunityJoinRequest.objects.get()

    def test_staff_see_the_request_with_a_profile_summary_and_the_eligibility_snapshot(self, me, community, clients):
        request = self.pending(me, community)
        row = clients[MemberRole.ADMIN].get(f"{STAFF}{community.pk}/join-requests/").json()["results"][0]
        assert row["id"] == str(request.pk) and row["candidate"]["full_name"] == "Sara Malik" and row["candidate"]["headline"] and row["eligibility"]["eligible"] is True
        assert "email" not in str(row) and "phone" not in str(row)

    def test_approving_creates_the_membership_updates_the_count_and_tells_the_candidate(self, me, community, clients):
        request = self.pending(me, community)
        NotificationPreference.objects.create(user=me[0], email_communities=True)
        response = clients[MemberRole.HR_MANAGER].post(f"{STAFF}{community.pk}/join-requests/{request.pk}/approve/")
        assert response.status_code == 200 and response.json()["status"] == "approved"
        community.refresh_from_db()
        assert community.member_count == 1 and CommunityMembership.objects.get().source == "request"
        assert Notification.objects.filter(user=me[0], kind="community_join_approved").exists() and OutboundEmail.objects.filter(kind="community_join_approved").exists()
        assert clients[MemberRole.HR_MANAGER].post(f"{STAFF}{community.pk}/join-requests/{request.pk}/approve/").status_code == 409

    def test_rejecting_needs_a_reason_and_tells_the_candidate(self, me, community, clients):
        request = self.pending(me, community)
        url = f"{STAFF}{community.pk}/join-requests/{request.pk}/reject/"
        assert clients[MemberRole.ADMIN].post(url, {}, format="json").status_code == 400
        assert clients[MemberRole.ADMIN].post(url, {"reason": "Not a fit"}, format="json").json()["decision_reason"] == "Not a fit"
        assert Notification.objects.filter(user=me[0], kind="community_join_rejected").exists() and clients[MemberRole.ADMIN].post(url, {"reason": "x"}, format="json").status_code == 409

    def test_recruiters_cannot_review(self, me, community, clients):
        request = self.pending(me, community)
        assert clients[MemberRole.RECRUITER].post(f"{STAFF}{community.pk}/join-requests/{request.pk}/approve/").status_code == 403

    def test_two_staff_approving_at_once_make_one_member(self, me, community, clients):
        request = self.pending(me, community)
        url = f"{STAFF}{community.pk}/join-requests/{request.pk}/approve/"
        codes = sorted(clients[role].post(url).status_code for role in (MemberRole.ADMIN, MemberRole.HR_MANAGER))
        assert codes == [200, 409] and CommunityMembership.objects.count() == 1


class TestInvitations:
    def invite(self, clients, community, user, **body):
        return clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/invitations/", {"user_id": str(user.pk), **body}, format="json")

    def test_search_finds_only_opted_in_verified_candidates_and_never_shows_contact_details(self, clients, community, make_candidate):
        make_candidate(name="Visible Vera")
        make_candidate(name="Hidden Hana", discoverable=False)
        make_candidate(name="Unverified Uma", email_verified=False, status="pending_verification")
        rows = clients[MemberRole.ADMIN].get(f"{STAFF}{community.pk}/candidates/search/").json()["results"]
        assert [r["full_name"] for r in rows] == ["Visible Vera"]
        assert set(rows[0]) == {"id", "full_name", "headline", "institution", "degree", "skills", "eligible", "reasons"} and "@" not in str(rows[0]) and "+92" not in str(rows[0])

    def test_search_filters_and_the_eligible_switch(self, clients, community, make_candidate):
        make_candidate(name="Fits", institution="FAST NUCES", skills=["Python"])
        make_candidate(name="Misses", institution="Other", skills=["Go"])
        get = lambda **q: [r["full_name"] for r in clients[MemberRole.ADMIN].get(f"{STAFF}{community.pk}/candidates/search/", q).json()["results"]]  # noqa: E731
        assert get() == ["Fits", "Misses"] and get(eligible_only="true") == ["Fits"] and get(university="other") == ["Misses"] and get(skill="go") == ["Misses"] and get(q="fits") == ["Fits"]
        assert clients[MemberRole.ADMIN].get(f"{STAFF}{community.pk}/candidates/search/", {"grad_year": "x"}).status_code == 400

    def test_members_are_left_out_of_the_search(self, clients, community, make_candidate):
        make_member(community, make_candidate(name="Already In"))
        assert clients[MemberRole.ADMIN].get(f"{STAFF}{community.pk}/candidates/search/").json()["results"] == []

    def test_viewers_and_recruiters_cannot_search_or_invite(self, clients, community, make_candidate):
        user = make_candidate()
        for role in (MemberRole.VIEWER, MemberRole.RECRUITER):
            assert clients[role].get(f"{STAFF}{community.pk}/candidates/search/").status_code == 403
            assert clients[role].post(f"{STAFF}{community.pk}/invitations/", {"user_id": str(user.pk)}, format="json").status_code == 403

    def test_inviting_notifies_emails_and_works_even_for_an_ineligible_candidate_with_a_warning(self, clients, community, make_candidate):
        user = make_candidate(institution="Other", skills=[])
        NotificationPreference.objects.create(user=user, email_communities=True)
        response = self.invite(clients, community, user, message="Join us")
        assert response.status_code == 201 and response.json()["eligibility"]["eligible"] is False and response.json()["eligibility"]["reasons"]
        assert Notification.objects.filter(user=user, kind="community_invitation").exists() and OutboundEmail.objects.filter(kind="community_invitation", to_email=user.email).exists()
        assert 13 < (CommunityInvitation.objects.get().expires_at - timezone.now()).days + 1 <= 14

    def test_a_candidate_can_opt_out_of_community_invitation_email_and_in_app_notifications(self, clients, community, make_candidate):
        user = make_candidate()
        NotificationPreference.objects.create(user=user, email_communities=False, in_app_communities=False)
        assert self.invite(clients, community, user).status_code == 201
        assert not Notification.objects.filter(user=user, kind="community_invitation").exists()
        assert not OutboundEmail.objects.filter(kind="community_invitation", to_email=user.email).exists()

    def test_only_discoverable_verified_candidates_can_be_invited(self, clients, community, make_candidate):
        assert self.invite(clients, community, make_candidate(discoverable=False)).status_code == 404
        assert self.invite(clients, community, make_candidate(email_verified=False, status="pending_verification")).status_code == 404

    def test_a_member_or_an_invited_candidate_is_409(self, clients, community, make_candidate):
        user = make_candidate()
        assert self.invite(clients, community, user).status_code == 201 and self.invite(clients, community, user).json()["code"] == "already_invited"
        other = make_candidate()
        make_member(community, other)
        assert self.invite(clients, community, other).json()["code"] == "already_member"

    def test_accepting_makes_a_member_with_source_invitation(self, clients, community, make_candidate, auth_client):
        user = make_candidate()
        invitation_id = self.invite(clients, community, user).json()["id"]
        client = auth_client(user)
        assert client.get(f"{CAND}community-invitations/").json()["results"][0]["community"]["name"] == "FAST Alumni"
        response = client.post(f"{CAND}community-invitations/{invitation_id}/accept/")
        assert response.status_code == 200 and response.json()["source"] == "invitation"
        community.refresh_from_db()
        assert community.member_count == 1 and client.post(f"{CAND}community-invitations/{invitation_id}/accept/").status_code == 409

    def test_declining_and_withdrawing(self, clients, community, make_candidate, auth_client):
        user = make_candidate()
        first = self.invite(clients, community, user).json()["id"]
        assert auth_client(user).post(f"{CAND}community-invitations/{first}/decline/").json()["status"] == "declined"
        second = self.invite(clients, community, user).json()["id"]
        assert clients[MemberRole.ADMIN].delete(f"{STAFF}{community.pk}/invitations/{second}/").status_code == 204
        assert auth_client(user).post(f"{CAND}community-invitations/{second}/accept/").status_code == 409

    def test_an_expired_invitation_is_410_and_the_sweep_expires_old_ones(self, clients, community, make_candidate, auth_client):
        user = make_candidate()
        invitation_id = self.invite(clients, community, user).json()["id"]
        CommunityInvitation.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        assert auth_client(user).post(f"{CAND}community-invitations/{invitation_id}/accept/").status_code == 410
        assert CommunityInvitation.objects.get().status == "expired"
        other = make_candidate()
        self.invite(clients, community, other)
        CommunityInvitation.objects.filter(status="pending").update(expires_at=timezone.now() - timedelta(minutes=1))
        assert tasks.sweep()["expired"] == 1

    def test_someone_elses_invitation_is_404(self, clients, community, make_candidate, auth_client):
        invitation_id = self.invite(clients, community, make_candidate()).json()["id"]
        assert auth_client(make_candidate()).post(f"{CAND}community-invitations/{invitation_id}/accept/").status_code == 404

    def test_an_invitation_and_a_request_at_once_whichever_is_accepted_first_wins_and_the_other_closes(self, clients, community, make_candidate, auth_client):
        user = make_candidate()
        client = auth_client(user)
        join(client, community)
        invitation_id = self.invite(clients, community, user).json()["id"]
        client.post(f"{CAND}community-invitations/{invitation_id}/accept/")
        assert CommunityJoinRequest.objects.get().status == "approved" and CommunityMembership.objects.count() == 1
        other = make_candidate()
        client2 = auth_client(other)
        join(client2, community)
        self.invite(clients, community, other)
        request = CommunityJoinRequest.objects.get(user=other)
        clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/join-requests/{request.pk}/approve/")
        assert CommunityInvitation.objects.get(user=other).status == "revoked" and CommunityMembership.objects.filter(user=other).count() == 1


class TestMembers:
    def test_staff_list_search_and_order_members_with_a_profile_summary(self, clients, community, make_candidate):
        a = make_candidate(name="Alice", institution="FAST", skills=["Python"])
        b = make_candidate(name="Bob", institution="Zeta Uni", skills=[])
        make_member(community, a)
        make_member(community, b)
        url = f"{STAFF}{community.pk}/members/"
        rows = clients[MemberRole.VIEWER].get(url).json()["results"]
        assert {r["full_name"] for r in rows} == {"Alice", "Bob"} and set(rows[0]) >= {"headline", "institution", "skills", "joined_at"} and "@" not in str(rows)
        assert [r["full_name"] for r in clients[MemberRole.VIEWER].get(url, {"q": "bo"}).json()["results"]] == ["Bob"]
        assert [r["full_name"] for r in clients[MemberRole.VIEWER].get(url, {"ordering": "skill_match"}).json()["results"]][0] == "Alice"
        assert [r["full_name"] for r in clients[MemberRole.VIEWER].get(url, {"ordering": "joined_at"}).json()["results"]] == ["Alice", "Bob"]

    def test_removing_a_member_needs_a_reason_notifies_them_and_hides_the_posts(self, clients, community, make_candidate, auth_client):
        user = make_candidate()
        NotificationPreference.objects.create(user=user, email_communities=True)
        make_member(community, user)
        posts.create(community, community.created_by, {"kind": "job", "title": "Role", "body": "Apply"})
        url = f"{STAFF}{community.pk}/members/{user.pk}/"
        assert clients[MemberRole.ADMIN].delete(url, {}, format="json").status_code == 400
        assert clients[MemberRole.ADMIN].delete(url, {"reason": "Left the programme"}, format="json").status_code == 204
        community.refresh_from_db()
        assert community.member_count == 0 and Notification.objects.filter(user=user, kind="community_member_removed").exists() and OutboundEmail.objects.filter(kind="community_member_removed").exists()
        assert auth_client(user).get(f"{CAND}communities/{community.pk}/feed/").status_code == 404
        assert clients[MemberRole.ADMIN].delete(url, {"reason": "again"}, format="json").status_code == 404


class TestPosts:
    body = {"kind": "internship", "title": "Summer internship", "body": "Apply by June.", "apply_url": "https://example.com/apply"}

    def test_staff_create_edit_archive_and_members_read_the_feed(self, clients, community, me):
        candidate, client = me
        make_member(community, candidate)
        created = clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/posts/", self.body, format="json")
        assert created.status_code == 201
        post_id = created.json()["id"]
        assert clients[MemberRole.HR_MANAGER].patch(f"{STAFF}{community.pk}/posts/{post_id}/", {"title": "Edited"}, format="json").json()["title"] == "Edited"
        feed = client.get(f"{CAND}communities/{community.pk}/feed/").json()["results"]
        assert [p["title"] for p in feed] == ["Edited"] and feed[0]["closed"] is False
        assert clients[MemberRole.ADMIN].delete(f"{STAFF}{community.pk}/posts/{post_id}/").status_code == 204
        assert client.get(f"{CAND}communities/{community.pk}/feed/").json()["results"] == []

    def test_a_non_member_gets_404_for_the_feed_and_for_responding(self, clients, community, me):
        _, client = me
        post = posts.create(community, community.created_by, {"kind": "event", "title": "Meetup", "body": "Join"})
        assert client.get(f"{CAND}communities/{community.pk}/feed/").status_code == 404
        assert client.post(f"{CAND}community-posts/{post.pk}/respond/", {}, format="json").status_code == 404

    @pytest.mark.parametrize("change", [{"kind": "tweet"}, {"title": ""}, {"body": "x" * 5001}, {"apply_url": "not a url"}])
    def test_bad_posts_are_400(self, clients, community, change):
        assert clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/posts/", {**self.body, **change}, format="json").status_code == 400

    def test_a_post_can_link_a_published_job_of_the_same_company_only(self, clients, community, team, job_factory, member_factory):
        company, users = team
        own = job_factory(company, users[MemberRole.ADMIN], status="open")
        draft = job_factory(company, users[MemberRole.ADMIN], status="draft")
        other = job_factory(member_factory(MemberRole.ADMIN).company_membership.company, status="open")
        url = f"{STAFF}{community.pk}/posts/"
        assert clients[MemberRole.ADMIN].post(url, {**self.body, "job": str(own.pk)}, format="json").json()["job_id"] == str(own.pk)
        assert clients[MemberRole.ADMIN].post(url, {**self.body, "job": str(draft.pk)}, format="json").status_code == 400
        assert clients[MemberRole.ADMIN].post(url, {**self.body, "job": str(other.pk)}, format="json").status_code == 400

    def test_responding_once_and_staff_see_the_responses_and_a_closed_post_refuses(self, clients, community, me):
        candidate, client = me
        make_member(community, candidate)
        post = posts.create(community, community.created_by, {"kind": "job", "title": "Role", "body": "Apply"})
        url = f"{CAND}community-posts/{post.pk}/respond/"
        assert client.post(url, {"message": "Interested"}, format="json").status_code == 201 and client.post(url, {}, format="json").json()["code"] == "already_responded"
        rows = clients[MemberRole.VIEWER].get(f"{STAFF}{community.pk}/posts/{post.pk}/responses/").json()["results"]
        assert rows[0]["message"] == "Interested" and rows[0]["candidate"]["full_name"] == "Sara Malik" and "@" not in str(rows)
        closed = posts.create(community, community.created_by, {"kind": "event", "title": "Old", "body": "x", "closes_at": timezone.now() - timedelta(days=1)})
        assert client.post(f"{CAND}community-posts/{closed.pk}/respond/", {}, format="json").json()["code"] == "post_closed"
        assert next(p for p in client.get(f"{CAND}communities/{community.pk}/feed/").json()["results"] if p["id"] == str(closed.pk))["closed"] is True

    def test_notify_members_sends_in_app_and_email_in_batches_of_50_skipping_suspended_accounts(self, clients, community, make_candidate, monkeypatch, django_capture_on_commit_callbacks):
        monkeypatch.setattr(posts, "BATCH_SIZE", 2)
        members = [make_candidate() for _ in range(5)]
        for m in members:
            make_member(community, m)
        members[0].status = "suspended"
        members[0].save()
        batches = []
        original = posts.notify_next_batch
        monkeypatch.setattr(posts, "notify_next_batch", lambda pid: (batches.append(1), original(pid))[1])
        opt_into_community_emails(members)
        with django_capture_on_commit_callbacks(execute=True):
            response = clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/posts/", {**self.body, "notify_members": True}, format="json")
        assert response.status_code == 201
        post = CommunityPost.objects.get()
        assert len(batches) == 3 and post.notify_state == "done"
        assert Notification.objects.filter(kind="community_post").count() == 4 and OutboundEmail.objects.filter(kind="community_post").count() == 4
        assert not Notification.objects.filter(kind="community_post", user=members[0]).exists()

    def test_a_post_without_notify_members_notifies_nobody(self, clients, community, make_candidate):
        make_member(community, make_candidate())
        clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/posts/", self.body, format="json")
        assert not Notification.objects.filter(kind="community_post").exists()

    def test_community_post_email_is_not_sent_without_opt_in(self, clients, community, make_candidate, django_capture_on_commit_callbacks):
        member = make_candidate()
        make_member(community, member)
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].post(f"{STAFF}{community.pk}/posts/", {**self.body, "notify_members": True}, format="json")
        assert Notification.objects.filter(user=member, kind="community_post").exists()
        assert not OutboundEmail.objects.filter(kind="community_post", to_email=member.email).exists()

    def test_the_sweep_resumes_an_unfinished_notification(self, community, make_candidate, django_capture_on_commit_callbacks):
        make_member(community, make_candidate())
        post = CommunityPost.objects.create(community=community, author=community.created_by, kind="job", title="T", body="B", notify_state="pending")
        with django_capture_on_commit_callbacks(execute=True):
            assert tasks.sweep()["resumed"] == 1
        post.refresh_from_db()
        assert post.notify_state == "done" and Notification.objects.filter(kind="community_post").count() == 1

    def test_posts_of_a_removed_community_cannot_be_opened(self, clients, community, me):
        candidate, client = me
        make_member(community, candidate)
        clients[MemberRole.ADMIN].delete(f"{STAFF}{community.pk}/", {"reason": "closing"}, format="json")
        assert client.get(f"{CAND}communities/{community.pk}/feed/").status_code == 404


class TestMemberCount:
    def test_the_cached_count_equals_the_active_memberships_through_every_change(self, community, make_candidate, clients):
        users = [make_candidate() for _ in range(3)]
        for u in users:
            make_member(community, u)
        core.leave(community, users[0])
        core.remove_member(community, users[1].pk, community.created_by, "reason")
        community.refresh_from_db()
        assert community.member_count == CommunityMembership.objects.filter(community=community, status="active").count() == 1

    def test_the_command_repairs_a_drifted_count(self, community, make_candidate):
        make_member(community, make_candidate())
        Community.objects.filter(pk=community.pk).update(member_count=99)
        out = io.StringIO()
        call_command("recompute_member_counts", stdout=out)
        community.refresh_from_db()
        assert community.member_count == 1 and "1 community" in out.getvalue()


class TestDiscoverableSetting:
    def test_the_profile_carries_the_opt_in_and_defaults_to_false(self, user_factory, auth_client):
        client = auth_client(user_factory())
        assert client.get("/api/auth/profile/").json()["discoverable"] is False
        assert client.patch("/api/auth/profile/", {"discoverable": True}, format="json").json()["discoverable"] is True


@pytest.mark.django_db(transaction=True)
def test_two_joins_at_once_make_one_pending_request(community, make_candidate, auth_client, ensure_bank=None):
    user = make_candidate()
    barrier, codes = threading.Barrier(2), []

    def attempt():
        try:
            barrier.wait(timeout=10)
            codes.append(join(auth_client(user), community).status_code)
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    assert sorted(codes) == [201, 409] and CommunityJoinRequest.objects.filter(user=user).count() == 1
