# Requirements (traceable summary)

Authoritative text: `source/IntelliHire_Django_Backend_Implementation_Guide_Phase_1.docx` ("Doc"). This file records what each module must do and where in the Doc to find the detail; it does not replace the Doc. Requirement IDs (FR/NFR/TC/UC) refer to the project report. **Status: Confirmed** unless marked otherwise.

| # | Module | Doc section | Requirements | Tests | App |
|---|---|---|---|---|---|
| 1 | Authentication and account management | "Module 1" §1.1–1.9 | FR-01–07 | TC-01–07 | `Module1_Authentication` |
| 2 | Company management + platform-admin approval | "Module 2" §2.1–2.6 | FR-02, 15, 16, 19, 73 | TC-03, TC-12 | `Module2_CompanyManagement` |
| 3 | Job posting and application form | "Module 3" §3.1–3.5 | FR-20–26 | TC-14–16 | `jobs` |
| 4 | Candidate application management | "Module 4" §4.1–4.6 | FR-27–33 | TC-17–22 | `applications` |

## Cross-cutting (Doc "Project setup", "Shared pieces in common")

- Custom `User` model with `AUTH_USER_MODEL` set **before the first migration**; the first migration includes Module 2's company models.
- JWT: access 15 min, refresh 7 days, rotated and blacklisted. `USE_TZ=True`, everything stored in UTC. Password reset timeout 1 hour; email-verification max age 24 hours. Passwords: Django's four validators, minimum length 8.
- Throttles: login 5/min per IP; password reset and resend verification 3/hour; registration 10/hour; public application submit 10/hour per IP.
- Uploads: max 5 MB. CV validator: `.pdf`/`.docx` only, checks the first bytes (`%PDF` / `PK`); error text **"Only PDF and DOCX files are accepted."** (TC-19).
- Errors: DRF default shapes — `{"field": ["message"]}` and `{"detail": "...", "code": "..."}` (NFR-10, TC-20).
- Emails send only after the transaction commits. Console backend while `DEBUG`, SMTP in production.
- Company-side lists are filtered to the caller's company; another company's object returns 404.

## Module 1 — accounts (Doc §1)

- **Roles:** `candidate`, `company_admin`, `hr`, `platform_admin` (FR-07). **Statuses:** `pending_verification`, `pending_approval`, `active`, `rejected`, `suspended`; only `active` users can log in or call protected APIs (§1.2).
- **Candidate sign-up (FR-01, TC-01/02):** validates name, unique case-insensitive email ("Email already registered."), matching passwords, password validators; one transaction creates `User` (`pending_verification`) and an empty `CandidateProfile`; verification email after commit; responds 201, does not log in.
- **Company sign-up (FR-02, TC-03):** company name (unique, case-insensitive), industry, official email (unique across users), admin name and phone, password; one transaction creates `User` (`company_admin`, `pending_verification`), `Company` (`pending`), `CompanyMember` (role `admin`); two emails after commit (verification; "awaiting review"). Optional free-email-domain block with a configurable list (open question Q4).
- **Verify email:** expired → 400 code `expired`; tampered → 400 "Invalid verification link."; already verified → 200. Candidate → `active`; company admin → `pending_approval`, or `active` if the company is already approved. **Resend:** always the same 200 message.
- **Login (FR-03, TC-04/05):** wrong email or password → 401 "Invalid email or password."; correct credentials but not active → 403 with `code` equal to the status and these messages: "Please verify your email before logging in." / "Your company account is awaiting administrator approval." / "Your company registration was not approved." / "Your account has been suspended."; success → 200 `access`, `refresh`, `user` (id, email, full name, role, status; company id, name, member role and company status for company users); updates `last_login`. No account lock on the first failure.
- **Refresh** (rotate + blacklist), **Logout (FR-04)** (blacklist, 205).
- **Forgot/reset password (FR-05, TC-06):** same 200 message always; reset blacklists all of the user's refresh tokens; bad link → 400 "Reset link is invalid or has expired."; **change password** requires the old one ("Current password is incorrect.") and logs out everywhere.
- **`me`:** GET user object; PATCH `full_name` only (email change out of scope).
- **Candidate profile (FR-06):** profile with nested education and experience; PATCH saves immediately; education and experience rows have their own CRUD scoped through the caller's profile; experience rule: current ⇒ no end date, otherwise end after start. **CV upload:** shared validator, replaces and deletes the old file, extracts plain text with `pypdf`/`python-docx` (first ~15,000 characters) into `resume_text`; extraction failure still saves the file.
- **Status-aware authentication (§1.5)** and **role permission classes (§1.6, TC-07)** — all return 403 "Unauthorized access."; a suspended user's still-valid token → 401 (`account_inactive`). The permission matrix (§1.6) has an unresolved reading (Q7).
- **Security checklist (§1.8):** hash-only passwords, identical responses for existing/non-existing emails, lowercase emails on every write and lookup, throttles, HTTPS in production.

## Module 2 — companies (Doc §2)

- **Company lifecycle:** `pending` → `approved` | `rejected` (→ resubmit → `pending`); `approved` → `suspended` → reactivate.
- **Platform-admin review (FR-73):** list (default `pending`, search by name/email, newest first), detail, approve and reject (reject reason ≥ 10 characters); only from `pending`, otherwise 409 "Company has already been reviewed."; row lock (`select_for_update`) and re-check inside the transaction; emails after commit; suspend/reactivate (409 on wrong state).
- **Company profile (FR-15, FR-19, TC-12):** any member reads; only member role `admin` edits (name, industry, website, description, headquarters, size, phone, logo); `official_email` and `status` read-only; name change re-checks uniqueness and regenerates the slug; response includes `profile_completion` (website, description, headquarters, logo, size).
- **Invitations (UC-04):** admin invites (email not already a user; no pending duplicate); only a SHA-256 hash of a random 32-byte token is stored; 7-day expiry; list (pending past expiry shown as expired), resend (new token, new expiry), revoke; public accept-details and accept endpoints create an `active`, email-verified user and member.
- **Members:** list (any member); change role, deactivate/reactivate (admin only; not yourself; company keeps ≥ 1 active admin); deactivation blacklists the user's refresh tokens.
- **Resubmission (UC-04 A1):** public endpoint authenticates the rejected admin, updates the company, resets to `pending`, notifies platform admins.
- **Emails (§2.5)** and **edge cases (§2.6)** as specified. Deleting a company is not offered.
- **Dashboard (FR-16, NFR-01):** one endpoint; blocks `company`, `jobs`, `applicants`, `pipeline`, `closing_soon`, `recent_applications`, `team`; aggregate queries only; built last.

## Module 3 — jobs (Doc §3)

- **JobPosting** and **ApplicationField** per §3.1; built-in form fields (full name, email, phone, highest education level, institution, graduation year, CV) are defined once in code and always come first (FR-24, FR-29).
- **Lifecycle:** `draft` → `open` (publish) → `closed` (manual or deadline); reopen with a new future deadline; delete drafts only. `is_accepting_applications` = open ∧ deadline in future ∧ company approved.
- **Publish (FR-24/25, TC-15):** completeness checks; deadline ≥ 1 hour and ≤ 6 months ahead; `form_slug` ~10 chars from `secrets`, up to 5 collision retries; share URL `FRONTEND_URL/apply/<form_slug>`; slug never changes.
- **Edit (FR-21):** draft fully editable; open editable until the deadline; after the first application, custom fields are partly locked (§3.3) → 409.
- **Custom fields (FR-23):** CRUD and reorder; key generated from the label and unique within the job and against built-in keys.
- **Close (FR-26, TC-16):** manual, and `close_expired_jobs` management command (every ~5 minutes) with reason `deadline`.
- **List/detail:** company-scoped; filters status, department, employment type; search by title; ordering by created date, deadline or application count; `applications_count` annotation and `days_left`.
- Never accept `company`, `status`, `form_slug` or `created_by` from the request body.

## Module 4 — applications (Doc §4)

- **Public submit (FR-27–32, TC-17–21):** server-side job check with row lock (404 unknown/draft; 410 closed); validate built-in fields, CV, and custom fields dynamically; return **all** errors at once keyed by field (messages such as "Email is required."); duplicate `(job, email)` → 400 on `email`; one transaction writes the application, files (random names, per-job folder) and the first history row; retry once on a temporary database error, then 503 "We could not save your application. Please try again."; confirmation email after commit (email failure never fails the application); 201 with reference, job title, company, submitted time.
- **Abuse protection:** 10/hour per IP, hidden honeypot, ~12 MB request cap; an optional candidate token only sets `candidate_user`.
- **Private files (FR-28):** never a public media URL; HR downloads through an authenticated endpoint (stream with original name, or ≈5-minute signed URL in production); clean up files on failure.
- **HR review (FR-33, TC-22):** per-job and company-wide lists with filters, search and status counts; detail with built-in fields, custom answers joined to current field labels, file links, status history; status change by recruiter, HR manager or admin (viewers cannot) writes history in one transaction; CSV export (nice to have). No candidate email on status change in Phase 1.

## Test cases (Doc, "Automated tests mapped to your report")

TC-01–07, 12, 14–22 are specified one by one; each module's tests carry the TC IDs in their names, plus the company-isolation pattern on every company-side endpoint.

## Module 1 traceability (implemented on `backend/module-01`)

| Requirement / test case | Where it is verified |
|---|---|
| FR-01, TC-01, TC-02 candidate sign-up, duplicate email | `Module1_Authentication/tests/test_register_candidate.py` (`test_tc01_…`, `test_tc02_…`) |
| FR-02, TC-03 company sign-up (user + pending company + admin member, two emails, login refused until approved) | `Module2_CompanyManagement/tests/test_company_registration.py` (`test_tc03_…`) |
| Email verification and resend | `Module1_Authentication/tests/test_email_verification.py` |
| FR-03, TC-04, TC-05 login, status messages and codes | `Module1_Authentication/tests/test_login.py` (`test_tc04_…`, `test_tc05_…`) |
| FR-04 logout, token rotation and blacklisting | `Module1_Authentication/tests/test_tokens.py` |
| FR-05, TC-06 forgot, reset, change password | `Module1_Authentication/tests/test_password_flows.py` (`test_tc06_…`) |
| FR-06 profile, education, experience, CV upload and text extraction | `test_profile.py`, `test_education_experience.py`, `test_resume.py` |
| FR-07, TC-07 roles, status-aware authentication, platform-admin endpoints | `common/tests/test_permissions.py`, `Module1_Authentication/tests/test_platform_admin_users.py` (`test_tc07_…`), `Module1_Authentication/tests/test_tokens.py` (`test_tc07_…`) |
| Upload and request-size limits | `common/tests/test_validators.py`, `test_parsers.py` |


## Module 2 traceability (implemented on `backend/module-02`)

| Requirement / test case | Where it is verified (`Module2_CompanyManagement/tests/`) |
|---|---|
| FR-73 platform-admin list/detail/approve/reject, 409 on second decision, suspend/reactivate | `test_company_review.py` |
| TC-03 company sign-up and platform-admin notification | `test_company_registration.py` (`test_tc03_…`, `test_registration_notifies_active_platform_admins_only`) |
| FR-15/FR-19 profile read/edit, logo, slug, name uniqueness, completion | `test_company_profile.py` |
| Members: role, deactivate, self and last-admin rules, token revocation | `test_company_members.py` |
| UC-04 invitations: create, hash-only storage, resend, revoke, expiry, public details, accept | `test_company_invitations.py` |
| UC-04 A1 resubmission after rejection | `test_company_resubmission.py` |
| FR-16 / TC-12 dashboard blocks | `test_company_dashboard.py` (jobs/applications blocks are zeros until Modules 3–4) |
| Company B cannot see or change Company A | `test_company_isolation.py` |
| Concurrent approve/reject, accept, mutual deactivation, duplicate company name | `test_company_concurrency.py` (real threads, committed transactions) |

## Module 3 traceability (implemented on `backend/module-03`)

| Requirement / test case | Where it is verified (`Module3_JobPosting/tests/`) |
|---|---|
| Data model, status rules, `is_accepting_applications`, share URL, indexes | `test_job_models.py` |
| FR-20, TC-14 create, draft, publish-on-create, validation, role access | `test_job_create.py` (`test_tc14_…`) |
| List, filters, search, ordering, `applications_count`, `days_left`, detail | `test_job_list_detail.py` |
| FR-21 edit rules for draft, open and closed jobs | `test_job_edit.py` |
| FR-22, FR-24, FR-25 publish, slug generation and collisions, FR-26 close, reopen, delete, duplicate, TC-16 auto-close command | `test_job_lifecycle.py` (`test_tc16_…`) |
| FR-23 custom fields: keys, validation, locking after applications, reorder, state gate | `test_custom_fields.py` |
| FR-24, TC-15 form schema, preview equals public, public endpoint states | `test_form_schema.py` (`test_tc15_…`, `test_tc16_…`) |
| Company B cannot see or change Company A's jobs (every endpoint) | `test_job_isolation.py` |
| Concurrent publish, field-key allocation, close/delete races | `test_job_concurrency.py` (real threads) |

Not verifiable until Module 4 exists: TC-16's "submit returns 410", and the lock rules against real applications (they are tested now with the application check patched to true).

## Module 4 traceability (implemented on `IntelliHire-backend`)

| Requirement / test case | Where it is verified (`Module4_ApplicationManagement/tests/`) |
|---|---|
| FR-27, TC-17 public submit, row linked to the job, first history row | `test_apply.py` (`test_tc17_…`) |
| FR-28, TC-18 private random-name storage, protected download with the original name | `test_apply.py` (`test_tc18_…`) |
| TC-19 wrong or oversized CV | `test_apply.py` (`test_tc19_…`) |
| FR-30, TC-20 missing fields reported together by name; custom field rules per type | `test_apply.py` (`test_tc20_…`, `TestCustomFields`) |
| FR-32, TC-21 confirmation email | `test_apply.py` (`test_tc21_…`) |
| TC-16 submit returns 410 (closed, past deadline, company not approved) | `test_apply.py` (`test_tc16_…`) |
| Duplicates, honeypot, throttle, request size, candidate link | `test_apply.py` |
| Rollback, retry-once then 503, no orphan files | `test_apply.py` (`TestAtomicity`) |
| FR-33 lists, filters, search, ordering, status counts, detail, status change and history, downloads, CSV | `test_review.py` |
| TC-22 and company isolation on every endpoint | `test_isolation.py` |
| Real `applications_count` and the post-application field locks | `test_module3_link.py` |
| Duplicate-submission race, unique references, status-change chain, close-versus-submit race | `test_concurrency.py` (real threads) |

## Integration traceability (`integration_tests/`)

| Requirement | Where it is verified |
|---|---|
| FR-16, TC-12 dashboard: every block, real numbers, agreement with Modules 3 and 4, isolation, bounded queries | `test_dashboard.py` (`test_tc12_…`) |
| Cross-module rules: company and user suspension, member deactivation, role changes, invitation to first job, rejection to resubmission to approval to jobs, close/reopen/auto-close, duplicate, locks | `test_cross_module_rules.py` |
| FR-07, TC-07 and the isolation rule on **every** operation (anonymous 401, wrong role 403, another company 404, public endpoints ignore a bad token) | `test_surface_sweep.py` |
| Checks, migrations, schema validity, dependency direction, Doc test-case coverage, tables | `test_quality_gates.py` |
| TC-01 to TC-22 as one story across all modules | `test_full_journey.py` |

TC-12 previously had its pieces tested but no single named test; it now has one.
