# Module 13 — Platform admin panel

Django app label `platform_admin` · Phase 2 guide, Module 13 · API under `/api/platform-admin/…`, plus `/api/reports/` and `/api/public/report-job/`.

| Area | Where |
|---|---|
| Models: `ModerationFlag`, `BackupRecord` | `models.py`, `migrations/` |
| Dashboard, system health, AI usage | `services/metrics.py` |
| User, company, job, community detail; the activity log and its CSV | `services/details.py` |
| Flags, review, resolve (actions reuse each object's own service) | `services/moderation.py` |
| AI settings and prompt versions | `services/ai_admin.py` |
| API | `views.py`, `serializers.py`, `urls.py`, `report_urls.py`, `public_urls.py` |
| Backup record command | `management/commands/record_backup.py` |
| Tests | `tests/` |

Rules worth knowing
- **Read everything, change little.** Only platform-level things are writable; a platform admin still cannot edit a company's jobs, applications or interviews.
- **One action path.** Resolving a flag calls the same service a company user would, with the admin as actor.
- **The log is append-only** and can only be read or exported.
- **Keys never appear here.** AI settings hold models and limits; credentials stay in the environment.

Contracts: `documentation/API_CONTRACTS.md` (Module 13). Decisions: D-151-D-157.

Run only this module's tests: `python -m pytest apps/Module13_PlatformAdmin`
