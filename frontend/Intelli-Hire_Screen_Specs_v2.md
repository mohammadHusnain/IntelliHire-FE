# Intelli-Hire — Frontend Screen Specifications v2
# 22 Screens | Portal-Based White UI | World-Class UX | Antigravity Implementation Guide

---

## ═══════════════════════════════════════════════════
## MASTER PORTAL & NAVIGATION ARCHITECTURE
## ═══════════════════════════════════════════════════

### Four Portals, One Codebase

Intelli-Hire serves four distinct user types, each routing to their own portal after authentication. All portals share the same base URL domain with path-based separation.

```
PUBLIC (Unauthenticated)
  /                          → Screen 1  — Landing Page
  /login                     → Screen 2  — Login Page
  /register                  → Screen 3  — Register Page

CANDIDATE PORTAL  (role = individual)
  /candidate/dashboard       → Screen 4  — Candidate Dashboard
  /candidate/profile         → Screen 5  — Profile & CV Setup
  /candidate/interview/setup → Screen 6  — Mock Interview Setup
  /candidate/interview/room  → Screen 7  — Live AI Interview Room
  /candidate/report/:id      → Screen 8  — Interview Feedback Report
  /candidate/reports         → Screen 9  — My Reports / History

COMPANY PORTAL  (role = company | hr_manager | recruiter)
  /company/pending           → Screen 10 — Company Awaiting Approval [NEW]
  /company/onboarding        → Screen 11 — Company Onboarding / Profile Setup
  /company/dashboard         → Screen 12 — Company Dashboard
  /company/team              → Screen 13 — Team Management
  /company/jobs              → Screen 14 — Job Postings List
  /company/jobs/create       → Screen 15 — Create / Edit Job Opening
  /company/jobs/:id/preview  → Screen 16 — Application Form Preview & Link Sharing
  /company/jobs/:id/candidates → Screen 17 — Candidates List (Per Job)
  /company/candidates/:id    → Screen 18 — Candidate Profile & Evaluation Report
  /company/analytics         → Screen 19 — Recruiter Analytics Dashboard
  /company/community         → Screen 20 — Community Management

ADMIN PORTAL  (role = admin)
  /admin/dashboard           → Screen 21 — Admin Dashboard
  /admin/management          → Screen 22 — User & Company Management
```

---

## ═══════════════════════════════════════════════════
## AUTHENTICATION WORKFLOW — DEFINITIVE RULES
## ═══════════════════════════════════════════════════

### Who Can Register

| Account Type         | Can Self-Register? | Registration Path                          |
|----------------------|--------------------|--------------------------------------------|
| Individual (Job Seeker) | ✅ Yes          | /register → select "I am a Job Seeker"     |
| Company              | ✅ Yes             | /register → select "I am a Company"        |
| Admin                | ❌ No              | Admin accounts are seeded internally only. No UI option. |

The Register page presents exactly two choices: **Job Seeker** or **Company**. There is no "Admin" option anywhere in the public UI. Admin credentials are provisioned only via database seed or internal CLI.

### Company Registration → Approval Flow

When a company completes registration:
1. Account is created with `status = pending_approval`
2. Admin receives a notification (platform alert + email)
3. Company user logs in → sees Screen 10 (Awaiting Approval screen)
4. Admin approves → company status changes to `active`
5. Company user receives approval email with login link
6. Next login → routed to Onboarding (Screen 11, if first time) or Company Dashboard (Screen 12)

### Who Can Log In

All roles use the **same single login page** at `/login`. The system reads the `role` and `status` fields from the auth response and routes accordingly:

| Role                    | Status            | Route After Login                   |
|-------------------------|-------------------|-------------------------------------|
| individual              | active            | /candidate/dashboard (Screen 4)     |
| company / hr / recruiter| pending_approval  | /company/pending (Screen 10)        |
| company / hr / recruiter| active            | /company/onboarding OR /company/dashboard |
| admin                   | active            | /admin/dashboard (Screen 21)        |

**Company onboarding logic:** If `company.profile_complete = false` → route to /company/onboarding (Screen 11). Otherwise → /company/dashboard (Screen 12).

### Route Guards

- Any `/candidate/*` route visited by a non-individual user → redirect to their correct dashboard
- Any `/company/*` route visited by individual or admin → redirect to their dashboard
- Any `/admin/*` route visited by non-admin → redirect to /login
- Any authenticated user visiting /login or /register → redirect to their dashboard
- Any unauthenticated user visiting protected routes → redirect to /login

---

## ═══════════════════════════════════════════════════
## PORTAL 1 — PUBLIC / AUTH   (Screens 1–3)
## ═══════════════════════════════════════════════════

---

### Screen 1 — Landing Page

**Route:** `/`
**Portal:** Public

**Purpose:** The public-facing entry point that introduces Intelli-Hire to both individual candidates and hiring companies, establishing the platform's dual-purpose value with confident, elegant copy before any login.

**UX Philosophy:** Hireflix-inspired clean white architecture. No decorative gradients, no dark hero sections, no overwhelming imagery. Pure white (#FFFFFF) background with immaculate whitespace, strong serif headlines in Times New Roman, and one confident hero message. CTAs are blue and purposeful. The page breathes.

**Key UI Components:**

- **Top Navigation Bar:** Fixed, white background (#FFFFFF), 1px bottom border (#EEEEEE). Left: "Intelli-Hire" wordmark in Times New Roman bold, dark ink (#111827). Right: Ghost "Log In" button + solid blue "Get Started" button. Nav links between logo and auth buttons: "For Candidates", "For Companies", "Pricing" (simple text links, no mega menus). On scroll: nav gains a subtle `box-shadow: 0 1px 8px rgba(0,0,0,0.06)`.

- **Hero Section:** Full-viewport-height (min 90vh). Pure white background. Large centred layout — overline label in uppercase tracking-widest grey text: "AI-POWERED INTERVIEW PLATFORM". Headline in Times New Roman, 72px, weight 700, colour #111827, line-height 1.1, max 2 lines. Subheadline in Times New Roman Regular, 20px, #6B7280, max 480px wide, centred. Two CTA buttons side by side: Primary "Practice Interviews →" (blue, solid), Secondary "Hire Smarter →" (blue outline/ghost). Below CTAs: a row of trust signals — "12,000+ Candidates Trained · 850+ Companies Hiring · AI-Powered · Free to Start". Hero image/illustration: a floating mock UI card on the right (desktop) showing an AI interview in progress, rendered as a clean product screenshot with subtle drop shadow. On mobile: illustration collapses below the text.

- **Social Proof Strip:** Full-width strip below hero, light grey background (#F9F9F9), 1px top/bottom borders (#EEEEEE). Centre-aligned text: "Trusted by teams at" followed by 5 placeholder company logos in greyscale (mock: TechCorp, Nexus HR, AlphaRecruit, BuildCo, Meridian Group).

- **Dual-Feature Section:** Two-column layout, max-width 1200px, centred, generous padding. Left column (Candidate benefits) headed "For Job Seekers" in Times New Roman 32px. Right column (Company benefits) headed "For Hiring Teams" in Times New Roman 32px. Each column has 4 feature rows — each row is an icon (line icon, 24px, blue) + short bold title + one-line description. Subtle vertical divider (#EEEEEE line) between the two columns. No cards with heavy borders — just clean rows with generous line spacing.

- **How It Works Section:** White background. Centre-aligned heading "How It Works" in Times New Roman 40px. Two rows stacked: "For Candidates" and "For Companies". Each row has 3 steps displayed as: Step number circle (blue outline) + Title + 1-sentence description. Steps connected by a thin dashed blue horizontal line on desktop. Clean, airy, readable.

- **Testimonial Strip:** Light grey tinted section. Three testimonial quote cards in a row. Each card: large grey quotation mark, quote text in Times New Roman italic 18px, author name in bold, role below in grey. Cards have white background, 1px #EEEEEE border, 12px border-radius, generous padding. Clean and editorial.

- **Final CTA Section:** White background, centre-aligned. Headline "Ready to Transform Your Interview Game?" in Times New Roman 44px. Two buttons: "Start Practicing Free" (primary blue) + "Post Your First Job" (ghost blue). Below: "No credit card required. Set up in 2 minutes."

- **Footer:** White background, 1px top border (#EEEEEE). Two rows: Top row — logo left, nav links centre (For Candidates, For Companies, Pricing, Blog, Contact, Privacy), social icons right. Bottom row — copyright text left, "Made with AI" badge right.

**Layout Structure:** Fixed top navbar → min-90vh hero → trust strip → dual-feature section (2-col) → how-it-works → testimonials → final CTA → footer. All sections full-width; max-width 1200px centred content. 80–120px top/bottom padding per section.

**Mock Content:**
- Hero headline: "Practice Smarter. Hire Better. All in One Place."
- Subheadline: "AI-powered mock interviews for candidates, and intelligent screening tools for hiring teams."
- Trust signals: "12,000+ Candidates · 850+ Companies · 98% Satisfaction Rate"
- Candidate features: AI Mock Interviews / Personalised Feedback / CV-Matched Questions / Progress Tracking
- Company features: AI Candidate Screening / Smart Job Postings / Interview Analytics / Talent Communities
- Testimonial 1: "Intelli-Hire cut our screening time by 70%. The AI reports are remarkably accurate." — Sarah Chen, Head of Talent, TechCorp
- Testimonial 2: "I went from nervous in interviews to confident and prepared in just two weeks." — Ahmed Malik, Software Engineer
- Testimonial 3: "Finally, a platform that serves both sides of the hiring equation beautifully." — Maria Torres, HR Director

**Core Functionalities:**
- "Practice Interviews →" CTA → /register?role=individual (role pre-selected on Register page)
- "Hire Smarter →" CTA → /register?role=company (role pre-selected on Register page)
- "Log In" in navbar → /login
- "Get Started" in navbar → /register
- If user is already authenticated → navbar shows avatar instead of auth buttons; CTAs redirect to their respective dashboards
- Smooth scroll between sections (no hash-link jitter)
- Navbar active states for "For Candidates" / "For Companies" links highlight on scroll position

**Validation:** None required.

**Navigation Flow:**
```
Landing → /login           (navbar Log In)
Landing → /register        (navbar Get Started, or CTA buttons with role param)
Landing → /candidate/dashboard  (if already logged in as individual)
Landing → /company/dashboard    (if already logged in as company)
Landing → /admin/dashboard      (if already logged in as admin)
```

**Role-Based Visibility:** Fully public. No authentication required.

---

### Screen 2 — Login Page

**Route:** `/login`
**Portal:** Public (Auth)

**Purpose:** A single, elegant login screen serving all roles — Individual, Company/HR/Recruiter, and Admin — with role-based routing after successful authentication.

**UX Philosophy:** Inspired by the clean, minimal card-based authentication pages of top SaaS products. A centred white card on a very light (#FAFAFA) background. No distractions. No sidebars. The card itself feels spacious and confident, not cramped. Times New Roman headlines give it a sophisticated editorial quality.

**Key UI Components:**

- **Page Layout:** Full-viewport light background (#FAFAFA). Centred white card (max-width 420px, padding 48px 40px) with very subtle shadow (`box-shadow: 0 4px 24px rgba(0,0,0,0.08)`) and 12px border-radius.

- **Card Content (top to bottom):**
  - Platform wordmark "Intelli-Hire" in Times New Roman bold, 22px, #111827, centred
  - Heading "Welcome back" in Times New Roman Regular, 30px, #111827, centred, margin-top 24px
  - Subtext "Log in to your account" in 14px #6B7280, centred
  - Divider space (24px)
  - Email label + input (full-width, 44px height, 8px border-radius, 1px #DDDDDD border, Times New Roman 15px, focus ring blue)
  - Password label + input (full-width, same styling) with show/hide eye icon toggle inside the field on the right
  - "Forgot password?" text link right-aligned below password field, 13px, blue, no underline by default, underline on hover
  - "Log In" primary button (full-width, 44px, blue #2563EB background, white text, Times New Roman Medium 15px, 8px border-radius) — shows spinner on click while loading
  - Thin horizontal divider (1px #EEEEEE) with "or" in centre (14px grey text)
  - "Don't have an account?" text centred, "Create one here" as inline blue link

- **Error States:**
  - Inline field errors: red (#DC2626) border on the field + small red text below field: "Please enter a valid email address" / "Password must be at least 6 characters"
  - Auth failure banner: full-width amber/red banner above the form inside the card: "The email or password you entered is incorrect. Please try again." — with an X dismiss button

- **Loading State:** Login button shows a spinning loader icon replacing the text while the auth request is in flight. Button is disabled during loading.

- **Success Routing (invisible to user — happens server-side):**
  - role=individual → /candidate/dashboard
  - role=company + status=pending → /company/pending
  - role=company + status=active + profile_complete=false → /company/onboarding
  - role=company + status=active + profile_complete=true → /company/dashboard
  - role=hr_manager or recruiter → /company/dashboard
  - role=admin → /admin/dashboard

**Layout Structure:** Full page #FAFAFA background. Single white card, vertically and horizontally centred on page (Flexbox: `min-height: 100vh; display: flex; align-items: center; justify-content: center`). Intelli-Hire logo/wordmark at the very top of the card.

**Forms / Buttons:**
- Email input (type=email, placeholder="you@example.com")
- Password input (type=password, placeholder="Your password", with show/hide toggle)
- "Log In" primary button (full-width)
- "Forgot password?" text link → opens password reset flow (modal overlay with email input + "Send Reset Link" button)
- "Create one here" inline link → /register

**Validation:**
- Email: required, valid email format. Inline error below field on blur or submit.
- Password: required, minimum 6 characters. Inline error below field.
- On auth failure: non-specific banner ("Incorrect email or password") — do not indicate which field is wrong for security.

**Navigation Flow:**
```
Login → /candidate/dashboard      (successful login, role=individual)
Login → /company/pending          (successful login, company awaiting approval)
Login → /company/onboarding       (successful login, company first login)
Login → /company/dashboard        (successful login, company active + profile set)
Login → /admin/dashboard          (successful login, role=admin)
Login → /register                 ("Create one here" link)
Login → Forgot Password modal     ("Forgot password?" link)
```

**Role-Based Visibility:** Public. Authenticated users visiting /login are redirected to their dashboard automatically.

---

### Screen 3 — Register Page

**Route:** `/register`
**Portal:** Public (Auth)

**Purpose:** New user account creation. Supports two and only two account types: Individual (Job Seeker) and Company. Admin accounts cannot be created here.

**UX Philosophy:** A two-step registration experience that begins with a clear, friendly role selector before revealing the form. The role selector is visually prominent and makes the choice feel deliberate. The subsequent form is short and purposeful — no friction.

**Key UI Components:**

- **Page Layout:** Full-viewport #FAFAFA background. Centred white card (max-width 480px, padding 48px 40px, 12px border-radius, subtle shadow).

- **Card Header:** Wordmark "Intelli-Hire" centred at top. Heading "Create your account" in Times New Roman 30px. Subtext "Join thousands of candidates and hiring teams." in 14px grey.

- **Step 1 — Role Selector (always visible at top of card):**
  Two large equal-width selection cards side by side with 12px gap between them. Each card:
  - Height: ~100px
  - Background: white, 1.5px border #DDDDDD, 10px border-radius
  - Icon centred top (line icon, 28px blue): person icon for Job Seeker, building icon for Company
  - Card title below icon: "I'm a Job Seeker" / "I'm Hiring" (Times New Roman Medium 15px)
  - One-line descriptor: "Practice & track interviews" / "Post jobs & find talent" (12px grey)
  - **Selected state:** 2px solid blue (#2563EB) border, blue tint background (#EFF6FF), small blue checkmark badge in top-right corner of card
  - Hover state: 1.5px #AAAAAA border, slight scale(1.01) transform
  - If URL param `?role=individual` or `?role=company` is present, pre-select the corresponding card on load

- **Step 2 — Registration Form (appears below role selector after selection, with smooth height animation):**

  **Individual (Job Seeker) Form Fields:**
  - Full Name (text input, placeholder="Jane Smith")
  - Email Address (email input, placeholder="jane@example.com")
  - Password (password input, placeholder="Create a password", with strength indicator bar below: 4 segments — Weak / Fair / Good / Strong)
  - Confirm Password (password input, placeholder="Confirm your password")

  **Company Form Fields:**
  - Company Name (text input, placeholder="Acme Corp")
  - Your Full Name (text input, placeholder="John Smith")
  - Work Email (email input, placeholder="john@acmecorp.com")
  - Industry (dropdown: Technology / Finance / Healthcare / Education / Retail / Manufacturing / Media / Other)
  - Password (password input with strength indicator)
  - Confirm Password (password input)

- **Terms line:** "By creating an account, you agree to our Terms of Service and Privacy Policy." (12px grey, links in blue). Unchecked checkbox to the left that must be ticked before Create Account is enabled.

- **"Create Account" Primary Button:** Full-width, 44px, blue, disabled until all fields valid + checkbox ticked. Shows spinner during submission.

- **Success State:** The card transitions (fade) to a success view:
  - Large green checkmark icon (animated)
  - "Account Created!" heading in Times New Roman
  - For individuals: "Check your email inbox to verify your account, then log in."
  - For companies: "Your account is under review. We'll email you once approved (typically within 24 hours)."
  - "Back to Login" button (ghost blue)

- **"Already have an account? Log in"** link at the very bottom of the card.

**Forms / Buttons:**
- Role selector (two clickable cards)
- Dynamic form fields (based on role)
- Terms checkbox
- "Create Account" primary button
- "Already have an account? Log in" link → /login

**Validation:**
- All fields required for their role form
- Email: valid format; if already registered → "An account with this email already exists. Log in instead?"
- Password: minimum 8 characters, show strength indicator live as user types
- Confirm Password: must match Password exactly; inline error on blur: "Passwords do not match"
- Company Name: minimum 2 characters
- Industry: required selection from dropdown
- Terms checkbox: must be checked; if unchecked on submit → small red text below: "Please accept the terms to continue"

**Navigation Flow:**
```
Register → /login                    ("Already have an account?" link)
Register → Success State → /login    (after successful registration)
Register (with ?role=individual)     → Job Seeker card pre-selected
Register (with ?role=company)        → Company card pre-selected
```

**Role-Based Visibility:** Public. Authenticated users are redirected to their dashboard.

---

## ═══════════════════════════════════════════════════
## PORTAL 2 — INDIVIDUAL CANDIDATE   (Screens 4–9)
## ═══════════════════════════════════════════════════

**Portal Design Rules:**
- Sidebar: White (#FFFFFF) background, 1px right border (#EEEEEE), 240px wide, fixed
- Top bar: White (#FFFFFF), 1px bottom border (#EEEEEE), 64px tall
- Page background: #FAFAFA (very light off-white)
- Cards: #FFFFFF background, 1px #EEEEEE border, 10px border-radius, no heavy shadows
- Active sidebar item: blue left border (3px solid #2563EB) + light blue background (#EFF6FF) + blue text
- All text: Times New Roman family
- Primary CTA buttons: #2563EB blue, white text, 8px border-radius

---

### Screen 4 — Candidate Dashboard

**Route:** `/candidate/dashboard`
**Portal:** Individual Candidate

**Purpose:** The home screen for individual users after login — a personal coaching hub showing interview activity, progress, and an encouraging entry point to start a new session.

**Key UI Components:**

- **Left Sidebar Navigation:**
  - Logo/wordmark "Intelli-Hire" at top (20px Times New Roman bold, with subtle brand icon)
  - Nav items (top-to-bottom): 🏠 Dashboard (active) · 👤 My Profile · 🎙️ Start Interview · 📊 My Reports
  - Bottom of sidebar: User avatar circle + user name + "Log out" text link (12px grey)
  - Each nav item: icon + label, 40px height, 16px horizontal padding, Times New Roman 14px

- **Top Bar:**
  - Left: Current page title "Dashboard" in Times New Roman Medium 18px #111827
  - Right: Greeting "Good morning, Alex 👋" in 14px grey + user avatar (32px circle, initials fallback)

- **Welcome Banner:**
  - Full-width white card, 1px #EEEEEE border, 20px padding
  - Headline: "Ready for your next interview, Alex?" in Times New Roman 24px
  - Sub: "You've improved your score by 12 points in the last 7 days. Keep going."
  - Right side: "Start New Interview →" primary blue button

- **Stat Cards Row (3 cards across):**
  Each card: white bg, 1px #EEEEEE border, 10px radius, 20px padding
  - **Total Sessions:** Large number "14" in Times New Roman 48px bold, label "Sessions Completed" in 13px grey below, small grey bar chart sparkline at bottom
  - **Average Score:** "73/100" in Times New Roman 48px bold, label "Avg. Interview Score", small line trend below showing last 5 sessions
  - **Improvement Trend:** "+18%" in Times New Roman 48px bold green (#16A34A), label "Score Improvement (last 30 days)", upward arrow icon

- **Recent Sessions Section:**
  Heading "Recent Sessions" in Times New Roman Medium 16px + "View All →" link right-aligned.
  Three session summary cards in a column (or 3-col grid on wide screens):
  Each card: white bg, 1px #EEEEEE border, 12px radius, 16px padding, hover → slight border colour shift to #CCCCCC
  - Session card content: Role name in bold Times New Roman 15px · Date in grey 13px · Interview type pill badge · Overall score badge (colour-coded green/amber/red) · "View Report →" small link

- **Right Column — Quick Tips:**
  White card, 1px border, 10px radius. Heading "Suggested for You" in Times New Roman Medium 14px grey.
  3 tip cards:
  - Each: small icon + short tip title (bold 14px) + one-line tip (13px grey)
  - Separator between tips: 1px #F0F0F0 horizontal rule

**Mock Data — Stat Cards:**
```
Total Sessions: 14
Average Score: 73/100
Improvement Trend: +18%
```

**Mock Data — Recent Sessions:**
```
Session 1: Frontend Developer · Apr 28 2025 · Technical · Score: 82/100 (green)
Session 2: Product Manager · Apr 21 2025 · Role-Specific · Score: 69/100 (amber)
Session 3: Data Analyst · Apr 14 2025 · General · Score: 61/100 (amber)
```

**Mock Data — Quick Tips:**
```
Tip 1: Use the STAR method for behavioural questions → STAR structures your answers clearly.
Tip 2: Practise pausing before answering → 2 seconds of pause shows confidence.
Tip 3: Complete your profile → CV-matched questions dramatically improve relevance.
```

**Core Functionalities:** "Start New Interview" button → /candidate/interview/setup. Each session card is clickable → /candidate/report/:id. Sidebar links highlight active page. Stats animate in (count-up) on first load.

**Navigation Flow:**
```
Dashboard → /candidate/interview/setup   (Start New Interview button)
Dashboard → /candidate/reports           (View All link / sidebar)
Dashboard → /candidate/profile           (sidebar)
Dashboard → /candidate/report/:id        (session card click)
```

---

### Screen 5 — Profile & CV Setup

**Route:** `/candidate/profile`
**Portal:** Individual Candidate

**Purpose:** Allows the individual user to maintain their profile and upload their CV, which the AI uses to generate personalised, role-relevant interview questions.

**Key UI Components:**

- **Page Header Row:** "My Profile" in Times New Roman Medium 22px · "Save Changes" primary blue button right-aligned

- **Profile Completeness Bar:**
  Full-width white card, subtle border. Text: "Your profile is 60% complete — add your Skills and CV to unlock AI-personalised questions." Progress bar (60% blue fill). 8px border-radius on bar.

- **Two-Column Layout:**

  **Left Column — Profile Card (30% width):**
  White card, border, 10px radius, 24px padding, centred content.
  - Avatar upload circle (96px diameter): shows initials by default, click to upload image, camera icon overlay on hover
  - Name in Times New Roman 20px bold below avatar
  - Job title in 14px grey below name
  - Location in 13px grey with pin icon
  - "Edit Photo" small text link below the circle

  **Right Column — Profile Form (70% width):**
  White card, border, 10px radius, 24px padding.
  Fields stacked with 16px gap:
  - Full Name (text, required)
  - Current Job Title (text, placeholder="e.g. Junior Software Engineer")
  - Location (text, placeholder="e.g. London, UK")
  - LinkedIn URL (url input, placeholder="https://linkedin.com/in/yourname")
  - Skills (tag input: type skill + Enter to add; each tag renders as a blue pill with an × to remove; placeholder="e.g. JavaScript, Python...")
  - Bio (textarea, 4 rows, placeholder="Tell us about yourself in 2–3 sentences.", character counter below right: "0/300")

- **CV Upload Section:**
  Full-width white card below the two-column section. Heading "Resume / CV" in Times New Roman Medium 16px.
  - Upload zone: dashed 2px #DDDDDD border, 10px radius, 80px tall, centred content — upload icon (24px blue) + "Drag & drop your CV here, or click to browse" (14px grey) + "PDF only · Max 5MB" (12px lighter grey)
  - If CV uploaded: replaces drop zone with a single-row file card: 📄 file icon + "Alex_Resume_2025.pdf" (14px bold) + "2.1 MB" (12px grey) + "Remove" text link (red, small)
  - Upload success toast: green "CV uploaded successfully" at the top of the page

**Mock Data (pre-filled):**
```
Full Name: Alex Johnson
Current Title: Frontend Developer
Location: London, UK
LinkedIn: linkedin.com/in/alexjohnson
Skills: JavaScript · React · TypeScript · HTML/CSS · Git
Bio: Passionate frontend developer with 2 years of experience building responsive web apps. 
     Looking to level up my interview skills and land my next role.
CV: Alex_Resume_2025.pdf (2.1 MB) — shown as uploaded
```

**Validation:** Full Name required. LinkedIn must be valid URL if provided. Bio max 300 chars. CV: PDF only, max 5MB — if wrong file type dropped, show red warning inside drop zone: "Only PDF files are accepted."

**Navigation Flow:**
```
Profile → stays on /candidate/profile   (Save triggers success toast)
Profile → /candidate/dashboard          (sidebar)
```

---

### Screen 6 — Mock Interview Setup

**Route:** `/candidate/interview/setup`
**Portal:** Individual Candidate

**Purpose:** Pre-interview configuration where the user selects interview type and target role before the AI session begins.

**Key UI Components:**

- **Page Header:** "Set Up Your Interview" in Times New Roman 26px. Breadcrumb above: Dashboard > Start Interview.

- **Two-Column Layout:**

  **Left Column (65%) — Step Configuration:**

  Step 1 — Interview Type (visible immediately):
  - Section label "Step 1 — Choose Interview Type" in Times New Roman Medium 14px grey uppercase tracking
  - Three selection cards in a row (each ~30% width, 90px tall):
    - **General** (💬 icon): "Broad soft skills & communication"
    - **Technical** (⚙️ icon): "Domain knowledge & problem-solving"
    - **Role-Specific** (🎯 icon): "Targeted questions for your exact role"
  - Selected state: 2px blue border, blue tint background, checkmark top-right

  Step 2 — Target Role (visible once Step 1 selected):
  - Section label "Step 2 — What role are you preparing for?" in same style
  - Searchable dropdown input (type to filter or type a custom role)
  - Common roles pre-populated: Software Engineer · Frontend Developer · Product Manager · Data Analyst · UX Designer · Marketing Manager · Business Analyst · DevOps Engineer · Project Manager · Graphic Designer
  - If custom role typed: shows "Use '[typed role]'" as an option at top of dropdown

  Step 3 — CV Personalisation (visible once Step 2 filled):
  - Section label "Step 3 — Personalise Your Questions" in same style
  - Toggle switch: "Use my CV for AI-matched questions" — ON by default if CV is uploaded
  - If no CV: toggle is greyed out with note: "Upload a CV in My Profile to enable AI personalisation."
  - When ON: small note below: "The AI will reference your skills and experience from Alex_Resume_2025.pdf"
  - Estimated session length: "Estimated session: 8 questions · ~15 minutes"

  **Right Column (35%) — Summary Card:**
  White card, 1px #EEEEEE border, 10px radius, 20px padding, sticky top on scroll.
  - "Your Session" heading in Times New Roman Medium 16px
  - Three summary rows: Interview Type · Target Role · CV Mode — each showing selected value or "—" placeholder
  - Thin dividers between rows
  - At bottom of card: a short AI-generated note (appears once all 3 steps done): "Based on your CV, I'll focus on React, TypeScript, and Frontend Architecture for your Software Engineer prep."

- **Start Interview Button:**
  Full-width, 48px, blue, Times New Roman Medium 16px, 8px radius. Disabled (grey, 0.5 opacity) until all required selections are made. Text: "Begin Interview →" when enabled.

- **"Cancel" link** below the button in grey, 13px. → /candidate/dashboard

**Mock Data:**
```
Selected: Technical · Software Engineer · CV mode ON
Summary Card shows:
  Interview Type: Technical
  Target Role: Software Engineer
  CV Mode: On (Alex_Resume_2025.pdf)
  AI Note: "I'll focus on React, TypeScript, and system design concepts from your background."
```

**Validation:** Interview type required. Role required (min 2 chars if custom). Start button disabled until both chosen. CV toggle note if no CV.

**Navigation Flow:**
```
Setup → /candidate/interview/room   (Begin Interview button)
Setup → /candidate/dashboard        (Cancel link)
```

---

### Screen 7 — Live AI Interview Room

**Route:** `/candidate/interview/room`
**Portal:** Individual Candidate

**Purpose:** Full-screen focus mode for the AI-conducted mock interview. Sidebar hidden. Maximum attention on the question and recording interface.

**Key UI Components:**

- **Full-Screen Focus Layout:** No sidebar. No page background distractions. White (#FFFFFF) full-page background.

- **Top Strip (64px):**
  Left: "Intelli-Hire" small wordmark (grey, 13px)
  Centre: Progress indicator — "Question 3 of 8" in Times New Roman Medium 15px · thin blue progress bar below the strip showing 37.5% fill
  Right: Elapsed timer "04:22" in Times New Roman Mono-style 15px + "End Session" text link (red, 13px, shows confirmation modal on click)

- **Main Content (vertically centred, max-width 720px, horizontally centred):**

  **AI Question Card:**
  White card with a subtle 1px #EEEEEE border + soft shadow. 32px padding. 12px radius.
  - Small label above question: "Question 3" in 11px blue uppercase tracking
  - Question text in Times New Roman Regular 22px #111827, line-height 1.5. Example: "Tell me about a time you had to debug a complex performance issue in a React application. Walk me through your approach."
  - Faint AI icon/badge in top-left corner of card (a small robot/AI icon, 16px grey)

  **Microphone Control Area (below question card, 32px gap):**
  - Large circular record button (64px diameter): idle state = blue (#2563EB) background, white microphone icon, subtle pulse ring animation. Recording state = red (#DC2626) background, stop square icon, faster pulse ring.
  - Text below button: Idle = "Click to Answer" (14px grey) / Recording = "Recording... Click to Stop" (14px red)
  - Audio level visualiser: a row of 20 thin vertical bars (4px wide, 2px gap) that animate in real-time while recording to reflect audio input volume. Grey when idle, blue when active.
  - Transcription text box below visualiser: read-only textarea, max 120px tall, 1px #EEEEEE border, 8px radius, 14px Times New Roman, light grey (#FAFAFA) background. Shows live transcription as user speaks. Placeholder when idle: "Your response will appear here as you speak…"

- **Action Buttons Row (below mic area, centred):**
  - "Skip Question" ghost button (small, grey outline, 13px Times New Roman)
  - "Next Question →" primary blue button (disabled until user has recorded at least 1 second of audio)
  - On last question: "Next Question" becomes "Finish Interview →" (still blue)

- **Microphone Permission Error Banner** (shown if mic blocked): full-width amber banner at top of page: "🎙️ Microphone access is required. Please allow microphone permissions in your browser settings and refresh the page." — with a "How to allow?" link.

**Core Functionalities:** On "Finish Interview →" → brief loading overlay ("Analysing your session…" with spinner) → then navigate to /candidate/report/:id. On "End Session" with confirmation modal → navigate to /candidate/dashboard (session data not saved).

**Navigation Flow:**
```
Interview Room → /candidate/report/:id    (Finish Interview)
Interview Room → /candidate/dashboard     (End Session + confirm)
```

---

### Screen 8 — Interview Feedback Report

**Route:** `/candidate/report/:id`
**Portal:** Individual Candidate

**Purpose:** AI-generated performance report after a mock interview session — scores, strengths, improvement areas, and a per-question breakdown.

**Key UI Components:**

- **Page Header Row:**
  Left: Breadcrumb "My Reports > Software Engineer — Technical" (Times New Roman 13px grey links)
  Right: "Download Report" text link (blue, 13px) + "Retake Interview →" ghost button

- **Session Info Bar:**
  White card, single row: 📅 Apr 29, 2025 · 🎯 Software Engineer · ⚙️ Technical · ⏱️ 18 min 42 sec

- **Overall Score — Hero Card:**
  White card, centred content, 32px padding, 12px radius, subtle shadow.
  - Large circular score badge (80px diameter): blue border ring (4px), dark number "82" in Times New Roman bold 36px, "/100" in 16px grey below
  - Score label: "Overall Performance Score" in Times New Roman 16px below the circle
  - Colour of ring: green for 80+, amber for 60–79, red for below 60
  - Short one-line verdict: "Strong performance. Excellent technical depth with room to improve structure." in 15px Times New Roman italic grey, centred

- **Score Breakdown — 4 Cards in 2×2 Grid:**
  Each card: white bg, 1px border, 10px radius, 20px padding.
  - **Communication:** Score label + progress bar (blue fill) + percentage "86%"
  - **Technical Accuracy:** "79%"
  - **Confidence:** "75%"
  - **Answer Structure:** "70%"
  Each card: label in Times New Roman Medium 14px, progress bar (8px tall, 8px radius, blue fill on grey track), score in bold Times New Roman 20px right-aligned.

- **Strengths & Improvements — Two Columns:**
  - **Strengths** (left, green-tinted card #F0FDF4, green left border 3px): heading "💪 Strengths" + bulleted list of 3 items in Times New Roman 14px
  - **Areas to Improve** (right, amber-tinted card #FFFBEB, amber left border 3px): heading "📈 Focus Areas" + bulleted list of 3 items

- **Actionable Suggestions:** White card, heading "AI Recommendations" in Times New Roman Medium 16px. Numbered list of 4 suggestions in Times New Roman 14px, each with a bullet icon.

- **Per-Question Breakdown — Accordion:**
  Section heading "Question Breakdown" in Times New Roman Medium 16px + "(8 Questions)" grey counter.
  Each accordion row collapsed by default:
  - Row header: Question number pill + first 60 chars of question + chevron icon right + small score badge (e.g., "88/100" green)
  - Expanded content: Full question text in blue-tinted box + User's transcribed answer in white box + Per-question AI note (italic grey)

- **Bottom Buttons Row:**
  "← Back to My Reports" ghost button + "Retake This Interview →" primary blue button

**Mock Data:**
```
Role: Software Engineer | Type: Technical | Date: Apr 29 2025 | Duration: 18m 42s
Overall: 82/100
Communication: 86% | Technical Accuracy: 79% | Confidence: 75% | Structure: 70%

Strengths:
• Strong technical vocabulary and accurate use of React terminology
• Demonstrated real problem-solving with concrete debugging steps
• Maintained composure under follow-up questioning

Focus Areas:
• Answers occasionally lacked a clear structure — use STAR or PREP frameworks
• Pauses were sometimes interpreted as uncertainty; brief transitions help
• Could elaborate more on trade-offs when discussing architecture decisions

AI Recommendations:
1. Practise the STAR method for all behavioural questions — 2 sessions/week recommended
2. Record yourself for 1 week and review pauses and filler words
3. Study system design trade-offs (SQL vs NoSQL, REST vs GraphQL)
4. Explore Intelli-Hire's "Advanced React" role pack for targeted prep

Q1: "Tell me about yourself." → Score: 88/100 (green)
Q2: "Describe a challenging React performance issue you've solved." → Score: 81/100 (green)
Q3: "How would you architect a large-scale e-commerce frontend?" → Score: 74/100 (amber)
Q4: "What is your approach to code review?" → Score: 90/100 (green)
Q5: "How do you handle state management in complex apps?" → Score: 79/100 (amber)
Q6: "Tell me about a time you disagreed with your tech lead." → Score: 71/100 (amber)
Q7: "What's your experience with TypeScript?" → Score: 84/100 (green)
Q8: "Where do you see yourself in 5 years?" → Score: 80/100 (green)
```

**Navigation Flow:**
```
Report → /candidate/reports          (Back to My Reports)
Report → /candidate/interview/setup  (Retake Interview — role pre-filled)
```

---

### Screen 9 — My Reports / Interview History

**Route:** `/candidate/reports`
**Portal:** Individual Candidate

**Purpose:** Full history of all past mock interview sessions, sortable and filterable by role, type, and date.

**Key UI Components:**

- **Page Header Row:** "My Interview Reports" in Times New Roman 24px · "Start New Interview →" primary blue button right-aligned

- **Filter Bar:** Horizontal row of 3 inputs:
  - Search by role text input (placeholder="Search by role…")
  - Interview Type dropdown (All Types / General / Technical / Role-Specific)
  - Date range pickers (From — To) with a calendar icon
  All filters update the list live (client-side, no submit).

- **Sessions Table (when 5+ results):**
  White card wrapping the table. Table columns: Date · Role · Interview Type · Duration · Score · Action
  - Score column: colour-coded badge pill (green/amber/red)
  - Action column: "View Report →" link in blue
  - Table header row: light grey (#F9F9F9) background, 1px #EEEEEE border-bottom, Times New Roman Medium 13px uppercase grey labels
  - Row hover: very light blue tint (#F0F4FF) on row background
  - Pagination: 10 rows per page, simple "← Previous | Page 1 of 3 | Next →" at bottom

- **Empty State:** Illustrated card (clean line illustration of microphone) + "No interviews yet." heading in Times New Roman 22px + "Take your first mock interview to see your results here." in grey + "Start Your First Interview →" primary button

**Mock Data:**
```
Apr 29, 2025 | Software Engineer | Technical | 18m 42s | 82/100 ✅
Apr 21, 2025 | Product Manager | Role-Specific | 21m 15s | 69/100 ⚠️
Apr 14, 2025 | Data Analyst | General | 16m 30s | 61/100 ⚠️
Apr 07, 2025 | Frontend Developer | Technical | 19m 05s | 75/100 ⚠️
Mar 31, 2025 | UX Designer | General | 14m 20s | 88/100 ✅
Mar 24, 2025 | Software Engineer | General | 17m 45s | 58/100 🔴
Mar 17, 2025 | Business Analyst | Role-Specific | 20m 10s | 71/100 ⚠️
```

**Navigation Flow:**
```
My Reports → /candidate/report/:id           (View Report link)
My Reports → /candidate/interview/setup      (Start New Interview button)
```

---

## ═══════════════════════════════════════════════════
## PORTAL 3 — COMPANY / HR / RECRUITER   (Screens 10–20)
## ═══════════════════════════════════════════════════

**Portal Design Rules:** Same clean white sidebar + white cards as Candidate portal. Company portal has a slightly more corporate feel — tighter information density, more table-heavy screens. Sidebar nav includes: Dashboard · Job Postings · Candidates · Analytics · Community · Team (if owner) · Settings.

**Sub-Role Permissions:**
| Feature                  | Owner | HR Manager | Recruiter |
|--------------------------|-------|------------|-----------|
| Approve candidates       | ✅    | ✅         | ✅        |
| Publish job postings     | ✅    | ✅         | ❌        |
| View analytics           | ✅    | ✅         | ❌        |
| Manage team              | ✅    | ❌         | ❌        |
| Create communities       | ✅    | ✅         | ❌        |
| Manage billing/settings  | ✅    | ❌         | ❌        |

---

### Screen 10 — Company Awaiting Approval [NEW]

**Route:** `/company/pending`
**Portal:** Company (pending_approval status only)

**Purpose:** Shown to company accounts that have registered but not yet been approved by the admin. Acts as a holding screen so the company user understands the status of their account.

**Key UI Components:**

- **Page Layout:** Full viewport, #FAFAFA background. Single centred white card (max-width 480px, 48px padding, 12px radius, subtle shadow). No sidebar (account not yet active).

- **Card Content:**
  - Intelli-Hire wordmark at top
  - Illustration: clean line art of an hourglass or pending clock (60px, amber #D97706 colour)
  - Heading: "Your Account is Under Review" in Times New Roman 28px
  - Body: "Thank you for registering Acme Corp. Our team is reviewing your company account. This typically takes up to 24 hours. You'll receive a confirmation email at john@acmecorp.com once approved." (14px grey, Times New Roman, centred)
  - Divider
  - Status badge: amber pill "● Pending Approval" (amber text, amber bg at 10% opacity, 6px radius)
  - "Check Status" refresh button (ghost blue, small) — re-fetches approval status; if now approved, redirects to onboarding
  - "Log Out" text link below (13px grey)

- **Amber notification panel** at bottom of card (inside card): "📧 Didn't receive a verification email? Check your spam folder or contact support@intellihire.com"

**Navigation Flow:**
```
Pending → /company/onboarding   (if status changes to active + profile_complete=false)
Pending → /company/dashboard    (if status changes to active + profile_complete=true)
Pending → /login                (Log Out)
```

---

### Screen 11 — Company Onboarding / Profile Setup

**Route:** `/company/onboarding`
**Portal:** Company (first-time login after approval)

**Purpose:** First-time setup screen shown once after account approval — captures essential company details to complete the profile before accessing the dashboard.

**Key UI Components:**

- **Page Layout:** Full viewport #FAFAFA. Centred white card (max-width 560px, padding 48px, 12px radius, shadow). No sidebar yet.

- **Progress Steps Indicator:** Three steps shown at top of card as a horizontal step track:
  Step 1 "Company Details" (active/blue) → Step 2 "Done ✓" (grey) → (condensed to 2 visual steps for simplicity)
  Actually rendered as: "Step 1 of 1 — Complete Your Company Profile" in 13px grey above the heading.

- **Card Content:**
  - Heading "Set Up Your Company" in Times New Roman 30px
  - Subtext "This helps candidates and your team know who you are." in 14px grey
  - **Company Logo Upload:** Centred square (100px × 100px) with dashed 2px #DDDDDD border, 10px radius. Building icon inside (grey 32px). On click/drag: file picker (PNG/JPG, max 2MB). After upload: shows logo image with "Remove" small link below.
  - **Form fields (stacked, 16px gap):**
    - Company Name (pre-filled from registration, editable)
    - Industry (dropdown — pre-filled from registration, editable)
    - Company Size (dropdown: 1–10 employees / 11–50 / 51–200 / 201–500 / 500+)
    - Website URL (url input, placeholder="https://yourcompany.com")
    - Company Description (textarea, 4 rows, placeholder="Tell candidates about your company, culture, and mission.", 500 char counter)
  - **"Complete Setup" primary button** (full-width, blue)
  - **"Skip for now →"** text link below button (13px grey) — goes to dashboard but marks profile_complete=false, triggers a dashboard banner

**Mock Data (pre-filled):**
```
Company Name: Acme Corp
Industry: Technology
(other fields empty for first-time onboarding)
```

**Validation:** Company Name required. Industry required. Website valid URL if provided. Description max 500 chars.

**Navigation Flow:**
```
Onboarding → /company/dashboard   (Complete Setup or Skip for now)
```

---

### Screen 12 — Company Dashboard

**Route:** `/company/dashboard`
**Portal:** Company / HR / Recruiter

**Purpose:** The central command screen for company users — overview of active jobs, applicants, pipeline health, and recent activity.

**Key UI Components:**

- **Sidebar Navigation:** Dashboard (active) · Job Postings · Candidates · Analytics · Community · Team · Settings. Company logo (40px) + company name at sidebar top. User avatar + name + role badge at sidebar bottom.

- **Top Bar:** "Dashboard" title left · "Create New Job +" primary blue button right-aligned · User avatar far right.

- **Incomplete Profile Banner** (conditional, shown if profile_complete=false, dismissible): amber (#FFFBEB) full-width banner with 3px amber left border: "📋 Complete your company profile to attract better candidates. Add your logo and description. Finish Setup →"

- **Metric Cards Row (4 cards):**
  Each: white bg, 1px #EEEEEE border, 10px radius, 20px padding.
  - Active Jobs: "6" (large Times New Roman 48px bold) + label "Active Job Postings" + "View All →" small link
  - Total Applicants: "142" + label "Total Applications Received"
  - Shortlisted: "28" + label "Candidates Shortlisted" + green tint
  - Interviews Done: "19" + label "Screening Interviews Completed"

- **Recent Jobs Section (left 65%):**
  Heading "Recent Job Postings" + "View All →" right. White card wrapping a compact table (no heavy borders between rows — just 1px #F0F0F0 dividers).
  Columns: Job Title · Applicants · Status badge · Posted date · "View Candidates" link
  
- **Pipeline Overview (left 65%, below Recent Jobs):**
  White card, heading "Hiring Pipeline". Horizontal funnel bar:
  Applied [142] → Screened [67] → Interviewed [31] → Shortlisted [28] → Decided [14]
  Each stage rendered as a labelled segment bar with counts. Percentage drop-off label between stages.

- **Recent Activity Feed (right 35%):**
  White card, "Activity" heading. Timestamped list of 8 items:
  Each item: small icon (person, job, check) + event text + time ago (e.g., "2 hours ago")

**Mock Data:**
```
Metric Cards: Active Jobs: 6 | Total Applicants: 142 | Shortlisted: 28 | Interviews: 19

Recent Jobs:
1. Frontend Developer    | 34 applicants | Published | May 01 2025 | View Candidates
2. Backend Engineer      | 28 applicants | Published | Apr 28 2025 | View Candidates
3. Product Designer      | 22 applicants | Published | Apr 25 2025 | View Candidates
4. DevOps Engineer       | 18 applicants | Draft     | Apr 22 2025 | View Candidates
5. Data Scientist        | 24 applicants | Published | Apr 20 2025 | View Candidates

Pipeline:
Applied: 142 → Screened: 67 (↓53%) → Interviewed: 31 (↓54%) → Shortlisted: 28 (↓10%) → Decided: 14 (↓50%)

Activity Feed:
• New application received — Priya Patel for Frontend Developer (2h ago)
• Interview completed — James Wilson: 79/100 (5h ago)
• 3 candidates shortlisted for Backend Engineer (Yesterday)
• Job "UX Researcher" closed by Sarah (2 days ago)
• New team member invited — recruiter@acmecorp.com (3 days ago)
```

**Navigation Flow:**
```
Company Dashboard → /company/jobs/create      (Create New Job button)
Company Dashboard → /company/jobs             (Job Postings sidebar / View All)
Company Dashboard → /company/jobs/:id/candidates  (View Candidates link)
Company Dashboard → /company/team            (Team sidebar)
Company Dashboard → /company/analytics       (Analytics sidebar)
Company Dashboard → /company/community       (Community sidebar)
```

---

### Screen 13 — Team Management

**Route:** `/company/team`
**Portal:** Company Owner only

**Purpose:** Allows the company owner to invite HR managers and recruiters, manage roles, and remove team members.

**Key UI Components:**

- **Page Header:** "Team Management" in Times New Roman 24px · "Invite Member +" primary blue button right.

- **Team Summary Strip:** White card single row: "1 Owner · 2 HR Managers · 3 Recruiters · 6 Total Members"

- **Team Table:** White card, full-width. Columns: Name · Email · Role badge · Status badge · Date Added · Actions.
  - Role badges: pill style — Owner (dark blue) / HR Manager (blue) / Recruiter (grey-blue)
  - Status badges: Active (green pill) / Pending Invite (amber pill)
  - Actions per row: "Edit Role" small button + "Remove" small red text link (for non-owner rows)
  - Pending rows: show "Resend Invite" instead of "Edit Role"

- **Invite Member Modal (overlay):**
  Centred modal, white, 420px wide, 10px radius, semi-transparent backdrop.
  - Heading "Invite a Team Member"
  - Email input (required)
  - Role dropdown: HR Manager / Recruiter
  - "Send Invite" primary blue button + "Cancel" ghost button
  - On success: modal closes, table updates with new pending row, success toast: "Invite sent to recruiter@acmecorp.com"

**Mock Data:**
```
Name: John Smith   | john@acmecorp.com   | Owner      | Active  | Jan 15 2025
Name: Sarah Lee    | sarah@acmecorp.com  | HR Manager | Active  | Feb 01 2025
Name: Mike Brown   | mike@acmecorp.com   | HR Manager | Active  | Feb 14 2025
Name: Ana Torres   | ana@acmecorp.com    | Recruiter  | Active  | Mar 03 2025
Name: Raj Patel    | raj@acmecorp.com    | Recruiter  | Active  | Mar 10 2025
Name: [Pending]    | dev@acmecorp.com    | Recruiter  | Pending | May 06 2025 → "Resend Invite"
```

**Navigation Flow:** Stays on /company/team after all actions. Toast confirmations. Confirm modal for Remove.

---

### Screen 14 — Job Postings List

**Route:** `/company/jobs`
**Portal:** Company / HR / Recruiter

**Purpose:** All company job openings in one manageable list — create, edit, view applicants, or close postings.

**Key UI Components:**

- **Page Header:** "Job Postings" · "Create New Job +" right-aligned primary button.
- **Filter Bar:** Search input (placeholder="Search job title…") + Status filter dropdown (All / Draft / Published / Closed).
- **Jobs Table:** Columns: Job Title · Department · Deadline · Applicants · Status · Actions.
  - Status badges: Draft (grey pill) / Published (green pill) / Closed (red pill)
  - Actions per row: "View Candidates" link · "Edit" link · "Close" text (red, for owner/HR only; hidden for recruiter)
  - Job title is also clickable → View Candidates

**Mock Data:**
```
Frontend Developer  | Engineering | May 31 2025 | 34 applicants | Published | View/Edit/Close
Backend Engineer    | Engineering | Jun 15 2025 | 28 applicants | Published | View/Edit/Close
Product Designer    | Design      | May 28 2025 | 22 applicants | Published | View/Edit/Close
DevOps Engineer     | Engineering | —           | 0  applicants | Draft     | View/Edit
Data Scientist      | Data & AI   | Jun 30 2025 | 24 applicants | Published | View/Edit/Close
UX Researcher       | Design      | Apr 30 2025 | 16 applicants | Closed    | View
Marketing Manager   | Marketing   | —           | 0  applicants | Draft     | View/Edit
```

**Navigation Flow:**
```
Job Postings → /company/jobs/create           (Create New Job button)
Job Postings → /company/jobs/:id/edit         (Edit link)
Job Postings → /company/jobs/:id/candidates   (View Candidates link)
```

---

### Screen 15 — Create / Edit Job Opening

**Route:** `/company/jobs/create` or `/company/jobs/:id/edit`
**Portal:** Company Owner / HR Manager (Recruiter can edit but cannot publish)

**Purpose:** Comprehensive job form defining the opening and custom application fields, which feeds the AI screening engine.

**Key UI Components:**

- **Page Header:** "Create Job Opening" (or "Edit Job" in edit mode). Breadcrumb: Job Postings > Create.

- **Sticky Footer Bar:** Always visible at bottom while scrolling. "Save as Draft" ghost button + "Publish Job →" primary blue button + "Cancel" text link.

- **Form — Single Column, max-width 760px, sectioned with clear headings:**

  **Section 1 — Basic Info** (divider heading in Times New Roman Medium 13px grey uppercase):
  - Job Title (text, required, placeholder="e.g. Senior Frontend Engineer")
  - Department (text, placeholder="e.g. Engineering, Marketing, Design")
  - Location (text, placeholder="e.g. London, UK or Remote")
  - Job Type (dropdown: Full-time / Part-time / Contract / Remote / Hybrid)

  **Section 2 — Job Description:**
  - Rich text area with minimal toolbar: Bold · Italic · Bullet list · Numbered list · Heading 2. 250px min height. Placeholder: "Describe the role, responsibilities, and what a typical day looks like…"

  **Section 3 — Requirements:**
  - Skills (tag input — same design as candidate profile: type skill + Enter, removable blue pills)
  - Experience Level (dropdown: Entry-level / Mid-level / Senior / Lead / Director)
  - Education (dropdown: High School / Bachelor's / Master's / PhD / Any)

  **Section 4 — Deadline:**
  - Application Deadline (date picker, must be a future date, required for publish)

  **Section 5 — Custom Application Fields:**
  - Subheading: "Custom Questions for Applicants"
  - List of added custom fields (each row: drag handle · field label · type badge · Required toggle · "Remove" red link)
  - "Add Custom Field +" ghost button
  - "Add Custom Field" opens a lightweight inline panel below the button (not a heavy modal):
    - Field Label input (text)
    - Field Type dropdown: Short Text / Long Text / Dropdown / File Upload / Yes/No
    - "Required?" toggle
    - "Add Field" small blue button · "Cancel" link

**Mock Data (pre-filled for Software Engineer):**
```
Job Title: Senior Frontend Engineer
Department: Engineering
Location: Remote (UK)
Job Type: Full-time
Description: We are looking for a skilled frontend engineer to join our growing team…
Skills: React · TypeScript · JavaScript · CSS · GraphQL · Git
Experience: Senior
Education: Bachelor's
Deadline: Jun 15 2025
Custom Fields:
  • "Portfolio URL" — Short Text — Required
  • "Are you eligible to work in the UK?" — Yes/No — Required
  • "Cover letter (optional)" — Long Text — Not Required
```

**Navigation Flow:**
```
Create Job → /company/jobs              (Cancel link)
Create Job → /company/jobs/:id/preview  (Publish → navigates to preview screen)
Edit Job   → same navigation
```

---

### Screen 16 — Application Form Preview & Link Sharing

**Route:** `/company/jobs/:id/preview`
**Portal:** Company / HR / Recruiter

**Purpose:** Shows a live preview of the auto-generated candidate application form and provides shareable link/QR code tools.

**Key UI Components:**

- **Page Header:** "Application Form Preview" · Job title subtitle in grey below.
- **"← Edit Job"** link left · **"← Back to Job Postings"** link right.

- **Two-Column Split:**

  **Left (60%) — Live Form Preview:**
  Rendered inside a white card with a light top label bar: "👁 Candidate View" in 11px grey uppercase.
  The form renders exactly as candidates will see it:
  - "Applying for: Senior Frontend Engineer at Acme Corp" header
  - Standard fields: Full Name · Email · Phone · CV/Resume Upload (PDF)
  - All custom fields defined in job setup, in order
  - "Submit Application" button (non-functional in preview — shows "Preview Only" tooltip on hover)
  - Form uses the same clean white card + Times New Roman styling

  **Right (40%) — Sharing Panel:**
  White card, 24px padding.
  - "Share This Job" heading in Times New Roman Medium 18px
  - Shareable URL: read-only input showing the full public link + "Copy Link" blue button (shows "✓ Copied!" for 2 seconds on click)
  - QR Code: 120×120px QR code image generated from the URL. "Download QR" small link below.
  - "Open in New Tab →" ghost button (opens the actual public form)
  - Separator (1px #EEEEEE)
  - "Share via" row: LinkedIn icon button + Copy icon button
  - Separator
  - Settings Summary panel:
    - Deadline: Jun 15 2025 (green if active, red if expired)
    - Total Fields: 7
    - Status: Published (green badge)

**Mock Data:** Based on Senior Frontend Engineer job mock from Screen 15.

**Navigation Flow:**
```
Preview → /company/jobs/:id/edit    (Edit Job link)
Preview → /company/jobs             (Back to Job Postings)
Preview → public application URL    (Open in New Tab)
```

---

### Screen 17 — Candidates List (Per Job)

**Route:** `/company/jobs/:id/candidates`
**Portal:** Company / HR / Recruiter

**Purpose:** All candidates who applied for a specific job, ranked by AI CV match score, with pipeline stage management.

**Key UI Components:**

- **Page Header:** Job title "Senior Frontend Engineer" in Times New Roman 24px + "Published" status badge. Breadcrumb: Job Postings > Senior Frontend Engineer > Candidates.

- **Stats Strip:** White card, single row — 4 stats: Total Applicants: 34 · Shortlisted: 8 · Interviews Pending: 5 · Decided: 3.

- **Filter Bar:** Search by name input · Stage filter dropdown (All / Applied / Shortlisted / Screened / Interviewed / Decided) · Sort dropdown (CV Match Score ↓ / Application Date ↓ / Name A-Z).

- **Bulk Action Bar** (appears when rows selected): "X candidates selected — Shortlist Selected" amber button + "Clear Selection" link.

- **Candidates Table:**
  Columns: ☐ checkbox · Name · Email · Applied · CV Match % · Stage · Actions.
  - CV Match % is a colour-coded badge: ≥80% green / 50–79% amber / <50% red. Badge shows percentage + a mini bar fill.
  - Stage badge: pill style — Applied (grey) / Shortlisted (blue) / Screened (purple) / Interviewed (teal) / Decided (green or red)
  - Actions per row: "View Profile →" link · Stage dropdown (quick change inline)
  - Row hover: light blue tint background

**Mock Data:**
```
Priya Patel      | priya@email.com  | May 01 2025 | 91% ✅ | Shortlisted  | View Profile
James Wilson     | james@email.com  | May 02 2025 | 87% ✅ | Interviewed  | View Profile
Ahmed Malik      | ahmed@email.com  | May 03 2025 | 82% ✅ | Shortlisted  | View Profile
Sarah Chen       | sarah@email.com  | Apr 30 2025 | 76% ⚠️ | Screened    | View Profile
Daniel Kim       | daniel@email.com | Apr 29 2025 | 71% ⚠️ | Applied     | View Profile
Maria Torres     | maria@email.com  | Apr 28 2025 | 65% ⚠️ | Applied     | View Profile
Tom Evans        | tom@email.com    | Apr 27 2025 | 58% ⚠️ | Applied     | View Profile
Lisa Nguyen      | lisa@email.com   | Apr 26 2025 | 44% 🔴 | Applied     | View Profile
...22 more rows (pagination, 20 per page)
```

**Navigation Flow:**
```
Candidates List → /company/candidates/:id       (View Profile)
Candidates List → /company/jobs                 (breadcrumb)
Candidates List → /company/dashboard            (sidebar)
```

---

### Screen 18 — Candidate Profile & Evaluation Report

**Route:** `/company/candidates/:id`
**Portal:** Company / HR / Recruiter

**Purpose:** Full candidate profile + AI evaluation — application data, CV analysis, screening results, and interview scores — consolidated for recruiter decision-making.

**Key UI Components:**

- **Page Header:** Candidate name + applied role. Breadcrumb: Candidates > Priya Patel.

- **Two-Column Layout:**

  **Left Panel (30%) — Profile Card:**
  White card, always visible, sticky on scroll.
  - Avatar initials circle (60px, blue bg)
  - Name in Times New Roman 20px bold
  - Applied Role: "Senior Frontend Engineer"
  - Current Stage badge (blue "Shortlisted")
  - CV Match Score: large percentage "91%" (green, Times New Roman 28px bold) + label below
  - Thin divider
  - Contact: email + phone (clickable links)
  - Applied date: "May 1, 2025"
  - "Download CV" blue ghost button (full-width)

  **Right Panel (70%) — Tabbed Report:**
  4 tabs: Overview · CV Analysis · Screening Interview · Technical Interview
  
  **Overview Tab (default):**
  4 score cards in 2×2 grid: CV Match · Screening Score · Technical Score · Composite Score
  + Short AI verdict paragraph in italic grey Times New Roman.
  
  **CV Analysis Tab:**
  - Extracted Skills list (tags, green-tinted)
  - Education timeline (institution, degree, year)
  - Experience timeline (company, role, duration)
  - AI highlights: "3 of 5 required skills matched · 2+ years relevant experience · Strong portfolio links detected"
  
  **Screening Interview Tab:**
  - Score: 84/100 (circular badge)
  - 4 sub-scores: Communication · Clarity · Enthusiasm · Professionalism
  - Q&A Transcript cards (collapsed accordion, each: Q in blue box, A in white box)
  - AI key observations (bulleted italic)
  
  **Technical Interview Tab:**
  - Overall technical score: 79/100
  - React proficiency: 88% · TypeScript: 81% · CSS Architecture: 72% · System Design: 65%
  - Q&A transcript

- **Action Buttons Row (bottom, outside tabs):**
  "Move to Next Stage →" primary blue button · "Put on Hold" ghost button · "Mark as Rejected" danger red button.
  "Mark as Rejected" → confirmation modal with a "Please provide a reason (required)" textarea.

**Mock Data:**
```
Candidate: Priya Patel | priya.patel@email.com | +44 7911 123456
Applied: May 1 2025 | Stage: Shortlisted | CV Match: 91%

CV Analysis:
  Skills detected: React ✅ | TypeScript ✅ | JavaScript ✅ | GraphQL ✅ | Jest ✅ | Python ❌
  Education: BSc Computer Science, University of Edinburgh (2020–2023)
  Experience: Frontend Dev @ StartupX (2023–present, 2 yrs) | Intern @ WebAgency (2022, 6mo)

Screening Score: 84/100
  Communication: 90% | Clarity: 85% | Enthusiasm: 82% | Professionalism: 88%
  Key Observation: "Excellent communicator with clear examples from current role."

Technical Score: 79/100
  React: 88% | TypeScript: 81% | CSS Architecture: 72% | System Design: 65%
  Note: "Strong in React & TS. Architecture answers lacked depth in large-scale scenarios."

Composite Score: 85/100
AI Verdict: "Strong candidate. Recommend advancing to final round — address system design gaps."
```

**Navigation Flow:**
```
Profile → /company/jobs/:id/candidates   (breadcrumb)
Profile → stays on screen (tab switches, in-place)
```

---

### Screen 19 — Recruiter Analytics Dashboard

**Route:** `/company/analytics`
**Portal:** Company Owner / HR Manager (Recruiter cannot access)

**Purpose:** Visual analytics of the hiring pipeline — funnel, candidate rankings, job comparison, and KPIs.

**Key UI Components:**

- **Page Header:** "Recruitment Analytics" in Times New Roman 24px.
- **Top Filter Bar:** "View data for:" Job dropdown (All Jobs / each job listed) + Date range pickers + "Apply" button.

- **KPI Cards Row (4 cards):**
  - Total Applicants: 142 | Avg CV Match Score: 72% | Interview Completion Rate: 68% | Avg Time to Shortlist: 4.2 days

- **Charts Section (two-column):**
  **Left — Hiring Funnel Chart:**
  Horizontal funnel bars (stacked/progressive). Each stage labelled with count and % of previous stage.
  Applied (142) → Screened (67, 47%) → Interviewed (31, 46%) → Shortlisted (28, 90%) → Decided (14, 50%)
  
  **Right — Top Candidates Bar Chart:**
  Horizontal bar chart of top 8 candidates by composite score for selected job. Bars are blue, labels show name + score.

- **Job Comparison Table (full-width, below):**
  Columns: Job Title · Applicants · Avg CV Score · Interviews Done · Status · "View →" link.
  Clickable rows → /company/jobs/:id/candidates.

**Mock Data:** See Company Dashboard mock data above for pipeline figures. Add chart data and job comparison table from jobs list.

**Navigation Flow:**
```
Analytics → /company/jobs/:id/candidates   (job comparison table row click)
Analytics → /company/dashboard             (sidebar)
```

---

### Screen 20 — Community Management

**Route:** `/company/community`
**Portal:** Company Owner / HR Manager

**Purpose:** Create and manage talent communities — focused groups for long-term pipeline building.

**Key UI Components:**

- **Page Header:** "Talent Communities" · "Create Community +" primary blue button right.

- **Community Cards Grid (3 per row):**
  Each card: white bg, 1px #EEEEEE border, 10px radius, 20px padding.
  - Community name in Times New Roman Medium 18px
  - Description (2 lines, grey, 13px)
  - Member count badge: "32 Members" (blue pill)
  - Target Group tag: "University Students" / "Alumni" / "Tech Professionals" (grey pill)
  - "Manage →" ghost button + "Post Job" small secondary button

- **Create Community Modal/Drawer:**
  Fields: Community Name · Description · Target Group (dropdown) · Filter Tags (tag input for skills/university) · Invite Mode (Open / Invite Only)
  "Create Community" primary button.

- **Community Detail View** (on "Manage →" click, replaces grid or navigates to dedicated page):
  Two sections:
  - Left: Community settings panel (editable name, description, join link display, QR code, "Copy Join Link" button)
  - Right: Member list table (Name · Email · Join Date · Status) + "Invite by Email" panel at top of right section + "Post Opportunity" dropdown button.

**Mock Data:**
```
Community 1: "React & Frontend Talent Pool" | 48 Members | Tech Professionals | Open
Community 2: "Edinburgh CS Grads 2024" | 23 Members | University Alumni | Invite Only
Community 3: "Early Talent Pipeline" | 61 Members | University Students | Open
```

**Navigation Flow:**
```
Community → Community Detail page   (Manage button)
Community Detail → /company/jobs    (Post Opportunity → select job)
```

---

## ═══════════════════════════════════════════════════
## PORTAL 4 — ADMIN   (Screens 21–22)
## ═══════════════════════════════════════════════════

**Portal Design Rules:** Same white sidebar + cards as other portals. Admin portal uses a slightly more utilitarian tone — data-dense tables, amber/red status indicators for pending items. Sidebar nav: Dashboard · User Management · Company Management · Settings.

---

### Screen 21 — Admin Dashboard

**Route:** `/admin/dashboard`
**Portal:** Admin only

**Purpose:** Platform-wide oversight — KPIs, pending company approvals, user registration trends, and activity log.

**Key UI Components:**

- **Sidebar Navigation:** Dashboard (active) · User Management · Company Management · Platform Settings. "Admin Panel" wordmark at top. Admin avatar + "Super Admin" role badge at bottom.

- **Top Bar:** "Admin Dashboard" title · Admin name + avatar right.

- **⚠️ Pending Approvals Alert Banner** (conditional, shown if pending > 0): amber full-width banner: "🔔 3 companies are awaiting approval. Review and approve to activate their accounts. Review Now →"

- **KPI Cards Row (5 cards):**
  Each: white card, 1px #EEEEEE border, 10px radius, 20px padding.
  - Total Individual Users: "12,847"
  - Total Companies: "854"
  - Active Job Postings: "2,341"
  - Interview Sessions This Month: "8,924"
  - Pending Approvals: "3" — this card has amber (#FFFBEB) background and amber border (#F59E0B) to draw attention visually. Badge inside card: amber "3 Pending" pill.

- **30-Day Registration Chart (left 65%):**
  White card. Heading "User Registrations — Last 30 Days". Simple clean line chart:
  - X-axis: dates (Apr 9 → May 8)
  - Y-axis: count
  - Two lines: blue = Individuals / green = Companies
  - Legend below chart: "— Individuals   — Companies"
  No gridlines, just subtle horizontal guides. Chart is informational, not interactive (no click states).

- **Recent Activity Log (right 35%):**
  White card. "Platform Activity" heading. Scrollable list (max-height 300px) of 15 timestamped events:
  Each row: coloured dot (blue for user events, green for company, red for admin action) + event description + time ago.

- **Pending Company Approvals Table (full-width, below charts):**
  White card. Heading "Pending Company Approvals" in Times New Roman Medium 18px (amber dot indicator if count > 0).
  Table columns: Company Name · Owner Email · Industry · Registered · Status · Actions.
  Actions per row: "Approve ✓" green button + "Reject ✗" red ghost button.
  "Reject" → modal: "Reason for rejection" textarea (required, min 10 chars) + Confirm button.
  "Approve" → modal: "Confirm approval for [Company Name]?" + Confirm button.
  After action: row updates inline with new status + success toast.

**Mock Data:**
```
KPIs: 12,847 Individual Users | 854 Companies | 2,341 Active Jobs | 8,924 Sessions | 3 Pending

Pending Companies Table:
NexusTech Ltd    | ceo@nexustech.com     | Technology    | May 06 2025 | Pending | Approve / Reject
BuildCo Staffing | hr@buildco.com        | Recruitment   | May 07 2025 | Pending | Approve / Reject
AlphaMedia Group | talent@alphamedia.com | Media         | May 07 2025 | Pending | Approve / Reject

Recent Activity:
● New company registered: GlobalTech (2h ago)
● 45 new candidates registered today (3h ago)
● Company approved: Meridian Corp (4h ago)
● Interview session milestone: 10,000th session completed (6h ago)
● User suspended by admin: spam@example.com (8h ago)
```

**Navigation Flow:**
```
Admin Dashboard → /admin/management           (sidebar: User Management)
Admin Dashboard → /admin/management?tab=companies  (sidebar: Company Management)
Admin Dashboard → "Review Now" alert banner    (→ pending approvals table, smooth scroll)
```

---

### Screen 22 — User & Company Management

**Route:** `/admin/management`
**Portal:** Admin only

**Purpose:** Primary admin management screen for all users and companies — approve, reject, suspend, activate, search, filter, and view detail records.

**Key UI Components:**

- **Page Header:** "User & Company Management" in Times New Roman 26px.

- **Tab Switcher:** Two tabs below header — "👤 Users" (default) · "🏢 Companies". Active tab: blue underline + blue text. Clean minimal tab design, no background fills.

---

**Users Tab (active by default):**

- **Filter Bar:** Search input (placeholder="Search by name or email…") · Role filter dropdown (All Roles / Individual / HR Manager / Recruiter) · Status filter dropdown (All / Active / Suspended).

- **Users Table:**
  Columns: Name · Email · Role badge · Status badge · Registered · Actions.
  - Role badges: "Individual" (grey) / "HR Manager" (blue) / "Recruiter" (slate)
  - Status badges: "Active" (green pill) / "Suspended" (red pill)
  - Actions: "View ▸" small link + "Suspend" amber small button (for active) / "Activate" green small button (for suspended)
  - "Suspend" → confirmation modal: "Are you sure you want to suspend [Name]?" + Confirm/Cancel
  - Pagination: 25 rows per page, page counter + Prev/Next

**Mock Data — Users Tab:**
```
Priya Patel     | priya@email.com   | Individual  | Active    | May 01 2025 | View / Suspend
James Wilson    | james@email.com   | Individual  | Active    | Apr 28 2025 | View / Suspend
Ahmed Malik     | ahmed@email.com   | Individual  | Active    | Apr 20 2025 | View / Suspend
Sarah Lee       | sarah@acme.com    | HR Manager  | Active    | Feb 01 2025 | View / Suspend
Tom Evans       | tom@evil.com      | Individual  | Suspended | Mar 14 2025 | View / Activate
…(total: ~12,847 users, paginated at 25/page)
```

---

**Companies Tab:**

- **Filter Bar:** Search input (placeholder="Search by company or email…") · Status filter dropdown (All / Active / Pending / Suspended).

- **Companies Table:**
  Columns: Company Name · Owner Email · Industry · Status badge · Registered · Actions.
  - Status badges: "Active" (green) / "Pending" (amber) / "Suspended" (red)
  - Actions: "View ▸" + "Approve ✓" (for pending) / "Reject ✗" (for pending) / "Suspend" (for active) / "Activate" (for suspended)
  - "Reject" → modal with reason textarea
  - "Approve" → confirmation modal
  - "View" → read-only slide-in panel showing company full details (name, description, logo, team size, website, join date, all jobs posted)

**Mock Data — Companies Tab:**
```
Acme Corp        | john@acmecorp.com     | Technology  | Active    | Jan 15 2025 | View/Suspend
GlobalTech Ltd   | ceo@globaltech.com    | Technology  | Active    | Feb 20 2025 | View/Suspend
NexusTech Ltd    | ceo@nexustech.com     | Technology  | Pending   | May 06 2025 | View/Approve/Reject
BuildCo Staffing | hr@buildco.com        | Recruitment | Pending   | May 07 2025 | View/Approve/Reject
AlphaMedia Group | talent@alphamedia.com | Media       | Pending   | May 07 2025 | View/Approve/Reject
SpamJobs LLC     | spam@spamjobs.com     | Unknown     | Suspended | Mar 01 2025 | View/Activate
…(total: ~854 companies)
```

**Common Patterns for Both Tabs:**
- Columns are sortable (click header): sort arrow indicator appears (↑↓)
- Pagination: 25 rows per page with "Showing 1–25 of 12,847 users" counter
- All table actions trigger toast confirmations at top-right of viewport: "✓ [Company] approved successfully."
- "View" panel (slide-in drawer from right): read-only, 400px wide, shows all data for the record

**Navigation Flow:**
```
Management → stays on /admin/management   (all tab actions update inline)
Management → /admin/dashboard             (sidebar)
```

---

## ═══════════════════════════════════════════════════
## DESIGN SYSTEM v2 — FULL SPECIFICATION
## ═══════════════════════════════════════════════════

### Typography

**Primary Font: Times New Roman**
All text across all portals uses Times New Roman (or the stack: `"Times New Roman", Times, serif`).

| Element                  | Size | Weight   | Style    | Colour  |
|--------------------------|------|----------|----------|---------|
| Page hero headline       | 72px | 700 Bold | Normal   | #111827 |
| Section heading (large)  | 40px | 700 Bold | Normal   | #111827 |
| Page title (dashboard)   | 26px | 600 Medium| Normal  | #111827 |
| Card heading             | 18px | 600 Medium| Normal  | #111827 |
| Body text                | 15px | 400 Regular| Normal | #374151 |
| Secondary/meta text      | 13px | 400 Regular| Normal | #6B7280 |
| Form label               | 14px | 500 Medium| Normal  | #374151 |
| Table header             | 13px | 600 Medium| Uppercase| #6B7280|
| Button text              | 15px | 500 Medium| Normal  | —       |
| Testimonial quote        | 18px | 400 Regular| Italic | #374151 |
| Sidebar nav item         | 14px | 500 Medium| Normal  | #374151 |
| Badge / pill             | 12px | 600 Medium| Normal  | —       |

**No Inter. No system-ui. No sans-serif fallback as primary.** Times New Roman is the voice of Intelli-Hire — editorial, authoritative, premium.

---

### Colour Palette

| Token                   | Value     | Usage                                        |
|-------------------------|-----------|----------------------------------------------|
| Primary / CTA Blue      | #2563EB   | All primary buttons, active states, links     |
| Blue Tint (bg)          | #EFF6FF   | Selected card backgrounds, row highlights     |
| Blue Border (selected)  | #2563EB   | Selected card borders (2px)                  |
| Success / Active Green  | #16A34A   | Active badges, positive scores, success icons |
| Green Tint              | #F0FDF4   | Strengths panels, positive notifications      |
| Warning / Pending Amber | #D97706   | Pending badges, attention KPI cards           |
| Amber Tint              | #FFFBEB   | Pending panels, alert banners                 |
| Danger / Rejected Red   | #DC2626   | Error states, rejected badges, danger buttons |
| Page Background         | #FAFAFA   | All authenticated portal page backgrounds     |
| Card Background         | #FFFFFF   | All cards, sidebar, top bar                  |
| Border Default          | #EEEEEE   | All card borders, input borders (default)     |
| Border Focus            | #2563EB   | Input focus ring (2px)                       |
| Border Hover            | #CCCCCC   | Card hover state                             |
| Text Primary            | #111827   | Headlines, important content                 |
| Text Body               | #374151   | Standard body text                           |
| Text Secondary          | #6B7280   | Labels, meta, placeholders                   |
| Text Disabled           | #D1D5DB   | Disabled form elements                       |

**Background Philosophy:** White (#FFFFFF) is the primary surface for cards, sidebar, and top bar. #FAFAFA is the page canvas — a breath of air behind the white cards. The overall impression is pure, airy white — like hireflix — with blue used only as a purposeful accent.

---

### Spacing System

Base unit: **8px**

| Token          | Value  | Used for                              |
|----------------|--------|---------------------------------------|
| xs             | 4px    | Internal icon/text gaps               |
| sm             | 8px    | Small internal padding                |
| md             | 16px   | Form field gaps, list items           |
| lg             | 24px   | Card internal padding                 |
| xl             | 32px   | Section internal padding              |
| 2xl            | 48px   | Auth card padding                     |
| 3xl            | 80px   | Page section padding (top/bottom)     |
| 4xl            | 120px  | Landing page section padding          |

---

### Component Specifications

**Buttons:**
- Border-radius: 8px on all buttons
- Heights: 44px (primary/standard) · 36px (secondary/compact) · 30px (small/inline)
- Primary: #2563EB bg, #FFFFFF text, no border. Hover: #1D4ED8 (darker blue)
- Ghost: transparent bg, 1.5px #2563EB border, #2563EB text. Hover: #EFF6FF bg
- Danger: #DC2626 bg, white text. Hover: #B91C1C
- Disabled: 50% opacity, `cursor: not-allowed`
- Loading state: spinner icon replaces button text, button disabled

**Cards:**
- Background: #FFFFFF
- Border: 1px solid #EEEEEE
- Border-radius: 10px
- Padding: 20px (standard) · 24px (form cards) · 48px (auth cards)
- Shadow: none by default. Auth/modal cards: `box-shadow: 0 4px 24px rgba(0,0,0,0.08)`
- Hover (clickable cards): border-color → #CCCCCC, transition 0.15s ease

**Form Inputs:**
- Height: 44px (standard) · 36px (compact inline)
- Border: 1px solid #DDDDDD. Focus: 2px solid #2563EB (no box-shadow, border only). Error: 1.5px solid #DC2626
- Border-radius: 8px
- Font: Times New Roman 15px #374151
- Placeholder: Times New Roman 14px #9CA3AF
- Padding: 0 12px

**Status Badge Pills:**
- Border-radius: 999px (full pill)
- Padding: 3px 10px
- Font: Times New Roman 12px 600 Medium
- Active/Published: #DCFCE7 bg, #16A34A text
- Pending/Draft: #FEF3C7 bg, #D97706 text
- Rejected/Suspended/Closed: #FEE2E2 bg, #DC2626 text
- Shortlisted: #DBEAFE bg, #2563EB text
- Screened: #EDE9FE bg, #7C3AED text
- Interviewed: #CCFBF1 bg, #0D9488 text
- No heavy borders on badges — background tint alone distinguishes them

**Sidebar:**
- Width: 240px, fixed
- Background: #FFFFFF
- Right border: 1px solid #EEEEEE
- Nav item height: 40px, padding: 0 16px, border-radius: 6px (on the item, 4px margin inset)
- Active nav item: 3px solid #2563EB left border (absolute), #EFF6FF background, #2563EB text
- Hover nav item: #F9FAFB background
- Logo/wordmark area: 64px tall, border-bottom 1px #EEEEEE

**Top Bar:**
- Height: 64px
- Background: #FFFFFF
- Border-bottom: 1px solid #EEEEEE
- Content padding: 0 24px

**Tables:**
- Header row: #F9FAFB background, 1px #EEEEEE bottom border, Times New Roman 13px Medium uppercase grey
- Body rows: white background, 1px #F0F0F0 bottom border (lighter than header border)
- Row hover: #F8FAFF (very light blue) background
- Selected row (checkbox): #EFF6FF background
- Cell padding: 12px 16px
- No outer border on table — contained within a card which provides the outer border

**Modals:**
- Backdrop: `rgba(0,0,0,0.4)` overlay
- Modal card: white, max-width 460px, 32px padding, 12px border-radius, `box-shadow: 0 8px 40px rgba(0,0,0,0.16)`
- Heading in Times New Roman Medium 20px
- Always includes a clear Cancel/Close mechanism (X button top-right + Cancel button)
- Stacked on Z-index 1000+

**Toast Notifications:**
- Position: top-right, 16px from edges
- Min-width: 280px, max-width: 360px
- Background: white, 1.5px border (green for success, red for error, amber for warning)
- Left accent bar: 4px solid (coloured per type)
- Text: Times New Roman 14px
- Auto-dismiss: 4 seconds. Manual dismiss: X icon

**Progress Bars:**
- Height: 8px
- Border-radius: 999px
- Track: #F3F4F6
- Fill: #2563EB (standard) · #16A34A (success) · #DC2626 (danger)

---

### Interaction & Animation Principles

- **Transitions:** All hover states use `transition: all 0.15s ease`
- **Focus States:** All interactive elements must have visible focus rings for accessibility (2px #2563EB ring, 2px offset)
- **Page Transitions:** Simple fade-in on page load (opacity 0→1, 150ms). No slide animations.
- **Count-up Animation:** Stat numbers on dashboard screens count up from 0 to their value over 800ms on mount (using requestAnimationFrame). Easing: ease-out.
- **Accordion:** Height transitions smooth expand/collapse using CSS max-height transition, 200ms ease-in-out.
- **Card hover:** `transform: translateY(-1px)` on clickable cards — very subtle lift, not dramatic.
- **No CSS animations that autoplay indefinitely** (except the mic recording pulse ring, which stops when not recording).

---

### Screen Responsive Behaviour

All portals are primarily designed for desktop (1280px+). Responsive breakpoints:

| Breakpoint | Behaviour                                                                           |
|------------|-------------------------------------------------------------------------------------|
| ≥1280px    | Full desktop layout as specified                                                    |
| 1024–1279px| Sidebar collapses to icon-only (40px wide), tooltips on hover for nav labels       |
| 768–1023px | Sidebar hidden by default, hamburger menu opens it as overlay drawer               |
| <768px     | Single-column layouts, cards stack vertically, tables become card-stacked lists    |

Landing page is fully responsive at all breakpoints. Auth screens (login, register) are centred cards, naturally responsive.

---

### Navigation & Loading States

**Global Loading:** A thin 3px blue (#2563EB) progress bar at the very top of the viewport animates from 0→100% during page transitions (NProgress style). Not a spinner overlay — just the subtle top bar.

**Skeleton Loading:** On dashboard screens where data is fetched, use skeleton cards (light grey animated shimmer blocks matching the shape of the actual card content) instead of spinners. Show skeletons for max 500ms before real data appears.

**Empty States:** Every list/table screen must have a designed empty state:
- A minimal line illustration (60–80px, grey)
- Short heading in Times New Roman Medium 20px
- One-line description in 14px grey
- A CTA button to take the first action

---

### Accessibility Standards

- All colour contrast ratios meet WCAG AA minimum (4.5:1 for text, 3:1 for UI components)
- All interactive elements are keyboard-navigable with logical tab order
- All form inputs have associated `<label>` elements (not just placeholders)
- All icon buttons have `aria-label` attributes
- Error messages are announced via `role="alert"` or `aria-live="assertive"`
- Status badges and score colours always accompanied by text labels (not colour-only)
- Sidebar navigation uses `<nav>` element with `aria-label="Main navigation"`
- All modals trap focus within the modal while open and return focus on close

---

*End of Intelli-Hire Screen Specifications v2*
*22 Screens · 4 Portals · Times New Roman Typography · White-Primary Design · World-Class UX*
