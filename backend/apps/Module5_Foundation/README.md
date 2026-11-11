# Module 5 — AI and notifications foundation

Django app label `foundation` · Phase 2 guide, Module 5 · API under `/api/notifications/`.

| Area | Where |
|---|---|
| Models: `Notification`, `OutboundEmail`, `ActivityEvent`, `AIRequestLog`, `PromptTemplate`, `AISettings`, `SystemAlert` | `models.py`, `migrations/` |
| Notifications (create, bulk create) and their API | `notifications.py`, `views.py`, `serializers.py`, `urls.py` |
| Durable email: queue, deliver, retry, sweep, purge | `outbox.py` (called through `apps/common/mail.py`) |
| Audit trail | `events.py` (`log_event`, `log_events_bulk`) |
| AI wrapper, providers, config, prompts, errors | `ai/` (`llm.py`, `prompts.py`, `config.py`, `errors.py`, `vectors.py`, `providers/`) |
| PII removal before scoring | `redact.py` |
| Alerts and the worker heartbeat | `alerts.py`, `management/commands/check_alerts.py` |
| Scheduled and background tasks | `tasks.py`, `locks.py`, `config/celery.py`, `CELERY_BEAT_SCHEDULE` in settings |
| Tests (294) | `tests/` |

Rules worth knowing
- **Eager locally.** `CELERY_TASK_ALWAYS_EAGER=true` (the local default) runs tasks inline, so no Redis is needed to develop. Production needs `CELERY_BROKER_URL`, a worker and beat, and refuses to start otherwise.
- **Production start-up checks:** eager mode off, `AI_PROVIDER=openai`, `OPENAI_API_KEY` set. The `fake` provider is for development and tests only.
- **Emails never fail a request.** A row is stored first; a dead broker or SMTP server only delays it. Mark emails that carry a credential link `sensitive=True`.
- **Audit events** are written by services, not views, with ids and codes only (no names, emails or free text). They never block the action they describe.
- **AI calls** go only through `ai/llm.py`. Do not hold a long database transaction around them (a rollback would also remove the log row). Candidate text goes into prompts through `wrap_untrusted`.
- **Tests use the fake provider.** `FakeProvider.queue_chat(...)` scripts replies or errors; `FakeProvider.calls` records what was sent.

Run in production (example)
```
celery -A config worker -l info
celery -A config beat -l info
python manage.py check_alerts      # from cron every 5 minutes (detects a dead worker)
```

Contracts: `documentation/API_CONTRACTS.md` (Module 5). Decisions: D-081–D-091.

Run only this module's tests: `python -m pytest apps/Module5_Foundation`
