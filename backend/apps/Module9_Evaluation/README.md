# Module 9 — Evaluation and HR review

Django app label `evaluation` · Phase 2 guide, Module 9 · API under `/api/jobs/<id>/evaluation-weights|evaluations/…` and `/api/applications/<id>/evaluation|decision|decisions/…`.

| Area | Where |
|---|---|
| Models: `EvaluationWeights`, `CandidateEvaluation`, `HRDecision` (append-only) | `models.py`, `migrations/` (`0002` adds the trigger, `0003` seeds the prompt) |
| The composite score and the recommendation band, in plain code | `services/composite.py` |
| Reading the stage scores, keeping the evaluation up to date | `services/scores.py` |
| Weights (defaults, validation, recompute) | `services/weights.py`, `services/recompute.py` |
| The AI-assisted report (facts, guard, durability, sweep) | `services/report.py`, `prompts.py` |
| Decisions, the candidate email | `services/decision.py`, `services/emails.py` |
| Ranking and compare | `services/ranking.py` |
| The PDF | `services/pdf.py` (reportlab) |
| When the evaluation updates itself | `receivers.py` (interview evaluated, CV scored) |
| Tasks | `tasks.py` (`generate_report`, `recompute_job`, `sweep` every 5 minutes) |
| API | `views.py`, `serializers.py`, `jobs_urls.py`, `urls.py`, `permissions.py` |
| Tests (152) | `tests/` |

Rules worth knowing
- **Code calculates, the model writes.** Every score and the composite come from `composite.py`; the model only writes words and may be at most one band more cautious than the composite's band, never more optimistic.
- **The model never sees who the candidate is.** Its input is scores, skills and redacted short texts: no name, email, phone or reference.
- **Decisions are permanent.** A database trigger refuses to change or delete a row in `evaluation_hrdecision`; the newest row is current; overriding the AI is recorded.
- **Durable.** The evaluation row is the source of truth; a claim makes duplicate workers harmless; the sweep re-queues stuck, failed or due reports; a dead broker only delays them.
- **The old status endpoint still works** for selected, rejected and on_hold but goes through the decision service and never emails.

Before real use: run real stage data through the real provider and tune the `evaluation_report` prompt.

Contracts: `documentation/API_CONTRACTS.md` (Module 9). Decisions: D-124-D-130.

Run only this module's tests: `python -m pytest apps/Module9_Evaluation`
