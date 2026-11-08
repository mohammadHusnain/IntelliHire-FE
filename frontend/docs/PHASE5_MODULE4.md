# Phase 5 · Module 4 — candidates, review and the pipeline

Scope: the candidates of a role and of the whole company, a candidate's profile, status changes with notes and history,
free team notes, CV and file downloads, the CSV export, and the counts that appear everywhere (sidebar badge, dashboard, analytics).
Communities, the AI interview and scoring screens and the candidate-side area are not part of this module.

Backend additions made for this module (owner-approved): free notes on applications (D-079, `GET/POST /api/applications/<id>/notes/`,
also returned in the detail) and the application `id` on the dashboard's recent applications (D-080).

## Run it

Same as Modules 1-3. Extra commands:

```bash
npm run test:run        # 680 unit/integration tests (MSW, no backend)
npm run e2e:module4     # real browser against the real backend (22 steps; needs a fresh throwaway database)
npm run e2e:routes      # every screen of every role in the real build
```

## How it is wired

- `src/api/applicationsApi.js` — lists (a role's list carries the server's `status_counts`; the company-wide list does not, so counts there are one
  count-only request per status), detail, status change (returns the whole application), notes, authenticated downloads and the server's CSV.
- `src/lib/applicationMap.js` — the seven statuses and their labels, limits, orderings, `dateParam`, `safeUrl` (answers become links only for http/https)
  and `cleanFileName` (a downloaded name never carries a path).
- Screens (chosen in `App.jsx` by a literal env check, so a real build contains no demo version):
  `CompanyApplicantsLive` (one page for `/company/candidates` and `/company/jobs/:id/candidates`: board and list),
  `CompanyApplicantLive` (the profile), `CompanyAnalyticsLive`.
- `StatusDialog`, `AnswerValue` (one renderer per answer type), `lib/download.js` (save a blob; open a PDF in a tab that the click itself opened).
- `useReviewCount` feeds the sidebar badge (a count-only request, repeated when the page changes; a failure shows no badge).

## Decisions (agreed with the owner)

- The backend contract wins: the seven backend statuses replace the five demo stages. CV match, screening and technical scores, "source",
  "years of experience", the interview-answers card and "best match" sorting are gone from the real build — no data exists for them and nothing is faked.
- Tabs are one per status (the server filters on one status at a time; there is no "in play" filter).
- Board: one column per status, each fed by its own request (10 first, then "Show more" up to 100; beyond that the list view).
- Status changes are one request per application. "Change status…" on a selection runs one request each, reports "N moved, M not", and re-reads the lists.
- Notes: free team notes (D-079) are separate from the note on a status change; neither notifies the candidate (the dialog says so).
- Export: the server's CSV of one role (the whole role, whatever is filtered on screen); there is none for the whole company.
- "View CV" opens a PDF from an authenticated blob in a new tab (a DOCX is downloaded). A bare API address is never linked.
- Analytics shows only what the backend counts: volume, pipeline by status, applications per role. Trends, sources and match scores say nothing until they exist.

## Behaviour worth knowing

- Selecting rows is cleared when the page changes, so a bulk move never spans pages (and never exceeds the safety limit of 50).
- A note typed while another is still being saved is not wiped when the save finishes.
- Date filters are calendar dates compared by the server (UTC); a reversed range is flagged.
- Viewers read everything (including notes) and have no controls; the server refuses them too.
- The sidebar badge counts applications still at "Applied" across the company.

## Known limits

- The company-wide list has no status counts from the server (hence one count request per status).
- No candidate-side "my applications" screen: the backend has no endpoint for it.
- Candidates are not emailed when their status changes (backend Phase 1 behaviour).
- The e2e scripts need a fresh throwaway database.

## Manual checklist (Windows, real backend)

1. Publish a role, apply to it a few times from a private window (one with a file question), then open Roles → "N applications".
2. Board: columns and counts. List: tabs, search by name / reference / email, education and date filters, ordering, pages.
3. Open a candidate: answers, "View CV" (PDF opens in a tab), Download, the portfolio file.
4. Change status with a note; check the history. Reject, then move back. Add two notes: newest first.
5. List view: select three candidates → Change status… → they move, the counts update.
6. Export CSV from a role: opens in Excel with a column per question.
7. Sign in as a viewer: you can read but there are no buttons. Sidebar badge = applications still at "Applied".
