# Development Progress

A step is "complete" only when implementation, executed tests, documentation and contracts are verified **and the owner has approved it**.

## Phase status

| Phase | Status |
|---|---|
| 1 — Project understanding | Complete |
| 2 — Backend foundation | **Complete.** Approved by the owner and merged into `IntelliHire-backend` (`a1c6cec`) |
| 3 — Module 1: Authentication and accounts | **Implemented and verified on `backend/module-01`; awaiting owner approval** |
| 3 — Modules 2, 3, 4 | Not started |
| Dashboard, Integration (Phase 4) | Not started |
| Phase 5 — Frontend integration | Not started; requires explicit owner authorisation |

## Module 1 (branch `backend/module-01`, cut from `IntelliHire-backend`)

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

## Next step

Owner reviews the Module 1 completion report. On approval: merge `backend/module-01` into `IntelliHire-backend`, then start Module 2 on `backend/module-02`. Decisions needed first: Q7, Q15, Q19, Q21 (see `UNRESOLVED_QUESTIONS.md`).
