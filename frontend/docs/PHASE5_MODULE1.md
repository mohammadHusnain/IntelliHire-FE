# Phase 5 · Module 1 — frontend ↔ backend integration

Scope: login, sign-up (candidate and company), email verification, forgot/reset/change password,
session handling, candidate profile (photo, CV, education, experience) and the admin users list.
Everything else still runs on demo data (see "Still mocked").

## Run it

```bash
cp .env.example .env.local      # VITE_API_URL=/api, VITE_USE_MOCK_API=false, DEV_API_TARGET=http://127.0.0.1:8000
npm install
npm run dev                     # proxies /api and /media to the Django server
npm run test:run                # 267 unit/integration tests (MSW, no backend needed)
npm run lint && npm run build
npm run e2e                     # real browser against the real backend (see below)
```

`VITE_USE_MOCK_API=true` brings the old in-browser demo back (demo logins are only in that build; a
production build contains none).

## How it is wired

- `src/api/client.js` — one fetch/XHR client: bearer header, single-flight silent refresh (cross-tab lock),
  one retry after a refresh, `ApiError` with `status, code, message, fieldErrors, retryAfterSeconds, isNetwork`.
- `src/api/tokenStorage.js` — tokens only, under one key (`intellihire_session`). The user is rebuilt from `/auth/me/` on every load.
- `src/lib/authMap.js` — backend roles/statuses → UI roles/statuses; validates post-login redirects.
- `src/store/authStore.js` — actions return result objects, never throw. Logout clears local state first, revokes in the background.
- `CandidateGate` loads the server profile before any candidate page renders. The Save button sends only changed fields.

## Backend changes made for this phase (approved)

Optional `target_role, skills, linkedin_url, github_url, resume` on candidate registration, and
`GET /api/platform-admin/users/` (D-073, D-074 in the backend docs).

## Known gaps

- Users: no suspension reason and no delete in the backend, so the UI hides delete and asks for no reason.
- CV: cannot be removed (no endpoint); size/upload time not exposed.
- A company awaiting approval cannot log in (the backend refuses it), so `/company/pending` is unreachable with the real API.
- Unsaved profile edits: only a browser `beforeunload` guard (no in-app route blocker with `BrowserRouter`).
- Avatars/CV links need a storage/CDN decision for production (dev proxies `/media`).
- The contract test (`npm run test:contract`) was not built; the e2e run is the check against the real API.

## Still mocked

Admin: companies, dashboard, communities, reports, management. Company: everything. Candidate: interviews, reports, communities.

## End-to-end run

Needs the backend with the console email backend (its output saved to a file), a platform admin, and `npm run dev`.
Throttles on the test backend must be raised (the run does ~20 sign-ins). Use a throwaway database.

```bash
E2E_BACKEND_LOG=/path/backend.log E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run e2e
```

Last result: 20/20 steps (sign-up with CV, duplicate email, unverified login + resend, verify, login, profile
save/reload, server field error, education/experience, CV download byte-for-byte, bad CV type, unauthenticated
download refused, change password, logout + Back, forgot/reset (link works once), admin suspend ends the open
session, role guard, company sign-up + approval wait, invalid link, zero console errors).

## Manual checklist (Windows, real backend)

1. Start PostgreSQL and the backend (`python manage.py runserver`), then `npm run dev`.
2. Register a candidate with a PDF → open the verification link printed in the backend console → log in.
3. Profile: change headline/phone → Save → refresh (values stay). Enter `abc` as phone → error under the field.
4. Add one education and one experience entry; upload a CV; click View.
5. Settings → Security → change password → you are sent to log in; old password fails, new one works.
6. Log out, press Back: no private page. Log in, then as admin suspend the user: their open tab returns to log in.
7. Register a company: verify email → "waiting for approval"; log in shows the approval message.
