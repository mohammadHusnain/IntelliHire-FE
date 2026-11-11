# Module 6 — CV analysis and shortlisting

Django app label `cv_analysis` · Phase 2 guide, Module 6 · API under `/api/jobs/<id>/…` and `/api/applications/<id>/cv-analysis/`.

| Area | Where |
|---|---|
| Models: `JobScreeningConfig`, `CVAnalysis`, `CVMatch` | `models.py`, `migrations/` |
| Every score, in plain code | `services/scoring.py` |
| Read, score, move, retry, sweep, notify | `services/pipeline.py` |
| Threshold shortlisting (one locked batch) | `services/shortlist.py` |
| Runs, progress, ranking | `services/screening.py` |
| Per-job settings and the cached job embedding | `services/config.py` |
| The two prompt templates (seeded by `0002_seed_prompts`) | `prompts.py` |
| FR-40 labels | `labels.py` |
| Queue on submission | `receivers.py` (listens to Module 4's `application_submitted`) |
| Tasks | `tasks.py` (`analyse_cv`, `rescore_job`, `sweep`) |
| API | `views.py`, `serializers.py`, `jobs_urls.py`, `urls.py`, `permissions.py` |
| Tests (184) | `tests/` |

Rules worth knowing
- **The model never scores.** It reads the CV into fields and, separately, words an explanation. All numbers come from `scoring.py`, so they are reproducible and a CV cannot talk its way to a higher score.
- **Fairness.** Name, email, phone and profile links are removed before the model sees the CV; the semantic comparison uses skills and work, never institutions or employers.
- **Humans decide.** Automatic moves: submitted to under_review, and to shortlisted only if the job's `auto_shortlist` is on. Always through `set_status_if`, so a person's decision is never overwritten. Nobody is rejected automatically.
- **Durable.** The queued row is the source of truth; the worker claims it; the sweep (every 5 minutes) re-queues due or stuck rows.
- **Cost.** `CV_ANALYSIS_DAILY_LIMIT` per company per day (default 500); suspended companies cost nothing.
- **Before real use:** run real CVs through the real provider, tune the prompts, and calibrate `CV_SEMANTIC_LOW` / `CV_SEMANTIC_HIGH`.

Contracts: `documentation/API_CONTRACTS.md` (Module 6). Decisions: D-092–D-103.

Run only this module's tests: `python -m pytest apps/Module6_CVAnalysis`
