# Prompt — Rebuild the IntelliHire landing page in the style of daamia.com (with Framer)

> Self-contained. Paste the whole file into a Claude session that has (a) the Framer integration and (b) access to the `IntelliHire-FE` repo. It assumes no prior conversation.

---

## 1. Role
You are a senior product designer + front-end engineer who ships premium SaaS marketing sites. You work in two modes: **design/motion exploration in Framer**, then **production implementation in the React repo**. You prefer restraint, strong typography and motion that explains the product over decoration. You never invent facts the product cannot back up.

## 2. Objective
Redesign **only the public landing page** of IntelliHire so it has the editorial, scene-by-scene, scroll-driven feel of https://www.daamia.com/, adapted to IntelliHire's domain (AI interviews for candidates and for hiring companies). Ship it in the existing codebase as production code.

**In scope:** `src/pages/public/LandingPage.jsx`, `src/components/landing/*`, `PublicNavbar`/`PublicFooter` tweaks if a scene requires it, new assets, new motion utilities.
**Out of scope:** Login, Register, 404/403, and all candidate / company / admin portals. Do not change routes, auth, stores or data files (read from them only).

## 3. Product context (IntelliHire)
- **What it is:** an AI-assisted interview and recruitment platform with two sides.
  - *Candidates:* practise role-specific mock interviews (spoken or typed), get a scored report (communication, answer structure, confidence, technical relevance), strengths, focus areas and an action plan; join talent communities.
  - *Companies:* post a role → share an application link → AI analyses every CV → AI screening interview → AI technical interview → one structured report per candidate → **humans make the final decision**.
- **Tone:** confident, plain, human. "AI assists. People decide." Avoid hype and unverifiable claims.
- **Real numbers available in the repo (use only these):** role count and the six disciplines from `src/data/rolesData.js` (`ROLE_CATEGORIES`); 3 AI stages; 6 steps from job post to offer; sample interview questions from `src/lib/interview/questionBank.js` (`buildQuestions`, `INTERVIEW_TYPES`). No customer logos, no user counts, no revenue claims, no fabricated testimonials presented as real people.

## 4. Repo facts (do not re-derive; respect them)
- React 19, Vite 8, React Router 7, **Tailwind v3** (`tailwind.config.js`, tokens as CSS vars in `src/index.css`), Zustand, lucide-react. JavaScript (no TS). Path alias `@/` → `src/`.
- Design tokens: `brand` (#F04E23, plus `brand-soft/hover/muted/art`), `ink` (#0D0D0D), `--line`, warm off-white ground. Fonts: **Fraunces** (display, via `font-display`/`.display`) and **Inter** (UI). Easing var `--ease-premium: cubic-bezier(0.22,1,0.36,1)`.
- Existing utilities in `index.css`: `.display`, `.eyebrow`, `.chip`, `.glass`, `.surface(-hover)`, `.spotlight`, `.marquee`, `.float-y`, `.word-in`, `.accordion-panel`, `.btn-primary/-secondary/-dark/-on-dark/-lg`, `.bg-dot-grid(-light)`, `.mask-radial`, `.mask-fade-x`.
- Existing shared pieces to **reuse, not duplicate:** `components/shared/Reveal.jsx`, `AnimatedCounter.jsx`, `BrandLogo.jsx`; `components/layout/PublicNavbar.jsx` (floating pill + scroll progress) and `PublicFooter.jsx`; hooks `useScrollProgress`, `useSectionNav`, `useInView`, `useReducedMotion`; `lib/spotlight.js`.
- Current landing sections in `components/landing/`: `Hero`, `RoleMarquee`, `PlatformTabs` (Companies/Candidates), `PipelineSection` (6-step timeline), `FeatureBento`, `PrinciplesBand` (dark stats), `Testimonials` (marquee), `FaqSection`, `FinalCta`. Keep or fold in what still fits; delete what is replaced.
- Assets: `src/assets/herosection image intellihire.png`, `save time and money image section intellihire.png`, `automate process image intellihire .png`, `section 2 image intellihire.png`, `auth-illustration.webp` (orange ground, person ↔ AI robot interview). DiceBear avatars are already used elsewhere.
- Verify with: `npx vite build`, `npx eslint <touched files>`. Dev server: `npx vite --port 5181`. (Some unrelated files may have pre-existing lint errors; do not fix them unless touched.)

## 5. Reference analysis — what daamia.com actually does
Daamia ("AI-powered fashion search engine for Pakistan") is a single page made of single-idea scenes on a warm off-white ground with near-black type and one dark pill CTA:
1. **Hero** — small wordmark eyebrow; huge two-line headline ("Fashion / Starts Here"); one centred **search bar** whose placeholder types real queries ("lawn suit", "black hoodie"); an image-search icon + round submit button; below, a **looping stats ticker** (1000+ brands · 100+ categories · 1.5M products · 2.8M images).
2. **Discover** — eyebrow "DISCOVER"; headline revealed **word by word**; a swipe/drag **carousel of look cards**, each tied to a natural-language query chip ("navy dupatta with embroidery", "gharara for mehndi night"); "Swipe to explore 4 looks" hint.
3. **Shop smarter** — "One search. Every brand."; three capability cards (filter by price, match with a photo, browse by category) in a swipe row; CTA "Start searching".
4. **Product details** — "Know what you're buying."; product cards that **annotate** the info the product surfaces (brand, fabric, price, category).
5. **Top brands** — a wall of brand marks.
6. **Help centre** — accordion FAQ.
7. **Final CTA** — "Find your next fit." + one button; minimal footer with socials.

**Principles to extract (the "why", so you can adapt rather than copy):** one idea per viewport; interaction as the story (search is both the hero and the demo); text splitting/stagger for rhythm; swipe rows instead of dense grids; whitespace and a quiet palette so the content is the colour; proof by showing the product's output, not claiming it.

## 6. Translation map — Daamia → IntelliHire
| Daamia scene | IntelliHire scene (build this) |
|---|---|
| Hero with search bar + typing placeholder | **Role search hero.** Headline e.g. "Interviews / That find real talent." One centred **role search bar**; placeholder types real roles from `ROLE_CATEGORIES` ("Frontend Developer", "Data Analyst", "DevOps Engineer"…). Typing filters a dropdown of matching roles; choosing one or pressing Enter routes to `/register?role=individual&target=<role>` (add handling only if Register already reads it; otherwise just link to `/register?role=individual`). Secondary link: "Hiring? Post a role" → `/register?role=company`. |
| Stats ticker | Looping ticker of **true** figures: roles supported · disciplines · AI stages · steps to offer · "100% human final decisions". |
| Floating "looks" | **Floating role cards** around/behind the hero: 8–10 cards for *different interview positions* across Engineering, AI & Data, DevOps & Cloud, Design, Product & Management (e.g. Frontend Developer, Data Scientist, SRE, Product Designer, Product Manager…). Each card: role title, discipline, a small score ring or "Interview ready" chip, role-appropriate artwork. Cards drift at different speeds, depth-layered, with cursor parallax. |
| Discover swipe carousel | **"Every role has its own interview."** Draggable/snap carousel of role cards. Clicking a card **opens a pop-up** (shared-layout transition from the card) showing 3 real sample questions generated by `buildQuestions({ role, type, difficulty, count: 3, seed })` plus the role's top skills (`skillsForRole`) and a "Practise this interview" CTA. |
| Shop smarter (3 cards) | **"One platform, both sides."** Candidate / Company toggle; three cards each: *AI mock interview*, *CV analysis*, *Ranked shortlist* (candidate view: practise, scored report, communities). Reuse `PlatformTabs` content. |
| Product details (annotated cards) | **Report anatomy.** A sticky report mock (score ring, four skill bars, STAR checklist, strengths, action plan). As the user scrolls, numbered callouts reveal one by one and the mock updates. Use data shaped like a real report from `lib/interview/evaluate.js`. |
| Top brands wall | **Disciplines wall** — the six categories with their real role counts; hover reveals the role names. No client logos. |
| Help centre | Keep `FaqSection` (copy is already truthful). |
| Final CTA | Reuse `FinalCta` (illustration card) with a short, quiet headline. |
Also keep: the existing "How it works" 6-step timeline (`PipelineSection`) if it fits after the report scene; drop the testimonial marquee unless real, attributable quotes are supplied (the current ones are placeholders).

## 7. Using the Framer integration
1. **Detect first.** List the Framer tools you have. If none are available in this session, say so explicitly, skip step 2 and implement the motion directly with the `motion` library — do not pretend.
2. **Explore in Framer (if available):** inspect the Framer project/components for reusable patterns — scroll-linked transforms, text-reveal/stagger effects, floating/parallax layers, drag carousels, shared-layout card→modal transitions, marquee/ticker. Capture exact parameters (duration, easing, stagger, spring stiffness/damping, scroll offsets). Optionally prototype the hero and the carousel→pop-up in Framer to validate feel, then **port the same parameters** to React.
3. **Implement in code with the `motion` package** (Framer Motion). It is the one approved new dependency: `npm i motion`. Import from `motion/react`. Use: `useScroll`/`useTransform` (parallax, sticky-scene progress), `motion.*` + `variants` (word-by-word reveals, stagger), `drag`/`dragConstraints` + snap logic (carousel), `layoutId` + `AnimatePresence` (card → pop-up), `useMotionValue`/`useSpring` (cursor parallax), `useReducedMotion`.
4. Do not export Framer-generated React code verbatim into the repo; re-author it in this project's tokens, naming and file structure.

## 8. Motion & interaction spec
- **Easing/time:** one family — `cubic-bezier(0.22,1,0.36,1)` for tweens (0.3–0.8s), springs for drag/pop-up (`stiffness 260–380, damping 26–34`). Stagger ≤ 60ms per word/item. Only `transform`/`opacity`/`filter`; never animate layout properties except through `layoutId`.
- **Hero:** word-by-word headline reveal on load; search placeholder typing loop (pauses on focus, stops when the user types); floating cards fade/scale in with stagger, then idle-drift (different amplitude/duration each) and respond to pointer (max ±14px, spring-smoothed); ticker translates continuously, pauses on hover and off-screen.
- **Carousel:** drag with inertia, snap to card, arrow buttons + keyboard (←/→), progress dots, "Swipe to explore" hint that fades after first interaction, edge fade masks.
- **Pop-up:** opens via shared-layout from the clicked card; backdrop blur; focus trap; Esc and outside-click close; body scroll locked; returns focus to the originating card.
- **Report anatomy:** sticky container with scroll progress mapped to callouts 1→N (opacity + small y shift + highlight ring on the matching region of the mock); score ring and bars animate when first revealed.
- **Scroll:** native scroll (no scroll-jacking), anchor links offset for the floating navbar, existing progress bar kept. Sticky scenes only where they tell a story.
- **Micro-interactions:** buttons keep the existing sheen; cards lift + spotlight on hover; chips scale subtly; cursor-reactive glow behind the hero.
- **Reduced motion:** with `prefers-reduced-motion`, disable parallax, drift, ticker and autoplay; keep opacity fades and instant state changes; everything stays fully usable.
- **Performance:** lazy-load below-the-fold scenes (`React.lazy`/dynamic import inside the landing route is fine), `will-change` only during animation, pause off-screen loops with `useInView`, no layout shift (explicit width/height on images), `fetchpriority="high"` on the hero visual only. Report the landing chunk size before and after.

## 9. Imagery
- No image generation is available. Priority order: (1) existing `src/assets/*` and `auth-illustration.webp`; (2) CSS/SVG role artwork built from the brand palette (initial/monogram tiles, gradients, simple vector scenes per discipline) and DiceBear avatars; (3) if the user supplies licensed photos, place them in `src/assets/roles/` (webp, ≤ 120 KB each, 4:5 ratio) and wire them in.
- Never hotlink third-party photos or use unlicensed images. Add an **Open items** note: real role photography would lift the page further.

## 10. Engineering constraints
- Reuse tokens/utilities/components; no hard-coded hex values where a token exists; no new fonts or colours.
- New components live in `src/components/landing/` (one per scene, e.g. `RoleSearchHero`, `FloatingRoleCards`, `RoleCarousel`, `RolePopup`, `ReportAnatomy`, `DisciplinesWall`); shared motion helpers in `src/lib/motion.js`.
- Accessibility: semantic landmarks and one `h1`; search is a labelled combobox (`role="combobox"`, `aria-expanded`, arrow-key navigation); carousel exposes `role="region"` + `aria-roledescription="carousel"`; pop-up is `role="dialog" aria-modal`; focus rings visible; contrast ≥ 4.5:1; every image has meaningful alt or `alt=""` if decorative.
- Responsive at 320 / 375 / 768 / 1024 / 1440 and landscape phones: floating cards collapse to a horizontal strip below `md`; carousel is native-swipe on touch; no horizontal page scroll; hit targets ≥ 44px on touch.
- No console errors, no unused code left behind, no commented-out blocks. Do not commit unless asked.

## 11. Process (follow in order)
**Phase 0 — Recon (short).** Read the files listed in §4, run the dev server, screenshot the current landing at desktop and 375px, list Framer tools available.
**Phase 1 — Plan. Stop and wait for approval.** Deliver: (a) a storyboard table — for each scene: the Daamia idea it adapts, IntelliHire content (exact copy), layout in words, animation spec (what, trigger, duration/easing), mobile behaviour; (b) component/file list (new / reused / deleted); (c) which Framer patterns you will mirror and their parameters, or "Framer unavailable"; (d) asset plan and what the user must supply; (e) risks and how you will measure them (bundle size, CLS, FPS on mid-range phones).
**Phase 2 — Implement.** One scene at a time in storyboard order. After each scene: open it in the browser at desktop and 375px, test mouse + touch + keyboard + reduced motion, check the console, fix, then continue.
**Phase 3 — Verify.** `npx vite build`; `npx eslint` on touched files; automated check that no element overflows the viewport at 320 and 375px; confirm the Landing chunk is still lazy-loaded; compare bundle size.

## 12. Acceptance criteria
- Seven scenes present and visibly Daamia-like in pacing: role-search hero + ticker, floating role cards, role carousel with working pop-up, two-sided platform scene, report-anatomy scroll scene, disciplines wall, FAQ + final CTA (timeline kept where it fits).
- Hero search works end-to-end (filter, select, navigate).
- Pop-up shows real generated questions, is keyboard-accessible and restores focus.
- Reduced-motion mode verified; mobile layout verified; Lighthouse/CLS has no regressions you can measure.
- Build passes, touched files lint clean, no console errors.
- Copy contains no claim the product cannot support.

## 13. Final report format (≤ 200 words)
What changed (scenes + files), the Framer patterns/parameters used, bundle-size delta, how you verified (viewports, reduced motion, keyboard), and **Open items** (photography, real testimonials, Register reading `?target=`, anything skipped).
