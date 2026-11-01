# Database Schema

PostgreSQL 16. Update this file in the same change as any migration. Section "Implemented" reflects the migrations in the repository; section "Planned" is from the Doc and is not yet migrated.

Conventions: UUID primary keys on entities that appear in URLs; `bigint` identity keys on child rows; all timestamps `timestamptz` (UTC); emails stored lowercase; choice columns are guarded by CHECK constraints; **a CHECK that depends on a nullable column must test `IS NOT NULL` explicitly**, because SQL treats a NULL result as passing (this was caught by a test and fixed).

## Implemented

### `accounts_user` (migration `accounts.0001`)
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| email | varchar(254) | unique; CHECK `email = lower(email)` (`user_email_lowercase`) |
| full_name | varchar(150) | required |
| password | varchar(128) | hash only |
| role | varchar(20) | `candidate` `company_admin` `hr` `platform_admin` (`user_role_valid`) |
| status | varchar(24) | `pending_verification` `pending_approval` `active` `rejected` `suspended` (`user_status_valid`) |
| email_verified | bool | default false |
| is_staff, is_superuser | bool | Django admin access; true only for platform admins |
| date_joined, last_login | timestamptz | last_login nullable |

Index `user_role_status_idx (role, status)`. `PermissionsMixin` also creates the unused `accounts_user_groups` and `accounts_user_user_permissions` tables. `is_active` is derived (`status = 'active'`), not a column.

### `accounts_candidateprofile`
`id` bigint PK · `user_id` uuid **unique** FK→user **CASCADE** · `phone` 20 · `headline` 150 · `location` 150 · `avatar` varchar(100) (public storage, JPG/PNG ≤ 2 MB) · `linkedin_url`, `github_url` 300 · `skills` jsonb default `[]` · `resume` varchar(100) (**private** storage, PDF/DOCX ≤ 5 MB) · `resume_text` text · `updated_at`.

### `accounts_education`
`id` · `profile_id` FK→candidateprofile CASCADE · `institution` 200 · `degree` 150 · `field_of_study` 150 · `start_year` smallint · `end_year` smallint null (null = ongoing) · `grade` 50. CHECK `end_year IS NULL OR end_year >= start_year`.

### `accounts_experience`
`id` · `profile_id` FK CASCADE · `company` 200 · `position` 150 · `start_date` · `end_date` null · `is_current` · `description`. CHECK (`experience_dates_consistent`): `(is_current AND end_date IS NULL) OR (NOT is_current AND end_date IS NOT NULL AND end_date > start_date)`.

### `companies_company` (migration `companies.0001`)
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| name | varchar(200) | unique case-insensitively (`UNIQUE (lower(name))`) |
| slug | varchar(220) | unique; generated from name on first save, numeric suffix on clash |
| industry | 100 | required |
| official_email | 254 | required; uniqueness across users is enforced at sign-up |
| contact_phone | 20 | required |
| website 300, description, headquarters 200 | | optional |
| logo | varchar(100) | optional; JPG/PNG ≤ 2 MB |
| company_size | varchar(10) | `1-10` `11-50` `51-200` `201-1000` `1000+` or empty |
| status | varchar(20) | `pending` (default) `approved` `rejected` `suspended` |
| rejection_reason | text | CHECK: required when `status = 'rejected'` |
| reviewed_by_id | FK→user **SET NULL** | |
| reviewed_at | timestamptz null | |
| created_by_id | FK→user **PROTECT** | founding admin |
| created_at, updated_at | timestamptz | |

Index `company_status_idx (status)`. Companies are never deleted (suspend instead).

### `companies_companymember`
`id` · `company_id` FK **PROTECT** · `user_id` uuid **unique** FK→user CASCADE (one company per user) · `role` (`admin` `hr_manager` `recruiter` `viewer`) · `job_title` 100 · `is_active` default true · `invited_by_id` FK SET NULL · `joined_at`. Index `member_company_role_idx (company, role)`.

### `companies_staffinvitation`
`id` uuid PK · `company_id` FK PROTECT · `email` (lowercase CHECK) · `full_name` 150 · `role` · `job_title` 100 · `token_hash` varchar(64) **unique** (SHA-256 of the raw token; the raw token is only in the email) · `status` (`pending` `accepted` `revoked` `expired`) · `invited_by_id` FK PROTECT · `created_at` · `expires_at` · `accepted_at` null. **Partial unique** `(company, email) WHERE status = 'pending'` (`invitation_one_pending_per_email`). Index `invitation_company_status_idx (company, status)`.

### Other tables
- `token_blacklist_*` (SimpleJWT): outstanding and blacklisted refresh tokens.
- `django_cache` — production only, created by `manage.py createcachetable`; holds throttle counters.
- Django built-ins (`auth_*`, `django_admin_log`, `django_content_type`, `django_session`, `django_migrations`).

## Planned (Doc, not yet migrated)

- **`jobs_jobposting`** (Doc §3.1): UUID PK; `company` FK; title 150, department 100, description, responsibilities; employment type, work mode, location; `required_skills`/`soft_skills` JSON; `min_experience_years` 0–30; education level; salary min/max/currency/show; openings; `deadline`; `status` (`draft` `open` `closed`); nullable unique `form_slug`; `close_reason`; `published_at`, `closed_at`; `created_by`, `updated_by`; timestamps. Indexes `(company, status)` and `(status, deadline)`.
- **`jobs_applicationfield`** (§3.1): `job` FK, `label`, `key` (unique per job), `field_type` (short_text, long_text, number, email, url, date, single_choice, multiple_choice, file), `required`, `options` JSON (2–20 unique items for choice types), `help_text`, `max_length`, `order`.
- **`applications_application`** (§4.1): UUID PK; unique `reference`; `job` FK PROTECT; nullable `candidate_user`; built-in answer columns; `resume` (private, random name) and `resume_original_name`; `answers` JSON; `status` (`submitted` `under_review` `shortlisted` `interview` `selected` `rejected` `on_hold`); `ip_address`, `user_agent`; timestamps. **Unique `(job, email)`**; indexes `(job, status)`, `(job, submitted_at)`.
- **`applications_applicationfile`** and **`applications_applicationstatuschange`** (§4.1): custom file answers; audit history of status changes (`changed_by` nullable for system changes).
- Open schema question: where a company suspension reason is stored (Q21).
