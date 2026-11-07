# Module 3 — Job posting and application form

Django app label `jobs` · Doc §3 · API under `/api/jobs/` (HR side) and `/api/public/jobs/<form_slug>/` (public).

| Area | Where |
|---|---|
| Models: `JobPosting`, `ApplicationField` | `models.py`, `migrations/` |
| The fixed first part of every form (single definition, reused by Module 4) | `builtin_fields.py` |
| Rules, no HTTP | `services/` — `lifecycle` (create, edit, publish, close, reopen, delete, duplicate, auto-close), `fields` (custom fields, keys, locking, reorder), `form` (the form-schema builder), `rules` (publish/deadline/field validation), `queries` (company-scoped lookups, locking), `applications_link` (the only place that looks at Module 4) |
| Validation and response shapes | `serializers/` |
| Thin views | `views/` (`jobs`, `fields`, `public`) · `permissions.py` (who may edit/manage) · `filters.py` |
| URLs | `urls.py` (`/api/jobs/`), `public_urls.py` (`/api/public/jobs/`) |
| Scheduled job | `management/commands/close_expired_jobs.py` |
| Tests (316) | `tests/` — models, create, list/detail, edit, lifecycle, custom fields, form schema, isolation, concurrency |

Rules worth knowing
- A job is `draft` → `open` (publish gives a permanent slug) → `closed` (manual or deadline); reopen keeps the slug. Only drafts are deleted.
- `is_accepting_applications` (open, deadline in the future, company approved) is what every public check must use; a job is effectively closed the moment its deadline passes, before the command runs.
- Company, status, slug and creator are never taken from a request body.
- Applications come from Module 4. `services/applications_link.py` is the only place that reads them: `applications_count` is the real count and, once a job has an application, the custom-field locks apply.

## Closing expired jobs (every 5 minutes)

```
python manage.py close_expired_jobs
```

Linux/macOS cron:
```
*/5 * * * * cd /path/to/backend && /path/to/.venv/bin/python manage.py close_expired_jobs >> /var/log/intellihire-close-jobs.log 2>&1
```

Windows Task Scheduler (run every 5 minutes): program `C:\path\to\backend\.venv\Scripts\python.exe`, arguments `manage.py close_expired_jobs`, start in `C:\path\to\backend`.

Contracts: `documentation/API_CONTRACTS.md` (Module 3). Decisions: D-048–D-060.

Run only this module's tests: `python -m pytest apps/Module3_JobPosting`
