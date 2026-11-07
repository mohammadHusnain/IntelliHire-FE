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
| `/api/auth/` | `Module1_Authentication` (label `accounts`); company sign-up routes from `Module2_CompanyManagement` |
| `/api/company/` | `Module2_CompanyManagement` (label `companies`): company admin and HR side |
| `/api/platform-admin/` | `users/` from Module 1; `companies/` from Module 2 |
| `/api/jobs/` | `Module3_JobPosting` (label `jobs`): HR side |
| `/api/jobs/<job_id>/applications/`, `/api/applications/` | `Module4_ApplicationManagement` (label `applications`): HR side |
| `/api/public/` | `invitations/` (Module 2); `jobs/<slug>/` (Module 3); `jobs/<slug>/apply/` (Module 4) |
| `/api/docs/`, `/admin/` | Swagger UI, Django admin |

## Module 1 — Authentication and account management (`Module1_Authentication`)

Source: Doc §1.7. Implemented and tested on `backend/module-01`; deviations and additions are listed below the table.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| POST | /api/auth/register/candidate/ | Public | full_name, email, password, confirm_password | 201 email, status | 400 field errors (duplicate email, weak password, mismatch) | implemented |
| POST | /api/auth/register/company/ | Public | company_name, industry, official_email, admin_full_name, admin_phone, password, confirm_password | 201 email, status | 400 field errors | implemented |
| POST | /api/auth/verify-email/ | Public | token | 200 detail, status | 400 expired or invalid | implemented |
| POST | /api/auth/resend-verification/ | Public | email | 200 always | 429 throttled | implemented |
| POST | /api/auth/login/ | Public | email, password | 200 access, refresh, user | 401 invalid credentials; 403 with code; 429 | implemented |
| POST | /api/auth/token/refresh/ | Public | refresh | 200 access, refresh | 401 invalid or blacklisted | implemented |
| POST | /api/auth/logout/ | Logged in | refresh | 205 | 400 invalid token | implemented |
| POST | /api/auth/password/forgot/ | Public | email | 200 always | 429 | implemented |
| POST | /api/auth/password/reset/ | Public | uid, token, new_password, confirm_password | 200 | 400 invalid link or weak password | implemented |
| POST | /api/auth/password/change/ | Logged in | old_password, new_password | 200 | 400 wrong old password | implemented |
| GET, PATCH | /api/auth/me/ | Logged in | full_name (PATCH) | 200 user | 401 | implemented |
| GET, PATCH | /api/auth/profile/ | Candidate | profile fields; multipart if avatar included | 200 profile | 400, 403 | implemented |
| PUT | /api/auth/profile/resume/ | Candidate | multipart file resume | 200 resume URL | 400 wrong type or too big | implemented |
| GET, POST | /api/auth/profile/education/ | Candidate | education fields | 200 list / 201 row | 400 | implemented |
| PATCH, DELETE | /api/auth/profile/education/<id>/ | Candidate | changed fields | 200 / 204 | 404 if not yours | implemented |
| GET, POST | /api/auth/profile/experience/ | Candidate | experience fields | 200 / 201 | 400 | implemented |
| PATCH, DELETE | /api/auth/profile/experience/<id>/ | Candidate | changed fields | 200 / 204 | 404 | implemented |

### Module 1 — implemented behaviour

**Approved additions (owner, Q8/Q9)**

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET | /api/auth/profile/resume/ | Candidate | none | 200 the CV as an attachment (original file name, `Cache-Control: private, no-store`) | 404 no resume | implemented |
| POST | /api/platform-admin/users/<user_id>/suspend/ | Platform admin | none | 200 user object | 400 self or another platform admin; 404; 409 already suspended | implemented |
| POST | /api/platform-admin/users/<user_id>/reactivate/ | Platform admin | none | 200 user object | 404; 409 not suspended | implemented |

**Deviations from the Doc (all recorded in `DECISIONS.md`)**
- `PUT /api/auth/profile/resume/` returns `{"resume": "/api/auth/profile/resume/"}`, a relative path to the authenticated download (D-023). The same path appears as `resume` in the profile.
- The profile also carries `bio`, `target_role`, `experience_level` (`entry`/`mid`/`senior`), `portfolio_url` and read-only `resume_name` (D-025). Name and email are not in the profile; use `GET /api/auth/me/`.
- Sign-up endpoints reject extra fields silently (no mass assignment); the company sign-up route is served by the `companies` app (D-027).
- Multipart requests above 12 MB are refused with 413 `request_too_large` before anything is stored (D-035). Education and experience are capped at 50 rows each (400 `limit_reached`).

**Response shapes**
- Sign-up: `201 {"email", "status"}`. Verify: `200 {"detail", "status"}`. Login: `200 {"access", "refresh", "user"}`. Refresh: `200 {"access", "refresh"}`. Logout: `205` no body.
- `user`: `{"id", "email", "full_name", "role", "status", "company"}`; `company` is `null` for candidates and platform admins, otherwise `{"id", "name", "member_role", "status"}`.
- Access-token claims: `user_id`, `role`, `full_name`, `token_type`, `exp`, `iat`, `jti`. Authorisation always uses the database, never the claims.
- Multipart profile requests send `skills` as repeated keys; JSON sends a list. `avatar: null` (JSON) removes the avatar.

**Error codes (general errors are `{"detail", "code"}`; field errors are `{"field": ["message"]}`)**

| Status | `code` | Meaning |
|---|---|---|
| 401 | `invalid_credentials` | Wrong email or password ("Invalid email or password.") |
| 401 | `not_authenticated`, `authentication_failed`, `token_not_valid` | Missing/invalid access or refresh token |
| 401 | `account_inactive`, `user_not_found` | Token valid but the account is not active / no longer exists |
| 403 | `pending_verification`, `pending_approval`, `rejected`, `suspended` | Login refused for that account status (messages in `REQUIREMENTS.md`) |
| 403 | `permission_denied` | "Unauthorized access." |
| 400 | `expired`, `invalid_token` | Verification or reset link problems; logout with a bad refresh token |
| 400 | `cannot_suspend_self`, `cannot_suspend_admin`, `limit_reached` | Rule violations |
| 404 / 409 | `not_found` / `already_suspended`, `not_suspended` | |
| 413 | `request_too_large` | Multipart body over 12 MB |
| 429 | `throttled` | Rate limit |

**Throttle scopes**: login 5/min (also used per user by change-password); registration 10/hour (candidate and company share it); resend-verification 3/hour; forgot-password 3/hour; reset-password 10/hour. Limits are per client IP (`NUM_PROXIES` controls how the IP is read).

**Frontend field mapping for the candidate profile (for Phase 5)**

| Frontend (`candidateStore`) | API |
|---|---|
| `fullName`, `email` | `GET /api/auth/me/` (`full_name`, `email`) |
| `headline`, `location`, `bio`, `skills` | same names |
| `targetRole`, `experience` | `target_role`, `experience_level` |
| `links.linkedin`, `links.github`, `links.portfolio` | `linkedin_url`, `github_url`, `portfolio_url` |
| `cv` `{name, size, uploadedAt}` | `resume` (download path), `resume_name`; size and upload time are not exposed |
| `photo` (data URL) | `avatar` (URL; upload as multipart) |
| Interview/notification/privacy preferences | not in Phase 1 (stay client-side) |


## Module 2 — Company management and platform-admin approval (`Module2_CompanyManagement`)

Source: Doc §2.4. Implemented and tested on `backend/module-02`; behaviour notes and deviations follow the table.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET, PATCH | /api/company/profile/ | Company user (PATCH: company admin) | name, industry, contact_phone, website, description, headquarters, company_size, logo (multipart) | 200 profile + profile_completion | 400, 403 | implemented |
| GET | /api/company/dashboard/ | Company user | none | 200 metrics object | 403 | implemented (jobs/applicants/pipeline are zeros until Modules 3–4) |
| GET | /api/company/members/ | Company user | none | 200 list | 403 | implemented |
| PATCH | /api/company/members/<id>/ | Company admin | role, job_title, is_active | 200 member | 400 `cannot_modify_self`, `last_admin`; 404 other company | implemented |
| GET, POST | /api/company/invitations/ | Company admin | email, full_name, role, job_title; `?status=` | 200 list / 201 invitation | 400 already registered or already invited | implemented |
| POST | /api/company/invitations/<id>/resend/ | Company admin | none | 200 | 404; 409 `invalid_state`, `newer_invitation_pending` | implemented |
| POST | /api/company/invitations/<id>/revoke/ | Company admin | none | 200 | 404; 409 `invalid_state` | implemented |
| GET | /api/public/invitations/<token>/ | Public | none | 200 company, role, email, full_name | 400 `invalid_invitation`, `expired`, `revoked`, `already_used`, `company_unavailable` | implemented |
| POST | /api/public/invitations/<token>/accept/ | Public | full_name, password, confirm_password | 201 email, status | 400 (same codes, `email_taken`, password rules); 429 | implemented |
| POST | /api/auth/register/company/resubmit/ | Public | official_email, password, company_name, industry, admin_full_name, admin_phone | 200 detail, status `pending` | 400 `invalid_credentials`, `not_rejected`, name taken; 429 | implemented |
| GET | /api/platform-admin/companies/ | Platform admin | `?status` (default `pending`; `all`), `?search`, `?page`, `?page_size` | 200 paginated list | 400 bad status; 403 | implemented |
| GET | /api/platform-admin/companies/<id>/ | Platform admin | none | 200 detail | 404 | implemented |
| POST | /api/platform-admin/companies/<id>/approve/ | Platform admin | none | 200 detail | 404; 409 `already_reviewed` | implemented |
| POST | /api/platform-admin/companies/<id>/reject/ | Platform admin | reason (≥ 10 chars) | 200 detail | 400 reason; 409 `already_reviewed` | implemented |
| POST | /api/platform-admin/companies/<id>/suspend/ | Platform admin | reason (≥ 10 chars) | 200 detail | 400 reason; 409 `invalid_state` (only approved) | implemented |
| POST | /api/platform-admin/companies/<id>/reactivate/ | Platform admin | none | 200 detail | 409 `invalid_state` (only suspended) | implemented |

### Module 2 — implemented behaviour

- **Access gate.** `IsCompanyUser` = active member of an **approved** company; a pending, rejected or suspended company gets 403 "Unauthorized access." on every `/api/company/` endpoint. A suspended company's users can still log in (login only checks the user's status).
- **Isolation.** Every company-side lookup is scoped to the caller's company; another company's member or invitation id returns 404, identical to a missing id.
- **Review list** is paginated (`count`, `next`, `previous`, `results`); rows carry `id, name, industry, official_email, contact_phone, status, created_at, admin{id, full_name, email, email_verified, status, date_joined}`. Detail adds slug, website, description, headquarters, logo, company_size, `rejection_reason`, `suspension_reason`, `reviewed_by` (email), `reviewed_at`.
- **Member** object: `id` (integer membership id), `full_name`, `email`, `role`, `job_title`, `joined_at`, `is_active`, `last_login`. The lists for members and invitations are unpaginated (a company team is small).
- **Invitation** object: `id, email, full_name, role, job_title, status, created_at, expires_at, accepted_at`. The token is never returned by the API; it exists only in the email link `FRONTEND_URL/accept-invite?token=…`. A pending invitation past its expiry is reported and stored as `expired`.
- **Accept** returns `{"email","status"}` and no tokens: the new user logs in normally (D-040).
- **Resubmit** link in the rejection email: `FRONTEND_URL/resubmit-company` (frontend page to be built in Phase 5).
- **Dashboard** shape: `company{name, logo, status, profile_completion}`, `jobs{open, draft, closed}`, `applicants{total, new_last_7_days}`, `pipeline{submitted, under_review, shortlisted, interview, selected, rejected, on_hold}`, `closing_soon[]`, `recent_applications[]`, `team{active_members, pending_invitations}`. `company` and `team` are live; the rest are zeros/empty until Modules 3–4.
- **Profile completion** = share of the five optional fields (website, description, headquarters, logo, company_size) that are filled, in steps of 20.
- **Throttles:** accept-invitation uses the `register` scope (10/hour); resubmit uses `login` (5/min). Invitation details are unthrottled but reveal nothing for an unknown token beyond `invalid_invitation`.

**Deviations from the Doc (recorded in `DECISIONS.md`):** `suspension_reason` column and 10-character reason minimum for suspend (D-039); acceptance requires an approved company and returns no tokens (D-040); the resubmission email path (D-041); review-list pagination (D-042).

## Module 3 — Job posting and application form (`Module3_JobPosting`)

Source: Doc §3.4. Implemented and tested on `backend/module-03`; behaviour notes and deviations follow the table.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET | /api/jobs/ | Company user | ?status, ?department, ?employment_type, ?search, ?ordering, ?page, ?page_size | 200 paginated list | 400 bad filter; 403 | implemented |
| POST | /api/jobs/ | Admin, HR manager, recruiter | job fields, optional `publish` flag | 201 job | 400 field errors; 403 | implemented |
| GET | /api/jobs/<id>/ | Company user | none | 200 job with custom fields | 404 other company | implemented |
| PATCH | /api/jobs/<id>/ | Admin, HR manager, recruiter | changed fields | 200 job | 400; 409 `job_closed`, `deadline_passed`, `field_locked` | implemented |
| DELETE | /api/jobs/<id>/ | Admin, HR manager | none | 204 | 409 `invalid_state` (not a draft) | implemented |
| POST | /api/jobs/<id>/publish/ | Admin, HR manager, recruiter | none | 200 job with share_url | 400 incomplete; 409 not a draft; 503 `slug_unavailable` | implemented |
| POST | /api/jobs/<id>/close/ | Admin, HR manager, recruiter | none | 200 job | 409 not open | implemented |
| POST | /api/jobs/<id>/reopen/ | Admin, HR manager | deadline | 200 job | 400 past/too-far deadline; 409 not closed | implemented |
| POST | /api/jobs/<id>/duplicate/ | Admin, HR manager, recruiter | none | 201 new draft | 404 | implemented |
| GET | /api/jobs/<id>/form-preview/ | Company user | none | 200 form schema | 404 | implemented |
| GET, POST | /api/jobs/<id>/fields/ | Admin, HR manager, recruiter (GET: any member) | label, field_type, required, options, help_text, max_length | 200 list / 201 field | 400 bad options; 409 `field_locked`, `job_closed`, `deadline_passed` | implemented |
| PATCH, DELETE | /api/jobs/<id>/fields/<field_id>/ | Admin, HR manager, recruiter | changed fields | 200 / 204 | 404; 409 `field_locked` after applications | implemented |
| POST | /api/jobs/<id>/fields/reorder/ | Admin, HR manager, recruiter | `{"field_ids": [...]}` (a bare list also works) | 200 list | 400 IDs do not match | implemented |
| GET | /api/public/jobs/<form_slug>/ | Public | none | 200 form schema + accepting flag | 404 unknown slug or draft | implemented |

### Module 3 — implemented behaviour

- **Access.** All `/api/jobs/` endpoints need an active member of an **approved** company. Viewers only read. Every lookup is scoped to the caller's company, so another company's job or field is 404.
- **Job object.** List items: `id, title, department, employment_type, work_mode, location, status, deadline, days_left, applications_count, share_url, created_at, published_at`. Detail adds `description, responsibilities, required_skills, soft_skills, min_experience_years, education_level, salary_min, salary_max, salary_currency, show_salary, openings, form_slug, close_reason, closed_at, updated_at, created_by{id, full_name}, custom_fields[]`.
- **Server-owned fields.** `company`, `status`, `form_slug`, `close_reason`, `published_at`, `created_by` in a request body are ignored.
- **Create.** A draft needs only `title` and `department`. With `"publish": true` the job is validated and opened in the same transaction; if validation fails nothing is saved (400).
- **Publish validation** (400, errors keyed by field): title, department, description, at least one required skill, employment type, location unless `work_mode` is `remote`, valid custom fields, and a deadline between 1 hour and about 6 months ahead. `work_mode` itself is not required (Doc list).
- **Edit.** Draft: everything. Open and before the deadline: only title, description, responsibilities, required/soft skills, salary fields, location and deadline (a future time, at most about 6 months ahead). Any other changed field returns 409 `field_locked`; sending an unchanged value is fine. The job must stay publishable. Open past its deadline: 409 `deadline_passed`. Closed: 409 `job_closed`.
- **Reopen** needs a future deadline (at most about 6 months ahead), keeps the same slug and clears the close reason and time.
- **Custom field keys** are generated from the label once (`LinkedIn Profile URL` → `linkedin_profile_url`; suffix `_2`, `_3` on a clash with another field or a built-in key) and never change. At most 30 custom fields per job (400 `limit_reached`). `order` starts at 0.
- **After the first application** (Module 4): fields cannot be deleted, change type, become required, lose or rename options, and no new required field can be added (409 `field_locked`). Labels, help text, order and added options stay editable.
- **Form schema** (preview and public): `{accepting, message, job{title, company{name, logo}, department, location, work_mode, employment_type, description, responsibilities, required_skills, soft_skills, deadline, salary|null}, fields[]}`. Each field: `key, label, type, required, options, option_labels, help_text, max_length, built_in`. The seven built-in fields come first (`full_name, email, phone, education_level, institution, graduation_year, resume`), then the custom fields in order. `salary` appears only when `show_salary` is true. `accepting` is false for drafts (preview only), closed jobs, jobs past their deadline and companies that are not approved; `message` then says why.
- **days_left** is the number of days to the deadline, rounded up; `null` for closed jobs and jobs without a deadline.
- **applications_count** is 0 until Module 4 exists; the annotation and the lock rule read the `applications` table through one helper (`services/applications_link.py`).
- **`close_expired_jobs`**: `python manage.py close_expired_jobs` closes open jobs past their deadline (reason `deadline`) in one bulk update. Schedule it every 5 minutes (see `Module3_JobPosting/README.md`).

**Deviations and clarifications (in `DECISIONS.md`):** D-048 to D-060.

## Module 4 — Candidate application management (`Module4_ApplicationManagement`)

Source: Doc §4.5. Implemented and tested on `IntelliHire-backend`; behaviour notes follow the table.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| POST | /api/public/jobs/<form_slug>/apply/ | Public | multipart: built-in fields, `resume`, custom answers and files | 201 reference, job_title, company, submitted_at | 400 field errors; 404; 410 closed; 413; 415; 429; 503 | implemented |
| GET | /api/jobs/<job_id>/applications/ | Company user | ?status, ?search, ?submitted_after, ?submitted_before, ?education_level, ?ordering | 200 paginated list + `status_counts` | 400 bad filter; 404 other company | implemented |
| GET | /api/applications/ | Company user | ?job, plus the filters above | 200 paginated list with job | 400 | implemented |
| GET | /api/applications/<id>/ | Company user | none | 200 full detail | 404 | implemented |
| PATCH | /api/applications/<id>/status/ | Admin, HR manager, recruiter | status, note | 200 application detail | 400 invalid or unchanged status; 403 viewer; 404 | implemented |
| GET | /api/applications/<id>/resume/ | Company user | none | file download (attachment) | 404 | implemented |
| GET | /api/applications/<id>/files/<field_key>/ | Company user | none | file download (attachment) | 404 | implemented |
| GET | /api/jobs/<job_id>/applications/export/ | Company user | none | CSV file | 404 | implemented |

### Module 4 — implemented behaviour

- **Submit format.** `multipart/form-data` only (JSON gets 415). Text answers are form fields named by the field `key`; files are file parts (`resume` for the CV, custom file fields under their key). **Multiple-choice answers are repeated keys.** Unknown keys are ignored. Request bodies above 12 MB get 413 before anything is stored.
- **Order of checks.** Unknown slug or draft: 404 → honeypot → job row locked and `is_accepting_applications` checked (410 "This position is no longer accepting applications.") → every built-in and custom field validated → duplicate email → save.
- **Errors.** One 400 with every problem keyed by field key: `{"email": ["Email is required."], "resume": ["Only PDF and DOCX files are accepted."], ...}`. Built-in messages: `<Label> is required.`, `Enter a valid email address.`, `Enter a valid phone number.`, graduation year between 1970 and the current year + 6, CV "Only PDF and DOCX files are accepted." / "File must be 5 MB or smaller.". Duplicate: "You have already applied for this position with this email.".
- **Custom field rules.** Required → "<Label> is required."; short text ≤ 255 (or the field's `max_length`), long text ≤ 5000; number must parse (stored as a number); email and URL (http/https) valid; date `YYYY-MM-DD`; single choice must be an option; multiple choice must be a subset; files follow the CV rules (PDF/DOCX, 5 MB).
- **Honeypot.** The hidden form field `hp-website` must stay empty. If filled, the response looks like a success (201, a fake reference) but nothing is saved and no email is sent.
- **Throttle.** 10 submissions per hour per IP (`public_apply`).
- **Storage.** Files live in the private storage under `applications/<job_id>/<random>.<ext>`, never under their own name and never at a public URL. HR downloads through the two protected endpoints (attachment with the original name, `Cache-Control: private, no-store`). If anything fails, files already written are deleted.
- **Failures.** A temporary database error is retried once; a second failure returns 503 "We could not save your application. Please try again." with no partial record and no orphan file. A failing mail server never fails the application.
- **Candidate link.** If a valid candidate token is sent, `candidate_user` is set; a company or invalid token is ignored. The endpoint never requires a login.
- **Confirmation email** (after commit): applicant gets job title, company, submission time (UTC) and the reference `IH-XXXXXX`.
- **List rows:** `id, reference, full_name, email, phone, education_level, institution, status, submitted_at, has_cv` (company-wide list adds `job{id, title}`). `status_counts` has every status plus `total` for the job and ignores the filters (so tabs stay stable). Default order is newest first; `?ordering=submitted_at|full_name`; `?search=` matches name, email or reference; `submitted_after/before` are inclusive dates.
- **Detail:** built-in fields, `resume{name, url}`, `answers[]` as `{key, label, type, value}` in the job's current form order (a renamed field shows its new label, an unanswered field `null`, a file answer `{name, url}`), and `status_history[]` with who, when and the note. IP address and user agent are never exposed.
- **Status change:** any status to any other different status (Phase 1, by hand); the change and its history row are written in one transaction; viewers get 403; candidates are not emailed in Phase 1.
- **CSV export:** UTF-8 with BOM, built-in columns plus one column per custom field, newest first; cells that could run as spreadsheet formulas are prefixed with an apostrophe.
- **Module 3 link.** `applications_count` on jobs is now real (and can be ordered by), and after the first application the custom-field locks of Module 3 are enforced.

**Decisions:** D-061 to D-070.

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
