# Phase 5 · Module 11 — practice (mock) interviews, engine wiring

Scope: the real session engine — role catalog, create, run, end, history, progress, delete — on the four
candidate screens that used a local question bank and local scoring. All 8 endpoints are consumed.
**The LLM-dependent parts are deliberately not done** (see Known limits).

## How it is wired

- `src/api/mockInterviewApi.js` — the 8 routes.
- `src/pages/candidate/MockInterviewLive.jsx` — `Setup`, `Room`, `Report`, `History`, routed in `App.jsx` by a
  literal `VITE_USE_MOCK_API` check, so the demo build keeps its local version and a real build has none of it.
  Routes are unchanged: `/candidate/interview/setup`, `/room?s=<id>`, `/report/:id`, `/reports`.
- The invited-interview room (`/interview/:token`, Module 7) is untouched.

## Behaviour

- One open session at a time and five a day are enforced by the server; a 429 is shown as "reached today's limit".
- A role-specific session needs a role from the catalog; "tailor to my CV" is a flag the server honours
  (personal details are removed before the CV text is used).
- Answers are typed only. `turn_index` makes a repeated submit harmless; a 409 means the question moved on.
- Ending under 3 answers cancels the session and it does not count; otherwise it finishes with partial feedback.
- A finished session opened in the room redirects to its report. An open one has a Resume link in history.
- Delete removes the transcript for good, and the daily limit is not reset by it.
- Progress needs 4 scored sessions for a trend and shows an empty state before that.

## Known limits (left for the LLM step)

- Question quality, answer scoring and the feedback text come from the placeholder hooks. Until real ones are
  merged the server leaves scores empty and says why in `feedback_message`; the report shows exactly that,
  with "Not scored yet", never an invented number.
- Voice: the record button is not shown (`voice_available` is false); the server answers 422 for audio.
- The old demo screens' local scoring, skill radar and per-skill charts have no backend source and are not
  present in the real build.
- No `e2e:module11`; the MSW suite (`MockInterviewLive.test.jsx`) is the check.

## Manual checklist

1. New practice → General → Begin: a question appears. Answer it; the next one follows.
2. Reload mid-session: you land on the same question. History shows it with Resume.
3. End after 1 answer: "cancelled, does not count". Start another, answer 3, end: you reach a report.
4. Report: transcript present, score empty, the server's feedback message shown, retry offered if it failed.
5. Start a role-specific session with and without a role; start a second while one is open.
6. Delete a session from history; it disappears and stays gone.
