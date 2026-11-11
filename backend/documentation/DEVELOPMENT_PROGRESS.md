# Development Progress

A step is "complete" only when implementation, executed tests, documentation and contracts are verified **and the owner has approved it**.

## Phase status

| Phase | Status |
|---|---|
| 1 — Project understanding | Complete |
| 2 — Backend foundation | **Complete.** Approved by the owner and merged into `IntelliHire-backend` (`a1c6cec`) |
| 3 — Module 1: Authentication and accounts | **Complete.** Approved by the owner and merged into `IntelliHire-backend` (`7fdb54b`); `main` untouched |
| Phase 2 guide — Module 5: AI and notifications foundation | **Built; awaiting the owner's approval** |
| Phase 2 guide — Module 6: CV analysis and shortlisting | **Built; awaiting the owner's approval** |
| 3 — Module 2: Company management | **Complete.** Approved by the owner and merged into `IntelliHire-backend` (`53826a8`) |
| 3 — Module 3: Job posting and form | **Complete.** Approved by the owner and merged into `IntelliHire-backend` (`941f3f4`) |
| 3 — Module 4: Applications | **Complete.** Verified on a fresh clone of GitHub and approved by the owner; on `IntelliHire-backend` (`7a57b04`) |
| Company dashboard, Integration (Phase 4) | **Complete.** Verified on a fresh clone of GitHub and approved by the owner; on `IntelliHire-backend` (`f1adaaf`) |
| Phase 5 — Frontend integration | Not started; requires explicit owner authorisation |

## Module 1 (built on `backend/module-01`, merged into `IntelliHire-backend`)

**Delivered**
- All 17 Doc endpoints for authentication and the candidate profile, plus the owner-approved additions: authenticated CV download and platform-admin user suspend/reactivate (see `API_CONTRACTS.md`).
- Company sign-up (Doc: Module 1 flow, served from the `companies` app).
- Status-aware JWT authentication, explicit refresh-token rotation, role permission classes, throttling, CV text extraction, upload and request-size limits.
- Migration `accounts.0002` (profile fields approved in Q14).

**Verified (executed here: Python 3.13, PostgreSQL 16.15)**
- `python -m pytest`: **304 passed** (accounts 196, companies 39, common 69).
- `makemigrations --check`: no changes. `spectacular --validate --fail-on-warn`: passes. `check --deploy` (production settings): only the two deliberately-off HSTS include-subdomains/preload warnings.
- The committed tree was exported, installed into a fresh virtualenv from `requirements/dev.txt` and tested there: 304 passed.
- Live HTTP smoke test against a running server: CORS allows only the configured origin; register → verification link taken from the real email output → login → profile update → CV upload and byte-identical download → logout → refresh refused; wrong CV type refused; no passwords or tokens in the server log.
- TC-01 to TC-07 each have a named automated test (see `REQUIREMENTS.md`).

**Not done in Module 1 (by design)**
- Platform-admin "new company" email (Module 2, D-036), company review/approval, invitations (Module 2).
- SMTP delivery, Azure storage and the production cache table were not exercised (deployment target undecided, Q3).

**Known limits** are listed in D-037.

## Module 2 (built on `backend/module-02`, merged into `IntelliHire-backend`)

**Delivered**
- All 15 Doc §2.4 endpoints: platform-admin company review (list, detail, approve, reject, suspend, reactivate), company profile, dashboard, members, invitations (create, list, resend, revoke), public invitation details/accept, and resubmission after rejection.
- Emails of Doc §2.5 (registration received, platform-admin notices, approved, rejected with reason, invitation).
- Migration `companies.0002` (`suspension_reason`, D-039).
- Folder convention `apps/Module<N>_<Name>` (D-038) and per-module `README.md`.

**Honest scope note.** The dashboard returns live `company` and `team` blocks; the `jobs`, `applicants`, `pipeline`, `closing_soon` and `recent_applications` blocks are zeros/empty by design until Modules 3 and 4 exist. The final dashboard step wires them.

**Verified (executed here: Python 3.13, PostgreSQL 16)**
- `python -m pytest`: **511 passed** = the 304 earlier tests (unchanged apart from three mock-patch paths in one test file) + 207 new Module 2 tests, including real-thread concurrency tests (run 5× in a row, stable).
- `makemigrations --check`: no changes. `spectacular --validate --fail-on-warn`: passes. `check --deploy` with production settings: only the two deliberate HSTS warnings.
- Live HTTP self-test against `runserver` on PostgreSQL: 49 of 49 steps behaved as specified (register → verify → pending login 403 → review → reject → resubmit → approve → profile/logo → dashboard → invite → resend → old link dead → accept → login → role change → deactivate → refresh revoked → revoke → suspend → reactivate). No 500s; no passwords or JWTs in the server log. The test data was removed from the dev database afterwards.
- Real bug found by the new tests and fixed: after resubmission the founder stayed `rejected` because the company cached on the user object was stale (the user is now reloaded before the status is derived).

**Not done / limits**
- Jobs/applications metrics (Modules 3–4); SMTP delivery and Azure storage not exercised (Q3).
- The last-admin guard is unreachable through the API (the caller is always an active admin who cannot touch themselves), so it is tested at service level and acts as a safety net for races.

## Module 3 (merged into `IntelliHire-backend`)

**Delivered**
- All 14 endpoint rows of Doc §3.4: job list/create/detail/edit/delete-draft, publish (permanent slug and share URL), close, reopen, duplicate, form preview, custom fields (list, add, edit, delete, reorder with the post-application locking rules) and the public job endpoint.
- Built-in application fields defined once (`builtin_fields.py`) for Module 4 to reuse; one form-schema builder for preview and public.
- `close_expired_jobs` management command (bulk update).
- Migration `jobs.0001_initial` with database-level state constraints (D-060).
- Decisions D-048 to D-060; Q5 and Q16 resolved by defaults.

**Honest scope notes**
- `applications_count` is 0 and the "locked after the first application" rule has no real applications to react to until Module 4. The rule is implemented and tested with the application check patched to true.
- TC-16's "submit returns 410" belongs to Module 4's submit endpoint; here the public endpoint reports `accepting: false` and the command closes the job.
- The dashboard's jobs/applications blocks are still zeros; they are wired in the dashboard step after Module 4 (Doc build order).
- Scheduling the command every 5 minutes is documented but not set up anywhere (deployment target, Q3/Q23).

**Verified (executed here: Python 3.13, PostgreSQL 16)**
- `python -m pytest`: **827 passed** = 511 earlier tests (unchanged) + 316 new Module 3 tests, including real-thread concurrency tests (5 runs in a row, stable).
- `makemigrations --check`: no changes. `spectacular --validate --fail-on-warn`: passes. `check`: no issues.
- Live HTTP self-test on `runserver` + PostgreSQL: 72 of 72 steps behaved as specified (company approval, staff roles, TC-14 publish, drafts, filters, custom fields and reorder, preview = public form, locked edits, duplicate, close/reopen, TC-16 expired job and the real command, Company B isolation). No 500s; no passwords or JWTs in the server log. Test data removed afterwards.
- Real bug found by the new tests and fixed: the second custom field got order 0 again (a falsy-zero error in the next-order calculation).

## Module 4 (built directly on `IntelliHire-backend`)

**Delivered**
- All 8 Doc §4.5 endpoint rows: public apply, job-scoped and company-wide application lists, detail, status change with history, protected CV and custom-file downloads, CSV export.
- Dynamic validation against each job's form (all errors at once), private storage under random names with cleanup on failure, retry-once-then-503, honeypot, throttle, request-size cap, confirmation email.
- Migration `applications.0001_initial`; decisions D-061 to D-070; Q17 resolved by default.
- Module 3's `applications_count` and custom-field locks now run on real data.

**Honest scope notes**
- Storage is the local private folder. The Doc's Azure Blob / SAS option is not built because the deployment target is undecided (Q3).
- Candidates are not emailed on status change (Doc: Module 10 does that).
- The company dashboard's jobs/applications blocks are still zeros; wiring them is the next step in the Doc build order.

**Verified (executed here: Python 3.13, PostgreSQL 16)**
- `python -m pytest`: **1010 passed** = 827 earlier tests (unchanged) + 183 new Module 4 tests, including real-thread concurrency tests (5 runs in a row, stable).
- `makemigrations --check`: no changes. `spectacular --validate --fail-on-warn`: passes. `check`: no issues. `check --deploy` (production settings): only the two deliberate HSTS notes.
- Live HTTP self-test on `runserver` + PostgreSQL with real multipart uploads: 51 of 51 steps behaved as specified (TC-16 to TC-22 flows, duplicates, honeypot, HR review, status history, downloads, CSV, locked fields, Company B isolation). No 500s; no passwords, JWTs or resume text in the log; files on disk have random names. Test data and files were removed afterwards.

## Phase 4: dashboard and integration (on `IntelliHire-backend`; approved)

**Delivered**
- Analysis and plan: `MODULE_DEPENDENCIES.md` (integration points, guards).
- The company dashboard now reads real jobs and applications (D-071).
- `integration_tests/` (149 tests): dashboard, cross-module rules, schema-driven sweeps over all 68 operations, quality gates, and one full end-to-end journey over HTTP.
- Gap closed: TC-12 had no named test.

**Verified (executed here: Python 3.13, PostgreSQL 16)**
- `python -m pytest`: **1159 passed** = 1010 earlier tests (unchanged) + 149 integration tests; the apps-only run (1010), the integration-only run (149) and a reversed module order all pass; the concurrency tests (12) ran 3 more times without a failure.
- Sweeps: all 68 operations classified; every protected operation answers 401 without a token; the wrong role gets 403 "Unauthorized access." everywhere; all 22 company-side operations that take an id answer 404 for another company and nothing changes; public endpoints ignore a garbage token.
- Live HTTP run on `runserver` + PostgreSQL: 60 of 60 steps passed (the Module 4 flow plus dashboard-equals-lists checks). No 500s; no passwords or JWTs in the log. Test data removed afterwards.
- Defects found by the integration work: none in Modules 1 to 4. (TC-12's missing named test was a test-coverage gap, now closed.)

**Honest scope notes**
- Still not built: Azure Blob storage and signed URLs, SMTP and scheduling in production (deployment target undecided, Q3/Q23), candidate emails on status change (Module 10), Tally/ERP (deferred).
- Phase 5 (connecting the React frontend) has not started; it changes `frontend/` and needs the owner's explicit go-ahead.

## Phase 2, Module 5: AI and notifications foundation (built directly on `IntelliHire-backend`)

Owner decisions: Q1 a (Celery, eager locally), Q2 a (schedules in settings), Q3 a (activity events wired into Phase 1), Q4 a (the Phase 2 guide is kept in `documentation/`).

- New app `Module5_Foundation` with seven tables (`foundation.0001_initial`), four notification endpoints, the durable email outbox, the append-only activity log, the AI wrapper (fake and OpenAI providers), prompt templates, AI settings, system alerts and six scheduled tasks. Details: `API_CONTRACTS.md` (Module 5), `DATABASE_SCHEMA.md`, D-081 to D-091, `apps/Module5_Foundation/README.md`.
- Phase 1 touched in small ways: emails carry a `kind` and credential emails are `sensitive`; one-line `log_event` calls in the services listed in D-084; `close_expired_jobs` now writes its events in bulk.

**Verified (executed here: Python 3.13, PostgreSQL 16, Redis)**
- `python -m pytest`: **1552 passed** = 1253 earlier tests (five assertions adapted to the outbox, one added) + 294 new Module 5 tests. `makemigrations --check` clean; `manage.py check` clean.
- Real broker run (Redis, a Celery worker and beat, throwaway database): emails queued in a transaction were sent by the worker; the sensitive body was wiped in the database; with Redis stopped a request finished in 0.1 s and the email stayed queued, and after Redis returned the sweep sent it; beat sent the heartbeat task. Servers stopped and the database dropped afterwards.
- Defects found by the new tests and fixed before the commit: a prompt placeholder such as `{a.b}` passed validation (attribute access) and is now refused; a phone number starting with a bracket kept the bracket; saving a fresh `AISettings` instance collided with the existing row.

**Honest scope notes**
- The OpenAI adapter is tested against stub clients that raise the SDK's real exception types; it has not called OpenAI (no key here). Run one real call before relying on it.
- Seed prompt templates are added by the modules that use them (Module 6 onwards); this module ships the mechanism only.
- The heartbeat is stored in the shared cache. Production uses the database cache, so web and worker see the same value; the local in-memory cache does not, which only matters for the worker-down alert.
- Activity events before this module are not backfilled. The frontend has no notification bell yet; that is frontend work for a later, separately approved step.

## Phase 2, Module 6: CV analysis and shortlisting (built directly on `IntelliHire-backend`)

Owner decisions: Q1 a (semantic part embeds parsed fields), Q2 a (no fuzzy skill matching yet), Q3 a (500 analyses per company per day), Q4 a (a degree in progress counts one level below).

- New app `Module6_CVAnalysis`: three tables, two seeded prompt templates, the scoring code, the durable analysis pipeline, threshold shortlisting, seven endpoints and a sweep task. Details: `API_CONTRACTS.md` (Module 6), `DATABASE_SCHEMA.md`, D-092 to D-103, the app README.
- Module 4 gained, additively: `source` on status history, the compare-and-set helper `set_status_if`, two signals, and `cv_score`/`cv_label` on the application list and detail.

**Verified (executed here: Python 3.13, PostgreSQL 16, Redis)**
- `python -m pytest`: **1752 passed** = 1552 earlier (seven assertions adapted to the new fields, counts and the automatic move) + 184 new Module 6 tests + 16 new sweep cases for the eight new operations. `makemigrations --check` clean; `spectacular --validate --fail-on-warn` clean.
- Guide test cases: UT-05 (66.7), UT-09 (threshold split), TC-23 (structured extraction), TC-24 (score is the weighted sum, 0 to 100), TC-25 (descending ranking that updates), TC-26 (threshold shortlists exactly those at or above; nobody rejected).
- Real broker run (Redis, a Celery worker, throwaway database), 12 of 12 steps: three applications over HTTP were analysed by the worker (two scored, one manual review), all moved to under_review, progress and ranking were correct, a dry run matched the real threshold run, history showed system then hr, and with Redis stopped a new application was still accepted in 0.1 s and analysed after the sweep once Redis returned. Cleaned up afterwards.

**Honest scope notes**
- All of this ran on the fake AI provider. The `cv_extract` and `cv_explain` prompts have never been answered by a real model here (no key): expect prompt tuning, and calibrate `CV_SEMANTIC_LOW/HIGH` on five or six real anonymised CVs before trusting the semantic part.
- `invite_on_shortlist` is stored but does nothing until Module 7.
- With eager tasks (local development) the analysis runs inside the request that submitted the application, so that request takes as long as the model does. Production uses the worker.
- The frontend does not show any of this yet, and its Module 4 e2e expects new applications to stay "Applied"; that needs adjusting in the separately approved frontend step.

## Next step

Phase 2 Modules 5 and 6 are built; Module 7 (interview engine) follows only on the owner's explicit go-ahead. Phase 4 and Module 4 are approved. Phase 5 (frontend), on the owner's explicit go-ahead: connect the frontend page by page in the Doc's order, using the field mappings and known differences listed in `API_CONTRACTS.md`. Before that, the deployment questions (Q3, Q23) should be answered.

**Approval check (before approving).** A fresh clone of `origin/IntelliHire-backend` at `f1adaaf` was installed into a new virtualenv: 1159 tests passed; every Doc §4 requirement and TC-16 to TC-22 were run by name and passed; the 68-operation sweeps, quality gates and the end-to-end journey passed; `makemigrations --check`, the OpenAPI validation and `check` were clean.
