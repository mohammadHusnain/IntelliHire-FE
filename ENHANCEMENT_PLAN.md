# IntelliHire — Enhancement Plan (Admin + Company portals)

Status: Public (5) and Candidate (8) portals are done. This plan covers what remains.
Same standard as before: one shared shell, one source of truth per domain, no fabricated data,
every button does something real, responsive 320–1440px, smooth minimal motion, CSV/PDF exports real.

---

## 0. Shared foundation (finish first)

| Item | Status | Plan |
|---|---|---|
| `AppShell` (sidebar, drawer, top bar, Ctrl K palette, notifications, user menu) | Built | Verify candidate portal still works on it |
| Account status enforcement (`authApi`) | Built | Suspended/rejected can't sign in; pending companies held on `/company/pending` |
| Platform settings store | Built | Sign-up gates, auto-approve companies, announcement banner |
| Audit log store | Built | Every admin action recorded with actor, target, reason, time |
| Community store | To do | Seed from `communitiesData`; admin create/edit/pause/archive; candidate + company read from it |
| Jobs + applicants store | To do | Replace `jobsStore.js` / `candidatesData.js` localStorage helpers with one persisted store shared by company pages and admin analytics |
| `AdminLayout` + `CompanyLayout` | To do | Thin wrappers over `AppShell` with their own nav, palette items, badges |

---

## 1. Admin portal (7 pages)

### 1.1 Dashboard
**Today:** hardcoded KPIs (12,847 users), 3 fake pending companies, approvals change local state only, static "last updated", dead "View full queue".
**Enhanced:**
- Greeting header with live "needs attention" summary (pending companies, pending join requests).
- KPI tiles from real data: total accounts (candidates / companies), interviews completed, average interview score, open jobs, pending approvals. Animated counters, delta vs last 7 days.
- Trend chart: sign-ups and interviews per week (segmented: Sign-ups / Interviews / Scores).
- Approval queue card: pending companies with inline Approve / Reject (reason required), review drawer.
- Review queue: pending community join requests.
- Live audit feed (last 8 actions) linking to the full log.
- Empty states when nothing is pending ("All clear").

### 1.2 Users
**Today:** 3 hardcoded users, fake "create user", Apply-button filters, fake sort, dead bulk/export buttons.
**Enhanced:**
- Table of every real account (demo + registered): avatar, name, email, role, status, joined, last activity.
- Instant search, role filter (Candidate / Company), status filter (Active / Pending / Suspended / Rejected), column sorting.
- Row selection + bulk Suspend / Reactivate (reason required, audited).
- Detail drawer: profile summary; for candidates — interviews, average/best score, memberships; for companies — company details, jobs posted.
- Actions: Suspend, Reactivate, Delete (registered accounts only; demo accounts protected).
- Export filtered list to CSV. Mobile: cards instead of table.
- Remove "Create user" (no real provisioning flow exists).

### 1.3 Companies
**Today:** separate fake list, approve/reject change nothing, dead filters ("Registration range").
**Enhanced:**
- Tabs with counts: Pending · Active · Rejected · Suspended.
- Pending tab first: review cards showing registration details (industry, size, website, description, owner, signed up).
- Approve (company can now sign in fully) / Reject (reason shown to owner on login) / Suspend / Reactivate — all audited, toast names the company.
- Company drawer: details, team owner, jobs posted, applicants received.
- Search + industry filter, CSV export.

### 1.4 Communities
**Today:** 3 fake communities unrelated to the real catalogue; candidate join requests invisible.
**Enhanced:**
- Catalogue table from the shared community store: name, category, privacy, members (incl. real joins), open roles, status.
- Create / Edit modal (name, category, description, tags, open or private), Pause / Archive / Restore.
- Join requests queue: candidates waiting on private communities → Approve / Decline; candidate gets a notification and their membership updates.
- Archived communities disappear for candidates; paused ones stop accepting joins.

### 1.5 Reports (Analytics)
**Today:** CRUD of fake "report documents".
**Enhanced:** real analytics computed from platform data:
- Growth: sign-ups per week by role.
- Interview volume per week, average score trend.
- Score distribution histogram, skill-dimension averages.
- Top practised roles, interview type mix.
- Company approval funnel (registered → approved / rejected), time to decision.
- Date range presets (7 / 30 / 90 days / all). Each dataset exports to CSV; whole page prints to PDF.

### 1.6 Management → Audit log
**Today:** just redirects to Users.
**Enhanced:**
- Timeline of every admin action: who, what, target, reason, when.
- Filters: action type, target type (user / company / community / settings), search, date range.
- Entry drawer with full detail. CSV export.
- Nav label becomes "Audit log".

### 1.7 Settings
**Today:** 2FA, IP allowlist, integrations, feature flags — none do anything.
**Enhanced (only controls that are enforced):**
- Registration: allow candidate sign-ups, allow company sign-ups, auto-approve companies.
- Announcement banner: text, tone, audience (all / candidates / companies), live preview, on/off.
- Admin account card (read-only details, sign out).
- Data tools: export all accounts / audit log (CSV), reset demo data (confirm).
- Auto-save with "Saved" indicator; every change audited.

---

## 2. Company portal (13 pages)

Company pages have not been read in detail yet; plans below are based on page names and the
existing data helpers, and will be confirmed (bugs, fake data) before building each one.

| Page | Enhanced plan |
|---|---|
| **Onboarding** | Step wizard (company details → logo → first role) with progress, saves to the company profile |
| **Pending** | Real "Check status" (re-validates with backend), rejected reason shown, approved → redirect to dashboard |
| **Dashboard** | KPIs from own jobs/applicants (open roles, applicants, in screening, shortlisted), pipeline funnel, recent applicants, jobs needing attention |
| **Jobs** | Job list with status tabs (Open / Draft / Closed), search, applicant counts, quick actions (close, duplicate, preview, share link) |
| **Job create / edit** | Multi-step form (role, skills from role catalogue, experience, custom application fields, hiring stages), autosave draft, validation |
| **Job preview** | Exactly what candidates see, copy shareable link, publish/close |
| **Candidates (per job)** | Kanban pipeline by stage with drag-and-drop, CV match score, filters, bulk move |
| **All candidates** | Searchable table across jobs, stage/score filters, CSV export |
| **Candidate profile** | CV summary, scores per stage (CV, screening, technical), notes, stage history, move stage / reject |
| **Analytics** | Real metrics from own jobs: applicants over time, stage conversion, time to hire, top sources; CSV + PDF |
| **Community** | Communities from the shared store, post roles to joined communities |
| **Team** | Members list, roles; invite flow only if backed by data (otherwise listed as a gap) |
| **Settings** | Company profile, notifications, security (password change), data export |

---

## 3. Order of work

1. Finish foundation (verify candidate on `AppShell`, `AdminLayout`, community store).
2. Admin: Companies → Users → Dashboard → Communities → Settings → Audit log → Reports.
3. Company foundation (`CompanyLayout`, jobs/applicants store), then pages in the table order.
4. Full browser pass: every page at 320 / 375 / 768 / 1024 / 1440px, build + lint clean.

## 4. Known gaps (no backend — will not be faked)
- Real email delivery (invites, approval emails) — shown as in-app notifications only.
- Admin-created user accounts and team invites with passwords.
- Real AI scoring — the in-browser analysis stays labelled as such.
