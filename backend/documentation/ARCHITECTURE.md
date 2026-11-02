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
    common/                  no tables: choices (shared enums), permissions, validators, mail, errors, exceptions,
                             pagination, parsers, storage, constraints, JSON 404/500, test helpers
    Module1_Authentication/  (label accounts) User, CandidateProfile, Education, Experience; auth, tokens, profile, CV
    Module2_CompanyManagement/ (label companies) Company, CompanyMember, StaffInvitation; company sign-up,
                             platform-admin review, profile, members, invitations, dashboard
                             (services/, serializers/, views/ packages; urls.py, public_urls.py, platform_urls.py, auth_urls.py)
    Module3_…/ Module4_…     created when Modules 3 and 4 start (same layout: models, services, serializers, views, urls, tests, README)
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

## Authentication and authorisation (Module 1, implemented)

- Email + password; four user roles; the account `status` gates everything. `StatusAwareJWTAuthentication` loads the user (with company and membership in one query) on every request and rejects anyone who is not `active` with `account_inactive`, so suspension applies immediately. It is the default authentication class; public views set `authentication_classes = []` so a stale token cannot break them.
- Login checks credentials itself (not Django's `authenticate()`), then the status, returning 401 for bad credentials and 403 with the status as `code` otherwise. Refresh is explicit: reload the user, require `active`, blacklist the old token under a row lock, issue a new pair with `role` and `full_name` read from the database.
- Access token 15 min, refresh 7 days, both in the JSON body (D-003). Password change/reset and suspension blacklist every outstanding refresh token of the user.
- Verification links use Django's signing (24 h, own salt); reset links use Django's token generator plus an encoded user id (1 h, die when the password changes). Neither needs a table.
- Permission classes in `common/permissions.py` (`IsCandidate`, `IsPlatformAdmin`, `IsCompanyUser`, `IsCompanyAdmin`, `CompanyRole(...)`) answer 403 "Unauthorized access."; querysets decide which rows a user sees. They read the role and membership from the database, never from the token or the request.
- Throttling uses DRF scoped rates keyed by client IP. `NUM_PROXIES` (default 0) controls how the IP is read, because trusting `X-Forwarded-For` would let clients evade limits.
- Operations: schedule `python manage.py flushexpiredtokens` to purge expired rows from the token tables.

## Data and files

- PostgreSQL with UUID primary keys on entities exposed in URLs, DB-level integrity constraints (see `DATABASE_SCHEMA.md`), transactions around multi-row operations, and `select_for_update` where the Doc requires row locking.
- Files: `STORAGES["default"]` serves public images (avatars, logos) under `MEDIA_ROOT`. `STORAGES["private"]` holds CVs outside any public path with no URL; production swaps this alias to a private Azure Blob container through configuration only. All uploads are stored under random names. Validators check extension, size **and** magic bytes. `LimitedMultiPartParser` (the default multipart parser) refuses bodies over 12 MB from `Content-Length` before anything is written.
- Email: `send_email_on_commit` queues the message with `transaction.on_commit`, so a rolled-back sign-up never emails. Only SMTP/OS delivery errors are caught and logged (without recipient addresses); programming errors still raise. Local development uses the console backend.

## Testing

pytest + pytest-django against PostgreSQL. Tests are written per module, named after the report's test case IDs where one exists, cover success and failure paths, and use the shared fixtures in `conftest.py`. Company-side endpoints each get the cross-company isolation test (Company B requesting Company A's object → 404). Run: `python -m pytest`.

## Deliberately not included

No Celery or Redis (D-007), no API versioning prefix (the Doc specifies unversioned `/api/`), no Tally/ERP code (D-001), no health-check or metrics endpoint until a deployment target requires one.
