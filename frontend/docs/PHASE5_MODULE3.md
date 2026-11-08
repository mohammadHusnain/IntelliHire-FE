# Phase 5 · Module 3 — job posting and the application form

Scope: roles (draft → open → closed), the application-form builder, publish / close / reopen / duplicate / delete, the share link,
the form preview, the public application page `/apply/:slug` (including the real submission) and who may do what.
Candidate review, the pipeline and communities (Module 4+) are not part of this module.

Backend addition made for this module (owner-approved, D-078): `GET /api/jobs/departments/`.

## Run it

Same as Modules 1 and 2. Extra commands:

```bash
npm run test:run        # 583 unit/integration tests (MSW, no backend)
npm run e2e:module3     # real browser against the real backend (23 steps; needs a fresh throwaway database)
npm run e2e:routes      # every screen of every role in the real build
```

## How it is wired

- `src/api/jobsApi.js`, `jobFieldsApi.js`, `publicJobsApi.js` — thin wrappers over the shared client.
- `src/lib/jobMap.js` — the one place for job mapping: enums and labels, limits, the form <-> request bodies (only changed fields are
  sent on an edit), server errors -> form fields, the deadline's time zone (typed locally, sent as an instant), local checks that
  mirror the server's rules, and who may do what (`canEditJobs`, `canManageJobs`).
- Screens (chosen in `App.jsx` by a literal env check, so a real build contains no demo version):
  `CompanyJobsLive` (list), `CompanyJobFormLive` (new and edit, with `ApplicationFormBuilder`), `CompanyJobPreviewLive`.
- `ApplyPage` (`/apply/:slug`, public) shows the role and the real form and submits it. `JobSummary` and `ApplicationFormFields`
  are shared with the company's preview, so HR sees what candidates see.
- `useJobActions` runs publish / close / reopen / duplicate / delete: one at a time per role, the server's message on a refusal,
  and the screen re-reads the truth after a 409.
- `useOpenJobs` feeds the community share box and the command palette with the real open roles.

## Decisions (agreed with the owner)

- The backend schema wins (D-055). Experience level became "minimum years of experience" (0–30) plus an education level; the free-text
  "requirements" and the hiring-stage editor are gone from the real build (the pipeline is Module 4's seven fixed statuses);
  skills go up to 30 and soft skills were added; department and location are free text.
- Department: text input with the company's existing departments as suggestions, and an exact dropdown on the list (D-078).
- Salary: whole numbers, a currency is required when an amount is given (the server does not require it), `show_salary` toggle.
- The form builder lives on the edit page; a new role is saved as a draft first.
- Status tab counts use one request per status. Search is by title (the server's rule).
- The public page is real, including the submission (Q1 b), so a shared link is never a dead end.
- Applicant counts are plain text; rows are not links into the candidate pages until Module 4 is connected.
- "Closing soon" on the dashboard opens the real role preview. Only people who may create roles are shown "Post a role".

## Behaviour worth knowing

- A role past its deadline stays "open" on the server until the `close_expired_jobs` command runs, but it takes no applications. The UI
  flags it "Deadline passed", makes it read-only and offers Close; then Reopen with a new deadline (two steps, because reopen needs a closed role).
- After the first application: questions cannot be deleted, change type, become required or lose options, and new questions must be
  optional. The builder shows this and the server's messages when it refuses.
- Publishing from the editor saves the edits first and then publishes; if the server refuses the publish the edits are still saved as a draft
  and every problem is shown next to its input.
- The client shows plain messages for 5xx and "too large" answers (`slug_unavailable` keeps its code).

## Known limits

- `close_expired_jobs` is a management command; how it is scheduled is a deployment decision.
- Candidate-side pages, the company's candidate pages and analytics are Module 4: they start empty in a real build.
- The public page links the logo to the home page only.
- The e2e scripts need a fresh throwaway database.

## Manual checklist (Windows, real backend)

1. Roles → Post a role → fill only title and department → Save as draft → you land on the editor and can add questions.
2. Add questions of several types (a choice question needs 2–20 options); reorder with the arrows.
3. Try Publish with things missing: every missing item is listed. Use a deadline of 1 year: the server's message appears.
4. Publish with a deadline 30 days ahead → preview shows the real form and the share link → open the link in a private window.
5. Apply from the private window (CV as PDF). Apply again with the same email: refused on the email field.
6. Back in the editor: the form shows "has 1 application"; delete buttons are gone.
7. Close the role (the public page says so), reopen it with a new deadline (same link), duplicate it, delete the duplicate.
8. Sign in as a recruiter, a viewer and an HR manager (invite them from Team): the buttons match what each may do.
