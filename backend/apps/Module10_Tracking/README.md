# Module 10 — Candidate application tracking

Django app label `tracking` · Phase 2 guide, Module 10 · API under `/api/candidate/…` and `/api/public/track/…`. No tables: read models.

| Area | Where |
|---|---|
| What a candidate may read (labels, stages) | `labels.py`, `services/stages.py` (pure rules) |
| Access (own account or verified email, tracking token) and the one place the view is built | `services/access.py` |
| Fresh interview link, lost-link request, linking on verification | `services/interview_link.py`, `services/lost_links.py`, `services/linking.py` |
| The 48-hour reminder | `services/reminders.py`, `tasks.py` (`tracking.sweep` every 15 minutes) |
| Dashboard | `services/dashboard.py` (Module 11 registers the recent mock sessions) |
| Emails | `emails.py` |
| API | `views.py`, `serializers.py`, `candidate_urls.py`, `public_urls.py` |
| Tests | `tests/` |

Rules worth knowing
- **A whitelist, not a filter.** Candidate responses are built from explicit fields, so a new company-side field can never leak. A test scans every response for scores, notes and names.
- **Links are credentials.** Tracking and interview tokens are stored hashed; a new link replaces the old; the emails carrying them are marked sensitive and wiped after sending.
- **The lost-link answer never varies**, and one address cannot be flooded.

Contracts: `documentation/API_CONTRACTS.md` (Module 10). Decisions: D-131-D-137.

Run only this module's tests: `python -m pytest apps/Module10_Tracking`
