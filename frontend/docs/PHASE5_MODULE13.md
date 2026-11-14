# Phase 5 · Module 13 — platform admin panel

Scope: the platform dashboard with system health and alerts, the user and company detail views, the
read-only jobs and communities monitors, the moderation queue, the activity log with its CSV export,
AI settings and prompt versions, the AI usage report, and the two reporting forms.

All 27 platform-admin endpoints plus `POST /api/reports/` and `POST /api/public/report-job/` are
consumed. Every figure comes from the server.

## Run it

Same as Modules 1–4 (`docs/PHASE5_MODULE1.md`).

```bash
npx vitest run src/lib/platformMap.test.js src/api/platformAdminApi.test.js src/pages/admin --testTimeout=20000
```

No `e2e:module13`. Backend coverage: `backend/integration_tests/test_communities_admin.py` (TC-46,
moderation acting through the real service, isolation, the activity log's append-only rule and its indexes).

## Screens, in the §13.4 build order

| Route | What it is now |
|---|---|
| `/admin/dashboard` | `GET /dashboard/` for every block, plus `/health/` and `/alerts/` (with acknowledge). The old synthesised counts and "Not connected yet" cards are gone. The Module 2 approval queue stays. |
| `/admin/users` | Phase 1 list, plus `users/<id>/detail/` in the drawer: counts, membership, last sign-in, recent activity, open flags |
| `/admin/companies` | Module 2 review, plus `companies/<id>/onboarding/`: completeness, members by role, jobs by status, staff, open flags |
| `/admin/communities` | **Content monitor**: Jobs and Communities tabs, read-only, each detail offering "Flag for review" |
| `/admin/moderation` | **New.** The queue: filters, mark reviewing, resolve with a required note |
| `/admin/management` | **The activity log**, read-only, with filters and the server's CSV export |
| `/admin/settings` | **AI settings** and prompt versions with rollback |
| `/admin/reports` | **The AI usage report** |

Nav labels changed to match: Communities → Content, Analytics → AI usage, Audit log → Activity log,
Settings → AI settings, plus a new Moderation entry.

## Decisions

- **The backend contract wins.** Four differences from the guide: the user detail is
  `users/<id>/detail/`; the company view is `companies/<id>/onboarding/`; `activity/export/` and
  `activity/<id>/` exist and the guide does not list them; and **`resolve` takes only
  `action: "dismiss" | "act"`** — the server derives the concrete action from the flag's target, so the UI
  names the consequence ("Take action — close this job") and never sends an action name.
- **What the backend cannot supply was removed, not faked.** Gone from the real build: the registration
  toggles, auto-approve companies, the announcement banner, "reset the community catalogue" and the
  platform data export (no server-side settings exist for any of them); and the score distribution,
  average-by-skill, most-practised-roles, interview-type mix and weekly growth charts (the only real
  reports are AI usage and the dashboard's interview counts by kind).
- `AdminCommunities` no longer approves join requests: the platform-admin community endpoints are
  read-only, and approving belongs to company staff.
- The jobs and communities monitors share one Content screen rather than taking two nav entries;
  moderation gets its own screen because resolving a flag is a workflow, not an audit view.
- A psutil reading the server could not take is shown as an em dash, never as 0%.
- API keys are never rendered or sent; the screen says they live in the server's environment.

## Behaviour worth knowing

- Resolving always needs a note; the button is refused without one before any request is sent.
- A flag whose target is gone offers **dismiss only**.
- The activity log offers no edit or delete control anywhere, only filters and the export (the server caps
  the CSV at 5000 rows). Flagging an entry points a flag at the event's target; an entry with no target
  says so instead.
- Reports are deduplicated by the server per reporter and target for 24 hours and throttled hard; a 429 is
  shown with the wait the server names. "Report this job posting" sits on the public apply page (no account
  needed) and "Report this post" on each community post.
- A new prompt version becomes active and must keep every placeholder; the server's refusal lands on the
  field. Rollback is offered on every version except the active one.
- An unknown AI model is shown as a field error on that model's input.
- Acknowledging an alert only hides it until the condition returns, and the toast says so.
- Every route is platform-admin only; the backend tests assert company staff and candidates get 403.

## Known limits

- Health is deliberately simple: one check each, the Module 5 heartbeat, psutil numbers and the last
  backup. The broker check has only ever been exercised against Celery's filesystem transport here, not Redis.
- The activity log's `EXPLAIN` is only meaningful on a seeded table; on a small database PostgreSQL
  reasonably prefers a sequential scan.
- The AI usage feature filter is built from the rows already returned, so a feature with no calls in the
  chosen range cannot be selected.
- The append-only rule on the activity log is enforced in the ORM (queryset and model), not by a database
  trigger: raw SQL is not blocked, and the test says so rather than claiming otherwise.

## Manual checklist (real backend)

1. Open the dashboard: every block has real numbers, and no card says "not connected yet".
2. Stop the worker and reload: the heartbeat check turns Unreachable and the backup warning appears if no
   backup has succeeded in 26 hours.
3. Report a public job from `/apply/<slug>` without signing in, then report the same job again: the server
   returns the existing flag and the UI thanks you either way.
4. Open Moderation: mark the flag reviewing, try to resolve with no note (refused), then dismiss it with one.
5. Flag a community from Content → Communities, then resolve that flag with "Take action": the community is
   removed and the action is recorded against you.
6. Activity log: filter by event type and date, open an entry, flag it, then export the CSV.
7. AI settings: change a model to nonsense (field error), then to an allowed one (saved and logged).
8. Prompts: save a new version that drops a placeholder (refused), then roll back to an earlier version.
9. AI usage: pick a range with no calls and confirm the empty state rather than an error.
