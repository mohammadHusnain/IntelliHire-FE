# Module 12 — Talent communities

Django app label `communities` · Phase 2 guide, Module 12 · API under `/api/company/communities/…` and `/api/candidate/communities…`.

| Area | Where |
|---|---|
| Models: community, membership, invitation, join request, post, response | `models.py`, `migrations/` |
| Who fits a community | `services/eligibility.py` |
| Communities, membership, requests, invitations | `services/core.py` |
| Posts, responses, batched notification | `services/posts.py`, `tasks.py` |
| Discovery and staff candidate search | `services/discovery.py` |
| API | `views.py` (staff), `candidate_views.py`, `serializers.py`, `company_urls.py`, `candidate_urls.py` |
| Repair command | `management/commands/recompute_member_counts.py` |
| Tests | `tests/` |

Rules worth knowing
- **One eligibility function** drives discovery, requests and invitation previews.
- **The cached count is recomputed, never incremented,** in the same transaction as every change.
- **Staff never see contact details** of candidates in search, requests or members; only candidates who opted in can be found.
- **Notifications survive a restart:** the post row holds the cursor and the sweep resumes it.

Contracts: `documentation/API_CONTRACTS.md` (Module 12). Decisions: D-145-D-150.

Run only this module's tests: `python -m pytest apps/Module12_Communities`
