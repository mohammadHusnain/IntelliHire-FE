DESIGN PHILOSOPHY — AXISFLOW-LEVEL PREMIUM SAAS
Looking at AxisFlow's visual language from the reference screenshot:

Pure white canvas. #FFFFFF everywhere. No off-whites, no ivory, no grey page backgrounds.
Deep charcoal type. #0D0D0D for headings, #374151 for body. Black is bold and intentional.
Orange is the only accent. Used sparingly for CTAs, italic headline words, section labels, hover states, and key UI signals. NOT used for large fills.
Orange italic in headlines. AxisFlow's signature: one or two italic orange words inside a black heading — "Hire smarter. Prepare faster." This is the premium brand move.
Section tags. Small uppercase orange-tinted labels above each section ("MOCK INTERVIEW PLATFORM", "AI HIRING PIPELINE").
Numbered feature cards. 01 / 02 / 03 with dark card backgrounds (#0D0D0D) and orange accents — creates visual rhythm.
No blue anywhere. Remove every blue token. Orange is the single accent.
Minimal border use. Only 1px #E5E7EB borders. Cards have no shadows.
Animation-forward. Scroll reveals, counter animations, hover lifts, sticky navbar, hero motion — all specified.


GLOBAL COLOR SYSTEM — APPLIED TO ALL 21 SCREENS
css/* ============================================================
   INTELLI-HIRE DESIGN TOKENS v4
   AxisFlow-inspired: White + Black + Orange
   ============================================================ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

:root {

  /* ── FONTS ─────────────────────────────────────── */
  --font-heading: 'Times New Roman', Georgia, Times, serif;
  --font-ui:      'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* ── ORANGE PALETTE (primary accent) ───────────── */
  --orange:           #F04E23;   /* AxisFlow warm orange — main CTA, accents */
  --orange-hover:     #D43D14;   /* Darker orange on hover */
  --orange-light:     #FFF4F1;   /* Very light orange tint — hover bg, subtle fills */
  --orange-muted:     #FCA68A;   /* Muted orange for decorative elements */

  /* ── BLACK / CHARCOAL (text + dark cards) ──────── */
  --black:            #0D0D0D;   /* Near-black — main headings, dark cards */
  --charcoal:         #1A1A1A;   /* Slightly lighter — dark card backgrounds */
  --dark-card-bg:     #111111;   /* Dark feature cards (numbered 01/02/03) */
  --text-primary:     #0D0D0D;   /* Heading text */
  --text-secondary:   #374151;   /* Body text */
  --text-muted:       #9CA3AF;   /* Captions, labels */
  --text-placeholder: #D1D5DB;   /* Input placeholders */
  --text-on-dark:     #FFFFFF;   /* Text on dark cards */
  --text-on-dark-m:   #A8A8A8;   /* Muted text on dark cards */

  /* ── WHITE / BACKGROUNDS ────────────────────────── */
  --bg-page:          #FFFFFF;   /* Pure white — page background EVERYWHERE */
  --bg-card:          #FFFFFF;   /* Cards are white */
  --bg-sidebar:       #FFFFFF;   /* Sidebar white */
  --bg-hover:         #FAFAFA;   /* Subtle hover on rows */
  --bg-active:        #FFF4F1;   /* Active state — orange-tinted white */
  --bg-table-head:    #FAFAFA;   /* Table header row */
  --bg-input:         #FFFFFF;

  /* ── BORDERS ────────────────────────────────────── */
  --border:           #E5E7EB;   /* Default 1px border */
  --border-strong:    #D1D5DB;
  --border-focus:     #F04E23;   /* Orange focus ring — replaces old black/blue */

  /* ── SEMANTIC (only for status badges, never large areas) */
  --success:          #059669;   --success-bg: #F0FDF4;
  --warning:          #D97706;   --warning-bg: #FFFBEB;
  --danger:           #DC2626;   --danger-bg:  #FEF2F2;

  /* Score badges use semantic colors */
  --score-high-text:  #059669;   --score-high-bg: #F0FDF4;
  --score-mid-text:   #D97706;   --score-mid-bg:  #FFFBEB;
  --score-low-text:   #DC2626;   --score-low-bg:  #FEF2F2;
}

TYPOGRAPHY SYSTEM
css/* ── HEADINGS (Times New Roman) ─────────────────── */
h1 { font-family: var(--font-heading); font-size: 36px; font-weight: 700; color: var(--text-primary); line-height: 1.15; }
h2 { font-family: var(--font-heading); font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
h3 { font-family: var(--font-heading); font-size: 22px; font-weight: 700; color: var(--text-primary); }

/* ── ORANGE ITALIC ACCENT (AxisFlow signature move) */
.accent-word { color: var(--orange); font-style: italic; }
/* Usage in JSX: <h1>Hire <span className="accent-word">smarter.</span></h1> */
/* Usage in JSX: <h1>Prepare <span className="accent-word">faster.</span></h1> */

/* ── SECTION TAG (above section headings) ────────── */
.section-tag {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--orange);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
}
.section-tag::before {
  content: '';
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--orange);
}

/* ── METRIC NUMBERS (Times New Roman) ────────────── */
.metric-number { font-family: var(--font-heading); font-size: 40px; font-weight: 700; color: var(--text-primary); }
.metric-number.orange { color: var(--orange); }

/* ── BODY ────────────────────────────────────────── */
p  { font-family: var(--font-ui); font-size: 14px; color: var(--text-secondary); line-height: 1.7; }
.body-large { font-size: 16px; }
.label-sm   { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }

COMPONENT LIBRARY — ALL SCREENS
Buttons
css/* Primary — Orange (replaces all black buttons from v3) */
.btn-primary {
  background: var(--orange);
  color: #FFFFFF;
  font-family: var(--font-ui);
  font-size: 14px; font-weight: 500;
  height: 42px; padding: 0 22px;
  border-radius: 8px; border: none;
  cursor: pointer;
  transition: background 150ms ease, transform 100ms ease;
}
.btn-primary:hover { background: var(--orange-hover); }
.btn-primary:active { transform: scale(0.98); }

/* Secondary — white with border */
.btn-secondary {
  background: #FFFFFF; color: var(--text-primary);
  border: 1px solid var(--border);
  font-size: 14px; font-weight: 500;
  height: 42px; padding: 0 22px; border-radius: 8px;
  transition: border-color 150ms, background 150ms;
}
.btn-secondary:hover { border-color: var(--orange); color: var(--orange); }

/* Ghost */
.btn-ghost { background: transparent; border: none; color: var(--text-secondary); font-size: 14px; }
.btn-ghost:hover { color: var(--orange); }

/* Danger */
.btn-danger { background: var(--danger); color: #FFFFFF; border-radius: 8px; }

/* Dark (for dark card contexts) */
.btn-dark-outline {
  background: transparent; color: #FFFFFF;
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 8px; height: 42px; padding: 0 22px;
}
.btn-dark-outline:hover { border-color: var(--orange); color: var(--orange); }
Sidebar
css.sidebar {
  width: 240px; height: 100vh; position: fixed; left: 0; top: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
}
/* Logo area — 56px */
.sidebar-logo { font-family: var(--font-heading); font-size: 20px; color: var(--text-primary); padding: 0 20px; height: 56px; display: flex; align-items: center; }
.sidebar-logo span { color: var(--orange); } /* accent dot or word */

/* Nav items */
.sidebar-item {
  display: flex; align-items: center; gap: 10px;
  height: 38px; padding: 0 12px; border-radius: 6px; margin: 2px 8px;
  font-family: var(--font-ui); font-size: 14px; font-weight: 500;
  color: var(--text-muted); cursor: pointer;
  transition: background 120ms, color 120ms;
  text-decoration: none;
}
.sidebar-item:hover { background: var(--orange-light); color: var(--orange); }
.sidebar-item.active {
  background: var(--orange-light);
  color: var(--orange);
  border-left: 2px solid var(--orange);    /* Orange left indicator */
  padding-left: 10px;
}
.sidebar-item svg { width: 18px; height: 18px; flex-shrink: 0; }
Top Bar (all authenticated screens)
css.topbar {
  height: 56px; background: #FFFFFF;
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; padding: 0 32px;
  justify-content: space-between;
}
.topbar-title { font-family: var(--font-heading); font-size: 22px; color: var(--text-primary); }
Cards
css.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  transition: border-color 150ms;
}
.card:hover { border-color: var(--border-strong); }

/* Dark Feature Card (numbered sections) */
.card-dark {
  background: var(--dark-card-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 28px;
  color: var(--text-on-dark);
}
.card-dark .card-num {
  font-family: var(--font-heading); font-size: 36px;
  color: var(--orange); font-weight: 700; margin-bottom: 16px;
}
.card-dark h3 { color: #FFFFFF; }
.card-dark p  { color: var(--text-on-dark-m); font-size: 14px; }
KPI / Metric Cards
css.kpi-card {
  background: #FFFFFF; border: 1px solid var(--border);
  border-radius: 10px; padding: 24px;
  transition: border-color 150ms, transform 150ms;
}
.kpi-card:hover { border-color: var(--orange); transform: translateY(-2px); }
.kpi-card .kpi-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 10px; }
.kpi-card .kpi-value { font-family: var(--font-heading); font-size: 40px; font-weight: 700; color: var(--text-primary); line-height: 1; }
.kpi-card .kpi-trend { font-size: 12px; color: var(--success); margin-top: 8px; }
Inputs
css.input-field {
  width: 100%; height: 40px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-input); padding: 0 14px;
  font-family: var(--font-ui); font-size: 14px; color: var(--text-primary);
  transition: border-color 150ms, box-shadow 150ms;
  outline: none;
}
.input-field:focus {
  border-color: var(--orange);
  box-shadow: 0 0 0 3px rgba(240, 78, 35, 0.10); /* Orange glow */
}
.input-label {
  font-family: var(--font-ui); font-size: 13px; font-weight: 500;
  color: var(--text-secondary); margin-bottom: 6px; display: block;
}
.input-error { border-color: var(--danger); }
.error-msg { font-size: 12px; color: var(--danger); margin-top: 4px; }
Tables
css.table-container { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.table-header { background: var(--bg-table-head); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); padding: 12px 16px; border-bottom: 1px solid var(--border); }
.table-row { padding: 14px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: var(--text-secondary); transition: background 120ms; }
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: var(--bg-hover); }
Badges / Pills
css.badge { font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
.badge-orange  { background: var(--orange-light); color: var(--orange); }      /* Active/Published */
.badge-success { background: var(--success-bg);   color: var(--success); }
.badge-warning { background: var(--warning-bg);   color: var(--warning); }
.badge-danger  { background: var(--danger-bg);    color: var(--danger); }
.badge-neutral { background: #F3F4F6;             color: var(--text-muted); }  /* Draft/Grey */

/* Stage-specific */
.stage-applied     { background: #F3F4F6;      color: #6B7280; }
.stage-shortlisted { background: var(--orange-light); color: var(--orange); }  /* Orange not blue */
.stage-screening   { background: #FFF4F1;      color: var(--orange-hover); }
.stage-technical   { background: var(--warning-bg); color: var(--warning); }
.stage-interviewed { background: #FEF3C7;      color: #92400E; }
.stage-decided     { background: var(--success-bg); color: var(--success); }
.stage-rejected    { background: var(--danger-bg);  color: var(--danger); }
Toast Notifications
css.toast {
  position: fixed; top: 20px; right: 20px; z-index: 9999;
  background: #FFFFFF; border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 18px;
  width: 320px;
  border-left: 4px solid var(--orange);   /* Orange left accent */
  font-size: 14px; color: var(--text-primary);
  animation: toastIn 200ms ease;
}
@keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
Orange Focus Ring (all focusable elements)
css*:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }

ANIMATION SYSTEM — ALL SCREENS
css/* ── SCROLL REVEAL (apply to sections, cards, rows) ─── */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 500ms ease, transform 500ms ease;
}
.reveal.visible {
  opacity: 1;
  transform: none;
}
/* Stagger children: nth-child delay in JS */

/* ── HOVER LIFT (cards, KPI cards, session rows) ──── */
.hover-lift {
  transition: transform 150ms ease, border-color 150ms ease;
}
.hover-lift:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
}

/* ── COUNTER ANIMATION (KPI numbers, hero stats) ──── */
/* Implemented in JS: count from 0 to target over 1200ms using requestAnimationFrame */
/* Trigger when element enters viewport via IntersectionObserver */

/* ── SKELETON LOADING ─────────────────────────────── */
.skeleton {
  background: linear-gradient(90deg, #F3F4F6 25%, #FAFAFA 50%, #F3F4F6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

/* ── ORANGE UNDERLINE HOVER (nav links) ──────────── */
.nav-link {
  position: relative;
  color: var(--text-secondary); text-decoration: none; font-size: 14px;
  transition: color 150ms;
}
.nav-link::after {
  content: ''; position: absolute; bottom: -2px; left: 0;
  width: 0; height: 2px; background: var(--orange);
  transition: width 200ms ease;
}
.nav-link:hover { color: var(--orange); }
.nav-link:hover::after { width: 100%; }

/* ── HERO WORD FADE-IN (staggered) ──────────────── */
@keyframes wordFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
.hero-word { display: inline-block; animation: wordFadeUp 500ms ease both; }
.hero-word:nth-child(1) { animation-delay: 0ms; }
.hero-word:nth-child(2) { animation-delay: 80ms; }
.hero-word:nth-child(3) { animation-delay: 160ms; }
.hero-word:nth-child(4) { animation-delay: 240ms; }

/* ── STICKY NAVBAR TRANSITION ───────────────────── */
.navbar { transition: box-shadow 250ms, background 250ms; }
.navbar.scrolled { box-shadow: 0 1px 0 var(--border); }

/* ── ORANGE PULSE (record button in S7) ─────────── */
@keyframes orangePulse {
  0%   { box-shadow: 0 0 0 0   rgba(240,78,35,0.40); }
  70%  { box-shadow: 0 0 0 14px rgba(240,78,35,0); }
  100% { box-shadow: 0 0 0 0   rgba(240,78,35,0); }
}
.record-active { animation: orangePulse 1.2s infinite; }

/* ── MODAL ─────────────────────────────────────── */
@keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.modal { animation: modalIn 150ms ease; }
.modal-overlay { background: rgba(0,0,0,0.4); }

/* ── SIDE PANEL (S21 details) ───────────────────── */
@keyframes panelIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.side-panel { animation: panelIn 200ms ease; }

/* ── PAGE TRANSITIONS ────────────────────────────── */
.page-enter { animation: wordFadeUp 250ms ease; }