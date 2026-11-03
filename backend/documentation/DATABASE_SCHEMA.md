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

### `accounts_candidateprofile` (`accounts.0001`, extended by `accounts.0002_candidate_profile_extensions`)
`id` bigint PK · `user_id` uuid **unique** FK→user **CASCADE** · `phone` 20 · `headline` 150 · `location` 150 · `bio` 400 · `target_role` 100 · `experience_level` 10 (`entry` `mid` `senior` or empty; CHECK `profile_experience_level_valid`) · `avatar` varchar(100) (public storage, JPG/PNG ≤ 2 MB) · `linkedin_url`, `github_url`, `portfolio_url` 300 · `skills` jsonb default `[]` · `resume` varchar(100) (**private** storage, PDF/DOCX ≤ 5 MB) · `resume_original_name` 255 · `resume_text` text (≤ 15,000 characters, never contains NUL) · `updated_at`. Columns added in 0002: `bio`, `target_role`, `experience_level`, `portfolio_url`, `resume_original_name` (owner-approved, D-025).

### `accounts_education`
`id` · `profile_id` FK→candidateprofile CASCADE · `institution` 200 · `degree` 150 · `field_of_study` 150 · `start_year` smallint · `end_year` smallint null (null = ongoing) · `grade` 50. CHECK `end_year IS NULL OR end_year >= start_year`.

### `accounts_experience`
`id` · `profile_id` FK CASCADE · `company` 200 · `position` 150 · `start_date` · `end_date` null · `is_current` · `description`. CHECK (`experience_dates_consistent`): `(is_current AND end_date IS NULL) OR (NOT is_current AND end_date IS NOT NULL AND end_date > start_date)`.

### `companies_company` (migrations `companies.0001`, `companies.0002_company_suspension_reason`)
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
| suspension_reason | text | CHECK `company_suspended_has_reason`: required when `status = 'suspended'` (D-039) |
| reviewed_by_id | FK→user **SET NULL** | |
| reviewed_at | timestamptz null | |
| created_by_id | FK→user **PROTECT** | founding admin |
| created_at, updated_at | timestamptz | |

Index `company_status_idx (status)`. Companies are never deleted (suspend instead).

### `companies_companymember`
`id` · `company_id` FK **PROTECT** · `user_id` uuid **unique** FK→user CASCADE (one company per user) · `role` (`admin` `hr_manager` `recruiter` `viewer`) · `job_title` 100 · `is_active` default true · `invited_by_id` FK SET NULL · `joined_at`. Index `member_company_role_idx (company, role)`.

### `companies_staffinvitation`
`id` uuid PK · `company_id` FK PROTECT · `email` (lowercase CHECK) · `full_name` 150 · `role` · `job_title` 100 · `token_hash` varchar(64) **unique** (SHA-256 of the raw token; the raw token is only in the email) · `status` (`pending` `accepted` `revoked` `expired`) · `invited_by_id` FK PROTECT · `created_at` · `expires_at` · `accepted_at` null. **Partial unique** `(company, email) WHERE status = 'pending'` (`invitation_one_pending_per_email`). Index `invitation_company_status_idx (company, status)`.

### `jobs_jobposting` (migration `jobs.0001_initial`)
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| company_id | FK→company **PROTECT** | always set by the backend |
| title 150, department 100 | varchar | required |
| description, responsibilities | text | optional (description needed to publish) |
| employment_type | varchar(20) | `full_time` `part_time` `internship` `contract`, or empty (draft) |
| work_mode | varchar(10) | `onsite` `remote` `hybrid`, or empty |
| location | varchar(200) | optional |
| required_skills, soft_skills | jsonb list | |
| min_experience_years | smallint | CHECK 0–30, default 0 |
| education_level | varchar(20) | `none` `intermediate` `bachelor` `master` `phd`, default `none` |
| salary_min, salary_max | integer null | CHECK max ≥ min when both set |
| salary_currency | varchar(10) | free text |
| show_salary | bool | default false |
| openings | smallint | CHECK ≥ 1, default 1 |
| deadline | timestamptz null | |
| status | varchar(10) | `draft` (default) `open` `closed` |
| form_slug | varchar(32) **unique, null** | null for drafts; set on publish; never changed |
| close_reason | varchar(10) null | `manual` `deadline` |
| published_at, closed_at | timestamptz null | |
| created_by_id, updated_by_id | FK→user **SET NULL** | audit |
| created_at, updated_at | timestamptz | |

State CHECKs: `job_draft_has_no_slug`; `job_open_is_published` (slug, published_at, deadline not null); `job_closed_has_close_info` (slug, published_at, closed_at, close_reason not null); `job_only_closed_has_close_info` (close info null unless closed). Indexes: `job_company_status_idx (company, status)`, `job_status_deadline_idx (status, deadline)`.

### `jobs_applicationfield` (`jobs.0001_initial`)
`id` bigint identity · `job_id` FK **CASCADE** (`related_name custom_fields`) · `label` 150 · `key` slug 150 (unique per job, generated from the label, never changes) · `field_type` (`short_text` `long_text` `number` `email` `url` `date` `single_choice` `multiple_choice` `file`, CHECK) · `required` · `options` jsonb list (2–20 unique items for choice types, empty otherwise: validated in code) · `help_text` 500 · `max_length` int null (CHECK ≥ 1; text types only) · `order` smallint. Unique `(job, key)`; index `(job, order)`; ordered by `(order, id)`.

### Other tables
- `token_blacklist_*` (SimpleJWT): outstanding and blacklisted refresh tokens.
- `django_cache` — production only, created by `manage.py createcachetable`; holds throttle counters.
- Django built-ins (`auth_*`, `django_admin_log`, `django_content_type`, `django_session`, `django_migrations`).

## Planned (Doc, not yet migrated)

- **`applications_application`** (§4.1): UUID PK; unique `reference`; `job` FK PROTECT; nullable `candidate_user`; built-in answer columns; `resume` (private, random name) and `resume_original_name`; `answers` JSON; `status` (`submitted` `under_review` `shortlisted` `interview` `selected` `rejected` `on_hold`); `ip_address`, `user_agent`; timestamps. **Unique `(job, email)`**; indexes `(job, status)`, `(job, submitted_at)`.
- **`applications_applicationfile`** and **`applications_applicationstatuschange`** (§4.1): custom file answers; audit history of status changes (`changed_by` nullable for system changes).
