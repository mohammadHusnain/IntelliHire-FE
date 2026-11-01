# Architecture

## Layout

```
backend/
  manage.py                  default settings: config.settings.local
  pytest.ini  conftest.py    default settings: config.settings.test
  config/
    settings/{base,local,production,test}.py
    urls.py  wsgi.py  asgi.py            wsgi/asgi default to production
  apps/
    common/                  no tables: validators, mail, exceptions, pagination, storage, constraints, JSON 404/500
    accounts/                User, CandidateProfile, Education, Experience           (Module 1)
    companies/               Company, CompanyMember, StaffInvitation                 (Module 2)
    jobs/  applications/     created when Modules 3 and 4 start
  documentation/  requirements/  scripts/  .env.example
```

Each feature app uses the split from the Doc: `models.py`, `serializers.py` (validation and response shape), `views.py` (thin: permission → serializer/service → response), `services.py` (business rules and side effects), `permissions.py`, `urls.py`, `admin.py`, `tests/`. Files are added when they have content; no empty layers.

## Settings

- Configuration comes from environment variables read by django-environ (`backend/.env`, never committed). `SECRET_KEY`, `DATABASE_URL` and `FRONTEND_URL` are required; the process refuses to start without them.
- `production.py` raises at start-up if `ALLOWED_HOSTS` or `EMAIL_HOST` is empty, forces `DEBUG=False`, enables HTTPS redirect, secure cookies and HSTS, and uses a database-backed cache so throttle counters are shared across worker processes (run `python manage.py createcachetable` once per environment). `SECURE_PROXY_SSL_HEADER` is only trusted when `USE_X_FORWARDED_PROTO=True`.
- `test.py` uses the same PostgreSQL server (pytest-django creates `test_<db>`), fast password hashing, the in-memory email backend, an in-memory cache and temporary media directories.
- API docs (`/api/docs/`, `/api/schema/`) are served only when `API_DOCS_ENABLED=True` (default: on locally, off in production).

## Request and error conventions

- JSON under `/api/`; multipart only for uploads. Authenticated requests carry `Authorization: Bearer <access token>`.
- Default permission is authenticated; public views opt out explicitly. Default pagination is page-number, 20 per page (`page_size` up to 100); filter, search and ordering backends are on.
- Errors keep DRF's shapes: field errors `{"field": ["message"]}`; general errors `{"detail": "message", "code": "..."}`. `apps/common/exceptions.py` adds `code` to general errors and wraps a bare list-style validation error as `{"non_field_errors": [...]}`. Unknown `/api/` paths and unhandled errors return JSON (`not_found` / `server_error`) and never expose internals.

## Authentication and authorisation (implemented in Module 1)

- Email + password; four user roles; account `status` gates everything. A status-aware SimpleJWT authentication class rejects any token whose user is not `active` (code `account_inactive`), so suspension takes effect on the next request.
- Access token 15 min, refresh token 7 days, rotated on every refresh with the old one blacklisted. Both are returned in the JSON body (D-003). Custom access-token claims: `role`, `full_name`.
- Verification and password-reset tokens use Django's signing and token generator and need no tables.
- Role permission classes (`IsCandidate`, `IsCompanyUser`, `IsCompanyAdmin`, `CompanyRole(...)`, `IsPlatformAdmin`) decide who may call an endpoint; querysets decide which rows they see. Company-side querysets are always filtered to the caller's company so another company's ID returns 404.

## Data and files

- PostgreSQL with UUID primary keys on entities exposed in URLs, DB-level integrity constraints (see `DATABASE_SCHEMA.md`), transactions around multi-row operations, and `select_for_update` where the Doc requires row locking.
- Files: `STORAGES["default"]` serves public images (avatars, logos) under `MEDIA_ROOT`. `STORAGES["private"]` holds CVs outside any public path with no URL; production swaps this alias to a private Azure Blob container through configuration only. All uploads are stored under random names. Validators check extension, size **and** magic bytes.
- Email: `send_email_on_commit` queues the message with `transaction.on_commit`, so a rolled-back sign-up never emails. Only SMTP/OS delivery errors are caught and logged (without recipient addresses); programming errors still raise. Local development uses the console backend.

## Testing

pytest + pytest-django against PostgreSQL. Tests are written per module, named after the report's test case IDs where one exists, cover success and failure paths, and use the shared fixtures in `conftest.py`. Company-side endpoints each get the cross-company isolation test (Company B requesting Company A's object → 404). Run: `python -m pytest`.

## Deliberately not included

No Celery or Redis (D-007), no API versioning prefix (the Doc specifies unversioned `/api/`), no Tally/ERP code (D-001), no health-check or metrics endpoint until a deployment target requires one.
