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
| `/api/notifications/` | `Module5_Foundation` (label `foundation`): the signed-in user's own notifications |
| `/api/public/` | `invitations/` (Module 2); `jobs/<slug>/` (Module 3); `jobs/<slug>/apply/` (Module 4) |
| `/api/docs/`, `/admin/` | Swagger UI, Django admin |

## Module 1 — Authentication and account management (`Module1_Authentication`)

Source: Doc §1.7. Implemented and tested on `backend/module-01`; deviations and additions are listed below the table.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| POST | /api/auth/register/candidate/ | Public | full_name, email, password, confirm_password; optional target_role, skills, linkedin_url, github_url, resume (JSON, or multipart when a CV is attached; D-073) | 201 email, status | 400 field errors (duplicate email, weak password, mismatch, bad CV or URL); 413; 429 | implemented |
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
| GET | /api/platform-admin/users/ | Platform admin | ?role, ?status (repeat to match several), ?search, ?ordering, ?page, ?page_size | 200 paginated accounts + `status_counts` (D-074) | 400 bad filter; 403 | implemented |
| POST | /api/platform-admin/users/<user_id>/suspend/ | Platform admin | none | 200 user object | 400 self or another platform admin; 404; 409 already suspended | implemented |
| POST | /api/platform-admin/users/<user_id>/reactivate/ | Platform admin | none | 200 user object | 404; 409 not suspended | implemented |

**Deviations from the Doc (all recorded in `DECISIONS.md`)**
- Candidate sign-up also accepts the optional profile answers and a CV (owner decision D-073); sign-up with only the four account fields still works. Skills are repeated keys in multipart. The CV follows the profile CV rules (PDF/DOCX, 5 MB), is stored privately and its text extracted; a rejected sign-up leaves no file behind.
- `GET /api/platform-admin/users/` (D-074) rows: `id, email, full_name, role, status, email_verified, date_joined, last_login, company{id,name,member_role,status}|null`; default order newest first; `status_counts` ignores the `status` filter so tabs stay stable.
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
| GET | /api/company/dashboard/ | Company user | none | 200 metrics object | 403 | implemented (all blocks are real since Module 4; D-071) |
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
| POST | /api/platform-admin/companies/<id>/approve/ | Platform admin | none | 200 detail (pending, or a rejected company: the rejection is overturned, D-075) | 404; 409 `already_reviewed` (approved or suspended) | implemented |
| POST | /api/platform-admin/companies/<id>/reject/ | Platform admin | reason (≥ 10 chars) | 200 detail | 400 reason; 409 `already_reviewed` | implemented |
| POST | /api/platform-admin/companies/<id>/suspend/ | Platform admin | reason (≥ 10 chars) | 200 detail | 400 reason; 409 `invalid_state` (only approved) | implemented |
| POST | /api/platform-admin/companies/<id>/reactivate/ | Platform admin | none | 200 detail | 409 `invalid_state` (only suspended) | implemented |

### Module 2 — implemented behaviour

- **Deactivated members (D-076).** Login answers 403 `member_deactivated` and token refresh 401 `member_deactivated`; every `/api/company/` call is 403. `/api/auth/me/` still answers so the app can explain what happened.
- **Profile `created_at` (D-077).** Read-only registration time of the company.
- **Access gate.** `IsCompanyUser` = active member of an **approved** company; a pending, rejected or suspended company gets 403 "Unauthorized access." on every `/api/company/` endpoint. A suspended company's users can still log in (login only checks the user's status).
- **Isolation.** Every company-side lookup is scoped to the caller's company; another company's member or invitation id returns 404, identical to a missing id.
- **Review list** is paginated (`count`, `next`, `previous`, `results`); rows carry `id, name, industry, official_email, contact_phone, status, created_at, admin{id, full_name, email, email_verified, status, date_joined}`. Detail adds slug, website, description, headquarters, logo, company_size, `rejection_reason`, `suspension_reason`, `reviewed_by` (email), `reviewed_at`.
- **Member** object: `id` (integer membership id), `full_name`, `email`, `role`, `job_title`, `joined_at`, `is_active`, `last_login`. The lists for members and invitations are unpaginated (a company team is small).
- **Invitation** object: `id, email, full_name, role, job_title, status, created_at, expires_at, accepted_at`. The token is never returned by the API; it exists only in the email link `FRONTEND_URL/accept-invite?token=…`. A pending invitation past its expiry is reported and stored as `expired`.
- **Accept** returns `{"email","status"}` and no tokens: the new user logs in normally (D-040).
- **Resubmit** link in the rejection email: `FRONTEND_URL/resubmit-company` (frontend page to be built in Phase 5).
- **Dashboard** shape: `company{name, logo, status, profile_completion}`, `jobs{open, draft, closed}`, `applicants{total, new_last_7_days}`, `pipeline{submitted, under_review, shortlisted, interview, selected, rejected, on_hold}`, `closing_soon[]`, `recent_applications[]`, `team{active_members, pending_invitations}`. All blocks are live: `jobs` counts by stored status; `applicants.total` and `pipeline` count the company's applications; `new_last_7_days` counts applications submitted in the last 7 days; `closing_soon` lists open jobs whose deadline is within 7 days (soonest first, at most 20) with their application count; `recent_applications` is the latest 5, each with the application `id` (D-080) so a row can open it. Numbers agree with `GET /api/jobs/` and the application lists.
- **Profile completion** = share of the five optional fields (website, description, headquarters, logo, company_size) that are filled, in steps of 20.
- **Throttles:** accept-invitation uses the `register` scope (10/hour); resubmit uses `login` (5/min). Invitation details are unthrottled but reveal nothing for an unknown token beyond `invalid_invitation`.

**Deviations from the Doc (recorded in `DECISIONS.md`):** `suspension_reason` column and 10-character reason minimum for suspend (D-039); acceptance requires an approved company and returns no tokens (D-040); the resubmission email path (D-041); review-list pagination (D-042).

## Module 3 — Job posting and application form (`Module3_JobPosting`)

Source: Doc §3.4. Implemented and tested on `backend/module-03`; behaviour notes and deviations follow the table.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET | /api/jobs/ | Company user | ?status, ?department, ?employment_type, ?search, ?ordering, ?page, ?page_size | 200 paginated list | 400 bad filter; 403 | implemented |
| POST | /api/jobs/ | Admin, HR manager, recruiter | job fields, optional `publish` flag | 201 job | 400 field errors; 403 | implemented |
| GET | /api/jobs/departments/ | Company user | none | 200 list of strings: the departments the company has used, once each (case-insensitive), sorted A-Z (D-078) | 403 | implemented |
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
| GET, POST | /api/applications/<id>/notes/ | Company user (POST: admin, HR manager, recruiter) | text (1-2000 characters) | 200 list newest first / 201 note `{id, text, author{id, full_name}\|null, created_at}` | 400 empty or too long, `limit_reached` (100 per application); 403 viewer on POST; 404 | implemented (D-079) |
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
- **Notes (D-079).** Free notes are separate from the note on a status change: they never change the status or the history, are never edited or deleted, and are also returned in the detail as `notes[]` (newest first). Everyone in the company reads them; admin, HR manager and recruiter write them.
- **Detail:** built-in fields, `resume{name, url}`, `answers[]` as `{key, label, type, value}` in the job's current form order (a renamed field shows its new label, an unanswered field `null`, a file answer `{name, url}`), and `status_history[]` with who, when and the note. IP address and user agent are never exposed.
- **Status change:** any status to any other different status (Phase 1, by hand); the change and its history row are written in one transaction; viewers get 403; candidates are not emailed in Phase 1.
- **CSV export:** UTF-8 with BOM, built-in columns plus one column per custom field, newest first; cells that could run as spreadsheet formulas are prefixed with an apostrophe.
- **Module 3 link.** `applications_count` on jobs is now real (and can be ordered by), and after the first application the custom-field locks of Module 3 are enforced.

**Decisions:** D-061 to D-070.

## Module 5 — AI and notifications foundation (`Module5_Foundation`, Phase 2)

Source: Phase 2 guide, Module 5. Implemented and tested on `IntelliHire-backend`. Any signed-in account (candidate, company user, platform admin) may use these; every query is limited to the caller's own rows.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET | /api/notifications/ | Logged in | ?unread=true\|false, ?page, ?page_size | 200 paginated, newest first | 400 `invalid_filter`; 401 | implemented |
| GET | /api/notifications/unread-count/ | Logged in | none | 200 `{count}` | 401 | implemented |
| POST | /api/notifications/<id>/read/ | Logged in (owner) | none | 200 the notification, now read | 404 not yours or unknown | implemented |
| POST | /api/notifications/read-all/ | Logged in | none | 200 `{count}` of rows changed | 401 | implemented |

### Module 5 — implemented behaviour

- **Row shape:** `id, kind, title, body, link, payload, read, read_at, created_at`. `link` is `""` or a path inside the frontend (always starts with one `/`); `payload` never holds secret-looking keys. Text is plain: render it as text, never as HTML.
- **Marking read** is safe to repeat; the first `read_at` is kept. Another user's id answers 404, exactly like an unknown id.
- **Throttle:** 120 requests per minute per user (`notifications`).
- **Creating notifications** is internal (`notifications.notify`, `notify_many`); there is no public create endpoint.
- **Email outbox, activity log, AI layer, prompt templates, AI settings and system alerts** have no endpoints in this module. Admin-facing endpoints for them arrive in Module 13. Behaviour: D-081 to D-091.
- **Scheduled tasks** (`CELERY_BEAT_SCHEDULE`): send/retry emails every 10 minutes, `check_alerts` every 5, worker heartbeat every minute, purge email bodies daily, `close_expired_jobs` every 5. Run a worker and beat in production; run `python manage.py check_alerts` from cron every 5 minutes to detect a dead worker.
- **Changed Phase 1 behaviour:** every email now goes through the outbox (same recipients and text; one message per recipient; sent after commit as before; verification, reset and invitation bodies are wiped after sending). `reactivate_user`, `suspend_company` and `reactivate_company` record who acted.

**Decisions:** D-081 to D-091.

## Module 6 — CV analysis and shortlisting (`Module6_CVAnalysis`, Phase 2)

Source: Phase 2 guide, Module 6. Implemented and tested on `IntelliHire-backend`. Company side only; another company's job or application is 404; candidates never see any of it.

| Method | Endpoint | Access | Request | Success | Main errors | Status |
|---|---|---|---|---|---|---|
| GET, PUT | /api/jobs/<id>/screening-config/ | Company user (PUT: admin, HR manager) | any of `auto_analyse`, `shortlist_threshold`, `auto_shortlist`, `invite_on_shortlist`, four `weight_*` | 200 config + `warnings` | 400 invalid or weights not 100; 403; 404 | implemented |
| POST | /api/jobs/<id>/cv-screening/run/ | Admin, HR manager, recruiter | `mode`: `missing` (default), `rescore`, `full` | 202 `{mode, queued}` | 400; 403; 404; 409 `no_applications` | implemented |
| GET | /api/jobs/<id>/cv-screening/ | Company user | none | 200 counts per state, `paused`, `stale_scores`, `in_progress`, `percent_done` | 404 | implemented |
| GET | /api/jobs/<id>/ranking/ | Company user | ?min_score, ?status, ?analysis_status (`none` = not analysed), ?page | 200 paginated ranked rows | 400 bad filter; 404 | implemented |
| POST | /api/jobs/<id>/shortlist/apply-threshold/ | Admin, HR manager | `threshold` (default: saved), `dry_run` | 200 `{threshold, shortlisted}` or the preview | 400; 403; 404 | implemented |
| GET | /api/applications/<id>/cv-analysis/ | Company user | none | 200 parsed data, flags, match, explanation | 404 (`not_analysed` when never analysed) | implemented |
| POST | /api/applications/<id>/cv-analysis/rerun/ | Admin, HR manager, recruiter | none | 202 | 403; 404; 409 `analysis_in_progress` | implemented |

### Module 6 — implemented behaviour

- **Automatic flow.** A new application's CV is queued in the same transaction (if `auto_analyse`), analysed by a background task, scored, and the application moves from `submitted` to `under_review`. With `auto_shortlist` on, scores at or above the threshold also move to `shortlisted`. Nothing else is automatic and nobody is rejected.
- **Ranking row:** `rank, id, reference, full_name, email, status, submitted_at, score, skills_score, experience_score, education_score, semantic_score, cv_label, analysis_status, stale`. Best first; ties to the earlier submission; unscored last.
- **Labels (`cv_label`):** `shortlisted`, `meets_threshold`, `not_shortlisted`, `manual_review`, `analysing`, `failed`, or `null` when the CV was never queued.
- **Analysis detail:** `status, failure_reason, flags[], parsed{technical_skills, soft_skills, education[], experience[], projects[], achievements[], total_experience_years}, attempts, analysed_at, cv_label, match{score, four part scores, matched_skills, missing_skills, experience_years, weights_used, explanation, explanation_is_ai_generated, stale, computed_at}, notice`. Show the notice and mark the explanation as AI-generated.
- **Changed Module 4 responses:** application list rows and the detail gain `cv_score` (number or null) and `cv_label`; the lists accept `ordering=cv_score|-cv_score` and `min_cv_score`; each `status_history` entry gains `source` (`hr` or `system`). **An application may now already be `under_review` moments after it was submitted.**
- **Scoring, durability, limits, flags:** D-092 to D-103.

**Decisions:** D-092 to D-103.

## Module 7 — Interview engine and AI screening interview (`Module7_Interviews`, Phase 2)

Source: Phase 2 guide, Module 7. Data model and every rule that is not an LLM call; the LLM code is merged later through the four hooks in `Module7_Interviews/ai_hooks.py` (D-108). Implemented and tested on `IntelliHire-backend`. Candidate endpoints are public (the token in the path is the only credential); company endpoints are JWT, same company only (another company's object is 404; viewers read only).

**Candidate side (no login)**

| Method | Endpoint | Request | Success | Main errors |
|---|---|---|---|---|
| GET | /api/public/interviews/<token>/ | none | 200 company, role, kind, instructions, question count, answered count, minutes, `expires_at`, `seconds_left_to_start`, `voice_available`, `ai_disclaimer`, `current_turn` | 404; 410 (`interview_expired`, `interview_completed`, `interview_cancelled`, `interview_unavailable`) |
| POST | /api/public/interviews/<token>/start/ | none | 200 `{done, turn{index, question_text, asked_at}, answered_count, question_count}`: the first question, or the one waiting after a break | 410; 429; 503 `no_question_available` + `Retry-After` |
| POST | /api/public/interviews/<token>/answer/ | `turn_index` and `answer_text` (JSON) or an `audio` file (multipart) | 200 same shape: the next question, or `done: true` | 400 empty, too long, both or neither; 409 `wrong_turn`, `not_started`; 410; 422 `voice_not_available`, `transcription_failed`, `audio_too_long`; 429; 503 |
| POST | /api/public/interviews/<token>/finish/ | none | 200 `done: true` | 400 `too_few_answers` (fewer than 3); 410; 429 |

**Company side**

| Method | Endpoint | Access | Request | Success | Main errors |
|---|---|---|---|---|---|
| POST | /api/applications/<id>/interviews/ | Admin, HR manager, recruiter | `kind` (screening, or technical with Module 8), `expires_in_days` 1 to 14, `override`, `note` | 201 session (never the token) | 400; 403; 404; 409 `open_session_exists`, `prerequisite_missing`, `company_not_active` |
| GET | /api/applications/<id>/interviews/ | Company user | none | 200 sessions, newest first | 404 |
| GET | /api/interviews/<id>/ | Company user | none | 200 transcript with per-answer score, feedback, criteria and flags; `report`; `ai_disclaimer` | 404 |
| POST | /api/interviews/<id>/resend/ | Admin, HR manager, recruiter | none | 200 (new link emailed; the old one dies) | 409 `interview_closed`, `link_expired` |
| POST | /api/interviews/<id>/extend/ | Admin, HR manager, recruiter | `days` 1 to 14 | 200 `{expires_at}` | 400; 409 `interview_closed`, `open_session_exists` |
| POST | /api/interviews/<id>/cancel/ | Admin, HR manager, recruiter | none | 200 | 409 `interview_closed` |
| POST | /api/interviews/<id>/reevaluate/ | Admin, HR manager | none | 202 | 409 `not_completed`, `evaluation_running` |
| GET | /api/jobs/<id>/interviews/ | Company user | ?kind, ?status, ?page | 200 paginated | 400 `invalid_filter`; 404 |

### Module 7 — implemented behaviour

- **Statuses:** `invited`, `in_progress`, `interrupted` (open, one per application and kind), `completed`, `incomplete` (finished early), `evaluating`, `evaluated`, `evaluation_failed`, `expired`, `cancelled`. The frontend can resume after a refresh by calling GET and then start again.
- **Session row:** `id, kind, status, role_title, question_target, answered_count, overall_score, recommendation (advance|hold|not_recommended|null), invited_at, expires_at, started_at, completed_at, created_by{id, full_name}|null, application{id, reference, full_name}`. Scores stay null until the scoring hook is merged.
- **Nothing is decided automatically.** An evaluation never changes the application's status and the candidate is told nothing; the recommendation guard (default minimum 60, `hold` from 15 below) is plain code.
- **Until the hooks are merged:** questions come from the bank, answers are stored, sessions complete, scores and reports stay empty, voice answers are 422, and unevaluated interviews are looked at again every 6 hours.
- **Changed Module 4 responses:** application list rows and the detail gain `screening` and `technical` blocks (`{session_id, status, overall_score, recommendation}` or null); company side only.
- **Automatic invitation:** with the job's `invite_on_shortlist` on, shortlisting (by hand, by rule or by threshold) sends the screening invitation (D-116).
- **Throttles:** start 10/hour and answer/finish 60/min per link; opening 120/min per address.

**Decisions:** D-104 to D-117.

## Module 8 — AI technical interview (`Module8_TechnicalInterview`, Phase 2)

Source: Phase 2 guide, Module 8. No new routes and no new tables: the same Module 7 endpoints behave differently for `kind = technical` because Module 8 registers its rules with the engine. Rules in code, no LLM; the four hooks are the same as Module 7's.

- **Invite:** `POST /api/applications/<id>/interviews/` with `kind: "technical"`. 409 `screening_not_passed` unless the latest screening is evaluated as `advance`; an admin or HR manager can send `override: true` with a `note` (403 `override_not_allowed` for anyone else). The 201 body gains `warnings` (a job with no required skills). The application stays `interview`. A screening that advances sends this invitation by itself (D-118).
- **Questions:** 8 by default (`AISettings.technical_questions`). The question hook's hint carries the seniority band, `difficulty`, `competencies_to_cover`, `focus_topic` and, when the follow-up rule fires, `follow_up_of`. Each turn payload has `is_follow_up`.
- **Answers:** typed only; audio is 400 `voice_not_allowed`. If the question service is down: 503 `ai_unavailable` with `Retry-After: 120`; after 2 minutes the session is `interrupted` and `ai.provider_failure` is logged; the same link resumes.
- **Result:** `overall_score` is a percentage, `recommendation` stays null (HR decides; Module 9 combines it). `report` has `summary`, `technical_relevance`, `strengths`, `weaknesses`, `questions[]` and `rubric_averages`; empty, with `report_message: "Report not available yet"`, until the report hook is merged.
- **Not completed by the deadline:** the Module 7 sweep expires it and HR is told "Technical interview not completed".

**Decisions:** D-118 to D-123.

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
