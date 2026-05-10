# IntelliHire Frontend - Page Routes

## UX Enhancements Applied

### Shared Components Created
- **Toast Notification System** - Success, error, warning, info notifications
- **Skeleton Loaders** - Loading states for cards, forms, tables
- **Confirm Dialogs** - Warning, danger, info confirmation dialogs
- **Empty States** - Guidance when no data is available

### UX Improvements Across All Pages
- Loading states with skeleton screens
- Toast notifications for user feedback
- Form validation with inline error messages
- Confirmation dialogs for destructive actions
- Search and filter functionality
- Hover effects and micro-interactions
- Responsive layout improvements
- Notification widgets
- Quick action panels
- Empty state guidance

See `UX_ENHANCEMENTS.md` for detailed documentation.

---

## Public Pages (No Authentication Required)

| Page | Route | Description |
|------|-------|-------------|
| **Landing Page** | `/` | Marketing page with features, testimonials, CTA |
| **Login** | `/login` | User login with role selection |
| **Register** | `/register` | User registration (Individual/Company) |

---

## Candidate Portal Pages (Individual User)

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/candidate/dashboard` | Candidate home - stats, recent sessions, tips |
| **My Profile** | `/candidate/profile` | Edit profile, upload photo, CV management |
| **Interview Setup** | `/candidate/interview/setup` | Pre-interview configuration (type, role, CV toggle) |
| **Interview Room** | `/candidate/interview/room` | Full-screen AI interview with recording |
| **Interview Report** | `/candidate/report/:id` | AI-generated feedback report |

---

## Quick Access URLs (Development)

### Mock Report (For Testing)
```
http://localhost:5173/candidate/report/123
```

### All Routes Summary
```
/                          → Landing Page
/login                     → Login Page
/register                  → Register Page
/candidate/dashboard       → Candidate Dashboard
/candidate/profile         → Candidate Profile
/candidate/interview/setup → Interview Setup
/candidate/interview/room  → Interview Room (Full-screen)
/candidate/report/:id      → Interview Report
```

---

## Design System (Enhanced)

- **Font**: Times New Roman (serif)
- **Primary Color**: #2563EB (Blue)
- **Background**: #FAFAFA (Light grey)
- **Cards**: 
  - Gradient backgrounds: `from-white to-[#F8FAFC]`
  - Border: #E5E7EB with subtle shadows
  - Border Radius: 12-16px with enhanced depth
  - Decorative blur shapes for visual interest
- **Enhanced Features**:
  - Soft gradient overlays on cards
  - Hover effects with shadow transitions
  - Glass-morphism elements (backdrop-blur)
  - Animated progress rings and bars
  - Icon containers with gradient backgrounds
- **Sidebar Width**: 240px fixed

### Enhanced Components

| Component | Enhancements |
|-----------|--------------|
| **Score Ring** | 120px size, gradient stroke, colored glow effect |
| **Score Cards** | Icon containers, gradient bars, hover shadows |
| **Session Cards** | Score rings with color-coded shadows, gradient hover |
| **Stat Cards** | Sparklines, trend badges, icon containers |
| **Profile Card** | Gradient avatar ring, photo shadow, location badge |
| **CV Section** | Gradient file cards, icon buttons |
| **Form Inputs** | 10px radius, focus glow effects, icon prefixes |

---

## Tech Stack

- React 19 + React Router DOM v7
- Tailwind CSS v3.4
- Lucide React (icons)
- Vite (build tool)
