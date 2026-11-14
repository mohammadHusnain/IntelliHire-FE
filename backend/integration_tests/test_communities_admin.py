"""Modules 12 and 13 across the seam: TC-42, TC-43, TC-46, moderation acting on a community,
isolation, and the database invariants the API alone cannot prove."""
import threading

import pytest
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module5_Foundation.models import ActivityEvent
from apps.Module12_Communities.models import (
    Community,
    CommunityInvitation,
    CommunityJoinRequest,
    CommunityMembership,
    CommunityPost,
    PostResponse,
)
from apps.Module12_Communities.services import core
from apps.Module12_Communities.tests.conftest import community, invite_only, make_candidate, me  # noqa: F401
from apps.Module13_PlatformAdmin.models import FlagStatus, ModerationFlag

pytestmark = pytest.mark.django_db

CAND_URL = "/api/candidate/"
STAFF_URL = "/api/company/communities/"
ADMIN_URL = "/api/platform-admin/"


def active_members(community):
    return CommunityMembership.objects.filter(community=community, status="active").count()


class TestGuideCases:
    def test_tc42_filtered_community_is_listed_and_says_why_you_do_not_qualify(self, team, clients, community, make_candidate, auth_client):
        """A community with filters appears in the company list; an ineligible candidate sees why."""
        listed = clients[MemberRole.ADMIN].get(STAFF_URL)
        assert listed.status_code == 200
        row = next(r for r in listed.data["results"] if str(r["id"]) == str(community.pk))
        assert row["filters"]["universities"] == ["FAST"]
        assert row["filters"]["grad_year_from"] == 2024

        outsider = make_candidate(institution="Other University", end_year=2019, skills=())
        discovered = auth_client(outsider).get(f"{CAND_URL}communities/")
        mine = next(r for r in discovered.data["results"] if str(r["id"]) == str(community.pk))
        assert mine["eligibility"]["eligible"] is False
        assert mine["eligibility"]["reasons"], "the candidate must be told what the requirements are"
        assert mine["state"] == "none"

        asked = auth_client(outsider).post(f"{CAND_URL}communities/{community.pk}/join/", {}, format="json")
        assert asked.status_code == 200, "an ineligible request is an answer, not an error"
        assert asked.data["status"] == "auto_rejected"
        assert asked.data["eligibility"]["reasons"]

    def test_tc43_a_member_sees_a_post_and_a_non_member_gets_404(self, team, clients, community, make_candidate, auth_client):
        member = make_candidate()
        core.add_member(community, member, "request")
        created = clients[MemberRole.ADMIN].post(
            f"{STAFF_URL}{community.pk}/posts/",
            {"kind": "job", "title": "Graduate role", "body": "Apply by Friday."},
            format="json",
        )
        assert created.status_code == 201
        post_id = created.data["id"]

        feed = auth_client(member).get(f"{CAND_URL}communities/{community.pk}/feed/")
        assert feed.status_code == 200
        assert [str(p["id"]) for p in feed.data["results"]] == [str(post_id)]

        outsider = make_candidate()
        assert auth_client(outsider).get(f"{CAND_URL}communities/{community.pk}/feed/").status_code == 404
        assert auth_client(outsider).post(f"{CAND_URL}community-posts/{post_id}/respond/", {}, format="json").status_code == 404

    def test_tc46_the_log_lists_events_and_flagging_one_reaches_moderation(self, admin_client, platform_admin, team, community):
        log = admin_client.get(f"{ADMIN_URL}activity/")
        assert log.status_code == 200
        rows = log.data["results"]
        assert rows, "creating a community writes an event"
        row = next(r for r in rows if r["target_type"] == "community")
        assert row["event_type"] and row["created_at"]
        assert row["actor"]["full_name"]

        flagged = admin_client.post(f"{ADMIN_URL}activity/{row['id']}/flag/", {"reason": "approved by mistake"}, format="json")
        assert flagged.status_code == 201
        flag = ModerationFlag.objects.get(pk=flagged.data["id"])
        assert (flag.target_type, str(flag.target_id)) == ("community", str(community.pk))

        resolved = admin_client.post(f"{ADMIN_URL}moderation/{flag.pk}/resolve/", {"note": "checked, fine", "action": "dismiss"}, format="json")
        assert resolved.status_code == 200
        flag.refresh_from_db()
        assert flag.status == FlagStatus.DISMISSED
        assert flag.resolved_by_id == platform_admin.pk, "the admin who decided is recorded"


class TestModerationActsOnACommunity:
    def test_taking_action_removes_the_community_through_its_own_service(self, admin_client, platform_admin, community, make_candidate):
        core.add_member(community, make_candidate(), "request")
        flag = ModerationFlag.objects.create(target_type="community", target_id=community.pk, reason="spam", source="admin", status=FlagStatus.OPEN)
        before = ActivityEvent.objects.count()

        resolved = admin_client.post(f"{ADMIN_URL}moderation/{flag.pk}/resolve/", {"note": "repeated spam", "action": "act"}, format="json")
        assert resolved.status_code == 200

        community.refresh_from_db()
        assert community.status == "removed", "the real service ran, not a second code path"
        flag.refresh_from_db()
        assert flag.status == FlagStatus.ACTIONED
        assert flag.action_taken == "removed_community"
        assert flag.resolved_by_id == platform_admin.pk
        assert ActivityEvent.objects.count() > before

    def test_a_removed_community_disappears_from_discovery_and_its_feed_closes(self, community, make_candidate, auth_client):
        member = make_candidate()
        core.add_member(community, member, "request")
        core.remove(community, community.created_by, "spam")

        client = auth_client(member)
        ids = [r["id"] for r in client.get(f"{CAND_URL}communities/").data["results"]]
        assert str(community.pk) not in [str(i) for i in ids]
        assert client.get(f"{CAND_URL}communities/{community.pk}/feed/").status_code == 404


class TestIsolation:
    """Company B asking for Company A's community is indistinguishable from a missing one."""

    def test_every_company_side_community_route_is_404_for_another_company(self, community, member_factory, auth_client, make_candidate):
        outsider = auth_client(member_factory(role=MemberRole.ADMIN))
        member = make_candidate()
        membership = core.add_member(community, member, "request")
        post = CommunityPost.objects.create(community=community, author=community.created_by, kind="job", title="t", body="b")
        invitation = CommunityInvitation.objects.create(community=community, user=member, invited_by=community.created_by, expires_at=timezone.now() + timezone.timedelta(days=14))
        request_row = CommunityJoinRequest.objects.create(community=community, user=make_candidate(), eligibility={})
        base = f"{STAFF_URL}{community.pk}/"
        gets = [base, f"{base}members/", f"{base}invitations/", f"{base}join-requests/", f"{base}posts/", f"{base}posts/{post.pk}/responses/", f"{base}candidates/search/"]
        for url in gets:
            assert outsider.get(url).status_code == 404, url
        posts_ = [
            (f"{base}archive/", {}),
            (f"{base}join-requests/{request_row.pk}/approve/", {}),
            (f"{base}join-requests/{request_row.pk}/reject/", {"reason": "no"}),
            (f"{base}posts/", {"kind": "job", "title": "t", "body": "b"}),
            (f"{base}invitations/", {"user_id": str(member.pk)}),
        ]
        for url, body in posts_:
            assert outsider.post(url, body, format="json").status_code == 404, url
        assert outsider.patch(base, {"name": "x"}, format="json").status_code == 404
        assert outsider.delete(base, {"reason": "mine now"}, format="json").status_code == 404
        assert outsider.delete(f"{base}members/{membership.user_id}/", {"reason": "x"}, format="json").status_code == 404
        assert outsider.delete(f"{base}invitations/{invitation.pk}/").status_code == 404
        assert outsider.patch(f"{base}posts/{post.pk}/", {"title": "x"}, format="json").status_code == 404

    def test_a_candidate_cannot_reach_the_company_or_admin_routes(self, community, me):
        _, client = me
        assert client.get(STAFF_URL).status_code == 403
        assert client.get(f"{ADMIN_URL}dashboard/").status_code == 403

    def test_company_staff_cannot_reach_the_platform_admin_routes(self, clients):
        for role in (MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER, MemberRole.VIEWER):
            assert clients[role].get(f"{ADMIN_URL}dashboard/").status_code == 403
            assert clients[role].get(f"{ADMIN_URL}moderation/").status_code == 403


class TestMemberCountInvariant:
    """`member_count` must always equal the active memberships, whatever path got us here."""

    def test_every_path_leaves_the_count_right(self, community, clients, make_candidate, auth_client):
        admin = clients[MemberRole.ADMIN]

        approved_candidate = make_candidate()
        request_row = CommunityJoinRequest.objects.create(community=community, user=approved_candidate, eligibility={"eligible": True, "reasons": []})
        assert admin.post(f"{STAFF_URL}{community.pk}/join-requests/{request_row.pk}/approve/", {}, format="json").status_code == 200
        community.refresh_from_db()
        assert community.member_count == active_members(community) == 1

        invited = make_candidate()
        invitation = admin.post(f"{STAFF_URL}{community.pk}/invitations/", {"user_id": str(invited.pk)}, format="json")
        assert invitation.status_code == 201
        assert auth_client(invited).post(f"{CAND_URL}community-invitations/{invitation.data['id']}/accept/", {}, format="json").status_code == 200
        community.refresh_from_db()
        assert community.member_count == active_members(community) == 2

        assert auth_client(invited).post(f"{CAND_URL}communities/{community.pk}/leave/", {}, format="json").status_code == 204
        community.refresh_from_db()
        assert community.member_count == active_members(community) == 1

        assert admin.delete(f"{STAFF_URL}{community.pk}/members/{approved_candidate.pk}/", {"reason": "left the course"}, format="json").status_code == 204
        community.refresh_from_db()
        assert community.member_count == active_members(community) == 0

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.parametrize("run", range(5))
    def test_two_joins_at_once_leave_the_count_right(self, community, make_candidate, auth_client, run):
        first, second = make_candidate(), make_candidate()
        rows = [
            CommunityJoinRequest.objects.create(community=community, user=first, eligibility={}),
            CommunityJoinRequest.objects.create(community=community, user=second, eligibility={}),
        ]
        errors = []

        def approve(row):
            try:
                core.approve(row, community.created_by)
            except Exception as problem:  # a loser is fine; a wrong count is not
                errors.append(problem)
            finally:
                connection.close()

        threads = [threading.Thread(target=approve, args=(row,)) for row in rows]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        community.refresh_from_db()
        assert community.member_count == active_members(community), errors

    def test_the_repair_command_is_a_no_op_on_healthy_data_and_fixes_drift(self, community, make_candidate):
        core.add_member(community, make_candidate(), "request")
        community.refresh_from_db()
        healthy = community.member_count

        call_command("recompute_member_counts")
        community.refresh_from_db()
        assert community.member_count == healthy

        Community.objects.filter(pk=community.pk).update(member_count=99)
        call_command("recompute_member_counts")
        community.refresh_from_db()
        assert community.member_count == healthy == active_members(community)


class TestDatabaseConstraints:
    """Asserted at the database, so a future code path cannot quietly break them."""

    def test_a_name_is_unique_per_company_case_insensitively(self, community, team):
        company, users = team
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Community.objects.create(
                    company=company, name=community.name.upper(), slug="other-slug",
                    description="d", mission="m", created_by=users[MemberRole.ADMIN],
                )

    def test_another_company_may_reuse_the_same_name(self, community, member_factory):
        elsewhere = member_factory(role=MemberRole.ADMIN)
        Community.objects.create(
            company=elsewhere.company_membership.company, name=community.name, slug="same-name-elsewhere",
            description="d", mission="m", created_by=elsewhere,
        )

    def test_one_membership_per_user_and_community(self, community, make_candidate):
        candidate = make_candidate()
        core.add_member(community, candidate, "request")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                CommunityMembership.objects.create(community=community, user=candidate, source="request")

    def test_only_one_pending_invitation_but_a_declined_one_may_follow(self, community, make_candidate):
        candidate = make_candidate()
        later = timezone.now() + timezone.timedelta(days=14)
        CommunityInvitation.objects.create(community=community, user=candidate, invited_by=community.created_by, expires_at=later)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                CommunityInvitation.objects.create(community=community, user=candidate, invited_by=community.created_by, expires_at=later)
        CommunityInvitation.objects.filter(community=community, user=candidate).update(status="declined")
        CommunityInvitation.objects.create(community=community, user=candidate, invited_by=community.created_by, expires_at=later)

    def test_only_one_pending_join_request_but_a_decided_one_may_follow(self, community, make_candidate):
        candidate = make_candidate()
        CommunityJoinRequest.objects.create(community=community, user=candidate, eligibility={})
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                CommunityJoinRequest.objects.create(community=community, user=candidate, eligibility={})
        CommunityJoinRequest.objects.filter(community=community, user=candidate).update(status="rejected")
        CommunityJoinRequest.objects.create(community=community, user=candidate, eligibility={})

    def test_one_response_per_user_and_post(self, community, make_candidate):
        candidate = make_candidate()
        core.add_member(community, candidate, "request")
        post = CommunityPost.objects.create(community=community, author=community.created_by, kind="job", title="t", body="b")
        PostResponse.objects.create(post=post, user=candidate)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                PostResponse.objects.create(post=post, user=candidate)

    def test_a_failure_mid_approve_leaves_no_membership_and_an_unchanged_count(self, community, make_candidate, monkeypatch):
        candidate = make_candidate()
        row = CommunityJoinRequest.objects.create(community=community, user=candidate, eligibility={})
        community.refresh_from_db()
        before = community.member_count

        monkeypatch.setattr("apps.Module12_Communities.services.core.log_event", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
        with pytest.raises(RuntimeError):
            core.approve(row, community.created_by)

        community.refresh_from_db()
        assert community.member_count == before
        assert not CommunityMembership.objects.filter(community=community, user=candidate, status="active").exists()


class TestActivityLogIsReadOnly:
    def test_an_event_cannot_be_changed_or_deleted(self, community):
        """Enforced in the ORM (queryset and model). There is no database trigger, so raw SQL
        is deliberately not claimed to be blocked."""
        from apps.Module5_Foundation.models import ImmutableRecordError

        event = ActivityEvent.objects.filter(target_type="community").first()
        assert event is not None
        with pytest.raises(ImmutableRecordError):
            ActivityEvent.objects.filter(pk=event.pk).update(summary="rewritten")
        with pytest.raises(ImmutableRecordError):
            ActivityEvent.objects.filter(pk=event.pk).delete()
        with pytest.raises(ImmutableRecordError):
            event.summary = "rewritten"
            event.save()
        with pytest.raises(ImmutableRecordError):
            event.delete()
        event.refresh_from_db()
        assert event.summary != "rewritten"

    def test_the_log_has_the_indexes_section_13_5_asks_for(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT indexdef FROM pg_indexes WHERE tablename = 'foundation_activityevent'")
            definitions = " ".join(row[0] for row in cursor.fetchall()).lower()
        for column in ("created_at", "event_type", "company_id", "actor_id"):
            assert column in definitions, f"no index covers {column}"

    def test_the_filtered_log_does_not_sequentially_scan(self, community):
        ActivityEvent.objects.bulk_create([
            ActivityEvent(event_type="noise.event", summary=f"row {n}", metadata={}) for n in range(3000)
        ])
        with connection.cursor() as cursor:
            cursor.execute("ANALYZE foundation_activityevent")
            cursor.execute("EXPLAIN SELECT * FROM foundation_activityevent WHERE event_type = %s ORDER BY created_at DESC LIMIT 20", ["community.created"])
            plan = " ".join(row[0] for row in cursor.fetchall()).lower()
        assert "index" in plan, plan


@pytest.mark.django_db(transaction=True)
class TestModerationConcurrency:
    @pytest.mark.parametrize("run", range(5))
    def test_two_admins_resolving_one_flag_leave_exactly_one_decision(self, community, user_factory, run):
        """Driven at the service layer: a thread has its own connection, so an HTTP client
        signed in on the test's connection would not be authenticated inside it."""
        from apps.common.choices import UserRole
        from apps.Module13_PlatformAdmin.services import moderation

        flag = ModerationFlag.objects.create(target_type="community", target_id=community.pk, reason="spam", source="admin", status=FlagStatus.OPEN)
        admins = [user_factory(role=UserRole.PLATFORM_ADMIN, email=f"admin{run}{n}@intellihire.example") for n in (1, 2)]
        wins, losses = [], []

        def resolve(admin):
            try:
                moderation.resolve(ModerationFlag.objects.get(pk=flag.pk), admin, "spam", act=False)
                wins.append(admin.pk)
            except Exception as problem:
                losses.append(problem)
            finally:
                connection.close()

        threads = [threading.Thread(target=resolve, args=(admin,)) for admin in admins]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        flag.refresh_from_db()
        assert flag.status == FlagStatus.DISMISSED
        assert flag.resolved_by_id in [a.pk for a in admins], "exactly one admin is recorded as the decider"
        assert len(wins) + len(losses) == 2
