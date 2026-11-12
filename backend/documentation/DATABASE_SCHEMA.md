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

### `applications_application` (migration `applications.0001_initial`)
| Column | Type | Rules |
|---|---|---|
| id | uuid PK | |
| reference | varchar(20) **unique** | `IH-` + 6 characters (no 0/O/1/I) |
| job_id | FK→jobposting **PROTECT** | `related_name applications` |
| candidate_user_id | FK→user **SET NULL**, null | only when a candidate was logged in |
| full_name 150, phone 20, institution 200 | varchar | |
| email | varchar(254) | CHECK lowercase |
| education_level | varchar(20) | same values as the job's education level, CHECK |
| graduation_year | smallint | CHECK 1970–2100 (the 1970–current+6 rule is in code) |
| resume | varchar(255) | private storage, `applications/<job_id>/<random>.<ext>` |
| resume_original_name | varchar(255) | used for downloads |
| answers | jsonb object | custom answers keyed by field key (files are in `applicationfile`) |
| status | varchar(20) | `submitted` (default) `under_review` `shortlisted` `interview` `selected` `rejected` `on_hold`, CHECK |
| ip_address | inet null, user_agent varchar(500) | abuse checks; never exposed by the API |
| submitted_at, updated_at | timestamptz | |

Constraints and indexes: **unique `(job, email)`** (`application_one_per_job_email`); `application_job_status_idx (job, status)`; `application_job_submitted_idx (job, submitted_at)`.

### `applications_applicationfile` (`applications.0001_initial`)
`id` bigint identity · `application_id` FK **CASCADE** (`related_name files`) · `field_key` slug · `file` (private storage) · `original_name` · `size`. Unique `(application, field_key)`.

### `applications_applicationstatuschange` (`applications.0001_initial`)
`id` bigint identity · `application_id` FK **CASCADE** (`related_name status_history`) · `from_status` (blank for the first row, CHECK) · `to_status` (CHECK) · `changed_by_id` FK→user **SET NULL**, null for the first row · `note` text · `changed_at`. Index `(application, changed_at)`; ordered by time.

### Module 5 — foundation tables (`foundation.0001_initial`)

| Table | Columns and rules |
|---|---|
| `foundation_notification` | `id` uuid · `user_id` FK **CASCADE** · `kind` · `title` (200) · `body` · `link` (CHECK: empty, or starts with `/` and not `//`) · `payload` jsonb · `read_at` null · `created_at`. Indexes: `(user, -created_at)`, partial `(user, -created_at) WHERE read_at IS NULL` |
| `foundation_outboundemail` | `id` uuid · `to_email` · `subject` (255) · `body_text`, `body_html` · `kind` · `sensitive`, `body_purged` · `status` (CHECK queued/sending/sent/failed) · `attempts` · `next_attempt_at` · `claimed_at` · `last_error` (300, never the address) · `related_type`, `related_id` · `created_at`, `sent_at`. Indexes: `(status, next_attempt_at)`, `(created_at)` |
| `foundation_activityevent` | `id` uuid · `event_type` · `actor_id` FK **SET NULL** · `company_id` FK **SET NULL** · `target_type`, `target_id` · `summary` (300) · `metadata` jsonb (max 2 KB) · `created_at` (indexed). Append-only in code. Indexes: type+time, company+time, actor+time, target |
| `foundation_airequestlog` | `id` uuid · `feature` · `provider` · `model` · `status` (CHECK ok/retried/failed/fallback_used/policy_blocked) · `attempts` · `prompt_tokens`, `completion_tokens` · `latency_ms` · `error` (300) · `related_type`, `related_id` · `created_at`. Never holds prompts or content |
| `foundation_prompttemplate` | `key` · `version` · `model_role` (CHECK chat/eval) · `system_text`, `user_text` · `output_schema` jsonb · `is_active` · `created_by_id` FK **SET NULL** · `created_at`. Unique `(key, version)`; **unique `key` where `is_active`** (one active version per key); CHECK `version >= 1` |
| `foundation_aisettings` | One row: `id` CHECK `= 1`. Provider, model names, fallback, temperatures (CHECK 0 to 2), `max_tokens` jsonb, `timeout_seconds`, `screening_min_score` (CHECK <= 100), `screening_questions`, `technical_questions`, `mock_questions` (CHECK 3 to 15), `updated_by_id`, `updated_at` |
| `foundation_systemalert` | `id` uuid · `kind` (CHECK) · `severity` (CHECK warning/critical) · `message` · `is_active` · `created_at`, `resolved_at`, `acknowledged_at`, `acknowledged_by_id` FK **SET NULL**. **Unique `kind` where `is_active`** (one active alert per kind) |

### Module 6 — CV analysis tables (`cv_analysis.0001_initial`, `0002_seed_prompts`)

| Table | Columns and rules |
|---|---|
| `cv_analysis_jobscreeningconfig` | `job_id` one-to-one **CASCADE** · `auto_analyse` (true) · `shortlist_threshold` (70, CHECK <= 100) · `auto_shortlist`, `invite_on_shortlist` (false) · `weight_skills/experience/education/semantic` (50/25/15/10, **CHECK sum = 100**) · `job_embedding` jsonb, `job_embedding_key` · `run_requested_at`, `completion_notified_at` · `updated_by_id` **SET NULL**, `updated_at` |
| `cv_analysis_cvanalysis` | `application_id` one-to-one **CASCADE** · `status` (CHECK queued/processing/completed/failed/manual_review) · `parsed` jsonb · `flags` jsonb · `text_chars` · `embedding` jsonb, `embedding_model` · `parser_version` · `failure_reason` · `attempts`, `next_attempt_at`, `claimed_at` · `analysed_at`, `created_at`. Indexes `(status, next_attempt_at)`, `(analysed_at)`. The CV text itself is never stored |
| `cv_analysis_cvmatch` | `application_id` one-to-one **CASCADE** · `score` and four part scores numeric(5,2) (CHECK 0 to 100) · `matched_skills`, `missing_skills` jsonb · `experience_years` · `weights_used` jsonb · `job_signature` · `explanation` · `computed_at`. Index `(-score)` |

`applications_applicationstatuschange` gained `source` (`hr` default, or `system`; CHECK) in `applications.0003_status_change_source`.

### Module 7 — interview tables (`interviews.0001_initial`, `0002_seed_question_bank`)

| Table | Columns and rules |
|---|---|
| `interviews_interviewsession` | `id` uuid · `kind` (CHECK screening/technical/mock) · `application_id` FK **CASCADE**, null only for mock (CHECK) · `candidate_user_id` FK **SET NULL** · `token_hash` char(64) **unique** (SHA-256; the raw token is never stored) · `status` (CHECK, ten values) · `role_title` · `context` jsonb (job snapshot and redacted CV summary, no contact details) · `question_target` (CHECK >= 1) · `invited_at`, `expires_at`, `started_at`, `completed_at`, `last_activity_at` · `overall_score` numeric(5,2) (CHECK 0 to 100) · `recommendation` (CHECK advance/hold/not_recommended or null) · `report` jsonb · `ai_disclaimer` (CHECK true) · `created_by_id` FK **SET NULL** · `evaluation_attempts`, `next_evaluation_at`, `evaluation_claimed_at`. **Partial unique index** `interview_one_open_per_application_kind` on (application, kind) where status is invited, in_progress or interrupted. Indexes: (application, kind, -invited_at), (status, expires_at), (status, last_activity_at), (next_evaluation_at). |
| `interviews_interviewturn` | `id` uuid · `session_id` FK **CASCADE** · `index` (CHECK >= 1, **unique** with session) · `question_text` · `question_meta` jsonb (topic, competency, difficulty, is_follow_up, from_bank, bank_id) · `asked_at` · `answer_text`, `answer_source` (CHECK typed/voice/blank), `answered_at` (CHECK: all three set together or all empty) · `evaluation` jsonb · `score` numeric(4,2) (CHECK 0 to 10). |
| `interviews_interviewquestionbank` | `kind` (CHECK) · `role_category` (blank = general) · `skills` jsonb · `competency` · `text` · `difficulty` (CHECK easy/medium/hard) · `is_active` · **unique** (kind, text). Seeded: 18 general screening, 12 role-specific screening, 20 technical, 16 general and 3 role-specific mock questions. |

### Other tables
- `token_blacklist_*` (SimpleJWT): outstanding and blacklisted refresh tokens.
- `django_cache` — production only, created by `manage.py createcachetable`; holds throttle counters.
- Django built-ins (`auth_*`, `django_admin_log`, `django_content_type`, `django_session`, `django_migrations`).

## Planned (Doc, not yet migrated)

