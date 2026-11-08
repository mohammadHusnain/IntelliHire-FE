# Phase 5 · Module 2 — company management and platform-admin approval

Scope: company sign-up follow-up (verify → approval → rejection → re-submission), the company workspace
(dashboard, profile and logo, team, staff invitations) and the platform admin's company review.
Jobs, candidates, communities and interviews (Modules 3+) are still on demo data.

Backend changes made for this module (owner-approved, backend decisions D-075 to D-077): `approve` also overturns a
rejection, a deactivated member cannot log in or refresh a token (`member_deactivated`), and the company profile returns
`created_at`.

## Run it

Same as Module 1 (`docs/PHASE5_MODULE1.md`). Extra commands:

```bash
npm run test:run          # 411 unit/integration tests (MSW, no backend)
npm run e2e:module2       # real browser against the real backend (23 steps; needs a fresh throwaway database)
npm run e2e:routes        # every screen of every role in the real build: no crash, blank page or console error
```

`VITE_USE_MOCK_API=true` still gives the old demo for every page (developer use only). A real build contains no
seeded demo data from any module: demo accounts, credentials, companies, job listings and communities are removed at
build time (literal env checks), and the screens of modules that are not connected yet start empty. Checked by grep after
each build (no demo names, e-mails or passwords).

## How it is wired

- `src/api/companyApi.js`, `platformCompaniesApi.js`, `invitationsApi.js` — thin wrappers over the shared client.
- `src/lib/companyMap.js` — the one place for Module 2 mapping: backend `approved` ↔ UI "active", member roles
  (`admin | hr_manager | recruiter | viewer`), company sizes, field names, limits (logo 2 MB JPG/PNG, reason ≥ 10).
- `src/hooks/useRemote.js` — loads data, cancels the previous request when its inputs change, keeps the last good data while refreshing.
- Pages with a demo and a real version are chosen in `App.jsx` by a literal env check, so the build drops the other one:
  `CompanyDashboard(Live)`, `CompanyTeam(Live)`, `AdminDashboard(Live)`, `AdminCompanies(Live)`.
  `CompanySettings` and `CompanyOnboarding` branch inside the page.
- `CompanyGate` loads the company profile before any company page and shows `CompanyBlocked` on a 403.
  The 403 does not say why, so the blocked screen re-reads `/auth/me/` to tell "company suspended / pending /
  rejected" from "your own access was turned off".
- New public pages: `/accept-invite` (token read once, removed from the URL) and `/resubmit-company`.
  The login screen shows the server's message for pending approval and rejection, with a resubmit link for rejection.

## Decisions (agreed with the owner)

- A company that is pending or rejected gets no tokens (backend rule kept). `/company/pending` stays for the demo build only.
- Dashboard: every block comes from `GET /company/dashboard/`; anything it does not provide is an empty state. Rows are not links
  (role and candidate pages are not connected yet).
- Admin tab counts: one request per status (`page_size=1`). The industry filter is dropped in the real build; search stays.
- Admin dashboard blocks without a backend source (activity charts, interviews, scores, communities, join requests, audit log) say "Not connected yet".
- Company settings: notifications and data export tabs are hidden in the real build.
- A rejection can be overturned: the admin's "Approve" on a rejected company approves it (D-075). A company can still correct and re-submit.
- A deactivated member cannot log in (403) or refresh a token (401), both `member_deactivated`. An open session ends with the notice
  "Your access to this company has been turned off" (D-076).
- "Member since" is the company's registration date from the profile (D-077).
- The admin CSV export contains every company of the current tab and search (fetched page by page, capped at 5,000 with a warning), with a BOM for Excel,
  formula-injection protection and phone numbers kept as typed.
- An admin can edit any member's job title, including their own.

## Backend behaviour worth knowing

- Only a company `admin` member can edit the profile, change members or manage invitations. `hr_manager`, `recruiter`
  and `viewer` read the profile and the member list. The UI hides what the server would refuse, and never asks for
  invitations as a non-admin (that request would be a 403 and look like a block).
- There is no way to remove a member, only to deactivate them (and reactivate later).
- `cannot_modify_self` stops an admin changing their own role or active flag. As a consequence the `last_admin` guard can only be
  reached by two admins acting on each other at the same moment. It is a race guard; `e2e:module2` fires those requests
  concurrently against the real backend and asserts that exactly one wins and one active admin always remains. The UI shows the server's message if it ever happens.
- Users of a *suspended company* can still log in so that they see why (the blocked screen).

## Known limits

- The company logo URL is whatever the backend returns (dev proxy in development; a storage/CDN decision belongs with deployment).
- `/company/pending` is unreachable with the real API (nobody can log in while pending); it exists for the demo build.
- Jobs, candidates, communities and interviews are not connected yet (Modules 3+): those screens start empty in a real build.
  Roles created on the demo job pages are local to the browser and do not feed the real dashboard counts.
- The e2e scripts need a fresh throwaway database (they count companies for the pagination and export checks).

## Manual checklist (Windows, real backend)

1. Register a company → open the verification link from the backend console → log in: you see the approval message.
2. Log in as the platform admin → Companies → Pending → Approve. Reject a second company with a reason (10+ characters).
3. Log in as the rejected company: message and a "submit again" link; correct the name; admin approves; it can log in.
4. Company admin: Settings → change location, upload a logo, reload (both stay). Enter a bad phone number: error under the field.
5. Team: invite someone, open the link from the console, set a password, log in as them: team and settings are read-only.
6. Admin: change their role, deactivate them (their open tab shows "You no longer have access"), reactivate.
7. Admin: suspend the company (reason): the company's open tab shows the suspended screen; reactivate and press "Check again".
8. Admin: Rejected tab → Approve a rejected company (the dialog says it overturns the rejection); it can then log in.
9. Team: edit a member's job title (pencil icon). Deactivate a member: they can no longer log in (message shown); reactivate and they can.
10. Admin → Companies → Export CSV: opens in Excel with the phone numbers as typed; it contains every company of the tab, not only one page.
11. Company settings → Security: "Member since" shows the registration date.
