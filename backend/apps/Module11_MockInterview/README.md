# Module 11 — Mock interview

Django app label `mock_interview` · Phase 2 guide, Module 11 · API under `/api/mock-interviews/…`. Data model and every rule that is not an LLM call; the LLM code arrives through the Module 7 hooks.

| Area | Where |
|---|---|
| Models: `InterviewRole` (catalog), `MockInterviewSession` (extension of a Module 7 session) | `models.py`, `migrations/` (`0002` seeds the roles) |
| Creating, ending, retrying, deleting | `services/sessions.py` |
| The caller's own sessions, the detail, the derived feedback state | `services/history.py` |
| Progress and trend | `services/progress.py` |
| The mock rules for the engine | `rules.py`, registered in `apps.py` |
| API | `views.py`, `serializers.py`, `urls.py` |
| Tests | `tests/` |

Rules worth knowing
- **Running is the engine, unchanged.** Start, answer, resume, idle and the feedback task are Module 7's; this module only wraps them in JWT endpoints scoped to the caller.
- **One at a time, five a day.** A partial unique index and a row lock make the limit exact; a deleted session still counts so deleting cannot reset it.
- **Delete means delete.** The transcript, feedback and CV excerpt go; only an empty hidden shell stays.
- **Numbers from code.** Scores, rubric averages, progress and the trend are computed in code; the model only writes the feedback words.

After merge (needs real hooks): feedback quality, question relevance for each role, transcription, the prompt-injection case.

Contracts: `documentation/API_CONTRACTS.md` (Module 11). Decisions: D-138-D-144.

Run only this module's tests: `python -m pytest apps/Module11_MockInterview`
