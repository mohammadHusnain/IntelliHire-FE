# Development Progress

A step is "complete" only when implementation, executed tests, documentation and contracts are verified **and the owner has approved it**.

## Phase status

| Phase | Status |
|---|---|
| 1 — Project understanding | Complete |
| 2 — Backend foundation | **Complete.** Approved by the owner and merged into `IntelliHire-backend` (`a1c6cec`) |
| 3 — Module 1: Authentication and accounts | **Complete.** Approved by the owner and merged into `IntelliHire-backend` (`7fdb54b`); `main` untouched |
| 3 — Module 2: Company management | **Built and verified on `backend/module-02`; awaiting owner approval** (not merged) |
| 3 — Modules 3, 4 | Not started |
| Dashboard, Integration (Phase 4) | Not started |
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

## Module 2 (built on `backend/module-02`; not merged)

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

## Next step

Owner reviews and approves Module 2. After approval: merge `backend/module-02` into `IntelliHire-backend` (never `main`), then start Module 3 (jobs) on `backend/module-03`. The owner will check the live database after Module 3.
