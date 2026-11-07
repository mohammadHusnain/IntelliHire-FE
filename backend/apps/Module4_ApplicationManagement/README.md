# Module 4 — Candidate application management

Django app label `applications` · Doc §4 · API under `/api/public/jobs/<slug>/apply/` (public), `/api/jobs/<id>/applications/` and `/api/applications/` (HR side).

| Area | Where |
|---|---|
| Models: `Application`, `ApplicationFile`, `ApplicationStatusChange` | `models.py`, `migrations/` |
| Public submission: lock, validate, store, retry | `services/submission.py` |
| Validation of the built-in fields and the job's custom fields | `services/validation.py` (uses Module 3's `builtin_fields.py`) |
| HR side: scoped lookups, status change, status counts, CSV export | `services/review.py` |
| Validation and response shapes | `serializers/applications.py` |
| Thin views | `views/public.py` (apply), `views/review.py` (lists, detail, status, downloads, export) |
| URLs | `urls.py` (`/api/applications/`), `jobs_urls.py` (`/api/jobs/<id>/applications/…`), `public_urls.py` |
| Confirmation email | `emails.py` |
| Tests (183) | `tests/` — apply, review, isolation, Module 3 link, concurrency |

Rules worth knowing
- The apply endpoint is public, `multipart/form-data` only, throttled (10/hour/IP) and capped at 12 MB. Multiple-choice answers are repeated keys; the hidden `hp-website` field must stay empty.
- The job row is locked for the whole submission, so nothing is saved after a close. Everything is saved in one transaction; uploaded files are deleted again if anything fails.
- Files are in the private storage under `applications/<job_id>/<random>.<ext>` and are only reachable through the authenticated download endpoints of the owning company.
- One application per `(job, email)`, enforced by the database as well as by validation.
- Status history starts with the `submitted` row; later changes record who, when and the note.

Contracts: `documentation/API_CONTRACTS.md` (Module 4). Decisions: D-061–D-070.

Run only this module's tests: `python -m pytest apps/Module4_ApplicationManagement`
