# INTELLI-HIRE — SCREENS 10–22 REFINED DESIGN SPECIFICATION
## Design System: Premium White · Black · Orange SaaS UI

---

## GLOBAL DESIGN TOKENS (Reference for All Screens)

```
Accent Orange:       #F04E23   (CTAs, active states, focus rings, accent words)
Orange Hover:        #D43D14
Orange Light Tint:   #FFF4F1   (hover backgrounds, active nav fills)
Orange Muted:        #FCA68A   (decorative, disabled)

Black / Charcoal:    #0D0D0D   (headings)
Text Primary:        #0D0D0D
Text Secondary:      #374151   (body, labels)
Text Muted:          #9CA3AF   (captions, placeholders)

Page Background:     #FFFFFF   (pure white everywhere — no off-whites)
Card Background:     #FFFFFF
Sidebar Background:  #FFFFFF
Row Hover:           #FAFAFA

Border Default:      #E5E7EB
Border Strong:       #D1D5DB
Border Focus:        #F04E23   (orange focus ring)

Success:             #059669   bg #F0FDF4
Warning:             #D97706   bg #FFFBEB
Danger:              #DC2626   bg #FEF2F2

Heading Font:        Times New Roman (serif)
UI Font:             Inter (sans-serif)
```

---

## SHARED COMPONENT STANDARDS

**Typography Hierarchy**
- Page titles: Times New Roman 26–30px, weight 700, color `#0D0D0D`
- Section headings: Times New Roman 20–22px, weight 700
- Card headings: Times New Roman 18px, weight 700
- Body / labels: Inter 14px, color `#374151`
- Captions / meta: Inter 12–13px, color `#9CA3AF`
- Orange italic accent: One or two italic words inside a heading rendered in `#F04E23` — e.g., "Hire *smarter.*"
- Section tags: Inter 11px, weight 600, uppercase, letter-spacing 0.1em, color `#F04E23` with a 6px orange dot prefix

**Buttons**
- **Primary:** `#F04E23` fill, white text, Inter 14px 500, 42px height, 8px radius, hover darkens to `#D43D14`, `scale(0.98)` on click, 150ms ease
- **Secondary:** White fill, `#E5E7EB` border, hover border turns orange, hover text turns orange
- **Ghost:** Transparent, no border, `#374151` text, hover color `#F04E23`
- **Danger:** `#DC2626` fill, white text
- All buttons: `cursor: pointer`, smooth 150ms transitions

**Inputs**
- Height 40px, border `1px solid #E5E7EB`, 8px radius, white background
- Focus state: border `#F04E23`, box-shadow `0 0 0 3px rgba(240,78,35,0.10)`
- Label: Inter 13px weight 500, `#374151`, 6px below
- Error: red border `#DC2626` + error message in `#DC2626` 12px

**Cards**
- White background, border `1px solid #E5E7EB`, 10px radius, 24px padding
- Hover: border transitions to `#D1D5DB`, subtle `translateY(-2px)` lift on interactive cards
- No box-shadows except auth/centered cards which use `0 4px 24px rgba(0,0,0,0.06)`

**Tables**
- Container: border `1px solid #E5E7EB`, 10px radius, overflow hidden
- Header row: `#FAFAFA` background, Inter 11px uppercase weight 500 letter-spacing 0.07em, `#9CA3AF`
- Data rows: 14px Inter `#374151`, 48px row height, bottom border `#F3F4F6`, hover `#FAFAFA`
- Last row: no bottom border
- Sortable columns: hover adds orange underline on header text, sort arrow `↑↓` in orange

**Badges / Pills**
- Border-radius 999px, Inter 11px weight 500, 3px 10px padding
- Orange: `#FFF4F1` bg, `#F04E23` text — used for active/shortlisted/published
- Success: `#F0FDF4` bg, `#059669` text
- Warning: `#FFFBEB` bg, `#D97706` text
- Danger: `#FEF2F2` bg, `#DC2626` text
- Neutral: `#F3F4F6` bg, `#6B7280` text — draft, inactive

**Sidebar**
- 240px fixed, white, right border `1px solid #E5E7EB`
- Logo area 56px height: Times New Roman 20px, orange accent on brand dot or word
- Nav items: 38px height, 6px radius, Inter 14px weight 500 `#9CA3AF`
- Hover: `#FFF4F1` background, `#F04E23` text
- Active: `#FFF4F1` background, `#F04E23` text, 2px left border `#F04E23`
- Bottom: user avatar (36px circle initials), name Inter 13px, role in orange 11px uppercase pill

**Top Bar**
- 56px height, white, bottom border `1px solid #E5E7EB`, sticky, z-index 40
- Left: page title in Times New Roman 22px `#0D0D0D`
- Right: primary action button + avatar (36px, initials, `#F04E23` background)

**Toast Notifications**
- Fixed top-right, white card, border `1px solid #E5E7EB`, 10px radius, 320px wide
- Left accent bar: 4px solid `#F04E23`
- Inter 14px, fade-in from top `translateY(-8px)` over 200ms
- Auto-dismiss after 3 seconds

**Modals**
- White, 10px radius, 420–560px wide, 32px padding
- Backdrop: `rgba(0,0,0,0.40)`
- Entry: `scale(0.96) → scale(1)` over 150ms ease
- Heading Times New Roman 22px, body Inter 14px
- Action buttons right-aligned: Primary + Secondary (Cancel)

**Animation Micro-system**
- **Hover lift:** `transform: translateY(-2px)` on cards, KPI cards, table rows with "View" links
- **Scroll reveal:** `opacity 0 → 1`, `translateY(20px) → 0` over 500ms, staggered per card
- **Counter animation:** KPI numbers count from 0 to target over 1200ms on viewport entry
- **Skeleton loading:** horizontal shimmer gradient `#F3F4F6 → #FAFAFA` on data-heavy screens
- **Orange focus ring:** `outline: 2px solid #F04E23; outline-offset: 2px` on all focusable elements
- **Modal in:** `scale(0.96) + opacity 0 → scale(1) + opacity 1` 150ms
- **Side panel in:** `translateX(100%) → translateX(0)` 200ms ease
- **Nav link underline:** orange `2px` underline expands left-to-right on hover, 200ms

---

## PORTAL 3 — COMPANY / HR / RECRUITER

---

### Screen 10 — Company Awaiting Approval

**Route:** `/company/pending`
**Portal:** Company (pending_approval status only)

**Purpose:** Holding screen shown immediately after registration, before admin approval. Communicates account status clearly without causing frustration — warm, reassuring tone.

---

**Page Layout**

Full viewport, pure white `#FFFFFF` background. No sidebar (account inactive). A single centred white card is the sole focal element:
- Max-width 480px, centred horizontally and vertically
- 48px padding, 12px radius
- Subtle shadow: `0 4px 24px rgba(0,0,0,0.06)`
- Fade-in entry animation: `opacity 0 → 1, translateY(10px) → 0` over 350ms on mount

---

**Card Content (top to bottom)**

1. **Wordmark** — "Intelli-Hire" in Times New Roman 20px, `#0D0D0D`, orange accent on the dash or dot. Centred. 24px bottom margin.

2. **Status Illustration** — A clean line-art hourglass or clock SVG, 64px, stroke color `#F04E23`. Centred. Subtle slow rotation or breathing animation (opacity pulse 3s loop) to convey "in progress" without urgency.

3. **Section Tag** — `● ACCOUNT STATUS` in Inter 11px uppercase orange, centred, 16px below illustration.

4. **Heading** — "Your Account is *Under Review*" in Times New Roman 28px `#0D0D0D`, italic orange on "Under Review". Centred. 12px top margin.

5. **Body Copy** — "Thank you for registering **Acme Corp**. Our team is reviewing your company account — this typically takes up to 24 hours. You'll receive a confirmation email at **john@acmecorp.com** once approved." Inter 14px `#374151`, centred, line-height 1.7. Bold for company name and email.

6. **Thin divider** — `1px solid #E5E7EB`, 24px vertical margin.

7. **Status Badge** — Centred amber pill: `● Pending Approval`. Warning-style: `#FFFBEB` background, `#D97706` text, 6px radius, Inter 12px weight 500.

8. **"Check Status" Button** — Secondary style (white, orange border on hover), small 36px height, centred. On click: shows a brief loading spinner inline (orange, 16px) then either redirects or shows a subtle inline message "Still under review — we'll email you shortly" in `#9CA3AF` 13px below the button. Smooth fade-in on message appearance.

9. **"Log Out" text link** — Inter 13px `#9CA3AF`, hover `#F04E23`, underline on hover. Centred, 16px below button.

---

**Notification Panel (inside card, bottom)**

A soft amber notification strip at the base of the card:
- Background `#FFFBEB`, border-top `1px solid #FDE68A`, 12px top padding, 10px bottom padding, 16px horizontal padding
- Icon: `📧` or a small envelope SVG in `#D97706`
- Text: "Didn't receive a verification email? Check your spam folder or contact **support@intellihire.com**" in Inter 13px `#92400E`. Email is a clickable `mailto:` link in `#F04E23`.

---

**Navigation Flow**
```
Pending → /company/onboarding    (status: active + profile_complete=false)
Pending → /company/dashboard     (status: active + profile_complete=true)
Pending → /login                 (Log Out)
```

---

### Screen 11 — Company Onboarding / Profile Setup

**Route:** `/company/onboarding`
**Portal:** Company (first login after approval)

**Purpose:** One-time setup screen after account activation. Collects essential company details before the user accesses the dashboard. Feels like a welcoming, progress-forward experience — not a bureaucratic form.

---

**Page Layout**

Full viewport, pure white `#FFFFFF`. No sidebar. Single centred white card:
- Max-width 560px, 48px padding, 12px radius
- Shadow: `0 4px 24px rgba(0,0,0,0.06)`
- Page fade-in on mount

---

**Progress Indicator**

Directly above the card heading — not inside a separate component but cleanly integrated:
- "Step 1 of 1 — Complete Your Company Profile" in Inter 12px `#9CA3AF`, centred
- A thin full-width progress bar below (height 3px, `#E5E7EB` track, `#F04E23` fill at 100% — already the final step, so fully filled)

---

**Card Content (top to bottom)**

1. **Section Tag** — `● COMPANY SETUP` orange tag, centred.

2. **Heading** — "Set Up Your *Company*" — Times New Roman 30px `#0D0D0D`, italic orange on "Company". 8px below tag.

3. **Subtext** — "Help candidates and your team understand who you are." Inter 14px `#374151`, centred, 4px below heading.

4. **Company Logo Upload** — Centred, 16px top margin:
   - Square 100×100px upload zone, `2px dashed #E5E7EB` border, 10px radius
   - Background `#FAFAFA`, hover background `#FFF4F1`, hover border `#F04E23` — smooth 150ms transition
   - Inside: building icon SVG (24px, `#D1D5DB`) + "Upload Logo" in Inter 12px `#9CA3AF` below icon
   - On click: native file picker (PNG/JPG ≤2MB)
   - After upload: logo image displayed inside the square, border turns solid `#E5E7EB`, "Remove" ghost link (13px `#9CA3AF`, hover red) appears centred below the zone

5. **Form Fields** — Stacked vertically, 16px gap between fields, 24px top margin, full-width:
   - **Company Name** (text input, pre-filled "Acme Corp", editable) — label "Company Name"
   - **Industry** (dropdown, pre-filled "Technology") — label "Industry" — dropdown has orange focus ring and orange check on selected option
   - **Company Size** (dropdown: 1–10 / 11–50 / 51–200 / 201–500 / 500+ employees) — label "Company Size"
   - **Website URL** (url input, placeholder "https://yourcompany.com") — label "Website"
   - **Company Description** (textarea, 5 rows, placeholder "Tell candidates about your company, culture, and mission.", max 500 chars) — label "Description". Character counter bottom-right of textarea: "0 / 500" in Inter 12px `#9CA3AF`, turns orange at 400+, red at 500.

6. **"Complete Setup" Button** — Full-width primary orange button, 44px height, 8px radius. Text: "Complete Setup →". On click: shows inline loading state (button text replaced by orange spinner + "Saving…"), then redirects.

7. **"Skip for now →"** — Ghost link below button, Inter 13px `#9CA3AF`, hover `#F04E23`. Marks `profile_complete=false` and redirects to dashboard. An amber inline note above this link: "You can complete this later from your settings."

---

**Validation States**
- Company Name: required — red border + error message on submit attempt
- Website: valid URL format check on blur — inline error "Please enter a valid URL (include https://)"
- Description: hard cap at 500 chars (textarea becomes non-typable at limit)

---

**Navigation Flow**
```
Onboarding → /company/dashboard   (Complete Setup or Skip)
```

---

### Screen 12 — Company Dashboard

**Route:** `/company/dashboard`
**Portal:** Company / HR / Recruiter

**Purpose:** Central command screen. First thing users see after onboarding — must convey activity, health, and action opportunities at a glance. Data-rich but never cluttered.

---

**Layout Structure**

- Sidebar (240px fixed left) + main content area (full remaining width)
- Top bar (56px) sticky above the scrollable main area
- Main content: 32px horizontal padding, 32px top padding, 24px gap between sections

**Sidebar** — Intelli-Hire wordmark top. Nav items: Dashboard (active) · Job Postings · Candidates · Analytics · Community · Team · Settings. Company logo (40px circle, initials fallback) + company name (Inter 14px weight 500 `#0D0D0D`) above nav items as a sub-header strip. User avatar + name + role orange pill at sidebar bottom.

**Top Bar** — "Dashboard" Times New Roman 22px left. "New Job +" primary orange button right. User avatar far right (36px, initials, orange background, dropdown on click).

---

**Incomplete Profile Banner** (conditional — shown when `profile_complete=false`)

Full-width amber banner, sits directly below the top bar, above the main content:
- Background `#FFFBEB`, left border `3px solid #D97706`
- Padding 14px 24px
- Icon: clipboard emoji or SVG in `#D97706`
- Text: "Complete your company profile to attract better candidates. Add your logo and description." Inter 14px `#92400E`
- "Finish Setup →" inline text link in `#F04E23`, underline hover
- "×" dismiss icon right-aligned (Inter 16px `#9CA3AF`, hover red)
- Slide-down entry animation, slide-up on dismiss

---

**KPI Cards Row** — 4 cards in equal columns, 16px gap, 24px bottom margin

Each card: white, `1px solid #E5E7EB`, 10px radius, 24px padding. Hover: border `#D1D5DB`, `translateY(-2px)`. Scroll-reveal stagger (each card 80ms later).

- **Active Jobs** — Value "6" (Times New Roman 40px `#0D0D0D`), label "Active Job Postings" (Inter 11px uppercase `#9CA3AF`), "View All →" ghost orange link bottom-right (13px)
- **Total Applicants** — Value "142", label "Total Applications Received"
- **Shortlisted** — Value "28", label "Candidates Shortlisted". Value tinted `#059669` (success green) to signal positive pipeline health
- **Interviews Done** — Value "19", label "Screening Interviews Completed"

Counter animation: all values animate from 0 to target over 1200ms when entering viewport.

---

**Main Content Area — Two-Column (65% left / 35% right)**

**Left Column:**

*Recent Job Postings Card*
- White card, full-width of column, heading "Recent Job Postings" Times New Roman 18px `#0D0D0D` + "View All →" orange link right-aligned
- Table inside card (no outer border — card IS the container). Columns: Job Title · Applicants · Status · Posted · Action
- Job Title: Inter 14px weight 500 `#0D0D0D`, hover underline orange
- Applicants: Inter 14px `#374151`
- Status badge: Published (orange pill) / Draft (neutral pill) / Closed (danger pill)
- Posted: Inter 13px `#9CA3AF`
- Action: "View Candidates →" Inter 13px `#F04E23`, underline on hover
- Row dividers: `1px solid #F3F4F6`. Hover: `#FAFAFA` row background
- 5 rows shown, then "View All Job Postings →" full-width ghost button at card bottom

*Hiring Pipeline Card* — below the jobs card, 16px gap
- White card, heading "Hiring Pipeline" Times New Roman 18px
- Horizontal funnel bar group: 5 stages rendered as adjacent labelled segments
- Each segment: rounded bar, proportional width, white label above (stage name Inter 12px uppercase `#9CA3AF`), count in Times New Roman 18px `#0D0D0D` below, drop-off percentage in Inter 11px `#D97706` or `#059669` depending on rate
- Stage colors: Applied `#F04E23` (orange) → Screened amber → Interviewed yellow → Shortlisted teal-green → Decided green. All at 80% saturation for subtlety.
- Hover on segment: tooltip showing absolute count + % of total in a small white card with `1px border` and 6px radius

Mock pipeline: Applied 142 → Screened 67 (↓53%) → Interviewed 31 (↓54%) → Shortlisted 28 (↓10%) → Decided 14 (↓50%)

**Right Column:**

*Activity Feed Card* — full height of left content
- White card, heading "Recent Activity" Times New Roman 18px
- Scrollable list (max-height matches left column height), custom thin scrollbar `#E5E7EB` track, `#F04E23` thumb
- Each item: left-side colored dot (orange = applicant event, green = job event, neutral = team event) + event text Inter 13px `#374151` + time-ago Inter 12px `#9CA3AF` right-aligned
- Items separated by `1px solid #F3F4F6`
- Hover: `#FAFAFA` row, cursor default (not clickable unless event links to a record — in which case, cursor pointer, text `#F04E23` on hover)
- Scroll-reveal on first 8 items with 40ms stagger

Mock activity items (8 visible):
```
● New application — Priya Patel, Frontend Developer  (2h ago)
● Interview completed — James Wilson: 79/100         (5h ago)
● 3 candidates shortlisted — Backend Engineer        (Yesterday)
● Job "UX Researcher" closed by Sarah                (2 days ago)
● New team member invited — recruiter@acmecorp.com   (3 days ago)
```

---

**Navigation Flow**
```
Dashboard → /company/jobs/create           (New Job + button)
Dashboard → /company/jobs                  (View All Jobs / sidebar)
Dashboard → /company/jobs/:id/candidates   (View Candidates)
Dashboard → /company/analytics             (sidebar)
Dashboard → /company/community             (sidebar)
Dashboard → /company/team                  (sidebar)
```

---

### Screen 13 — Team Management

**Route:** `/company/team`
**Portal:** Company Owner only

**Purpose:** Invite, manage roles, and remove HR managers and recruiters. Clean, table-centric screen with clear role hierarchy and permission transparency.

---

**Page Header**
- "Team *Management*" — Times New Roman 28px, italic orange on "Management"
- "Invite Member +" primary orange button, right-aligned in top bar

---

**Team Summary Strip**

White card, single row, 16px padding:
- 4 stats separated by `1px solid #E5E7EB` vertical dividers: "1 Owner · 2 HR Managers · 3 Recruiters · **6 Total Members**"
- Each stat: Times New Roman 18px value `#0D0D0D` + Inter 12px label `#9CA3AF` below
- No hover state — purely informational

---

**Team Table**

White card, full-width, table inside:
- Columns: Name · Email · Role · Status · Date Added · Actions
- Column headers: Inter 11px uppercase weight 500 `#9CA3AF`, `#FAFAFA` background, `1px solid #E5E7EB` bottom
- Row height: 52px, `1px solid #F3F4F6` divider, hover `#FAFAFA`

**Role badges:**
- Owner: `#0D0D0D` background, white text — dark pill, reserved and prominent
- HR Manager: `#FFF4F1` background, `#F04E23` text — orange pill
- Recruiter: `#F3F4F6` background, `#374151` text — neutral pill

**Status badges:**
- Active: success green pill
- Pending Invite: warning amber pill with a small pulsing amber dot to signal "awaiting action"

**Actions per row:**
- Active rows: "Edit Role" secondary small button (32px height) + "Remove" ghost danger link (`#DC2626`, hover underline). Owner row: actions column shows "—" (no actions applicable to self)
- Pending rows: "Resend Invite" ghost orange link replaces "Edit Role"; "Remove" still present
- "Remove" click triggers an inline confirmation popover (not a full modal): "Remove [Name] from your team?" with "Confirm" danger button + "Cancel" ghost, appears below the action cell, 200ms fade-in

---

**Invite Member Modal**

Triggered by "Invite Member +" button. Centred modal:
- White card, 420px wide, 32px padding, 10px radius
- Backdrop `rgba(0,0,0,0.40)`, entry animation `scale(0.96) → scale(1)` 150ms
- Heading: "Invite a Team Member" Times New Roman 22px
- Subtext: "They'll receive an email invitation to join your workspace." Inter 13px `#9CA3AF`
- Email input (full-width, required) — orange focus ring
- Role dropdown (HR Manager / Recruiter) — styled dropdown with orange check on selection
- "Send Invite →" full-width primary orange button
- "Cancel" ghost link below button
- On success: modal closes, table row appended with pending state, toast: "✓ Invite sent to recruiter@acmecorp.com" — orange left-bar toast

---

**Mock Data**
```
John Smith  | john@acmecorp.com  | Owner      | Active  | Jan 15, 2025
Sarah Lee   | sarah@acmecorp.com | HR Manager | Active  | Feb 01, 2025
Mike Brown  | mike@acmecorp.com  | HR Manager | Active  | Feb 14, 2025
Ana Torres  | ana@acmecorp.com   | Recruiter  | Active  | Mar 03, 2025
Raj Patel   | raj@acmecorp.com   | Recruiter  | Active  | Mar 10, 2025
[Pending]   | dev@acmecorp.com   | Recruiter  | Pending | May 06, 2025
```

---

### Screen 14 — Job Postings List

**Route:** `/company/jobs`
**Portal:** Company / HR / Recruiter

**Purpose:** Master list of all company job openings. Primary operational screen for recruiters — filter, scan, navigate to applicants. Clean, fast, table-forward.

---

**Page Header**
- "Job *Postings*" — Times New Roman 28px, orange italic on "Postings"
- "Create New Job +" primary orange button right

---

**Filter Bar**

White card, 16px padding, flex row, 12px gap between elements:
- Search input: placeholder "Search job title…", 220px width, standard input styling with magnifier icon left-inside (`#9CA3AF`)
- Status filter: dropdown — All / Draft / Published / Closed. Styled dropdown, 150px width
- Clears/resets on "×" icon inside search input when populated
- Filters apply with 150ms debounce on search, immediate on dropdown change

---

**Jobs Table**

White card, full-width, 10px radius, table inside:
- Columns: Job Title · Department · Deadline · Applicants · Status · Actions
- Row height: 52px

**Job Title column:** Inter 14px weight 500 `#0D0D0D`, clickable → View Candidates. Hover: `#F04E23` underline.

**Deadline:** Inter 13px `#374151`. If expired: text `#DC2626`. If within 7 days: amber `#D97706`. If "—" (no deadline / draft): shown as long dash in `#9CA3AF`.

**Applicants column:** Inter 14px `#374151`. "0 applicants" shown as `#9CA3AF` italic.

**Status badges:**
- Published: orange pill `#FFF4F1` / `#F04E23`
- Draft: neutral grey pill
- Closed: danger red pill

**Actions column** (per row):
- "View Candidates →" Inter 13px `#F04E23`, hover underline (always visible to all roles)
- "Edit" Inter 13px `#374151`, hover `#F04E23` (hidden for Recruiter on Published/Closed)
- "Close" Inter 13px `#DC2626`, hover underline (Owner/HR Manager only, Published rows only)
- "Close" triggers an inline confirmation popover: "Close this job posting? Candidates can no longer apply." — Confirm (danger) + Cancel

**Permissions enforcement:** Recruiter role hides "Close" and "Edit" on published/closed jobs silently (column cells empty for those actions). No error, no locked icon — clean omission.

---

**Mock Data**
```
Frontend Developer  | Engineering | May 31, 2025 | 34 | Published | View / Edit / Close
Backend Engineer    | Engineering | Jun 15, 2025 | 28 | Published | View / Edit / Close
Product Designer    | Design      | May 28, 2025 | 22 | Published | View / Edit / Close
DevOps Engineer     | Engineering | —            | 0  | Draft     | View / Edit
Data Scientist      | Data & AI   | Jun 30, 2025 | 24 | Published | View / Edit / Close
UX Researcher       | Design      | Apr 30, 2025 | 16 | Closed    | View
Marketing Manager   | Marketing   | —            | 0  | Draft     | View / Edit
```

---

### Screen 15 — Create / Edit Job Opening

**Route:** `/company/jobs/create` or `/company/jobs/:id/edit`
**Portal:** Company Owner / HR Manager (Recruiter: can edit draft, cannot publish)

**Purpose:** Comprehensive job creation form — all job details, role requirements, and custom application questions that power the AI screening engine. Long-form but well-sectioned so it never feels overwhelming.

---

**Page Layout**

No sidebar-obscured content. Sidebar present but main form content is max-width 760px, centred within the content area (not full-bleed). 40px top padding, 40px bottom clearance above sticky footer.

**Breadcrumb** (below top bar): "Job Postings / Create New Job" — Inter 13px, `#9CA3AF`, `>` separator, final segment `#0D0D0D` weight 500.

---

**Sticky Footer Bar**

Always visible at viewport bottom during scroll:
- White background, `1px solid #E5E7EB` top border, 16px padding horizontal
- Left: "Cancel" ghost link (`#9CA3AF`, hover `#F04E23`)
- Right group: "Save as Draft" secondary button + "Publish Job →" primary orange button (disabled with 60% opacity for Recruiter role, tooltip on hover: "Only HR Managers can publish jobs")
- Smooth `box-shadow: 0 -4px 16px rgba(0,0,0,0.04)` on the sticky bar to separate from content

---

**Form Sections** (vertical scroll, single column, 32px gap between sections)

Each section opens with a divider heading:
- Section label: Inter 11px uppercase weight 600 letter-spacing 0.08em `#9CA3AF` + full-width `1px solid #E5E7EB` line after (flex row, gap 12px)

**Section 1 — Basic Info**
Four fields in a 2×2 grid (two per row, 16px gap):
- Job Title (full row — spans both columns), text input, required, placeholder "e.g. Senior Frontend Engineer"
- Department (left), text input, placeholder "e.g. Engineering"
- Location (left), text input, placeholder "e.g. London, UK or Remote"
- Job Type (right), dropdown: Full-time / Part-time / Contract / Remote / Hybrid

**Section 2 — Job Description**
- Rich text area with minimal floating toolbar: Bold · Italic · Bullet list · Numbered list · H2. Toolbar appears on selection (not always visible), white background, `1px solid #E5E7EB`, 4px radius
- Textarea min-height 240px, grows with content
- Placeholder: "Describe the role, responsibilities, and what a typical day looks like…" in `#D1D5DB`
- Character count bottom-right: Inter 12px `#9CA3AF`

**Section 3 — Requirements**
- **Skills** — Tag input: type skill + Enter to add. Tags rendered as orange pills `#FFF4F1 / #F04E23` with `×` remove icon. Input grows inline after tags. Placeholder "Add a skill…"
- **Experience Level** — dropdown: Entry-level / Mid-level / Senior / Lead / Director
- **Education** — dropdown: High School / Bachelor's / Master's / PhD / Any
- Three fields in a row on larger screens, stacked on narrow

**Section 4 — Application Deadline**
- Date picker input, placeholder "Select a date", required for publishing
- Date must be in the future — real-time validation on date change; error message "Deadline must be a future date" in `#DC2626` 12px
- Calendar picker uses orange as the selection accent

**Section 5 — Custom Application Fields**

Subheading: "Custom Questions for Applicants" in Times New Roman 18px `#0D0D0D`. Subtext in Inter 13px `#9CA3AF`: "These questions appear on the candidate application form below the standard fields."

Existing custom fields displayed as sortable rows:
- Each row: drag handle icon (`⠿`, `#D1D5DB`) · field label (Inter 14px `#0D0D0D`) · type badge (neutral pill: "Short Text", "Yes/No", etc.) · Required toggle (orange when required, grey when not) · "Remove" ghost danger link
- Row border `1px solid #E5E7EB`, 8px radius, 12px padding, white background
- Drag-to-reorder: dragging row gets `0 4px 16px rgba(0,0,0,0.08)` shadow, orange left border

"Add Custom Field +" ghost button (full-width, dashed border `#E5E7EB`, hover border `#F04E23`, hover bg `#FFF4F1`) below field rows.

**Add Field Inline Panel** (expands below the "+" button, 150ms ease-in):
- White card, border `1px solid #E5E7EB`, 10px radius, 20px padding
- Field Label input (full-width)
- Field Type dropdown: Short Text / Long Text / Dropdown / File Upload / Yes/No
- "Required?" toggle switch (orange active state)
- Row of buttons: "Add Field" small primary orange button + "Cancel" ghost link

---

**Mock Data (pre-filled for Senior Frontend Engineer)**
```
Job Title: Senior Frontend Engineer
Department: Engineering
Location: Remote (UK)
Job Type: Full-time
Description: We are looking for a skilled frontend engineer to join our growing team…
Skills: React · TypeScript · JavaScript · CSS · GraphQL · Git
Experience: Senior  |  Education: Bachelor's  |  Deadline: Jun 15, 2025
Custom Fields:
  1. "Portfolio URL"                    — Short Text  — Required
  2. "Eligible to work in the UK?"     — Yes/No      — Required
  3. "Cover letter (optional)"         — Long Text    — Not Required
```

---

**Navigation Flow**
```
Create Job → /company/jobs               (Cancel)
Create Job → /company/jobs/:id/preview   (Publish — after publish action)
Edit Job   → same as above
```

---

### Screen 16 — Application Form Preview & Link Sharing

**Route:** `/company/jobs/:id/preview`
**Portal:** Company / HR / Recruiter

**Purpose:** Gives companies a live candidate-eye-view of the auto-generated application form, plus tools to share the job link. Dual-purpose: QA check + distribution hub.

---

**Page Header**
- "Application Form *Preview*" — Times New Roman 28px, orange italic on "Preview"
- Subtext below: "Senior Frontend Engineer" in Inter 14px `#9CA3AF`
- Left: "← Edit Job" ghost orange link | Right: "← Back to Job Postings" ghost link

---

**Two-Column Layout (60% left / 40% right), 24px gap**

**Left Column — Live Form Preview Card**

White card, full height of content. Top label bar inside card: `#FAFAFA` background, `1px solid #E5E7EB` bottom border, "👁 CANDIDATE VIEW" in Inter 11px uppercase `#9CA3AF`, 12px padding.

The rendered form preview (inside white card):
- Header: "Applying for **Senior Frontend Engineer** at **Acme Corp**" — Times New Roman 18px `#0D0D0D`, 20px bottom margin
- Standard field group: Full Name · Email · Phone · CV/Resume Upload (PDF only, drag-and-drop zone with dashed orange border on drag-over)
- Thin divider `1px solid #E5E7EB` + "Additional Questions" label in Inter 12px uppercase `#9CA3AF`
- All custom fields rendered in order: labels, appropriate input types, required asterisk `*` in `#F04E23` where required
- "Submit Application" button — full-width primary orange, but non-interactive. On hover: tooltip "Preview Only — not functional" in a small white tooltip card above the button
- Form uses standard card styling: white bg, form inputs all with orange focus ring styling visible in static preview

**Right Column — Sharing Panel**

White card, 24px padding:

1. **Heading:** "Share This *Job*" Times New Roman 20px, orange italic on "Job"
2. **Shareable URL row:** read-only input (full-width, `#FAFAFA` background, `1px solid #E5E7EB` border, Inter 13px `#374151`) + "Copy Link" primary orange button right of input (100px). On click: button text → "✓ Copied!" with green text for 2 seconds, then reverts. Input value highlighted orange on copy.
3. **QR Code block:** 120×120px QR code centred, 8px border `1px solid #E5E7EB`, 6px radius. "Download QR" ghost link below in Inter 13px `#F04E23`.
4. **"Open in New Tab →"** secondary button, full-width, 36px height.
5. **Divider** `1px solid #E5E7EB`, 16px margin.
6. **"Share via" row:** Two icon buttons — LinkedIn icon + Copy icon. Square 36px, `1px solid #E5E7EB` border, 8px radius. Hover: border `#F04E23`, icon tint `#F04E23`.
7. **Divider.**
8. **Settings Summary panel:** `#FAFAFA` background, 10px radius, 16px padding, `1px solid #E5E7EB` border. Three rows:
   - Deadline: "Jun 15, 2025" — value in success green (active) or danger red (expired)
   - Total Fields: "7 fields"
   - Status: Published badge (orange pill)

---

**Navigation Flow**
```
Preview → /company/jobs/:id/edit    (Edit Job)
Preview → /company/jobs             (Back to Job Postings)
Preview → public application URL    (Open in New Tab)
```

---

### Screen 17 — Candidates List (Per Job)

**Route:** `/company/jobs/:id/candidates`
**Portal:** Company / HR / Recruiter

**Purpose:** All applicants for one job, AI-ranked by CV match score. Primary workspace for screening decisions — fast stage updates, bulk actions, at-a-glance quality signals.

---

**Page Header**

Breadcrumb: "Job Postings / Senior Frontend Engineer / Candidates" — Inter 13px `#9CA3AF`.

Title row: "Senior Frontend Engineer" Times New Roman 26px `#0D0D0D` + "Published" orange badge right of title.

---

**Stats Strip**

White card, horizontal row, `1px solid #E5E7EB` vertical dividers between stats, 20px padding:
- Total Applicants: "34" (Times New Roman 28px `#0D0D0D`) + "Total Applicants" (Inter 12px `#9CA3AF`)
- Shortlisted: "8" success green value
- Interviews Pending: "5" warning amber value
- Decided: "3" neutral grey value

---

**Filter + Sort Bar**

White card, 16px padding, flex row:
- Search input "Search by candidate name…" 220px, magnifier icon
- Stage filter dropdown (All / Applied / Shortlisted / Screened / Interviewed / Decided) 160px
- Sort dropdown (CV Match Score ↓ / Application Date ↓ / Name A–Z) 180px
- All filters combined in real-time (150ms debounce on search)

---

**Bulk Action Bar** (conditionally appears above table when ≥1 row selected)

Slides down (150ms ease) below filter bar — amber tinted strip:
- Background `#FFFBEB`, border `1px solid #FDE68A`, `1px solid #E5E7EB` bottom, 12px padding
- "[N] candidates selected — Shortlist Selected" amber action button + "Clear Selection ×" ghost link
- "Move to Stage" dropdown secondary button for bulk stage change

---

**Candidates Table**

White card, full-width:
- Columns: ☐ checkbox · Name · Email · Applied · CV Match % · Stage · Actions
- Checkbox: orange accent when checked (`#F04E23` fill, white checkmark)
- Column headers sortable: header text hover `#F04E23` underline, active sort shows arrow in `#F04E23`

**CV Match % badge** — colour-coded with mini progress bar:
- ≥80%: `#F0FDF4` bg, `#059669` text, green fill bar
- 50–79%: `#FFFBEB` bg, `#D97706` text, amber fill bar
- <50%: `#FEF2F2` bg, `#DC2626` text, red fill bar
- Mini bar: 40px wide × 4px tall, rounded, fills proportionally. Sits below the percentage text inside the badge.

**Stage badge** — pill style per stage:
- Applied: neutral grey
- Shortlisted: orange (`#FFF4F1 / #F04E23`)
- Screened: amber
- Interviewed: warning yellow-brown
- Decided: success green or danger red

**Actions column:**
- "View Profile →" Inter 13px `#F04E23`, hover underline
- Stage inline dropdown: clicking opens a small floating dropdown below the stage badge — select a new stage, confirm with orange "Update" button (36px) or dismiss. Smooth 150ms fade-in.

**Row hover:** `#FAFAFA` background, smooth 120ms transition. Clicking any part of row except action elements navigates to View Profile.

---

**Mock Data**
```
Priya Patel   | priya@email.com  | May 01 | 91% ✅ | Shortlisted  | View Profile
James Wilson  | james@email.com  | May 02 | 87% ✅ | Interviewed  | View Profile
Ahmed Malik   | ahmed@email.com  | May 03 | 82% ✅ | Shortlisted  | View Profile
Sarah Chen    | sarah@email.com  | Apr 30 | 76% ⚠️ | Screened    | View Profile
Daniel Kim    | daniel@email.com | Apr 29 | 71% ⚠️ | Applied     | View Profile
Maria Torres  | maria@email.com  | Apr 28 | 65% ⚠️ | Applied     | View Profile
Tom Evans     | tom@email.com    | Apr 27 | 58% ⚠️ | Applied     | View Profile
Lisa Nguyen   | lisa@email.com   | Apr 26 | 44% 🔴 | Applied     | View Profile
```
Pagination: 20 per page, "Showing 1–20 of 34" Inter 13px `#9CA3AF`, Prev / Next buttons secondary style.

---

**Navigation Flow**
```
Candidates List → /company/candidates/:id   (View Profile / row click)
Candidates List → /company/jobs             (breadcrumb)
```

---

### Screen 18 — Candidate Profile & Evaluation Report

**Route:** `/company/candidates/:id`
**Portal:** Company / HR / Recruiter

**Purpose:** Complete candidate dossier — application data, AI CV analysis, screening interview transcript, technical interview results — all in one consolidated view to support a hiring decision.

---

**Page Header**
- Breadcrumb: "Candidates / Priya Patel" — Inter 13px `#9CA3AF`
- "Priya Patel — Senior Frontend Engineer" Times New Roman 26px `#0D0D0D`

---

**Two-Column Layout (30% left sticky / 70% right scrollable)**

**Left Panel — Profile Card** (sticky, stays in view while right panel scrolls)

White card, full-height sticky:
- Avatar: 64px circle, `#F04E23` background, white initials "PP", Times New Roman 24px weight 700
- Name: Times New Roman 20px weight 700 `#0D0D0D`
- Applied Role: Inter 14px `#374151` "Senior Frontend Engineer"
- Stage badge: orange pill "Shortlisted" directly below role
- **CV Match Score** — prominent display: Times New Roman 36px weight 700 `#059669` "91%" + progress arc (thin circular arc, 80px, success green fill at 91%, track `#E5E7EB`) + "CV Match Score" Inter 12px `#9CA3AF` below
- Thin divider `1px solid #E5E7EB`
- Contact section: envelope icon + "priya.patel@email.com" (clickable `mailto:`, hover `#F04E23`) · phone icon + "+44 7911 123456" (clickable `tel:`)
- Applied: "May 1, 2025" Inter 13px `#9CA3AF`
- Divider
- "Download CV" secondary button, full-width, 36px height — download icon left of text

---

**Right Panel — Tabbed Evaluation Report**

4 tabs in a tab bar: Overview · CV Analysis · Screening Interview · Technical Interview
Tab bar: Inter 14px weight 500 `#9CA3AF`, active: `#0D0D0D` text + `2px solid #F04E23` bottom underline. Smooth 150ms underline slide on tab change.

**Overview Tab (default)**

2×2 score card grid, 16px gap:
- CV Match: "91%" success green (Times New Roman 32px)
- Screening Score: "84/100" success green
- Technical Score: "79/100" warning amber
- Composite Score: "85/100" success green, slightly larger — the summary number

Below grid: AI Verdict block — `#FAFAFA` background, `1px solid #E5E7EB` border, 10px radius, 16px padding:
- Section tag `● AI VERDICT` orange
- Italic Times New Roman 16px `#374151` verdict text: "Strong candidate. Recommend advancing to final round — address system design gaps."
- Bottom strip: "Generated by Intelli-Hire AI" Inter 12px `#9CA3AF`

**CV Analysis Tab**

Three sub-sections, each a white card with `1px solid #E5E7EB` border, 16px padding, 10px radius, stacked 16px apart:

*Extracted Skills:* Flex wrap of skill tags — matched skills: `#F0FDF4` bg `#059669` text with ✅ icon; unmatched skills: `#FEF2F2` bg `#DC2626` text with ❌ icon.

*Education:* Timeline-style list — dot connector, institution name Inter 14px weight 500 `#0D0D0D`, degree + year in `#9CA3AF`. Orange dot for most recent.

*Work Experience:* Same timeline style. Company bold, role + duration muted.

*AI Highlights strip:* `#FFF4F1` bg, `1px solid #FCA68A` border, Inter 14px `#374151`: "3 of 5 required skills matched · 2+ years relevant experience · Portfolio links detected"

**Screening Interview Tab**

Top: circular score badge 80px — "84/100" Times New Roman 24px `#059669`, arc ring in green.

4 sub-scores in a horizontal bar group:
- Communication: 90% · Clarity: 85% · Enthusiasm: 82% · Professionalism: 88%
- Each: label Inter 12px uppercase `#9CA3AF` + horizontal bar (full-width, 6px height, `#F3F4F6` track, `#F04E23` fill, 999px radius) + percentage right-aligned Inter 13px weight 500 `#0D0D0D`
- Bars animate fill left-to-right over 800ms when tab becomes active

Q&A Transcript — accordion cards:
- Each card: collapsed by default, header shows Q in `#F04E23` Inter 14px + expand icon right
- Expanded: Q in `#FFF4F1` block (orange tint) + A in white block with `1px solid #E5E7EB` border below
- Inter 14px `#374151` for answer text

AI Key Observations:
- `#FAFAFA` bg card, bullet list, Inter 14px italic `#374151`

**Technical Interview Tab**

Same structure as Screening Interview tab. Overall score: "79/100" amber.

4 competency bars: React 88% · TypeScript 81% · CSS Architecture 72% · System Design 65%

Bars: System Design at 65% rendered in amber `#D97706` to signal weakness. Others orange.

Note block (yellow-tinted): "Strong in React & TypeScript. Architecture answers lacked depth for large-scale scenarios." Inter 14px `#374151` italic.

---

**Action Buttons Row** (fixed below tabs, outside scroll area)

Full-width strip, white bg, `1px solid #E5E7EB` top border, 16px padding, flex row:
- "Move to Next Stage →" primary orange button
- "Put on Hold" secondary button
- "Mark as Rejected" danger red button (rightmost)

"Mark as Rejected" → centred modal:
- Heading "Mark Priya Patel as Rejected?" Times New Roman 20px
- "Please provide a reason — this will be logged for compliance." Inter 14px `#374151`
- Textarea (required, min 20 chars) with character counter
- "Confirm Rejection" danger button + "Cancel" ghost

---

**Mock Data:** Priya Patel — as specified in document above.

---

**Navigation Flow**
```
Profile → /company/jobs/:id/candidates   (breadcrumb)
Profile → stays on screen (tab switches, action modals in-place)
```

---

### Screen 19 — Recruiter Analytics Dashboard

**Route:** `/company/analytics`
**Portal:** Company Owner / HR Manager only (Recruiter role: blocked — redirects to `/company/dashboard` with a toast "You don't have access to Analytics")

**Purpose:** Visual reporting on hiring pipeline performance — funnel efficiency, candidate quality, job benchmarking, and time-to-hire KPIs. Data-forward screen; all visualisations serve actionable insights.

---

**Page Header**
- "Recruitment *Analytics*" Times New Roman 28px, orange italic on "Analytics"
- Subtext: Inter 14px `#9CA3AF` "View your hiring performance and pipeline insights"

---

**Filter Bar**

White card, 16px padding, flex row:
- "View data for:" label Inter 13px `#374151` + Job dropdown (All Jobs / individual job titles) 200px
- Date range: two date inputs "From —" "To —" with calendar pickers, 150px each, `1px solid #E5E7EB` border
- "Apply" primary orange button 80px (compact, 36px height)
- On apply: all charts and tables update with skeleton loading shimmer for 400ms, then fade in new data

---

**KPI Cards Row** — 4 cards, equal columns, 16px gap

Same KPI card spec as dashboard. Counter animation on page load. Values:
- Total Applicants: "142"
- Avg CV Match Score: "72%" — value in `#F04E23` orange (key business metric)
- Interview Completion Rate: "68%"
- Avg Time to Shortlist: "4.2 days"

---

**Charts Section — Two Column (55% left / 45% right), 24px gap**

**Left — Hiring Funnel Chart**

White card, heading "Hiring Funnel" Times New Roman 18px + "All Jobs · Last 30 Days" subtext Inter 12px `#9CA3AF` right-aligned.

Horizontal stacked bar visualisation:
- Each stage as a full-width labelled row: stage name left (Inter 13px uppercase `#9CA3AF`) · bar filling proportionally from left (color per stage, subtle — orange family to green) · count right (Times New Roman 18px `#0D0D0D`) · drop-off percentage far right in amber for drops >40%
- Bar animation: fills left-to-right over 700ms on page load, staggered 100ms per stage
- Hover on bar segment: tooltip card (white, `1px border`, 8px radius, `0 4px 12px rgba(0,0,0,0.08)`) showing "Stage: Screened | 67 candidates | 47% of Applied"
- Stage bars: Applied `#F04E23` · Screened `#FCA68A` · Interviewed `#D97706` · Shortlisted `#059669` · Decided `#0D9488`

Funnel mock: Applied 142 · Screened 67 (47%) · Interviewed 31 (46%) · Shortlisted 28 (90%) · Decided 14 (50%)

**Right — Top Candidates Bar Chart**

White card, heading "Top Candidates" Times New Roman 18px + "By Composite Score" subtext.

Horizontal bar chart, 8 candidates:
- Each row: candidate name left Inter 13px `#374151` · bar fills proportionally (`#F04E23` at full opacity) · score right Times New Roman 16px weight 700 `#0D0D0D`
- Bars animate width on load, 600ms ease-out, staggered 60ms per bar
- Hover on bar: bar deepens to `#D43D14`, score label bolds
- Clicking candidate row navigates to their profile `/company/candidates/:id`

---

**Job Comparison Table** (full-width, below charts)

White card, heading "Job Comparison" Times New Roman 18px:
- Columns: Job Title · Applicants · Avg CV Score · Interviews Done · Status · Action
- Avg CV Score column: colour-coded text — ≥75% green, 50–74% amber, <50% red
- Status column: standard badge pills
- "View →" link orange, rightmost column
- Row hover lifts (`translateY(-1px)`) with border-color `#D1D5DB`, cursor pointer
- Full row clickable → `/company/jobs/:id/candidates`
- Column headers sortable

---

**Navigation Flow**
```
Analytics → /company/jobs/:id/candidates   (table row click)
Analytics → /company/dashboard             (sidebar)
```

---

### Screen 20 — Community Management

**Route:** `/company/community`
**Portal:** Company Owner / HR Manager

**Purpose:** Create and manage talent communities for long-term pipeline building. Focused groups — university pools, alumni, specialist tech communities — that companies can nurture and post jobs into.

---

**Page Header**
- "Talent *Communities*" Times New Roman 28px, orange italic on "Communities"
- Subtext: Inter 14px `#9CA3AF` "Build and manage your long-term candidate pools"
- "Create Community +" primary orange button right

---

**Community Cards Grid** — 3 per row, 20px gap, scroll-reveal stagger per card

Each card: white, `1px solid #E5E7EB`, 10px radius, 24px padding, hover `translateY(-2px)` + border `#D1D5DB`:

- **Community name:** Times New Roman 18px weight 700 `#0D0D0D`
- **Description:** Inter 13px `#374151`, 2-line clamp, 8px below name
- **Tags row:** "48 Members" blue-tinted pill (actually orange-neutral: `#FFF4F1 / #F04E23`) + Target Group tag (`#F3F4F6 / #374151` neutral pill: "Tech Professionals")
- **Join mode label:** Inter 12px `#9CA3AF` — "Open" or "Invite Only" with lock icon
- **Divider** `1px solid #F3F4F6`
- **Action row:** "Manage →" secondary button (white, border, hover orange) + "Post Job" secondary small button right-aligned. 12px padding top.

---

**Create Community Modal**

Centred modal, 480px wide, 32px padding:
- Heading: "Create a Talent *Community*" Times New Roman 22px
- Fields:
  - Community Name (text, required)
  - Description (textarea, 3 rows, 250 char limit, counter bottom-right)
  - Target Group (dropdown: University Students / University Alumni / Tech Professionals / Industry Experts / Early Career)
  - Filter Tags (tag input — skills or universities, orange pills)
  - Join Mode (radio group styled as two card options: "🔓 Open — Anyone can join" card + "🔒 Invite Only — Review each member" card — selected card gets orange border `#F04E23` and `#FFF4F1` background, unselected `#E5E7EB` border)
- "Create Community →" full-width primary orange button
- "Cancel" ghost link

---

**Community Detail View** (triggered by "Manage →" — navigates to or replaces current view)

Two-column layout (40% left / 60% right):

**Left — Community Settings Panel**
White card:
- Community name (editable inline — click to edit, orange underline indicates edit mode)
- Description (editable textarea)
- Join Link display: read-only input + "Copy Join Link" orange button
- QR Code: 100×100px, "Download QR" ghost link below
- "Save Changes" primary button (appears on edit) + "Archive Community" danger ghost link at bottom

**Right — Members Panel**
White card:
- "Invite by Email" strip at top: email input + "Send Invite" orange button, row layout
- Member count heading: "48 Members" Times New Roman 18px
- Member table: Name · Email · Join Date · Status badge (Member / Pending) · "Remove" ghost danger link per row
- "Post Opportunity" dropdown button (secondary, right-aligned above table): opens dropdown of company's published jobs → selecting one posts that job to the community feed

---

**Mock Data**
```
React & Frontend Talent Pool  | 48 Members | Tech Professionals | Open
Edinburgh CS Grads 2024       | 23 Members | University Alumni  | Invite Only
Early Talent Pipeline         | 61 Members | University Students| Open
```

---

**Navigation Flow**
```
Community → Community Detail   (Manage →)
Community Detail → /company/jobs   (Post Opportunity → job selection)
```

---

## PORTAL 4 — ADMIN

---

### Screen 21 — Admin Dashboard

**Route:** `/admin/dashboard`
**Portal:** Admin only

**Purpose:** Platform-wide control centre — macro KPIs, pending company approvals queue, registration trends chart, and a live activity log. Data-dense but clear hierarchy ensures urgent items (pending approvals) are impossible to miss.

---

**Sidebar**
- "Intelli-Hire *Admin*" wordmark — orange italic on "Admin"
- Nav: Dashboard (active) · User Management · Company Management · Platform Settings
- Bottom: "Super Admin" role badge — dark `#0D0D0D` background, white text pill — distinct from company user roles

---

**Top Bar**
- "Admin *Dashboard*" Times New Roman 22px, orange italic
- Admin name + avatar right. Avatar: `#0D0D0D` background initials (dark — visually distinct from company avatar orange)

---

**⚠️ Pending Approvals Alert Banner** (conditional — shown when pending > 0)

Full-width banner directly below top bar:
- Background `#FFFBEB`, left border `4px solid #D97706`
- Icon: `🔔` or bell SVG `#D97706`
- Text: "**3 companies** are awaiting approval. Review and activate their accounts." Inter 14px `#92400E`
- "Review Now →" text link `#F04E23`, hover underline
- Smooth slide-down on load (150ms ease), stays pinned (not dismissible — action required)

---

**KPI Cards Row** — 5 cards, equal columns (slightly narrower padding due to count), 12px gap

- **Total Individual Users:** "12,847" Times New Roman 40px `#0D0D0D`. Trend: "+45 today" Inter 12px `#059669`
- **Total Companies:** "854". Trend: "+1 today" success green
- **Active Job Postings:** "2,341"
- **Interview Sessions This Month:** "8,924". Trend orange `#F04E23` — the platform's core metric, highlighted
- **Pending Approvals:** "3" — this card differs: `#FFFBEB` background, `1px solid #F59E0B` border, value Times New Roman 40px `#D97706` (amber, not black). Bottom: amber pill "3 Pending". Hover: border `#F04E23`, slight lift — signals clickability → smooth scrolls to approval table below

Counter animations on page load, staggered 100ms per card.

---

**Charts + Activity — Two Column (65% left / 35% right)**

**Left — 30-Day Registration Chart**

White card, heading "User Registrations" Times New Roman 18px + "Last 30 Days" Inter 12px `#9CA3AF` right.

Clean line chart:
- X-axis: dates Apr 9 → May 8, Inter 11px `#9CA3AF`, every 5th date labelled
- Y-axis: count values, Inter 11px `#9CA3AF`, minimal 4 grid lines in `#F3F4F6`
- Line 1: Individuals — `#F04E23` (orange), 2px stroke, smooth curve
- Line 2: Companies — `#059669` (green), 2px stroke, smooth curve
- Data points: 4px filled circles, appear on hover with tooltip (white card, `1px border`, 6px radius: "May 5 · 89 individuals · 4 companies")
- Legend below chart: "● Individuals   ● Companies" Inter 12px, colors matching lines
- Chart draws left-to-right on page load with 800ms ease animation

**Right — Platform Activity Log**

White card, heading "Platform Activity" Times New Roman 18px:
- Scrollable list, max-height 320px, custom scrollbar (thin, `#E5E7EB` track, `#F04E23` thumb)
- Each item: colored left dot (blue `#3B82F6` = user event, `#059669` green = company event, `#DC2626` red = admin action) + event text Inter 13px `#374151` + "2h ago" Inter 12px `#9CA3AF` right-aligned
- `1px solid #F3F4F6` divider between items
- Scroll-reveal: first 8 items fade in staggered 40ms

Mock activity:
```
● New company registered: GlobalTech (2h ago)
● 45 new candidates registered today (3h ago)
● Company approved: Meridian Corp (4h ago)
● Interview milestone: 10,000th session (6h ago)
● User suspended: spam@example.com (8h ago)
```

---

**Pending Company Approvals Table** (full-width, below charts)

White card, heading "Pending Company Approvals" Times New Roman 18px + amber pulsing dot indicator right of heading if count > 0:
- Columns: Company Name · Owner Email · Industry · Registered · Status · Actions
- Status: amber "Pending" pill with small pulsing dot animation (opacity 1 → 0.4 → 1, 2s loop)
- Actions per row: "Approve ✓" success green button (36px, 8px radius) + "Reject ✗" danger ghost button

**Approve flow:** Confirmation modal — "Approve **NexusTech Ltd**?" body: "This will activate their account and notify the owner." Primary orange "Confirm Approval" + "Cancel". On confirm: row status updates inline to "Active" success badge, orange toast "✓ NexusTech Ltd approved."

**Reject flow:** Modal with "Reason for rejection" textarea (required, min 10 chars, char counter), "Reject Company" danger button. On confirm: row updates to "Rejected" danger badge, red toast "✗ NexusTech Ltd rejected."

---

**Mock Data**
```
KPIs: 12,847 users | 854 companies | 2,341 jobs | 8,924 sessions | 3 pending

Pending:
NexusTech Ltd    | ceo@nexustech.com     | Technology  | May 06, 2025
BuildCo Staffing | hr@buildco.com        | Recruitment | May 07, 2025
AlphaMedia Group | talent@alphamedia.com | Media       | May 07, 2025
```

---

**Navigation Flow**
```
Admin Dashboard → /admin/management              (User Management sidebar)
Admin Dashboard → /admin/management?tab=companies (Company Management sidebar)
Admin Dashboard → pending approvals table         ("Review Now →" smooth scroll)
```

---

### Screen 22 — User & Company Management

**Route:** `/admin/management`
**Portal:** Admin only

**Purpose:** Primary admin operational screen. Search, filter, view, suspend, activate, approve, and reject both individual users and company accounts. Two tabs, unified design, maximum information density without clutter.

---

**Page Header**
- "User & Company *Management*" Times New Roman 28px, orange italic on "Management"

---

**Tab Switcher**

Directly below header, `1px solid #E5E7EB` bottom border on the tab container:
- "👤 Users" tab · "🏢 Companies" tab
- Inactive: Inter 14px weight 500 `#9CA3AF`
- Active: Inter 14px weight 500 `#0D0D0D` + `2px solid #F04E23` bottom underline
- Underline slides to active tab on switch, 200ms ease — smooth indicator animation
- No background fills on tabs — text + underline only

---

## USERS TAB (default active)

**Filter Bar**
White card, 16px padding, flex row, 12px gap:
- Search input "Search by name or email…" 240px, magnifier icon, clear ×
- Role filter dropdown (All Roles / Individual / HR Manager / Recruiter) 160px
- Status filter (All / Active / Suspended) 140px
- Filters update table in real-time, 150ms debounce on search

**Users Table**
White card, full-width:

Columns: Name · Email · Role · Status · Registered · Actions

- **Name:** Inter 14px weight 500 `#0D0D0D`
- **Email:** Inter 13px `#374151`, hover: `#F04E23` underline (clickable mailto)
- **Role badges:** Individual (neutral grey) · HR Manager (orange `#FFF4F1 / #F04E23`) · Recruiter (muted `#F3F4F6 / #374151`)
- **Status badges:** Active (success green) · Suspended (danger red)
- **Registered:** Inter 13px `#9CA3AF`
- **Actions:** "View ▸" ghost link `#F04E23` + "Suspend" amber small button (36px) for active rows / "Activate" success green small button for suspended rows

**Suspend flow:** Confirmation popover (not full modal — inline below action): "Suspend [Name]? They will lose access immediately." Confirm (amber) + Cancel. On confirm: status badge updates inline danger, amber toast.

**View action:** Slide-in panel from right (400px, `translateX(100%) → translateX(0)` 200ms, backdrop `rgba(0,0,0,0.20)`):
- User full details: name, email, role, status, registered date, last active, all jobs applied to (for candidates), or all jobs managed (for HR/recruiters)
- "Close ×" top-right of panel
- "Suspend" or "Activate" button at panel bottom

**Pagination:** 25 rows/page. "Showing 1–25 of 12,847 users" Inter 13px `#9CA3AF` left + Prev / Next secondary buttons right. Current page bold `#0D0D0D`.

---

**Mock Data — Users**
```
Priya Patel   | priya@email.com  | Individual  | Active    | May 01, 2025 | View / Suspend
James Wilson  | james@email.com  | Individual  | Active    | Apr 28, 2025 | View / Suspend
Ahmed Malik   | ahmed@email.com  | Individual  | Active    | Apr 20, 2025 | View / Suspend
Sarah Lee     | sarah@acme.com   | HR Manager  | Active    | Feb 01, 2025 | View / Suspend
Tom Evans     | tom@evil.com     | Individual  | Suspended | Mar 14, 2025 | View / Activate
```

---

## COMPANIES TAB

**Filter Bar**
Same structure as Users tab:
- Search "Search by company name or email…" 240px
- Status filter (All / Active / Pending / Suspended) 160px

**Companies Table**
White card, full-width:

Columns: Company Name · Owner Email · Industry · Status · Registered · Actions

- **Company Name:** Inter 14px weight 500 `#0D0D0D`
- **Status badges:** Active (success green) · Pending (amber warning) · Suspended (danger red)
- **Actions (context-sensitive per status):**
  - Active: "View ▸" + "Suspend" amber button
  - Pending: "View ▸" + "Approve ✓" green button + "Reject ✗" danger ghost button
  - Suspended: "View ▸" + "Activate" green button

Pending rows: Company Name cell shows a small amber pulsing dot left of name — draws attention without color on the whole row.

**Approve / Reject / Suspend flows:** Same modal patterns as Screen 21 (approve = confirm modal, reject = reason textarea modal, suspend = confirm popover).

**View action (slide-in panel, 400px):**
Read-only company dossier:
- Company logo (or initials fallback, 48px, orange bg) + name Times New Roman 20px
- Industry · Company size · Website (clickable link) · Join date
- Description (full, not truncated)
- Team size and member count
- All active job postings (linked list, 5 shown max + "View all jobs" orange link)
- Status + admin action button at panel bottom ("Suspend" or "Activate" or "Approve / Reject" per current status)

---

**Shared Table Behaviours (Both Tabs)**

- **Column sorting:** click header → arrow appears `↑↓` in orange. API re-sorts. Active sort column header text `#F04E23`
- **Row hover:** `#FAFAFA` background, 120ms transition
- **Toast confirmations:** All admin actions produce right-aligned toast, orange left bar (success) or red left bar (reject/suspend)
- **Skeleton loading:** When tab switches or filters change, table rows replaced by 6 shimmer skeleton rows for 300ms, then real data fades in
- **Empty state:** When search/filter yields 0 results — centred illustration (simple line art, `#E5E7EB` tint) + "No results found" Times New Roman 18px `#9CA3AF` + "Clear Filters" orange ghost button

---

**Navigation Flow**
```
Management → stays on /admin/management   (all tab/filter/action updates inline)
Management → /admin/dashboard             (sidebar)
```

---

*End of Intelli-Hire Screens 10–22 Refined Design Specification*
*Design System: White · Black · Premium Orange (#F04E23) · Inter + Times New Roman*
