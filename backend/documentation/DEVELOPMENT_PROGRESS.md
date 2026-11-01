# Development Progress

Last verified state is recorded per step. A step is "complete" only when implementation, tests (executed), documentation and contracts are verified and the owner has approved it.

## Phase status

| Phase | Status |
|---|---|
| 1 — Project understanding | Complete (analysis delivered; owner approved PostgreSQL and JSON-body refresh token) |
| 2 — Backend foundation | **Implemented and verified on `backend/foundation`; awaiting owner review before merge into `IntelliHire-backend`** |
| 3 — Modules 1 → 4 | Not started (Module 1 is next) |
| 4 — Integration | Not started |
| 5 — Frontend integration | Not started; requires explicit owner authorisation |

## Foundation (branch `backend/foundation`)

**Delivered**
- Django 5.2 project `config` (settings `base/local/production/test`), environment via `.env`, PostgreSQL connection, CORS, drf-spectacular Swagger, DRF defaults (JWT auth class, authenticated-by-default, pagination, filters, throttle scopes), SimpleJWT settings (15 min / 7 d, rotation + blacklist), logging.
- `apps/common`: CV and image validators (extension + size + magic bytes), `send_email_on_commit`, error handler with `code`, JSON 404/500 for `/api/`, pagination, private storage + random upload names, DB enum constraint helper.
- Initial migrations for the seven starting models (`accounts.0001`, `companies.0001`) with DB-level constraints; Django admin registrations; platform admin via `createsuperuser`.
- Test suite and shared fixtures; the nine project documents; `requirements/`, `.env.example`, dev-database script, README.

**Verified (executed in this environment: Python 3.13, PostgreSQL 16.15)**
- `python -m pytest`: **92 passed**.
- `manage.py makemigrations --check --dry-run`: no changes; migrations applied to an empty database.
- `manage.py check --deploy` with production settings: only the optional HSTS include-subdomains and preload warnings, which are deliberately off (see `ARCHITECTURE.md`); production refuses to start with empty `ALLOWED_HOSTS` or `EMAIL_HOST`.
- `manage.py spectacular --validate --fail-on-warn`: passes.
- `createsuperuser` produces a lowercase-email, `platform_admin`, `active`, email-verified user.
- `frontend/` is byte-identical to `IntelliHire-backend`.

**Not verified / known limits**
- Production storage (Azure Blob), SMTP delivery and the production cache table were not exercised; they need a deployment target (Q3).
- Tests were run on PostgreSQL only.

## Next step

Owner reviews the Foundation report. On approval: merge `backend/foundation` into `IntelliHire-backend`, then start Module 1 on `backend/module-01` (decisions needed first: Q4, Q8, Q9, Q10, Q13, Q14, Q18 — see `UNRESOLVED_QUESTIONS.md`).
