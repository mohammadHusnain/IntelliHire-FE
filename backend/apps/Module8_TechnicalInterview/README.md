# Module 8 — AI technical interview

Django app label `technical_interview` · Phase 2 guide, Module 8 · No tables and no routes of its own: it plugs the technical interview's rules into the Module 7 engine.

| Area | Where |
|---|---|
| The technical rules: invite gate and override, seniority, follow-up rule, typed-only, outage policy, report shape | `rules.py` |
| Registering the rules with the engine | `apps.py` (`kinds.register`) |
| The automatic invitation after a screening `advance` | `receivers.py` |
| Tests (55) | `tests/` (they reuse Module 7's fixtures) |

Rules worth knowing
- **The engine asks, it never branches.** `Module7_Interviews/services/kinds.py` holds the per-kind rules; screening's live there, technical's are here. A new kind is one registered class.
- **The follow-up rule is code.** Score under 4, fewer than 2 follow-ups, one per question, never a follow-up of a follow-up; it cannot fire until a scoring hook is connected.
- **A down question service is not hidden.** Technical interviews return 503 with `Retry-After: 120`, interrupt after 2 minutes and log `ai.provider_failure`; the candidate resumes from the same link. Blocked or invalid output still uses the bank.
- **Humans decide.** No pass rule: the score is a percentage that Module 9 combines; the recommendation stays empty.

After merge (needs real hooks): follow-up quality, difficulty actually matching the seniority band, the prompt-injection case, report quality.

Contracts: `documentation/API_CONTRACTS.md` (Module 8). Decisions: D-118-D-123.

Run only this module's tests: `python -m pytest apps/Module8_TechnicalInterview`
