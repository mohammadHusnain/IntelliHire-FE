# Phase 5 · Module 2 — company management and platform-admin approval

Scope: company sign-up follow-up (verify → approval → rejection → re-submission), the company workspace
(dashboard, profile and logo, team, staff invitations) and the platform admin's company review.
Jobs, candidates, communities and interviews (Modules 3+) are still on demo data.

No backend change was needed.

## Run it

Same as Module 1 (`docs/PHASE5_MODULE1.md`). Extra commands:

```bash
npm run test:run          # 389 unit/integration tests (MSW, no backend)
npm run e2e:module2       # real browser against the real backend (18 steps)
```

`VITE_USE_MOCK_API=true` still gives the old demo for every page; the real build contains none of the demo
companies, accounts or credentials (checked by grep after each build; the only demo company data left in a real
build is `src/data/jobsStore.js`, the Module 3 job listings).

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
- Admin tab counts: one request per status (`page_size=1`), no backend change. The industry filter is dropped in the real build; search stays.
- Admin dashboard blocks without a backend source (activity charts, interviews, scores, communities, join requests, audit log) say "Not connected yet".
- Company settings: notifications and data export tabs are hidden in the real build.

## Backend behaviour worth knowing

- A deactivated member's next request is refused (403) even with a valid access token, and their refresh tokens are revoked.
  They can still log in; every company page then shows "You no longer have access".
- Only a company `admin` member can edit the profile, change members or manage invitations. `hr_manager`, `recruiter`
  and `viewer` read the profile and the member list. The UI hides what the server would refuse, and never asks for
  invitations as a non-admin (that request would be a 403 and look like a block).
- There is no way to remove a member (only deactivate) and a rejected company cannot be "reactivated" (it re-submits).
- `last_admin` cannot be reached from the UI (an admin cannot change themselves); it is covered by the backend tests.

## Known gaps

- Job title of a member cannot be edited after the invitation (the API supports it; no UI yet).
- The admin company list has no CSV export in the real build (it would export one page only).
- "Member since" is not shown (the profile has no created date).
- The company logo URL is whatever the backend returns (dev proxy in development; storage/CDN decision for production).
- `/company/pending` is unreachable with the real API.
- Jobs created through the Module 3 demo pages do not match the real dashboard counts until Module 3 is connected.

## Manual checklist (Windows, real backend)

1. Register a company → open the verification link from the backend console → log in: you see the approval message.
2. Log in as the platform admin → Companies → Pending → Approve. Reject a second company with a reason (10+ characters).
3. Log in as the rejected company: message and a "submit again" link; correct the name; admin approves; it can log in.
4. Company admin: Settings → change location, upload a logo, reload (both stay). Enter a bad phone number: error under the field.
5. Team: invite someone, open the link from the console, set a password, log in as them: team and settings are read-only.
6. Admin: change their role, deactivate them (their open tab shows "You no longer have access"), reactivate.
7. Admin: suspend the company (reason): the company's open tab shows the suspended screen; reactivate and press "Check again".
