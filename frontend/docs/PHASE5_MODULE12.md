# Phase 5 · Module 12 — talent communities

Scope: the company workspace (create, edit, archive, remove; members; join requests; invitations with
candidate search; posts and who showed interest) and the candidate side (discovery with eligibility,
asking to join, invitations, my communities, the member-only feed, showing interest), plus the
"let companies find me" switch on candidate settings.

All 24 endpoints are consumed. Nothing on these screens is invented.

## Run it

Same as Modules 1–4 (`docs/PHASE5_MODULE1.md`).

```bash
npx vitest run src/lib/communityMap.test.js src/api/communitiesApi.test.js src/pages/company/CompanyCommunityLive.test.jsx src/pages/candidate/CandidateCommunitiesLive.test.jsx --testTimeout=20000
```

There is no `e2e:module12`. Backend coverage lives in
`backend/integration_tests/test_communities_admin.py` (TC-42, TC-43, isolation, database invariants).

## How it is wired

- `src/api/communitiesApi.js` — the 14 company routes. `remove` and `removeMember` send their reason in
  the **body of a DELETE**, which is what the server reads.
- `src/api/candidateCommunitiesApi.js` — the 10 candidate routes.
- `src/lib/communityMap.js` — the one place for the nine enums, the nested `filters` object ↔ form
  mapping, the limits, `safeUrl`, and `canManageCommunities` (admin + HR manager, mirroring
  `CanManage` in `Module12_Communities/views.py`).
- `src/components/community/communityParts.jsx` — the shared renderers (filter chips, eligibility note,
  candidate summary, post card), so the company and candidate screens cannot drift apart.
- `CompanyCommunityLive.jsx`, `CandidateCommunitiesLive.jsx`, chosen in `App.jsx` by a literal
  `VITE_USE_MOCK_API` check so a real build contains no demo version.
- `CandidateSettings.jsx` → Privacy, and `profileApi.mapProfile` now carries `discoverable`.

## Decisions

- **The backend contract wins.** The company list takes **no filters** (the server returns every
  non-removed community), so no search box is offered there; discovery does take `q` and `company`.
- **Category and tags are gone.** The `Community` model has no such fields. A community's real axes are
  its join mode, its mission and its five filters, and those are what the screens show.
- **An ineligible join is an answer, not an error.** The server stores it `auto_rejected` and returns
  **200**; the drawer shows the requirements and a link to the profile. Only 201 means a request is waiting.
- `invite_only` is worded "Invitation only (hidden from discovery)" and `request` as "Anyone eligible may
  ask to join" — there is no "open to everyone" mode.
- An empty filter set is stated in words: "Open to every candidate — no requirements."
- Removing a community or a member requires a reason (the dialog asks for at least 10 characters, which is
  stricter than the server's "not blank"), and the remove dialog says nothing is deleted.
- Candidate search says outright that contact details and the CV are never shown.
- The three comma-separated filter inputs keep the **raw text** the user typed and are parsed on save, so a
  comma is never swallowed mid-word.

## Behaviour worth knowing

- Roles mirror the server: every company user reads communities, members, posts and responses; only admin
  and HR manager create, edit, archive, remove, invite, review requests, remove members and post. A viewer
  sees no Requests or Invitations tab at all.
- Errors shown with the server's own words: 409 already a member or waiting · 404 invite-only without an
  invitation, and 404 for a non-member asking for a feed or a post · 410 an expired invitation ·
  400 rejecting without a reason.
- An invited candidate who fails the filters is still invited; the warning the server returns is shown.
- Archive keeps members and posts readable and closes new joins; remove closes everything and emails
  members once.
- Editing the filters never removes an existing member, and the edit screen says so.
- A community post carries a "Report this post" link (Module 13's `POST /api/reports/`).

## Known limits

- `GET /company/communities/<id>/` and `PATCH .../posts/<post_id>/` are in the client but not yet surfaced:
  the list row already carries everything the detail returns, and a post is archived or deleted rather than
  edited. Both are one call away when a screen needs them.
- Staff search and `skill_match` ordering are done in Python by the server over at most 500 and 2000 rows.
- The post notification is one email per member with no per-member opt-out beyond the Module 5 preference.
- The four older privacy toggles on candidate settings have no backend and are hidden in a real build;
  `discoverable` is the only one the server stores, and it is off until turned on.

## Manual checklist (real backend)

1. As an HR manager, create a community with an institution and a skill filter; check it appears in the list.
2. As a candidate who does not match, open Discover: the reasons appear; press Ask to join and read the
   requirements rather than an error.
3. As a matching candidate, ask to join; approve the request as staff; the member count goes up by one.
4. Invite a candidate who fails the filters: the warning shows and the invitation still sends.
5. Accept the invitation as that candidate, open the feed, show interest; check the response as staff.
6. Leave the community; remove a member with a reason; the count stays right both times.
7. Archive the community (still readable, no new joins), then remove it with a reason: discovery drops it
   and the feed 404s.
8. Sign in as a viewer and as a recruiter: neither sees a control the server would refuse.
9. Candidate settings → Privacy: turn "let companies find me" off and confirm staff search no longer finds you.
