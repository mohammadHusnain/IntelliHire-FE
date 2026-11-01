# API Contracts

Source of truth for contracts: Doc §1.7, §2.4, §3.4, §4.5. These tables are copied from the Doc and are **planned**; a row is marked **implemented** only after its module's tests pass. If an implemented endpoint deviates from the Doc, the deviation is recorded in `DECISIONS.md` and noted in the row.

## Conventions (all modules)

- Base path `/api/`; JSON, except file uploads (multipart). Auth: `Authorization: Bearer <access>`; public endpoints need no token.
- Success and error shapes, pagination and throttles: see `ARCHITECTURE.md`. Pagination envelope: DRF page-number (`count`, `next`, `previous`, `results`).
- Multiple-choice answers on the public apply endpoint: representation to be fixed and documented in Swagger when Module 4 is implemented (Doc §4.2).
- Swagger UI at `/api/docs/` when `API_DOCS_ENABLED=True`.

## Root URL map (Doc, "Root URL map")

| Prefix | App |
|---|---|
| `/api/auth/` | accounts |
| `/api/company/` | companies (company admin and HR side) |
| `/api/platform-admin/` | companies (platform-admin approval side) |
| `/api/jobs/` | jobs (HR side) |
| `/api/jobs/<job_id>/applications/`, `/api/applications/` | applications (HR side) |
| `/api/public/` | jobs + applications (public form, no login) |
| `/api/docs/`, `/admin/` | Swagger UI, Django admin |

## Module 1 — Authentication and account management (`accounts`)

Source: Doc §1.7. All rows are **planned** until the module's completion report marks them implemented.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| POST | /api/auth/register/candidate/ | Public | full_name, email, password, confirm_password | 201 email, status | 400 field errors (duplicate email, weak password, mismatch) | planned |
| POST | /api/auth/register/company/ | Public | company_name, industry, official_email, admin_full_name, admin_phone, password, confirm_password | 201 email, status | 400 field errors | planned |
| POST | /api/auth/verify-email/ | Public | token | 200 detail, status | 400 expired or invalid | planned |
| POST | /api/auth/resend-verification/ | Public | email | 200 always | 429 throttled | planned |
| POST | /api/auth/login/ | Public | email, password | 200 access, refresh, user | 401 invalid credentials; 403 with code; 429 | planned |
| POST | /api/auth/token/refresh/ | Public | refresh | 200 access, refresh | 401 invalid or blacklisted | planned |
| POST | /api/auth/logout/ | Logged in | refresh | 205 | 400 invalid token | planned |
| POST | /api/auth/password/forgot/ | Public | email | 200 always | 429 | planned |
| POST | /api/auth/password/reset/ | Public | uid, token, new_password, confirm_password | 200 | 400 invalid link or weak password | planned |
| POST | /api/auth/password/change/ | Logged in | old_password, new_password | 200 | 400 wrong old password | planned |
| GET, PATCH | /api/auth/me/ | Logged in | full_name (PATCH) | 200 user | 401 | planned |
| GET, PATCH | /api/auth/profile/ | Candidate | profile fields; multipart if avatar included | 200 profile | 400, 403 | planned |
| PUT | /api/auth/profile/resume/ | Candidate | multipart file resume | 200 resume URL | 400 wrong type or too big | planned |
| GET, POST | /api/auth/profile/education/ | Candidate | education fields | 200 list / 201 row | 400 | planned |
| PATCH, DELETE | /api/auth/profile/education/<id>/ | Candidate | changed fields | 200 / 204 | 404 if not yours | planned |
| GET, POST | /api/auth/profile/experience/ | Candidate | experience fields | 200 / 201 | 400 | planned |
| PATCH, DELETE | /api/auth/profile/experience/<id>/ | Candidate | changed fields | 200 / 204 | 404 | planned |

## Module 2 — Company management and platform-admin approval (`companies`)

Source: Doc §2.4. All rows are **planned** until the module's completion report marks them implemented.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET, PATCH | /api/company/profile/ | Company user (PATCH: company admin) | profile fields; multipart for logo | 200 profile + profile_completion | 400, 403 | planned |
| GET | /api/company/dashboard/ | Company user | none | 200 metrics object | 403 | planned |
| GET | /api/company/members/ | Company user | none | 200 list | 403 | planned |
| PATCH | /api/company/members/<id>/ | Company admin | role, job_title, is_active | 200 member | 400 last admin or self; 404 other company | planned |
| GET, POST | /api/company/invitations/ | Company admin | email, full_name, role, job_title | 200 list / 201 invitation | 400 already registered or already invited | planned |
| POST | /api/company/invitations/<id>/resend/ | Company admin | none | 200 | 409 wrong status | planned |
| POST | /api/company/invitations/<id>/revoke/ | Company admin | none | 200 | 409 wrong status | planned |
| GET | /api/public/invitations/<token>/ | Public | none | 200 company, role, email, full_name | 400 invalid, expired, revoked, used | planned |
| POST | /api/public/invitations/<token>/accept/ | Public | full_name, password, confirm_password | 201 | 400 | planned |
| POST | /api/auth/register/company/resubmit/ | Public | official_email, password, corrected company fields | 200 status pending | 400 wrong credentials or not rejected | planned |
| GET | /api/platform-admin/companies/ | Platform admin | ?status, ?search | 200 paginated list | 403 | planned |
| GET | /api/platform-admin/companies/<id>/ | Platform admin | none | 200 detail | 404 | planned |
| POST | /api/platform-admin/companies/<id>/approve/ | Platform admin | none | 200 | 409 already reviewed | planned |
| POST | /api/platform-admin/companies/<id>/reject/ | Platform admin | reason | 200 | 400 no reason; 409 | planned |
| POST | /api/platform-admin/companies/<id>/suspend/ and /reactivate/ | Platform admin | reason (suspend) | 200 | 409 | planned |

## Module 3 — Job posting and application form (`jobs`)

Source: Doc §3.4. All rows are **planned** until the module's completion report marks them implemented.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET | /api/jobs/ | Company user | ?status, ?department, ?employment_type, ?search, ?ordering | 200 paginated list | 403 | planned |
| POST | /api/jobs/ | Admin, HR manager, recruiter | job fields, optional publish flag | 201 job | 400 field errors | planned |
| GET | /api/jobs/<id>/ | Company user | none | 200 job with custom fields | 404 other company | planned |
| PATCH | /api/jobs/<id>/ | Admin, HR manager, recruiter | changed fields | 200 job | 400; 409 closed or locked field | planned |
| DELETE | /api/jobs/<id>/ | Admin, HR manager | none | 204 | 409 not a draft | planned |
| POST | /api/jobs/<id>/publish/ | Admin, HR manager, recruiter | none | 200 job with share_url | 400 incomplete; 409 not a draft | planned |
| POST | /api/jobs/<id>/close/ | Admin, HR manager, recruiter | none | 200 job | 409 not open | planned |
| POST | /api/jobs/<id>/reopen/ | Admin, HR manager | deadline | 200 job | 400 past deadline; 409 not closed | planned |
| POST | /api/jobs/<id>/duplicate/ | Admin, HR manager, recruiter | none | 201 new draft |  | planned |
| GET | /api/jobs/<id>/form-preview/ | Company user | none | 200 form schema |  | planned |
| GET, POST | /api/jobs/<id>/fields/ | Admin, HR manager, recruiter (GET: any member) | label, field_type, required, options, help_text | 200 list / 201 field | 400 bad options | planned |
| PATCH, DELETE | /api/jobs/<id>/fields/<field_id>/ | Admin, HR manager, recruiter | changed fields | 200 / 204 | 409 locked after applications | planned |
| POST | /api/jobs/<id>/fields/reorder/ | Admin, HR manager, recruiter | ordered list of field IDs | 200 list | 400 IDs do not match | planned |
| GET | /api/public/jobs/<form_slug>/ | Public | none | 200 form schema + accepting flag | 404 unknown slug | planned |

## Module 4 — Candidate application management (`applications`)

Source: Doc §4.5. All rows are **planned** until the module's completion report marks them implemented.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| POST | /api/public/jobs/<form_slug>/apply/ | Public | multipart: built-in fields, resume, custom answers and files | 201 reference, job title, company, submitted_at | 400 field errors; 404; 410 closed; 429; 503 | planned |
| GET | /api/jobs/<job_id>/applications/ | Company user | ?status, ?search, ?submitted_after, ?submitted_before, ?education_level, ?ordering | 200 paginated list + status counts | 404 other company | planned |
| GET | /api/applications/ | Company user | ?job, plus the filters above | 200 paginated list |  | planned |
| GET | /api/applications/<id>/ | Company user | none | 200 full detail | 404 | planned |
| PATCH | /api/applications/<id>/status/ | Admin, HR manager, recruiter | status, note | 200 application | 400 invalid status; 403 viewer | planned |
| GET | /api/applications/<id>/resume/ | Company user | none | file download or signed URL | 404 | planned |
| GET | /api/applications/<id>/files/<field_key>/ | Company user | none | file download | 404 | planned |
| GET | /api/jobs/<job_id>/applications/export/ | Company user | none | CSV file |  | planned |

## Known frontend differences to resolve before Phase 5

Not backend defects; recorded so integration does not guess. Details and IDs in `UNRESOLVED_QUESTIONS.md`.

| Area | Frontend today | Backend contract |
|---|---|---|
| Roles | `candidate`, `company`, `admin` | `candidate`, `company_admin`, `hr`, `platform_admin` (Q11) |
| Statuses | `active`, `pending`, `rejected`, `suspended` | adds `pending_verification`, `pending_approval` (Q12) |
| Login result | `{user, token}`, one token | `{access, refresh, user}`, 403 with status `code` |
| Error handling | `api/client.js` keeps only `err.message` | field errors as `{field: [..]}` must reach the inputs |
| Candidate sign-up | collects desired role, skills, links, CV | name, email, password, confirm only; rest is profile data (Q13) |
| Company sign-up | no official email, admin phone or confirm password | all required (Q15) |
| Job form | no deadline, education level, custom fields; level enum instead of years | see Doc §3.1 (Q16) |
| Application stages | Applied, Screened, Shortlisted, Interviewed, Offer, Rejected | seven statuses incl. `on_hold` (Q17) |
| Missing pages | — | `/verify-email`, `/reset-password`, `/accept-invite`, `/apply/<slug>` |
| CV types | `.pdf`, `.doc`, `.docx` | `.pdf`, `.docx` only (Q18) |
