# Module 7 — Interview engine and AI screening interview

Django app label `interviews` · Phase 2 guide, Module 7 · API under `/api/public/interviews/<token>/…`, `/api/interviews/<id>/…`, `/api/applications/<id>/interviews/` and `/api/jobs/<id>/interviews/`.

| Area | Where |
|---|---|
| Models: `InterviewSession`, `InterviewTurn`, `InterviewQuestionBank` | `models.py`, `migrations/` |
| The four hook functions (two connected, two deliberately not) | `ai_hooks.py` |
| The scoring and report prompts, seeded by migration `0006` | `prompts.py` |
| The live spoken call: socket, Gemini relay, system prompt, transcript | `live/` (`consumer.py`, `gemini.py`, `prompts.py`, `transcript.py`, `session.py`, `routing.py`) |
| Validation, retry, bank fallback, logging of every hook call | `runner.py`, schemas in `rubrics.py` |
| Open, start, answer, finish early, resume | `services/engine.py` |
| Invite (checks, snapshot, link, email, status move) | `services/invite.py`, `services/context.py`, `services/links.py` |
| Resend, extend, cancel, evaluate again | `services/actions.py` |
| Evaluation, score arithmetic, recommendation guard | `services/evaluation.py`, `services/scoring.py` |
| Idle and expiry | `services/lifecycle.py` |
| Per-kind rules the engine asks (Module 8 registers technical's) | `services/kinds.py` |
| Question bank picker and the seed | `services/bank.py`, `seed_data.py`, `migrations/0002_seed_question_bank.py` |
| HR notifications and the invitation email | `services/notices.py` |
| Automatic invitation on shortlisting | `receivers.py` (listens to Module 4's `application_shortlisted`) |
| Tasks | `tasks.py` (`evaluate_session`, `sweep` every 5 minutes) |
| API | `views.py` (company), `public_views.py` (candidate), `serializers.py`, `*urls.py`, `permissions.py`, `throttles.py` |

How an interview runs
- **Screening and technical are live spoken calls.** The candidate's browser opens `ws/interviews/live/`, sends the invite token in the first frame and then streams microphone audio; `live/consumer.py` relays it to the Gemini Live API, which conducts the conversation and transcribes both sides. The public `start` and `answer` endpoints answer `409 use_live_channel` for these kinds. The call ends on the timer, on the candidate stopping, or on a disconnect, and `live/session.py: finish_live` stores the transcript as ordinary `InterviewTurn` rows (`answer_source="voice"`) and queues the existing evaluation. Everything after that — scoring, the recommendation, Module 8's automatic technical invitation, Module 9's ranking — is unchanged.
- **Module 11's practice interviews still use the typed engine** and the question bank, which is why `next_question` keeps its bank default and `MockRules.live` stays false.

Rules worth knowing
- **One door to a provider, and one documented exception.** `evaluate_answer` and `evaluate_session` go through `ai.llm.generate_json`, which fills a seeded template, validates the reply against its schema, retries, falls back and logs. The exception is `live/gemini.py`: a bidirectional audio stream cannot pass through `generate_json`, so it is the only file in the module that imports an AI SDK, and it writes its own `AIRequestLog` row (`related_type="interview_session"`) so usage and failures still appear in Module 13's AI report. `apps/Module7_Interviews/tests/test_models.py` holds that line: the SDK import and the prompt wording each live in exactly one file.
- **`transcribe` stays unconnected.** A live call needs it not at all — Gemini transcribes as it goes — and the typed voice path is closed for the live kinds.
- **Code calculates, the hook writes.** Scores, averages, the overall score and the recommendation are computed in `scoring.py`; whatever a hook returns beyond words is ignored. Out-of-range scores are rejected, never clamped.
- **The answer is saved first.** Hooks are called after the answer is stored and never inside a row lock, so a slow or failing hook cannot lose an answer or block a second tab.
- **The link is a password.** Only its hash is stored, it appears only in the invitation email, and it is masked in log lines.
- **Humans decide.** An evaluation never moves the application and the candidate is told nothing.

Not covered by tests (needs a real key and a real microphone): the spoken call end to end — interviewer audio out, barge-in stopping playback, the timer ending the call — and scoring consistency across many real answers. Candidate speech is fenced with `wrap_untrusted` before it reaches the model, and `tests/test_hooks.py` proves the fence cannot be closed from inside, but how a real model behaves under a determined injection attempt is worth watching.

Contracts: `documentation/API_CONTRACTS.md` (Module 7). Decisions: D-104-D-117.

Run only this module's tests: `python -m pytest apps/Module7_Interviews`
